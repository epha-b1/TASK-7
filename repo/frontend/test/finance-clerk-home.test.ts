/**
 * @vitest-environment jsdom
 */
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import FinanceClerkHomePage from "../src/pages/FinanceClerkHomePage.vue";

// Global RouterLink stub that renders its slot into a real <a> element so
// that wrapper.text() and wrapper.html() can observe link text + href.
const RouterLinkStub = {
  name: "RouterLink",
  props: { to: { type: [String, Object], required: true } },
  template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
};

describe("FinanceClerkHomePage", () => {
  it("renders the finance clerk home title and links to the finance dashboard", () => {
    const wrapper = mount(FinanceClerkHomePage, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    });

    expect(wrapper.text()).toContain("Finance Clerk Home");
    expect(wrapper.text()).toContain("Open Finance Dashboard");
    expect(wrapper.html()).toContain("/finance/dashboard");
  });
});
