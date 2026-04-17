import express from "express";
import request from "supertest";

import { leaderRouter } from "../../src/features/leaders/routes/leaderRoutes";
import { orderRouter } from "../../src/features/orders/routes/orderRoutes";
import * as leaderService from "../../src/features/leaders/services/leaderService";
import * as orderService from "../../src/features/orders/services/orderService";

vi.mock("../../src/features/orders/services/orderService", () => ({
  checkoutOrder: vi.fn(),
  getLedger: vi.fn(),
  getOrderById: vi.fn(),
  quoteOrder: vi.fn(),
}));

vi.mock("../../src/features/leaders/services/leaderService", () => ({
  getLeaderDashboard: vi.fn(),
  getMyLeaderApplication: vi.fn(),
  getPendingLeaderApplications: vi.fn(),
  reviewLeaderApplication: vi.fn(),
  submitLeaderApplication: vi.fn(),
}));

const mockedOrderService = vi.mocked(orderService);
const mockedLeaderService = vi.mocked(leaderService);

describe("order and leader route authorization", () => {
  const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const roleHeader = req.header("x-role");
      const roles = roleHeader ? roleHeader.split(",") : [];

      if (roles.length > 0) {
        req.auth = {
          userId: Number(req.header("x-user-id") ?? "1"),
          username: "test-user",
          roles: roles as any,
          tokenHash: "test-hash",
        };
      }

      next();
    });

    app.use(orderRouter);
    app.use(leaderRouter);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication for order detail endpoint", async () => {
    const app = buildApp();

    const response = await request(app).get("/orders/42");

    expect(response.status).toBe(401);
    expect(mockedOrderService.getOrderById).not.toHaveBeenCalled();
  });

  it("passes auth context to order detail service for object-level authorization", async () => {
    mockedOrderService.getOrderById.mockResolvedValue({
      id: 42,
      userId: 15,
      cycleId: 3,
      pickupPointId: 7,
      status: "CONFIRMED",
      pickupWindow: {
        pickupWindowId: 9,
        date: "2026-04-01",
        startTime: "09:00:00",
        endTime: "11:00:00",
      },
      totals: {
        subtotal: 10,
        discount: 0,
        subsidy: 0,
        tax: 0.8,
        total: 10.8,
      },
      pricingTrace: {},
      items: [],
    });

    const app = buildApp();

    const response = await request(app)
      .get("/orders/42")
      .set("x-role", "MEMBER")
      .set("x-user-id", "15");

    expect(response.status).toBe(200);
    expect(mockedOrderService.getOrderById).toHaveBeenCalledWith({
      orderId: 42,
      userId: 15,
      roles: ["MEMBER"],
    });
  });

  it("returns 404 when no accessible order is found", async () => {
    mockedOrderService.getOrderById.mockResolvedValue(null);

    const app = buildApp();

    const response = await request(app)
      .get("/orders/99")
      .set("x-role", "MEMBER")
      .set("x-user-id", "15");

    expect(response.status).toBe(404);
    expect(mockedOrderService.getOrderById).toHaveBeenCalledWith({
      orderId: 99,
      userId: 15,
      roles: ["MEMBER"],
    });
  });

  it("blocks non-member roles from leader application submit endpoint", async () => {
    const app = buildApp();

    const response = await request(app)
      .post("/leaders/applications")
      .set("x-role", "FINANCE_CLERK")
      .send({
        fullName: "Leader Candidate",
        phone: "555-0101",
        experienceSummary:
          "I have organized community pickup operations for over two years.",
        requestedCommissionEligible: true,
      });

    expect(response.status).toBe(403);
    expect(mockedLeaderService.submitLeaderApplication).not.toHaveBeenCalled();
  });

  it("allows members to submit leader onboarding applications", async () => {
    mockedLeaderService.submitLeaderApplication.mockResolvedValue({
      id: 12,
      userId: 22,
      fullName: "Leader Candidate",
      phone: "555-0101",
      experienceSummary:
        "I have organized community pickup operations for over two years.",
      pickupPointId: null,
      requestedCommissionEligible: true,
      status: "PENDING",
      submittedAt: "2026-04-02T10:00:00.000Z",
      reviewedAt: null,
      decisionReason: null,
      decisionByAdminId: null,
      decisionByAdminUsername: null,
      decisionCommissionEligible: null,
      decisionAt: null,
    });

    const app = buildApp();

    const response = await request(app)
      .post("/leaders/applications")
      .set("x-role", "MEMBER")
      .set("x-user-id", "22")
      .send({
        fullName: "Leader Candidate",
        phone: "555-0101",
        experienceSummary:
          "I have organized community pickup operations for over two years.",
        requestedCommissionEligible: true,
      });

    expect(response.status).toBe(201);
    expect(mockedLeaderService.submitLeaderApplication).toHaveBeenCalledWith({
      userId: 22,
      input: expect.objectContaining({
        fullName: "Leader Candidate",
        requestedCommissionEligible: true,
      }),
    });
  });

  it("blocks non-admin access to pending leader applications", async () => {
    const app = buildApp();

    const response = await request(app)
      .get("/admin/leaders/applications/pending")
      .set("x-role", "REVIEWER");

    expect(response.status).toBe(403);
    expect(
      mockedLeaderService.getPendingLeaderApplications,
    ).not.toHaveBeenCalled();
  });

  it("allows administrators to review leader applications", async () => {
    mockedLeaderService.reviewLeaderApplication.mockResolvedValue({
      id: 88,
      leaderApplicationId: 12,
      adminUserId: 1,
      adminUsername: "admin1",
      decision: "APPROVED",
      reason: "Credentials verified.",
      commissionEligible: true,
      createdAt: "2026-04-02T10:05:00.000Z",
    });

    const app = buildApp();

    const response = await request(app)
      .post("/admin/leaders/applications/12/decision")
      .set("x-role", "ADMINISTRATOR")
      .set("x-user-id", "1")
      .send({
        decision: "APPROVE",
        reason: "Credentials verified.",
        commissionEligible: true,
      });

    expect(response.status).toBe(200);
    expect(mockedLeaderService.reviewLeaderApplication).toHaveBeenCalledWith({
      applicationId: 12,
      adminUserId: 1,
      input: {
        decision: "APPROVE",
        reason: "Credentials verified.",
        commissionEligible: true,
      },
    });
  });

  it("blocks non-group-leader access to leader dashboard metrics", async () => {
    const app = buildApp();

    const response = await request(app)
      .get("/leaders/dashboard/metrics")
      .set("x-role", "MEMBER")
      .set("x-user-id", "22");

    expect(response.status).toBe(403);
    expect(mockedLeaderService.getLeaderDashboard).not.toHaveBeenCalled();
  });

  it("allows group leaders to access dashboard metrics", async () => {
    mockedLeaderService.getLeaderDashboard.mockResolvedValue({
      leaderId: 7,
      windowStartDate: "2026-03-04",
      windowEndDate: "2026-04-02",
      orderVolume: 18,
      fulfillmentRate: 94.44,
      feedbackTrend: {
        latest7DayAverage: 4.7,
        previous7DayAverage: 4.6,
        direction: "UP",
      },
      daily: [],
    });

    const app = buildApp();

    const response = await request(app)
      .get("/leaders/dashboard/metrics")
      .set("x-role", "GROUP_LEADER")
      .set("x-user-id", "7");

    expect(response.status).toBe(200);
    expect(mockedLeaderService.getLeaderDashboard).toHaveBeenCalledWith({
      leaderUserId: 7,
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  // --- GET /leaders/applications/me ---

  it("GET /leaders/applications/me returns the current user's application payload", async () => {
    mockedLeaderService.getMyLeaderApplication.mockResolvedValue({
      id: 12,
      userId: 22,
      fullName: "Member Candidate",
      phone: "555-0101",
      experienceSummary:
        "I have organized community pickup operations for over two years.",
      pickupPointId: null,
      requestedCommissionEligible: true,
      status: "PENDING",
      submittedAt: "2026-04-02T10:00:00.000Z",
      reviewedAt: null,
      decisionReason: null,
      decisionByAdminId: null,
      decisionByAdminUsername: null,
      decisionCommissionEligible: null,
      decisionAt: null,
    });

    const app = buildApp();

    const response = await request(app)
      .get("/leaders/applications/me")
      .set("x-role", "MEMBER")
      .set("x-user-id", "22");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: 12,
      userId: 22,
      status: "PENDING",
    });
    expect(mockedLeaderService.getMyLeaderApplication).toHaveBeenCalledWith(22);
  });

  it("GET /leaders/applications/me returns a null data payload when the user has no application yet", async () => {
    mockedLeaderService.getMyLeaderApplication.mockResolvedValue(null);

    const app = buildApp();

    const response = await request(app)
      .get("/leaders/applications/me")
      .set("x-role", "MEMBER")
      .set("x-user-id", "99");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeNull();
    expect(mockedLeaderService.getMyLeaderApplication).toHaveBeenCalledWith(99);
  });

  it("GET /leaders/applications/me requires auth (401 without a session)", async () => {
    const app = buildApp();

    const response = await request(app).get("/leaders/applications/me");

    expect(response.status).toBe(401);
    expect(mockedLeaderService.getMyLeaderApplication).not.toHaveBeenCalled();
  });

  it("GET /leaders/applications/me forbids FINANCE_CLERK (member/group-leader only)", async () => {
    const app = buildApp();

    const response = await request(app)
      .get("/leaders/applications/me")
      .set("x-role", "FINANCE_CLERK")
      .set("x-user-id", "5");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
    expect(mockedLeaderService.getMyLeaderApplication).not.toHaveBeenCalled();
  });

  // --- GET /admin/leaders/applications/pending SUCCESS path (admin-only) ---

  it("GET /admin/leaders/applications/pending returns the pending list for an ADMINISTRATOR", async () => {
    mockedLeaderService.getPendingLeaderApplications.mockResolvedValue([
      {
        id: 12,
        userId: 22,
        fullName: "Member Candidate",
        phone: "555-0101",
        experienceSummary:
          "I have organized community pickup operations for over two years.",
        pickupPointId: null,
        requestedCommissionEligible: true,
        status: "PENDING",
        submittedAt: "2026-04-02T10:00:00.000Z",
        reviewedAt: null,
        decisionReason: null,
        decisionByAdminId: null,
        decisionByAdminUsername: null,
        decisionCommissionEligible: null,
        decisionAt: null,
      },
      {
        id: 13,
        userId: 23,
        fullName: "Another Candidate",
        phone: "555-0202",
        experienceSummary:
          "Three years organizing neighborhood pickup logistics and communications.",
        pickupPointId: null,
        requestedCommissionEligible: false,
        status: "PENDING",
        submittedAt: "2026-04-03T11:00:00.000Z",
        reviewedAt: null,
        decisionReason: null,
        decisionByAdminId: null,
        decisionByAdminUsername: null,
        decisionCommissionEligible: null,
        decisionAt: null,
      },
    ] as any);

    const app = buildApp();

    const response = await request(app)
      .get("/admin/leaders/applications/pending")
      .set("x-role", "ADMINISTRATOR")
      .set("x-user-id", "1");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({
      id: 12,
      status: "PENDING",
      requestedCommissionEligible: true,
    });
    expect(
      mockedLeaderService.getPendingLeaderApplications,
    ).toHaveBeenCalledTimes(1);
  });

  it("GET /admin/leaders/applications/pending returns 401 without a session", async () => {
    const app = buildApp();

    const response = await request(app).get(
      "/admin/leaders/applications/pending",
    );

    expect(response.status).toBe(401);
    expect(
      mockedLeaderService.getPendingLeaderApplications,
    ).not.toHaveBeenCalled();
  });
});
