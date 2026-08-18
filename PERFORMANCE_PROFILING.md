# Performance Profiling

## How to Enable Profiling

The app includes a performance profiler that is automatically enabled when:

1. Running on localhost (127.0.0.1 or localhost)
2. Adding `?debug=true` to the URL query string (overrides localhost detection)
3. Adding `?debug=false` to disable it even on localhost

The DEBUG flag and profiler are initialized in `sources/main.ts`.

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

### ZIP export (download packs)

ZIP generation uses **`createZipExportProfiler`** in `sources/performance-profiler.ts`, wired from `sources/state/zip.ts` (split-by-animation, split-by-item, split-by-animation-and-item, individual frames).

- **Embedded timings:** Exports that write `credits/metadata.json` include a **`performance`** object (`exportKind`, `totalMs`, `phasesMs`, `userAgent`).
  - In the downloaded zip: **`credits/metadata.json`** → **`performance.phasesMs`** for per-phase milliseconds.
  - Phases cover work **before** JSZip `generateAsync` (compression is omitted in that JSON to avoid double compression).
- **Console (DEBUG):** With `window.DEBUG` true (localhost or `?debug=true`), finishing an export logs a **ZIP export profile** table in the console (phases sorted by duration).
- **User Timing:** With DEBUG on, phases also emit `performance.mark` names like `zip:<exportKind>:<phase>-start` / `-end`, visible under **DevTools → Performance** when recording.
- **Split-by-item sheets** does not add `metadata.json`; use the console table and Performance marks when DEBUG is on.

- **Automation / agents:** After each export, `zipGenerateBlobWithProfiler` stores the latest `toMetadata()` snapshot on **`window.__lastZipExportProfile`** and accumulates **`window.__zipExportProfiles`** keyed by `exportKind`.
  - **Scripts:** **`npm run profile:zip`** or **`npm run profile:zip:quick`** — run headless Chromium with the default URL hash from **`scripts/zip/zip-profile-default-hash.ts`** (full outfit + weapon so custom layers show up in profiles).
  - **Output:** **`tmp/zip-export-profile.json`** or **`tmp/zip-export-profile-quick.json`** (gitignored), and the same JSON on stdout.
  - **Flags:** **`--only <kind>`** (e.g. **`npm run profile:zip -- --only splitAnimations`**) with kinds `splitAnimations`, `splitItemSheets`, `splitItemAnimations`, `individualFrames`. **`--out <path>`** overrides the JSON path. **`--quick`** uses a fake JSZip (faster; small **`generateZip`** time); default mode uses real JSZip.
  - **Setup:** Playwright browsers **`npx playwright install`**. Server port **`ZIP_PROFILE_PORT`** (default **`9877`**). Entry points: **`scripts/zip/zip-export-profile.js`**, **`scripts/zip/zip-export-profile-runner.html`**.
  - **`serve` and query strings:** Redirects may drop **`?`** params on the runner URL, so **`--quick`**, **`--only`**, and the default hash are injected via **`window.__ZIP_PROFILE_OPTS__`** before load (Playwright `addInitScript`). Opening the runner manually: preserve the query when possible, or add **`#`** plus the same hash as in **`zip-profile-default-hash.ts`** (or rely on that module’s default in the runner).

- **Baseline snapshots (local, gitignored):**
  - **`npm run profile:zip:baseline`** → **`tmp/baseline-zip-export-profile.json`**
  - **`npm run profile:zip:baseline:quick`** → **`tmp/baseline-zip-export-profile-quick.json`**
  - Compare runs: **`npm run diff:zip-profile -- tmp/baseline-zip-export-profile.json tmp/zip-export-profile.json`**, or **`node scripts/zip/diff-zip-profile.js --before … --after …`**, for per-phase deltas on the same machine/fixture.

Query param note: only **`?debug=true`** and **`?debug=false`** are recognized as overrides (`sources/utils/debug.ts`). Other values (e.g. `?debug=1`) fall through to localhost detection.

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
const profiler = new window.PerformanceProfiler({
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
- Use the profiler.report() to identify patterns and outliers
- Compare measurements before/after optimizations
