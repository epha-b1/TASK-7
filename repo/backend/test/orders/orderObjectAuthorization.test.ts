import * as repo from "../../src/features/orders/data/orderRepository";
import * as behaviorService from "../../src/features/behavior/services/behaviorService";
import { getOrderById } from "../../src/features/orders/services/orderService";

vi.mock("../../src/features/orders/data/orderRepository");
vi.mock("../../src/features/behavior/services/behaviorService", () => ({
  recordServerBehaviorEvent: vi.fn().mockResolvedValue(undefined),
}));

const mockedRepo = vi.mocked(repo);
const mockedBehavior = vi.mocked(behaviorService);

const makeOrderDetail = (userId: number) => ({
  id: 42,
  userId,
  cycleId: 3,
  pickupPointId: 7,
  status: "CONFIRMED",
  pickupWindow: {
    pickupWindowId: 9,
    date: "2026-04-01",
    startTime: "09:00:00",
    endTime: "11:00:00",
  },
  totals: { subtotal: 10, discount: 0, subsidy: 0, tax: 0.8, total: 10.8 },
  pricingTrace: {},
  items: [],
});

describe("orders object-level authorization (service)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when a MEMBER tries to read another member's order", async () => {
    // Repository query filters WHERE (privileged=1 OR user_id=?) so non-owners get null.
    mockedRepo.getOrderDetailById.mockResolvedValue(null);

    const result = await getOrderById({
      orderId: 42,
      userId: 99,
      roles: ["MEMBER"],
    });

    expect(result).toBeNull();
    expect(mockedRepo.getOrderDetailById).toHaveBeenCalledWith({
      orderId: 42,
      userId: 99,
      roles: ["MEMBER"],
    });
    // No behavior impression recorded for orders the user cannot see.
    expect(mockedBehavior.recordServerBehaviorEvent).not.toHaveBeenCalled();
  });

  it("returns the order when the MEMBER is the owner", async () => {
    mockedRepo.getOrderDetailById.mockResolvedValue(makeOrderDetail(15));

    const result = await getOrderById({
      orderId: 42,
      userId: 15,
      roles: ["MEMBER"],
    });

    expect(result).not.toBeNull();
    expect(result!.userId).toBe(15);
    expect(mockedBehavior.recordServerBehaviorEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 15,
        eventType: "IMPRESSION",
        resourceType: "ORDER_DETAIL",
        resourceId: "42",
      }),
    );
  });

  it("returns the order for privileged roles (FINANCE_CLERK) even when not the owner", async () => {
    mockedRepo.getOrderDetailById.mockResolvedValue(makeOrderDetail(15));

    const result = await getOrderById({
      orderId: 42,
      userId: 500,
      roles: ["FINANCE_CLERK"],
    });

    expect(result).not.toBeNull();
    expect(result!.userId).toBe(15);
    expect(mockedRepo.getOrderDetailById).toHaveBeenCalledWith({
      orderId: 42,
      userId: 500,
      roles: ["FINANCE_CLERK"],
    });
  });

  it("returns the order for ADMINISTRATOR role even when not the owner", async () => {
    mockedRepo.getOrderDetailById.mockResolvedValue(makeOrderDetail(15));

    const result = await getOrderById({
      orderId: 42,
      userId: 1,
      roles: ["ADMINISTRATOR"],
    });

    expect(result).not.toBeNull();
    expect(result!.userId).toBe(15);
  });

  it("returns the order for REVIEWER role even when not the owner", async () => {
    mockedRepo.getOrderDetailById.mockResolvedValue(makeOrderDetail(15));

    const result = await getOrderById({
      orderId: 42,
      userId: 3,
      roles: ["REVIEWER"],
    });

    expect(result).not.toBeNull();
    expect(result!.userId).toBe(15);
  });
});

describe("orders object-level authorization (repository SQL contract)", () => {
  // The repository is mocked, but we assert the service forwards the exact
  // auth context. This documents the contract that the SQL query enforces
  // the WHERE (privileged=1 OR o.user_id = ?) predicate.

  beforeEach(() => {
    vi.clearAllMocks();
    mockedRepo.getOrderDetailById.mockResolvedValue(null);
  });

  it.each([
    ["MEMBER", false],
    ["GROUP_LEADER", false],
    ["REVIEWER", true],
    ["FINANCE_CLERK", true],
    ["ADMINISTRATOR", true],
  ])("forwards %s role to repository (privileged=%s)", async (role) => {
    await getOrderById({
      orderId: 42,
      userId: 1,
      roles: [role],
    });

    expect(mockedRepo.getOrderDetailById).toHaveBeenCalledWith({
      orderId: 42,
      userId: 1,
      roles: [role],
    });
  });
});
