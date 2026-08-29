---
name: cls
description: >-
  Measure lab CLS with profile:cls, debug layout shift from loading shells
  and first-paint jump, and keep budgets tied to a CI artifact. Use when
  editing first-paint CSS, loading shells, critical-shell, or when the user
  mentions CLS, layout shift, or Lighthouse.
---

# Lab CLS

Load [CLS.md](../../../CLS.md) before touching critical CSS for shift.
Measure with `npm run profile:cls` rather than asking the user for DevTools.

This is **not** Argos and **not** `window.profiler`:

- Argos is post-hydrate screenshots at 390 / 834 / 1440. CLS mobile is
  **412×823**. Visual checks: [visual-test](../visual-test/SKILL.md).
- `profile:app` / `profile:load` are timing. Layout shift is this skill.
  [performance-profiling](../performance-profiling/SKILL.md).

## Measure

```bash
npm run profile:cls
npm run profile:cls -- --preset mobile
npm run profile:cls:check
npm run profile:cls:delayed
npm run profile:cls:baseline:delayed
npm run profile:cls:check:delayed
```

Production `vite preview` with `?debug=false`. Default port 4179. Culprits
are in the JSON `layout-shifts` nodes, not the CLS audit `debugdata`.

Two labs:

- Un-delayed `profile:cls:check` is the **hydrate floor**
  ([`cls-budgets.json`](../../../scripts/profile/cls-budgets.json)).
- Delayed `profile:cls:check:delayed` (`--delay-css-ms 3000`) is the **jump
  gate**
  ([`cls-budgets-delayed.json`](../../../scripts/profile/cls-budgets-delayed.json)).
  A delayed run with `delayedStylesheetHits` 0 is a broken proxy, not a
  green jump. `--check --preset` gates only that viewport.
  Do not paste delayed medians into `cls-budgets.json`.

`diff:cls-profile` always exits 0. A `hostUserAgent` warning is Chrome-build
churn (`chrome-version: latest`), not a layout regression.

Both budget files are slack around a CI median, never Google's 0.1. Delayed
tablet sits **above** 0.1 today; green there means the jump has not grown,
not that it is fixed.

See [CLS.md](../../../CLS.md).

Do not hand-edit [`scripts/profile/cls-budgets.json`](../../../scripts/profile/cls-budgets.json)
or delayed budgets without the matching CI `cls-profile` artifact. Local
macOS medians will not match Linux CI.

After a Lighthouse bump, refresh
[`tests/fixtures/lighthouse/lhr-delayed.json`](../../../tests/fixtures/lighthouse/lhr-delayed.json)
via the recipe in [CLS.md](../../../CLS.md) (trimmed `--save-lhr` dump). Do
not reshape the JSON by eye.

## Debug

1. Hydrate floor: `layout-shifts` nodes in `tmp/cls-profile.json`. Jump:
   `tmp/cls-profile-delayed.json` or `profile:cls:delayed` at the same
   `--preset`. If culprits are empty or you need the raw audits,
   `--save-lhr` locally with the **same** delay as that lab — the GitHub
   artifact is not an LHR. [CLS.md](../../../CLS.md) section 6.
2. Dump the **matching** viewport: CLS `mobile` →
   `npm run compute-style-dump:lighthouse-mobile` (412×823), **not**
   `compute-style-dump:mobile` (Argos 390). Tablet / mediumDesktop use the
   same-named dump presets.
3. Dumps are post-hydrate. A hydrate-only jump will not show as a single-URL
   dump diff.

After a CSS change run un-delayed **and** delayed `profile:cls` **and**
`npm run test:visual`. New skill folder: `npm run skills:link` so
`.claude/skills/cls` exists (gitignored).
