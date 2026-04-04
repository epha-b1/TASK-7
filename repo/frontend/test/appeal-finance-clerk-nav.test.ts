/**
 * @vitest-environment jsdom
 */

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

// AppealDraftPage: finance clerk with order source should NOT get /member/orders path

const draftRouteState = vi.hoisted(() => ({
  query: {
    source: "order-detail",
    orderId: "55",
  },
}));

vi.mock("vue-router", () => ({
  useRoute: () => draftRouteState,
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: "<a><slot /></a>" },
}));

vi.mock("../src/api/appealApi", () => ({
  appealApi: {
    createAppeal: vi.fn(),
    uploadFiles: vi.fn(),
  },
}));

vi.mock("../src/stores/authStore", () => ({
  useAuthStore: () => ({
    roles: ["FINANCE_CLERK"],
  }),
}));

import AppealDraftPage from "../src/pages/AppealDraftPage.vue";

describe("AppealDraftPage finance-clerk navigation", () => {
  it("does not route finance clerk back to member-only order detail", () => {
    const wrapper = mount(AppealDraftPage, {
      global: { stubs: { RouterLink: true } },
    });

    // The cancel link should NOT point to /member/orders/55 since FINANCE_CLERK
    // is not in the order-detail route's allowed roles.
    const html = wrapper.html();
    expect(html).not.toContain("/member/orders/55");
  });
});
