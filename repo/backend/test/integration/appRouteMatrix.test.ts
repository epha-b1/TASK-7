/**
 * Integration tests through the real createApp() middleware chain that
 * verify role-based authorization and the service-layer handoff for each
 * major feature router. Service-layer behavior is stubbed at the lowest
 * repository/service boundary so these tests stay deterministic while
 * exercising the full auth + CSRF + error-envelope pipeline.
 */

import request from "supertest";
import argon2 from "argon2";
import {
  sharedInMemoryStore,
} from "./helpers/inMemoryAuthStore";

vi.mock("../../src/auth/mysqlAuthStore", () => ({
  MySqlAuthStore: vi.fn(() => sharedInMemoryStore),
}));

vi.mock("../../src/db/pool", () => ({
  dbPool: {
    query: vi.fn().mockResolvedValue([[]]),
    getConnection: vi.fn(),
  },
}));

vi.mock("../../src/features/orders/services/orderService", () => ({
  quoteOrder: vi.fn(),
  checkoutOrder: vi.fn(),
  getOrderById: vi.fn(),
  getLedger: vi.fn(),
}));

vi.mock("../../src/features/finance/services/financeService", () => ({
  getCommissionSummary: vi.fn(),
  getWithdrawalEligibility: vi.fn(),
  requestWithdrawal: vi.fn(),
  getReconciliationCsv: vi.fn(),
  getWithdrawalBlacklist: vi.fn(),
  addOrReplaceBlacklist: vi.fn(),
  patchBlacklistEntry: vi.fn(),
  removeBlacklistEntry: vi.fn(),
}));

vi.mock("../../src/features/appeals/services/appealService", () => ({
  createAppealRecord: vi.fn(),
  getAppealDetail: vi.fn(),
  getAppealTimeline: vi.fn(),
  listAppealQueue: vi.fn(),
  transitionAppealStatus: vi.fn(),
  uploadAppealFiles: vi.fn(),
  getAppealFileForDownload: vi.fn(),
}));

vi.mock("../../src/features/discussions/services/discussionService", () => ({
  createThreadComment: vi.fn(),
  flagComment: vi.fn(),
  getThreadComments: vi.fn(),
  resolveThreadByContext: vi.fn(),
  listUserNotifications: vi.fn(),
  patchNotificationReadState: vi.fn(),
  unhideComment: vi.fn(),
}));

vi.mock("../../src/features/audit/services/auditService", () => ({
  getAuditExportCsv: vi.fn().mockResolvedValue("id,actor\n1,9"),
  getAuditSearch: vi.fn(),
  verifyAuditChain: vi.fn(),
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/features/behavior/services/behaviorService", () => ({
  ingestBehaviorEvents: vi.fn(),
  getBehaviorSummary: vi.fn(),
  getRetentionStatus: vi.fn(),
  runRetentionJobs: vi.fn(),
  startBehaviorBackgroundJobs: vi.fn(),
  recordServerBehaviorEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/features/commerce/services/commerceService", () => ({
  listActiveBuyingCycles: vi.fn(),
  listListings: vi.fn(),
  getPickupPointDetail: vi.fn(),
  toggleFavoriteTarget: vi.fn(),
  createPickupWindowService: vi.fn(),
}));

vi.mock("../../src/features/leaders/services/leaderService", () => ({
  submitLeaderApplication: vi.fn(),
  getMyLeaderApplication: vi.fn(),
  getPendingLeaderApplications: vi.fn(),
  reviewLeaderApplication: vi.fn(),
  getLeaderDashboard: vi.fn(),
}));

import { createApp } from "../../src/app";
import * as orderService from "../../src/features/orders/services/orderService";
import * as financeService from "../../src/features/finance/services/financeService";
import * as appealService from "../../src/features/appeals/services/appealService";
import * as discussionService from "../../src/features/discussions/services/discussionService";
import * as auditService from "../../src/features/audit/services/auditService";
import * as behaviorService from "../../src/features/behavior/services/behaviorService";
import * as commerceService from "../../src/features/commerce/services/commerceService";
import * as leaderService from "../../src/features/leaders/services/leaderService";

const orderMock = vi.mocked(orderService);
const financeMock = vi.mocked(financeService);
const appealMock = vi.mocked(appealService);
const discussionMock = vi.mocked(discussionService);
const auditMock = vi.mocked(auditService);
const behaviorMock = vi.mocked(behaviorService);
const commerceMock = vi.mocked(commerceService);
const leaderMock = vi.mocked(leaderService);

type Role =
  | "MEMBER"
  | "GROUP_LEADER"
  | "REVIEWER"
  | "FINANCE_CLERK"
  | "ADMINISTRATOR";

const seedUsers = async () => {
  const hash = await argon2.hash("TestPass#Strong1", { type: argon2.argon2id });
  const users: Array<{ id: number; username: string; roles: Role[] }> = [
    { id: 100, username: "member_user", roles: ["MEMBER"] },
    { id: 200, username: "leader_user", roles: ["GROUP_LEADER"] },
    { id: 300, username: "reviewer_user", roles: ["REVIEWER"] },
    { id: 400, username: "finance_user", roles: ["FINANCE_CLERK"] },
    { id: 500, username: "admin_user", roles: ["ADMINISTRATOR"] },
  ];
  for (const u of users) {
    sharedInMemoryStore.seedUser({
      id: u.id,
      username: u.username,
      passwordHash: hash,
      isActive: true,
      roles: u.roles,
    });
  }
};

const loginAs = async (
  app: ReturnType<typeof createApp>,
  username: string,
) => {
  const agent = request.agent(app);
  const response = await agent
    .post("/auth/login")
    .send({ username, password: "TestPass#Strong1" });
  expect(response.status).toBe(200);
  return agent;
};

describe("createApp() integration — route authorization matrix", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    sharedInMemoryStore.reset();
    await seedUsers();
    app = createApp();
  });

  describe("orders", () => {
    it("MEMBER can quote an order and receives pricing payload through the real middleware", async () => {
      orderMock.quoteOrder.mockResolvedValue({
        subtotal: 12,
        discountTotal: 0,
        subsidyTotal: 0,
        taxTotal: 0.96,
        grandTotal: 12.96,
        taxJurisdiction: { id: 1, code: "US-IL", taxRate: 0.08 },
        lineItems: [],
      } as any);

      const agent = await loginAs(app, "member_user");

      const response = await agent
        .post("/orders/quote")
        .send({
          cycleId: 1,
          pickupPointId: 1,
          pickupWindowId: 1,
          taxJurisdictionCode: "US-IL",
          items: [{ listingId: 1, quantity: 2 }],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.grandTotal).toBe(12.96);
      expect(orderMock.quoteOrder).toHaveBeenCalledTimes(1);
    });

    it("GROUP_LEADER is forbidden from /orders/quote (member-only)", async () => {
      const agent = await loginAs(app, "leader_user");
      const response = await agent.post("/orders/quote").send({
        cycleId: 1,
        pickupPointId: 1,
        pickupWindowId: 1,
        taxJurisdictionCode: "US-IL",
        items: [{ listingId: 1, quantity: 1 }],
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
      expect(orderMock.quoteOrder).not.toHaveBeenCalled();
    });

    it("returns 409 CAPACITY_EXCEEDED with conflict payload on checkout", async () => {
      orderMock.checkoutOrder.mockResolvedValue({
        ok: false,
        code: "CAPACITY_EXCEEDED",
        message: "Selected pickup window has reached full capacity.",
        conflict: {
          message: "Pick another window.",
          requestedWindowId: 1,
          alternatives: [],
        },
      } as any);

      const agent = await loginAs(app, "member_user");
      const response = await agent.post("/orders/checkout").send({
        cycleId: 1,
        pickupPointId: 1,
        pickupWindowId: 1,
        taxJurisdictionCode: "US-IL",
        items: [{ listingId: 1, quantity: 1 }],
      });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("CAPACITY_EXCEEDED");
    });

    it("GET /orders/:id returns 404 when service yields null (object-level access)", async () => {
      orderMock.getOrderById.mockResolvedValue(null);

      const agent = await loginAs(app, "member_user");
      const response = await agent.get("/orders/9999");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ORDER_NOT_FOUND");
      expect(orderMock.getOrderById).toHaveBeenCalledWith({
        orderId: 9999,
        userId: 100,
        roles: ["MEMBER"],
      });
    });

    it("/finance/ledger requires FINANCE_CLERK or ADMINISTRATOR", async () => {
      const memberAgent = await loginAs(app, "member_user");
      const forbidden = await memberAgent.get("/finance/ledger");
      expect(forbidden.status).toBe(403);
      expect(orderMock.getLedger).not.toHaveBeenCalled();

      orderMock.getLedger.mockResolvedValue([
        {
          orderId: 1,
          settledAmount: 12.0,
          postedAt: "2026-04-01T00:00:00Z",
        },
      ] as any);
      const financeAgent = await loginAs(app, "finance_user");
      const allowed = await financeAgent.get("/finance/ledger");
      expect(allowed.status).toBe(200);
      expect(allowed.body.data).toHaveLength(1);
    });
  });

  describe("appeals", () => {
    it("MEMBER can create an appeal and receive 201 with data envelope", async () => {
      appealMock.createAppealRecord.mockResolvedValue({
        id: 77,
        status: "INTAKE",
        submittedByUserId: 100,
      } as any);

      const agent = await loginAs(app, "member_user");
      const response = await agent.post("/appeals").send({
        sourceType: "HIDDEN_CONTENT_BANNER",
        sourceCommentId: 1,
        reasonCategory: "MODERATION",
        narrative:
          "This post was hidden due to a misunderstanding of our community rules.",
      });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe(77);
    });

    it("MEMBER cannot change appeal status (reviewer/admin only)", async () => {
      const agent = await loginAs(app, "member_user");
      const response = await agent
        .patch("/appeals/44/status")
        .send({ toStatus: "INVESTIGATION", note: "needs escalation" });

      expect(response.status).toBe(403);
      expect(appealMock.transitionAppealStatus).not.toHaveBeenCalled();
    });

    it("REVIEWER can transition appeal status INTAKE -> INVESTIGATION", async () => {
      appealMock.transitionAppealStatus.mockResolvedValue({
        appealId: 44,
        fromStatus: "INTAKE",
        toStatus: "INVESTIGATION",
      } as any);

      const agent = await loginAs(app, "reviewer_user");
      const response = await agent
        .patch("/appeals/44/status")
        .send({ toStatus: "INVESTIGATION", note: "accepted" });

      expect(response.status).toBe(200);
      expect(response.body.data.toStatus).toBe("INVESTIGATION");
      expect(appealMock.transitionAppealStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          appealId: 44,
          fromUserRoles: ["REVIEWER"],
          toStatus: "INVESTIGATION",
        }),
      );
    });

    it("returns 400 when appeal payload narrative is too short", async () => {
      const agent = await loginAs(app, "member_user");
      const response = await agent.post("/appeals").send({
        sourceType: "ORDER_DETAIL",
        sourceOrderId: 1,
        reasonCategory: "ORDER_ISSUE",
        narrative: "short",
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST_PAYLOAD");
    });
  });

  describe("finance", () => {
    it("GROUP_LEADER can read their own withdrawal eligibility", async () => {
      financeMock.getWithdrawalEligibility.mockResolvedValue({
        leaderUserId: 200,
        blacklisted: false,
        remainingDailyAmount: 500,
        remainingWeeklyCount: 2,
        eligible: true,
        reason: null,
      });

      const agent = await loginAs(app, "leader_user");
      const response = await agent.get("/finance/withdrawals/eligibility");

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        leaderUserId: 200,
        eligible: true,
        remainingWeeklyCount: 2,
      });
      expect(financeMock.getWithdrawalEligibility).toHaveBeenCalledWith(200);
    });

    it("ADMINISTRATOR can delete a blacklist entry and responds 204 on success", async () => {
      financeMock.removeBlacklistEntry.mockResolvedValue(true);

      const agent = await loginAs(app, "admin_user");
      const response = await agent.delete("/admin/withdrawal-blacklist/5");

      expect(response.status).toBe(204);
      expect(financeMock.removeBlacklistEntry).toHaveBeenCalledWith({
        id: 5,
        actorUserId: 500,
      });
    });

    it("FINANCE_CLERK can stream reconciliation CSV", async () => {
      financeMock.getReconciliationCsv.mockResolvedValue({
        fileName: "reconciliation-2026-03-01-to-2026-03-31.csv",
        csv: "order_id,pickup_point_id,member_user_id,settled_amount,status,posted_at\n1,2,3,10.00,POSTED,2026-03-15",
        rowCount: 1,
      });

      const agent = await loginAs(app, "finance_user");
      const response = await agent.get(
        "/finance/reconciliation/export?dateFrom=2026-03-01&dateTo=2026-03-31",
      );

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.text).toContain("order_id");
      expect(response.text).toContain("POSTED");
    });

    it("MEMBER is forbidden from the finance reconciliation export", async () => {
      const agent = await loginAs(app, "member_user");
      const response = await agent.get(
        "/finance/reconciliation/export?dateFrom=2026-03-01&dateTo=2026-03-31",
      );

      expect(response.status).toBe(403);
      expect(financeMock.getReconciliationCsv).not.toHaveBeenCalled();
    });
  });

  describe("discussions", () => {
    it("MEMBER can resolve a discussion thread for a listing they can view", async () => {
      discussionMock.resolveThreadByContext.mockResolvedValue({
        discussionId: 99,
        contextType: "LISTING",
        contextId: 44,
      } as any);

      const agent = await loginAs(app, "member_user");
      const response = await agent.get(
        "/threads/resolve?contextType=LISTING&contextId=44",
      );

      expect(response.status).toBe(200);
      expect(response.body.data.discussionId).toBe(99);
    });

    it("service-layer THREAD_FORBIDDEN becomes 403 with matching error code", async () => {
      discussionMock.getThreadComments.mockRejectedValue(
        new Error("THREAD_FORBIDDEN"),
      );

      const agent = await loginAs(app, "member_user");
      const response = await agent.get("/threads/7/comments");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("THREAD_FORBIDDEN");
    });

    it("FINANCE_CLERK cannot read discussion threads", async () => {
      const agent = await loginAs(app, "finance_user");
      const response = await agent.get("/threads/7/comments");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
    });
  });

  describe("audit", () => {
    it("ADMINISTRATOR can search audit logs and receive pagination envelope", async () => {
      auditMock.getAuditSearch.mockResolvedValue({
        total: 2,
        rows: [
          {
            id: 1,
            actorUserId: 9,
            action: "APPROVAL",
            resourceType: "LEADER_APPLICATION",
            resourceId: "77",
            metadata: null,
            hashBasis: "{}",
            previousHash: null,
            currentHash: "h1",
            createdAt: "2026-03-29T08:00:00.000Z",
          },
        ],
      } as any);

      const agent = await loginAs(app, "admin_user");
      const response = await agent.get("/audit/logs?page=1&pageSize=20");

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(2);
      // Route wraps the rows under `data` inside the success envelope.
      expect(response.body.data.data[0].action).toBe("APPROVAL");
    });

    it("REVIEWER is forbidden from audit search", async () => {
      const agent = await loginAs(app, "reviewer_user");
      const response = await agent.get("/audit/logs");

      expect(response.status).toBe(403);
    });
  });

  describe("behavior", () => {
    it("authenticated member can ingest behavior events", async () => {
      behaviorMock.ingestBehaviorEvents.mockResolvedValue({
        accepted: 2,
        duplicates: 0,
      });

      const agent = await loginAs(app, "member_user");
      const response = await agent.post("/behavior/events").send({
        events: [
          {
            idempotencyKey: "key-impression-001",
            eventType: "IMPRESSION",
            resourceType: "LISTING",
            resourceId: "1",
          },
          {
            idempotencyKey: "key-click-002",
            eventType: "CLICK",
            resourceType: "LISTING",
            resourceId: "1",
          },
        ],
      });

      expect(response.status).toBe(202);
      expect(response.body.data).toEqual({ accepted: 2, duplicates: 0 });
    });
  });

  describe("commerce", () => {
    it("MEMBER can list active buying cycles", async () => {
      commerceMock.listActiveBuyingCycles.mockResolvedValue({
        total: 1,
        rows: [
          {
            id: 1,
            name: "Spring cycle",
            startsAt: "2026-03-01T00:00:00.000Z",
            endsAt: "2026-03-15T00:00:00.000Z",
            status: "ACTIVE",
          },
        ],
      } as any);

      const agent = await loginAs(app, "member_user");
      const response = await agent.get("/buying-cycles/active");

      expect(response.status).toBe(200);
      expect(response.body.data.data[0].name).toBe("Spring cycle");
    });

    it("ADMINISTRATOR can create a pickup window and get 201 back", async () => {
      commerceMock.createPickupWindowService.mockResolvedValue({ id: 55 } as any);

      const agent = await loginAs(app, "admin_user");
      const response = await agent.post("/admin/pickup-windows").send({
        pickupPointId: 1,
        windowDate: "2026-05-01",
        startTime: "09:00:00",
        endTime: "10:00:00",
        capacityTotal: 50,
      });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe(55);
    });
  });

  describe("leaders", () => {
    it("MEMBER can submit a leader application", async () => {
      leaderMock.submitLeaderApplication.mockResolvedValue({
        id: 12,
        userId: 100,
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
      } as any);

      const agent = await loginAs(app, "member_user");
      const response = await agent.post("/leaders/applications").send({
        fullName: "Leader Candidate",
        phone: "555-0101",
        experienceSummary:
          "I have organized community pickup operations for over two years.",
        requestedCommissionEligible: true,
      });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe("PENDING");
    });

    it("FINANCE_CLERK cannot submit a leader application", async () => {
      const agent = await loginAs(app, "finance_user");
      const response = await agent.post("/leaders/applications").send({
        fullName: "Bob",
        phone: "555",
        experienceSummary:
          "Short but long enough to pass zod baseline checks maybe.",
        requestedCommissionEligible: false,
      });

      expect(response.status).toBe(403);
      expect(leaderMock.submitLeaderApplication).not.toHaveBeenCalled();
    });
  });
});
