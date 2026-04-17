import type { Express } from "express";
import request from "supertest";

/**
 * Real createApp() wired to a real MySQL pool. No vi.mock calls anywhere.
 * The DB connection is validated before the first test runs so suite
 * failures point at the infra, not at a mystery timeout inside a handler.
 */

let appInstance: Express | null = null;

export const getRealApp = async (): Promise<Express> => {
  if (appInstance) return appInstance;

  const poolModule = await import("../../src/db/pool");
  // Cheap connectivity ping; mysql2 lazily opens a connection on first
  // query so this forces the pool to materialize before we start exercising
  // routes under timeouts.
  await poolModule.dbPool.query("SELECT 1");

  const { createApp } = await import("../../src/app");
  appInstance = createApp();
  return appInstance;
};

export const closeRealPool = async (): Promise<void> => {
  const poolModule = await import("../../src/db/pool");
  try {
    await (poolModule.dbPool as unknown as { end: () => Promise<void> }).end();
  } catch {
    // pool may already be closed across workers; not fatal for test teardown.
  }
};

export type SeededUser = { username: string; password: string };

export const seededCreds: Record<string, SeededUser> = {
  member: { username: "member1", password: "Member#Pass123" },
  leader: { username: "leader1", password: "Leader#Pass123" },
  reviewer: { username: "reviewer1", password: "Reviewer#Pass123" },
  finance: { username: "finance1", password: "Finance#Pass123" },
  admin: { username: "admin1", password: "Admin#Pass12345" },
};

/**
 * Authenticates against the real /auth/login endpoint and returns a
 * supertest Agent that will carry the session cookie automatically on
 * subsequent requests (a production-accurate login flow).
 */
export const loginAgent = async (
  app: Express,
  user: SeededUser,
): Promise<ReturnType<typeof request.agent>> => {
  const agent = request.agent(app);
  const response = await agent
    .post("/auth/login")
    .send({ username: user.username, password: user.password });

  if (response.status !== 200) {
    throw new Error(
      `Real login failed for ${user.username}: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return agent;
};
