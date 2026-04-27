// Render-prop boundary for `Result<T, LoadError>` from `catalog-typed.ts`.
// The component is the only place in the render tree that knows about loading state.
//
// Usage:
//   m(ResultBoundary, {
//     read: () => getItemLite(itemId),
//     view: (item) => m(Detail, { item }),
//     // optional: customize per-error rendering
//     renderError: (err) => err.kind === "loading" ? m(SkeletonRow) : m(ErrorBanner, { err }),
//   })
//
// Multi-resource composition via Result.combine:
//   m(ResultBoundary, {
//     read: () => Result.combine([getItemLite(id), getPaletteMetadata()]),
//     view: ([item, palette]) => m(PaletteModal, { item, palette }),
//   })

import m from "mithril";

function defaultRenderError(error) {
  switch (error.kind) {
    case "loading":
      return m("div.result-loading", "Loading…");
    case "not-found":
      return m("div.result-error", `Not found: ${error.id}`);
    default:
      return m("div.result-error", "Unknown error");
  }
}

export const ResultBoundary = {
  view: (vnode) => {
    const { read, view, renderError } = vnode.attrs;
    const result = read();
    if (result.isOk()) {
      return view(result.value);
    }
    return (renderError ?? defaultRenderError)(result.error);
  },
};
