/**
 * NO-MOCK integration: /rbac/* role-home endpoints through real createApp()
 * + real MySqlAuthStore session cookies. Each endpoint proves the real
 * requireAuth + requireRoles chain matches the real role set stored in
 * user_roles, not a test header.
 */

import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getRealApp,
  closeRealPool,
  loginAgent,
  seededCreds,
} from "./helpers/realApp";

describe("rbac role-home endpoints (no-mock, real MySQL session cookies)", () => {
  let app: Awaited<ReturnType<typeof getRealApp>>;

  beforeAll(async () => {
    app = await getRealApp();
  });

  afterAll(async () => {
    await closeRealPool();
  });

  const matrix = [
    {
      path: "/rbac/member",
      credsKey: "member" as const,
      message: "Member area",
      otherKey: "admin" as const,
    },
    {
      path: "/rbac/group-leader",
      credsKey: "leader" as const,
      message: "Group leader area",
      otherKey: "member" as const,
    },
    {
      path: "/rbac/reviewer",
      credsKey: "reviewer" as const,
      message: "Reviewer area",
      otherKey: "member" as const,
    },
    {
      path: "/rbac/finance-clerk",
      credsKey: "finance" as const,
      message: "Finance clerk area",
      otherKey: "member" as const,
    },
    {
      path: "/rbac/administrator",
      credsKey: "admin" as const,
      message: "Administrator area",
      otherKey: "leader" as const,
    },
  ];

  for (const row of matrix) {
    it(`GET ${row.path} returns 200 with role-specific message when caller's real session carries the required role`, async () => {
      const agent = await loginAgent(app, seededCreds[row.credsKey]);

      const response = await agent.get(row.path);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: row.message });
    });

    it(`GET ${row.path} returns 401 when no session cookie is present`, async () => {
      const response = await request(app).get(row.path);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(typeof response.body.error.code).toBe("string");
    });

    it(`GET ${row.path} returns 403 ROLE_FORBIDDEN when the real session carries a different role`, async () => {
      const otherAgent = await loginAgent(app, seededCreds[row.otherKey]);

      const response = await otherAgent.get(row.path);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
    });
  }
});
