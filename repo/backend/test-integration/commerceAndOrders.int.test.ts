/**
 * NO-MOCK integration: commerce browsing + orders quote/checkout against
 * real MySQL using seeded data.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getRealApp,
  closeRealPool,
  loginAgent,
  seededCreds,
} from "./helpers/realApp";

describe("commerce + orders (no-mock, real MySQL)", () => {
  let app: Awaited<ReturnType<typeof getRealApp>>;
  let memberAgent: Awaited<ReturnType<typeof loginAgent>>;
  let activeCycleId: number;
  let pickupPointId: number;
  let listingId: number;
  let pickupWindowId: number;

  beforeAll(async () => {
    app = await getRealApp();
    memberAgent = await loginAgent(app, seededCreds.member);

    const cyclesResponse = await memberAgent.get(
      "/buying-cycles/active?page=1&pageSize=10",
    );
    expect(cyclesResponse.status).toBe(200);
    expect(cyclesResponse.body.data.total).toBeGreaterThan(0);
    const activeCycle = cyclesResponse.body.data.data.find(
      (row: { name: string; id: number }) =>
        row.name === "March Fresh Produce Wave",
    );
    expect(activeCycle).toBeDefined();
    activeCycleId = activeCycle.id;

    const listingsResponse = await memberAgent.get(
      `/listings?cycleId=${activeCycleId}&page=1&pageSize=10`,
    );
    expect(listingsResponse.status).toBe(200);
    expect(listingsResponse.body.data.data.length).toBeGreaterThan(0);
    const kaleListing = listingsResponse.body.data.data.find(
      (row: { title: string }) => row.title === "Organic Kale Bundle",
    );
    expect(kaleListing).toBeDefined();
    listingId = kaleListing.id;
    pickupPointId = kaleListing.pickupPointId;

    const pickupDetail = await memberAgent.get(
      `/pickup-points/${pickupPointId}`,
    );
    expect(pickupDetail.status).toBe(200);
    // Pick the first window that still has remaining capacity > 0.
    // PickupWindowCapacity uses `windowId`, not `id`.
    const windowWithSpace = (
      pickupDetail.body.data.windows as Array<{
        windowId: number;
        remainingCapacity: number;
      }>
    ).find((w) => w.remainingCapacity > 0);
    expect(windowWithSpace).toBeDefined();
    pickupWindowId = windowWithSpace!.windowId;
  });

  afterAll(async () => {
    await closeRealPool();
  });

  it("active buying cycles listing excludes CLOSED cycles", async () => {
    const response = await memberAgent.get(
      "/buying-cycles/active?page=1&pageSize=50",
    );
    expect(response.status).toBe(200);
    const names: string[] = response.body.data.data.map(
      (row: { name: string }) => row.name,
    );
    expect(names).toContain("March Fresh Produce Wave");
    expect(names).not.toContain("Expired Winter Essentials");
  });

  it("pickup point detail includes daily capacity and per-window remaining slots", async () => {
    const response = await memberAgent.get(`/pickup-points/${pickupPointId}`);
    expect(response.status).toBe(200);
    expect(response.body.data.dailyCapacity).toBe(120);
    expect(Array.isArray(response.body.data.windows)).toBe(true);
    expect(response.body.data.windows.length).toBeGreaterThan(0);
    for (const window of response.body.data.windows) {
      expect(typeof window.windowId).toBe("number");
      expect(typeof window.remainingCapacity).toBe("number");
    }
  });

  it("favorite toggle flips the member's favorite flag on the pickup point", async () => {
    const firstToggle = await memberAgent
      .post("/favorites/toggle")
      .send({ type: "PICKUP_POINT", targetId: pickupPointId });
    expect(firstToggle.status).toBe(200);
    const stateA = firstToggle.body.data.isFavorite;

    const secondToggle = await memberAgent
      .post("/favorites/toggle")
      .send({ type: "PICKUP_POINT", targetId: pickupPointId });
    expect(secondToggle.status).toBe(200);
    expect(secondToggle.body.data.isFavorite).toBe(!stateA);

    // Restore the seeded favorite state so downstream tests see the same world.
    if (secondToggle.body.data.isFavorite !== true) {
      await memberAgent
        .post("/favorites/toggle")
        .send({ type: "PICKUP_POINT", targetId: pickupPointId });
    }
  });

  it("orders/quote returns a traced pricing envelope for a valid selection", async () => {
    const response = await memberAgent.post("/orders/quote").send({
      cycleId: activeCycleId,
      pickupPointId,
      pickupWindowId,
      taxJurisdictionCode: "US-IL-SPRINGFIELD",
      items: [{ listingId, quantity: 2 }],
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.grandTotal).toBeGreaterThan(0);
    expect(response.body.data.taxTotal).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(response.body.data.lineItems)).toBe(true);
    expect(response.body.data.lineItems[0].listingId).toBe(listingId);
  });

  it("orders/quote with bad tax jurisdiction returns 400 INVALID_TAX_JURISDICTION", async () => {
    const response = await memberAgent.post("/orders/quote").send({
      cycleId: activeCycleId,
      pickupPointId,
      pickupWindowId,
      taxJurisdictionCode: "NOT-A-REAL-CODE",
      items: [{ listingId, quantity: 1 }],
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_TAX_JURISDICTION");
  });

  it("orders/checkout succeeds end-to-end and stores an order visible via /orders/:id", async () => {
    const response = await memberAgent.post("/orders/checkout").send({
      cycleId: activeCycleId,
      pickupPointId,
      pickupWindowId,
      taxJurisdictionCode: "US-IL-SPRINGFIELD",
      items: [{ listingId, quantity: 1 }],
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("CONFIRMED");
    const orderId = response.body.data.orderId;
    expect(typeof orderId).toBe("number");

    const detail = await memberAgent.get(`/orders/${orderId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.id).toBe(orderId);
    expect(detail.body.data.status).toBe("CONFIRMED");
    expect(Array.isArray(detail.body.data.items)).toBe(true);

    // Another member would not exist in seed data as a distinct user owning
    // this order, but privileged roles must also see it.
    const financeAgent = await loginAgent(app, seededCreds.finance);
    const financeDetail = await financeAgent.get(`/orders/${orderId}`);
    expect(financeDetail.status).toBe(200);
    expect(financeDetail.body.data.id).toBe(orderId);
  });

  it("orders/checkout rejects a full pickup window with CAPACITY_EXCEEDED + alternatives", async () => {
    // Find a pickup window with no remaining capacity. The seed has one at
    // capacity_total==reserved_slots==50.
    const pickupDetail = await memberAgent.get(
      `/pickup-points/${pickupPointId}`,
    );
    const fullWindow = (
      pickupDetail.body.data.windows as Array<{
        windowId: number;
        remainingCapacity: number;
      }>
    ).find((w) => w.remainingCapacity === 0);
    expect(fullWindow).toBeDefined();

    const response = await memberAgent.post("/orders/checkout").send({
      cycleId: activeCycleId,
      pickupPointId,
      pickupWindowId: fullWindow!.windowId,
      taxJurisdictionCode: "US-IL-SPRINGFIELD",
      items: [{ listingId, quantity: 1 }],
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CAPACITY_EXCEEDED");
  });

  it("GET /orders/:id returns 404 for a non-existent order id (no info leak)", async () => {
    const response = await memberAgent.get("/orders/9999999");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ORDER_NOT_FOUND");
  });

  describe("POST /admin/pickup-windows (ADMINISTRATOR only)", () => {
    it("ADMINISTRATOR can create a valid 1-hour pickup window and it persists", async () => {
      const adminAgent = await loginAgent(app, seededCreds.admin);

      // Use a future date so the validator cannot reject on "in the past".
      const futureDate = new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);

      const response = await adminAgent.post("/admin/pickup-windows").send({
        pickupPointId,
        windowDate: futureDate,
        startTime: "15:00:00",
        endTime: "16:00:00",
        capacityTotal: 40,
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.id).toBe("number");

      // The created window is now visible on the pickup point detail.
      const detail = await memberAgent.get(`/pickup-points/${pickupPointId}`);
      const newWindow = (
        detail.body.data.windows as Array<{
          windowId: number;
          remainingCapacity: number;
        }>
      ).find((w) => w.windowId === response.body.data.id);
      expect(newWindow).toBeDefined();
      expect(newWindow!.remainingCapacity).toBe(40);
    });

    it("rejects a non-1-hour window (400 INVALID_PICKUP_WINDOW_DURATION)", async () => {
      const adminAgent = await loginAgent(app, seededCreds.admin);
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const response = await adminAgent.post("/admin/pickup-windows").send({
        pickupPointId,
        windowDate: futureDate,
        startTime: "09:00:00",
        endTime: "11:00:00",
        capacityTotal: 40,
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_PICKUP_WINDOW_DURATION");
    });

    it("MEMBER is forbidden from creating a pickup window (ROLE_FORBIDDEN)", async () => {
      const response = await memberAgent.post("/admin/pickup-windows").send({
        pickupPointId,
        windowDate: "2099-05-01",
        startTime: "09:00:00",
        endTime: "10:00:00",
        capacityTotal: 10,
      });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
    });

    it("rejects malformed payload at the zod boundary (400 INVALID_REQUEST_PAYLOAD)", async () => {
      const adminAgent = await loginAgent(app, seededCreds.admin);

      const response = await adminAgent.post("/admin/pickup-windows").send({
        pickupPointId,
        windowDate: "not-a-date",
        startTime: "abc",
        endTime: "xyz",
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST_PAYLOAD");
    });
  });
});
