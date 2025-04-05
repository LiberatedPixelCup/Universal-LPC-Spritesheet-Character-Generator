How to Build Sheets With LPC Tools
=============================================

The instructions below can be used to build or rebuild sheets if so desired using LPCTools.


### Install LPCTools
[LPCTools](https://github.com/bluecarrot16/lpctools) must be installed first.

[Install LPCTools and its prerequisites using these instructions.](../../../../tools/LPCTOOLS.md)


### Rebuild Sheets

Rebuilding sheets can be useful if you expand lpctools to support other base assets in the future.

To rebuild the sheets from scratch, run the following commands in a command terminal:
1. `wsl` (only if running from windows)
2. `conda activate lpctools`
3. `cd /path/to/build/folder/`
4. `lpctools arrange distribute --input _build/ --output universal.png --mask masks_male_head.png --offsets reference_points.png --layout universal-expanded`
5. `lpctools arrange separate --input universal.png --output-dir universal/ --layout universal-expanded`
6. `lpctools arrange combine --input universal/ --output _combined.png --layout universal-expanded`

The "layout" should be whatever layout you wish, but universal-expanded is the original "universal" layout from the Universal LPC Spritesheet but with additional animation bases added onto it. To get the original universal sheets before expanded frames were added, use the "universal" layout rather than "universal-expanded".

"Masks" are complete sheets of masks outlining where certain assets are that cut out other parts. The "head" masks are for cutting out arms from assets appearing on thte head. The reference_points adjust the position of assets on the universal-expanded sheet. If you change the layout the reference points and masks will also need to be adjusted.

"Distribute" is used to take single frames and drop them across all frames. They must mapped to a specific structure. The ones in _build directories have already been preconfigured.

"Separate" takes a full sheet and splits the assets into separate smaller sheets. This is based on the layout you request. Running this command is completely optional but makes it easier to parse out assets.

"Combine" takes the separated sheets and recombines them back into a full sheet based on the animation filenames in the directory provided. This should be applied in the layout you give.