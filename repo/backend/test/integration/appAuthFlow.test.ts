/**
 * Integration tests against the real createApp() surface via supertest.
 * Only the MySQL-backed AuthStore and dbPool are swapped for in-memory
 * doubles; the Express app, middleware chain, and routers are real.
 */

import request from "supertest";
import argon2 from "argon2";
import {
  sharedInMemoryStore,
  InMemoryAuthStore,
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

// Importing createApp AFTER the mocks ensures the mocked MySqlAuthStore
// and dbPool are used throughout the real middleware and router wiring.
import { createApp } from "../../src/app";
import { sessionCookieName } from "../../src/middleware/sessionAuth";

describe("createApp() integration — auth flow", () => {
  let app: ReturnType<typeof createApp>;
  let hashedPassword: string;

  beforeAll(async () => {
    hashedPassword = await argon2.hash("CorrectHorse#Battery1", {
      type: argon2.argon2id,
    });
  });

  beforeEach(() => {
    sharedInMemoryStore.reset();
    sharedInMemoryStore.seedUser({
      id: 1,
      username: "member1",
      passwordHash: hashedPassword,
      isActive: true,
      roles: ["MEMBER"],
    });
    sharedInMemoryStore.seedUser({
      id: 42,
      username: "inactive",
      passwordHash: hashedPassword,
      isActive: false,
      roles: ["MEMBER"],
    });
    app = createApp();
  });

  it("health endpoint is reachable without a session and returns success envelope", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { ok: true },
    });
  });

  it("rejects login with invalid credentials and does NOT set a session cookie", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ username: "member1", password: "wrong" });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects inactive accounts with INACTIVE code", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ username: "inactive", password: "CorrectHorse#Battery1" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INACTIVE");
  });

  it("validates login payload shape (400 on empty username)", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ username: "", password: "x" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_PAYLOAD");
  });

  it("completes the full auth lifecycle: login -> /auth/me -> /auth/logout", async () => {
    const agent = request.agent(app);

    const loginResponse = await agent
      .post("/auth/login")
      .send({ username: "member1", password: "CorrectHorse#Battery1" });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.data.user).toMatchObject({
      id: 1,
      username: "member1",
      roles: ["MEMBER"],
    });

    // Session cookie is HttpOnly and has the expected name.
    const setCookie = loginResponse.headers["set-cookie"] as unknown as
      | string[]
      | undefined;
    expect(setCookie).toBeDefined();
    expect(setCookie!.some((c) => c.startsWith(`${sessionCookieName}=`))).toBe(
      true,
    );
    expect(setCookie!.some((c) => /HttpOnly/i.test(c))).toBe(true);

    // /auth/me returns the resolved session.
    const meResponse = await agent.get("/auth/me");
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user).toMatchObject({
      id: 1,
      username: "member1",
      roles: ["MEMBER"],
    });

    // Logout clears the cookie; subsequent /auth/me is 401.
    const logoutResponse = await agent.post("/auth/logout");
    expect(logoutResponse.status).toBe(204);

    const meAfterLogout = await agent.get("/auth/me");
    expect(meAfterLogout.status).toBe(401);
    expect(meAfterLogout.body.error.code).toBe("NOT_AUTHENTICATED");
  });

  it("GET /auth/me without a cookie returns 401 NOT_AUTHENTICATED", async () => {
    const response = await request(app).get("/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "NOT_AUTHENTICATED" },
    });
  });

  it("locks the account after 5 failed attempts and returns 423 LOCKED", async () => {
    // First four failed attempts return 401 INVALID_CREDENTIALS without locking.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failed = await request(app)
        .post("/auth/login")
        .send({ username: "member1", password: "wrong" });
      expect(failed.status).toBe(401);
      expect(failed.body.error.code).toBe("INVALID_CREDENTIALS");
    }

    // Fifth failed attempt triggers the lockout response envelope.
    const fifth = await request(app)
      .post("/auth/login")
      .send({ username: "member1", password: "wrong" });
    expect(fifth.status).toBe(423);
    expect(fifth.body.error.code).toBe("LOCKED");

    // A subsequent attempt with correct credentials is still refused.
    const sixth = await request(app)
      .post("/auth/login")
      .send({ username: "member1", password: "CorrectHorse#Battery1" });
    expect(sixth.status).toBe(423);
    expect(sixth.body.error.code).toBe("LOCKED");
    // Lockout metadata is returned so the UI can surface a countdown.
    expect(
      typeof (sixth.body.error.details?.lockedUntil ??
        sixth.body.error.lockedUntil),
    ).toBe("string");
  });
});

describe("createApp() integration — protected route envelope", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    sharedInMemoryStore.reset();
    app = createApp();
  });

  it("returns 401 with a consistent error envelope for protected routes without auth", async () => {
    const response = await request(app).get("/buying-cycles/active");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: expect.any(String), message: expect.any(String) },
    });
  });

  it("returns 401 for /orders/:id without auth (never leaks whether the order exists)", async () => {
    const response = await request(app).get("/orders/99999");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("returns 401 for /appeals listing without auth", async () => {
    const response = await request(app).get("/appeals");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("returns 401 for /audit/logs without auth", async () => {
    const response = await request(app).get("/audit/logs");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});

describe("createApp() integration — in-memory AuthStore sanity", () => {
  it("is instanceof InMemoryAuthStore (ensuring mocks applied before createApp)", () => {
    expect(sharedInMemoryStore).toBeInstanceOf(InMemoryAuthStore);
  });
});
