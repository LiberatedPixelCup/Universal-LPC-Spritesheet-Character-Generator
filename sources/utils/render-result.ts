// Render-prop helper for `Result<T, LoadError>` from `state/catalog.ts`.
//
// Usage:
//   return renderResult(getItemLite(itemId), (item) => m(Detail, { item }));
//
// Custom error rendering:
//   return renderResult(
//     getItemLite(itemId),
//     (item) => m(Detail, { item }),
//     (err) => err.kind === "loading" ? m(SkeletonRow) : m(ErrorBanner, { err }),
//   );
//
// Multi-resource composition via Result.combine:
//   return renderResult(
//     Result.combine([getItemLite(id), getPaletteMetadata()]),
//     ([item, palette]) => m(PaletteModal, { item, palette }),
//   );

import m from "mithril";
import type { Result } from "neverthrow";
import type { LoadError } from "../state/catalog.ts";

function defaultRenderError(error: LoadError): m.Children {
  switch (error.kind) {
    case "loading":
      return m("div.result-loading", "Loading…");
    case "not-found":
      return m("div.result-error", `Not found: ${error.id}`);
    default:
      return m("div.result-error", "Unknown error");
  }
}

export function renderResult<T>(
  result: Result<T, LoadError>,
  view: (value: T) => m.Children,
  renderError: (error: LoadError) => m.Children = defaultRenderError,
): m.Children {
  return result.match(view, renderError);
}
