/**
 * Shared computed-style dump config + helpers for dump-computed-styles.mjs
 * and computed-style-diff-all.mjs.
 */

import { chromium } from "playwright";
import {
  gotoHomepageReady,
  openHumanMaleSkintonePalette,
  closeSkintonePaletteModal,
  openLicenseAnimationAdvancedAndSearchArm,
} from "../../tests/visual/home-helpers.js";

/**
 * Computed-style dump “pages” — same sequence as tests/visual/home.spec.js / Argos:
 * homepage → human-male-skintone → (close modal) filters-search-arm.
 */
export const COMPUTED_STYLE_DUMP_PAGES = [
  "homepage",
  "human-male-skintone",
  "filters-search-arm",
];

/** Same dimensions as tests/visual/home.spec.js (Argos). */
export const VIEWPORT_PRESETS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  mediumDesktop: { width: 1440, height: 900 },
  hugeDesktop: { width: 2560, height: 1440 },
  mobileLong: { width: 390, height: 844 * 16 },
  tabletLong: { width: 834, height: 1120 * 8 },
  mediumDesktopLong: { width: 1440, height: 900 * 4 },
  hugeDesktopLong: { width: 2560, height: 1440 * 2 },
};

export const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

/**
 * Properties (hyphenated) for getComputedStyle — layout, flex, typography, borders, transforms.
 * Includes `font` shorthand plus rasterization / width signals (text-rendering,
 * -webkit-font-smoothing, font-stretch, word-spacing, font-feature-settings, etc.).
 */
export const COMPUTED_STYLE_PROPS = [
  "align-items",
  "align-self",
  "background-color",
  "border-bottom-color",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-bottom-style",
  "border-bottom-width",
  "border-color",
  "border-left-color",
  "border-left-width",
  "border-radius",
  "border-right-color",
  "border-right-width",
  "border-top-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-top-style",
  "border-top-width",
  "box-shadow",
  "box-sizing",
  "bottom",
  "color",
  "column-gap",
  "display",
  "flex-basis",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "font",
  "font-family",
  "font-feature-settings",
  "font-optical-sizing",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-variant",
  "font-variation-settings",
  "font-weight",
  "gap",
  "height",
  "justify-content",
  "left",
  "letter-spacing",
  "line-height",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "opacity",
  "outline-color",
  "outline-style",
  "outline-width",
  "overflow-x",
  "overflow-y",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "position",
  "right",
  "row-gap",
  "text-align",
  "text-decoration",
  "text-decoration-line",
  "text-rendering",
  "text-size-adjust",
  "top",
  "transform",
  "vertical-align",
  "visibility",
  "white-space",
  "width",
  "word-spacing",
  "-moz-osx-font-smoothing",
  "-webkit-font-smoothing",
  "z-index",
];

/**
 * Label + selector (first match). Order: page shell → columns → mithril mount → download → filters
 * (License/Animation header rows, etc.) → category tree → credits (stacked file blocks) → advanced →
 * preview → palette modal (after openHumanMaleSkintonePalette in dumpComputedStylesForUrl).
 *
 * Optional per target:
 * - `omitProps`: skip listed properties for noisy or deliberate parity cases only. Avoid omitting
 *   `gap` / `align-items` on `.buttons` / `.tags` — Argos will still show diffs when those differ.
 * - `omitDumpLines`: omit `__box` / `__offset` for subpixel noise.
 * - `includeRect`: append `__rect: left,top` (rounded px), or with `rectPrecision: "fine"` append
 *   `left,top,bottom` (2 dp) so sub-pixel vertical shifts Argos sees are not lost to Math.round.
 * - `includeClientRects`: append `__client_rects` from `getClientRects()` (line boxes; use on inline
 *   count spans when wrap differs but parent has fixed height).
 * - `includeContentBounds`: append `__content_rect` from `Range.selectNodeContents(el)` bounding rect —
 *   painted text extent inside filter `.tree-label` even when `height:32px` makes `__box` lie.
 * - `includeOverflowLayout`: append `__layout: clientH,scrollH,offsetH` (px). Use on block containers
 *   (e.g. filter `.tree-label`): when scrollH > clientH, fixed height is clipping wrapped header text.
 * - `includeWrapRowMetrics`: append `__wrap_row` (resolved height, min-height, clientH, scrollH, rectH).
 *   License/Animation filter `.tree-label`: without `height:auto` + `min-height:32px` override, wrapped
 *   count text yields scrollH>clientH and rectH~32px; with the fix, values match expanded flow (branch
 *   vs master diffs until both ship the same CSS).
 * - Selectors use `querySelectorAll`: every matching node is dumped. When there are 2+ matches,
 *   each block is titled `=== label <selector> [i/N] ===`; a single match keeps the original
 *   `=== label <selector> ===` header (stable diffs for unique nodes).
 *
 * Dump options (passed to `collectComputedStyleDump` / `dumpComputedStylesForUrl`):
 * - `fontDiagnostics` (default true): append FontFace registry + canvas `measureText` probes using
 *   each element’s resolved `font` string — surfaces real width/clarity differences when CSS strings
 *   match but rasterization or loaded faces differ.
 *
 * Argos `home.spec.js` captures three states per viewport: homepage, Human Male → skintone modal,
 * then filters expanded + search "arm". `dumpComputedStylesForUrl` defaults to `page: human-male-skintone`;
 * use `page: homepage` or CLI `--no-skintone-modal` for the first capture; `page: filters-search-arm`
 * for the third (matches `openLicenseAnimationAdvancedAndSearchArm` in home-helpers.js).
 *
 * Each dump starts with `__viewport_context`: `innerWidth` / `#chooser-column` width. A manual
 * screenshot with docked DevTools uses a **narrower** content width than headless 390×844, so wrap
 * and vertical stack can differ from the dump even when both ports are “mobile”.
 *
 * Trailing metrics (before font diagnostics):
 * - `__filter_license_to_animation_gap`: Animation nested card top minus License nested card bottom.
 * - `__filter_license_header_to_checkbox_block_gap` / `__filter_animation_header_to_checkbox_block_gap`:
 *   vertical gap from each card’s `.tree-label` to the expanded `.content` block (checkbox list);
 *   sensitive to margin between filter headers and checkboxes (Bulma 1 vs 0.9 regressions).
 */
export const COMPUTED_STYLE_TARGETS = [
  { label: "html", selector: "html" },
  { label: "body", selector: "body" },
  { label: "header section", selector: "#header-left" },
  { label: "h1.title", selector: "h1.title" },
  { label: "header subtitle", selector: "#header-left span.subtitle" },
  {
    label: "header title row (flex wrapper)",
    selector: "#header-left > div.is-flex",
  },
  { label: "columns container", selector: "#columns-container" },
  { label: "chooser column", selector: "#chooser-column" },
  {
    label: "mithril-filters mount root",
    selector: "#mithril-filters",
  },
  {
    label: "mithril-filters app stack (Download+Filters+Credits+Advanced wrapper)",
    selector: "#mithril-filters > div",
    includeRect: true,
  },
  {
    label: "preview column",
    selector: "#preview-column",
    /* Mobile: total column height can differ by ~2px from Bulma 1 vs 0.9 preview stack. */
    omitProps: ["height"],
    omitDumpLines: ["__box", "__offset"],
  },
  {
    label: "download buttons container",
    selector: "#download-buttons",
    includeRect: true,
  },
  {
    label: "download buttons (each .button)",
    selector: "#download-buttons .button",
  },
  { label: "download primary button", selector: "#download-buttons .button.is-primary" },
  {
    label: "download first is-info button",
    selector: "#download-buttons .button.is-info",
  },
  {
    label: "download first is-link button",
    selector: "#download-buttons .button.is-link",
  },
  {
    label: "download first button element (nth-of-type)",
    selector: "#download-buttons button:nth-of-type(1)",
  },
  {
    label: "download collapsible header",
    selector: "#mithril-filters > div > .box:nth-child(1) .collapsible-header",
  },
  {
    label: "download collapsible inner (.collapsible-content)",
    selector: "#mithril-filters > div > .box:nth-child(1) .collapsible-content",
  },
  {
    label: "download section collapsible title (h3)",
    selector:
      "#mithril-filters > div > .box:nth-child(1) .collapsible-header h3.collapsible-title",
  },
  {
    label: "chooser download collapsible box",
    selector: "#mithril-filters > div > .box:nth-child(1)",
    includeRect: true,
  },
  {
    label: "chooser filters collapsible box",
    selector: "#mithril-filters > div > .box:nth-child(2)",
  },
  {
    label: "filters collapsible inner (.collapsible-content)",
    selector: "#mithril-filters > div > .box:nth-child(2) .collapsible-content",
  },
  {
    label: "filters collapsible header (Filters title row)",
    selector: "#mithril-filters > div > .box:nth-child(2) .collapsible-header",
  },
  {
    label: "filters Search wrapper (first .mb-4)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .mb-4:nth-child(1)",
    includeRect: true,
  },
  {
    label: "filters Search field (.field in first .mb-4)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .mb-4:nth-child(1) .field",
  },
  {
    label: "filters license+animation columns row",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline",
    includeRect: true,
    rectPrecision: "fine",
  },
  {
    label: "filters license column (.filters-column first)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(1)",
    includeRect: true,
    rectPrecision: "fine",
  },
  {
    label: "filters animation column (.filters-column second)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(2)",
    includeRect: true,
    rectPrecision: "fine",
  },
  {
    label: "filters LicenseFilters nested box (.box.mb-4.has-background-light)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(1) > .box.mb-4.has-background-light",
    includeRect: true,
    rectPrecision: "fine",
    includeContentBounds: true,
  },
  {
    label: "filters AnimationFilters nested box",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(2) > .box.mb-4.has-background-light",
    includeRect: true,
    rectPrecision: "fine",
  },
  {
    label:
      "filters LicenseFilters header .tree-label (wrap row; __wrap_row when count line wraps)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(1) > .box.mb-4.has-background-light > .tree-label",
    includeRect: true,
    rectPrecision: "fine",
    includeOverflowLayout: true,
    includeContentBounds: true,
    includeWrapRowMetrics: true,
  },
  {
    label: "filters LicenseFilters header .tree-arrow",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(1) > .box.mb-4.has-background-light > .tree-label > .tree-arrow",
    includeRect: true,
  },
  {
    label: "filters LicenseFilters header title (.title.is-6.is-inline)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(1) > .box.mb-4.has-background-light > .tree-label > .title.is-6.is-inline",
    includeRect: true,
  },
  {
    label:
      "filters LicenseFilters header count span.is-size-7.has-text-grey.ml-2 (5/5 enabled wrap)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(1) > .box.mb-4.has-background-light > .tree-label > span.is-size-7.has-text-grey.ml-2",
    includeRect: true,
    rectPrecision: "fine",
    includeClientRects: true,
  },
  {
    label:
      "filters AnimationFilters header .tree-label (wrap row; __wrap_row mirrors License card)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(2) > .box.mb-4.has-background-light > .tree-label",
    includeRect: true,
    rectPrecision: "fine",
    includeOverflowLayout: true,
    includeContentBounds: true,
    includeWrapRowMetrics: true,
  },
  {
    label: "filters AnimationFilters header .tree-arrow",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(2) > .box.mb-4.has-background-light > .tree-label > .tree-arrow",
    includeRect: true,
  },
  {
    label: "filters AnimationFilters header title (.title.is-inline.is-6)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(2) > .box.mb-4.has-background-light > .tree-label > .title.is-inline.is-6",
    includeRect: true,
  },
  {
    label: "filters AnimationFilters header count (.is-size-7.has-text-grey)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(2) > .box.mb-4.has-background-light > .tree-label > span.is-size-7.has-text-grey.ml-2",
    includeRect: true,
  },
  {
    label: "filters CurrentSelections wrapper (.mb-4 after columns)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .mb-4:nth-child(3)",
    includeRect: true,
    rectPrecision: "fine",
  },
  {
    label: "filters CurrentSelections h3 title",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .mb-4:nth-child(3) h3.title.is-5",
    includeRect: true,
    rectPrecision: "fine",
  },
  {
    label: "filters CurrentSelections .tags",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .mb-4:nth-child(3) .tags",
    includeRect: true,
    rectPrecision: "fine",
  },
  {
    label: "filters CurrentSelections first .tag.is-medium",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .mb-4:nth-child(3) .tags .tag.is-medium",
    includeRect: true,
  },
  {
    label: "filters CurrentSelections .tags delete button",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .mb-4:nth-child(3) .tags button.delete",
  },
  {
    label: "filters CategoryTree outer box",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .box.has-background-light",
    includeRect: true,
  },
  {
    label: "CategoryTree Available Items toolbar .buttons.mb-0",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .box.has-background-light > div:nth-child(1) .buttons.mb-0",
    /* Flex row subpixel width / offset differs Bulma 1 vs 0.9; align-items parity is what we care about. */
    omitProps: ["width"],
    omitDumpLines: ["__box", "__offset"],
  },
  {
    label: "CategoryTree header row (Available Items + buttons)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .box.has-background-light > div:nth-child(1)",
    includeRect: true,
  },
  {
    label: "CategoryTree match-body checkbox row",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .box.has-background-light > div:nth-child(2)",
  },
  {
    label: "CategoryTree Body Type .buttons row",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .box.has-background-light > div:nth-child(3) > div.mb-3 .buttons",
    includeRect: true,
  },
  {
    label: "CategoryTree Body Type expanded body-type buttons (div.ml-4.mt-2)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .box.has-background-light div.ml-4.mt-2",
  },
  {
    label: "body type first primary button (Body Type row)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .box.has-background-light div.buttons.ml-4 .button.is-primary",
  },
  {
    label: "match body color checkbox input",
    selector: "#match-body-color-checkbox",
  },
  {
    label: "CategoryTree first .tree-node (scoped under filters)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content .tree-node",
  },
  {
    label: "CategoryTree tree wrapper (body + categories)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .box.has-background-light > div:nth-child(3)",
    omitProps: ["margin-top", "height"],
    omitDumpLines: ["__box", "__offset"],
  },
  {
    label: "CategoryTree Available Items title (h3)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .box.has-background-light h3.title.is-5",
    /* Flex row subpixel width differs Bulma 1 vs 0.9.4; title + buttons still align visually. */
    omitProps: ["width"],
    omitDumpLines: ["__box"],
  },
  {
    label: "CategoryTree first .tree-label (Body Type)",
    selector:
      "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .box.has-background-light .tree-label",
  },
  {
    label: "chooser credits collapsible box",
    selector: "#credits-section",
    includeRect: true,
  },
  {
    label: "credits collapsible header",
    selector: "#credits-section .collapsible-header",
  },
  {
    label: "credits collapsible title (h3)",
    selector: "#credits-section .collapsible-header h3.collapsible-title",
  },
  {
    label: "credits collapsible inner (.collapsible-content)",
    selector: "#credits-section .collapsible-content",
  },
  {
    label: "credits intro paragraph mb-3",
    selector: "#credits-section p.is-size-7.mb-3",
  },
  {
    label: "credits intro paragraph mb-2 (first)",
    selector: "#credits-section p.is-size-7.mb-2",
  },
  {
    label: "credits download buttons row",
    selector: "#credits-section .buttons.mt-3",
  },
  {
    label: "credits file list .content block",
    selector: "#credits-section .content.has-background-light",
    includeRect: true,
  },
  {
    label: "credits file list stacked file block (.mb-3 rows)",
    selector:
      "#credits-section .collapsible-content .content.has-background-light > .mb-3",
    includeRect: true,
  },
  {
    label: "credits file list .content filename",
    selector: "#credits-section .content strong.is-size-6",
  },
  {
    label: "credits file list .content detail",
    selector: "#credits-section .content p.is-size-7",
  },
  {
    label: "chooser advanced tools box",
    selector: "#mithril-filters > div > .box:nth-child(4)",
  },
  {
    label: "advanced tools collapsible header",
    selector: "#mithril-filters > div > .box:nth-child(4) .collapsible-header",
  },
  {
    label: "advanced tools collapsible inner (.collapsible-content)",
    selector: "#mithril-filters > div > .box:nth-child(4) .collapsible-content",
  },
  {
    label: "advanced tools z-position field",
    selector: "#mithril-filters > div > .box:nth-child(4) .collapsible-content .field",
  },
  {
    label: "advanced tools z-position input",
    selector: "#mithril-filters > div > .box:nth-child(4) .collapsible-content .control > input",
  },
  {
    label: "advanced tools help text",
    selector: "#mithril-filters > div > .box:nth-child(4) .collapsible-content .help",
  },
  {
    label: "filters panel inner box (first nested .box in filters)",
    selector: "#mithril-filters .filters-column .box",
  },
  { label: "filters search input", selector: "#mithril-filters input.input" },
  { label: "filters select control", selector: "#mithril-filters .select select" },
  { label: "filters tag example", selector: "#mithril-filters .tag" },
  { label: "filters label", selector: "#mithril-filters .label" },
  { label: "body type button", selector: "#mithril-filters .buttons .button" },
  { label: "tree label (first)", selector: ".tree-label" },
  { label: "variant display name (first)", selector: ".variant-display-name" },
  {
    label: "CategoryTree .variant-item (link-light / selected)",
    selector:
      "#mithril-filters .box.has-background-light .variant-item.has-background-link-light",
  },
  {
    label: "CategoryTree .variant-item (not link-light)",
    selector:
      "#mithril-filters .box.has-background-light .variant-item:not(.has-background-link-light)",
    /* Bulma 0.9 vs 1: white-ter / hover resolves to rgb vs rgba on different tiles; link-light is checked above. */
    omitProps: ["background-color"],
  },
  {
    label: "CategoryTree .search-result row (first; filters-search-arm / search)",
    selector: "#chooser-column .search-result",
    includeRect: true,
    rectPrecision: "fine",
  },
  {
    label: "filters search input [type=search]",
    selector: "#mithril-filters input[type=search]",
    includeRect: true,
    rectPrecision: "fine",
  },
  /*
   * Skintone palette modal (same navigation as tests/visual/home.spec.js + Argos
   * *-human-male-skintone). Dumps run openHumanMaleSkintonePalette after gotoHomepageReady.
   */
  {
    label: "palette modal overlay",
    selector: ".palette-modal-overlay",
  },
  {
    label: "palette modal root",
    selector: ".palette-modal",
    omitProps: ["height"],
    omitDumpLines: ["__box", "__offset"],
    includeRect: true,
  },
  {
    label: "palette modal header",
    selector: ".palette-modal header",
    includeRect: true,
  },
  {
    label: "palette modal title (h4)",
    selector: ".palette-modal header h4",
    includeRect: true,
  },
  {
    label: "palette modal close button",
    selector: ".palette-modal header button",
    /* Chromium serializes font-family with/without quotes around system-ui depending on cascade source. */
    omitProps: ["font", "font-family"],
    includeRect: true,
  },
  {
    label: "palette modal section (scroll body)",
    selector: ".palette-modal section",
    omitProps: ["height"],
    omitDumpLines: ["__box", "__offset"],
  },
  {
    label: "palette modal tree row (.tree-label)",
    selector: ".palette-modal .tree-label",
    includeRect: true,
  },
  {
    label: "palette modal version label (.palette-version)",
    selector: ".palette-modal .palette-version",
  },
  {
    label: "palette modal variant display name",
    selector: ".palette-modal .variant-display-name",
  },
  {
    label: "palette modal variant item (link-light / selected)",
    selector: ".palette-modal .variant-item.has-background-link-light",
  },
  {
    label: "palette modal variant item (not link-light)",
    selector: ".palette-modal .variant-item:not(.has-background-link-light)",
    omitProps: ["background-color"],
  },
  {
    label: "palette modal variant canvas",
    selector: ".palette-modal canvas.variant-canvas",
  },
  {
    label: "palette modal swatch (.palette-swatch)",
    selector: ".palette-modal .palette-swatch",
  },
  { label: "collapsible header (first)", selector: ".collapsible-header" },
  {
    label: "animation preview section root (#mithril-preview)",
    selector: "#mithril-preview",
    omitProps: ["height"],
    omitDumpLines: ["__box", "__offset"],
    includeRect: true,
  },
  {
    label: "animation preview collapsible header",
    selector: "#mithril-preview .collapsible-header",
  },
  {
    label: "animation preview collapsible inner (.collapsible-content)",
    selector: "#mithril-preview .collapsible-content",
    omitProps: ["height", "margin-top"],
    omitDumpLines: ["__box", "__offset"],
  },
  {
    label: "animation preview controls row (.columns.is-multiline)",
    selector: "#mithril-preview .columns.is-multiline",
    omitProps: ["height"],
    omitDumpLines: ["__box", "__offset"],
  },
  {
    label: "animation preview controls",
    selector: "#mithril-preview .control",
    /*
     * Bulma 1 vs 0.9: float width / __box can differ ~0.02px while offsetWidth/offsetHeight match.
     * Not the same class of issue as preview collapsible margin (fixed in bulma-overrides).
     */
    omitProps: ["width"],
    omitDumpLines: ["__box"],
  },
  {
    label:
      "animation preview frame-cycle readout (.field.has-addons .button.is-static)",
    selector:
      "#mithril-preview .field.has-addons .control:last-child .button.is-static",
  },
  {
    label: "animation preview zoom range input",
    selector: "#mithril-preview input.is-fullwidth[type=range]",
  },
  {
    label: "animation preview scrollable container",
    selector: "#mithril-preview .scrollable-container",
  },
  {
    label: "animation preview canvas stack wrapper (div.mt-3)",
    selector: "#mithril-preview .collapsible-content > div.mt-3",
  },
  {
    label: "animation preview section title (first .title in preview)",
    selector: "#mithril-preview .title",
  },
  {
    label: "spritesheet preview section root (#mithril-spritesheet-preview)",
    selector: "#mithril-spritesheet-preview",
    includeRect: true,
  },
  {
    label: "spritesheet preview collapsible header",
    selector: "#mithril-spritesheet-preview .collapsible-header",
  },
  {
    label: "spritesheet preview collapsible inner (.collapsible-content)",
    selector: "#mithril-spritesheet-preview .collapsible-content",
  },
  {
    label: "spritesheet preview checkbox+zoom row (.columns.is-mobile)",
    selector:
      "#mithril-spritesheet-preview .columns.is-mobile.is-variable.is-1.is-multiline",
  },
  {
    label: "spritesheet preview zoom range input",
    selector: "#mithril-spritesheet-preview input.is-fullwidth[type=range]",
  },
  {
    label: "spritesheet preview scrollable container",
    selector: "#mithril-spritesheet-preview .scrollable-container",
  },
  {
    label: "spritesheet horizontal field",
    selector: "#mithril-spritesheet-preview .field.is-horizontal",
  },
  {
    label: "spritesheet inner row first column (checkboxes)",
    selector:
      "#mithril-spritesheet-preview .columns.is-mobile > .column:nth-child(1)",
  },
  {
    label: "spritesheet inner row second column (zoom)",
    selector:
      "#mithril-spritesheet-preview .columns.is-mobile > .column:nth-child(2)",
  },
  {
    label: "spritesheet zoom field-body",
    selector:
      "#mithril-spritesheet-preview .field.is-horizontal .field-body",
  },
  { label: "scrollable container (first)", selector: ".scrollable-container" },
  { label: "animation canvas", selector: "#previewAnimations" },
  { label: "spritesheet canvas", selector: "#spritesheet-preview" },
];

/** Normalize host:port in dump header so diffs aren’t noisy between worktrees. */
export function normalizeUrlForDumpHeader(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:__PORT__${u.pathname}${u.search}${u.hash}`;
  } catch {
    return url.replace(/127\.0\.0\.1:\d+/, "127.0.0.1:__PORT__");
  }
}

export function makeDumpHeader(viewport, url, page = "human-male-skintone") {
  const u = normalizeUrlForDumpHeader(url);
  return `# computed-style-dump viewport=${viewport.width}x${viewport.height} page=${page} url=${u}\n\n`;
}

/** Resolve dump page id from CLI/options (explicit `page` wins over legacy `skipSkintoneModal`). */
export function resolveComputedStyleDumpPage(options = {}) {
  if (options.page && typeof options.page === "string") {
    const p = options.page.trim();
    if (!COMPUTED_STYLE_DUMP_PAGES.includes(p)) {
      throw new Error(
        `Unknown dump page "${p}". Expected one of: ${COMPUTED_STYLE_DUMP_PAGES.join(", ")}`,
      );
    }
    return p;
  }
  if (options.skipSkintoneModal === true) {
    return "homepage";
  }
  return "human-male-skintone";
}

/** Snippets for canvas `measureText` (compare width between master/branch dumps). */
export const FONT_METRICS_SNIPPETS = [
  "Ag",
  "Spritesheet (PNG)",
  "Universal LPC Spritesheet Generator",
];

/** Selectors for font shorthand + measureText probes (label for dump lines only). */
export const FONT_METRICS_PROBES = [
  { label: "body", selector: "body" },
  { label: "h1.title", selector: "h1.title" },
  { label: "download .button (first)", selector: "#download-buttons .button" },
  { label: "filters .label (first)", selector: "#mithril-filters .label" },
  { label: ".tree-label (first)", selector: ".tree-label" },
];

export async function collectComputedStyleDump(page, options = {}) {
  const props = options.props ?? COMPUTED_STYLE_PROPS;
  const targets = options.targets ?? COMPUTED_STYLE_TARGETS;
  const fontDiagnostics = options.fontDiagnostics !== false;
  const fontSnippets = options.fontMetricsSnippets ?? FONT_METRICS_SNIPPETS;
  const fontProbes = options.fontMetricsProbes ?? FONT_METRICS_PROBES;
  return page.evaluate(
    async ({
      props: propList,
      targets: targetList,
      fontDiagnostics: doFont,
      fontSnippets: snippets,
      fontProbes: probes,
    }) => {
      /* eslint-disable no-undef -- browser */

      function fontShorthandFromComputed(cs) {
        const direct = cs.font;
        if (direct && direct !== "initial" && direct !== "") {
          return direct.trim();
        }
        const lh =
          cs.lineHeight && cs.lineHeight !== "normal"
            ? `/${cs.lineHeight}`
            : "";
        return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}${lh} ${cs.fontFamily}`
          .replace(/\s+/g, " ")
          .trim();
      }

      function canvasMeasureTextWidth(fontCss, text) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return NaN;
        }
        ctx.font = fontCss;
        return ctx.measureText(text).width;
      }

      const lines = [];
      const de = document.documentElement;
      lines.push(
        "=== __viewport_context (layout — compare to manual browser, no DevTools dock) ===",
      );
      lines.push(`  window.innerWidth: ${window.innerWidth}`);
      lines.push(`  window.innerHeight: ${window.innerHeight}`);
      lines.push(`  documentElement.clientWidth: ${de.clientWidth}`);
      lines.push(`  documentElement.clientHeight: ${de.clientHeight}`);
      lines.push(`  devicePixelRatio: ${window.devicePixelRatio}`);
      lines.push(`  scrollY: ${window.scrollY}`);
      const chooser = document.querySelector("#chooser-column");
      if (chooser) {
        const rc = chooser.getBoundingClientRect();
        lines.push(
          `  #chooser-column: clientWidth=${chooser.clientWidth} rect.w=${rc.width.toFixed(2)}`,
        );
      }
      const h1 = document.querySelector("#header-left h1.title");
      if (h1) {
        const rh = h1.getBoundingClientRect();
        lines.push(
          `  #header-left h1.title: rect ${rh.width.toFixed(2)}x${rh.height.toFixed(2)} (wrapped title affects flow below)`,
        );
      }
      lines.push("");

      for (const t of targetList) {
        const { label, selector } = t;
        const omit = new Set(t.omitProps ?? []);
        const nodes = document.querySelectorAll(selector);
        if (nodes.length === 0) {
          lines.push(`=== ${label} <${selector}> ===`);
          lines.push("  <no match>");
          lines.push("");
          continue;
        }

        for (let i = 0; i < nodes.length; i++) {
          const el = nodes[i];
          const header =
            nodes.length === 1
              ? `=== ${label} <${selector}> ===`
              : `=== ${label} <${selector}> [${i}/${nodes.length}] ===`;
          lines.push(header);
          const cs = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const omitLines = new Set(t.omitDumpLines ?? []);
          if (!omitLines.has("__box")) {
            lines.push(
              `  __box: ${rect.width.toFixed(2)}x${rect.height.toFixed(2)}`,
            );
          }
          if (!omitLines.has("__offset")) {
            lines.push(`  __offset: ${el.offsetWidth}x${el.offsetHeight}`);
          }
          if (t.includeRect) {
            if (t.rectPrecision === "fine") {
              lines.push(
                `  __rect: ${rect.left.toFixed(2)},${rect.top.toFixed(2)},${rect.bottom.toFixed(2)}`,
              );
            } else {
              lines.push(
                `  __rect: ${Math.round(rect.left)},${Math.round(rect.top)}`,
              );
            }
          }
          if (t.includeClientRects) {
            const crs = el.getClientRects();
            const segs = [];
            for (let j = 0; j < crs.length; j++) {
              const rj = crs[j];
              segs.push(`${rj.top.toFixed(2)}-${rj.bottom.toFixed(2)}`);
            }
            lines.push(`  __client_rects: n=${crs.length} [${segs.join("; ")}]`);
          }
          if (t.includeContentBounds) {
            try {
              const range = document.createRange();
              range.selectNodeContents(el);
              const br = range.getBoundingClientRect();
              lines.push(
                `  __content_rect: ${br.width.toFixed(2)}x${br.height.toFixed(2)}, top=${br.top.toFixed(2)}, bottom=${br.bottom.toFixed(2)}`,
              );
            } catch {
              lines.push("  __content_rect: (exception)");
            }
          }
          if (t.includeOverflowLayout) {
            lines.push(
              `  __layout: clientH=${el.clientHeight},scrollH=${el.scrollHeight},offsetH=${el.offsetHeight}`,
            );
          }
          if (t.includeWrapRowMetrics) {
            lines.push(
              `  __wrap_row: height=${cs.height} min-height=${cs.minHeight} clientH=${el.clientHeight} scrollH=${el.scrollHeight} rectH=${rect.height.toFixed(2)}`,
            );
          }
          for (const p of propList) {
            if (omit.has(p)) continue;
            const v = cs.getPropertyValue(p);
            if (v !== "") {
              lines.push(`  ${p}: ${v.trim()}`);
            }
          }
          lines.push("");
        }
      }

      const licBox = document.querySelector(
        "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(1) > .box.mb-4.has-background-light",
      );
      const animBox = document.querySelector(
        "#mithril-filters > div > .box:nth-child(2) .collapsible-content > .columns.is-multiline > .column:nth-child(2) > .box.mb-4.has-background-light",
      );
      if (licBox && animBox) {
        const rL = licBox.getBoundingClientRect();
        const rA = animBox.getBoundingClientRect();
        lines.push("=== __filter_license_to_animation_gap (viewport px) ===");
        lines.push(`  license_bottom: ${rL.bottom.toFixed(2)}`);
        lines.push(`  animation_top: ${rA.top.toFixed(2)}`);
        lines.push(`  gap: ${(rA.top - rL.bottom).toFixed(2)}`);
        lines.push("");
      }

      function headerToCheckboxBlockGap(box, title) {
        if (!box) {
          return;
        }
        const header = box.querySelector(":scope > .tree-label");
        const content = box.querySelector(":scope > .content");
        if (!header || !content) {
          return;
        }
        const rH = header.getBoundingClientRect();
        const rC = content.getBoundingClientRect();
        lines.push(
          `=== __filter_${title}_header_to_checkbox_block_gap (viewport px) ===`,
        );
        lines.push(`  header_bottom: ${rH.bottom.toFixed(2)}`);
        lines.push(`  content_top: ${rC.top.toFixed(2)}`);
        lines.push(`  gap: ${(rC.top - rH.bottom).toFixed(2)}`);
        lines.push("");
      }
      headerToCheckboxBlockGap(licBox, "license");
      headerToCheckboxBlockGap(animBox, "animation");

      if (doFont) {
        lines.push("=== font diagnostics (FontFace API + canvas measureText) ===");
        if (document.fonts && typeof document.fonts.ready?.then === "function") {
          try {
            await document.fonts.ready;
          } catch {
            /* ignore */
          }
        }
        lines.push(`  document.fonts.size: ${document.fonts ? document.fonts.size : "(no document.fonts)"}`);

        if (document.fonts && document.fonts.size > 0) {
          const faces = [];
          try {
            for (const face of document.fonts.values()) {
              faces.push({
                family: face.family,
                style: face.style,
                weight: face.weight,
                status: face.status,
              });
            }
          } catch {
            lines.push("  (could not iterate document.fonts.values())");
          }
          faces.sort((a, b) => {
            const c = a.family.localeCompare(b.family);
            if (c !== 0) {
              return c;
            }
            const w = String(a.weight).localeCompare(String(b.weight));
            if (w !== 0) {
              return w;
            }
            return a.style.localeCompare(b.style);
          });
          const maxLines = 80;
          for (let i = 0; i < Math.min(faces.length, maxLines); i++) {
            const f = faces[i];
            lines.push(
              `  FontFace: ${f.family} / ${f.weight} / ${f.style} → ${f.status}`,
            );
          }
          if (faces.length > maxLines) {
            lines.push(`  … (${faces.length - maxLines} more FontFace entries omitted)`);
          }
        }

        const bodyCs = getComputedStyle(document.body);
        const bodyFont = fontShorthandFromComputed(bodyCs);
        lines.push(`  body resolved font (shorthand): ${bodyFont}`);
        try {
          if (document.fonts?.check) {
            lines.push(`  document.fonts.check(body): ${document.fonts.check(bodyFont)}`);
          }
        } catch {
          lines.push("  document.fonts.check(body): (threw)");
        }

        lines.push("  --- measureText widths (2d canvas, ctx.font = resolved shorthand) ---");
        for (const probe of probes) {
          const node = document.querySelector(probe.selector);
          if (!node) {
            lines.push(`  [${probe.label}] <no match for ${probe.selector}>`);
            continue;
          }
          const pcs = getComputedStyle(node);
          const fontCss = fontShorthandFromComputed(pcs);
          lines.push(`  [${probe.label}] font: ${fontCss}`);
          for (const snippet of snippets) {
            const w = canvasMeasureTextWidth(fontCss, snippet);
            const safe = snippet.replace(/\n/g, " ");
            lines.push(
              `  [${probe.label}] measureText(${JSON.stringify(safe)}): ${Number.isFinite(w) ? w.toFixed(3) : String(w)}`,
            );
          }
        }
        lines.push("");
      }

      return lines.join("\n");
      /* eslint-enable no-undef */
    },
    {
      props,
      targets,
      fontDiagnostics,
      fontSnippets,
      fontProbes,
    },
  );
}

/**
 * Full page load + dump (one browser session).
 * @param {string} url
 * @param {{ width: number, height: number }} viewport
 * @param {object} [options] passed to collectComputedStyleDump, plus:
 * @param {string} [options.page] One of COMPUTED_STYLE_DUMP_PAGES (default human-male-skintone).
 * @param {boolean} [options.skipSkintoneModal] Legacy: if true and `page` unset, same as page=homepage.
 */
export async function dumpComputedStylesForUrl(url, viewport, options = {}) {
  const dumpPage = resolveComputedStyleDumpPage(options);
  const collectOptions = { ...options };
  delete collectOptions.skipSkintoneModal;
  delete collectOptions.page;

  const deviceScaleFactor =
    Number(process.env.PLAYWRIGHT_DEVICE_SCALE_FACTOR ?? "1") || 1;

  const browser = await chromium.launch({ headless: true });
  let context;
  try {
    context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      // Same flag as tests/visual/home.spec.js (prevents preview animation layout churn).
      globalThis.__DISABLE_PREVIEW_ANIMATION__ = true;
    });
    await gotoHomepageReady(page, url);
    if (dumpPage === "human-male-skintone") {
      await openHumanMaleSkintonePalette(page);
    } else if (dumpPage === "filters-search-arm") {
      await openHumanMaleSkintonePalette(page);
      await closeSkintonePaletteModal(page);
      await openLicenseAnimationAdvancedAndSearchArm(page);
    }
    const body = await collectComputedStyleDump(page, collectOptions);
    return makeDumpHeader(viewport, url, dumpPage) + body;
  } finally {
    if (context) {
      await context.close();
    }
    await browser.close();
  }
}
