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

const searchLogsMock = vi.hoisted(() => vi.fn());
const exportCsvMock = vi.hoisted(() => vi.fn());
const verifyChainMock = vi.hoisted(() => vi.fn());

vi.mock("../src/api/auditApi", () => ({
  auditApi: {
    searchLogs: searchLogsMock,
    exportCsv: exportCsvMock,
    verifyChain: verifyChainMock,
  },
}));

import AuditLogPage from "../src/pages/AuditLogPage.vue";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("AuditLogPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists audit log rows with action + resourceType columns populated", async () => {
    searchLogsMock.mockResolvedValue({
      page: 1,
      pageSize: 20,
      total: 1,
      data: [
        {
          id: 10,
          actorUserId: 9,
          action: "APPROVAL",
          resourceType: "LEADER_APPLICATION",
          resourceId: "12",
          previousHash: null,
          currentHash: "abc",
          createdAt: "2026-04-01T10:00:00.000Z",
        },
      ],
    });

    const wrapper = mount(AuditLogPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    // The Search button triggers the API call once the UI is mounted.
    const searchBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Search");
    await searchBtn!.trigger("click");
    await flush();

    expect(searchLogsMock).toHaveBeenCalled();
    expect(wrapper.text()).toContain("APPROVAL");
    expect(wrapper.text()).toContain("LEADER_APPLICATION");
  });

  it("calls auditApi.verifyChain and renders a VALID indicator when the chain is valid", async () => {
    verifyChainMock.mockResolvedValue({ total: 5, valid: true, failures: [] });

    const wrapper = mount(AuditLogPage, {
      global: { stubs: { RouterLink: true } },
    });
    const verifyBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Verify Chain");
    await verifyBtn!.trigger("click");
    await flush();

    expect(verifyChainMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toMatch(/VALID/);
    expect(wrapper.text()).toContain("5 entries");
  });

  it("renders INVALID + failure count when verifyChain reports failures", async () => {
    verifyChainMock.mockResolvedValue({
      total: 5,
      valid: false,
      failures: [{ id: 2, reason: "CURRENT_HASH_INVALID" }],
    });

    const wrapper = mount(AuditLogPage, {
      global: { stubs: { RouterLink: true } },
    });
    const verifyBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Verify Chain");
    await verifyBtn!.trigger("click");
    await flush();

    expect(wrapper.text()).toMatch(/INVALID/);
    expect(wrapper.text()).toMatch(/1 failures?/);
  });
});
