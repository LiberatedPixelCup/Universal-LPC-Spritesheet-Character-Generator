/* eslint-disable no-console */

/**
 * Debug logging gated by `window.DEBUG` (localhost / ?debug=).
 * Import this module from the app entry (main.js) before other `sources/` modules
 * so `window.DEBUG` is set before they run.
 */

declare global {
  interface Window {
    /** Set by this module on startup; gates `debugLog` / `debugWarn` / etc. */
    DEBUG?: boolean;
    /** Set by the browser test harness (`tests/vitest-setup.js`) to prevent this module from overriding `window.DEBUG`. */
    __TEST_DEBUG_LOCKED__?: boolean;
  }
}

function isLocalhost(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  );
}

export function getDebugParam(): boolean {
  if (typeof window === "undefined") return false;
  const debugParam = new URLSearchParams(window.location.search).get("debug");
  return debugParam === "true" || (debugParam !== "false" && isLocalhost());
}

if (typeof window !== "undefined") {
  if (window.__TEST_DEBUG_LOCKED__) {
    // Browser test harness (tests/vitest-setup.js) sets window.DEBUG from import.meta.env.VITEST_DEBUG
  } else {
    window.DEBUG = getDebugParam();
  }
}

export function debugLog(...args: unknown[]): void {
  if (typeof window !== "undefined" && window.DEBUG) {
    console.log(...args);
  }
}

export function debugWarn(...args: unknown[]): void {
  if (typeof window !== "undefined" && window.DEBUG) {
    console.warn(...args);
  }
}

/** Grouped console output (e.g. profiler reports); only when `window.DEBUG` is true. */
export function debugGroup(...args: unknown[]): void {
  if (typeof window !== "undefined" && window.DEBUG) {
    console.group(...args);
  }
}

export function debugGroupEnd(): void {
  if (typeof window !== "undefined" && window.DEBUG) {
    console.groupEnd();
  }
}

export function debugTable(...args: unknown[]): void {
  if (typeof window !== "undefined" && window.DEBUG) {
    console.table(...args);
  }
}
