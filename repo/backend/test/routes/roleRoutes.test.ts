/**
 * HTTP tests for /rbac/* endpoints. Each endpoint is a protected smoke
 * surface that proves the requireAuth + requireRoles middleware chain is
 * wired and returns the canonical payload when the role matches.
 *
 * Tests go through the real roleRouter + rbac middleware via supertest,
 * with a tiny in-test middleware that attaches req.auth when an x-role
 * header is present (same pattern used across the other route tests).
 */

import express from "express";
import request from "supertest";

import { roleRouter } from "../../src/routes/roleRoutes";

type Role =
  | "MEMBER"
  | "GROUP_LEADER"
  | "REVIEWER"
  | "FINANCE_CLERK"
  | "ADMINISTRATOR";

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const roleHeader = req.header("x-role");
    const roles = roleHeader ? (roleHeader.split(",") as Role[]) : [];
    if (roles.length > 0) {
      req.auth = {
        userId: Number(req.header("x-user-id") ?? "1"),
        username: "test-user",
        roles: roles as any,
        tokenHash: "test-hash",
      };
    }
    next();
  });
  app.use("/rbac", roleRouter);
  return app;
};

describe("RBAC role-home endpoints", () => {
  const matrix: Array<{
    path: string;
    requiredRole: Role;
    expectedMessage: string;
    otherRole: Role;
  }> = [
    {
      path: "/rbac/member",
      requiredRole: "MEMBER",
      expectedMessage: "Member area",
      otherRole: "ADMINISTRATOR",
    },
    {
      path: "/rbac/group-leader",
      requiredRole: "GROUP_LEADER",
      expectedMessage: "Group leader area",
      otherRole: "MEMBER",
    },
    {
      path: "/rbac/reviewer",
      requiredRole: "REVIEWER",
      expectedMessage: "Reviewer area",
      otherRole: "MEMBER",
    },
    {
      path: "/rbac/finance-clerk",
      requiredRole: "FINANCE_CLERK",
      expectedMessage: "Finance clerk area",
      otherRole: "MEMBER",
    },
    {
      path: "/rbac/administrator",
      requiredRole: "ADMINISTRATOR",
      expectedMessage: "Administrator area",
      otherRole: "GROUP_LEADER",
    },
  ];

  for (const row of matrix) {
    describe(`GET ${row.path}`, () => {
      it(`returns 200 and the role-specific message when caller holds ${row.requiredRole}`, async () => {
        const response = await request(buildApp())
          .get(row.path)
          .set("x-role", row.requiredRole)
          .set("x-user-id", "42");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: row.expectedMessage });
      });

      it(`returns 401 without an auth session`, async () => {
        const response = await request(buildApp()).get(row.path);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBeDefined();
      });

      it(`returns 403 ROLE_FORBIDDEN when caller holds a non-matching role (${row.otherRole})`, async () => {
        const response = await request(buildApp())
          .get(row.path)
          .set("x-role", row.otherRole);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
      });
    });
  }
});
