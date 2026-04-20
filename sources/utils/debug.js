/* eslint-disable no-console */

/**
 * Debug logging gated by `window.DEBUG` (localhost / ?debug=).
 * Import this module from the app entry (main.js) before other `sources/` modules
 * so `window.DEBUG` is set before they run.
 */

const BOOL_MAP = {
  true: true,
  false: false,
};

function bool(s) {
  return BOOL_MAP[s] ?? null;
}

function isLocalhost() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  );
}

/** @returns {boolean} */
export function getDebugParam() {
  if (typeof window === "undefined") return false;
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get("debug");
  return bool(debugParam) ?? isLocalhost();
}

if (typeof window !== "undefined") {
  if (window.__TEST_DEBUG_LOCKED__) {
    // Browser test harness (tests/vitest-setup.js) sets window.DEBUG from import.meta.env.VITEST_DEBUG
  } else {
    window.DEBUG = getDebugParam();
  }
}

export function debugLog(...args) {
  if (typeof window !== "undefined" && window.DEBUG) {
    console.log(...args);
  }
}

export function debugWarn(...args) {
  if (typeof window !== "undefined" && window.DEBUG) {
    console.warn(...args);
  }
}

/** Grouped console output (e.g. profiler reports); only when `window.DEBUG` is true. */
export function debugGroup(...args) {
  if (typeof window !== "undefined" && window.DEBUG) {
    console.group(...args);
  }
}

export function debugGroupEnd() {
  if (typeof window !== "undefined" && window.DEBUG) {
    console.groupEnd();
  }
}

export function debugTable(...args) {
  if (typeof window !== "undefined" && window.DEBUG) {
    console.table(...args);
  }
}
