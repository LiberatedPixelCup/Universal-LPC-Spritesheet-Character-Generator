# Lab CLS measurement

This is the walkthrough for measuring cumulative layout shift with Lighthouse
in this repo. It does **not** replace [PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md)
(`window.profiler`) or Argos visual tests.

Agent procedure: [cls](.agents/skills/cls/SKILL.md).

## 1. What this measures

Lab CLS is Lighthouse's `cumulative-layout-shift` audit on a **production**
`vite preview` of the bare homepage. It is not `window.profiler.snapshot()`,
not PageSpeed Insights field data, and not an Argos screenshot.

Google's "good" lab CLS is **≤ 0.1**. The first committed budgets in
[`scripts/profile/cls-budgets.json`](scripts/profile/cls-budgets.json) are
**regression slack around the CI median**, not that bar. Do not treat a green
`--check` as "CLS is good."

## 2. Viewports and the `mobile` name collision

Two different sizes are both called `mobile`. Mixing them is the most common
debugging error.

| Tool | Flag named `mobile` | CSS pixels | Notes |
| --- | --- | --- | --- |
| `profile:cls --preset mobile` | Lighthouse Moto G Power | **412×823** @ DPR **1.75** | `formFactor: mobile`, mobile UA, `mobileSlow4G` |
| Argos / `compute-style-dump:mobile` | Playwright `mobile` | **390×844** | iPhone-ish; **not** the CLS mobile size |
| `compute-style-dump:lighthouse-mobile` | `lighthouseMobile` | **412×823** | Dump that matches CLS mobile |

Tablet and medium desktop **are** shared with Argos:

| `profile:cls` preset | CSS pixels | Lighthouse form factor | Throttling |
| --- | --- | --- | --- |
| `tablet` | 834×1112 | `desktop` (Lighthouse has no tablet) | `desktopDense4G` |
| `mediumDesktop` | 1440×900 | `desktop` | `desktopDense4G` |

We do **not** use Lighthouse's default desktop 1350×940. DPR is 1 on tablet
and medium desktop.

## 3. Throttling, and why this is not PageSpeed

`profile:cls` sets `throttlingMethod: "devtools"` (applied throttling). The
page really waits on Slow 4G / dense 4G. That is deliberate: the shift we care
about is deferred `main.css` arriving after first paint, which simulated
throttling under-exposes (it loads unthrottled and estimates metrics).

PageSpeed Insights uses **simulated** throttling. **Our mobile number will not
equal PSI.** Matching the Moto G Power viewport and UA makes it the closest
comparable, but the value is a **regression signal**, not a PSI prediction. Do
not "fix" a gap against PSI by changing throttling.

**Localhost still under-exposes deferred CSS.** Production `index.html` links
`/assets/main-*.css` in the head. Applied Slow 4G against `127.0.0.1` still
serves that file in milliseconds, so hydrate often happens on an already-styled
page. CI medians around 0.000 / 0.003 / 0.010 (mobile / tablet / medium
desktop) with `layout-shifts` nodes populated are a successful lab of *this*
preview, not a PSI clone and not proof that tablet/desktop have no visible
jump on a real network.

To reproduce the shell→styled jump **locally**, pass `--delay-css-ms` (see
Commands). Do **not** pass that flag in `cls.yml`; budgets stay on the
un-delayed CI lab. A delayed or hosted Lighthouse run is a debug / follow-up
measurement, not a replacement for the gate.

## 4. Commands

```bash
npm run profile:cls
npm run profile:cls:baseline
npm run profile:cls:check
npm run diff:cls-profile -- tmp/baseline-cls-profile.json tmp/cls-profile.json
```

The script runs `vite build` then `vite preview` on `127.0.0.1` (default port
**4179**, override `CLS_PROFILE_PORT`) unless you pass `--url`. The measured
URL is always the bare homepage with **`?debug=false`**. `vite preview` on
loopback would otherwise auto-enable `window.DEBUG` (profiler + `debugLog`),
which production users do not get.

| Flag | Effect |
| --- | --- |
| `--preset mobile` / `tablet` / `mediumDesktop` | One viewport. Default is all three. `lighthouseMobile` is a dump preset, not a `profile:cls` flag. |
| `--repeat N` | Navigations per preset. Default **1** locally; CI uses **3**. `--check` gates on the **median**. |
| `--url http://127.0.0.1:4173` | Attach to an existing production preview (trailing slash stored). Still appends `?debug=false`. |
| `--out` / `--json` | JSON path, resolved against the repo root. Default `tmp/cls-profile.json`. `:baseline` writes `tmp/baseline-cls-profile.json`. |
| `--check` | Compare medians to `scripts/profile/cls-budgets.json`. Unknown keys in that file error. |
| `--save-lhr <path>` | Write the raw Lighthouse result for the (last) preset. How the committed fixture is refreshed. |
| `--delay-css-ms n` | **Local debug only** (not CI). Insert a proxy in front of the preview that waits `n` ms before serving `/assets/main-*.css` and `/assets/load-deferred-styles-*.css`. Use this to reproduce deferred-CSS layout shift on localhost. Default: off. With this flag, Lighthouse still uses port **4179**; `vite preview` binds **4180** (`CLS_PROFILE_PORT` + 1). Start around 2000–4000 ms. The JSON records `delayCssMs`. Never mix a delayed run into `cls-budgets.json`. |
| `--help` / `-h` | Usage. |

Chrome resolution, in order: `CHROME_PATH` (CI) → `chrome-launcher`
`getFirstInstallation()` → Playwright Chromium `executablePath()`. Unset
`PLAYWRIGHT_BROWSERS_PATH` when it points at a Cursor sandbox cache, same as
the other profilers.

`chromeFlags` are `--headless=new` and `--no-sandbox` locally and in CI. **Do
not** add `--hide-scrollbars`: that would mask wrap-driven shift.

Exit codes: `profile:cls` exits 0 on a completed run. `profile:cls:check` exits
**1** if any viewport is over budget (or a budgeted preset is missing), after
printing the table. A crashed navigation inside `--repeat` **aborts that
preset**; there is no 2-of-3 median. `diff:cls-profile` always exits 0.

Stdout is a table (preset, median, min, max; with `--check`, budget and
ok/over). Details live in the JSON. Use `process.stdout.write` /
`console.error` only.

## 5. Reading the JSON

- **Score:** `cumulative-layout-shift.numericValue` is the CLS. The audit
  `score` (0–1) is Lighthouse's rating of that value, not the metric.
- **Culprits** are **not** in the CLS audit's `details` (`debugdata` has no
  nodes). They come from the separate **`layout-shifts`** table: a `node` per
  row, plus `subItems` root causes (font request, unsized image, DOM
  insertion, …). `layout-shift-elements` was removed from Lighthouse.
- If `layout-shifts` is missing, the script falls back to
  `cls-culprits-insight`. If both are missing, **nodes are empty and a
  warning is printed** — that is not "no shift."
- `--check` and the printed table use the **median** of `--repeat` samples.
  The JSON keeps every sample plus min / median / max.
- **Provenance** (treat two runs without these as incomparable):
  `lighthouseVersion`, Chrome path, `chromeFlags`, `throttlingMethod`,
  throttling profile, UA, `process.platform`, preset width × height,
  `delayCssMs` (0 means no CSS-delay proxy).
- Raising a budget is a **deliberate commit**, same rule as
  `metadata:size:check`. Never paste a laptop median into
  `cls-budgets.json`.

## 6. Local vs CI, and reading the artifact

Budgets are **CI medians plus slack**, not laptop numbers. macOS vs Linux
differs on fonts, scrollbars, and CPU. Compare local-to-local; treat GitHub
as the gate.

How to get the CI numbers:

1. Open the **CLS (Lighthouse)** check on the workflow run (`.github/workflows/cls.yml`).
2. Artifacts → **`cls-profile`**.
3. Inside: `tmp/cls-profile.json`.
4. Read each preset's `summary.median`, plus `lighthouseVersion` and Chrome
   provenance, before rewriting budgets.

Every re-baseline reads that file. Do not skip it.

## 7. Finding the shifter

1. Open `tmp/cls-profile.json` and read `layout-shifts` nodes (selector +
   score + `subItems`).
2. Map the node to a dump target: `#header-left`, `#mithril-filters > div`,
   the download box, a `.loading-shell-*` class.
3. Only then use DevTools Performance → Experience. Agents: do not ask the
   user for DevTools when the JSON already names the node.

## 8. Debugging with computed-style dumps

Dumps are **post-hydrate with all CSS loaded**. They are not a CLS score and
do not snapshot first paint — the `.loading-shell-*` nodes are already gone.

Use them to:

- Read the **settled** `__rect` / height of the panel that shifted, so a
  loading-shell `min-height` can match it.
- Diff master vs branch when deferred CSS or a font change moved hydrated
  layout.

Match the CLS viewport:

| CLS preset | Dump command |
| --- | --- |
| `mobile` (412×823) | `npm run compute-style-dump:lighthouse-mobile` — **not** `compute-style-dump:mobile` (Argos 390×844) |
| `tablet` | `npm run compute-style-dump -- --preset tablet` |
| `mediumDesktop` | `npm run compute-style-dump -- --preset mediumDesktop` |

Two-worktree diff: dump both preview URLs with the **same** preset, then
`diff -u`. `compute-style-diff-all` stays on Argos presets, so dump
`lighthouseMobile` separately for CLS mobile.

Read `__rect`, `__layout`, header wrap metrics, `#mithril-filters > div`
height; compare to `.loading-shell-*` `min-height` in
[`styles/critical-shell.css`](styles/critical-shell.css).

**Limitation:** a jump that exists only between first paint and hydrate will
never appear as a single-URL dump diff. That needs `layout-shifts` nodes or a
Performance recording.

## 9. How to fix

Later plans. This repo does not change loading-shell CSS in the measurement
PR. When you do:

- Put loading-shell `min-height` on the **children** Mithril replaces, never
  on the mount roots (`#mithril-filters`, `#mithril-preview`,
  `#mithril-spritesheet-preview`).
- Pin **metrics** on `#header-left` / download chrome. Do not use a single
  `min-height` floor: wrapping varies inside a breakpoint, and Argos flags
  the sub-pixel drift.
- Keep the font stack, rem, collapsible chrome, and `h3.title` in the
  critical bundle.
- Add `@media` on `.loading-shell-*` only when stacked vs `is-desktop`
  heights genuinely differ.
- After CSS: `npm run profile:cls -- --preset <affected>` **and**
  `npm run test:visual`. Argos mobile is still 390×844, so a 412-only tweak
  can move those screenshots.

## 10. Upgrading Lighthouse and chrome-launcher

Two packages, two procedures. **Never** `npm update lighthouse` (or a caret
bump) as a drive-by with unrelated CSS. A Lighthouse bump is a
measurement-definition change and must re-baseline budgets from **CI**, same
rule as raising `metadata:size` limits.

Do not confuse **`chrome-launcher` (npm)** with **Chrome the browser**. CI
installs Chrome via `browser-actions/setup-chrome` `chrome-version: latest`.
That binary can move CLS with no `package.json` change. If a CLS PR is red
and nobody bumped Lighthouse, check the workflow log for Chrome version
against the JSON provenance field.

### Lighthouse (defines CLS)

Pinned **exact** in `package.json` (no caret).

1. Read the Lighthouse changelog for CLS, `layout-shifts`, and insights
   audits. If the culprit audit ID moved, update `extractClsSample` and the
   committed LHR fixture **before** trusting a run.
2. Install an exact version, still no caret:

   ```bash
   npm install --save-dev lighthouse@x.y.z
   ```

   If the lockfile conflicts after a rebase, `npm run lockfile:fix` — never
   `npm install` to "resolve" it.
3. Run `node --test tests/node/scripts/profile/cls-profile_spec.ts`. If
   `layout-shifts` vanished from a real LHR, the fallback chain must still
   return empty nodes rather than throw; then extend the chain and refresh
   the fixture with `--save-lhr`.
4. Do **not** set `cls-budgets.json` from a laptop run.
5. Push the version bump (and any extract/fixture edits) and wait for
   `cls.yml`. Read `tmp/cls-profile.json` from the artifact: confirm
   `lighthouseVersion` is the new pin, culprits are still populated (or the
   warning is expected), and record each preset's median.
6. In **the same PR**, write new budgets (CI median + the usual slack, about
   +0.02 or ~20%, whichever is larger) and keep `:check` on. If the new
   median is *lower*, still rewrite the file so slack is relative to the new
   measurement, not a mix of two Lighthouse versions.
7. PR description: old pin → new pin, per-preset old median / new median /
   new budget, and whether the culprit audit ID changed.

If Lighthouse and first-paint CSS land in one PR, you cannot tell a metric
change from a layout change. Split them.

### chrome-launcher (finds Chrome)

Caret range, not an exact pin. Bump only when Lighthouse's range requires it,
`getFirstInstallation()` / launch flags break, or Chrome discovery fails
locally.

```bash
npm install --save-dev chrome-launcher@^x.y.z
```

Keep a caret. Commit the lockfile; `lockfile:fix` on rebase conflicts.

Smoke: `npm run profile:cls -- --preset mobile --url http://127.0.0.1:4173`
against an existing preview (or a full run). Confirm Chrome still launches
(`CHROME_PATH` on CI, installed Chrome locally, Playwright Chromium
fallback).

**Do not** rebase `cls-budgets.json` for a launcher-only bump unless CI CLS
actually moved. A launcher bump that also changes default `chromeFlags` *can*
move CLS; compare provenance `chromeFlags` in the new artifact to the
previous one. If flags changed, treat it like a Lighthouse bump and
re-baseline from CI in the same PR.

### Chrome in CI (not an npm package)

`setup-chrome@v2` with `chrome-version: latest` is intentionally floating.
Pinning a Chrome major in `cls.yml` is a later decision if budget churn from
Chrome updates becomes the main noise. Until then: if CLS fails and
`package.json` is unchanged, diff Chrome version in the artifact vs the last
green run before raising budgets or reverting layout.

## 11. CI

[`.github/workflows/cls.yml`](.github/workflows/cls.yml) is an independent
check named **CLS (Lighthouse)**. It runs on `push` / `pull_request` to
`master` (no `paths` filters; fork PRs work on plain `pull_request`). Node 24,
`ubuntu-latest`.

- Chrome via `browser-actions/setup-chrome`; `CHROME_PATH` from the action
  output.
- **Same font packages as** [`visual.yml`](.github/workflows/visual.yml)
  (`fonts-liberation`, `fonts-dejavu`, Noto CJK / color-emoji,
  `fonts-freefont-ttf`, `fonts-wqy-zenhei`). Wrap — and therefore CLS — is
  font-metric-dependent.
- **rsync** is installed. `vite build` shells out to `rsync -ahu --delete
  --info=progress2` on Linux (`--info=progress2` needs rsync 3.x). A missing
  rsync fails the build, which reads as a CLS failure.
- Until budgets exist, the job is **report-only**:
  `npm run profile:cls -- --repeat 3`. After
  `cls-budgets.json` is committed from a CI artifact, the step becomes
  `npm run profile:cls:check -- --repeat 3`.
- Uploads `tmp/cls-profile.json` as artifact `cls-profile`, `if: always()`.
- Timeout ~30 minutes: production build plus **9** applied-throttling
  navigations (3 presets × 3 repeats). A timeout is not a CLS regression.
- The check fails only when a viewport **exceeds the committed budget**, not
  when CLS is above Google's 0.1.

## 12. Known risks

Each item: what it looks like, what to do.

**Audit-ID drift.** `layout-shift-elements` is gone; `layout-shifts` exists
since Lighthouse 11.5; insights IDs still move. Empty culprits plus a warning
means the fallback chain missed a rename — extend `extractClsSample` and the
fixture. Do not treat empty nodes as "no shift."

**Trace window.** If CLS looks near-zero while loading shells clearly jump,
Lighthouse closed the trace before hydrate. Do not lower budgets. Raise
`pauseAfterLoadMs` / `cpuQuietThresholdMs` (the script already applies
Lighthouse `nonSimulatedSettingsOverrides`) or re-validate with a
`PerformanceObserver({ type: "layout-shift" })` through catalog-ready.

**CI runtime.** Nine applied-throttling navigations make this the slowest new
job. A timeout is not a CLS regression; raise `timeout-minutes` if the build
itself is healthy.

**`npm ci` cost.** Lighthouse's tree slows **every** workflow that runs
`npm ci`, not only `cls.yml`. That cost was accepted for a pinned version
instead of `npx lighthouse` at CI time.

**Budget churn.** Fonts, CI Chrome (`setup-chrome` `latest`), or a Lighthouse
pin change can move medians with no layout commit. Re-baseline from CI (see
upgrading). Do not widen slack to hide it.

**Not PageSpeed.** Applied `devtools` throttling vs PSI `simulate`. A gap vs
PSI is expected.

**Localhost CSS is not Slow 4G.** Un-delayed `profile:cls` on `127.0.0.1` can
read ~0 while PSI is ~0.09 because `main-*.css` is local. Use
`--delay-css-ms` locally (or a hosted preview) to see the jump. Do not put
`--delay-css-ms` on `cls.yml` or paste a delayed median into budgets.

**`--delay-css-ms` is not CI.** Mixing it into the gate would make a CSS-timing
change and a layout change look the same, and would add ~3s per stylesheet
request on every navigation.

**Local ≠ CI.** macOS vs Linux fonts and scrollbars. Never paste a laptop
median into `cls-budgets.json`.

**`mobile` name collision.** CLS 412×823 vs Argos/dump 390×844.
`compute-style-dump:mobile` is the wrong dump for CLS mobile.

**Dumps miss first paint.** Post-hydrate only. A hydrate-only jump will not
show as a single-URL dump diff.

**`?debug=false`.** Omitting it on localhost enables the profiler and is not
what production users get.

**A dropped run is not a zero.** A failed navigation aborts the preset. Never
let a missing sample or missing `numericValue` become 0 or a 2-of-3 median.
`runtimeError` on the LHR fails the run even if the CLS audit looks fine.
