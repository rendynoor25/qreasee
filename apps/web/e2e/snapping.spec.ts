import { expect, test } from "@playwright/test";

/**
 * LG-03 regression: the marker must appear only when the cursor is near a real
 * snap point. Before this fix a marker was drawn on whatever plane the pointer
 * hit, so hovering a plain face showed a bogus snap circle (bug 1).
 *
 * Run:  pnpm --filter @qreasee/web exec playwright install   (once)
 *       pnpm --filter @qreasee/web e2e
 */
async function openSample(page: import("@playwright/test").Page) {
  await page.goto("/?debugSnap=1");
  const sample = page.getByRole("button", { name: /Try the sample/ });
  if (await sample.isVisible().catch(() => false)) await sample.click();
  await page.waitForFunction(() => Boolean((window as unknown as { __qreaseeSnap?: unknown }).__qreaseeSnap), null, {
    timeout: 15_000,
  });
}

test("no snap marker when the cursor is not near a real snap point", async ({ page }) => {
  await openSample(page);
  const canvas = page.locator("[data-qreasee-viewport] canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Sample several screen positions: whenever nothing snaps, there must be no
  // marker (this is the invariant the old code violated).
  const probes: Array<[number, number]> = [
    [0.06, 0.06],
    [0.94, 0.06],
    [0.06, 0.94],
    [0.94, 0.94],
    [0.5, 0.5],
  ];
  for (const [fx, fy] of probes) {
    await page.mouse.move(box!.x + box!.width * fx, box!.y + box!.height * fy);
    await page.waitForTimeout(70);
    const snap = await page.evaluate(
      () => (window as unknown as { __qreaseeSnap: { kind: string | null; markers: number } }).__qreaseeSnap,
    );
    if (!snap.kind) expect(snap.markers).toBe(0);
  }
});
