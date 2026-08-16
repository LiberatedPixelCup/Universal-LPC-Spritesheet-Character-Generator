import "chai";
import "../sources/vendor-globals.ts";

window.__TEST_DEBUG_LOCKED__ = true;
window.DEBUG = import.meta.env.VITEST_DEBUG === "true";
