import { test } from "@playwright/test";
import { argosScreenshot } from "@argos-ci/playwright";
import {
  gotoHomepageReady,
  scrollVisualCaptureToTop,
  openHumanMaleSkintonePalette,
  closeSkintonePaletteModal,
  openLicenseAnimationAdvancedAndSearchArm,
} from "./home-helpers.js";

/** Base URL for the static site (see `webServer` in playwright.config.js). */
const BASE_URL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:5173";

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
  await scrollVisualCaptureToTop(page);
  await argosScreenshot(page, name, ARGOS_SCREENSHOT_OPTIONS);
}

/**
 * Homepage capture → Human Male skintone modal → (close modal) expanded filters +
 * Advanced Tools + search "arm". Order keeps skintone reachable before search narrows the tree.
 */
async function homepageAndSkintonePalette(page, viewport, shotName) {
  await page.setViewportSize(viewport);
  await gotoHomepageReady(page, BASE_URL);
  await argosDesktop(page, shotName);
  await openHumanMaleSkintonePalette(page);
  await argosDesktop(page, `${shotName}-human-male-skintone`);
  await closeSkintonePaletteModal(page);
  await openLicenseAnimationAdvancedAndSearchArm(page);
  await argosDesktop(page, `${shotName}-filters-search-arm`);
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
