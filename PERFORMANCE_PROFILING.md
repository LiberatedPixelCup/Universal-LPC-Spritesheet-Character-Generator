# Performance Profiling

## How to Enable Profiling

The app includes a performance profiler that is automatically enabled when:

1. Running on localhost (127.0.0.1 or localhost)
2. Adding `?debug=true` to the URL query string (overrides localhost detection)
3. Adding `?debug=false` to disable it even on localhost

The DEBUG flag and profiler are initialized in `sources/main.ts`. Only `?debug=true` and `?debug=false` override localhost detection (`sources/utils/debug.ts`). Other values (for example `?debug=1`) fall through to the localhost check.

## Profiled Operations

The profiler tracks these expensive operations:

### Image Loading

- **Operation:** `loadImage()` in `sources/canvas/renderer.ts`
- **Measures:** Individual image load times
- **Format:** `image-load:<path>`

### Character Rendering

- **Operation:** `renderCharacter()` in `sources/canvas/renderer.ts`
- **Measures:** Total rendering time including image loading and canvas operations
- **Format:** `renderCharacter`

### Headless app profiler

Use these when **`loadImage()`**, **`renderCharacter()`**, or hash hydration changed. They open headless Chromium, drive the live app the way a human would (`?debug=true`, wait for catalog + first paint, change the selection once), then write **`profiler.snapshot()`** — the same data as **`window.profiler.report()`**, as JSON.

They do **not** replace checking WebGL and the CPU fallback visually; for that, see [Force CPU Mode](PALETTE_RECOLOR_GUIDE.md#force-cpu-mode-testing). They are also not a substitute for the ZIP scripts below.

**Before you run**

1. Install Chromium once: `npx playwright install`
2. The script starts Vite itself on `127.0.0.1` (default port `5178`, override with `APP_PROFILE_PORT`). Pass `--url http://127.0.0.1:5173` to attach to an already-running `npm run dev` instead.

**Compare to a baseline**

Take a baseline on the same machine, then diff after your change.

```bash
npm run profile:app:baseline
# …make your change…
npm run profile:app
npm run diff:app-profile -- tmp/baseline-app-profile.json tmp/app-profile.json
```

A positive Δ means the after run was slower. Look at `renderCharacter`, `image-load:*`, and `hash-loadSelectionsFromHash`. A few milliseconds is noise; `renderCharacter` can swing tens of ms between two runs on the same machine.

JSON lands under `tmp/` (gitignored) and is also printed on stdout. Pass `--out <path>` to write somewhere else.

**Optional**

- Custom selections: `npm run profile:app -- --hash 'sex=male&body=Body_Color_light' --hash2 '…'`
- The default first hash is the full outfit in `scripts/zip/zip-profile-default-hash.ts`. The default second hash drops layered gear (body + head + expression only).

### ZIP export (download packs)

ZIP generation uses **`createZipExportProfiler`** in `sources/performance-profiler.ts`, wired from `sources/state/zip.ts` (split-by-animation, split-by-item, split-by-animation-and-item, individual frames).

- **Embedded timings:** Exports that write `credits/metadata.json` include a **`performance`** object (`exportKind`, `totalMs`, `phasesMs`, `userAgent`).
  - In the downloaded zip: **`credits/metadata.json`** → **`performance.phasesMs`** for per-phase milliseconds.
  - Phases cover work **before** JSZip `generateAsync` (compression is omitted in that JSON to avoid double compression).
- **Console (DEBUG):** With `window.DEBUG` true (localhost or `?debug=true`), finishing an export logs a **ZIP export profile** table in the console (phases sorted by duration).
- **User Timing:** With DEBUG on, phases also emit `performance.mark` names like `zip:<exportKind>:<phase>-start` / `-end`, visible under **DevTools → Performance** when recording.
- **Split-by-item sheets** does not add `metadata.json`; use the console table and Performance marks when DEBUG is on.

After each export, `zipGenerateBlobWithProfiler` stores the latest `toMetadata()` snapshot on **`window.__lastZipExportProfile`** and accumulates **`window.__zipExportProfiles`** keyed by `exportKind`.

#### Headless ZIP scripts

Use these when ZIP **export** drawing or packaging changed. They open headless Chromium only. They do **not** replace checking WebGL and the CPU fallback in the app, and they do **not** replace the [headless app profiler](#headless-app-profiler) for `loadImage()` / `renderCharacter()`.

A full run can take several minutes (the runner waits up to 10 minutes).

**Before you run**

1. Install Chromium once: `npx playwright install`
2. Generate catalog metadata so `dist/*-metadata.js` exists: `npm run dev` or `npm run build` (once is enough). The profiler serves the repo with `npx serve` (default port `9877`, override with `ZIP_PROFILE_PORT`). It does not start Vite, so a clean tree fails on missing `/dist/` files.

**Which command**

| What you changed | Command | Notes |
| --- | --- | --- |
| Drawing, slicing, or PNG encode | `npm run profile:zip:quick` | Uses a fake JSZip. Ignore the `generateZip` phase. |
| Real zip packaging (`generateAsync`, `zip-helpers`) | `npm run profile:zip` | Uses real JSZip. Slower. |

These are not interchangeable. Match the command to the change.

**Compare to a baseline**

Take a baseline on the same machine, then diff after your change. Use the matching pair (`:quick` with `:quick`).

```bash
npm run profile:zip:baseline:quick
# …make your change…
npm run profile:zip:quick
npm run diff:zip-profile -- tmp/baseline-zip-export-profile-quick.json tmp/zip-export-profile-quick.json
```

For a full (real JSZip) comparison:

```bash
npm run profile:zip:baseline
npm run profile:zip
npm run diff:zip-profile -- tmp/baseline-zip-export-profile.json tmp/zip-export-profile.json
```

A positive Δ means the after run was slower. For a drawing change, look at `render_composite_*`, `drawAndSlice`, and `pngEncode`.

JSON lands under `tmp/` (gitignored) and is also printed on stdout. Pass `--out <path>` to write somewhere else.

**Optional**

- Limit to one export: `npm run profile:zip -- --only splitAnimations` (also `splitItemSheets`, `splitItemAnimations`, `individualFrames`).
- The default character is the full outfit in `scripts/zip/zip-profile-default-hash.ts`, not whatever you last had open in the browser.

**Opening the runner page yourself**

`npx serve` may drop `?` query params on redirect. The npm scripts inject `--quick`, `--only`, and the default hash via `window.__ZIP_PROFILE_OPTS__` before load. If you open `scripts/zip/zip-export-profile-runner.html` in a browser, keep the query string or put the same hash after `#`.

## Reviewing ZIP performance changes (PR)

Suggested **read order** (core behavior → profiling → automation):

| Order | File | What to check |
| ----- | ---- | ------------- |
| 1 | `sources/state/zip.ts` | Four exports (`exportSplitAnimations`, `exportSplitItemSheets`, `exportSplitItemAnimations`, `exportIndividualFrames`): `createZipExportProfiler`, `beginZipExportUiSuspend` / `endZipExportUiSuspend` in `try`/`finally`, `zipGenerateBlobWithProfiler` |
| 2 | `sources/utils/zip-helpers.ts` | `addAnimationToZipFolder`, `addStandardAnimationToZipCustomFolder`, `zipGenerateBlobWithProfiler`; phases `drawAndSlice` → `pngEncode` → `zipFile` |
| 3 | `sources/canvas/renderer.ts` | `zipExportProfiledLoadComposite` — splits **image load/decode** vs **composite** for item renders when `zipProfiler` is passed |
| 4 | `sources/performance-profiler.ts` | `createZipExportProfiler`, `ZIP_EXPORT_COUNTER_KEYS`, `toMetadata()` |
| 5 | `sources/utils/zip-export-ui-suspend.ts` | Mithril redraw + preview rAF suspend during export |
| 6 | `scripts/zip/*` | Headless profile runner, `diff-zip-profile`, default hash |

**Phase name vocabulary** (strings in `phasesMs` / metadata):

- **`render_imageLoadDecode_*`** — async: loading/decoding images before compositing.
- **`render_composite_*`** — sync: drawing onto canvases after images are ready.
- **`drawAndSlice`** — building a cropped/sliced canvas before PNG encode (`zip-helpers`).
- **`pngEncode`** — `canvas.toBlob` (and batched frame encodes in individual-frames export).
- **`zipFile`** — `JSZip` file entries.
- **`staticFiles`** — `character.json`, credits, metadata.
- **`generateZip`** — `zip.generateAsync` (often profiled separately from metadata embedding).

Counters (`pngEncodeCount`, `drawAndSliceCount`, etc.) are defined on `ZIP_EXPORT_COUNTER_KEYS` in `performance-profiler.ts`.

## Using the Profiler

### Via Browser Console

1. Enable DEBUG mode (see above)
2. Open the browser console (F12)
3. Perform actions in the app (change selections, render character, etc.)
4. Use these commands:

```javascript
// Full report (categories, FPS, User Timing measures)
window.profiler.report();

// Same data as report(), as JSON (headless scripts call this)
window.profiler.snapshot();

// Inspect measures by name (Performance API — not a method on profiler)
performance.getEntriesByName("renderCharacter", "measure");

// Clear marks/measures and reset in-profiler metrics
window.profiler.clear();

// Check if profiler is enabled
window.profiler.enabled;

// Enable/disable profiler manually
window.profiler.enable();
window.profiler.disable();
```

### Configuration

The profiler is configured in `sources/main.ts`:

```javascript
import { PerformanceProfiler } from "./performance-profiler.ts";

const profiler = new PerformanceProfiler({
  enabled: DEBUG, // Enable/disable profiler
  verbose: false, // Log all marks/measures to console
  logSlowOperations: true, // Log warnings for slow operations
});
```

## Example Output

With **`verbose: true`** in `main.ts` (or if a measure exceeds `slowThresholdMs`), you may see timing lines in the console. Slow-operation warnings use the configured threshold (default 50ms).

Call **`window.profiler.report()`** to open grouped console output: category totals (imageLoads, draws, etc.), current FPS, optional memory (Chrome), and a table of recent **`performance.measure`** entries from the User Timing API.

ZIP exports with DEBUG on log a separate group, e.g. **`ZIP export profile: splitAnimations (… ms total)`**, with a **`phase` / `ms`** table.

## Adding New Profiling Points

To profile a new operation:

```javascript
// Mark start
const profiler = window.profiler;
if (profiler) {
  profiler.mark("myOperation:start");
}

// ... do expensive work ...

// Mark end and measure
if (profiler) {
  profiler.mark("myOperation:end");
  profiler.measure("myOperation", "myOperation:start", "myOperation:end");
}
```

## Tips

- Use meaningful operation names (e.g., `render-body`, `load-sprites`)
- Add profiling marks around suspected bottlenecks
- Use `profiler.report()` or `profiler.snapshot()` to identify patterns and outliers
- Compare measurements before/after optimizations on the same machine (`profile:app` / `profile:zip`)
