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
```

Production `vite preview` with `?debug=false`. Default port 4179. Culprits
are in the JSON `layout-shifts` nodes, not the CLS audit `debugdata`.

Do not hand-edit [`scripts/profile/cls-budgets.json`](../../../scripts/profile/cls-budgets.json)
without a CI `cls-profile` artifact. Local macOS medians will not match Linux
CI.

## Debug

1. Read `layout-shifts` nodes in `tmp/cls-profile.json`.
2. Dump the **matching** viewport: CLS `mobile` →
   `npm run compute-style-dump:lighthouse-mobile` (412×823), **not**
   `compute-style-dump:mobile` (Argos 390). Tablet / mediumDesktop use the
   same-named dump presets.
3. Dumps are post-hydrate. A hydrate-only jump will not show as a single-URL
   dump diff.

After a CSS change run `profile:cls` **and** `npm run test:visual`. New skill
folder: `npm run skills:link` so `.claude/skills/cls` exists (gitignored).
