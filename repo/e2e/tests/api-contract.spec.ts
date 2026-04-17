import { test, expect, request as playwrightRequest } from "@playwright/test";

/**
 * Real HTTP contract tests against the deployed backend — no process mocks,
 * no in-process supertest. These prove the Express server is actually
 * listening, the cookie session flow works end-to-end, and role-gated
 * endpoints respond with the envelope the frontend expects.
 */

const apiBase = process.env.E2E_API_URL ?? "http://backend:4000";

test("health endpoint is reachable on the deployed backend", async () => {
  const api = await playwrightRequest.newContext();
  const response = await api.get(`${apiBase}/health`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toEqual({ success: true, data: { ok: true } });
  await api.dispose();
});

test("login sets a session cookie and /auth/me returns the session", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });

  const loginResponse = await api.post(`${apiBase}/auth/login`, {
    data: { username: "member1", password: "Member#Pass123" },
  });
  expect(loginResponse.status()).toBe(200);

  const loginBody = await loginResponse.json();
  expect(loginBody.success).toBe(true);
  expect(loginBody.data.user.username).toBe("member1");

  const meResponse = await api.get(`${apiBase}/auth/me`);
  expect(meResponse.status()).toBe(200);
  const meBody = await meResponse.json();
  expect(meBody.data.user.roles).toContain("MEMBER");

  await api.dispose();
});

test("member cannot reach audit logs endpoint (403)", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await api.post(`${apiBase}/auth/login`, {
    data: { username: "member1", password: "Member#Pass123" },
  });

  const response = await api.get(`${apiBase}/audit/logs`);
  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body.success).toBe(false);

  await api.dispose();
});
