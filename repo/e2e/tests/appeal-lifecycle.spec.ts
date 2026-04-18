import { test, expect, request as playwrightRequest } from "@playwright/test";

const apiBase = process.env.E2E_API_URL ?? "http://backend:4000";

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8",
).toString("base64");

test("appeal lifecycle: member creates + uploads, reviewer advances to RULING", async () => {
  const memberApi = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  const reviewerApi = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });

  await memberApi.post(`${apiBase}/auth/login`, {
    data: { username: "member1", password: "Member#Pass123" },
  });
  await reviewerApi.post(`${apiBase}/auth/login`, {
    data: { username: "reviewer1", password: "Reviewer#Pass123" },
  });

  // Bootstrap: member needs an owned order for sourceType=ORDER_DETAIL.
  const cycles = await (
    await memberApi.get(`${apiBase}/buying-cycles/active?page=1&pageSize=5`)
  ).json();
  const cycle = cycles.data.data.find(
    (c: { name: string }) => c.name === "March Fresh Produce Wave",
  );
  const listings = await (
    await memberApi.get(
      `${apiBase}/listings?cycleId=${cycle.id}&page=1&pageSize=5`,
    )
  ).json();
  const listing = listings.data.data.find(
    (l: { title: string }) => l.title === "Sweet Potato 2kg Pack",
  );
  const pickup = await (
    await memberApi.get(`${apiBase}/pickup-points/${listing.pickupPointId}`)
  ).json();
  const spaceful = pickup.data.windows.find(
    (w: { remainingCapacity: number }) => w.remainingCapacity > 0,
  );

  const checkout = await (
    await memberApi.post(`${apiBase}/orders/checkout`, {
      data: {
        cycleId: cycle.id,
        pickupPointId: listing.pickupPointId,
        pickupWindowId: spaceful.windowId,
        taxJurisdictionCode: "US-IL-SPRINGFIELD",
        items: [{ listingId: listing.id, quantity: 1 }],
      },
    })
  ).json();

  // 1. Member creates an appeal against their own order.
  const createResponse = await memberApi.post(`${apiBase}/appeals`, {
    data: {
      sourceType: "ORDER_DETAIL",
      sourceOrderId: checkout.data.orderId,
      reasonCategory: "FULFILLMENT",
      narrative:
        "Fulfillment window closed before I could retrieve the order. Requesting investigation and resolution.",
    },
  });
  expect(createResponse.status()).toBe(201);
  const appeal = await createResponse.json();
  expect(appeal.data.status).toBe("INTAKE");

  // 2. Member uploads a real PDF. The backend verifies signature + checksum.
  const uploadResponse = await memberApi.post(
    `${apiBase}/appeals/${appeal.data.id}/files`,
    {
      data: {
        files: [
          {
            fileName: "incident-report.pdf",
            mimeType: "application/pdf",
            base64Content: MINIMAL_PDF,
          },
        ],
      },
    },
  );
  expect(uploadResponse.status()).toBe(201);
  const uploaded = await uploadResponse.json();
  expect(uploaded.data.files.length).toBe(1);

  // 3. Reviewer advances INTAKE -> INVESTIGATION -> RULING.
  const toInvestigation = await reviewerApi.patch(
    `${apiBase}/appeals/${appeal.data.id}/status`,
    {
      data: {
        toStatus: "INVESTIGATION",
        note: "Accepted for investigation per review.",
      },
    },
  );
  expect(toInvestigation.status()).toBe(200);

  const toRuling = await reviewerApi.patch(
    `${apiBase}/appeals/${appeal.data.id}/status`,
    {
      data: {
        toStatus: "RULING",
        note: "Closed with ruling: partial refund issued.",
      },
    },
  );
  expect(toRuling.status()).toBe(200);

  // 4. Timeline reflects the chain.
  const timeline = await reviewerApi.get(
    `${apiBase}/appeals/${appeal.data.id}/timeline`,
  );
  expect(timeline.status()).toBe(200);
  const events = (await timeline.json()).data.events as Array<{
    toStatus: string;
  }>;
  const statuses = events.map((e) => e.toStatus);
  expect(statuses).toContain("INVESTIGATION");
  expect(statuses).toContain("RULING");

  await memberApi.dispose();
  await reviewerApi.dispose();
});

test("member cannot bypass reviewer — status PATCH returns 403", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await api.post(`${apiBase}/auth/login`, {
    data: { username: "member1", password: "Member#Pass123" },
  });

  const response = await api.patch(`${apiBase}/appeals/1/status`, {
    data: { toStatus: "INVESTIGATION", note: "trying" },
  });

  expect(response.status()).toBe(403);
  await api.dispose();
});
