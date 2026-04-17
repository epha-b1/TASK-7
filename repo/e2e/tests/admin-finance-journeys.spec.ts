import { test, expect, request as playwrightRequest } from "@playwright/test";

const apiBase = process.env.E2E_API_URL ?? "http://backend:4000";

/**
 * Admin + finance privileged journeys: blacklist CRUD, reconciliation CSV
 * export, retention job trigger. All against the live Express + MySQL.
 */
test("admin can CRUD a withdrawal-blacklist entry end-to-end", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await api.post(`${apiBase}/auth/login`, {
    data: { username: "admin1", password: "Admin#Pass12345" },
  });

  const leaderApi = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await leaderApi.post(`${apiBase}/auth/login`, {
    data: { username: "leader1", password: "Leader#Pass123" },
  });
  const leaderMe = await (await leaderApi.get(`${apiBase}/auth/me`)).json();
  const leaderUserId = leaderMe.data.user.id;

  // CREATE
  const create = await api.post(`${apiBase}/admin/withdrawal-blacklist`, {
    data: {
      userId: leaderUserId,
      reason: "E2E: compliance hold",
      active: true,
    },
  });
  expect(create.status()).toBe(201);

  // READ
  let list = await (
    await api.get(`${apiBase}/admin/withdrawal-blacklist`)
  ).json();
  let entry = list.data.find(
    (row: { userId: number }) => row.userId === leaderUserId,
  );
  expect(entry).toBeDefined();
  expect(entry.reason).toMatch(/compliance hold/);

  // UPDATE
  const patch = await api.patch(
    `${apiBase}/admin/withdrawal-blacklist/${entry.id}`,
    {
      data: { active: false, reason: "E2E: cleared on review" },
    },
  );
  expect(patch.status()).toBe(200);

  list = await (await api.get(`${apiBase}/admin/withdrawal-blacklist`)).json();
  entry = list.data.find((row: { id: number }) => row.id === entry.id);
  expect(entry.active).toBe(false);
  expect(entry.reason).toMatch(/cleared on review/);

  // DELETE
  const remove = await api.delete(
    `${apiBase}/admin/withdrawal-blacklist/${entry.id}`,
  );
  expect(remove.status()).toBe(204);

  list = await (await api.get(`${apiBase}/admin/withdrawal-blacklist`)).json();
  expect(
    list.data.find((row: { id: number }) => row.id === entry.id),
  ).toBeUndefined();

  await api.dispose();
  await leaderApi.dispose();
});

test("finance clerk can export reconciliation CSV and rejects malformed dates", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await api.post(`${apiBase}/auth/login`, {
    data: { username: "finance1", password: "Finance#Pass123" },
  });

  const ok = await api.get(
    `${apiBase}/finance/reconciliation/export?dateFrom=2026-01-01&dateTo=2027-12-31`,
  );
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("text/csv");
  const text = await ok.text();
  expect(text.split("\n")[0]).toBe(
    "order_id,pickup_point_id,member_user_id,settled_amount,status,posted_at",
  );

  const bad = await api.get(
    `${apiBase}/finance/reconciliation/export?dateFrom=xyz&dateTo=abc`,
  );
  expect(bad.status()).toBe(400);

  await api.dispose();
});

test("admin can trigger the retention job and get a shape-correct response", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await api.post(`${apiBase}/auth/login`, {
    data: { username: "admin1", password: "Admin#Pass12345" },
  });

  const status = await api.get(`${apiBase}/admin/jobs/retention-status`);
  expect(status.status()).toBe(200);
  const statusBody = await status.json();
  expect(statusBody.data).toMatchObject({
    hotCount: expect.any(Number),
    archiveCount: expect.any(Number),
    queuePending: expect.any(Number),
  });

  const run = await api.post(`${apiBase}/admin/jobs/retention-run`);
  expect(run.status()).toBe(200);
  const runBody = await run.json();
  expect(runBody.data).toMatchObject({
    archivedCount: expect.any(Number),
    purgedCount: expect.any(Number),
  });

  await api.dispose();
});

test("member is denied by the admin retention endpoint (403)", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await api.post(`${apiBase}/auth/login`, {
    data: { username: "member1", password: "Member#Pass123" },
  });

  const run = await api.post(`${apiBase}/admin/jobs/retention-run`);
  expect(run.status()).toBe(403);

  await api.dispose();
});
