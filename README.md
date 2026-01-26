 LPC Spritesheet Character Generator
 =============================================

 #### Translations
[![en](https://img.shields.io/badge/lang-en-red.svg)](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/README.md) [![zh](https://img.shields.io/badge/lang-zh-green.svg)](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/lang/zh/README_ZH.md)

This generator attempts to include all [LPC](https://lpc.opengameart.org) created character art up to now.

Try it [here](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/).

The Liberated Pixel Effort is a collaborative effort from a number of different great artists who helped produce sprites for the project.
**If you wish to use LPC sprites in your project, you will need to credit everyone who helped contribute to the LPC sprites you are using.** See [below](#licensing-and-attribution-credits) for how to do this.

Although this particular repository focuses on character sprites, LPC includes many tilesets and some other artwork as well. Tileset collections can be found on [OpenGameArt.org](https://opengameart.org)

### History

The concept of the Liberated Pixel Cup was introduced by Bart Kelsey and Chris Webber. It was originally a competition on [OpenGameArt.org](https://opengameart.org) sponsored by Creative Commons, Mozilla, and the Free Software Foundation. (Note: These organizations do not sponsor and are not involved with this generator.) The idea was to create a body of artwork with a common [style](https://lpc.opengameart.org/static/LPC-Style-Guide/build/index.html).

This was originally based on https://github.com/makrohn/Universal-LPC-spritesheet, which contained an xcf file combining all the assets from pngs. That repository was originally included in this repository as a submodule, and probably represented the first (albeit offline) LPC Spritesheet Generator. Thanks to [@makrohn](https://github.com/makrohn) for creating it.

[@Gaurav0](https://github.com/Gaurav0) was the original author of this repository. However, life came in the way and he did not keep up with maintaining it. Thanks to [@sanderfrenken](https://github.com/sanderfrenken) for maintaining the primary fork of the repository for many years.

[@jrconway3](https://github.com/jrconway3) and [@bluecarrot16](https://github.com/bluecarrot16) have been the key art focused maintainers of the repository.

[@ElizaWy](https://github.com/ElizaWy) has revised and expanded the LPC paradigm. See https://github.com/ElizaWy/LPC

### Licensing and Attribution (Credits)

Each piece of artwork distributed from this project (all images in the `spritesheets` subdirectory) is licensed under one or more of the following supported open license(s):

- [CC0](https://creativecommons.org/public-domain/cc0/)
  - Allowed to be used under any circumstances, attribution not required
- [CC-BY-SA](https://creativecommons.org/licenses/by-sa/4.0/deed.en)[^2]
  - Must credit the authors, may not encrypt or protect[^1] AND
  - Must distribute any derivative artwork or modifications under CC-BY-SA 4.0 or later
- [CC-BY](https://creativecommons.org/licenses/by/4.0/)
  - Must credit the authors, may not encrypt or protect[^1]
- [OGA-BY](https://static.opengameart.org/OGA-BY-3.0.txt)
  - Must credit the authors, may encrypt in DRM protected games
- [GPL](https://www.gnu.org/licenses/gpl-3.0.en.html#license-text)
  - Must distribute any derivative artwork or modifications under GPL 3.0 or later

[^1]: It is unclear whether this means you cannot release your game on platforms like Steam and the App Store on iOS which use encryption to DRM protect your game. It could be enough to make the assets easily available separately for download, but the DRM clause does not clearly state this. It could be enough to make a DRM free version available to those who purchase the game on these platforms, but again, the DRM clause does not clearly state this. To be safe from any potential legal issues, I would recommend you use CC0 and/or OGA-BY assets only if you intend to publish on such platforms. The OGA-BY license removes the DRM clause for precisely this reason.

[^2]: This is the most restrictive license for any art supplied by this generator. You may use all the art in this repository if you follow all the terms of this license. Yes, this license allows you to use the art in this generator in commercial games.

**If you generate a sprite using this tool, or use individual images taken directly from the `spritesheets` subdirectory from this repo, you must at least credit all the authors (except for CC0 licensed artwork).**

When using the generator, you can find download a text as csv or plain text file that contains all the license information of the selected assets in your spritesheet:

![license-sheet](/readme-images/credits-sheet.png)

Alternatively, you can also use the file [CREDITS.csv](/CREDITS.csv).

This file lists the authors, license(s), and links to the original URL(s), for every image inside `spritesheets`. 

Concluding, to conform to the **attribution** requirement of the used artwork, you can either:

- Distribute the entire [CREDITS.csv](/CREDITS.csv) file along with your project.
- Distribute a composed list containing the credits for the assets you use in your project. 

Make sure this credits file is accessible from within your game or app and can be reasonably discovered by users (for instance, show the information on the "Credits" screen directly, or provide a visible link).

**Importantly, the individual licenses may impose additional restrictions. It's your responsibility to conform to the licenses imposed by the artwork in use.**

If you don't want to *show* the entire credits file directly, should include a statement like this on your credits screen:

> - Sprites by: Johannes Sjölund (wulax), Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Nila122, David Conway Jr. (JaidynReiman), Carlo Enrico Victoria (Nemisys), Thane Brimhall (pennomi), laetissima, bluecarrot16, Luke Mehl, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, kheftel, Stephen Challener (Redshrike), William.Thompsonj, Marcel van de Steeg (MadMarcel), TheraHedwig, Evert, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Johannes Sjölund (wulax), Sander Frenken (castelonia), dalonedrau, Lanea Zimmerman (Sharm), Manuel Riecke (MrBeast), Barbara Riviera, Joe White, Mandi Paugh, Shaun Williams, Daniel Eddeland (daneeklu), Emilio J. Sanchez-Sierra, drjamgo, gr3yh47, tskaufma, Fabzy, Yamilian, Skorpio, kheftel, Tuomo Untinen (reemax), Tracy, thecilekli, LordNeo, Stafford McIntyre, PlatForge project, DCSS authors, DarkwallLKE, Charles Sanchez (CharlesGabriel), Radomir Dopieralski, macmanmatty, Cobra Hubbard (BlueVortexGames), Inboxninja, kcilds/Rocetti/Eredah, Napsio (Vitruvian Studio), The Foreman, AntumDeluge
> - Sprites contributed as part of the Liberated Pixel Cup project from OpenGameArt.org: http://opengameart.org/content/lpc-collection
> - License: Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0) <http://creativecommons.org/licenses/by-sa/3.0/>
> - Detailed credits: [LINK TO CREDITS.CSV FILE]

**For additional information on the licensing and attribution requirement, please refer here on [OpenGameArt.org](https://opengameart.org/content/faq#q-proprietary).**

### [Contributing](CONTRIBUTING.md) ⤴

### Animation Frame Guide

You can look at [the Animation Guide in Eliza's repository](https://github.com/ElizaWy/LPC/blob/f07f7f5892e67c932c68f70bb04472f2c64e46bc/Characters/_%20Guides%20%26%20Palettes/Animation%20Guides) for a detailed suggested guide to how she recommends you display your animations.

Also, each animation has a frame cycle documented which you can see next to the animation preview.

### Run This Project Locally for Development

Traditionally, you could run this project, by opening `index.html` in your browser of choice.
However, today's browsers have some security restrictions that do make this somewhat impractical.
You will likely have to change your browser's settings to enable it to open a file url this way.
You may instead wish to use a web server locally for development. Some free recommendations:
- IIS (Windows only) (NOT open source)
- Python (py -m http.server <port>)
- Rust (Simple Http Server)
- Node.js (require('http'))
- nginx
- npx serve
- brew serve (Mac only)
- Lighttpd

### Plugins and Development Tools for Use in Game Engines

#### Godot

There is a [plugin available for Godot 3.5](https://godotengine.org/asset-library/asset/1673)

There is another [plugin available for Godot 4.2](https://godotengine.org/asset-library/asset/2212)

#### RPG Maker MZ

There is a project under development for a [set of plugins and demo game](https://github.com/LiberatedPixelCup/RPG_Maker_MZ_LPC_Starter_Kit) under this organization.

#### Other Game Engines

We would really like to see similar tools developed for other popular game engines. If you know of any that have been developed, please open a pull request to this repository and add it to this README.

If an engine is not listed above, try Google. However, it is very likely that you will have to do some coding.

### FAQ

<dl>
  <dt>May I use this art in my commercial game?</dt>
  <dd>Yes, however you must follow all the terms of the license(s) for the art you are using. See <a href="#licensing-and-attribution-credits">Licensing and Attribution (Credits)</a></dd>
  <dt>How do I use the output of this generator in &lt;insert game engine&gt;?</dt>
  <dd>There may be resources available to do this already. We have added a <a href="#other-game-engines">list</a> for a few common game engines. If your favorite engine is not listed there, try Google. In most cases, however, you will still have to write some code.</dd>
  <dt>I downloaded the image, but I forgot to get the &lt;url, credits, etc.&gt; How do I get back to where I was?</dt>
  <dd>It is recommended that you "export to JSON" to avoid this problem in the future and save the json file with the png image file. See <a href="https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/issues/143">Issue #143</a></dd>
</dl>

### Terms

<dl>
  <dt>Liberated Pixel Cup (LPC)</dt>
  <dd>Originally a competition designed to create a large body of compatible art assets. Now also refers to that body of work and the style art marked as LPC attempts to follow.</dd>
  <dt>Universal LPC (ULPC)</dt>
  <dd>LPC originally expanded to add some new animation sizes and bases. This generator helped ensure that many assets covered all those bases and animations. LPC originally included only spellcast, slash, thrust, walk, shoot, and hurt animations for male and female adult bases. It also stuck to a standard 64x64 format. The most notable change in ULPC was to add weapons with oversize animation frames.</dd>
  <dt>LPC Revised (LPCR)</dt>
  <dd>LPC changes proposed by <a href="https://github.com/ElizaWy">@ElizaWy</a> that in some cases changed the number and order of animation frames, a new color palette, and the smaller heads.</dd>
  <dt>LPC Expanded (LPCE)</dt>
  <dd>Additional expansion of animations and bases proposed by <a href="https://github.com/ElizaWy">@ElizaWy</a> and others. New animations included bow, climb, run, and jump. New bases included child and elderly. Many of the assets in this repository are not yet drawn for these new animations and bases. Help wanted.</dd>
</dl>

### Alternative LPC Character generators

- https://pflat.itch.io/lpc-character-generator
- https://vitruvianstudio.github.io/

### Tools

- [lpctools](https://github.com/bluecarrot16/lpctools)
- [how to install lpctools](tools/LPCTOOLS.md)
- [recompile full sheets using lpctools](tools/REBUILD.md)
- [convert assets to vitruvian studios](tools/VITRUVIAN.md)

### Development

#### Performance Profiling

The generator includes built-in performance profiling tools to help identify rendering bottlenecks and optimize performance. See [PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md) for detailed documentation.

**Quick Start:**
- Profiler is automatically enabled when running on `localhost`
- Override with `?debug=true` or `?debug=false` in the URL
- View metrics in Chrome DevTools → Performance tab
- Run `profiler.report()` in the console for a summary

**What it tracks:**
- Canvas rendering time (drawing, compositing)
- Image loading performance
- UI update operations
- Frame rate (FPS)
- Memory usage

#### Palette Recoloring System

The generator uses GPU-accelerated WebGL shaders for real-time palette-based recoloring of body colors. This provides significant performance improvements over traditional CPU-based pixel manipulation.

**For Contributors:** See [PALETTE_RECOLOR_GUIDE.md](PALETTE_RECOLOR_GUIDE.md) for a complete guide on integrating items with the palette system.

**Console Commands:**

Check current rendering mode:
```javascript
getPaletteRecolorConfig()
// Returns: { forceCPU: false, useWebGL: true, activeMode: "webgl" }
```

View recolor statistics:
```javascript
getPaletteRecolorStats()
// Shows breakdown of WebGL vs CPU operations
```

Force CPU mode (useful for testing/debugging):
```javascript
setPaletteRecolorMode("cpu")
```

Switch back to WebGL mode:
```javascript
setPaletteRecolorMode("webgl")
```

**Technical Details:**
- **WebGL Mode** (default): GPU-accelerated palette swapping using fragment shaders
  - Single shared WebGL context to avoid browser context limits
  - Palette encoded as texture for fast GPU lookups
  - Significantly faster than CPU mode for multiple color variants (90ms-120ms vs 190ms-230ms per preview spreadsheet)
- **CPU Mode** (fallback): Traditional per-pixel color replacement
  - Automatically used if WebGL is unavailable
  - Can be manually forced for compatibility testing
- **Palette Flexibility**: Palettes support 1-32 colors per variant (not limited to 8)

The system automatically detects WebGL availability and falls back to CPU mode if needed.

### Examples
![example](/readme-images/example.png)
