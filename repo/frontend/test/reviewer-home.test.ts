/**
 * @vitest-environment jsdom
 */
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: {}, query: {} }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: "<a><slot /></a>" },
}));

const listAppealsMock = vi.hoisted(() => vi.fn());
const transitionStatusMock = vi.hoisted(() => vi.fn());

vi.mock("../src/api/appealApi", () => ({
  appealApi: {
    listAppeals: listAppealsMock,
    transitionStatus: transitionStatusMock,
  },
}));

import ReviewerHomePage from "../src/pages/ReviewerHomePage.vue";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("ReviewerHomePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the appeal queue on mount and shows status-specific transition buttons", async () => {
    listAppealsMock.mockResolvedValue({
      data: [
        {
          id: 1,
          status: "INTAKE",
          sourceType: "ORDER_DETAIL",
          reasonCategory: "ORDER_ISSUE",
          createdAt: "2026-04-01T10:00:00.000Z",
        },
        {
          id: 2,
          status: "INVESTIGATION",
          sourceType: "HIDDEN_CONTENT_BANNER",
          reasonCategory: "MODERATION",
          createdAt: "2026-04-02T10:00:00.000Z",
        },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
    });

    const wrapper = mount(ReviewerHomePage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    expect(listAppealsMock).toHaveBeenCalled();
    expect(wrapper.text()).toContain("#1");
    expect(wrapper.text()).toContain("#2");
    expect(wrapper.text()).toContain("Move to Investigation"); // from INTAKE row
    expect(wrapper.text()).toContain("Move to Ruling"); // from INVESTIGATION row
  });

  it("calls transitionStatus with the correct appealId + toStatus when action is clicked", async () => {
    listAppealsMock.mockResolvedValue({
      data: [
        {
          id: 44,
          status: "INTAKE",
          sourceType: "ORDER_DETAIL",
          reasonCategory: "ORDER_ISSUE",
          createdAt: "2026-04-01T10:00:00.000Z",
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    transitionStatusMock.mockResolvedValue({});

    const wrapper = mount(ReviewerHomePage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    const moveBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Move to Investigation");
    await moveBtn!.trigger("click");
    await flush();

    expect(transitionStatusMock).toHaveBeenCalledWith(
      44,
      "INVESTIGATION",
      expect.stringMatching(/investigation/i),
    );
  });

  it("renders an empty-state message when the queue is empty", async () => {
    listAppealsMock.mockResolvedValue({ data: [], total: 0 });
    const wrapper = mount(ReviewerHomePage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();
    expect(wrapper.findAll("tbody tr").length).toBe(0);
  });
});
