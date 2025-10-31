// Main entry point - initializes and mounts the Mithril application

// Import canvas renderer
import * as canvasRenderer from './canvas/renderer.js';

// Import state management
import { initState } from './state/state.js';
import { initHashChangeListener } from './state/hash.js';

// Import components
import { App } from './components/App.js';
import { AnimationPreview } from './components/preview/AnimationPreview.js';
import { FullSpritesheetPreview } from './components/preview/FullSpritesheetPreview.js';

// Import performance profiler
import { PerformanceProfiler } from './performance-profiler.js';

// DEBUG mode will be turned on if on localhost and off in production
// but this can be overridden by adding debug=(true|false) to the querystring.
const boolMap = {
	true: true,
	false: false,
};
const bool = (s) => boolMap[s] ?? null;
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Get debug parameter from URL query string
const getDebugParam = () => {
	const urlParams = new URLSearchParams(window.location.search);
	const debugParam = urlParams.get('debug');
	return bool(debugParam);
};

const DEBUG = getDebugParam() ?? isLocalhost;

// Initialize performance profiler (uses same DEBUG flag as console logging)
const profiler = new PerformanceProfiler({
	enabled: DEBUG,
	verbose: false,
	logSlowOperations: true
});

// Always expose profiler and DEBUG flag globally for manual control
window.profiler = profiler;
window.DEBUG = DEBUG;

// Expose canvas renderer to global scope for compatibility
window.canvasRenderer = canvasRenderer;

// Expose initialization function to be called after canvas is ready
window.setDefaultSelections = async function() {
	await initState();
};

// Remove Netlify link if not on Netlify
if (!window.location.hostname.includes('netlify')) {
	document.getElementById("netlify-link")?.remove();
}

// Wait for DOM to be ready, then load Mithril app
document.addEventListener('DOMContentLoaded', async () => {
	clearLoadingIndicators();

	// Initialize offscreen canvas
	canvasRenderer.initCanvas();

	// Set defaults after canvas is ready
	if (window.setDefaultSelections) {
		await window.setDefaultSelections();
	}

	// Initialize hash change listener
	initHashChangeListener();

	// Mount the components
	m.mount(document.getElementById("mithril-filters"), App);
	m.mount(document.getElementById("mithril-preview"), AnimationPreview);
	m.mount(document.getElementById("mithril-spritesheet-preview"), FullSpritesheetPreview);
});

function clearLoadingIndicators() {
	const loadingElements = document.querySelectorAll('.loading');
	for (const element of loadingElements) {
		element.classList.remove('loading');
	}
}
