import {
  createAppealRecord,
  getAppealDetail,
  transitionAppealStatus,
  uploadAppealFiles,
} from "../../src/features/appeals/services/appealService";
import * as repo from "../../src/features/appeals/repositories/appealRepository";
import * as auditService from "../../src/features/audit/services/auditService";

const mkdirMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const writeFileMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const readFileMock = vi.hoisted(() => vi.fn());

vi.mock("fs/promises", () => ({
  default: {
    mkdir: mkdirMock,
    writeFile: writeFileMock,
    readFile: readFileMock,
  },
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  readFile: readFileMock,
}));

vi.mock("../../src/features/appeals/repositories/appealRepository");
vi.mock("../../src/features/audit/services/auditService", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockedRepo = vi.mocked(repo);
const mockedAuditService = vi.mocked(auditService);

describe("appeal service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAuditService.recordAuditLog.mockResolvedValue(undefined);
  });

  it("rejects upload when total files would exceed 5", async () => {
    mockedRepo.findAppealById.mockResolvedValue({
      id: 10,
      submittedByUserId: 1,
      sourceType: "ORDER_DETAIL",
      sourceCommentId: null,
      sourceOrderId: 9,
      reasonCategory: "ORDER_ISSUE",
      narrative: "Need support",
      referencesText: null,
      status: "INTAKE",
      currentEventAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedRepo.countAppealFiles.mockResolvedValue(4);

    await expect(
      uploadAppealFiles({
        appealId: 10,
        userId: 1,
        roles: ["MEMBER"],
        files: [
          {
            fileName: "a.pdf",
            mimeType: "application/pdf",
            base64Content: Buffer.from("a").toString("base64"),
          },
          {
            fileName: "b.pdf",
            mimeType: "application/pdf",
            base64Content: Buffer.from("b").toString("base64"),
          },
        ],
      }),
    ).rejects.toThrow("TOO_MANY_FILES");
  });

  it("rejects malformed base64 payloads for appeal files", async () => {
    mockedRepo.findAppealById.mockResolvedValue({
      id: 10,
      submittedByUserId: 1,
      sourceType: "ORDER_DETAIL",
      sourceCommentId: null,
      sourceOrderId: 9,
      reasonCategory: "ORDER_ISSUE",
      narrative: "Need support",
      referencesText: null,
      status: "INTAKE",
      currentEventAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedRepo.countAppealFiles.mockResolvedValue(0);

    await expect(
      uploadAppealFiles({
        appealId: 10,
        userId: 1,
        roles: ["MEMBER"],
        files: [
          {
            fileName: "bad.pdf",
            mimeType: "application/pdf",
            base64Content: "@@definitely-not-base64@@",
          },
        ],
      }),
    ).rejects.toThrow("INVALID_BASE64_FILE");

    expect(mockedRepo.insertAppealFile).not.toHaveBeenCalled();
  });

  it("does not transition intake status when submitter uploads evidence", async () => {
    const now = new Date().toISOString();
    mockedRepo.findAppealById.mockResolvedValue({
      id: 10,
      submittedByUserId: 1,
      sourceType: "ORDER_DETAIL",
      sourceCommentId: null,
      sourceOrderId: 9,
      reasonCategory: "ORDER_ISSUE",
      narrative: "Need support",
      referencesText: null,
      status: "INTAKE",
      currentEventAt: now,
      createdAt: now,
      updatedAt: now,
    });
    mockedRepo.countAppealFiles.mockResolvedValue(0);
    mockedRepo.insertAppealFile.mockResolvedValue({
      id: 100,
      appealId: 10,
      originalFileName: "evidence.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 4,
      storageRelativePath: "storage/appeals/10/evidence.pdf",
      checksumSha256: "abcd",
      uploadedByUserId: 1,
      createdAt: now,
    });

    await uploadAppealFiles({
      appealId: 10,
      userId: 1,
      roles: ["MEMBER"],
      files: [
        {
          fileName: "evidence.pdf",
          mimeType: "application/pdf",
          base64Content: Buffer.from("data").toString("base64"),
        },
      ],
    });

    expect(mockedRepo.appendAppealStatusEvent).not.toHaveBeenCalled();
  });

  it("enforces source validation for hidden content appeal", async () => {
    await expect(
      createAppealRecord({
        userId: 4,
        roles: ["MEMBER"],
        input: {
          sourceType: "HIDDEN_CONTENT_BANNER",
          reasonCategory: "MODERATION",
          narrative: "This content was hidden in error with no explanation.",
        },
      }),
    ).rejects.toThrow("MISSING_SOURCE_COMMENT");
  });

  it("requires hidden or flagged comment source for hidden-content appeals", async () => {
    mockedRepo.getCommentAppealContext.mockResolvedValue({
      commentId: 77,
      discussionId: 900,
      contextType: "LISTING",
      contextId: 32,
      isHidden: false,
      flagCount: 0,
    });

    await expect(
      createAppealRecord({
        userId: 4,
        roles: ["MEMBER"],
        input: {
          sourceType: "HIDDEN_CONTENT_BANNER",
          sourceCommentId: 77,
          reasonCategory: "MODERATION",
          narrative:
            "The moderation action appears incorrect and should be reviewed.",
        },
      }),
    ).rejects.toThrow("SOURCE_COMMENT_NOT_HIDDEN");

    expect(mockedRepo.createAppeal).not.toHaveBeenCalled();
  });

  it("rejects order appeal creation for a member who does not own the order", async () => {
    mockedRepo.existsOrder.mockResolvedValue(true);
    mockedRepo.isOrderOwnedByUser.mockResolvedValue(false);

    await expect(
      createAppealRecord({
        userId: 22,
        roles: ["MEMBER"],
        input: {
          sourceType: "ORDER_DETAIL",
          sourceOrderId: 900,
          reasonCategory: "ORDER_ISSUE",
          narrative: "I should not be able to appeal another member's order.",
        },
      }),
    ).rejects.toThrow("APPEAL_FORBIDDEN");

    expect(mockedRepo.createAppeal).not.toHaveBeenCalled();
  });

  it("allows intake -> investigation -> ruling transitions only", async () => {
    mockedRepo.findAppealById.mockResolvedValueOnce({
      id: 18,
      submittedByUserId: 1,
      sourceType: "ORDER_DETAIL",
      sourceCommentId: null,
      sourceOrderId: 4,
      reasonCategory: "ORDER_ISSUE",
      narrative: "Need status update",
      referencesText: null,
      status: "INTAKE",
      currentEventAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await transitionAppealStatus({
      appealId: 18,
      fromUserId: 99,
      fromUserRoles: ["REVIEWER"],
      toStatus: "INVESTIGATION",
      note: "Initial review accepted.",
    });

    expect(mockedRepo.appendAppealStatusEvent).toHaveBeenCalledWith({
      appealId: 18,
      fromStatus: "INTAKE",
      toStatus: "INVESTIGATION",
      note: "Initial review accepted.",
      changedByUserId: 99,
    });

    mockedRepo.findAppealById.mockResolvedValueOnce({
      id: 18,
      submittedByUserId: 1,
      sourceType: "ORDER_DETAIL",
      sourceCommentId: null,
      sourceOrderId: 4,
      reasonCategory: "ORDER_ISSUE",
      narrative: "Need status update",
      referencesText: null,
      status: "INTAKE",
      currentEventAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      transitionAppealStatus({
        appealId: 18,
        fromUserId: 99,
        fromUserRoles: ["REVIEWER"],
        toStatus: "RULING",
        note: "Skipping stage should fail.",
      }),
    ).rejects.toThrow("INVALID_STATUS_TRANSITION");
  });

  it("does not allow finance clerk to access another user's appeal detail", async () => {
    mockedRepo.findAppealById.mockResolvedValue({
      id: 29,
      submittedByUserId: 100,
      sourceType: "ORDER_DETAIL",
      sourceCommentId: null,
      sourceOrderId: 9,
      reasonCategory: "ORDER_ISSUE",
      narrative: "Need support",
      referencesText: null,
      status: "INTAKE",
      currentEventAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      getAppealDetail({
        appealId: 29,
        requesterUserId: 22,
        requesterRoles: ["FINANCE_CLERK"],
      }),
    ).rejects.toThrow("APPEAL_FORBIDDEN");
  });
});
