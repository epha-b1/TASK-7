import {
  createThreadComment,
  flagComment,
  getThreadComments,
} from "../../src/features/discussions/services/discussionService";
import * as repo from "../../src/features/discussions/repositories/discussionRepository";
import * as auditService from "../../src/features/audit/services/auditService";

vi.mock("../../src/features/discussions/repositories/discussionRepository");
vi.mock("../../src/features/behavior/services/behaviorService", () => ({
  recordServerBehaviorEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/features/audit/services/auditService", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockedRepo = vi.mocked(repo);
const mockedAuditService = vi.mocked(auditService);

describe("discussion service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates mention notifications when @username is present", async () => {
    mockedRepo.isOrderOwnedByUser.mockResolvedValue(true);
    mockedRepo.getOrCreateDiscussion.mockResolvedValue({
      id: 100,
      contextType: "LISTING",
      contextId: 5,
    });
    mockedRepo.createComment.mockResolvedValue({ commentId: 200 });
    mockedRepo.findUsersByUsernames.mockResolvedValue([
      { id: 12, username: "leader1" },
      { id: 13, username: "reviewer1" },
    ]);
    mockedRepo.createCommentMentions.mockResolvedValue();
    mockedRepo.createNotification.mockResolvedValue();

    const result = await createThreadComment({
      input: {
        contextType: "LISTING",
        contextId: 5,
        body: "Please check this @leader1 and @reviewer1",
      },
      userId: 1,
      username: "member1",
      roles: ["MEMBER"],
    });

    expect(result.commentId).toBe(200);
    expect(mockedRepo.createCommentMentions).toHaveBeenCalledWith({
      commentId: 200,
      mentions: [
        { userId: 12, username: "leader1" },
        { userId: 13, username: "reviewer1" },
      ],
    });
    expect(mockedRepo.createNotification).toHaveBeenCalledTimes(2);
    expect(mockedAuditService.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SHARE",
        resourceType: "DISCUSSION_COMMENT",
        resourceId: 200,
      }),
    );
  });

  it("returns fixed page size 20 for thread response", async () => {
    mockedRepo.getDiscussionById.mockResolvedValue({
      id: 100,
      contextType: "LISTING",
      contextId: 44,
    });
    mockedRepo.getThreadCommentsPage.mockResolvedValue({
      total: 31,
      comments: [],
    });

    const page = await getThreadComments({
      discussionId: 100,
      page: 2,
      sort: "newest",
      userId: 1,
      roles: ["REVIEWER"],
    });

    expect(page?.pageSize).toBe(20);
    expect(page?.page).toBe(2);
  });

  it("blocks member access to order thread they do not own", async () => {
    mockedRepo.getDiscussionById.mockResolvedValue({
      id: 101,
      contextType: "ORDER",
      contextId: 77,
    });
    mockedRepo.isOrderOwnedByUser.mockResolvedValue(false);

    await expect(
      getThreadComments({
        discussionId: 101,
        page: 1,
        sort: "newest",
        userId: 9,
        roles: ["MEMBER"],
      }),
    ).rejects.toThrow("THREAD_FORBIDDEN");
  });

  it("blocks finance role access to order thread without ownership", async () => {
    mockedRepo.getDiscussionById.mockResolvedValue({
      id: 102,
      contextType: "ORDER",
      contextId: 88,
    });
    mockedRepo.isOrderOwnedByUser.mockResolvedValue(false);

    await expect(
      getThreadComments({
        discussionId: 102,
        page: 1,
        sort: "newest",
        userId: 14,
        roles: ["FINANCE_CLERK"],
      }),
    ).rejects.toThrow("THREAD_FORBIDDEN");
  });

  it("allows reviewer access to order thread without ownership", async () => {
    mockedRepo.getDiscussionById.mockResolvedValue({
      id: 103,
      contextType: "ORDER",
      contextId: 89,
    });
    mockedRepo.getThreadCommentsPage.mockResolvedValue({
      total: 1,
      comments: [],
    });

    await getThreadComments({
      discussionId: 103,
      page: 1,
      sort: "newest",
      userId: 15,
      roles: ["REVIEWER"],
    });

    expect(mockedRepo.isOrderOwnedByUser).not.toHaveBeenCalled();
    expect(mockedRepo.getThreadCommentsPage).toHaveBeenCalled();
  });

  it("blocks group leader flagging on another user's order thread", async () => {
    mockedRepo.findCommentById.mockResolvedValue({
      id: 500,
      discussionId: 99,
      parentCommentId: null,
      userId: 44,
      body: "hidden text",
      isHidden: false,
      hiddenReason: null,
    });
    mockedRepo.getDiscussionById.mockResolvedValue({
      id: 99,
      contextType: "ORDER",
      contextId: 201,
    });
    mockedRepo.isOrderOwnedByUser.mockResolvedValue(false);

    await expect(
      flagComment({
        commentId: 500,
        flaggedByUserId: 45,
        roles: ["GROUP_LEADER"],
        reason: "Not acceptable",
      }),
    ).rejects.toThrow("THREAD_FORBIDDEN");

    expect(mockedRepo.addCommentFlag).not.toHaveBeenCalled();
  });

  it("allows admin to flag comments without order ownership", async () => {
    mockedRepo.findCommentById.mockResolvedValue({
      id: 501,
      discussionId: 100,
      parentCommentId: null,
      userId: 46,
      body: "text",
      isHidden: false,
      hiddenReason: null,
    });
    mockedRepo.getDiscussionById.mockResolvedValue({
      id: 100,
      contextType: "ORDER",
      contextId: 202,
    });
    mockedRepo.addCommentFlag.mockResolvedValue(false);

    const result = await flagComment({
      commentId: 501,
      flaggedByUserId: 99,
      roles: ["ADMINISTRATOR"],
      reason: "Moderation confirmed",
    });

    expect(mockedRepo.addCommentFlag).toHaveBeenCalledWith({
      commentId: 501,
      flaggedByUserId: 99,
      reason: "Moderation confirmed",
    });
    expect(result).toEqual({
      commentId: 501,
      hidden: false,
    });
  });

  it("returns hidden=true when moderation threshold is reached", async () => {
    mockedRepo.findCommentById.mockResolvedValue({
      id: 502,
      discussionId: 101,
      parentCommentId: null,
      userId: 47,
      body: "text",
      isHidden: false,
      hiddenReason: null,
    });
    mockedRepo.getDiscussionById.mockResolvedValue({
      id: 101,
      contextType: "ORDER",
      contextId: 203,
    });
    mockedRepo.addCommentFlag.mockResolvedValue(true);

    const result = await flagComment({
      commentId: 502,
      flaggedByUserId: 100,
      roles: ["ADMINISTRATOR"],
      reason: "Escalated moderation threshold",
    });

    expect(result).toEqual({
      commentId: 502,
      hidden: true,
    });
  });
});
