import { test } from "node:test";
import assert from "node:assert/strict";
import { getSpritesheetsPlugin } from "../../../../vite/get-spritesheets-plugin.ts";
import { vitePluginBundledCssAfterBulma } from "../../../../vite/vite-plugin-bundled-css-after-bulma.ts";
import type { IndexHtmlTransformContext } from "vite";

function bundledCssHtmlTransform() {
  const transform = vitePluginBundledCssAfterBulma().transformIndexHtml;
  if (!transform || typeof transform === "function") {
    throw new Error("expected object transformIndexHtml");
  }
  return transform;
}

function applyBundledCss(html: string): string {
  const handler = bundledCssHtmlTransform().handler as (
    inputHtml: string,
    ctx: IndexHtmlTransformContext,
  ) => string;
  return handler(html, {} as IndexHtmlTransformContext);
}

/**
 * @param {NodeJS.Platform} platform
 * @param {() => void} fn
 */
function withPlatform(platform: NodeJS.Platform, fn: () => void) {
  const original = process.platform;
  Object.defineProperty(process, "platform", {
    configurable: true,
    enumerable: true,
    value: platform,
  });
  try {
    fn();
  } finally {
    Object.defineProperty(process, "platform", {
      configurable: true,
      enumerable: true,
      value: original,
    });
  }
}

test("getSpritesheetsPlugin(serve) uses dynamic public directory plugin", () => {
  const plugin = getSpritesheetsPlugin("serve");
  assert.equal(plugin.name, "dynamic assets");
});

test("getSpritesheetsPlugin(build) on non-Windows uses vite-plugin-run", () => {
  withPlatform("darwin", () => {
    const plugin = getSpritesheetsPlugin("build");
    assert.equal(plugin.name, "vite:plugin:run");
    assert.equal(typeof plugin.configResolved, "function");
    assert.equal(typeof plugin.handleHotUpdate, "function");
  });
});

test("getSpritesheetsPlugin(build) on Windows uses robocopy closeBundle plugin", () => {
  withPlatform("win32", () => {
    const plugin = getSpritesheetsPlugin("build");
    assert.equal(plugin.name, "copy-spritesheets-robocopy");
    assert.equal(plugin.apply, "build");
    assert.equal(typeof plugin.closeBundle, "function");
  });
});

test("vitePluginBundledCssAfterBulma exposes post-order transformIndexHtml", () => {
  const plugin = vitePluginBundledCssAfterBulma();
  const transform = bundledCssHtmlTransform();
  assert.equal(plugin.name, "bundled-css-after-bulma");
  assert.equal(transform.order, "post");
  assert.equal(typeof transform.handler, "function");
});

test("vitePluginBundledCssAfterBulma leaves HTML unchanged when no hashed asset stylesheet", () => {
  const html = `<!doctype html><html><head>
<link rel="stylesheet" href="./node_modules/bulma/css/bulma.min.css">
</head><body></body></html>`;
  assert.equal(applyBundledCss(html), html);
});

test("vitePluginBundledCssAfterBulma leaves HTML unchanged when bundled CSS but no Bulma link", () => {
  const html = `<!doctype html><html><head>
<link rel="stylesheet" href="./assets/main-abc.css">
</head><body></body></html>`;
  assert.equal(applyBundledCss(html), html);
});

test("vitePluginBundledCssAfterBulma skips remote asset stylesheet URLs", () => {
  const html = `<!doctype html><html><head>
<link rel="stylesheet" href="https://example.com/assets/main-abc.css">
<link rel="stylesheet" href="./node_modules/bulma/css/bulma.min.css">
</head><body></body></html>`;
  assert.equal(applyBundledCss(html), html);
});

test("vitePluginBundledCssAfterBulma moves local hashed bundle CSS immediately after Bulma", () => {
  const html = `<!doctype html><html><head>
<link rel="stylesheet" href="./assets/main-CHT-X2QB.css">
<link rel="stylesheet" href="./node_modules/bulma/css/bulma.min.css">
</head><body></body></html>`;
  const out = applyBundledCss(html);
  assert.match(out, /bulma\.min\.css/);
  assert.match(out, /main-CHT-X2QB\.css/);
  const bulmaIdx = out.indexOf("bulma.min.css");
  const mainIdx = out.indexOf("main-CHT-X2QB.css");
  assert.ok(bulmaIdx !== -1 && mainIdx !== -1);
  assert.ok(
    mainIdx > bulmaIdx,
    "bundled asset link should follow the Bulma link in document order",
  );
  assert.equal((out.match(/main-CHT-X2QB\.css/g) ?? []).length, 1);
});

test("vitePluginBundledCssAfterBulma supports /assets/ href (no leading dot)", () => {
  const html = `<head>
<link rel="stylesheet" href="/assets/main-xyz.css">
<link rel="stylesheet" href="./vendor/bulma.css">
</head>`;
  const out = applyBundledCss(html);
  assert.ok(out.includes("bulma.css"));
  assert.ok(out.includes("main-xyz.css"));
  const bulmaIdx = out.indexOf("bulma.css");
  const mainIdx = out.indexOf("main-xyz.css");
  assert.ok(mainIdx > bulmaIdx);
});
