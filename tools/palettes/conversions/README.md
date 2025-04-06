LPC Sprite Palette Conversions
=============================================

This is intended to make it easier to convert palettes from one style to another. This is primarily for converting between LPC Revised and ULPC, but could be used for other things, too.

### LPC Revised to ULPC
Converts LPC Revised base colors to ULPC palettes.

#### 1. lpcr-to-ulpc-body-palettes.json
- Converts default LPC Revised body palette to all ULPC Body + Fur palettes.

#### 2. lpcr-to-ulpc-cloth-palettes.json
- Converts the default white palette from LPC Revised to ULPC cloth palettes.

#### 3. lpcr-to-ulpc-fur-palettes.json
- Converts the default hair palette from LPC Revised to ULPC hair + fur palettes.

#### 4. lpcr-to-ulpc-hair-palettes.json
- Converts the default hair palette from LPC Revised to ULPC hair palettes.

#### 5. lpcr-to-ulpc-metal-palettes.json
- Converts the default metal palette from LPC Revised to ULPC metal palettes.



### ULPC to LPC Revised Base Palettes

Converts ULPC base colors to all equivalent LPC Revised colors.

#### 1. ulpc-to-lpcr-body-palettes.json
- Converts the default ULPC skin palette to all LPC Revised skin palettes.

#### 2. ulpc-to-lpcr-eyes-palettes.json
- Converts the default ULPC skin palette to all LPC Revised skin palettes.

#### 3. ulpc-to-lpcr-cloth-palettes.json
- Converts the default ULPC "cloth" palette (brown) to the default LPC Revised "cloth" palette (white).

#### 4. ulpc-to-lpcr-hair-palettes.json
- Converts the default ULPC hair palette (orange) to LPC Revised default hair palette.

#### 5. ulpc-to-lpcr-metal-source.json
- Converts the default ULPC metal palette (steel) to LPC Revised default metal palette.

#### 6. ulpc-to-lpcr-wood-source.json
- Converts the default ULPC "wood" palette to LPC Revised default wood palette.


### ULPC to LPC Revised Base Palettes

Converts only one color from ULPC to the base color from Vitruvian. In many cases the vitruvian base color is inconsistent, so for those, we'll only recolor to all LPCR palettes.

#### 1. ulpc-to-virtuvian-body-source.json
- Converts the default ULPC skin/eye palette to default Vitruvian body and eye palettes. Only one palette of the base "light" body color differs, so we just combined the eye colors as well. This is primarily for use in vitruvian as all body defaults should be consistent here.

#### 2. ulpc-to-virtuvian-hair-source.json
- Converts the default ULPC hair palette (orange) to default Vitruvian hair palette (brown).