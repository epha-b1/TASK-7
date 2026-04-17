import * as listingRepo from "../../src/features/commerce/repositories/listingRepository";
import * as pickupPointRepo from "../../src/features/commerce/repositories/pickupPointRepository";
import * as capacityService from "../../src/features/commerce/services/capacityService";
import {
  getPickupPointDetail,
  listListings,
} from "../../src/features/commerce/services/commerceService";

vi.mock("../../src/features/commerce/repositories/listingRepository");
vi.mock("../../src/features/commerce/repositories/pickupPointRepository");
vi.mock("../../src/features/commerce/services/capacityService");

const mockedListingRepo = vi.mocked(listingRepo);
const mockedPickupPointRepo = vi.mocked(pickupPointRepo);
const mockedCapacity = vi.mocked(capacityService);

describe("commerce listings object-level authorization (service)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes listing favorite flags per user (user A sees their favorites)", async () => {
    mockedListingRepo.getListingsByCycle.mockResolvedValue({
      total: 1,
      rows: [
        {
          id: 1,
          cycleId: 10,
          pickupPointId: 3,
          pickupPointName: "Point A",
          leaderUserId: 7,
          leaderUsername: "leader1",
          title: "Kale",
          description: "Fresh",
          basePrice: 5,
          unitLabel: "bundle",
          availableQuantity: 20,
          reservedQuantity: 0,
          isFavoritePickupPoint: true,
          isFavoriteLeader: false,
        },
      ],
    });

    const result = await listListings({
      userId: 42,
      query: {
        cycleId: 10,
        page: 1,
        pageSize: 10,
        sortBy: "recent",
        sortDir: "desc",
      },
    });

    expect(result.rows[0].isFavoritePickupPoint).toBe(true);
    expect(mockedListingRepo.getListingsByCycle).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42 }),
    );
  });

  it("forwards a different user id and returns their personalized favorites", async () => {
    mockedListingRepo.getListingsByCycle.mockResolvedValue({
      total: 1,
      rows: [
        {
          id: 1,
          cycleId: 10,
          pickupPointId: 3,
          pickupPointName: "Point A",
          leaderUserId: 7,
          leaderUsername: "leader1",
          title: "Kale",
          description: "Fresh",
          basePrice: 5,
          unitLabel: "bundle",
          availableQuantity: 20,
          reservedQuantity: 0,
          isFavoritePickupPoint: false,
          isFavoriteLeader: false,
        },
      ],
    });

    const result = await listListings({
      userId: 99,
      query: {
        cycleId: 10,
        page: 1,
        pageSize: 10,
        sortBy: "recent",
        sortDir: "desc",
      },
    });

    expect(result.rows[0].isFavoritePickupPoint).toBe(false);
    expect(mockedListingRepo.getListingsByCycle).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 99 }),
    );
  });
});

describe("pickup point detail object-level authorization (service)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCapacity.computeWindowRemaining.mockResolvedValue([]);
    mockedCapacity.computeRemainingCapacityToday.mockResolvedValue(30);
  });

  it("returns null (404) when pickup point does not exist", async () => {
    mockedPickupPointRepo.findPickupPointById.mockResolvedValue(null);

    const result = await getPickupPointDetail({ userId: 15, pickupPointId: 999 });

    expect(result).toBeNull();
    expect(mockedPickupPointRepo.isFavorite).not.toHaveBeenCalled();
  });

  it("scopes favorite flag per user (user A's favorite is not leaked to user B)", async () => {
    mockedPickupPointRepo.findPickupPointById.mockResolvedValue({
      id: 5,
      name: "Central Pickup",
      address_line1: "123 Main",
      address_line2: null,
      city: "Springfield",
      state_region: "IL",
      postal_code: "62701",
      business_hours_json: '{"mon":"9-5"}',
      daily_capacity: 50,
    });
    mockedPickupPointRepo.isFavorite.mockImplementation(async (params) => {
      return params.userId === 15;
    });

    const viewA = await getPickupPointDetail({ userId: 15, pickupPointId: 5 });
    const viewB = await getPickupPointDetail({ userId: 99, pickupPointId: 5 });

    expect(viewA!.isFavorite).toBe(true);
    expect(viewB!.isFavorite).toBe(false);

    expect(mockedPickupPointRepo.isFavorite).toHaveBeenNthCalledWith(1, {
      userId: 15,
      type: "PICKUP_POINT",
      targetId: 5,
    });
    expect(mockedPickupPointRepo.isFavorite).toHaveBeenNthCalledWith(2, {
      userId: 99,
      type: "PICKUP_POINT",
      targetId: 5,
    });
  });

  it("includes computed remaining capacity today in detail response", async () => {
    mockedPickupPointRepo.findPickupPointById.mockResolvedValue({
      id: 5,
      name: "Central Pickup",
      address_line1: "123 Main",
      address_line2: null,
      city: "Springfield",
      state_region: "IL",
      postal_code: "62701",
      business_hours_json: "{}",
      daily_capacity: 50,
    });
    mockedPickupPointRepo.isFavorite.mockResolvedValue(false);
    mockedCapacity.computeRemainingCapacityToday.mockResolvedValue(12);

    const result = await getPickupPointDetail({ userId: 15, pickupPointId: 5 });

    expect(result!.remainingCapacityToday).toBe(12);
    expect(result!.dailyCapacity).toBe(50);
  });
});
