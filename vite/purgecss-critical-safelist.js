/**
 * Safelist for PurgeCSS on the **critical** CSS bundle only.
 * - `standard`: exact class names used before / during early Mithril paint (incl. skeletons).
 * - `keyframes` / `variables`: required by critical `loading.css` + Bulma theme output.
 * - `greedy`: Bulma utilities and app prefixes so compound selectors are not over-stripped.
 *
 * Extend when first-paint UI adds new classes or Purge removes needed rules.
 */
import path from "node:path";

export function getPurgeContentGlobs(repoRoot) {
  return [
    path.join(repoRoot, "index.html"),
    // Scan both .js and .ts — the codebase is mid-migration. PurgeCSS-extracted
    // class names need to come from every source file regardless of extension,
    // otherwise classes used only in .ts files get purged from critical CSS.
    path.join(repoRoot, "sources", "**", "*.{js,ts}"),
    path.join(repoRoot, "tests", "tests_run.html"),
  ];
}

/** @returns {import('purgecss').ComplexSafelist} */
export function getPurgeSafelist() {
  return {
    keyframes: ["spin", "skeleton-pulse"],
    variables: [/^--bulma-/, /^--skeleton-/],
    standard: [
      "active",
      "collapsed",
      "column",
      "columns",
      "compact-display",
      "expanded",
      "filters-column",
      "has-background-light",
      "has-background-link-light",
      "has-background-white-ter",
      "has-text-grey",
      "is-4",
      "is-6",
      "is-align-items-center",
      "is-danger",
      "is-desktop",
      "is-flex",
      "is-flex-wrap-wrap",
      "is-info",
      "is-link",
      "is-primary",
      "is-size-7",
      "is-spaced",
      "is-warning",
      "loading",
      "mb-0",
      "mb-2",
      "mb-3",
      "mb-4",
      "ml-2",
      "mr-2",
      "mt-3",
      "mx-2",
      "my-2",
      "palette-modal",
      "preview-canvas-area",
      "preview-canvas-area--spritesheet",
      "preview-canvas-busy",
      "preview-canvas-loading-inner",
      "preview-canvas-loading-overlay",
      "preview-canvas-loading-text",
      "preview-canvas-root",
      "search-result",
      "skeleton-row",
      "skeleton-row--stacked",
      "skeleton-row__bar",
      "skeleton-row__bar--flex",
      "skeleton-row__bar--long",
      "skeleton-row__bar--medium",
      "skeleton-row__bar--short",
      "sticky",
      "subtitle",
      "title",
      "tree-arrow",
      "collapsible-header",
      "collapsible-title",
      "collapsible-content",
      "category-tree-panel",
      "category-tree-loading-host",
      "category-tree-loading-overlay",
      "variant-canvas",
      "variant-display-name",
      "variant-item",
      "variants-container",
      "box",
    ],
    greedy: [/^skeleton-/, /^preview-canvas/, /^category-tree/],
  };
}
