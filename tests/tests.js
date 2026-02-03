import { config } from "chai";

config.includeStack = true;
config.truncateThreshold = 0; // Disable truncation of assertion errors

// Import all test files

import "./components/CollapsibleSection_spec.js";
import "./components/FiltersPanel_spec.js";
import "./components/filters/AnimationFilters_spec.js";
import "./components/filters/LicenseFilters_spec.js";
import "./components/filters/SearchControl_spec.js";
import "./components/tree/BodyTypeSelector_spec.js";