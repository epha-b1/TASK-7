import * as repo from "../../src/features/behavior/repositories/behaviorRepository";
import { runRetentionJobs } from "../../src/features/behavior/services/behaviorService";
import * as auditService from "../../src/features/audit/services/auditService";

vi.mock("../../src/features/behavior/repositories/behaviorRepository");
vi.mock("../../src/features/audit/services/auditService", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockedRepo = vi.mocked(repo);
const mockedAudit = vi.mocked(auditService);

describe("behavior retention lifecycle (service)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives hot events past the 90-day boundary and purges archive past 365 days", async () => {
    mockedRepo.archiveExpiredHotEvents.mockResolvedValue(17);
    mockedRepo.purgeOldArchiveEvents.mockResolvedValue(4);

    const result = await runRetentionJobs(1);

    expect(result).toEqual({ archivedCount: 17, purgedCount: 4 });
    expect(mockedRepo.archiveExpiredHotEvents).toHaveBeenCalledTimes(1);
    expect(mockedRepo.purgeOldArchiveEvents).toHaveBeenCalledTimes(1);
    // archiveExpiredHotEvents runs before purge so that events moving out of
    // hot on day 90 are not immediately purged from archive.
    expect(
      mockedRepo.archiveExpiredHotEvents.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mockedRepo.purgeOldArchiveEvents.mock.invocationCallOrder[0],
    );
  });

  it("reports zero counts when nothing crosses the retention boundary", async () => {
    mockedRepo.archiveExpiredHotEvents.mockResolvedValue(0);
    mockedRepo.purgeOldArchiveEvents.mockResolvedValue(0);

    const result = await runRetentionJobs(1);

    expect(result).toEqual({ archivedCount: 0, purgedCount: 0 });
  });

  it("records an audit log entry for each retention run (hash-chained compliance)", async () => {
    mockedRepo.archiveExpiredHotEvents.mockResolvedValue(3);
    mockedRepo.purgeOldArchiveEvents.mockResolvedValue(2);

    await runRetentionJobs(42);

    expect(mockedAudit.recordAuditLog).toHaveBeenCalledWith({
      actorUserId: 42,
      action: "ROLLBACK",
      resourceType: "BEHAVIOR_RETENTION",
      resourceId: null,
      metadata: { archivedCount: 3, purgedCount: 2 },
    });
  });

  it("accepts a null actor for scheduled retention jobs (non-human trigger)", async () => {
    mockedRepo.archiveExpiredHotEvents.mockResolvedValue(1);
    mockedRepo.purgeOldArchiveEvents.mockResolvedValue(0);

    await runRetentionJobs(null);

    expect(mockedAudit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: null }),
    );
  });

  it("propagates repository errors so the scheduler can retry on the next tick", async () => {
    mockedRepo.archiveExpiredHotEvents.mockRejectedValue(
      new Error("DB_CONNECTION_LOST"),
    );

    await expect(runRetentionJobs(1)).rejects.toThrow("DB_CONNECTION_LOST");
    // Purge is not attempted if archive step fails, to preserve the invariant
    // that events inside the hot window are never prematurely purged.
    expect(mockedRepo.purgeOldArchiveEvents).not.toHaveBeenCalled();
  });
});
