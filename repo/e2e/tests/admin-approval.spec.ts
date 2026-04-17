import { test, expect } from "@playwright/test";

const loginAs = async (
  page: import("@playwright/test").Page,
  username: string,
  password: string,
) => {
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log ?in/i }).click();
};

test("administrator signs in and reaches the admin home", async ({ page }) => {
  await loginAs(page, "admin1", "Admin#Pass12345");
  await expect(page).toHaveURL(/\/home\/administrator/);
  await expect(
    page.getByText(/administrator|pending|applications|commission/i).first(),
  ).toBeVisible({ timeout: 15_000 });
});

test("finance clerk signs in and reaches the finance clerk home", async ({
  page,
}) => {
  await loginAs(page, "finance1", "Finance#Pass123");
  await expect(page).toHaveURL(/\/home\/finance-clerk/);
  await expect(
    page.getByText(/commission|reconciliation|withdrawal|finance/i).first(),
  ).toBeVisible({ timeout: 15_000 });
});

test("reviewer signs in and reaches the reviewer home", async ({ page }) => {
  await loginAs(page, "reviewer1", "Reviewer#Pass123");
  await expect(page).toHaveURL(/\/home\/reviewer/);
});

test("group leader signs in and reaches the group leader home", async ({
  page,
}) => {
  await loginAs(page, "leader1", "Leader#Pass123");
  await expect(page).toHaveURL(/\/home\/group-leader/);
});
