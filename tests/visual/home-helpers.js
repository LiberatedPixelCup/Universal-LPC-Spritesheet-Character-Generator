/**
 * Reset window and internal scroll regions so full-page captures align across viewports.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function scrollVisualCaptureToTop(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelectorAll(".scrollable-container").forEach((el) => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });
  });
}

/**
 * Shared homepage navigation + readiness wait for visual tests and tooling scripts.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [baseUrl] Defaults to PLAYWRIGHT_TEST_BASE_URL or http://127.0.0.1:4173
 */
export async function gotoHomepageReady(
  page,
  baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:4173",
) {
  const normalized = `${baseUrl.replace(/\/$/, "")}/`;
  await page.goto(normalized, { waitUntil: "load" });
  try {
    await page.waitForLoadState("networkidle", { timeout: 45_000 });
  } catch {
    // Some environments never reach idle (long-polling, etc.); continue.
  }
  await page.waitForSelector("#mithril-preview canvas", {
    state: "visible",
    timeout: 120_000,
  });
  await page.waitForFunction(
    () => {
      const preview = document.getElementById("mithril-preview");
      const sheet = document.getElementById("mithril-spritesheet-preview");
      if (!preview || !sheet) {
        return false;
      }
      return (
        !preview.querySelector(".loading") && !sheet.querySelector(".loading")
      );
    },
    { timeout: 120_000 },
  );
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve(undefined);
          });
        });
      }),
  );
  await scrollVisualCaptureToTop(page);
}

/**
 * Expands Head → Heads → Human Heads → Human Male, then opens the Skintone palette modal.
 * (The top-level "Head" row must be expanded before "Heads" is visible.)
 *
 * @param {import('@playwright/test').Page} page
 */
export async function openHumanMaleSkintonePalette(page) {
  const tree = page.locator("#chooser-column");
  const clickTreeLabel = async (exact) => {
    const row = tree.locator("div.tree-label").filter({
      has: page.getByText(exact, { exact: true }),
    });
    row.first().evaluate((el) => (el.style.scrollMarginTop = "-12px"));
    await row.first().scrollIntoViewIfNeeded();
    await row.first().click();
  };

  await clickTreeLabel("Head");
  await clickTreeLabel("Heads");
  await clickTreeLabel("Human Heads");
  await clickTreeLabel("Human Male");

  const skintone = tree
    .locator(".palette-recolor-item label")
    .filter({ hasText: /^Skintone$/ });
  skintone.evaluate((el) => (el.style.scrollMarginTop = "-12px"));
  await skintone.scrollIntoViewIfNeeded();
  await skintone.click();

  await page.locator(".palette-modal").waitFor({ state: "visible" });
  /* Last click leaves the pointer over the tree; :hover adds white-ter on variant tiles and * differs by viewport. Move off so Argos + computed-style dumps match across breakpoints. */
  await page.mouse.move(0, 0);
}

/**
 * Closes the skintone / palette modal if it is open (overlay click).
 *
 * @param {import('@playwright/test').Page} page
 */
export async function closeSkintonePaletteModal(page) {
  const overlay = page.locator(".palette-modal-overlay");
  await overlay.click({ position: { x: 2, y: 2 } });
  await page.locator(".palette-modal").waitFor({ state: "hidden" });
}

/**
 * Expands License Filters, Animation Filters, and Advanced Tools, then sets the
 * asset search query to "arm" (tree filters client-side; waits for a visible match).
 *
 * @param {import('@playwright/test').Page} page
 */
export async function openLicenseAnimationAdvancedAndSearchArm(page) {
  const licenseCol = page.locator("div.filters-column").first();
  const licenseTreeLabel = licenseCol.locator("div.tree-label").first();
  licenseTreeLabel.evaluate((el) => (el.style.scrollMarginTop = "-12px"));
  await licenseTreeLabel.scrollIntoViewIfNeeded();
  await licenseTreeLabel.click();

  const animCol = page.locator("div.filters-column").nth(1);
  const animTreeLabel = animCol.locator("div.tree-label").first();
  animTreeLabel.evaluate((el) => (el.style.scrollMarginTop = "-12px"));
  await animTreeLabel.scrollIntoViewIfNeeded();
  await animTreeLabel.click();

  const advancedHeader = page.locator(".collapsible-header").filter({
    has: page.getByRole("heading", { name: "Advanced Tools", exact: true }),
  });
  advancedHeader.evaluate((el) => (el.style.scrollMarginTop = "-12px"));
  await advancedHeader.scrollIntoViewIfNeeded();
  await advancedHeader.click();
  await page.locator("#customFileInput").waitFor({ state: "visible" });

  const search = page.locator("input[type=search][placeholder=Search]");
  search.evaluate((el) => (el.style.scrollMarginTop = "-12px"));
  await search.scrollIntoViewIfNeeded();
  await search.fill("arm");
  await page
    .locator("#chooser-column .search-result")
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });

  await page.mouse.move(0, 0);
}
