/**
 * NO-MOCK integration: auth login/me/logout against real MySQL.
 * Exercises the real AuthService + MySqlAuthStore + session cookie flow.
 */

import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getRealApp, closeRealPool, seededCreds } from "./helpers/realApp";

describe("auth (no-mock, real MySQL)", () => {
  let app: Awaited<ReturnType<typeof getRealApp>>;

  beforeAll(async () => {
    app = await getRealApp();
  });

  afterAll(async () => {
    await closeRealPool();
  });

  it("GET /health is reachable and returns the canonical envelope", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { ok: true } });
  });

  it("valid seeded credentials mint a session cookie and /auth/me returns real roles", async () => {
    const agent = request.agent(app);

    const login = await agent
      .post("/auth/login")
      .send(seededCreds.member);

    expect(login.status).toBe(200);
    expect(login.body.data.user.username).toBe("member1");
    // Earlier test runs in this same DB may have granted member1 extra
    // roles (e.g. GROUP_LEADER via the leader-approval test). Only assert
    // the baseline role is present, not the exact set.
    expect(login.body.data.user.roles).toContain("MEMBER");

    // HttpOnly cookie was actually set by the real middleware chain.
    const cookies = login.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => /HttpOnly/i.test(c))).toBe(true);

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.user.username).toBe("member1");

    const logout = await agent.post("/auth/logout");
    expect(logout.status).toBe(204);

    const after = await agent.get("/auth/me");
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe("NOT_AUTHENTICATED");
  });

  it("wrong password returns 401 INVALID_CREDENTIALS without minting a cookie", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ username: "member1", password: "Definitely#Wrong1234" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("each seeded role can log in and /auth/me reports the expected role", async () => {
    for (const [key, expectedRole] of Object.entries({
      leader: "GROUP_LEADER",
      reviewer: "REVIEWER",
      finance: "FINANCE_CLERK",
      admin: "ADMINISTRATOR",
    } as const)) {
      const agent = request.agent(app);
      const login = await agent.post("/auth/login").send(seededCreds[key]);
      expect(login.status).toBe(200);

      const me = await agent.get("/auth/me");
      expect(me.status).toBe(200);
      expect(me.body.data.user.roles).toContain(expectedRole);

      await agent.post("/auth/logout").expect(204);
    }
  });
});
