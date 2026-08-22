---
name: canvas-render
description: >-
  Change the offscreen renderer, palette recolor, z-position order, or
  magenta mask, and ask the user to check WebGL and the CPU fallback. Use
  when editing sources/canvas/, palette recolor, z-positions, or renderer
  output.
---

# Canvas render

Palette recoloring is the only WebGL/CPU branch, in `recolorImage()` in
[`sources/canvas/palette-recolor.ts`](../../../sources/canvas/palette-recolor.ts).
The two implementations can disagree, and only one runs on a given machine.

You cannot confirm both paths. Ask the user to follow
[Force CPU Mode](../../../PALETTE_RECOLOR_GUIDE.md#force-cpu-mode-testing) and
[Visual Verification](../../../PALETTE_RECOLOR_GUIDE.md#visual-verification-steps):
`setPaletteRecolorMode("cpu")`, then `setPaletteRecolorMode("webgl")`, and
compare with `getPaletteRecolorStats()`.

Lower `zPos` draws first and ends up behind
([ARCHITECTURE.md](../../../ARCHITECTURE.md#render-path)). Magenta `#FF2CE6` is
keyed out in [`sources/canvas/mask.ts`](../../../sources/canvas/mask.ts).

ZIP export drawing is a separate check:
[PERFORMANCE_PROFILING.md](../../../PERFORMANCE_PROFILING.md).
