import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";
import {
  gotoHomepageReady,
  scrollVisualCaptureToTop,
  waitForCatalogAllReady,
  openHumanMaleSkintonePalette,
  closeSkintonePaletteModal,
  openLicenseAnimationAdvancedAndSearchArm,
  waitForHomepageReady,
  waitForPreviewReady,
} from "./home-helpers.ts";

/** Base URL for the static site (see `webServer` in playwright.config.js). */
const BASE_URL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:5173";
const ISSUE_382_FIXTURE = new URL(
  "../fixtures/issue-382/issue-382-selections.json",
  import.meta.url,
);

/**
 * Viewports: mobile, tablet, medium desktop, huge desktop.
 * Heights are chosen so typical layouts have room to scroll if needed.
 */
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  mediumDesktop: { width: 1440, height: 900 },
  hugeDesktop: { width: 2560, height: 1440 },
  mobileLong: { width: 390, height: 844 * 16 },
  tabletLong: { width: 834, height: 1120 * 8 },
  mediumDesktopLong: { width: 1440, height: 900 * 4 },
  hugeDesktopLong: { width: 2560, height: 1440 * 2 },
};

/** Argos stabilization tuned for a JS-heavy page with images and canvas. */
const ARGOS_SCREENSHOT_OPTIONS = {
  stabilize: {
    waitForFonts: true,
    waitForImages: true,
    waitForAriaBusy: true,
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__DISABLE_PREVIEW_ANIMATION__ = true;
  });
});

/**
 * Full-page Argos screenshot. Wraps `argosScreenshot` from `@argos-ci/playwright`.
 * When `ARGOS_TOKEN` is unset, skips capture so `npm run test:visual` can verify
 * navigation and layout without talking to Argos (see CONTRIBUTING.md).
 */
async function argosDesktop(page, name) {
  if (!process.env.ARGOS_TOKEN?.trim()) {
    return;
  }
  await waitForCatalogAllReady(page);
  await scrollVisualCaptureToTop(page);
  await argosScreenshot(page, name, ARGOS_SCREENSHOT_OPTIONS);
}

async function readOutfit(page) {
  const panel = page.locator("#current-selections-section");
  const selections = panel.getByRole("button", {
    name: /^Current Selections ·/,
  });
  await selections.click();
  const layers = panel.locator(".lpc-chip-label");
  await expect(layers.first()).toBeVisible();
  const outfit = {
    hash: new URL(page.url()).hash,
    layers: await layers.allTextContents(),
  };
  await selections.click();
  return outfit;
}

async function verifyDesktopPreview(page, outfit) {
  const modes = page.getByRole("tablist", { name: "Preview modes" });
  await modes.getByRole("tab", { name: "Spritesheet", exact: true }).click();
  await waitForPreviewReady(page, "Spritesheet");
  await expect(page.locator("#mithril-preview canvas")).toHaveCount(0);

  // The checkerboard is painted into the canvas, so turn it off to sample the outfit.
  const grid = page.getByRole("checkbox", { name: "Show transparency grid" });
  const gridWasChecked = await grid.isChecked();
  await grid.uncheck();
  const canvas = page.locator("canvas#spritesheet-preview");
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const pixels = element
          .getContext("2d")
          .getImageData(0, 0, element.width, element.height).data;
        return pixels.some((value, index) => index % 4 === 3 && value !== 0);
      }),
    )
    .toBe(true);
  await grid.setChecked(gridWasChecked);

  await modes.getByRole("tab", { name: "Animation", exact: true }).click();
  await waitForPreviewReady(page, "Animation");
  await expect(page.locator("#mithril-spritesheet-preview canvas")).toHaveCount(
    0,
  );
  expect(await readOutfit(page)).toEqual(outfit);
}

async function verifyCategoryBreakpoint(page, height) {
  const sidebar = page.locator(".lpc-workbench > .lpc-sidebar");
  const drawer = page.locator(".lpc-drawer-backdrop");
  const categories = page.getByRole("button", {
    name: "Toggle Categories Sidebar",
  });
  const headTab = { name: "Head", exact: true };
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  const query = await search.inputValue();

  await page.setViewportSize({ width: 1099, height });
  await expect(sidebar).toBeHidden();
  await categories.click();
  const drawerHead = drawer.getByRole("tab", headTab);
  await expect(drawerHead).toBeVisible();
  await drawerHead.focus();
  await expect(drawerHead).toBeFocused();

  await page.setViewportSize({ width: 1100, height });
  await expect(drawer).toHaveCount(0);
  await expect(sidebar).toBeVisible();
  await expect(categories).toBeFocused();
  const sidebarHead = sidebar.getByRole("tab", headTab);
  await expect(sidebarHead).toHaveAttribute("aria-selected", "true");
  await sidebarHead.click({ trial: true });
  await sidebarHead.focus();
  await page.setViewportSize({ width: 1099, height });
  await expect(sidebar).toHaveCount(0);
  await expect(drawer).toHaveCount(0);
  await expect(categories).toBeFocused();

  await page.setViewportSize({ width: 1100, height });
  await expect(categories).toHaveAttribute("aria-expanded", "true");
  await categories.click();
  await expect(sidebar).toHaveCount(0);
  await page.setViewportSize({ width: 1099, height });
  await categories.click();
  await expect(drawer).toBeVisible();
  await page.setViewportSize({ width: 1100, height });
  await expect(drawer).toHaveCount(0);
  await expect(sidebar).toHaveCount(0);
  await expect(categories).toHaveAttribute("aria-expanded", "false");
  await expect(search).toHaveValue(query);
}

async function verifyFiltersLayout(page, viewport, outfit) {
  const chooser = page.locator("#mithril-filters > .category-tree-panel");
  const tree = chooser.locator(":scope > .lpc-tree-scroll-container");
  const filters = chooser.getByRole("button", { name: "Filters", exact: true });
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  const result = tree.locator(".search-result").first();

  await expect(search).toHaveCount(1);
  await expect
    .poll(() => tree.evaluate((element) => element.clientHeight))
    .toBeGreaterThan(0);
  await result.click({ trial: true });
  await filters.click();
  await expect(search).toHaveValue("arm");
  expect(await readOutfit(page)).toEqual(outfit);

  await page.setViewportSize({ width: 1100, height: 480 });
  await filters.click();
  await chooser.getByRole("button", { name: /^License Filters/ }).click();
  await chooser.getByRole("button", { name: /^Animation Filters/ }).click();
  await chooser
    .getByRole("checkbox", { name: "CC0", exact: true })
    .click({ trial: true });
  await result.click({ trial: true });
  await expect
    .poll(() => chooser.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await filters.click();
  await page.setViewportSize(viewport);
}

async function verifyCategoryScroll(page) {
  const panel = page.locator("#mithril-filters > .category-tree-panel");
  const list = panel.locator(":scope > .lpc-tree-scroll-container");
  const categories = page.getByRole("navigation", {
    name: "Category Navigation",
  });
  const body = categories.getByRole("tab", { name: "Body", exact: true });
  const all = categories.getByRole("tab", { name: "All Items", exact: true });
  const search = panel.getByRole("searchbox", { name: "Search", exact: true });
  const waitForLayout = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  const resizeTo = async (height, width = 1100) => {
    await page.setViewportSize({ width, height });
    await waitForLayout();
  };
  const readScroll = (area) => area.evaluate((element) => element.scrollTop);
  const checkScroll = async (area, position) => {
    await expect.poll(() => readScroll(area)).toBe(position);
    return readScroll(area);
  };
  const scrollTo = async (area, position) => {
    await area.evaluate(async (element, offset) => {
      element.scrollTop = offset;
      // Let the browser deliver the scroll event before changing the viewport.
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    }, position);
    return checkScroll(area, position);
  };
  const selectTab = async (tab) => {
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  };

  for (const height of [480, 481]) {
    await page.setViewportSize({ width: 1100, height });
    if (height === 480) {
      await page.goto(new URL("/?debug=false", BASE_URL).href);
    } else {
      await page.reload();
    }
    await waitForHomepageReady(page);

    const area = height === 480 ? panel : list;
    const inactiveArea = height === 480 ? list : panel;
    const checkActiveScroll = async (position) => {
      const actual = await checkScroll(area, position);
      await expect.poll(() => readScroll(inactiveArea)).toBe(0);
      return actual;
    };
    const scrollActiveTo = async (position) => {
      await scrollTo(area, position);
      return checkActiveScroll(position);
    };
    const select = async (tab, position) => {
      await selectTab(tab);
      return checkActiveScroll(position);
    };

    const initialHash = new URL(page.url()).hash;
    const evidence = { height, area: height === 480 ? "panel" : "list" };
    await expect(body).toHaveAttribute("aria-selected", "true");
    if (height === 480) {
      evidence.firstSwitch = [
        await scrollActiveTo(120),
        await select(all, 0),
        await select(body, 120),
      ];
      await scrollActiveTo(0);
    }
    const outfit = await readOutfit(page);
    expect(outfit.hash).toBe(initialHash);

    await select(all, 0);
    const allItemsScroll = await scrollActiveTo(180);
    const bodyScroll = await select(body, 0);
    await expect(search).toBeInViewport();
    const bodyMaxScroll = await area.evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    );
    const restored = await select(all, 180);
    evidence.categorySwitch = [allItemsScroll, bodyScroll, restored];

    if (height === 480) {
      expect(bodyMaxScroll).toBeLessThan(500);
      evidence.bodyMaxScroll = bodyMaxScroll;
      evidence.shorterCategory = [
        await scrollActiveTo(500),
        await select(body, 0),
        await select(all, 500),
      ];
    }

    expect(await readOutfit(page)).toEqual(outfit);
    await test.info().attach(`Category scroll at ${height} px`, {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
  }

  await test.step("Restore the right category after a resize without reloading", async () => {
    const outfit = await readOutfit(page);
    const fromTall = await scrollTo(list, 180);
    await resizeTo(480);
    await checkScroll(panel, 0);
    await selectTab(body);
    await resizeTo(481);
    const bodyAfterResize = await checkScroll(list, 0);
    await selectTab(all);
    const allAfterResize = await checkScroll(list, 180);

    await resizeTo(480);
    const fromShort = await scrollTo(panel, 240);
    await resizeTo(481);
    const restoredTall = await checkScroll(list, 180);
    await resizeTo(480);
    const restoredShort = await checkScroll(panel, 240);

    expect(await readOutfit(page)).toEqual(outfit);
    await test.info().attach("Category scroll after resize", {
      body: JSON.stringify(
        {
          fromTall,
          bodyAfterResize,
          allAfterResize,
          fromShort,
          restoredTall,
          restoredShort,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });

  await test.step("Preserve desktop offsets across the Categories drawer", async () => {
    const outfit = await readOutfit(page);
    const drawer = page.locator(".lpc-drawer-backdrop");
    const toggle = page.getByRole("button", {
      name: "Toggle Categories Sidebar",
    });
    const evidence = [];
    for (const [height, area, offset] of [
      [481, list, 180],
      [480, panel, 240],
    ]) {
      await resizeTo(height);
      const beforeDrawer = await scrollTo(area, offset);
      await resizeTo(height, 1099);
      await toggle.click();
      await drawer.getByRole("tab", { name: "Body", exact: true }).click();
      await expect(drawer).toHaveCount(0);
      await resizeTo(height);
      await expect(body).toHaveAttribute("aria-selected", "true");
      const bodyAfterDrawer = await checkScroll(area, 0);
      await selectTab(all);
      const allAfterDrawer = await checkScroll(area, offset);
      evidence.push({ height, beforeDrawer, bodyAfterDrawer, allAfterDrawer });
    }
    expect(await readOutfit(page)).toEqual(outfit);
    await test.info().attach("Category scroll after drawer", {
      body: JSON.stringify(evidence),
      contentType: "application/json",
    });
  });

  await test.step("Restore Body after typing, editing, or exiting search", async () => {
    const outfit = await readOutfit(page);
    await selectTab(body);
    const searchResult = list.locator(".search-result").first();
    const startTyping = async (position) => {
      await search.focus();
      await scrollTo(panel, position);
      await page.keyboard.press("a");
      await expect(search).toHaveValue("a");
      await waitForLayout();
    };
    await startTyping(120);
    const afterFirstKey = await readScroll(panel);
    await page.keyboard.type("rm");
    await expect(searchResult).toBeVisible();
    await checkScroll(panel, 0);
    const searchResults = await scrollTo(panel, 240);
    await search.fill("a");
    await expect(searchResult).toHaveCount(0);
    const afterShortening = await checkScroll(panel, 120);
    await page.keyboard.type("rm");
    await expect(searchResult).toBeVisible();
    await checkScroll(panel, 0);
    await scrollTo(panel, 240);
    await search.fill("");
    await expect(body).toHaveAttribute("aria-selected", "true");
    const afterClearing = await checkScroll(panel, 120);

    await startTyping(120);
    await search.fill("");
    await waitForLayout();
    await startTyping(140);
    await page.keyboard.type("rm");
    await expect(searchResult).toBeVisible();
    await search.fill("");
    const afterNewSearch = await checkScroll(panel, 140);
    await scrollTo(panel, 120);

    const searchAndScroll = async () => {
      await search.fill("arm");
      await expect(searchResult).toBeVisible();
      await checkScroll(panel, 0);
      await scrollTo(panel, 240);
    };
    await searchAndScroll();
    await selectTab(all);
    await expect(search).toHaveValue("");
    const allAfterSearch = await checkScroll(panel, 240);
    await selectTab(body);
    const afterSelecting = await checkScroll(panel, 120);

    await searchAndScroll();
    await panel
      .getByRole("button", { name: "Expand Selected", exact: true })
      .click();
    await expect(all).toHaveAttribute("aria-selected", "true");
    await expect(search).toHaveValue("");
    await checkScroll(panel, 240);
    await selectTab(body);
    const afterExpandSelected = await checkScroll(panel, 120);

    const afterDrawerSearch = [];
    for (const clearInDrawer of [true, false]) {
      await startTyping(120);
      await resizeTo(480, 1099);
      await expect(search).toBeFocused();
      await page.keyboard.type("rm");
      await expect(searchResult).toBeVisible();
      if (clearInDrawer) {
        await search.fill("");
        await expect(searchResult).toHaveCount(0);
      }
      await resizeTo(480);
      if (!clearInDrawer) {
        await checkScroll(panel, 0);
        await search.fill("");
      }
      const restored = await checkScroll(panel, 120);
      afterDrawerSearch.push({ clearInDrawer, restored });
    }

    expect(await readOutfit(page)).toEqual(outfit);
    await test.info().attach("Category scroll after search", {
      body: JSON.stringify(
        {
          beforeSearch: 120,
          afterFirstKey,
          searchResults,
          afterShortening,
          afterClearing,
          afterNewSearch,
          allAfterSearch,
          afterSelecting,
          afterExpandSelected,
          afterDrawerSearch,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });

  await test.step("Keep the browsed category offset when leaving a one-character search", async () => {
    await resizeTo(480);
    const outfit = await readOutfit(page);
    const searchResults = list.locator(".search-result");
    const expandSelected = panel.getByRole("button", {
      name: "Expand Selected",
      exact: true,
    });
    const typeOneCharacter = async (area) => {
      await selectTab(body);
      await search.focus();
      await scrollTo(area, 120);
      await page.keyboard.press("a");
      await expect(search).toHaveValue("a");
      await expect(searchResults).toHaveCount(0);
      await waitForLayout();
    };

    await typeOneCharacter(panel);
    const caretScroll = await readScroll(panel);
    expect(caretScroll).toBeLessThan(120);
    await selectTab(all);
    await expect(search).toHaveValue("");
    await selectTab(body);
    const afterCaretScroll = await checkScroll(panel, 120);

    const wheelWhileSearching = async () => {
      await typeOneCharacter(panel);
      const { x, y, width, height } = await panel.boundingBox();
      await page.mouse.move(x + width / 2, y + height * 0.75);
      await page.mouse.wheel(0, 220 - (await readScroll(panel)));
      await checkScroll(panel, 220);
      await waitForLayout();
    };
    await wheelWhileSearching();
    await selectTab(all);
    await expect(search).toHaveValue("");
    await selectTab(body);
    const afterWheelAndSidebar = await checkScroll(panel, 220);

    await wheelWhileSearching();
    await expandSelected.focus();
    await expect(expandSelected).toBeFocused();
    await expect.poll(() => readScroll(panel)).toBeLessThan(220);
    await waitForLayout();
    const focusScroll = await readScroll(panel);
    await page.keyboard.press("Enter");
    await expect(all).toHaveAttribute("aria-selected", "true");
    await expect(search).toHaveValue("");
    await selectTab(body);
    const afterWheelAndFocus = await checkScroll(panel, 220);

    await resizeTo(481);
    const browseWithOneCharacter = async () => {
      await typeOneCharacter(list);
      await scrollTo(list, 220);
    };

    await browseWithOneCharacter();
    await selectTab(all);
    await expect(search).toHaveValue("");
    await selectTab(body);
    const afterSidebar = await checkScroll(list, 220);

    await browseWithOneCharacter();
    await expandSelected.click();
    await expect(all).toHaveAttribute("aria-selected", "true");
    await expect(search).toHaveValue("");
    await selectTab(body);
    const afterExpandSelected = await checkScroll(list, 220);

    await browseWithOneCharacter();
    await selectTab(body);
    await expect(search).toHaveValue("");
    const afterReselecting = await checkScroll(list, 220);

    await browseWithOneCharacter();
    await search.fill("");
    await expect(search).toHaveValue("");
    await selectTab(all);
    await selectTab(body);
    const afterClearingFirst = await checkScroll(list, 220);

    await search.focus();
    await scrollTo(list, 120);
    await search.fill("arm");
    await expect(searchResults.first()).toBeVisible();
    await search.fill("a");
    await expect(searchResults).toHaveCount(0);
    await checkScroll(list, 120);
    await scrollTo(list, 220);
    await selectTab(all);
    await expect(search).toHaveValue("");
    await selectTab(body);
    const afterPreviouslyFiltered = await checkScroll(list, 120);

    const currentOutfit = await readOutfit(page);
    expect(currentOutfit).toEqual(outfit);
    await test.info().attach("Category scroll on one-character search exit", {
      body: JSON.stringify({
        caretScroll,
        afterCaretScroll,
        afterWheelAndSidebar,
        focusScroll,
        afterWheelAndFocus,
        afterSidebar,
        afterExpandSelected,
        afterReselecting,
        afterClearingFirst,
        afterPreviouslyFiltered,
        before: outfit,
        after: currentOutfit,
      }),
      contentType: "application/json",
    });
  });

  await test.step("Recover the browsed offset after clearing Search or resizing the same scroll area", async () => {
    await page.goto(new URL("/?debug=false", BASE_URL).href);
    await waitForHomepageReady(page);
    const outfit = await readOutfit(page);
    const maxScroll = (area) =>
      area.evaluate((element) => element.scrollHeight - element.clientHeight);
    const wheelTo = async (area, position) => {
      const { x, y, width, height } = await area.boundingBox();
      await page.mouse.move(x + width / 2, y + height * 0.75);
      await page.mouse.wheel(0, position - (await readScroll(area)));
      await checkScroll(area, position);
      await waitForLayout();
    };
    const browseWithQuery = async (area) => {
      await selectTab(body);
      await search.focus();
      await scrollTo(area, 120);
      await page.keyboard.press("a");
      await expect(search).toHaveValue("a");
      await waitForLayout();
      await wheelTo(area, 220);
    };

    await resizeTo(480);
    await browseWithQuery(panel);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await expect(search).toHaveValue("");
    await checkScroll(panel, 220);
    await selectTab(all);
    await selectTab(body);
    const afterKeyboardClear = await checkScroll(panel, 220);

    await browseWithQuery(panel);
    await resizeTo(480, 1099);
    await search.fill("");
    await expect(search).toHaveValue("");
    await waitForLayout();
    await resizeTo(480);
    const afterDrawerClear = await checkScroll(panel, 220);

    await resizeTo(481);
    const afterResize = [];
    for (const clearWhileClamped of [false, true]) {
      await browseWithQuery(list);
      await resizeTo(950);
      const maxWhileClamped = await maxScroll(list);
      expect(maxWhileClamped).toBeLessThan(220);
      const clamped = await checkScroll(list, maxWhileClamped);
      if (clearWhileClamped) {
        await search.fill("");
        await expect(search).toHaveValue("");
        await waitForLayout();
      }
      await resizeTo(481);
      const restored = await checkScroll(list, 220);
      afterResize.push({
        clearWhileClamped,
        maxWhileClamped,
        clamped,
        restored,
      });
      if (!clearWhileClamped) {
        await search.fill("");
        await expect(search).toHaveValue("");
        await checkScroll(list, 220);
      }
    }

    await browseWithQuery(list);
    await resizeTo(950);
    const maxBeforeBoundaryWheel = await maxScroll(list);
    expect(maxBeforeBoundaryWheel).toBe(0);
    const box = await list.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 80);
    await waitForLayout();
    await checkScroll(list, 0);
    await search.fill("");
    await expect(search).toHaveValue("");
    await waitForLayout();
    await resizeTo(740);
    const maxWhenPartiallyRestored = await maxScroll(list);
    expect(maxWhenPartiallyRestored).toBeGreaterThan(60);
    expect(maxWhenPartiallyRestored).toBeLessThan(220);
    await checkScroll(list, maxWhenPartiallyRestored);
    await wheelTo(list, 60);
    await resizeTo(481);
    const afterNewScroll = await checkScroll(list, 60);

    const collapseAll = panel.getByRole("button", {
      name: "Collapse All",
      exact: true,
    });
    const bodyGroup = list.getByRole("button", { name: "Body", exact: true });
    const collapsePendingBody = async () => {
      await resizeTo(481);
      await selectTab(body);
      await expect(bodyGroup).toHaveAttribute("aria-expanded", "true");
      await browseWithQuery(list);
      const savedOutfit = await readOutfit(page);
      expect(savedOutfit).toEqual(outfit);
      await resizeTo(950);
      await search.fill("");
      await expect(search).toHaveValue("");
      await waitForLayout();
      await resizeTo(740);
      await expect(search).toHaveValue("");
      const maxBefore = await maxScroll(list);
      expect(maxBefore).toBeGreaterThan(0);
      expect(maxBefore).toBeLessThan(220);
      const before = await checkScroll(list, maxBefore);
      await collapseAll.focus();
      await expect(collapseAll).toBeFocused();
      await waitForLayout();
      await page.keyboard.press("Enter");
      await waitForLayout();
      expect(await maxScroll(list)).toBe(0);
      const afterCollapse = await checkScroll(list, 0);
      await resizeTo(481);
      return { before, afterCollapse, savedOutfit };
    };

    const { before: beforeCollapse, afterCollapse: collapsed } =
      await collapsePendingBody();
    await selectTab(all);
    await selectTab(body);
    const maxAfterReopening = await maxScroll(list);
    expect(maxAfterReopening).toBeGreaterThanOrEqual(220);
    const afterReopening = await checkScroll(list, 220);
    expect(await readOutfit(page)).toEqual(outfit);

    const {
      before: beforeInPlaceCollapse,
      afterCollapse: collapsedInPlace,
      savedOutfit: outfitBeforeInPlaceReopen,
    } = await collapsePendingBody();
    await expect(body).toHaveAttribute("aria-selected", "true");
    await expect(bodyGroup).toHaveAttribute("aria-expanded", "false");
    await bodyGroup.focus();
    await expect(bodyGroup).toBeFocused();
    const focusedBeforeEnter = await bodyGroup.evaluate(
      (element) => element === document.activeElement,
    );
    await waitForLayout();
    await page.keyboard.press("Enter");
    await expect(bodyGroup).toHaveAttribute("aria-expanded", "true");
    await waitForLayout();
    const maxAfterInPlaceReopen = await maxScroll(list);
    expect(maxAfterInPlaceReopen).toBeGreaterThanOrEqual(220);
    const inPlaceMeasurement = {
      scrollTop: await readScroll(list),
      maxScroll: maxAfterInPlaceReopen,
      viewportHeight: await page.evaluate(() => window.innerHeight),
      bodySelected: await body.getAttribute("aria-selected"),
      ariaExpanded: await bodyGroup.getAttribute("aria-expanded"),
      focusedBeforeEnter,
    };
    await test.info().attach("Body in-place reopen measurement", {
      body: JSON.stringify(inPlaceMeasurement, null, 2),
      contentType: "application/json",
    });
    const afterInPlaceReopen = await checkScroll(list, 220);
    await expect(bodyGroup).toBeFocused();
    const focusedAfterRestore = await bodyGroup.evaluate(
      (element) => element === document.activeElement,
    );
    await expect(body).toHaveAttribute("aria-selected", "true");
    await expect(bodyGroup).toHaveAttribute("aria-expanded", "true");
    expect(await readOutfit(page)).toEqual(outfitBeforeInPlaceReopen);

    await resizeTo(480);
    await scrollTo(panel, 90);
    await resizeTo(481);
    await selectTab(all);
    await scrollTo(list, 40);
    await browseWithQuery(list);
    await resizeTo(950);
    await checkScroll(list, 0);
    await selectTab(all);
    await expect(search).toHaveValue("");
    await resizeTo(481);
    const allItemsOffset = await checkScroll(list, 40);
    await selectTab(body);
    const bodyListOffset = await checkScroll(list, 220);
    await resizeTo(480);
    const bodyPanelOffset = await checkScroll(panel, 90);

    const currentOutfit = await readOutfit(page);
    expect(currentOutfit).toEqual(outfit);
    await test.info().attach("Category scroll after clearing or resizing", {
      body: JSON.stringify({
        afterKeyboardClear,
        afterDrawerClear,
        afterResize,
        maxBeforeBoundaryWheel,
        maxWhenPartiallyRestored,
        afterNewScroll,
        collapseRecovery: {
          beforeCollapse,
          collapsed,
          maxAfterReopening,
          afterReopening,
        },
        inPlaceReopen: {
          beforeCollapse: beforeInPlaceCollapse,
          collapsed: collapsedInPlace,
          ...inPlaceMeasurement,
          afterReopen: afterInPlaceReopen,
          focusedAfterRestore,
        },
        allItemsOffset,
        bodyListOffset,
        bodyPanelOffset,
        before: outfit,
        after: currentOutfit,
      }),
      contentType: "application/json",
    });
  });
}

async function verifyLicenseRemoval(page) {
  const fixture = JSON.parse(readFileSync(ISSUE_382_FIXTURE, "utf8"));
  const url = new URL(BASE_URL);
  url.hash = new URL(fixture.url).hash;
  await page.goto(url.href);
  await waitForHomepageReady(page);
  const outfit = await readOutfit(page);
  expect(outfit.layers).toHaveLength(7);
  expect(outfit.layers).toContain("Natural (violet)");
  const expectedHash = new URLSearchParams(outfit.hash.slice(1));
  expect(expectedHash.has("hair")).toBe(true);
  expectedHash.delete("hair");

  const more = page.getByRole("button", { name: "More options" });
  const credits = page.getByRole("dialog", {
    name: "Character Credits & Attribution",
  });
  const hairCredit = credits
    .locator(".lpc-credit-file")
    .filter({ hasText: /^hair\/natural\// });
  async function openCredits() {
    await more.click();
    await page
      .getByRole("menuitem", { name: "Character Credits…", exact: true })
      .click();
    await expect(credits.locator(".lpc-credit-file").first()).toBeVisible();
  }
  await openCredits();
  await expect(hairCredit.first()).toBeVisible();
  await credits.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("tab", { name: "Spritesheet", exact: true }).click();
  await waitForPreviewReady(page, "Spritesheet");
  await page
    .getByRole("checkbox", { name: "Show transparency grid" })
    .uncheck();
  await page.getByRole("checkbox", { name: "Replace Mask (Pink)" }).uncheck();
  const canvas = page.locator("canvas#spritesheet-preview");
  const pixels = () => canvas.evaluate((element) => element.toDataURL());
  const tree = page.locator(
    "#mithril-filters > .category-tree-panel > .lpc-tree-scroll-container",
  );
  await page
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("Natural");
  const natural = tree.getByRole("button", { name: "Natural", exact: true });
  await expect(natural).toBeVisible();
  if ((await natural.getAttribute("aria-expanded")) !== "true") {
    await natural.click();
  }
  const naturalColor = tree.getByRole("button", {
    name: "Choose color for Natural",
    exact: true,
  });
  await expect(naturalColor).toBeEnabled();
  const previousPixels = await pixels();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const licenseFilters = page.getByRole("button", { name: /^License Filters/ });
  await licenseFilters.click();
  await page.getByRole("checkbox", { name: "CC0", exact: true }).uncheck();
  await expect(licenseFilters).toContainText("(4/5 enabled)");
  await expect(naturalColor).toBeDisabled();
  const remove = page.getByRole("button", {
    name: "Remove 1 Incompatible Asset",
    exact: true,
  });
  await expect(remove).toBeVisible();
  expect(await readOutfit(page)).toEqual(outfit);

  const notification = page.waitForEvent("dialog");
  const removal = remove.click();
  const dialog = await notification;
  const message = dialog.message();
  await dialog.accept();
  await removal;
  expect(message).toBe("Removed 1 incompatible item(s)");
  const remaining = await readOutfit(page);
  expect(remaining.layers).toEqual(
    outfit.layers.filter((layer) => layer !== "Natural (violet)"),
  );
  expect([...new URLSearchParams(remaining.hash.slice(1))]).toEqual([
    ...expectedHash,
  ]);
  await waitForPreviewReady(page, "Spritesheet");
  await expect.poll(pixels).not.toBe(previousPixels);
  await openCredits();
  await expect(hairCredit).toHaveCount(0);
  await credits.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "Export…", exact: true }).click();
  const pngButton = page
    .getByRole("dialog", { name: "Export Spritesheet" })
    .getByRole("button", { name: "Spritesheet (PNG)", exact: true });
  await expect(pngButton).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    pngButton.click(),
  ]);
  const pngPath = test.info().outputPath("character-spritesheet.png");
  await download.saveAs(pngPath);
  const pixelEvidence = await canvas.evaluate(
    async (element, pngBase64) => {
      const previewPng = await new Promise((resolve) =>
        element.toBlob(resolve),
      );
      const exportedPng = new Blob(
        [Uint8Array.from(atob(pngBase64), (byte) => byte.charCodeAt(0))],
        { type: "image/png" },
      );
      const scratch = document.createElement("canvas");
      const context = scratch.getContext("2d");
      const inspect = async (png) => {
        const bitmap = await createImageBitmap(png);
        const { width, height } = bitmap;
        scratch.width = width;
        scratch.height = height;
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        const { data } = context.getImageData(0, 0, width, height);
        const digest = await crypto.subtle.digest("SHA-256", data);
        const rgbaSha256 = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
        return { width, height, rgbaSha256 };
      };
      return {
        preview: await inspect(previewPng),
        exported: await inspect(exportedPng),
      };
    },
    readFileSync(pngPath, "base64"),
  );
  expect(pixelEvidence.exported).toEqual(pixelEvidence.preview);
  await test.info().attach("CC0 removal and PNG pixels", {
    body: JSON.stringify({
      before: outfit,
      after: remaining,
      ...pixelEvidence,
    }),
    contentType: "application/json",
  });
  await test.info().attach("Exported spritesheet", {
    path: pngPath,
    contentType: "image/png",
  });
}

/** Skintone must be opened before search narrows the tree. */
async function homepageAndSkintonePalette(
  page,
  viewport,
  shotName,
  verifyDesktop = false,
) {
  await page.setViewportSize(viewport);
  await test.step("Wait for catalog and Animation preview", async () => {
    await gotoHomepageReady(page, BASE_URL);
  });
  await argosDesktop(page, shotName);
  const outfit = verifyDesktop ? await readOutfit(page) : undefined;
  if (outfit) {
    await test.step("Switch preview tabs and retain the current outfit", async () => {
      await verifyDesktopPreview(page, outfit);
    });
  }
  await test.step("Choose Head and open the Skintone palette", async () => {
    await openHumanMaleSkintonePalette(page);
  });
  await argosDesktop(page, `${shotName}-human-male-skintone`);
  await closeSkintonePaletteModal(page);
  await test.step("Find arm items and open filters and Advanced Tools", async () => {
    await openLicenseAnimationAdvancedAndSearchArm(page);
  });
  await argosDesktop(page, `${shotName}-filters-search-arm`);

  if (outfit) {
    await page.getByRole("button", { name: "Close Advanced Tools" }).click();
    await test.step("Keep results usable with Filters open", async () => {
      await verifyFiltersLayout(page, viewport, outfit);
    });
    await test.step("Verify Categories at 1099 px and 1100 px", async () => {
      await verifyCategoryBreakpoint(page, viewport.height);
      expect(await readOutfit(page)).toEqual(outfit);
    });
    await test.step("Restore category scroll positions at 480 px and 481 px", async () => {
      await verifyCategoryScroll(page);
    });
    await test.step("Remove the incompatible CC0 layer and verify issue-382 goes from 7 to 6 layers", async () => {
      await page.setViewportSize(viewport);
      await verifyLicenseRemoval(page);
    });
    await test.step("Accept an explicitly empty outfit", async () => {
      await page.goto(new URL("/?debug=false#sex=male", BASE_URL).href);
      await waitForHomepageReady(page);
      await expect(
        page.getByRole("button", {
          name: "Current Selections · 0",
          exact: true,
        }),
      ).toBeVisible();
      expect(new URL(page.url()).hash).toBe("#sex=male");
    });
  }
}

test.describe("Homepage — full page", () => {
  test("mobile viewport", async ({ page }) => {
    await homepageAndSkintonePalette(page, VIEWPORTS.mobile, "index-mobile");
  });

  test("tablet viewport", async ({ page }) => {
    await homepageAndSkintonePalette(page, VIEWPORTS.tablet, "index-tablet");
  });

  test("medium desktop viewport", async ({ page }) => {
    await homepageAndSkintonePalette(
      page,
      VIEWPORTS.mediumDesktop,
      "index-medium-desktop",
      true,
    );
  });

  test("huge desktop viewport", async ({ page }) => {
    await homepageAndSkintonePalette(
      page,
      VIEWPORTS.hugeDesktop,
      "index-huge-desktop",
    );
  });

  test("mobile long viewport", async ({ page }) => {
    await homepageAndSkintonePalette(
      page,
      VIEWPORTS.mobileLong,
      "index-mobile-long",
    );
  });

  test("tablet long viewport", async ({ page }) => {
    await homepageAndSkintonePalette(
      page,
      VIEWPORTS.tabletLong,
      "index-tablet-long",
    );
  });

  test("medium desktop long viewport", async ({ page }) => {
    await homepageAndSkintonePalette(
      page,
      VIEWPORTS.mediumDesktopLong,
      "index-medium-desktop-long",
    );
  });

  test("huge desktop long viewport", async ({ page }) => {
    await homepageAndSkintonePalette(
      page,
      VIEWPORTS.hugeDesktopLong,
      "index-huge-desktop-long",
    );
  });
});
