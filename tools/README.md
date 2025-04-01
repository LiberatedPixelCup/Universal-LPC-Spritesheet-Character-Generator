LPC Sprite Character Tools
=============================================

These assets are various tools to help generate sheets.

It is recommended to [use these in conjunction with lpctools.](LPCTOOLS.md)


### Masks

Masks are intended to aid in adjusting the positions of assets and cutouts. When mapping assets with a mask, it will handle cutouts automatically if you use lpctools.

The "references" sheet under Masks is for setting offsets in relation to the head. This is useful for positioning static assets on the head, such as heads themselves, appendages, facial assets, hats, hair, etc.


### Palettes

These palettes are designed to work with lpctools. Please see the palettes directly for more details on how to use them.

The base "palettes" directory contains the standard palettes used by this generator. However, some assets use "custom" palettes. In addition, LPC Revised Palettes are also available here, along with the ability to convert between LPC Revised Palettes or our standard palettes.

### Layouts

Layouts are for use in lpctools, like so:
```
lpctools arrange distribute --layout universal-expanded --input /path/to/split/assets --output hat/helmet/bascinet/adult.png --offsets tools/masks/reference_points.png --mask tools/masks/masks_male_head.png
lpctools arrange separate --layout universal-expanded --input hat/helmet/bascinet/adult.png --output characters/updates/hat/helmet/bascinet/_separated/
```

Arrange a set of assets to all frames with the correct layout. `universal-expanded.json` is the new set that includes idle, run, jump, climb, sit, emotes, backslash, and halfslash. In the future I'd also like to add grab/carry/lift. You can also separate the assets into individual animations using the "separate" comman.



### Cutouts

These cutouts can be used on their own. It is recommended to use cutouts with Aseprite or another image editor. When generating assets, you can select these cutouts across the entire page on the "black" to remove any elements from a specific layer.

lpctools is probably a more viable option along with masks, but these cutouts are another potential option you can use instead.