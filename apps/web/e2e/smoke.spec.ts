import { expect, test } from "@playwright/test";

/** Core-loop smoke test (PRD M0/M1 acceptance). Opens via the start screen. */
async function openSample(page: import("@playwright/test").Page) {
  await page.goto("/");
  // Fresh profile: the start screen shows first (A-01).
  const sample = page.getByRole("button", { name: /Try the sample/ });
  if (await sample.isVisible().catch(() => false)) await sample.click();
}

test("loads the sample project and shows live indicators", async ({ page }) => {
  await openSample(page);
  await expect(page).toHaveTitle(/Qreasee/);
  await expect(page.getByText("KDB", { exact: false })).toBeVisible();
  await expect(page.getByText("KLB", { exact: false })).toBeVisible();
});

test("switches lens and opens the decisions panel", async ({ page }) => {
  await openSample(page);
  await page.getByRole("button", { name: /Rules/ }).click();
  await expect(page.getByText("Site & context")).toBeVisible();
  await page.getByTitle("Decisions").click();
  await expect(page.getByText("Massing direction")).toBeVisible();
});
