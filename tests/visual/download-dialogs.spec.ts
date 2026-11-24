import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoHomepageReady } from "./home-helpers.ts";

const BASE_URL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:5173";

async function expectModalKeyboardNavigation(
  page: Page,
  dialog: Locator,
  closeButton: Locator,
): Promise<void> {
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);

  // Some browsers briefly focus their own chrome at the ends of a dialog.
  // The focus may leave the document there, but must never reach app controls.
  const focusedOutsideDialog = () =>
    dialog.evaluate((element) => {
      const { activeElement, body } = element.ownerDocument;
      return activeElement !== body && !element.contains(activeElement);
    });

  await closeButton.focus();
  await page.keyboard.press("Shift+Tab");
  expect(await focusedOutsideDialog()).toBe(false);
  await dialog.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Tab");
  expect(await focusedOutsideDialog()).toBe(false);
}

test("keeps focus in download dialogs and restores the correct trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoHomepageReady(page, BASE_URL);
  const exportButton = page.getByRole("button", {
    name: "Export…",
    exact: true,
  });
  const moreButton = page.getByRole("button", { name: "More options" });
  const exportDialog = page.getByRole("dialog", { name: "Export Spritesheet" });
  const creditsDialog = page.getByRole("dialog", {
    name: "Character Credits & Attribution",
  });

  await exportButton.press("Enter");
  await expectModalKeyboardNavigation(
    page,
    exportDialog,
    exportDialog.getByRole("button", { name: "Close export dialog" }),
  );
  await page.keyboard.press("Escape");
  await expect(exportDialog).toBeHidden();
  await expect(exportButton).toBeFocused();

  await moreButton.press("Enter");
  await page
    .getByRole("menuitem", { name: "Character Credits…" })
    .press("Enter");
  await expectModalKeyboardNavigation(
    page,
    creditsDialog,
    creditsDialog.getByRole("button", { name: "Close credits dialog" }),
  );
  await page.keyboard.press("Escape");
  await expect(creditsDialog).toBeHidden();
  await expect(moreButton).toBeFocused();

  await page.setViewportSize({ width: 390, height: 440 });
  await exportButton.click();
  const body = exportDialog.locator(".lpc-modal-body");
  expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await body.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await page.mouse.click(4, 4);
  await expect(exportDialog).toBeHidden();
  await expect(exportButton).toBeFocused();
});
