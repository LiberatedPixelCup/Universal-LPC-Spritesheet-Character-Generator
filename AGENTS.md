# AGENTS.md

A Vite + Mithril app that composites [LPC](https://lpc.opengameart.org)
character layers into a spritesheet ZIP plus attribution. The shareable
selection is the URL hash. Source of truth: `sheet_definitions/`,
`palette_definitions/`, and `spritesheets/` — Vite generates the `dist/`
metadata modules, and the app reads them only through `CatalogReader`.

The skill listed against a topic owns the procedure; load it before
acting. Canonical skills live in `.agents/skills/`. Claude Code loads
`.claude/skills/`, which `npm ci` / `npm run skills:link` generates as
local links. Walkthroughs are in [ARCHITECTURE.md](ARCHITECTURE.md) and
[CONTRIBUTING.md](CONTRIBUTING.md#doc-ownership).

## Never

- Add a new `.js` — new code is `.ts`
  ([typescript](.agents/skills/typescript/SKILL.md))
- Reach for a global instead of the `catalog` / `state` attrs
  ([catalog](.agents/skills/catalog/SKILL.md))
- Hand-edit `dist/`, or add a second metadata module
  ([generated-metadata](.agents/skills/generated-metadata/SKILL.md))
- Ship a new or derived PNG without a `credits` entry
  ([sheet-definition](.agents/skills/sheet-definition/SKILL.md))
- Rewrite or delete an old hash key — `aliases` go on the **destination**,
  and renames need an issue first
  ([catalog](.agents/skills/catalog/SKILL.md))
- Start with `npm test`, or run `npm install` after a lockfile conflict
  (`npm run lockfile:fix`)

## After you edit

Match the check to what you touched, and confirm locally rather than
waiting for CI.

| Touched | Load |
| --- | --- |
| `sheet_definitions/`, `palette_definitions/` | [sheet-definition](.agents/skills/sheet-definition/SKILL.md) |
| `sources/`, `scripts/`, `vite/`, `tests/` | [typescript](.agents/skills/typescript/SKILL.md), then [run-one-spec](.agents/skills/run-one-spec/SKILL.md) and [coverage](.agents/skills/coverage/SKILL.md) |
| `sources/canvas/`, palette recolor, z-positions | [canvas-render](.agents/skills/canvas-render/SKILL.md) — needs the user; you cannot check both paths |
| `sources/canvas/`, `load-image`, `renderCharacter`, ZIP export drawing | [performance-profiling](.agents/skills/performance-profiling/SKILL.md) — do not ask the user to open DevTools |
| Layout, first-paint CSS, PurgeCSS safelist | [visual-test](.agents/skills/visual-test/SKILL.md) |

Update whatever doc the change makes stale
([Doc ownership](CONTRIBUTING.md#doc-ownership)).
