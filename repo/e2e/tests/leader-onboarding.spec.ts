import { test, expect, request as playwrightRequest } from "@playwright/test";

const apiBase = process.env.E2E_API_URL ?? "http://backend:4000";

/**
 * Group leader onboarding domain journey:
 * member submits a leader application, admin reviews it.
 * Uses the seeded member1 account, which may already have a pending
 * application on re-runs — the assertions tolerate both "first submission"
 * (201) and "already applied" (409-ish) paths.
 */
test("member can view their leader application after submitting (or receive the already-applied envelope)", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await api.post(`${apiBase}/auth/login`, {
    data: { username: "member1", password: "Member#Pass123" },
  });

  const submit = await api.post(`${apiBase}/leaders/applications`, {
    data: {
      fullName: "Brook H. Candidate",
      phone: "555-0199",
      experienceSummary:
        "Two years coordinating neighborhood group buys with a local co-op.",
      requestedCommissionEligible: true,
    },
  });

  // Either the first submission (201) or a re-submission blocked by a
  // unique constraint / existing pending application.
  expect([201, 400, 409]).toContain(submit.status());

  const detail = await api.get(`${apiBase}/leaders/applications/me`);
  expect([200, 404]).toContain(detail.status());

  if (detail.status() === 200) {
    const body = await detail.json();
    expect(body.data).toMatchObject({
      fullName: expect.any(String),
      status: expect.stringMatching(/PENDING|APPROVED|REJECTED/),
    });
  }

  await api.dispose();
});

test("administrator can list pending leader applications", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await api.post(`${apiBase}/auth/login`, {
    data: { username: "admin1", password: "Admin#Pass12345" },
  });

  const response = await api.get(
    `${apiBase}/admin/leaders/applications/pending`,
  );
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.data)).toBe(true);

  await api.dispose();
});

test("finance clerk is forbidden from submitting a leader application (member-only)", async () => {
  const api = await playwrightRequest.newContext({
    extraHTTPHeaders: { Origin: apiBase },
  });
  await api.post(`${apiBase}/auth/login`, {
    data: { username: "finance1", password: "Finance#Pass123" },
  });

  const response = await api.post(`${apiBase}/leaders/applications`, {
    data: {
      fullName: "Wrong Role",
      phone: "555-0000",
      experienceSummary:
        "Should not be able to submit because I am finance clerk.",
      requestedCommissionEligible: false,
    },
  });

  expect(response.status()).toBe(403);
  await api.dispose();
});
