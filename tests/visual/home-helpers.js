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
/**
 * Await `catalogReady.onAllReady` when the build exposes
 * `globalThis.__LPC_waitCatalogAllReady` (see `sources/state/catalog.ts`).
 * Otherwise, if `__LPC_arePaletteModalMetadataChunksReady` exists, wait until it is true
 * (so palette / skintone modals are not opened while the UI still says “Loading layer data…”).
 * Legacy dists without those hooks: only then fall back to “#mithril-filters” un-spinner.
 */
export async function waitForCatalogAllReady(page) {
  /* Playwright: options are the 3rd arg; the 2nd is passed to the page function. */
  await page.waitForFunction(
    () => {
      if (typeof globalThis.__LPC_waitCatalogAllReady === "function") {
        return true;
      }
      const el = document.getElementById("mithril-filters");
      if (!el || el.classList.contains("loading")) {
        return false;
      }
      if (
        typeof globalThis.__LPC_arePaletteModalMetadataChunksReady ===
        "function"
      ) {
        return globalThis.__LPC_arePaletteModalMetadataChunksReady();
      }
      return true;
    },
    undefined,
    { timeout: 120_000 },
  );
  if (
    await page.evaluate(
      () => typeof globalThis.__LPC_waitCatalogAllReady === "function",
    )
  ) {
    await page.evaluate(() => globalThis.__LPC_waitCatalogAllReady());
  }
}

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
  await waitForCatalogAllReady(page);
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
    undefined,
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
 * Predicate for `page.waitForFunction` (executes in the browser).
 * True when the palette modal exists, has at least one variant canvas, and each canvas’s
 * top-left sample has some non-transparent pixels (async draws have finished).
 * @returns {boolean}
 */
function paletteModalPreviewCanvasesHaveOpaquePixels() {
  const modal = document.querySelector(".palette-modal");
  if (!modal) {
    return false;
  }
  const canvases = modal.querySelectorAll("canvas.variant-canvas");
  if (canvases.length === 0) {
    return false;
  }
  for (const c of canvases) {
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx || c.width < 1 || c.height < 1) {
      return false;
    }
    const w = Math.min(32, c.width);
    const h = Math.min(32, c.height);
    const d = ctx.getImageData(0, 0, w, h).data;
    let hasOpaque = false;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] !== 0) {
        hasOpaque = true;
        break;
      }
    }
    if (!hasOpaque) {
      return false;
    }
  }
  return true;
}

/**
 * Expands Head → Heads → Human Heads → Human Male, then opens the Skintone palette modal.
 * (The top-level "Head" row must be expanded before "Heads" is visible.)
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ forComputedStyleDump?: boolean }} [opts] Use `forComputedStyleDump: true` for
 * `dump-computed-styles` only: keep Argos/strict waits for `data-previews-ready` and canvas
 * pixels, but do not require them for style text (stale dist / GPU can leave them unset forever).
 */
export async function openHumanMaleSkintonePalette(page, opts = {}) {
  const { forComputedStyleDump = false } = opts;
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
  if (forComputedStyleDump) {
    try {
      await page
        .locator('.palette-modal[data-previews-ready="true"]')
        .waitFor({ state: "visible", timeout: 45_000 });
    } catch {
      /* Modal is open; enough for getComputedStyle on palette chrome if previews stall. */
    }
  } else {
    await page
      .locator('.palette-modal[data-previews-ready="true"]')
      .waitFor({ state: "visible", timeout: 120_000 });
  }
  if (!forComputedStyleDump) {
    /* Counter + data attribute can settle before GPU/canvas pixels are visible; sample alpha. */
    await page.waitForFunction(
      paletteModalPreviewCanvasesHaveOpaquePixels,
      undefined,
      { timeout: 120_000 },
    );
  } else {
    try {
      await page.waitForFunction(
        paletteModalPreviewCanvasesHaveOpaquePixels,
        undefined,
        { timeout: 20_000 },
      );
    } catch {
      /* best-effort for dumps */
    }
  }
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
