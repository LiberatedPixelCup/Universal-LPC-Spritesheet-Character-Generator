---
name: performance-profiling
description: >-
  Run the headless app and ZIP profilers and interpret the JSON the way a
  human would from window.profiler.report() and the ZIP console table. Use
  when editing sources/canvas/, load-image, renderer, zip export, zip-helpers,
  performance-profiler, or when the user mentions performance, profiling,
  slow render, FPS, or ZIP export timing.
---

# Performance profiling

Do not ask the user to open DevTools. Run the matching script, then read the
JSON or the diff. Phase names and console commands:
[PERFORMANCE_PROFILING.md](../../../PERFORMANCE_PROFILING.md).

## Which command

| What changed | Command | Notes |
| --- | --- | --- |
| `loadImage()`, `renderCharacter()`, hash hydration, preview, palette recolor | `npm run profile:app` | Live app, `?debug=true`. Default `--recolor both` (WebGL + `?recolor=cpu`). |
| Drawing, slicing, or PNG encode | `npm run profile:zip:quick` | Fake JSZip. Ignore `generateZip`. |
| Real zip packaging (`generateAsync`, `zip-helpers`) | `npm run profile:zip` | Real JSZip. Slower. |

These are not interchangeable. Match the command to the change. The ZIP pair
is not a substitute for `profile:app`, and the other way around.

**Before any of them:** `npx playwright install` once. ZIP scripts need
`dist/*-metadata.js` (`npm run dev` or `npm run build` once) and use
`npx serve`. `profile:app` starts Vite itself on `127.0.0.1:5178` (override
`APP_PROFILE_PORT`) unless you pass `--url http://127.0.0.1:5173`.

A full ZIP run can take several minutes (up to 10). App profile with both
recolor modes is usually 2–4 minutes. Request full permissions; Playwright
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
`webgl > 0` (or `cpu` if this Chromium has no GL).

**App profile** (`profiler.snapshot()`, same buckets as `profiler.report()`):

- `renderCharacter` — compositing only (not dynamic-import wait)
- `snapshot().renderCharacter.calls[]` — per-step `phasesMs` / `counters` for each completed render (`mithrilRedrawStart`, `buildDrawCalls`, `sizeCanvas`, `loadImages`, `recolor`, `draw`, `customLoad`, `customRecolor`, `customDraw`, `mithrilRedrawEnd`)
- `image-load:<path>` — one span per network load
- `hash-loadSelectionsFromHash` — URL hash hydration
- Category totals: `imageLoads`, `draws`, `previews`, `domUpdates`
- Slow-operation threshold is 50ms (`slowThresholdMs`)
- `diff:app-profile` prints `── renderCharacter phases ──` (call 0 vs call 0, call 1 vs call 1)

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

## Still ask the user

WebGL vs CPU **visual** correctness is not this skill:
[canvas-render](../canvas-render/SKILL.md). Timing both recolor paths is.
