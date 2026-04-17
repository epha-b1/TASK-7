/**
 * Unit tests for the per-feature API wrappers. Each test exercises the
 * real wrapper module (real code path, no source-module stubs) and asserts
 * against the exact URL, HTTP method, and JSON body that get handed to
 * `fetch`. This covers the wrappers that were previously at 0% unit
 * coverage: authApi, orderApi, leaderApi, appealApi, auditApi, commerceApi,
 * discussionApi.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { authApi } from "../src/api/authApi";
import { orderApi } from "../src/api/orderApi";
import { leaderApi } from "../src/api/leaderApi";
import { appealApi } from "../src/api/appealApi";
import { auditApi } from "../src/api/auditApi";
import { commerceApi } from "../src/api/commerceApi";
import { discussionApi } from "../src/api/discussionApi";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const jsonResponse = (payload: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "application/json" : null,
    } as unknown as Headers,
    text: async () => JSON.stringify(payload),
  }) as unknown as Response;

const emptyResponse = (status = 204): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => null,
    } as unknown as Headers,
    text: async () => "",
  }) as unknown as Response;

const lastCall = () => {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was not called");
  const [url, init] = call as [string, RequestInit | undefined];
  return {
    url,
    method: init?.method ?? "GET",
    body: init?.body,
    credentials: init?.credentials,
    headers: new Headers(init?.headers ?? {}),
  };
};

afterEach(() => {
  fetchMock.mockReset();
});

// --- authApi --------------------------------------------------------------

describe("authApi", () => {
  it("POSTs credentials to /auth/login and unwraps the success envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          user: { id: 1, username: "member1", roles: ["MEMBER"] },
          expiresAt: "2026-04-18T00:00:00.000Z",
        },
      }),
    );

    const result = await authApi.login({
      username: "member1",
      password: "Member#Pass123",
    });

    const call = lastCall();
    expect(call.url).toMatch(/\/auth\/login$/);
    expect(call.method).toBe("POST");
    expect(call.credentials).toBe("include");
    expect(JSON.parse(String(call.body))).toEqual({
      username: "member1",
      password: "Member#Pass123",
    });
    expect(result.user).toMatchObject({
      id: 1,
      username: "member1",
      roles: ["MEMBER"],
    });
  });

  it("GETs /auth/me and unwraps the session envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          user: { id: 5, username: "admin1", roles: ["ADMINISTRATOR"] },
          expiresAt: "2026-04-18T00:00:00.000Z",
        },
      }),
    );

    const me = await authApi.me();

    expect(lastCall().url).toMatch(/\/auth\/me$/);
    expect(me.user.roles).toContain("ADMINISTRATOR");
  });

  it("POSTs to /auth/logout and tolerates a 204 no-content response", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));

    await authApi.logout();

    const call = lastCall();
    expect(call.url).toMatch(/\/auth\/logout$/);
    expect(call.method).toBe("POST");
  });

  it("surfaces a 401 INVALID_CREDENTIALS envelope as a thrown error with the status", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: {
            message: "Invalid username or password.",
            code: "INVALID_CREDENTIALS",
          },
        },
        401,
      ),
    );

    await expect(
      authApi.login({ username: "member1", password: "wrong" }),
    ).rejects.toThrowError(/Your session has expired|Invalid username or password/);
  });
});

// --- orderApi -------------------------------------------------------------

describe("orderApi", () => {
  it("POSTs /orders/quote with the exact payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { grandTotal: 12.96 },
      }),
    );

    const payload = {
      cycleId: 1,
      pickupPointId: 2,
      pickupWindowId: 3,
      taxJurisdictionCode: "US-IL-SPRINGFIELD",
      items: [{ listingId: 4, quantity: 2 }],
    };
    const quote = await orderApi.quote(payload);

    const call = lastCall();
    expect(call.url).toMatch(/\/orders\/quote$/);
    expect(call.method).toBe("POST");
    expect(JSON.parse(String(call.body))).toEqual(payload);
    expect((quote as { grandTotal: number }).grandTotal).toBe(12.96);
  });

  it("POSTs /orders/checkout and returns the CONFIRMED envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { orderId: 42, status: "CONFIRMED" },
      }),
    );

    const result = await orderApi.checkout({
      cycleId: 1,
      pickupPointId: 2,
      pickupWindowId: 3,
      taxJurisdictionCode: "US-IL-SPRINGFIELD",
      items: [{ listingId: 4, quantity: 1 }],
    });

    expect(lastCall().url).toMatch(/\/orders\/checkout$/);
    expect(lastCall().method).toBe("POST");
    expect((result as { orderId: number }).orderId).toBe(42);
  });

  it("GETs /orders/:id with the numeric id in the URL", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 42, status: "CONFIRMED" } }),
    );

    const detail = await orderApi.getOrder(42);

    expect(lastCall().url).toMatch(/\/orders\/42$/);
    expect((detail as { id: number }).id).toBe(42);
  });

  it("GETs /finance/ledger for the ledger rows", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: [{ id: 1 }, { id: 2 }] }),
    );

    const rows = await orderApi.getLedger();

    expect(lastCall().url).toMatch(/\/finance\/ledger$/);
    // The wrapper's declared return type is {data: LedgerRow[]} but the
    // client unwraps success envelopes so we observe the inner array.
    expect(Array.isArray(rows)).toBe(true);
  });
});

// --- leaderApi ------------------------------------------------------------

describe("leaderApi", () => {
  it("POSTs to /leaders/applications with the application payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { id: 12, status: "PENDING", userId: 22 },
      }),
    );

    const result = await leaderApi.createApplication({
      fullName: "Candidate",
      phone: "555-0100",
      experienceSummary: "More than twenty characters to satisfy the rule.",
      requestedCommissionEligible: true,
    });

    const call = lastCall();
    expect(call.url).toMatch(/\/leaders\/applications$/);
    expect(call.method).toBe("POST");
    expect(JSON.parse(String(call.body))).toMatchObject({
      fullName: "Candidate",
      requestedCommissionEligible: true,
    });
    expect((result as { status: string }).status).toBe("PENDING");
  });

  it("GETs /leaders/applications/me", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 12, status: "PENDING" } }),
    );

    await leaderApi.getMyApplication();

    expect(lastCall().url).toMatch(/\/leaders\/applications\/me$/);
    expect(lastCall().method).toBe("GET");
  });

  it("GETs the admin pending list", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: [{ id: 12 }] }),
    );

    await leaderApi.getPendingApplications();

    expect(lastCall().url).toMatch(/\/admin\/leaders\/applications\/pending$/);
  });

  it("POSTs to the decision endpoint with the application id in the URL", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { leaderApplicationId: 12, decision: "APPROVED" },
      }),
    );

    await leaderApi.decideApplication(12, {
      decision: "APPROVE",
      reason: "Credentials verified.",
      commissionEligible: true,
    });

    const call = lastCall();
    expect(call.url).toMatch(/\/admin\/leaders\/applications\/12\/decision$/);
    expect(call.method).toBe("POST");
    expect(JSON.parse(String(call.body))).toEqual({
      decision: "APPROVE",
      reason: "Credentials verified.",
      commissionEligible: true,
    });
  });
});

// --- appealApi ------------------------------------------------------------

describe("appealApi", () => {
  it("lists appeals with page, pageSize and optional status filter on the query string", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { page: 1, pageSize: 20, total: 0, data: [] },
      }),
    );

    await appealApi.listAppeals({ page: 2, pageSize: 10, status: "INTAKE" });

    const { url } = lastCall();
    expect(url).toMatch(/\/appeals\?/);
    expect(url).toMatch(/page=2/);
    expect(url).toMatch(/pageSize=10/);
    expect(url).toMatch(/status=INTAKE/);
  });

  it("POSTs to /appeals with the create payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 77 } }),
    );

    const result = await appealApi.createAppeal({
      sourceType: "ORDER_DETAIL",
      sourceOrderId: 1,
      reasonCategory: "ORDER_ISSUE",
      narrative: "Investigation requested for this real seeded order case.",
    });

    const call = lastCall();
    expect(call.url).toMatch(/\/appeals$/);
    expect(call.method).toBe("POST");
    expect(JSON.parse(String(call.body))).toMatchObject({
      sourceType: "ORDER_DETAIL",
      sourceOrderId: 1,
      reasonCategory: "ORDER_ISSUE",
    });
    expect((result as { id: number }).id).toBe(77);
  });

  it("POSTs file upload body to /appeals/:id/files", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { files: [{ id: 1, originalFileName: "x.pdf" }] },
      }),
    );

    await appealApi.uploadFiles(7, [
      { fileName: "x.pdf", mimeType: "application/pdf", base64Content: "AAAA" },
    ]);

    const call = lastCall();
    expect(call.url).toMatch(/\/appeals\/7\/files$/);
    expect(call.method).toBe("POST");
    const parsed = JSON.parse(String(call.body));
    expect(parsed.files[0].mimeType).toBe("application/pdf");
  });
});

// --- auditApi -------------------------------------------------------------

describe("auditApi", () => {
  it("searches audit logs and forwards filter params as querystring", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { page: 1, pageSize: 20, total: 3, data: [] },
      }),
    );

    await auditApi.searchLogs({
      page: 1,
      pageSize: 20,
      actorUserId: 9,
      resourceType: "LEADER_APPLICATION",
      action: "APPROVAL",
      from: "2026-01-01",
      to: "2026-12-31",
    });

    const { url } = lastCall();
    expect(url).toMatch(/\/audit\/logs\?/);
    expect(url).toMatch(/page=1/);
    expect(url).toMatch(/actorUserId=9/);
    expect(url).toMatch(/resourceType=LEADER_APPLICATION/);
    expect(url).toMatch(/action=APPROVAL/);
    expect(url).toMatch(/from=2026-01-01/);
    expect(url).toMatch(/to=2026-12-31/);
  });

  it("GETs /audit/logs/verify-chain and returns the chain verification result", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { total: 12, valid: true, failures: [] },
      }),
    );

    const result = await auditApi.verifyChain();

    expect(lastCall().url).toMatch(/\/audit\/logs\/verify-chain$/);
    expect(result).toMatchObject({ total: 12, valid: true, failures: [] });
  });
});

// --- commerceApi ----------------------------------------------------------

describe("commerceApi", () => {
  it("GETs /buying-cycles/active with paging + sort params", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { data: [], page: 1, pageSize: 10, total: 0 },
      }),
    );

    await commerceApi.getActiveCycles({
      page: 1,
      pageSize: 10,
      sortBy: "startsAt",
      sortDir: "desc",
    });

    const { url } = lastCall();
    expect(url).toMatch(/\/buying-cycles\/active\?/);
    expect(url).toMatch(/sortBy=startsAt/);
    expect(url).toMatch(/sortDir=desc/);
  });

  it("GETs /listings and only includes search when non-empty", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { data: [], page: 1, pageSize: 10, total: 0 },
      }),
    );

    await commerceApi.getListings({
      cycleId: 1,
      page: 1,
      pageSize: 10,
      sortBy: "price",
      sortDir: "asc",
    });

    let url = lastCall().url;
    expect(url).toMatch(/\/listings\?/);
    expect(url).toMatch(/cycleId=1/);
    expect(url).not.toMatch(/search=/);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { data: [], page: 1, pageSize: 10, total: 0 },
      }),
    );
    await commerceApi.getListings({
      cycleId: 1,
      page: 1,
      pageSize: 10,
      sortBy: "price",
      sortDir: "asc",
      search: "kale",
    });
    url = lastCall().url;
    expect(url).toMatch(/search=kale/);
  });

  it("GETs /pickup-points/:id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 5, name: "Point" } }),
    );

    await commerceApi.getPickupPoint(5);

    expect(lastCall().url).toMatch(/\/pickup-points\/5$/);
  });

  it("POSTs to /favorites/toggle with the target payload", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { isFavorite: true } }),
    );

    await commerceApi.toggleFavorite({ type: "PICKUP_POINT", targetId: 5 });

    const call = lastCall();
    expect(call.url).toMatch(/\/favorites\/toggle$/);
    expect(call.method).toBe("POST");
    expect(JSON.parse(String(call.body))).toEqual({
      type: "PICKUP_POINT",
      targetId: 5,
    });
  });
});

// --- discussionApi --------------------------------------------------------

describe("discussionApi", () => {
  it("GETs /threads/resolve with contextType + contextId query", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { discussionId: 99, contextType: "LISTING", contextId: 1 },
      }),
    );

    await discussionApi.resolveThread({ contextType: "LISTING", contextId: 1 });

    const { url } = lastCall();
    expect(url).toMatch(/\/threads\/resolve\?/);
    expect(url).toMatch(/contextType=LISTING/);
    expect(url).toMatch(/contextId=1/);
  });

  it("POSTs to /comments with the comment body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { discussionId: 99, commentId: 7 },
      }),
    );

    await discussionApi.createComment({
      contextType: "LISTING",
      contextId: 1,
      body: "Looks great",
    });

    const call = lastCall();
    expect(call.url).toMatch(/\/comments$/);
    expect(call.method).toBe("POST");
    expect(JSON.parse(String(call.body))).toMatchObject({
      contextType: "LISTING",
      contextId: 1,
      body: "Looks great",
    });
  });

  it("GETs /threads/:id/comments with page + sort", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { discussionId: 99, total: 0, comments: [] },
      }),
    );

    await discussionApi.getThreadComments({
      discussionId: 99,
      page: 2,
      sort: "most_replies",
    });

    const { url } = lastCall();
    expect(url).toMatch(/\/threads\/99\/comments\?/);
    expect(url).toMatch(/page=2/);
    expect(url).toMatch(/sort=most_replies/);
  });
});
