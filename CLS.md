# Lab CLS measurement

This is the walkthrough for measuring cumulative layout shift with Lighthouse
in this repo. It does **not** replace [PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md)
(`window.profiler`) or Argos visual tests.

Agent procedure: [cls](.agents/skills/cls/SKILL.md).

## 1. What this measures

Lab CLS is Lighthouse's `cumulative-layout-shift` audit on a **production**
`vite preview` of the bare homepage. It is not `window.profiler.snapshot()`,
not PageSpeed Insights field data, and not an Argos screenshot.

Google's "good" lab CLS is **≤ 0.1**. There are **two labs**, and a green
un-delayed `--check` is not "the jump is gone":

- Un-delayed
  [`scripts/profile/cls-budgets.json`](scripts/profile/cls-budgets.json) is
  the **hydrate floor** (CSS already on the page). Slack around the
  un-delayed CI median, not Google's bar.
- Delayed CI (`--delay-css-ms 3000`, `CLS_CI_DELAY_CSS_MS`) is the **jump
  gate**. Budgets live in
  [`scripts/profile/cls-budgets-delayed.json`](scripts/profile/cls-budgets-delayed.json)
  (`delayCssMs` 3000). A green delayed `--check` is slack around that lab,
  not Google's 0.1.

Do not treat either green run as "CLS is good."

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

**Localhost still under-exposes deferred CSS on the un-delayed lab.**
Production `index.html` links `/assets/main-*.css` in the head. Applied Slow
4G against `127.0.0.1` still serves that file in milliseconds, so hydrate
often happens on an already-styled page. Un-delayed CI medians around 0.000 /
0.003 / 0.010 (mobile / tablet / medium desktop) with `layout-shifts` nodes
populated are a successful lab of *this* preview, not a PSI clone and not
proof that tablet/desktop have no visible jump on a real network.

The **delayed** CI step (`profile:cls:check:delayed`, `--delay-css-ms 3000`)
is the tablet / medium-desktop jump lab. Local `--delay-css-ms` at a value
other than that pin is still debug, not a budget source. Never write a
delayed median into `cls-budgets.json`.

## 4. Commands

```bash
npm run profile:cls
npm run profile:cls:baseline
npm run profile:cls:check
npm run profile:cls:delayed
npm run profile:cls:baseline:delayed
npm run profile:cls:check:delayed
npm run diff:cls-profile -- tmp/baseline-cls-profile.json tmp/cls-profile.json
npm run diff:cls-profile -- tmp/baseline-cls-profile-delayed.json tmp/cls-profile-delayed.json
```

The script runs `vite build` then `vite preview` on `127.0.0.1` (default port
**4179**, override `CLS_PROFILE_PORT`) unless you pass `--url` or
`--skip-build`. `--skip-build` reuses existing `dist/` and still starts
preview. The measured URL is always the bare homepage with **`?debug=false`**.
`vite preview` on loopback would otherwise auto-enable `window.DEBUG`
(profiler + `debugLog`), which production users do not get.

| Flag | Effect |
| --- | --- |
| `--preset mobile` / `tablet` / `mediumDesktop` | One viewport. Default is all three. `lighthouseMobile` is a dump preset, not a `profile:cls` flag. Combined with `--check`, only the measured viewport is gated (CI omits `--preset` and checks all three). |
| `--repeat N` | Navigations per preset. Default **1** locally; CI uses **3**. `--check` gates on the **median**. |
| `--url http://127.0.0.1:4173` | Attach to an existing production preview (trailing slash stored). Still appends `?debug=false`. With `--delay-css-ms`, Lighthouse navigates the **proxy**, not this origin. The proxy listens HTTP on loopback; an `https://` `--url` uses TLS (`node:https.request`) to the preview — plaintext `http.request` to port 443 is a 502, not a jump lab. A self-signed cert fails verification and 502s. Skips `vite build` and `vite preview`. |
| `--skip-build` | Reuse existing `dist/` and still spawn `vite preview`. Fails if `dist/index.html` is missing. CI uses this after a dedicated **Build production** step so rsync noise is not in the Lighthouse log. |
| `--out` / `--json` | JSON path, resolved against the repo root. Default `tmp/cls-profile.json`. `:baseline` writes `tmp/baseline-cls-profile.json`. |
| `--check` | Compare **measured** viewport medians to the budgets file (`--budgets`, default `scripts/profile/cls-budgets.json`). Unknown keys in that file error. `--check --preset tablet` gates tablet only. |
| `--budgets <path>` | Budget JSON for `--check`, resolved against the repo root. Default `scripts/profile/cls-budgets.json`. Delayed check passes `scripts/profile/cls-budgets-delayed.json`. |
| `--save-lhr <path>` | Write the raw Lighthouse result **before** extract. One preset: that path as-is. Several: `-<preset>` before the extension. A missing CLS audit or `runtimeError` still leaves the dump. Use it to inspect a failed run (see Local vs CI) and to refresh the committed fixture (see Upgrading). |
| `--delay-css-ms n` | Insert a proxy that waits `n` ms before serving hashed production CSS under `/assets/*.css` (not `.css.map`). Same set the HTML plugin reorders. Default: off. CI delayed step is pinned at **3000** (`CLS_CI_DELAY_CSS_MS` in `cls-profile.ts`; `profile:cls:check:delayed`). Local debug may use another value; that is not a budget source. The JSON records `delayCssMs` and `delayedStylesheetHits`. A delayed run that matched **0** stylesheets fails after writing JSON — that is not a green jump lab. Never write a delayed median into `cls-budgets.json`. **Ports:** with no `--url`, proxy listens on **4179** and `vite preview` on **4180**. With `--url http://127.0.0.1:4173/`, proxy listens on **4179** and Lighthouse uses that origin (CSS is delayed). With `--url` already on **4179**, proxy listens on **4180** so it does not collide with the preview. The proxy rewrites `Host` to the preview origin (for example `127.0.0.1:4180`), not the listen port. CI delayed uses `CLS_PROFILE_PORT=4188` (proxy 4188 / preview 4189; `CLS_CI_DELAYED_PROFILE_PORT`) so a leftover un-delayed preview cannot `EADDRINUSE` the second step. `waitForHttpOk` probes with `node:http`, not `fetch`, so a port undici refuses as "bad" (4190 / ManageSieve) surfaces the real error instead of a 120 s timeout. |
| `--help` / `-h` | Usage. |

Chrome resolution, in order: `CHROME_PATH` (CI) → `chrome-launcher`
`getFirstInstallation()` → Playwright Chromium `executablePath()`. Unset
`PLAYWRIGHT_BROWSERS_PATH` when it points at a Cursor sandbox cache, same as
the other profilers.

`lighthouse@13.4.1` requires **Node ≥ 22.19**. The repo `engines.node` matches
that; CI is Node 24.

`chromeFlags` are `--headless=new` and `--no-sandbox` locally and in CI. **Do
not** add `--hide-scrollbars`: that would mask wrap-driven shift.

Exit codes: `profile:cls` exits 0 on a completed run. `profile:cls:check` and
`profile:cls:check:delayed` exit **1** if a **measured** viewport is over
budget (or that preset is missing from the budgets file), after printing the
table. `--check` validates the budgets file **before** measuring,
so a missing or malformed file (including a bad `--budgets` path) fails in
seconds rather than after a full run. A delayed run that matched 0
`/assets/*.css` files also exits **1** (after writing JSON).
A crashed navigation inside `--repeat` **aborts that preset**; there is no
2-of-3 median. `diff:cls-profile` always exits 0.

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
- `onlyAudits` requests `cumulative-layout-shift`, `layout-shifts`, and
  `cls-culprits-insight`. The insight audit is a declared replacement for
  the table; requesting both keeps the fallback real if Lighthouse drops
  `layout-shifts`.
- If `layout-shifts` is missing **or present with no parseable nodes**, the
  script falls back to `cls-culprits-insight`. That audit is a list of
  tables and prepends a synthetic **Total** row (`node.type === "text"`)
  per cluster; the extractor skips those so they are not ranked as
  culprits. If both audits are missing or yield no nodes, **nodes are
  empty and a warning is printed** — that is not "no shift."
- `--check` and the printed table use the **median** of `--repeat` samples.
  The JSON keeps every sample plus min / median / max.
- **Provenance** (treat two runs without these as incomparable):
  `lighthouseVersion`, Chrome path, `chromeFlags`, `throttlingMethod`,
  throttling profile, `process.platform`, preset width × height,
  `delayCssMs` (0 means no CSS-delay proxy) and `delayedStylesheetHits`
  (stylesheet GETs the proxy actually held; a delayed run with 0 hits
  fails). `chromeFlags` is the literal `CLS_CHROME_FLAGS` this script
  passes, **not** the resolved command line — `chrome-launcher` prepends its
  own defaults, and those are not recorded.
- **Two UAs, and they answer different questions.** `hostUserAgent` is the
  browser that ran the lab, so it carries the Chrome build
  (`HeadlessChrome/<version>`) — that is the field to diff when CI Chrome
  floats. `emulatedUserAgent` is what the page was served and is fixed by
  the preset, so it moves only when Lighthouse changes its UA strings.
- Raising a budget is a **deliberate commit**, same rule as
  `metadata:size:check`. Never paste a laptop median into
  `cls-budgets.json`. Never paste a delayed median into that file.

## 6. Local vs CI, and reading the artifact

Budgets are **CI medians plus slack**, not laptop numbers. macOS vs Linux
differs on fonts, scrollbars, and CPU. Compare local-to-local; treat GitHub
as the gate. Re-baseline each budget file from its matching JSON
(`delayCssMs` 0 vs 3000).

How to get the CI numbers:

1. Open the **CLS (Lighthouse)** check on the workflow run (`.github/workflows/cls.yml`).
2. Artifacts → **`cls-profile`**.
3. Inside, at the artifact **root** (GitHub `upload-artifact` strips the
   common `tmp/` prefix): `cls-profile.json` (un-delayed) and
   `cls-profile-delayed.json` (`delayCssMs` 3000).
4. Read each preset's `summary.median`, plus `lighthouseVersion`,
   `delayCssMs`, `delayedStylesheetHits` (must be ≥ 1 on the delayed file),
   and Chrome provenance, before rewriting the matching budgets file.

There is no raw Lighthouse result in the artifact. Culprits in those JSON
files are enough for a normal over-budget failure. If nodes are empty, the
run printed the empty-culprits warning, or you need Lighthouse's own tables,
re-run the **same** `--preset` locally with `--save-lhr` and the **same
delay as that lab** (none vs `--delay-css-ms 3000`):

```bash
npm run profile:cls -- --preset tablet --repeat 1 --save-lhr tmp/lhr-tablet.full.json
npm run profile:cls:delayed -- --preset tablet --repeat 1 --save-lhr tmp/lhr-tablet-delayed.full.json
```

Do not use those dumps as a budget. Do not compare them to
`tests/fixtures/lighthouse/lhr-delayed.json` (a delayed local trim for
extract tests, not a CI dump).

Every re-baseline reads the matching file from the `cls-profile` artifact.
Do not skip it.

## 7. Finding the shifter

1. For the hydrate floor, open `tmp/cls-profile.json` (or the un-delayed
   artifact file) and read `layout-shifts` nodes (selector + score +
   `subItems`). For the tablet / medium-desktop jump, open
   `tmp/cls-profile-delayed.json` or a local `profile:cls:delayed` run —
   not the un-delayed file.
2. If those nodes are empty or you need Lighthouse's own tables, `--save-lhr`
   locally with the **same** delay as that lab (see Local vs CI). Then dumps.
3. Map the node to a dump target: `#header-left`, `#mithril-filters > div`,
   the download box, a `.loading-shell-*` class.
4. Only then use DevTools Performance → Experience. Agents: do not ask the
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
and nobody bumped Lighthouse, compare `hostUserAgent`
(`HeadlessChrome/<version>`) in the artifact against the last green run.

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
3. Refresh [`tests/fixtures/lighthouse/lhr-delayed.json`](tests/fixtures/lighthouse/lhr-delayed.json)
   from a **trimmed real dump**, not by editing JSON by eye:

   ```bash
   npm run profile:cls -- --preset tablet --repeat 1 --delay-css-ms 3000 --save-lhr tmp/lhr-delayed.full.json
   ```

   Accept the dump only when `cumulative-layout-shift.numericValue` is finite
   and non-zero, `layout-shifts.details.items` has **2 or more** rows, and
   `cls-culprits-insight.details` is present (list of tables). Raise
   `--delay-css-ms` (4000, then 6000) rather than inventing rows. Do not
   commit the full file (`tmp/` is gitignored).

   The preset is `tablet` on purpose, and the fixture name carries no preset.
   Extraction reads only `lhr.audits`, so any viewport works — but delayed
   **mobile** yields empty `layout-shifts` here (render-blocking `main.css`
   delays FCP instead of shifting), even at 6000 ms.

   Trim to `lighthouseVersion`, `userAgent`, and the three audits
   (`cumulative-layout-shift` with `debugdata` details, `layout-shifts` table
   items, `cls-culprits-insight` list including its synthetic Total rows).
   Drop traces, screenshots, `configSettings`, unused audits, and oversized
   headings. Write it prettier-clean. Retarget the happy-path spec to the new
   `numericValue` / first selector. Do not invent audit IDs or `details.type`.

   **Provenance:** `--delay-css-ms` is proxy-side, so the LHR has no
   `delayCssMs` field. The fixture looks like an ordinary run with a larger
   CLS. It is a **local delayed** dump, not a CI median and not a budget
   reference. `--save-lhr` writes even if extraction then fails.
4. Do **not** set `cls-budgets.json` or delayed budgets from a laptop run.
5. Push the version bump (and any extract/fixture edits) and wait for
   `cls.yml`. One run produces both artifact files. Confirm
   `lighthouseVersion` is the new pin, `delayCssMs` is 0 vs 3000 on the
   matching file, culprits are still populated (or the warning is expected),
   and record each preset's median.
6. In **the same PR**, rewrite **both** budget files (CI median + the usual
   slack). Keep un-delayed `:check` and delayed `:check:delayed` on. If a new median is *lower*, still rewrite so
   slack is relative to the new measurement, not a mix of two Lighthouse
   versions. Changing `CLS_CI_DELAY_CSS_MS` is the same class of
   measurement-definition change: re-baseline delayed budgets from CI in
   the same PR.
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

**Do not** rebase `cls-budgets.json` (or delayed budgets) for a launcher-only
bump unless CI CLS actually moved. A launcher bump that changes
`Launcher.defaultFlags()` *can* move CLS, and **the artifact will not show
it**: provenance `chromeFlags` records only the two flags this script passes,
so it reads identically across launcher versions. Diff the launcher changelog
(or `Launcher.defaultFlags()` before and after) instead. If the defaults
moved, treat it like a Lighthouse bump and re-baseline **both** labs from CI
in the same PR.

### Chrome in CI (not an npm package)

`setup-chrome@v2` with `chrome-version: latest` is intentionally floating.
Pinning a Chrome major in `cls.yml` is a later decision if budget churn from
Chrome updates becomes the main noise. Until then: if CLS fails and
`package.json` is unchanged, diff the artifact's `hostUserAgent` against the
last green run before raising budgets or reverting layout.

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
  rsync fails the **Build production** step. Both labs reuse that `dist/`
  (`--skip-build`); they do not rebuild. Delayed only inserts the CSS-delay
  proxy — it does not need a second production bundle.
- `npm run profile:cls:check -- --repeat 3 --skip-build` against
  [`scripts/profile/cls-budgets.json`](scripts/profile/cls-budgets.json)
  (un-delayed CI median plus slack). **No `--delay-css-ms`.**
- Then `npm run profile:cls:check:delayed -- --repeat 3 --skip-build` with
  `if: ${{ !cancelled() }}` and `CLS_PROFILE_PORT: 4188` (proxy 4188 /
  preview 4189) so a leftover un-delayed preview cannot `EADDRINUSE` the
  second run. Against
  [`scripts/profile/cls-budgets-delayed.json`](scripts/profile/cls-budgets-delayed.json).
  First delayed CI artifact (`delayCssMs` 3000, `n=3`, spread 0): mobile
  median **0.000097**, tablet **0.108**, mediumDesktop **0.041**. Budgets
  **0.005 / 0.113 / 0.046** (median + 0.005, same 3-decimal rounding as
  un-delayed). The delayed step still runs after an un-delayed budget
  failure so the jump lab is in the artifact.
- Uploads both `tmp/cls-profile.json` and `tmp/cls-profile-delayed.json`
  as artifact `cls-profile`, `if: always()`. The download has those
  filenames at the artifact root (`tmp/` stripped). The full LHR is not
  attached; inspect with `--save-lhr` locally at the same delay as that lab.
- Timeout **45** minutes: one production build plus two sequential labs,
  **9** applied-throttling navigations each (3 presets × 3 repeats). A
  timeout is not a CLS regression.
- The job fails when **either** lab exceeds its committed budget, or the
  delayed proxy matched 0 `/assets/*.css` files — not when CLS is above
  Google's 0.1. Delayed tablet is currently **above** 0.1; the budget is
  slack around that jump, not a claim it is fixed.

## 12. Known risks

Each item: what it looks like, what to do.

**Audit-ID drift.** `layout-shift-elements` is gone; `layout-shifts` exists
since Lighthouse 11.5; insights IDs still move. Empty culprits plus a warning
means the fallback chain missed a rename — extend `extractClsSample` and the
fixture. Do not treat empty nodes as "no shift."

**Zero delayed CSS hits.** If Vite stops emitting hashed CSS under
`/assets/*.css`, the jump lab would look like the hydrate floor and pass
the delayed upper bounds. The proxy counts held stylesheets
(`delayedStylesheetHits`); a delayed run with 0 hits fails after writing
JSON. Do not treat that failure as a layout regression — fix the matcher
or the emit path.

**Trace window.** If CLS looks near-zero while loading shells clearly jump,
Lighthouse closed the trace before hydrate. Do not lower budgets. Raise
`pauseAfterLoadMs` / `cpuQuietThresholdMs` (the script already applies
Lighthouse `nonSimulatedSettingsOverrides`) or re-validate with a
`PerformanceObserver({ type: "layout-shift" })` through catalog-ready.

**CI runtime.** Eighteen applied-throttling navigations (two labs) make this
the slowest new job. A timeout is not a CLS regression; raise
`timeout-minutes` if the build itself is healthy.

**`npm ci` cost.** Lighthouse's tree slows **every** workflow that runs
`npm ci`, not only `cls.yml`. That cost was accepted for a pinned version
instead of `npx lighthouse` at CI time.

**Budget churn.** Fonts, CI Chrome (`setup-chrome` `latest`), or a Lighthouse
pin change can move medians with no layout commit. Re-baseline from CI (see
upgrading). Do not widen slack to hide it.

**Not PageSpeed.** Applied `devtools` throttling vs PSI `simulate`. A gap vs
PSI is expected.

**Localhost CSS is not Slow 4G.** Un-delayed `profile:cls` on `127.0.0.1`
can read ~0 while PSI is ~0.09 because `main-*.css` is local. That hydrate
floor is still a real regression lab. The delayed CI step (`--delay-css-ms
3000`) is the jump lab for tablet / medium desktop.

**Do not mix labs in one budget file.** Un-delayed medians (`delayCssMs` 0)
go in `cls-budgets.json`. Delayed medians (`delayCssMs` 3000) go in
`cls-budgets-delayed.json`. 3000 ms is part of the delayed metric
definition (`CLS_CI_DELAY_CSS_MS`). Changing the pin without re-baselining
delayed budgets is the same class of error as a Lighthouse bump.

**Preview probes use `node:http`, not `fetch`.** Undici refuses several ports
outright (4190 as ManageSieve, a "bad port"), which reads as a 120s preview
timeout rather than a bind error. `waitForHttpOk` uses `node:http` so any
restricted or unreachable port fails with its real error. The delayed
`CLS_PROFILE_PORT=4188` pin is **not** about that list — it keeps preview
(4189) off the un-delayed lab's 4179 / 4180.

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
