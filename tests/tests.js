import "./vitest-setup.js";
import { config } from "chai";

config.includeStack = true;
config.truncateThreshold = 0; // Disable truncation of assertion errors

// Import all test files
import "./canvas/canvas-utils_spec.js";
import "./canvas/draw-frames_spec.js";
import "./canvas/download_spec.js";
import "./canvas/load-images_spec.js";
import "./canvas/mask_spec.js";
import "./canvas/renderer-issue-364_spec.js";
import "./components/CollapsibleSection_spec.js";
import "./components/FiltersPanel_spec.js";
import "./components/filters/AnimationFilters_spec.js";
import "./components/filters/LicenseFilters_spec.js";
import "./components/filters/SearchControl_spec.js";
import "./components/tree/BodyTypeSelector_spec.js";
import "./state/filters_spec.js";
import "./state/hash_spec.js";
import "./state/json_spec.js";
import "./state/meta_spec.js";
import "./state/palettes_spec.js";
import "./state/path_spec.js";
import "./state/state_spec.js";
import "./utils/fileName_spec.js";
import "./utils/helpers_spec.js";
import "./utils/credits_spec.js";
import "./utils/zip-helpers_spec.js";
import "./utils/zip-export-ui-suspend_spec.js";
import "./state/zip_spec.js";
import "./state/zip-issue-382_spec.js";
import "./performance-profiler_spec.js";

mocha.run();
