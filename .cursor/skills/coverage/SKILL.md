---
name: coverage
description: >-
  Run and read unit-test coverage for this repo and satisfy the codecov/patch
  and codecov/changes gates. Use when a PR check fails on coverage, after
  editing gated production code under sources/ or scripts/, or when the user
  mentions coverage, Codecov, patch, or uncovered lines.
---

# Coverage

Two separate, non-overlapping reports. Pick by the path you edited.

| Edited | Command | Report |
| --- | --- | --- |
| `sources/` | `npm run test:browser:coverage` | `coverage/browser/index.html` |
| `scripts/` | `npm run test:node:coverage` | `coverage/node/index.html` |

The flags in [`codecov.yml`](../../../codecov.yml) scope `browser` to `sources/`
and `node` to `scripts/`. The wrong command reports nothing for your file — it
does not fail, it just shows no data. Run both only if you edited both trees.

Both are **full-suite** runs. There is no per-file coverage run; see
[run-one-spec](../run-one-spec/SKILL.md) for isolation while iterating, then one
coverage run at the end.

`npm run test:browser:coverage` launches Chrome **and** Firefox (`testem.cjs`
`launch_in_ci`). If Firefox is not installed locally, confirm with Chrome only:

```bash
VITE_COVERAGE=true node ./node_modules/testem/testem.js ci --launch Chrome
```

[`merge-browser-coverage.ts`](../../../scripts/coverage/merge-browser-coverage.ts)
merges whatever JSON is already in `coverage/browser/`. Firefox-only lines will
read as uncovered.

## Before you conclude anything

Check whether the path is in the `ignore:` block of
[`codecov.yml`](../../../codecov.yml) first. Ignored paths owe no test, and a
coverage run tells you nothing about them. Currently ignored: `tests/**`,
`dist/**`, `spritesheets/**`, `sheet_definitions/**`, `scripts/coverage/**`,
`scripts/computed-style/**`, `scripts/imageProcessing/**`, `scripts/zip/**`,
`scripts/profile/**`, several individual `scripts/*.ts` files, `vite/**`,
`vite.config.ts`, `testem.cjs`, `sources/performance-profiler.ts`,
`sources/utils/debug.ts`, and all CSS/SCSS. Read the file rather than
trusting this list.

## Reading the report

Open the HTML and confirm every new or edited production line is marked hit. Do
not wait for Codecov to tell you. The terminal summary is enough for a quick
check, but it reports per-file percentages, not which line was missed.

Browser collection is off unless `VITE_COVERAGE=true`; the
`test:browser:coverage` script sets it. Plain `npm test` and
`npm run test:server` are uninstrumented, so they will never show coverage.

A spec that is not imported from [`tests/tests.js`](../../../tests/tests.js)
never runs. That produces uncovered lines with **no test failure** — the most
common cause of a surprising patch failure on a browser change.

## The gates

- **`codecov/patch`** — 100% of new or edited production lines under `sources/`
  (browser flag) or `scripts/` (node flag) must be executed, except ignored
  paths. Threshold is 0%, so one missed line fails it.
- **`codecov/changes`** — previously covered lines must not lose hits. Deleting
  or weakening a test trips this even when your new code is fully covered.
- There is **no** project-percentage gate, so adding a large file does not fail
  a PR on the average.

Both use `if_not_found: success`, so they pass silently when there is no base
report to compare against.

## Why comment-only diffs still pass

[`mark-non-executable-lines.js`](../../../scripts/coverage/mark-non-executable-lines.js)
rewrites the uploaded `lcov.info` to mark blank lines and comment-only lines as
hit. It uses the TypeScript scanner, so a trailing comment on a code line does
**not** count as non-executable. Both pipelines apply it: `test:node:coverage`
runs it directly, and the browser suite calls `markNonExecutableLinesInLcov`
from [`merge-browser-coverage.ts`](../../../scripts/coverage/merge-browser-coverage.ts)
in the Testem `on_exit` hook.

So a documentation-only or comment-only diff is expected to pass the 100% patch
gate. If you see comments counted as missed lines, the post-processing step did
not run — check that the coverage script finished rather than adding a test.

Full description of the CI wiring:
[CONTRIBUTING.md](../../../CONTRIBUTING.md#unit-test-coverage).
