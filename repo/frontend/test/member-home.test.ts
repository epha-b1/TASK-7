/**
 * @vitest-environment jsdom
 */
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: {}, query: {} }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' },
}));

const getActiveCyclesMock = vi.hoisted(() => vi.fn());
const getNotificationsMock = vi.hoisted(() => vi.fn());
const listAppealsMock = vi.hoisted(() => vi.fn());

vi.mock("../src/api/commerceApi", () => ({
  commerceApi: { getActiveCycles: getActiveCyclesMock },
}));
vi.mock("../src/api/discussionApi", () => ({
  discussionApi: { getNotifications: getNotificationsMock },
}));
vi.mock("../src/api/appealApi", () => ({
  appealApi: { listAppeals: listAppealsMock },
}));

import MemberHomePage from "../src/pages/MemberHomePage.vue";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("MemberHomePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders dashboard counters from the three parallel API calls", async () => {
    getActiveCyclesMock.mockResolvedValue({ data: [], page: 1, pageSize: 5, total: 3 });
    getNotificationsMock.mockResolvedValue({
      data: [
        { id: 1, readState: "UNREAD" },
        { id: 2, readState: "UNREAD" },
        { id: 3, readState: "READ" },
      ],
      total: 3,
    });
    listAppealsMock.mockResolvedValue({
      data: [
        {
          id: 10,
          status: "INTAKE",
          sourceType: "ORDER_DETAIL",
          sourceOrderId: 5,
          reasonCategory: "ORDER_ISSUE",
          narrative: "something went wrong",
          createdAt: "2026-04-01T10:00:00.000Z",
        },
        {
          id: 11,
          status: "RULING",
          sourceType: "HIDDEN_CONTENT_BANNER",
          reasonCategory: "MODERATION",
          narrative: "closed appeal",
          createdAt: "2026-04-02T10:00:00.000Z",
        },
      ],
      page: 1,
      pageSize: 5,
      total: 2,
    });

    const wrapper = mount(MemberHomePage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    // Active cycle count comes from getActiveCycles.total
    expect(wrapper.text()).toContain("3");
    // Unread notification count = 2 (filtered from 3 total)
    expect(wrapper.text()).toMatch(/Unread Notifications[\s\S]*?2/);
    // Open appeal count = 1 (only INTAKE/INVESTIGATION)
    expect(wrapper.text()).toMatch(/Open Appeals[\s\S]*?1/);
    // Shows appeal narrative excerpt
    expect(wrapper.text()).toContain("something went wrong");
  });

  it("falls back to an empty-state message when no appeals exist", async () => {
    getActiveCyclesMock.mockResolvedValue({ data: [], total: 0 });
    getNotificationsMock.mockResolvedValue({ data: [], total: 0 });
    listAppealsMock.mockResolvedValue({ data: [], total: 0 });

    const wrapper = mount(MemberHomePage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    expect(wrapper.text()).toContain("No appeals submitted yet.");
  });

  it("surfaces the error message when the dashboard load rejects", async () => {
    getActiveCyclesMock.mockRejectedValue(new Error("network boom"));
    getNotificationsMock.mockResolvedValue({ data: [], total: 0 });
    listAppealsMock.mockResolvedValue({ data: [], total: 0 });

    const wrapper = mount(MemberHomePage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    expect(wrapper.text()).toContain("network boom");
  });
});
