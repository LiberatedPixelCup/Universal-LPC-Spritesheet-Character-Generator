# Performance Profiling

## How to Enable Profiling

The app includes a performance profiler that is automatically enabled when:

1. Running on localhost (127.0.0.1 or localhost)
2. Adding `?debug=true` to the URL query string (overrides localhost detection)
3. Adding `?debug=false` to disable it even on localhost

The DEBUG flag and profiler are initialized in `sources/main.ts`. Only `?debug=true` and `?debug=false` override localhost detection (`sources/utils/debug.ts`). Other values (for example `?debug=1`) fall through to the localhost check.

`?recolor=cpu` forces the CPU palette path **before first paint** (`getRecolorParam()` in `sources/utils/debug.ts`, applied in `sources/canvas/palette-recolor.ts`). `window.setPaletteRecolorMode("cpu")` still works from the console after load, but does not rewind the first render.

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
- **Phases:** `profiler.snapshot().renderCharacter.calls[]` — one report per completed `runRenderCharacter`. Each report has `totalMs`, `phasesMs`, `unaccountedMs`, and `counters`. Phase keys: `mithrilRedrawStart`, `buildDrawCalls`, `sizeCanvas`, `loadImages`, `recolor`, `draw`, `customLoad`, `customRecolor`, `customDraw`, `mithrilRedrawEnd`. Counters include `drawCalls`, `selections`, `customAnims`, canvas size, and image/recolor cache hits vs loads/misses. `diff:app-profile` prints a `── renderCharacter phases ──` section (per call index). Unit tests lock those counters as a work budget in [`tests/canvas/render-work_spec.ts`](tests/canvas/render-work_spec.ts); this document and `npm run profile:app` are the timing check, not that budget.

### Headless app profiler

Use these when **`loadImage()`**, **`renderCharacter()`**, hash hydration, or palette recolor changed. They open Chromium (headless Playwright Chromium by default), drive the live app the way a human would (`?debug=true`, wait for catalog + first paint, change the selection once), then write **`profiler.snapshot()`** — the same data as **`window.profiler.report()`**, as JSON. The JSON also records **`renderer`** (`WEBGL_debug_renderer_info`: vendor, renderer, unmasked vendor/renderer). Headless Playwright Chromium is usually SwiftShader (software GL). For a real GPU, pass **`--headed --channel chrome`** (installed Google Chrome, Metal/D3D). That combination fails if the unmasked renderer still looks like SwiftShader / llvmpipe.

Default **`--recolor both`** runs that sequence twice: WebGL (Chromium default) and **`?recolor=cpu`**. The JSON `profiles.webgl` / `profiles.cpu` objects include `activeMode` and `recolorStats` so you can confirm the CPU path actually ran. `diff:app-profile` prints both sections.

They do **not** replace checking WebGL and the CPU fallback **visually**; for that, see [Force CPU Mode](PALETTE_RECOLOR_GUIDE.md#force-cpu-mode-testing). They are also not a substitute for the ZIP scripts below.

**Before you run**

1. Install Chromium once: `npx playwright install`
2. The script starts Vite itself on `127.0.0.1` (default port `5178`, override with `APP_PROFILE_PORT`). Pass `--url http://127.0.0.1:5173` to attach to an already-running `npm run dev` instead.

**Compare to a baseline**

Take a baseline on the same machine, then diff after your change.

```bash
npm run profile:app:baseline -- --headed --channel chrome
# …make your change…
npm run profile:app -- --headed --channel chrome
npm run diff:app-profile -- tmp/baseline-app-profile.json tmp/app-profile.json
```

Omit `--headed --channel chrome` for the default headless Playwright Chromium (usually SwiftShader). Do not diff a GPU baseline against a headless run. The JSON `renderer.unmaskedRenderer` and the `headed` / `channel` fields record which path you used.

A positive Δ means the after run was slower. Look at `renderCharacter` phases (`snapshot().renderCharacter.calls`), `image-load:*`, and `hash-loadSelectionsFromHash`. A few milliseconds is noise; `renderCharacter` can swing tens of ms between two runs on the same machine.

JSON lands under `tmp/` (gitignored) and is also printed on stdout. Pass `--out <path>` to write somewhere else.

**Optional**

- One recolor path only: `npm run profile:app -- --recolor webgl` or `--recolor cpu`
- Custom selections: `npm run profile:app -- --hash 'sex=male&body=Body_Color_light' --hash2 '…'`
- Real GPU (headed Google Chrome): `npm run profile:app -- --headed --channel chrome` (same flags on `profile:app:baseline`)
- The default first hash is the full outfit in `scripts/zip/zip-profile-default-hash.ts`. The default second hash drops layered gear (body + head + expression only).

### Headless catalog load profiler

Use this when **catalog bootstrap** changed (`loadAllMetadata`, metadata chunks, `install-item-metadata.ts`). `profile:app` cannot answer “did the app load faster”: it starts **Vite serve** (pretty-printed metadata) and constructs `window.profiler` **after** `createLoadedCatalog()`.

`npm run profile:load` does `vite build` then `vite preview` on `127.0.0.1` (default port `4178`, override `APP_LOAD_PROFILE_PORT`), opens Chromium with `?debug=true`, and repeats a fresh-page `goto` + `waitForHomepageReady` (default `--repeat 5`). Pass `--url http://127.0.0.1:4173` to attach to an already-running preview.

It prints median / min / max for:

- `navigation.duration`
- `indexReadyMs` — navigation time origin to `__LPC_waitCatalogIndexReady()` resolving (`performance.now()`). Hash hydration and `initCanvas()` wait on this plus lite.
- `liteReadyMs` — navigation time origin to `__LPC_waitCatalogLiteReady()` resolving
- `catalogReadyMs` — navigation time origin to `__LPC_waitCatalogAllReady()` resolving (credits, palette, and layers too)
- `catalog-load` and `catalog-chunk:*` User Timing (`index`, `item`, `credits`, `palette`, `layers`)
- metadata resource entries (`*-metadata*`) with `transferSize`, `decodedBodySize`, `duration`

Those User Timing names are always recorded in `loadAllMetadata` (not `window.profiler`). JSON lands under `tmp/` (gitignored).

**Compare to a baseline**

```bash
npm run profile:load:baseline
# …make your change…
npm run profile:load
npm run diff:app-load-profile -- tmp/baseline-app-load-profile.json tmp/app-load-profile.json
```

A positive Δ means the after run was slower. A few milliseconds is noise. Treat a **50 ms+** move on `indexReadyMs` or `liteReadyMs` median as worth a second look (first-paint gates; same bar as the live profiler’s slow-operation threshold). A 50 ms+ move on `catalogReadyMs` alone can be the credits/palette tail; note it, but do not treat it as the intern’s load verdict. `diff:app-load-profile` always exits 0.

### Metadata size (generator output)

`npm run metadata:size` regenerates the five metadata modules **in memory** (no `dist/`, no Vite) and reports raw, gzip, and brotli bytes per module plus the item + index pair. This is a **proxy for Vite's bundled-chunk warning**, not the built `dist/assets/*.js` sizes.

`npm run metadata:size:check` runs the same generation and exits non-zero if **`item-metadata.js` raw exceeds 500 KiB** (Vite's 500 kB warning; current interned emit is ~393 KiB, so the extra is headroom) or the **item + index pair raw exceeds 600 KiB** (so intern cannot shuffle bytes into `index-metadata.js`). CI runs that check in **Validate site sources** after the git-diff assert. Raising a budget is a deliberate commit, not a drive-by. Load time is local (`profile:load`), not this gate.

```bash
npm run metadata:size
npm run metadata:size:check
npm run metadata:size -- --json tmp/baseline-metadata-size.json --bench
npm run metadata:size -- --baseline tmp/baseline-metadata-size.json
```

`--bench` times `JSON.parse` of the lite payload and `expandInternedItemLite` across every item (median of ~40 runs). Compare on the same machine.

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

// Per-step renderCharacter timings (phasesMs, counters)
window.profiler.snapshot().renderCharacter.calls;

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
- Compare measurements before/after optimizations on the same machine (`profile:app` / `profile:load` / `profile:zip` / `metadata:size`)
