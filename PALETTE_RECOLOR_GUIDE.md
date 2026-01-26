# Palette Recolor System Guide

This guide explains how to integrate items with the GPU-accelerated palette recolor system, enabling real-time color variations without creating multiple image files.

## Table of Contents

- [Overview](#overview)
- [Benefits](#benefits)
- [Understanding the System](#understanding-the-system)
- [Creating a Palette File](#creating-a-palette-file)
- [Adding Palette Support to Items](#adding-palette-support-to-items)
- [Testing Your Integration](#testing-your-integration)
- [Complete Example: Enabling Hair Palette](#complete-example-enabling-hair-palette)
- [Troubleshooting](#troubleshooting)

## Overview

The palette recolor system allows sprite color variants to be generated on-the-fly using GPU-accelerated WebGL shaders. Instead of storing multiple color variants of the same sprite as separate image files, you only need:

1. **One source image** (typically the "base" or "light" variant)
2. **A palette JSON file** defining color mappings

The system automatically:
- Detects if an item should use palette-based recoloring from its sheet definition
- Lazy-loads the appropriate palette file on first use
- Recolors sprites in real-time using GPU acceleration (with CPU fallback)

## Benefits

| Benefit | Description |
|---------|-------------|
| 🚀 **Performance** | GPU-accelerated: 90-120ms vs 190-230ms per preview (CPU) |
| 🎨 **Consistency** | Single source of truth for all color variants |
| 🔧 **Maintainability** | Add new colors by editing JSON, not creating image files |
| 💾 **Storage** | Fewer files to maintain (1 source + palette vs N variant files) |
| 🔄 **Flexibility** | Palettes support 1-32 colors (not limited to 8) |

## Understanding the System

### Architecture

The palette system consists of three main components:

1. **`sources/canvas/palette-recolor.js`** - Core palette management
   - Lazy-loads palette JSON files on first use
   - Maps items to palettes based on their `recolors` field in metadata
   - Coordinates between WebGL and CPU implementations

2. **`sources/canvas/webgl-palette-recolor.js`** - GPU implementation
   - WebGL shader for fast color replacement
   - Shared context to avoid browser limits
   - Automatic fallback on errors

3. **`sources/canvas/renderer.js`** - Integration point
   - Calls palette system during sprite rendering
   - Handles async palette loading

### How Color Matching Works

Both WebGL and CPU implementations use **tolerance-based matching**:

```javascript
// A pixel matches a palette color if RGB values are within tolerance
tolerance = 1  // ±1 per channel (R, G, B)

// Example: Does pixel #CC8665 match palette color #CC8665?
// R: |204 - 204| = 0 ≤ 1 ✓
// G: |134 - 134| = 0 ≤ 1 ✓
// B: |101 - 101| = 0 ≤ 1 ✓
// Match found! Replace with target color.
```

This tolerance allows for slight variations in colors due to compression or anti-aliasing.

### Metadata-Based Item Matching

Items declare which palette they use via a `recolors` field in their sheet definition:

```javascript
// Example: body.json declares it uses the body palette
{
  "recolors": {
    "base": "light",      // Source variant name in the palette
    "palette": "body"     // Palette name
  }
}

// The system loads tools/palettes/ulpc-body-palettes.json when needed
```

## Creating a Palette File

### File Format

Palette files are JSON objects where each key is a variant name and each value is an array of hex colors:

```json
{
  "light": [
    "#271920",
    "#271920",
    "#99423c",
    "#cc8665",
    "#E4A47C",
    "#F9D5BA",
    "#FAECE7",
    "#f8f3eb"
  ],
  "bronze": [
    "#1A1213",
    "#1A1213",
    "#442725",
    "#644133",
    "#7F4C31",
    "#AE6B3F",
    "#D38B59",
    "#D38B59"
  ],
  "source": [
    "#271920",
    "#271920",
    "#99423c",
    "#cc8665",
    "#E4A47C",
    "#F9D5BA",
    "#FAECE7",
    "#f8f3eb"
  ]
}
```

### Palette Requirements

✅ **Required:**
- All variants must have the **same number of colors**
- Must include a `"source"` variant (the base colors to map from)
- Color count must be between **1-32** (WebGL texture limit)
- Colors must be valid hex format (`#RRGGBB`)

✅ **Flexible:**
- Color count can be any number from 1-32 (not limited to 8)
- Different palette types can have different color counts
  - Example: Body palette has 8 colors, cloth palette could have 12

### Color Array Structure

Colors in the array typically represent a **shadow → highlight** progression:

```javascript
[
  "#271920",  // Darkest shadow
  "#271920",  // Deep shadow
  "#99423c",  // Shadow
  "#cc8665",  // Mid-tone
  "#E4A47C",  // Light mid-tone
  "#F9D5BA",  // Highlight
  "#FAECE7",  // Bright highlight
  "#f8f3eb"   // Lightest highlight
]
```

This structure matches how LPC sprites are typically shaded, with darker colors for shadows and lighter colors for highlights.

### Validation Checklist

Before using a palette file, verify:

- [ ] All variants have the same color count
- [ ] Color count is between 1-32
- [ ] All colors are valid hex format (`#RRGGBB` or `#RRGGBB` with optional alpha)
- [ ] `"source"` variant is present
- [ ] Colors represent a logical progression (shadow → highlight)
- [ ] File is valid JSON (use a JSON validator)

## Adding Palette Support to Items

To enable palette recoloring for an item, add a `recolors` field to its sheet definition JSON file.

### Adding the Recolors Field

Edit the item's JSON file in `sheet_definitions/` and add the `recolors` field:

```json
{
  "name": "Body color",
  "variants": ["light", "amber", "olive", ...],
  "path": ["body", "body"],
  "recolors": {
    "base": "light",
    "palette": "body"
  }
}
```

### Recolors Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `base` | string | Source variant name to load (e.g., "light", "orange") |
| `palette` | string | Palette name - must match a key in `PALETTE_FILES` |

### Available Palette Names

The system has these palette files available (mapped in `sources/canvas/palette-recolor.js`):

- `body` - Body skin tones
- `hair` - Hair colors
- `cloth` - Cloth/fabric colors
- `cloth-metal` - Cloth with metallic accents
- `metal` - Metallic colors
- `eye` - Eye colors
- `fur` - Fur colors

### Lazy Loading

Palettes are loaded automatically on first use - **no configuration needed**! When an item with a `recolors` field is first rendered, the system:

1. Checks if the palette is already loaded
2. If not, fetches the palette JSON file
3. Caches it for future use
4. Applies the recoloring

### Complete Example

Here's a complete sheet definition using palette recoloring:

```json
{
  "name": "Body color",
  "layer_1": {
    "zPos": 10,
    "male": "body/bodies/male/",
    "female": "body/bodies/female/"
  },
  "variants": [
    "light", "amber", "olive", "taupe",
    "bronze", "brown", "black"
  ],
  "animations": ["walk", "idle", "jump", "run"],
  "path": ["body", "body"],
  "recolors": {
    "base": "light",
    "palette": "body"
  }
}
```

With this configuration:
- Only `spritesheets/body/bodies/male/walk/light.png` needs to exist (no other color variants per animation)
- The palette system generates "amber", "olive", etc. at runtime
- All 7 color variants work without needing 7 separate PNG files

### Verifying Variant Compatibility

Before enabling palette recoloring for an item:

1. Check the item's variant list in its sheet definition
2. Compare with variants in the palette file
3. Ensure variants match (or add missing variants to palette)

```bash
# Example: Check if hair_afro variants match hair palette
cat sheet_definitions/hair_afro.json | grep -A 30 '"variants"'
cat tools/palettes/ulpc-hair-palettes.json | grep -E '^\s+"[^"]+":' | head -20
```

## Testing Your Integration

### Console Commands

The generator exposes several debugging functions for testing palette recoloring:

#### Check Configuration
```javascript
getPaletteRecolorConfig()
// Returns: { forceCPU: false, useWebGL: true, activeMode: "webgl" }
```

#### View Statistics
```javascript
getPaletteRecolorStats()
// Shows breakdown of operations:
// 📊 Palette Recolor Statistics:
//   WebGL (GPU): 450 (95.7%)
//   CPU: 0 (0.0%)
//   Fallback: 20 (4.3%)
//   Total: 470
```

#### Force CPU Mode (Testing)
```javascript
setPaletteRecolorMode("cpu")
// Switch back to GPU:
setPaletteRecolorMode("webgl")
```

#### Reset Statistics
```javascript
resetPaletteRecolorStats()
```

### Visual Verification Steps

1. **Load the generator** in your browser
2. **Open browser console** (F12)
3. **Select an item** that uses palette recoloring (e.g., body color)
4. **Change to a variant that needs recoloring** (not the base variant)
5. **Check palette loading** in console:
   ```
   Loaded body palette with 22 variants
   ```
   (Only appears when the palette is first loaded - lazy loading!)
6. **Verify smooth rendering** and correct colors
7. **Check statistics**: Run `getPaletteRecolorStats()` to verify GPU usage

### Performance Testing

Compare WebGL vs CPU performance:

```javascript
// 1. Reset stats
resetPaletteRecolorStats()

// 2. Generate some previews with WebGL (default)
// (interact with the generator, change colors)

// 3. Check timing
getPaletteRecolorStats()  // Note WebGL operations

// 4. Force CPU mode
setPaletteRecolorMode("cpu")
resetPaletteRecolorStats()

// 5. Generate same previews with CPU
// (repeat same interactions)

// 6. Compare
getPaletteRecolorStats()  // Compare operation counts and feel the difference
```

Expected performance:
- **WebGL**: 90-120ms per full spritesheet preview
- **CPU**: 190-230ms per full spritesheet preview

## Complete Example: Enabling Hair Palette

Let's walk through enabling the hair palette for all hair items.

### Step 1: Verify Palette File Exists

```bash
# Check if hair palette file exists
ls tools/palettes/ulpc-hair-palettes.json

# Preview its structure
head -20 tools/palettes/ulpc-hair-palettes.json
```

Expected output:
```json
{
  "orange": ["#260D14", "#6A1108", ...],
  "ash": ["#2D061B", "#642442", ...],
  "blonde": ["#331313", "#552B15", ...],
  ...
  "source": ["#260D14", "#6A1108", ...]
}
```

### Step 2: Add Palette Mapping (if needed)

Check if "hair" is already in `PALETTE_FILES` in `sources/canvas/palette-recolor.js`:

```javascript
const PALETTE_FILES = {
  'body': 'tools/palettes/ulpc-body-palettes.json',
  'hair': 'tools/palettes/ulpc-hair-palettes.json',  // ✓ Already there!
  // ...
};
```

If not present, add it. This is a one-time setup per palette type.

### Step 3: Update Hair Item Sheet Definitions

Find all hair items and add the `recolors` field:

```bash
# Find all hair items
grep -l '"path".*"head".*"hair"' sheet_definitions/*.json
```

Edit each hair item JSON (e.g., `sheet_definitions/hair_afro.json`):

```json
{
  "name": "Afro",
  "variants": ["blonde", "ash", "orange", ...],
  "path": ["head", "hair", "hair extensions", "afro", "hair_afro"],
  "recolors": {
    "base": "orange",
    "palette": "hair"
  }
}
```

### Step 4: Rebuild Metadata

Run the build script to update item metadata:

```bash
node scripts/generate_sources.js
```

This regenerates `item-metadata.js` with the new `recolors` field.

### Step 5: Ensure Source Variant Exists

For each hair item, ensure the source variant image exists:

```bash
# Example: Check if afro has 'orange' variant (source for hair palette)
ls spritesheets/hair/afro/adult/orange.png
```

### Step 6: Test in Browser

1. Load the generator
2. Open console (F12)
3. Select a hair style
4. Change to a non-orange color variant
5. Look for: `Loaded hair palette with 27 variants` (lazy-loaded!)
6. Verify correct colors render
7. Run `getPaletteRecolorStats()` to verify GPU usage

### Before/After Comparison

**Before:**
- 27 PNG files per hair style
- Manual palette generation using lpctools
- Larger repository size
- Hard to add new colors

**After:**
- 1 PNG file per hair style (source variant)
- Real-time GPU recoloring
- ~60% faster rendering
- Smaller repository
- New colors = edit JSON only

## Troubleshooting

### Palette Not Loading

**Symptom**: Console shows no "Loaded X palette" message when selecting a variant

**Solutions**:
- **Note**: Palettes load lazily - you'll only see the message when using a non-base variant
- Check that `PALETTE_FILES` in `palette-recolor.js` has the palette name mapped
- Verify JSON file is valid (use JSON validator)
- Check browser console for fetch errors
- Ensure palette file is committed to repository
- Verify the item has a `recolors` field in its sheet definition

### Colors Look Wrong

**Symptom**: Recolored sprites have incorrect colors

**Solutions**:
- Verify source variant matches `sourceVariant` in config
- Check that source image uses exact palette colors
- Verify tolerance matching (some colors may be slightly off due to anti-aliasing)
- Try forcing CPU mode to debug: `setPaletteRecolorMode("cpu")`

### Performance Issues

**Symptom**: Generator feels slow or laggy

**Solutions**:
- Check if WebGL is active: `getPaletteRecolorConfig()`
- View stats to see GPU usage: `getPaletteRecolorStats()`
- Check for fallbacks (indicates WebGL errors)
- Clear browser cache
- Try different browser (WebGL support varies)

### Missing Variants

**Symptom**: Some color variants don't appear in generator

**Solutions**:
- Check sheet definition `variants` array matches palette file keys
- Verify palette file has all expected variants
- Check for typos in variant names (case-sensitive)
- Console errors may indicate missing variants

### WebGL Context Limit

**Symptom**: Error about too many WebGL contexts

**Solutions**:
- The system uses a shared WebGL context to avoid this
- If error persists, force CPU mode: `setPaletteRecolorMode("cpu")`
- Close other browser tabs using WebGL
- Restart browser

### Palette Colors Don't Match Existing Variants

**Symptom**: Palette-generated colors differ from original PNG files

**Solutions**:
- Source variant may have been modified
- Palette file may be outdated
- Regenerate palette using lpctools
- Update source variant to use exact palette colors
- Adjust palette tolerance if needed (requires code changes)

## Additional Resources

- **Performance Profiling**: See [PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md)
- **LPC Tools**: [tools/LPCTOOLS.md](tools/LPCTOOLS.md)
- **Existing Palettes**: [tools/palettes/](tools/palettes/)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)

## Questions?

If you have questions or run into issues not covered here:

1. Check existing [GitHub Issues](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/issues)
2. Search for console error messages
3. Open a new issue with:
   - Browser and OS version
   - Console output
   - Steps to reproduce
   - Output of `getPaletteRecolorConfig()` and `getPaletteRecolorStats()`
