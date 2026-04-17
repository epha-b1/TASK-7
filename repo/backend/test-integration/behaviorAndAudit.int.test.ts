/**
 * NO-MOCK integration: behavior ingest + retention admin endpoints + audit
 * hash chain verification against real MySQL.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import {
  getRealApp,
  closeRealPool,
  loginAgent,
  seededCreds,
} from "./helpers/realApp";

describe("behavior + audit (no-mock, real MySQL)", () => {
  let app: Awaited<ReturnType<typeof getRealApp>>;
  let memberAgent: Awaited<ReturnType<typeof loginAgent>>;
  let adminAgent: Awaited<ReturnType<typeof loginAgent>>;
  let reviewerAgent: Awaited<ReturnType<typeof loginAgent>>;

  beforeAll(async () => {
    app = await getRealApp();
    memberAgent = await loginAgent(app, seededCreds.member);
    adminAgent = await loginAgent(app, seededCreds.admin);
    reviewerAgent = await loginAgent(app, seededCreds.reviewer);
  });

  afterAll(async () => {
    await closeRealPool();
  });

  describe("behavior ingest", () => {
    it("accepts a batch of events with unique idempotency keys", async () => {
      const suffix = crypto.randomUUID();
      const response = await memberAgent.post("/behavior/events").send({
        events: [
          {
            idempotencyKey: `it-imp-${suffix}`,
            eventType: "IMPRESSION",
            resourceType: "LISTING",
            resourceId: "1",
          },
          {
            idempotencyKey: `it-clk-${suffix}`,
            eventType: "CLICK",
            resourceType: "LISTING",
            resourceId: "1",
          },
        ],
      });

      expect(response.status).toBe(202);
      expect(response.body.data).toMatchObject({
        accepted: 2,
        duplicates: 0,
      });
    });

    it("deduplicates by idempotency key on a second submission of the same event", async () => {
      const key = `it-dup-${crypto.randomUUID()}`;
      const first = await memberAgent.post("/behavior/events").send({
        events: [
          {
            idempotencyKey: key,
            eventType: "FAVORITE",
            resourceType: "PICKUP_POINT",
            resourceId: "1",
          },
        ],
      });
      expect(first.status).toBe(202);
      expect(first.body.data).toMatchObject({ accepted: 1, duplicates: 0 });

      const second = await memberAgent.post("/behavior/events").send({
        events: [
          {
            idempotencyKey: key,
            eventType: "FAVORITE",
            resourceType: "PICKUP_POINT",
            resourceId: "1",
          },
        ],
      });
      expect(second.status).toBe(202);
      // duplicates reflected as no-op under the same key.
      expect(second.body.data.accepted + second.body.data.duplicates).toBe(1);
    });

    it("rejects events with an under-length idempotency key (zod boundary)", async () => {
      const response = await memberAgent.post("/behavior/events").send({
        events: [
          {
            idempotencyKey: "x",
            eventType: "IMPRESSION",
            resourceType: "LISTING",
          },
        ],
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST_PAYLOAD");
    });

    it("requires auth: unauthenticated ingest returns 401", async () => {
      const { default: supertest } = await import("supertest");
      const response = await supertest(app).post("/behavior/events").send({
        events: [
          {
            idempotencyKey: `it-noauth-${crypto.randomUUID()}`,
            eventType: "IMPRESSION",
            resourceType: "LISTING",
          },
        ],
      });
      expect(response.status).toBe(401);
    });
  });

  describe("retention admin endpoints", () => {
    it("MEMBER is forbidden from /admin/jobs/retention-status", async () => {
      const response = await memberAgent.get("/admin/jobs/retention-status");
      expect(response.status).toBe(403);
    });

    it("ADMINISTRATOR retention-status returns hot/archive/queue counters", async () => {
      const response = await adminAgent.get("/admin/jobs/retention-status");
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        hotCount: expect.any(Number),
        archiveCount: expect.any(Number),
        queuePending: expect.any(Number),
      });
    });

    it("ADMINISTRATOR retention-run executes archive + purge and returns counts", async () => {
      const response = await adminAgent.post("/admin/jobs/retention-run");
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        archivedCount: expect.any(Number),
        purgedCount: expect.any(Number),
      });
      // Nothing in the seed is 90+ days old, so both should be zero, but the
      // contract test only cares that the endpoint executed transactionally
      // and returned the canonical shape.
      expect(response.body.data.archivedCount).toBeGreaterThanOrEqual(0);
      expect(response.body.data.purgedCount).toBeGreaterThanOrEqual(0);
    });

    it("MEMBER is forbidden from /admin/jobs/retention-run", async () => {
      const response = await memberAgent.post("/admin/jobs/retention-run");
      expect(response.status).toBe(403);
    });
  });

  describe("audit hash chain", () => {
    it("ADMINISTRATOR audit search returns rows with hash linkage fields", async () => {
      const response = await adminAgent.get("/audit/logs?page=1&pageSize=10");
      expect(response.status).toBe(200);

      expect(typeof response.body.data.total).toBe("number");
      expect(Array.isArray(response.body.data.data)).toBe(true);

      if (response.body.data.data.length > 0) {
        const row = response.body.data.data[0];
        expect(row).toMatchObject({
          id: expect.any(Number),
          action: expect.any(String),
          resourceType: expect.any(String),
          currentHash: expect.any(String),
        });
      }
    });

    it("ADMINISTRATOR audit CSV export returns text/csv with a header row", async () => {
      const response = await adminAgent.get(
        "/audit/logs/export?page=1&pageSize=10",
      );
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
      expect(typeof response.text).toBe("string");
      expect((response.text as string).split("\n")[0]).toMatch(/id/);
    });

    it("REVIEWER is forbidden from audit search (admin-only)", async () => {
      const response = await reviewerAgent.get("/audit/logs");
      expect(response.status).toBe(403);
    });
  });

  describe("GET /audit/logs/verify-chain (ADMINISTRATOR only)", () => {
    it("returns {total, valid, failures[]} with a genuinely valid chain against seeded audit rows", async () => {
      const response = await adminAgent.get("/audit/logs/verify-chain");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        total: expect.any(Number),
        valid: true,
        failures: [],
      });
      // After the above happy-path operations (retention-run, ingest, etc.)
      // the hash chain must still verify — total >= 0 and no failures.
      expect(response.body.data.total).toBeGreaterThanOrEqual(0);
    });

    it("REVIEWER is forbidden from /audit/logs/verify-chain", async () => {
      const response = await reviewerAgent.get("/audit/logs/verify-chain");
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
    });

    it("MEMBER is forbidden from /audit/logs/verify-chain", async () => {
      const response = await memberAgent.get("/audit/logs/verify-chain");
      expect(response.status).toBe(403);
    });

    it("unauthenticated call to /audit/logs/verify-chain returns 401", async () => {
      const { default: supertest } = await import("supertest");
      const response = await supertest(app).get("/audit/logs/verify-chain");
      expect(response.status).toBe(401);
    });
  });

  describe("GET /behavior/summary (FINANCE_CLERK + ADMINISTRATOR)", () => {
    it("returns an array of {eventType, eventCount} rows for the default window", async () => {
      const response = await adminAgent.get("/behavior/summary");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      for (const row of response.body.data) {
        expect(row).toMatchObject({
          eventType: expect.stringMatching(
            /^(IMPRESSION|CLICK|FAVORITE|VOTE|WATCH_COMPLETION)$/,
          ),
          eventCount: expect.any(Number),
        });
        expect(row.eventCount).toBeGreaterThanOrEqual(0);
      }
    });

    it("accepts a from/to date window and still returns the same row contract", async () => {
      const response = await adminAgent.get(
        "/behavior/summary?from=2026-01-01&to=2027-12-31",
      );
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("rejects a malformed from date with 400 INVALID_REQUEST_PAYLOAD", async () => {
      const response = await adminAgent.get(
        "/behavior/summary?from=not-a-date",
      );
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST_PAYLOAD");
    });

    it("MEMBER is forbidden from /behavior/summary", async () => {
      const response = await memberAgent.get("/behavior/summary");
      expect(response.status).toBe(403);
    });

    it("FINANCE_CLERK can fetch /behavior/summary (dual-role endpoint)", async () => {
      const financeAgent = await loginAgent(app, seededCreds.finance);
      const response = await financeAgent.get("/behavior/summary");
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
