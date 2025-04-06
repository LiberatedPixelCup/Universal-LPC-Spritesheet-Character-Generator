Convert Assets to Vitruvian
=============================================

Steps/Commands to use LPC Tools to convert assets to Vitruvian Studios.

[You will first need to install lpctools.](LPCTOOLS.md)


#### Steps to Convert Assets to Vitruvian Studios

Vitruvian Studios uses standalone single-palette sheets per animation frame and all in LPC Revised palettes. In order to figure out how to get assets correctly we need to find the default ULPC color. From there, we need to pull them from the palette directories and run a conversion script, then pull the default color as well.

1. Open a Terminal Window
2. Enter the following commands:
    1. `cd path/to/character/spritesheets`
    2. `wsl` (only if on windows)
    3. `conda activate lpctools`
    4. `lpctools colors recolor --input characters/hair/xlong_wavy/adult/{fg,bg}/*.png --mapping tools/palettes/conversions/ulpc-to-vitruvian-hair-palettes.json`
    5. `mmv -c -d 'characters/hair/xlong_wavy/adult/fg/*/vitruvian.png' 'characters/hair/xlong_wavy/adult/fg/#1.png'`
    6. `mmv -c -d 'characters/hair/xlong_wavy/adult/bg/*/vitruvian.png' 'characters/hair/xlong_wavy/adult/bg/#1.png'`
    7. `lpctools colors recolor --input characters/hair/extensions/ties/high_bun/adult/*.png --mapping tools/palettes/conversions/ulpc-to-vitruvian-hair-palettes.json`
    8. `mmv -c -d 'characters/hair/extensions/ties/high_bun/adult/*/vitruvian.png' 'characters/hair/extensions/ties/high_bun/adult/#1.png'`

What this sets up here is converting base colors from ULPC to the base color of vitruvian, then pulling that color back to the prior directory.

This is merely an example using existing assets, but you will need to update to include your own paths.

(All conversion palettes can be found here)[tools/palettes/conversions/README.md], so please look carefully through them. Match the base color with the base color used on vitruvian.