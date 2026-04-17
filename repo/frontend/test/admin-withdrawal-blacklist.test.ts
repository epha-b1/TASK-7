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

const listBlacklistMock = vi.hoisted(() => vi.fn());
const upsertBlacklistMock = vi.hoisted(() => vi.fn());
const patchBlacklistMock = vi.hoisted(() => vi.fn());
const deleteBlacklistMock = vi.hoisted(() => vi.fn());

vi.mock("../src/api/financeApi", () => ({
  financeApi: {
    listBlacklist: listBlacklistMock,
    upsertBlacklist: upsertBlacklistMock,
    patchBlacklist: patchBlacklistMock,
    deleteBlacklist: deleteBlacklistMock,
  },
}));

import AdminWithdrawalBlacklistPage from "../src/pages/AdminWithdrawalBlacklistPage.vue";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("AdminWithdrawalBlacklistPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders existing entries loaded from financeApi.listBlacklist", async () => {
    listBlacklistMock.mockResolvedValue({
      data: [
        {
          id: 1,
          userId: 20,
          reason: "Policy breach",
          active: true,
          createdByUserId: 1,
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    const wrapper = mount(AdminWithdrawalBlacklistPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    expect(listBlacklistMock).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Policy breach");
    expect(wrapper.text()).toContain("20");
  });

  it("calls upsertBlacklist with the form values when Save Entry is clicked", async () => {
    listBlacklistMock.mockResolvedValue({ data: [] });
    upsertBlacklistMock.mockResolvedValue(undefined);

    const wrapper = mount(AdminWithdrawalBlacklistPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("42"); // user id
    await inputs[1].setValue("Suspicious withdrawal pattern");

    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Save Entry");
    await saveBtn!.trigger("click");
    await flush();

    expect(upsertBlacklistMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        reason: "Suspicious withdrawal pattern",
        active: true,
      }),
    );
  });

  it("calls deleteBlacklist with the row id when Delete is clicked", async () => {
    listBlacklistMock.mockResolvedValue({
      data: [
        {
          id: 7,
          userId: 20,
          reason: "entry to delete",
          active: true,
          createdByUserId: 1,
          updatedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });
    deleteBlacklistMock.mockResolvedValue(undefined);

    const wrapper = mount(AdminWithdrawalBlacklistPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    const deleteBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Delete");
    await deleteBtn!.trigger("click");
    await flush();

    expect(deleteBlacklistMock).toHaveBeenCalledWith(7);
  });
});
