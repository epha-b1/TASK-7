import express from "express";
import request from "supertest";

import { appealRouter } from "../../src/features/appeals/routes/appealRoutes";
import * as appealService from "../../src/features/appeals/services/appealService";

vi.mock("../../src/features/appeals/services/appealService", () => ({
  createAppealRecord: vi.fn(),
  getAppealDetail: vi.fn(),
  getAppealTimeline: vi.fn(),
  listAppealQueue: vi.fn(),
  transitionAppealStatus: vi.fn(),
  uploadAppealFiles: vi.fn(),
  getAppealFileForDownload: vi.fn(),
}));

const mockedAppealService = vi.mocked(appealService);

describe("appeal file download route", () => {
  const withAuth = () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const roleHeader = req.header("x-role");
      if (roleHeader) {
        req.auth = {
          userId: Number(req.header("x-user-id") ?? "1"),
          username: "test-user",
          roles: roleHeader.split(",") as any,
          tokenHash: "test-hash",
        };
      }
      next();
    });
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated download requests", async () => {
    const app = withAuth();
    app.use(appealRouter);

    const response = await request(app).get("/appeals/1/files/2/download");

    expect(response.status).toBe(401);
  });

  it("returns 403 when user does not have access to the appeal", async () => {
    mockedAppealService.getAppealFileForDownload.mockRejectedValue(
      new Error("APPEAL_FORBIDDEN"),
    );

    const app = withAuth();
    app.use(appealRouter);

    const response = await request(app)
      .get("/appeals/1/files/2/download")
      .set("x-role", "MEMBER")
      .set("x-user-id", "99");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("APPEAL_FORBIDDEN");
  });

  it("returns 404 when appeal file does not exist", async () => {
    mockedAppealService.getAppealFileForDownload.mockResolvedValue(null);

    const app = withAuth();
    app.use(appealRouter);

    const response = await request(app)
      .get("/appeals/1/files/999/download")
      .set("x-role", "MEMBER");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FILE_NOT_FOUND");
  });

  it("returns correct Content-Disposition and Content-Type headers on success", async () => {
    // Create a temp file to serve
    const path = await import("path");
    const fs = await import("fs");
    const os = await import("os");
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, "test-evidence.pdf");
    fs.writeFileSync(tmpFile, "fake-pdf-content");

    mockedAppealService.getAppealFileForDownload.mockResolvedValue({
      filePath: tmpFile,
      originalFileName: "evidence-photo.pdf",
      mimeType: "application/pdf",
    });

    const app = withAuth();
    app.use(appealRouter);

    const response = await request(app)
      .get("/appeals/5/files/3/download")
      .set("x-role", "REVIEWER");

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain("evidence-photo.pdf");
    expect(response.headers["content-type"]).toContain("application/pdf");

    // Cleanup
    fs.unlinkSync(tmpFile);
  });

  it("passes correct params to service including requester info", async () => {
    mockedAppealService.getAppealFileForDownload.mockResolvedValue(null);

    const app = withAuth();
    app.use(appealRouter);

    await request(app)
      .get("/appeals/10/files/20/download")
      .set("x-role", "ADMINISTRATOR")
      .set("x-user-id", "42");

    expect(mockedAppealService.getAppealFileForDownload).toHaveBeenCalledWith({
      appealId: 10,
      fileId: 20,
      requesterUserId: 42,
      requesterRoles: ["ADMINISTRATOR"],
    });
  });
});
