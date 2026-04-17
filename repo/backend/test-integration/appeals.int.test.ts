/**
 * NO-MOCK integration: appeals create + file upload + download + status
 * transition through the full stack (createApp + services + repositories +
 * real MySQL + real filesystem under ./storage/appeals/).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getRealApp,
  closeRealPool,
  loginAgent,
  seededCreds,
} from "./helpers/realApp";

// Smallest possible valid PDF so we exercise the signature-prefix check and
// the checksum round-trip in real code without shipping a big fixture.
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8",
);

// 1x1 red PNG (matches the 0x89 0x50 0x4E 0x47 signature required by the
// service-layer validator).
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("appeals lifecycle (no-mock, real MySQL + filesystem)", () => {
  let app: Awaited<ReturnType<typeof getRealApp>>;
  let memberAgent: Awaited<ReturnType<typeof loginAgent>>;
  let reviewerAgent: Awaited<ReturnType<typeof loginAgent>>;
  let ownedOrderId: number;
  let appealId: number;
  let uploadedFileId: number;

  beforeAll(async () => {
    app = await getRealApp();
    memberAgent = await loginAgent(app, seededCreds.member);
    reviewerAgent = await loginAgent(app, seededCreds.reviewer);

    // Create a real order this member owns so we can appeal against it.
    const cycles = await memberAgent.get(
      "/buying-cycles/active?page=1&pageSize=5",
    );
    const cycleId = cycles.body.data.data.find(
      (c: { name: string; id: number }) =>
        c.name === "March Fresh Produce Wave",
    ).id;

    const listings = await memberAgent.get(
      `/listings?cycleId=${cycleId}&page=1&pageSize=5`,
    );
    const listing = listings.body.data.data.find(
      (l: { title: string }) => l.title === "Farm Eggs (Dozen)",
    );
    const pickupPointId = listing.pickupPointId;

    const pickupDetail = await memberAgent.get(
      `/pickup-points/${pickupPointId}`,
    );
    const windowWithSpace = pickupDetail.body.data.windows.find(
      (w: { remainingCapacity: number }) => w.remainingCapacity > 0,
    );

    const checkout = await memberAgent.post("/orders/checkout").send({
      cycleId,
      pickupPointId,
      pickupWindowId: windowWithSpace.id,
      taxJurisdictionCode: "US-IL-SPRINGFIELD",
      items: [{ listingId: listing.id, quantity: 1 }],
    });

    expect(checkout.status).toBe(201);
    ownedOrderId = checkout.body.data.orderId;
  });

  afterAll(async () => {
    await closeRealPool();
  });

  it("MEMBER can create an appeal against their own order and receives INTAKE status", async () => {
    const response = await memberAgent.post("/appeals").send({
      sourceType: "ORDER_DETAIL",
      sourceOrderId: ownedOrderId,
      reasonCategory: "ORDER_ISSUE",
      narrative:
        "Pickup was delayed and some produce arrived in unusable condition. Please review the incident.",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("INTAKE");
    appealId = response.body.data.id;
    expect(typeof appealId).toBe("number");
  });

  it("rejects a file with a PDF mime type but non-PDF signature (FILE_SIGNATURE_MISMATCH)", async () => {
    const response = await memberAgent
      .post(`/appeals/${appealId}/files`)
      .send({
        files: [
          {
            fileName: "forgery.pdf",
            mimeType: "application/pdf",
            base64Content: TINY_PNG_BASE64, // wrong signature
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("FILE_SIGNATURE_MISMATCH");
  });

  it("rejects a corrupt base64 payload with INVALID_BASE64_FILE", async () => {
    const response = await memberAgent
      .post(`/appeals/${appealId}/files`)
      .send({
        files: [
          {
            fileName: "corrupt.png",
            mimeType: "image/png",
            base64Content: "!!!not-real-base64@@@",
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_BASE64_FILE");
  });

  it("accepts a real PDF with correct signature, stores it on disk, and returns a fileId", async () => {
    const response = await memberAgent
      .post(`/appeals/${appealId}/files`)
      .send({
        files: [
          {
            fileName: "report.pdf",
            mimeType: "application/pdf",
            base64Content: MINIMAL_PDF.toString("base64"),
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(Array.isArray(response.body.data.files)).toBe(true);
    expect(response.body.data.files.length).toBe(1);
    const file = response.body.data.files[0];
    expect(typeof file.id).toBe("number");
    expect(file.originalFileName).toBe("report.pdf");
    expect(file.mimeType).toBe("application/pdf");
    expect(file.fileSizeBytes).toBe(MINIMAL_PDF.byteLength);
    uploadedFileId = file.id;
  });

  it("lists the uploaded file in the appeal detail response for the owner", async () => {
    const response = await memberAgent.get(`/appeals/${appealId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(appealId);
    const files = response.body.data.files as Array<{
      id: number;
      originalFileName: string;
    }>;
    const ours = files.find((f) => f.id === uploadedFileId);
    expect(ours).toBeDefined();
    expect(ours!.originalFileName).toBe("report.pdf");
  });

  it("MEMBER can download their own file; the response body matches the original bytes", async () => {
    const response = await memberAgent
      .get(`/appeals/${appealId}/files/${uploadedFileId}/download`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect((response.body as Buffer).equals(MINIMAL_PDF)).toBe(true);
  });

  it("another MEMBER (finance clerk) can read the appeal via elevated access", async () => {
    const financeAgent = await loginAgent(app, seededCreds.finance);
    const response = await financeAgent.get(`/appeals/${appealId}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(appealId);
  });

  it("MEMBER cannot transition appeal status (reviewer/admin only)", async () => {
    const response = await memberAgent
      .patch(`/appeals/${appealId}/status`)
      .send({ toStatus: "INVESTIGATION", note: "trying from member" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
  });

  it("REVIEWER can move appeal INTAKE -> INVESTIGATION and it shows on the timeline", async () => {
    const response = await reviewerAgent
      .patch(`/appeals/${appealId}/status`)
      .send({
        toStatus: "INVESTIGATION",
        note: "Opened investigation; reviewing evidence.",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.toStatus).toBe("INVESTIGATION");

    const timeline = await reviewerAgent.get(`/appeals/${appealId}/timeline`);
    expect(timeline.status).toBe(200);
    expect(Array.isArray(timeline.body.data.events)).toBe(true);
    const lastEvent = timeline.body.data.events.at(-1);
    expect(lastEvent.toStatus).toBe("INVESTIGATION");
  });

  it("REVIEWER can move appeal INVESTIGATION -> RULING but not skip to RULING from INTAKE", async () => {
    const response = await reviewerAgent
      .patch(`/appeals/${appealId}/status`)
      .send({ toStatus: "RULING", note: "Ruling closed after investigation." });

    expect(response.status).toBe(200);
    expect(response.body.data.toStatus).toBe("RULING");

    // Further transition attempts are now illegal.
    const reTransition = await reviewerAgent
      .patch(`/appeals/${appealId}/status`)
      .send({ toStatus: "INVESTIGATION", note: "reopen" });

    expect(reTransition.status).toBe(409);
    expect(reTransition.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("creating an appeal with a sub-20-char narrative is rejected at the zod boundary", async () => {
    const response = await memberAgent.post("/appeals").send({
      sourceType: "ORDER_DETAIL",
      sourceOrderId: ownedOrderId,
      reasonCategory: "ORDER_ISSUE",
      narrative: "too short",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST_PAYLOAD");
  });
});
