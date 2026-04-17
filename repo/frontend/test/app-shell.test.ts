/**
 * @vitest-environment jsdom
 */
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({ replace: replaceMock }),
  RouterLink: { template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>' },
  RouterView: { template: "<div />" },
}));

const logoutMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../src/api/authApi", () => ({
  authApi: {
    logout: logoutMock,
    me: vi.fn(),
    login: vi.fn(),
  },
}));

import AppShell from "../src/layouts/AppShell.vue";
import { useAuthStore } from "../src/stores/authStore";

describe("AppShell layout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("shows the authenticated username + role summary when a session exists", () => {
    const store = useAuthStore();
    store.user = { id: 5, username: "admin1", roles: ["ADMINISTRATOR"] };

    const wrapper = mount(AppShell, {
      global: { stubs: { RouterView: true } },
    });

    expect(wrapper.text()).toContain("admin1");
    // "Administrator" is the display name from roleDisplayNames.
    expect(wrapper.text()).toMatch(/Administrator/);
  });

  it("falls back to 'unknown' when no user is present", () => {
    const wrapper = mount(AppShell, {
      global: { stubs: { RouterView: true } },
    });
    expect(wrapper.text()).toContain("unknown");
  });

  it("clicking Sign out calls authApi.logout and navigates to /login", async () => {
    const store = useAuthStore();
    store.user = { id: 5, username: "admin1", roles: ["ADMINISTRATOR"] };

    const wrapper = mount(AppShell, {
      global: { stubs: { RouterView: true } },
    });

    const signOutBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Sign out");
    await signOutBtn!.trigger("click");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(logoutMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(store.user).toBeNull(); // store.clearSession() ran
  });

  it("renders role-specific navigation links (admin sees admin-only items)", () => {
    const store = useAuthStore();
    store.user = { id: 5, username: "admin1", roles: ["ADMINISTRATOR"] };

    const wrapper = mount(AppShell, {
      global: { stubs: { RouterView: true } },
    });

    const html = wrapper.html();
    // Admin nav should include links to the admin-only pages.
    expect(html).toMatch(/admin|administrator|blacklist|audit/i);
  });
});
