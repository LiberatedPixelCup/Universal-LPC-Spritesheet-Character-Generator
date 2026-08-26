---
name: performance-profiling
description: >-
  Run the headless app, catalog-load, and ZIP profilers and interpret the JSON
  the way a human would from window.profiler.report(), profile:load, and the
  ZIP console table. Use when editing sources/canvas/, load-image, renderer,
  zip export, zip-helpers, performance-profiler, install-item-metadata,
  loadAllMetadata, or when the user mentions performance, profiling, slow
  render, FPS, catalog load, or ZIP export timing.
---

# Performance profiling

Do not ask the user to open DevTools. Run the matching script, then read the
JSON or the diff. Phase names and console commands:
[PERFORMANCE_PROFILING.md](../../../PERFORMANCE_PROFILING.md).

## Which command

| What changed | Command | Notes |
| --- | --- | --- |
| `loadImage()`, `renderCharacter()`, hash hydration, preview, palette recolor | `npm run profile:app` | Live app, `?debug=true`. Default `--recolor both` (WebGL + `?recolor=cpu`). Headless Playwright Chromium is SwiftShader; real GPU: `--headed --channel chrome`. |
| `loadAllMetadata`, metadata chunks, catalog bootstrap | `npm run profile:load` | Production `vite preview`, not Vite serve. Median of 5 navigations. Port `4178` (`APP_LOAD_PROFILE_PORT`). |
| Generated metadata payload bytes | `npm run metadata:size` / `metadata:size:check` | Generator output, not Vite chunks. CI gates 500 KiB item / 600 KiB pair. |
| Drawing, slicing, or PNG encode | `npm run profile:zip:quick` | Fake JSZip. Ignore `generateZip`. |
| Real zip packaging (`generateAsync`, `zip-helpers`) | `npm run profile:zip` | Real JSZip. Slower. |

These are not interchangeable. Match the command to the change. The ZIP pair
is not a substitute for `profile:app`, and `profile:load` is not a substitute
for either (Vite serve pretty-prints metadata; `window.profiler` starts after
catalog import).

**Before any of them:** `npx playwright install` once. ZIP scripts need
`dist/*-metadata.js` (`npm run dev` or `npm run build` once) and use
`npx serve`. `profile:app` starts Vite serve on `127.0.0.1:5178` (override
`APP_PROFILE_PORT`) unless you pass `--url http://127.0.0.1:5173`.
`profile:load` runs `vite build` then `vite preview` on `127.0.0.1:4178`
unless you pass `--url`.

A full ZIP run can take several minutes (up to 10). App profile with both
recolor modes is usually 2–4 minutes. `profile:load` is a production build
plus five homepage navigations. Request full permissions; Playwright
needs a real browser. If `PLAYWRIGHT_BROWSERS_PATH` points at a Cursor
sandbox cache, the script unsets it.

## Workflow

If the change is **not yet made**, take a baseline first. Use the matching
pair (`:quick` with `:quick`, `profile:app` with `profile:app`).

```bash
npm run profile:app:baseline
# …make the change…
npm run profile:app
npm run diff:app-profile -- tmp/baseline-app-profile.json tmp/app-profile.json
```

Catalog bootstrap / metadata payload:

```bash
npm run profile:load:baseline
# …make the change…
npm run profile:load
npm run diff:app-load-profile -- tmp/baseline-app-load-profile.json tmp/app-load-profile.json
```

A few milliseconds on `indexReadyMs` / `liteReadyMs` is noise; 50 ms+ median
is worth a second look (first-paint gates). A 50 ms+ move on
`catalogReadyMs` alone can be the credits/palette tail. `diff:app-load-profile`
always exits 0.

`diff:app-profile` prints **two** sections when both files contain both
modes: `======== webgl ========` and `======== cpu ========`. Compare
like-with-like. One mode only: `--recolor webgl` or `--recolor cpu`.

```bash
npm run profile:zip:baseline:quick
npm run profile:zip:quick
npm run diff:zip-profile -- tmp/baseline-zip-export-profile-quick.json tmp/zip-export-profile-quick.json
```

If the change is **already made** and `tmp/baseline-*.json` exists from this
machine, diff against it. If there is no baseline, report the absolute
numbers and flag outliers. Do not invent a baseline after the fact.

JSON lands under `tmp/` (gitignored) and is also printed on stdout.

## Interpreting

A positive Δ means the after run was slower. Compare on the same machine.
A few milliseconds is noise. `renderCharacter` can swing tens of ms between
two runs; repeat once if a single Δ is the only evidence.

Confirm `activeMode` and `recolorStats` in each section: CPU must show
`activeMode: cpu` and `cpu > 0` if the outfit recolours. WebGL should show
`webgl > 0` (or `cpu` if this Chromium has no GL). Confirm `renderer`
(`unmaskedRenderer`): SwiftShader / llvmpipe is software GL, not the user's
GPU. Hardware looks like `ANGLE (Apple, … Metal …)` or an NVIDIA/AMD name.
`--headed --channel chrome` fails the run if the renderer is still software.

**App profile** (`profiler.snapshot()`, same buckets as `profiler.report()`):

- `renderCharacter` — compositing only (not dynamic-import wait)
- `snapshot().renderCharacter.calls[]` — per-step `phasesMs` / `counters` for each completed render (`mithrilRedrawStart`, `buildDrawCalls`, `sizeCanvas`, `loadImages`, `recolor`, `draw`, `customLoad`, `customRecolor`, `customDraw`, `mithrilRedrawEnd`)
- `image-load:<path>` — one span per network load
- `hash-loadSelectionsFromHash` — URL hash hydration
- Category totals: `imageLoads`, `draws`, `previews`, `domUpdates`
- Slow-operation threshold is 50ms (`slowThresholdMs`)
- `diff:app-profile` prints `── renderCharacter phases ──` (call 0 vs call 0, call 1 vs call 1)

**Catalog load profile** (`profile:load`, production `vite preview`):

- `indexReadyMs` — navigation time origin to `__LPC_waitCatalogIndexReady()`
- `liteReadyMs` — navigation time origin to `__LPC_waitCatalogLiteReady()` (hash / `initCanvas` wait on index+lite)
- `catalogReadyMs` — navigation time origin to `__LPC_waitCatalogAllReady()` (credits, palette, layers too)
- `catalog-load` / `catalog-chunk:*` — User Timing around each metadata import
- metadata `*-metadata*` resources — `transferSize`, `decodedBodySize`, `duration`
- A few milliseconds is noise; 50 ms+ on `indexReadyMs` or `liteReadyMs` median is worth a second look

**ZIP profile** (`phasesMs` / metadata):

- `render_imageLoadDecode_*` / `render_composite_*`
- `drawAndSlice`, `pngEncode`, `zipFile`, `staticFiles`
- `generateZip` — only meaningful on the real-JSZip run

The default character is the full outfit in
[`zip-profile-default-hash.ts`](../../../scripts/zip/zip-profile-default-hash.ts),
not whatever was last open in a browser. `profile:app` then deselects the
layered gear (body + head + expression only).

Limit one ZIP export: `npm run profile:zip -- --only splitAnimations`
(also `splitItemSheets`, `splitItemAnimations`, `individualFrames`).
Custom app hashes: `npm run profile:app -- --hash '…' --hash2 '…'`.
Real GPU: `npm run profile:app -- --headed --channel chrome` (and the same
flags on `profile:app:baseline`). Compare GPU baselines only to GPU runs.

## Still ask the user

WebGL vs CPU **visual** correctness is not this skill:
[canvas-render](../canvas-render/SKILL.md). Timing both recolor paths is.
