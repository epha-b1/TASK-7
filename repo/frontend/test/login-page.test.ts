/**
 * @vitest-environment jsdom
 */
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const resolveMock = vi.hoisted(() =>
  vi.fn((path: string) => ({
    matched: path === "/login" ? [] : [{}],
    path,
    meta: { roles: ["MEMBER"] },
  })),
);

vi.mock("vue-router", () => ({
  useRoute: () => ({ params: {}, query: {} }),
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    resolve: resolveMock,
  }),
  RouterLink: { template: "<a><slot /></a>" },
}));

const loginMock = vi.hoisted(() => vi.fn());
const meMock = vi.hoisted(() => vi.fn());

vi.mock("../src/api/authApi", () => ({
  authApi: {
    login: loginMock,
    me: meMock,
    logout: vi.fn(),
  },
}));

import LoginPage from "../src/pages/LoginPage.vue";
import { useAuthStore } from "../src/stores/authStore";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("LoginPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("submits typed credentials to authApi.login and redirects to the role home on success", async () => {
    loginMock.mockResolvedValue({
      user: { id: 1, username: "member1", roles: ["MEMBER"] },
      expiresAt: "2026-04-18T00:00:00.000Z",
    });

    const wrapper = mount(LoginPage, {
      global: { stubs: { RouterLink: true } },
    });

    await wrapper.findAll("input")[0].setValue("member1");
    await wrapper.findAll("input")[1].setValue("Member#Pass123");
    await wrapper.find("form").trigger("submit.prevent");
    await flush();

    expect(loginMock).toHaveBeenCalledWith({
      username: "member1",
      password: "Member#Pass123",
    });
    // LoginPage.vue uses router.replace() (not push) so the address is
    // rewritten rather than pushed onto history.
    expect(replaceMock).toHaveBeenCalledWith("/home/member");
    expect(wrapper.text()).not.toContain("Invalid");
  });

  it("shows the backend error message on a failed login and does NOT navigate", async () => {
    const { ApiError } = await import("../src/api/client");
    loginMock.mockRejectedValue(
      new ApiError("Invalid username or password.", 401, {}, "INVALID_CREDENTIALS"),
    );

    const wrapper = mount(LoginPage, {
      global: { stubs: { RouterLink: true } },
    });

    await wrapper.findAll("input")[0].setValue("member1");
    await wrapper.findAll("input")[1].setValue("wrong");
    await wrapper.find("form").trigger("submit.prevent");
    await flush();

    expect(wrapper.text()).toContain("Invalid username or password");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("reflects the session-expired query param as a visible notice", async () => {
    vi.resetModules();
    vi.doMock("vue-router", () => ({
      useRoute: () => ({ params: {}, query: { reason: "session-expired" } }),
      useRouter: () => ({ push: pushMock, replace: replaceMock, resolve: resolveMock }),
      RouterLink: { template: "<a><slot /></a>" },
    }));
    const { default: Page } = await import("../src/pages/LoginPage.vue");

    const wrapper = mount(Page, {
      global: { stubs: { RouterLink: true } },
    });

    expect(wrapper.text()).toMatch(/session expired/i);
  });

  it("keeps the submit button disabled while the authStore is loading", async () => {
    const store = useAuthStore();
    store.loading = true;
    const wrapper = mount(LoginPage, {
      global: { stubs: { RouterLink: true } },
    });
    expect(wrapper.find("button.auth-submit").attributes("disabled")).toBeDefined();
    expect(wrapper.find("button.auth-submit").text()).toMatch(/Signing in/);
  });
});
