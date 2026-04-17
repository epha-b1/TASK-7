/**
 * @vitest-environment jsdom
 */
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-router", () => ({
  RouterLink: { template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>' },
}));

import FinanceClerkHomePage from "../src/pages/FinanceClerkHomePage.vue";

describe("FinanceClerkHomePage", () => {
  it("renders the finance clerk home title and links to the finance dashboard", () => {
    const wrapper = mount(FinanceClerkHomePage, {
      global: { stubs: { RouterLink: false } },
      props: {},
    });

    expect(wrapper.text()).toContain("Finance Clerk Home");
    expect(wrapper.text()).toContain("Open Finance Dashboard");
    expect(wrapper.html()).toContain("/finance/dashboard");
  });
});
