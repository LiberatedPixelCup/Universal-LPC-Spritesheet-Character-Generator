/* eslint-disable no-console */

/**
 * Debug logging for Node scripts under `scripts/`.
 * Enable with `DEBUG=1` (or `true`, `yes`) in the environment:
 *
 *   DEBUG=1 npm run validate-site-sources
 *
 * Disable explicitly with `DEBUG=0` or `DEBUG=false`.
 */

function isTruthyEnv(value: string | undefined): boolean {
  if (value === undefined || value === "") return false;
  const lower = String(value).toLowerCase().trim();
  if (lower === "0" || lower === "false" || lower === "no" || lower === "off") {
    return false;
  }
  return true;
}

function isDebugEnabled(): boolean {
  return isTruthyEnv(process.env.DEBUG);
}

function debugLog(...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log(...args);
  }
}

function debugWarn(...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.warn(...args);
  }
}

const debugUtils = { isDebugEnabled, debugLog, debugWarn };
export default debugUtils;
export { isDebugEnabled, debugLog, debugWarn };
