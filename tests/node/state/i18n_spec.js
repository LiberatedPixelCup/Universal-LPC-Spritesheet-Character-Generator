import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateSources } from "../../../scripts/generate_sources.js";
import {
  categoryTree,
  itemMetadata,
} from "../../../scripts/generateSources/state.js";
import {
  getCategoryDisplayName,
  getItemDisplayName,
  getPaletteColorDisplayName,
  getPaletteMaterialDisplayName,
  getPaletteVersionDisplayName,
  getRecolorLabelDisplayName,
  getSelectionDisplayName,
  getVariantDisplayName,
  loadTranslations,
  setLanguage,
} from "../../../lang/i18n.ts";

function collectCategoryDisplaySources(node, pathParts = [], out = []) {
  for (const [name, child] of Object.entries(node.children ?? {})) {
    const displaySource =
      child.label ?? name.charAt(0).toUpperCase() + name.slice(1);
    out.push({ path: [...pathParts, name].join("/"), displaySource });
    collectCategoryDisplaySources(child, [...pathParts, name], out);
  }
  return out;
}

test("category display names match existing underscore translation keys", () => {
  loadTranslations("test-category-normalization", {
    "category.furry_ears": "毛茸茸的耳朵",
  });
  setLanguage("test-category-normalization");

  assert.equal(getCategoryDisplayName("Furry Ears"), "毛茸茸的耳朵");
});

test("item display names tolerate metadata capitalization drift", () => {
  loadTranslations("test-item-case", {
    "item.Body color (light)": "身体颜色（浅色）",
  });
  setLanguage("test-item-case");

  assert.equal(getItemDisplayName("Body Color (light)"), "身体颜色（浅色）");
});

test("all generated category tree labels have Chinese translations", () => {
  const zhTranslations = JSON.parse(fs.readFileSync("lang/zh.json", "utf8"));
  loadTranslations("test-category-coverage", zhTranslations);
  setLanguage("test-category-coverage");
  generateSources({ writeCredits: false, writeMetadata: false });

  const missing = collectCategoryDisplaySources(categoryTree)
    .filter(
      ({ displaySource }) =>
        getCategoryDisplayName(displaySource) === displaySource,
    )
    .map(({ path, displaySource }) => `${path}: ${displaySource}`);

  assert.deepEqual(missing, []);
});

test("dynamic display helpers localize recolor labels, palette labels, and variants", () => {
  loadTranslations("test-dynamic-display", {
    "recolor.Eye Color": "眼睛颜色",
    "paletteMaterial.Skintone": "肤色",
    "paletteVersion.Universal LPC": "通用 LPC",
    "variant.light": "浅色",
    "variant.bluegray": "蓝灰色",
    "variantToken.kite": "风筝盾",
    "variantToken.blue": "蓝色",
    "variantToken.gray": "灰色",
  });
  setLanguage("test-dynamic-display");

  assert.equal(getRecolorLabelDisplayName("Eye Color"), "眼睛颜色");
  assert.equal(getPaletteMaterialDisplayName("Skintone"), "肤色");
  assert.equal(getPaletteVersionDisplayName("Universal LPC"), "通用 LPC");
  assert.equal(getVariantDisplayName("light"), "浅色");
  assert.equal(getPaletteColorDisplayName("bluegray"), "蓝灰色");
  assert.equal(getVariantDisplayName("kite blue gray"), "风筝盾蓝色灰色");
});

test("selection display names localize base item and variant parts without changing stored raw names", () => {
  loadTranslations("test-selection-display", {
    "item.Body Color": "身体颜色",
    "item.Human Male": "人类男性",
    "recolor.Eye Color": "眼睛颜色",
    "variant.light": "浅色",
    "variant.bluegray": "蓝灰色",
  });
  setLanguage("test-selection-display");

  assert.equal(
    getSelectionDisplayName("Body Color (light)"),
    "身体颜色（浅色）",
  );
  assert.equal(
    getSelectionDisplayName("Human Male (light | bluegray)"),
    "人类男性（浅色 | 蓝灰色）",
  );
  assert.equal(
    getSelectionDisplayName("Eye Color (bluegray)"),
    "眼睛颜色（蓝灰色）",
  );
});

test("all generated recolor labels and item variants have Chinese display names", () => {
  const zhTranslations = JSON.parse(fs.readFileSync("lang/zh.json", "utf8"));
  loadTranslations("test-dynamic-coverage", zhTranslations);
  setLanguage("test-dynamic-coverage");
  generateSources({ writeCredits: false, writeMetadata: false });
  const missingRecolorLabels = new Set();
  const missingVariants = new Set();

  for (const meta of Object.values(itemMetadata)) {
    for (const recolor of meta.recolors ?? []) {
      if (
        recolor.label &&
        getRecolorLabelDisplayName(recolor.label) === recolor.label
      ) {
        missingRecolorLabels.add(recolor.label);
      }
    }
    for (const variant of meta.variants ?? []) {
      const fallback = variant
        .replaceAll("_", " ")
        .replace(/^./, (c) => c.toUpperCase());
      if (getVariantDisplayName(variant) === fallback) {
        missingVariants.add(variant);
      }
    }
  }

  assert.deepEqual([...missingRecolorLabels].sort(), []);
  assert.deepEqual([...missingVariants].sort(), []);
});
