/**
 * @vitest-environment jsdom
 */
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: {}, query: {} }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: "<a><slot /></a>" },
}));

const getCommissionsMock = vi.hoisted(() => vi.fn());
const getWithdrawalEligibilityMock = vi.hoisted(() => vi.fn());
const requestWithdrawalMock = vi.hoisted(() => vi.fn());
const getReconciliationCsvMock = vi.hoisted(() => vi.fn());

vi.mock("../src/api/financeApi", () => ({
  financeApi: {
    getCommissions: getCommissionsMock,
    getWithdrawalEligibility: getWithdrawalEligibilityMock,
    requestWithdrawal: requestWithdrawalMock,
    getReconciliationCsv: getReconciliationCsvMock,
  },
}));

import FinanceDashboardPage from "../src/pages/FinanceDashboardPage.vue";
import { useAuthStore } from "../src/stores/authStore";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("FinanceDashboardPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("renders commission rows returned by financeApi.getCommissions", async () => {
    getCommissionsMock.mockResolvedValue({
      data: [
        {
          leaderUserId: 7,
          pickupPointId: 3,
          preTaxItemTotal: 200,
          commissionRate: 0.06,
          commissionAmount: 12,
        },
      ],
    });

    const store = useAuthStore();
    store.user = { id: 1, username: "finance1", roles: ["FINANCE_CLERK"] };

    const wrapper = mount(FinanceDashboardPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    // Leader id and commission amount both appear on the dashboard.
    expect(wrapper.text()).toContain("7");
    expect(wrapper.text()).toContain("12");
    expect(getCommissionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: expect.any(String),
        dateTo: expect.any(String),
      }),
    );
  });

  it("shows an error message when commission fetch fails", async () => {
    getCommissionsMock.mockRejectedValue(new Error("backend unavailable"));

    const store = useAuthStore();
    store.user = { id: 1, username: "finance1", roles: ["FINANCE_CLERK"] };

    const wrapper = mount(FinanceDashboardPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flush();

    expect(wrapper.text()).toContain("backend unavailable");
  });
});
