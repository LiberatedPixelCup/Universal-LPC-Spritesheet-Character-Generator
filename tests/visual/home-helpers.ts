/**
 * Reset window and internal scroll regions so full-page captures align across viewports.
 */
import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __LPC_waitCatalogIndexReady?: () => Promise<void>;
    __LPC_waitCatalogLiteReady?: () => Promise<void>;
    __LPC_waitCatalogAllReady?: () => Promise<void>;
    __LPC_arePaletteModalMetadataChunksReady?: () => boolean;
  }
}

export async function scrollVisualCaptureToTop(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelectorAll(".scrollable-container").forEach((el) => {
      if (el instanceof HTMLElement) {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }
    });
  });
}

/**
 * Shared homepage navigation + readiness wait for visual tests and tooling scripts.
 *
 * Await catalog readiness when the build exposes
 * `globalThis.__LPC_waitCatalogAllReady` (see `sources/state/catalog.ts`).
 * Otherwise, if `__LPC_arePaletteModalMetadataChunksReady` exists, wait until it is true
 * (so palette / skintone modals are not opened while the UI still says “Loading layer data…”).
 * Legacy dists without those hooks: only then fall back to “#mithril-filters”
 * no longer showing the first-paint loading shell (or the older root spinner).
 */
export async function waitForCatalogAllReady(page: Page): Promise<void> {
  /* Playwright: options are the 3rd arg; the 2nd is passed to the page function. */
  await page.waitForFunction(
    () => {
      if (typeof window.__LPC_waitCatalogAllReady === "function") {
        return true;
      }
      const el = document.getElementById("mithril-filters");
      if (
        !el ||
        el.classList.contains("loading") ||
        el.querySelector(".loading-shell-filters")
      ) {
        return false;
      }
      if (
        typeof window.__LPC_arePaletteModalMetadataChunksReady === "function"
      ) {
        return window.__LPC_arePaletteModalMetadataChunksReady();
      }
      return true;
    },
    undefined,
    { timeout: 120_000 },
  );
  if (
    await page.evaluate(
      () => typeof window.__LPC_waitCatalogAllReady === "function",
    )
  ) {
    await page.evaluate(() => window.__LPC_waitCatalogAllReady?.());
  }
}

/** Catalog + preview canvases ready. Call after `page.goto` (any query/hash). */
export async function waitForHomepageReady(page: Page): Promise<void> {
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

export async function gotoHomepageReady(
  page: Page,
  baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:4173",
): Promise<void> {
  const normalized = `${baseUrl.replace(/\/$/, "")}/`;
  await page.goto(normalized, { waitUntil: "load" });
  await waitForHomepageReady(page);
}

/**
 * Predicate for `page.waitForFunction` (executes in the browser).
 * True when the palette modal exists, has at least one variant canvas, and each canvas’s
 * top-left sample has some non-transparent pixels (async draws have finished).
 */
function paletteModalPreviewCanvasesHaveOpaquePixels(): boolean {
  const modal = document.querySelector(".palette-modal");
  if (!modal) {
    return false;
  }
  const canvases = modal.querySelectorAll("canvas.variant-canvas");
  if (canvases.length === 0) {
    return false;
  }
  for (const node of canvases) {
    if (!(node instanceof HTMLCanvasElement)) {
      return false;
    }
    const ctx = node.getContext("2d", { willReadFrequently: true });
    if (!ctx || node.width < 1 || node.height < 1) {
      return false;
    }
    const w = Math.min(32, node.width);
    const h = Math.min(32, node.height);
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
 * Use `forComputedStyleDump: true` for `dump-computed-styles` only: keep Argos/strict
 * waits for `data-previews-ready` and canvas pixels, but do not require them for style
 * text (stale dist / GPU can leave them unset forever).
 */
export async function openHumanMaleSkintonePalette(
  page: Page,
  opts: { forComputedStyleDump?: boolean } = {},
): Promise<void> {
  const { forComputedStyleDump = false } = opts;
  const tree = page.locator("#chooser-column");
  const clickTreeLabel = async (exact: string) => {
    const row = tree.locator(".tree-label").filter({
      has: page.getByText(exact, { exact: true }),
    });
    await row.first().evaluate((el) => (el.style.scrollMarginTop = "12px"));
    await row.first().scrollIntoViewIfNeeded();
    await row.first().click();
  };

  await clickTreeLabel("Head");
  await clickTreeLabel("Heads");
  await clickTreeLabel("Human Heads");
  await clickTreeLabel("Human Male");

  const skintone = tree
    .locator(".palette-recolor-item")
    .filter({ hasText: /Skintone/ });
  await skintone.first().evaluate((el) => (el.style.scrollMarginTop = "12px"));
  await skintone.first().scrollIntoViewIfNeeded();
  await skintone.first().click();

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
 * Closes the skintone / palette modal if it is open (backdrop click outside dialog bounds).
 */
export async function closeSkintonePaletteModal(page: Page): Promise<void> {
  const modal = page.locator(".palette-modal");
  const box = await modal.boundingBox();
  if (box) {
    const clickX = box.x > 6 ? Math.max(2, box.x - 4) : 2;
    const clickY = box.y > 6 ? Math.max(2, box.y - 4) : 2;
    await page.mouse.click(clickX, clickY);
  } else {
    await page.keyboard.press("Escape");
  }
  await modal.waitFor({ state: "hidden" });
}

/**
 * Expands License Filters, Animation Filters, and Advanced Tools, then sets the
 * asset search query to "arm" (tree filters client-side; waits for a visible match).
 */
export async function openLicenseAnimationAdvancedAndSearchArm(
  page: Page,
): Promise<void> {
  const licenseCol = page.locator("div.filters-column").first();
  const licenseTreeLabel = licenseCol.locator(".tree-label").first();
  await licenseTreeLabel.evaluate((el) => (el.style.scrollMarginTop = "12px"));
  await licenseTreeLabel.scrollIntoViewIfNeeded();
  await licenseTreeLabel.click();

  const animCol = page.locator("div.filters-column").nth(1);
  const animTreeLabel = animCol.locator(".tree-label").first();
  await animTreeLabel.evaluate((el) => (el.style.scrollMarginTop = "12px"));
  await animTreeLabel.scrollIntoViewIfNeeded();
  await animTreeLabel.click();

  const advancedHeader = page
    .locator("h3.collapsible-title")
    .filter({ hasText: "Advanced Tools" })
    .locator("button.collapsible-header");
  await advancedHeader.evaluate((el) => (el.style.scrollMarginTop = "12px"));
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
