import { test, expect, request as playwrightRequest } from "@playwright/test";

const apiBase = process.env.E2E_API_URL ?? "http://backend:4000";

/**
 * Deep member journey: drive the full pricing + checkout pipeline via the
 * public HTTP API. This hits the real Express app on TCP, which in turn
 * hits MySQL. No mocks anywhere.
 */
test("member can quote and checkout an order against the real backend", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });

  // 1. Log in with the seeded member.
  const login = await api.post(`${apiBase}/auth/login`, {
    data: { username: "member1", password: "Member#Pass123" },
  });
  expect(login.status()).toBe(200);

  // 2. Resolve the active cycle + a listing + a pickup window with capacity.
  const cyclesResponse = await api.get(
    `${apiBase}/buying-cycles/active?page=1&pageSize=5`,
  );
  expect(cyclesResponse.status()).toBe(200);
  const cycles = await cyclesResponse.json();
  const activeCycle = cycles.data.data.find(
    (c: { name: string }) => c.name === "March Fresh Produce Wave",
  );
  expect(activeCycle).toBeDefined();

  const listingsResponse = await api.get(
    `${apiBase}/listings?cycleId=${activeCycle.id}&page=1&pageSize=5`,
  );
  expect(listingsResponse.status()).toBe(200);
  const listings = await listingsResponse.json();
  const listing = listings.data.data.find(
    (l: { title: string }) => l.title === "Organic Kale Bundle",
  );
  expect(listing).toBeDefined();

  const pickupResponse = await api.get(
    `${apiBase}/pickup-points/${listing.pickupPointId}`,
  );
  expect(pickupResponse.status()).toBe(200);
  const pickup = await pickupResponse.json();
  const windowWithSpace = (
    pickup.data.windows as Array<{ id: number; remainingCapacity: number }>
  ).find((w) => w.remainingCapacity > 0);
  expect(windowWithSpace).toBeDefined();

  // 3. Quote returns a traced pricing envelope.
  const quoteResponse = await api.post(`${apiBase}/orders/quote`, {
    data: {
      cycleId: activeCycle.id,
      pickupPointId: listing.pickupPointId,
      pickupWindowId: windowWithSpace!.id,
      taxJurisdictionCode: "US-IL-SPRINGFIELD",
      items: [{ listingId: listing.id, quantity: 2 }],
    },
  });
  expect(quoteResponse.status()).toBe(200);
  const quote = await quoteResponse.json();
  expect(quote.data.grandTotal).toBeGreaterThan(0);
  expect(Array.isArray(quote.data.lineItems)).toBe(true);

  // 4. Real checkout -> confirmed order -> retrievable via GET /orders/:id.
  const checkout = await api.post(`${apiBase}/orders/checkout`, {
    data: {
      cycleId: activeCycle.id,
      pickupPointId: listing.pickupPointId,
      pickupWindowId: windowWithSpace!.id,
      taxJurisdictionCode: "US-IL-SPRINGFIELD",
      items: [{ listingId: listing.id, quantity: 1 }],
    },
  });
  expect(checkout.status()).toBe(201);
  const confirmed = await checkout.json();
  expect(confirmed.data.status).toBe("CONFIRMED");

  const detail = await api.get(`${apiBase}/orders/${confirmed.data.orderId}`);
  expect(detail.status()).toBe(200);
  const detailBody = await detail.json();
  expect(detailBody.data.id).toBe(confirmed.data.orderId);

  await api.dispose();
});

test("full pickup window returns CAPACITY_EXCEEDED with alternatives", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await api.post(`${apiBase}/auth/login`, {
    data: { username: "member1", password: "Member#Pass123" },
  });

  const cycles = await (
    await api.get(`${apiBase}/buying-cycles/active?page=1&pageSize=5`)
  ).json();
  const activeCycle = cycles.data.data.find(
    (c: { name: string }) => c.name === "March Fresh Produce Wave",
  );
  const listings = await (
    await api.get(
      `${apiBase}/listings?cycleId=${activeCycle.id}&page=1&pageSize=5`,
    )
  ).json();
  const listing = listings.data.data[0];
  const pickup = await (
    await api.get(`${apiBase}/pickup-points/${listing.pickupPointId}`)
  ).json();
  const fullWindow = (
    pickup.data.windows as Array<{ id: number; remainingCapacity: number }>
  ).find((w) => w.remainingCapacity === 0);
  expect(fullWindow).toBeDefined();

  const response = await api.post(`${apiBase}/orders/checkout`, {
    data: {
      cycleId: activeCycle.id,
      pickupPointId: listing.pickupPointId,
      pickupWindowId: fullWindow!.id,
      taxJurisdictionCode: "US-IL-SPRINGFIELD",
      items: [{ listingId: listing.id, quantity: 1 }],
    },
  });

  expect(response.status()).toBe(409);
  const body = await response.json();
  expect(body.error.code).toBe("CAPACITY_EXCEEDED");

  await api.dispose();
});
