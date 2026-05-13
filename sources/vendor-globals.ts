import m from "mithril";
import JSZip from "jszip";
import classNames from "classnames";

declare global {
  interface Window {
    /** Mithril attached for non-module legacy callers. */
    m: typeof m;
    /** classnames util attached for non-module legacy callers. */
    classNames: typeof classNames;
    // `window.JSZip` is already declared in `state/zip.ts` as
    // `JSZip?: new () => ZipFolder`. We rely on the existing declaration
    // and only assign here.
  }
}

window.m = m;
// `jszip`'s shipped types model `folder()` as returning `JSZip | null`; zip.ts
// types its consumed surface (`ZipFolder`) with non-null `folder()` because
// it never checks. Bridge the gap at the assignment.
window.JSZip =
  JSZip as unknown as new () => import("./utils/zip-helpers.ts").ZipFolder;
window.classNames = classNames;
