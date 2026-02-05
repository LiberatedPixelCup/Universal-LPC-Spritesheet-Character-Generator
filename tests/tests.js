import { config } from "chai";

config.includeStack = true;
config.truncateThreshold = 0; // Disable truncation of assertion errors

// Import all test files
import "./canvas/canvas-utils_spec.js";
import "./canvas/draw-frames_spec.js";
import "./canvas/download_spec.js";
import "./canvas/load-images_spec.js";
import "./canvas/mask_spec.js";
import "./components/CollapsibleSection_spec.js";
import "./components/FiltersPanel_spec.js";
import "./components/filters/AnimationFilters_spec.js";
import "./components/filters/LicenseFilters_spec.js";
import "./components/filters/SearchControl_spec.js";
import "./components/tree/BodyTypeSelector_spec.js";
import "./utils/helpers_spec.js";