---
name: visual-test
description: >-
  Run or add Playwright visual specs and know when a layout or CSS change
  needs npm run test:visual. Use after first-paint, panel-layout, or
  PurgeCSS safelist changes, or when adding a Playwright case.
---

# Visual tests

Run `npm run test:visual` after a change that affects first paint, panel
layout, or a class in
[`vite/purgecss-critical-safelist.ts`](../../../vite/purgecss-critical-safelist.ts).

Add cases under [`tests/visual/`](../../../tests/visual/). Reuse waits in
[`home-helpers.ts`](../../../tests/visual/home-helpers.ts). Wait for catalog
readiness via `__LPC_waitCatalogAllReady` (installed in
[`sources/main.ts`](../../../sources/main.ts)). Do not import visual specs
from `tests/tests.js`. They are not Codecov-instrumented.

Argos upload needs `ARGOS_TOKEN`. Isolated run:
[run-one-spec](../run-one-spec/SKILL.md). Walkthrough:
[Visual regression tests](../../../CONTRIBUTING.md#visual-regression-tests-playwright--argos).
