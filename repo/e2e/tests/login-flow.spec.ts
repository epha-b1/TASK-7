import { test, expect } from "@playwright/test";

/**
 * Real fullstack login flow: Vue frontend -> Express backend -> MySQL.
 * Uses the seeded member1 account from backend/src/db/seed.ts.
 */
test("member can log in and the app navigates to the member home", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(page.getByRole("button", { name: /sign in|log ?in/i })).toBeVisible();
  await page.getByLabel(/username/i).fill("member1");
  await page.getByLabel(/password/i).fill("Member#Pass123");
  await page.getByRole("button", { name: /sign in|log ?in/i }).click();

  await expect(page).toHaveURL(/\/home\/member/);
  await expect(
    page
      .getByText(/cycle|listing|pickup|member/i)
      .first(),
  ).toBeVisible({ timeout: 15_000 });
});

test("unauthenticated user hitting /admin/withdrawal-blacklist is sent to /login", async ({
  page,
}) => {
  await page.goto("/admin/withdrawal-blacklist");
  await expect(page).toHaveURL(/\/login/);
});

test("member role is forbidden from the administrator home", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel(/username/i).fill("member1");
  await page.getByLabel(/password/i).fill("Member#Pass123");
  await page.getByRole("button", { name: /sign in|log ?in/i }).click();
  await expect(page).toHaveURL(/\/home\/member/);

  await page.goto("/home/administrator");
  await expect(page).toHaveURL(/\/forbidden/);
});
