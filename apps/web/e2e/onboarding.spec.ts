import { expect, test } from "@playwright/test";

/**
 * A-01/A-03 + K-00b acceptance: start screen → recipe start wizard → Brief mode
 * with a program table and concept blocks.
 */
test("fresh profile opens the start screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("What are you designing?")).toBeVisible();
  await expect(page.getByRole("button", { name: /House/ })).toBeVisible();
});

test("choosing a type opens the start wizard, then the canvas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /House/ }).click();
  await expect(page.getByText("Set up your site")).toBeVisible();
  await page.getByRole("button", { name: "Skip setup" }).click();
  await expect(page.locator("canvas")).toBeVisible();
});

test("skip everything still yields a working project", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Café/ }).click();
  await page.getByRole("button", { name: "Skip setup" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText(/KDB|Footprint/).first()).toBeVisible();
});

test("type-size path reaches the canvas with a plot (Blank)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Blank project/ }).click();
  await page.getByRole("button", { name: "Type size" }).click();
  const inputs = page.locator('input[type="number"]');
  await inputs.nth(0).fill("15");
  await inputs.nth(1).fill("20");
  await page.getByRole("button", { name: "Use this plot" }).click();
  await page.getByRole("button", { name: "Go to the canvas" }).click();
  await expect(page.locator("canvas")).toBeVisible();
});

test("recipe wizard: dormitory defaults produce a program and blocks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Dormitory/ }).click();
  await expect(page.getByText("How big?")).toBeVisible();
  await page.getByRole("button", { name: "Go to the canvas" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  // Brief mode shows the generated program table.
  await expect(page.getByText("Dorm room").first()).toBeVisible();
  await expect(page.getByText("Room requirement")).toBeVisible();
});

test("changing a recipe parameter updates the program", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Dormitory/ }).click();
  const beds = page.locator('input[type="number"]').first();
  await beds.fill("180");
  await page.getByRole("button", { name: "Go to the canvas" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  // 180 beds / 6 per room = 30 rooms.
  await expect(page.getByText("30").first()).toBeVisible();
});

test("area dashboard shows target vs actual per room", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Dormitory/ }).click();
  await page.getByRole("button", { name: "Go to the canvas" }).click();
  // 120 beds / 6 = 20 dorm rooms × 18 m² = 360 m² target, matched by area-true blocks.
  await expect(page.getByText(/360\/360/).first()).toBeVisible();
});

test("Try the sample enters the canvas with the sample project", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Try the sample/ }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Qreasee Corner House")).toBeVisible();
});
