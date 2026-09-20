LPC Spritesheet Character Generator
=============================================

#### Translations

[![en](https://img.shields.io/badge/lang-en-red.svg)](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/README.md) [![zh](https://img.shields.io/badge/lang-zh-green.svg)](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/lang/zh/README_ZH.md)

#### Badges

[![codecov](https://codecov.io/gh/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/graph/badge.svg?branch=master)](https://codecov.io/gh/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)

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

If you don't want to _show_ the entire credits file directly, should include a statement like this on your credits screen:

> - Sprites by: Johannes Sjölund (wulax), Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Nila122, David Conway Jr. (JaidynReiman), Carlo Enrico Victoria (Nemisys), Thane Brimhall (pennomi), laetissima, bluecarrot16, Luke Mehl, Benjamin K. Smith (BenCreating), MuffinElZangano, Durrani, kheftel, Stephen Challener (Redshrike), William.Thompsonj, Marcel van de Steeg (MadMarcel), TheraHedwig, Evert, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Johannes Sjölund (wulax), Sander Frenken (castelonia), dalonedrau, Lanea Zimmerman (Sharm), Manuel Riecke (MrBeast), Barbara Riviera, Joe White, Mandi Paugh, Shaun Williams, Daniel Eddeland (daneeklu), Emilio J. Sanchez-Sierra, drjamgo, gr3yh47, tskaufma, Fabzy, Yamilian, Skorpio, kheftel, Tuomo Untinen (reemax), Tracy, thecilekli, LordNeo, Stafford McIntyre, PlatForge project, DCSS authors, DarkwallLKE, Charles Sanchez (CharlesGabriel), Radomir Dopieralski, macmanmatty, Cobra Hubbard (BlueVortexGames), Inboxninja, kcilds/Rocetti/Eredah, Napsio (Vitruvian Studio), The Foreman, AntumDeluge
> - Sprites contributed as part of the Liberated Pixel Cup project from OpenGameArt.org: http://opengameart.org/content/lpc-collection
> - License: Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0) <http://creativecommons.org/licenses/by-sa/3.0/>
> - Detailed credits: [LINK TO CREDITS.CSV FILE]

**For additional information on the licensing and attribution requirement, please refer here on [OpenGameArt.org](https://opengameart.org/content/faq#q-proprietary).**

### [Contributing](CONTRIBUTING.md) ⤴

### Test coverage

Unit-test line coverage is reported on [Codecov](https://codecov.io/gh/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) (free for this public repo). The [badge](https://codecov.io/gh/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) above tracks the default branch.

Coverage comes from Node (`node:test`) and Testem/Mocha in Chrome and Firefox only. Playwright visual tests are **not** included; they stay on Argos.

Pull requests fail if **new or edited production lines** are not executed by a unit test, or if **existing production lines lose coverage** (deleted or weakened unit tests). They do **not** fail because the overall coverage percentage moved. See [CONTRIBUTING.md](CONTRIBUTING.md#unit-test-coverage) for how to run reports locally and what the checks mean.

### Animation Frame Guide

You can look at [the Animation Guide in Eliza's repository](https://github.com/ElizaWy/LPC/blob/f07f7f5892e67c932c68f70bb04472f2c64e46bc/Characters/_%20Guides%20%26%20Palettes/Animation%20Guides) for a detailed suggested guide to how she recommends you display your animations.

Also, each animation has a frame cycle documented which you can see next to the animation preview.

### Run This Project Locally for Development

The UI is built with [Vite](https://vitejs.dev/). Use a dev server rather than opening `index.html` as a `file://` URL, since ES modules and asset paths expect HTTP and modern browsers restrict file URLs.

**Recommended workflow**

1. Run **`npm ci`** once. After a lockfile merge or rebase, use **`npm run lockfile:fix`**, not **`npm install`**.
2. Start the app with **`npm run dev`** (default **http://localhost:5173**) or **`npm run serve:open`** to open it in your default browser.

For a **production-like** build locally, run **`npm run build`** then **`npm run preview`** (Vite’s default preview port is **4173**; the dev server uses **5173** by default). To use another port, pass Vite’s **`--port`** flag (for example `npm run dev -- --port 3000`).

Other local servers (Python `http.server`, `npx serve`, nginx, and so on) can serve the built tree for experimentation, but **`npm run dev`** is what this repository is set up for day to day.

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
- [Calculate minimal bounding box offsets for oversize animations](https://github.com/matheoheo/LPCFramesAnalyzer)

### Development

#### Tooling

Requires **Node.js 22.19+** (`package.json` `engines`; CI uses Node 24) so `node` can run first-party `.ts` files. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, [Commands](CONTRIBUTING.md#commands) for every npm script, and [ARCHITECTURE.md](ARCHITECTURE.md) for how the app is wired at runtime.

- **Lint:** `npm run lint`
- **Type-check:** `npm run type-check`
- **Format:** `npm run format:check` (verify) or `npm run format` (apply)
- **Tests:** `npm test` (Node checks plus browser tests). Visual regression: `npm run test:visual`. Details are in [CONTRIBUTING.md](CONTRIBUTING.md).

**Generated files:** [CREDITS.csv](CREDITS.csv) and the z-position CSV under **`scripts/zPositioning/`** are updated by **`npm run validate-site-sources`**. **Vite** runs the metadata plugin; when inputs or **`dist/`** output warrant it, it can refresh those CSVs and always writes the **five** modules under **`dist/`** (`index-`, `palette-`, `item-`, `credits-`, `layers-metadata.js`). The app registers them in **[`sources/install-item-metadata.ts`](sources/install-item-metadata.ts)** into a **`CatalogReader`**. The **`dist/`** tree is gitignored—do not edit generated files by hand. **`npm run dev`** pretty-prints embedded JSON; **`npm run build`** writes compact (see [PR #432](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/pull/432)). See [CONTRIBUTING.md](CONTRIBUTING.md#catalog-and-state) for the catalog API and staged loading, and [File Generation](CONTRIBUTING.md#file-generation) for the full workflow.

#### Performance Profiling

The generator includes built-in performance profiling tools to help identify rendering bottlenecks and optimize performance. See [PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md) for detailed documentation.

**Quick Start:**

- Profiler is automatically enabled when running on `localhost`
- Override with `?debug=true` or `?debug=false` in the URL
- View metrics in Chrome DevTools → Performance tab
- Run `profiler.report()` in the console for a summary
- Catalog load (production preview): `npm run profile:load`
- Lab CLS (Lighthouse, production preview): `npm run profile:cls` — see [CLS.md](CLS.md)
- Metadata bytes (CI budget): `npm run metadata:size` / `npm run metadata:size:check`

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
getPaletteRecolorConfig();
// Returns: { forceCPU: false, useWebGL: true, activeMode: "webgl" }
```

View recolor statistics:

```javascript
getPaletteRecolorStats();
// Shows breakdown of WebGL vs CPU operations
```

Force CPU mode (useful for testing/debugging):

```javascript
setPaletteRecolorMode("cpu");
```

Switch back to WebGL mode:

```javascript
setPaletteRecolorMode("webgl");
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

### Sponsors

[![Deploys by Netlify](sources/netlify-badge-dark.svg)](https://www.netlify.com)

[![Covered by Argos](sources/badge-large.svg)](https://argos-ci.com?utm_source=LiberatedPixelCup&utm_campaign=oss)


## 🌐 Web Resources & Aesthetic Symbols Index
- [SYM 2626](https://lace-bow-symbols-18.pages.dev/symbol/sym-2626/)
- [CAPRICORN ZODIAC GOAT](https://pure-space-symbols-65.pages.dev/symbol/capricorn-zodiac-goat/)
- [SYM 2685](https://moe-kaomoji-vault-94.pages.dev/symbol/sym-2685/)
- [ROBLOX NAMES](https://pastel-chibi-fonts-48.pages.dev/ru/roblox-names/)
- [GAMING WEAPONS](https://classic-literature-symbols-64.pages.dev/vi/gaming-weapons/)
- [SYM 1F970](https://neon-glitch-fonts-64.pages.dev/symbol/sym-1f970/)
- [SYM 1D499](https://synthwave-text-vault-95.pages.dev/symbol/sym-1d499/)
- [STARS](https://cyber-clan-tags-38.pages.dev/ja/stars/)
- [NATURE FLOWERS](https://pastel-moe-emoticons-55.pages.dev/ja/nature-flowers/)
- [SYM 1F9D0](https://synthwave-game-tags-66.pages.dev/symbol/sym-1f9d0/)
- [SYM 2764 FE0F](https://glitch-mecha-kaomoji-69.pages.dev/symbol/sym-2764-fe0f/)
- [ARROWS LINES](https://cyber-clan-tags-38.pages.dev/ru/arrows-lines/)
- [SYM 1F631](https://occult-rune-symbols-64.pages.dev/symbol/sym-1f631/)
- [SYM 1F479](https://mecha-gamer-fonts-53.pages.dev/symbol/sym-1f479/)
- [WARM HUG EMBRACE KAOMOJI](https://synth-crosshair-text-47.pages.dev/symbol/warm-hug-embrace-kaomoji/)
- [SIX POINTED BLACK STAR](https://classic-typewriter-symbols-19.pages.dev/symbol/six-pointed-black-star/)
- [SYM 1D42D](https://vintage-runes-text-35.pages.dev/symbol/sym-1d42d/)
- [TABLE FLIP RAGE KAOMOJI](https://scholar-rune-symbols-77.pages.dev/symbol/table-flip-rage-kaomoji/)
- [SYM 273C](https://clean-unicode-text-68.pages.dev/symbol/sym-273c/)
- [SYM 1D47A](https://synthwave-game-tags-66.pages.dev/symbol/sym-1d47a/)
- [SYM 1D46D](https://mecha-gamer-fonts-53.pages.dev/symbol/sym-1d46d/)
- [PISCES ZODIAC FISHES](https://vintage-runes-text-35.pages.dev/symbol/pisces-zodiac-fishes/)
- [SYM 26F6](https://occult-rune-symbols-64.pages.dev/symbol/sym-26f6/)
- [GAMING WEAPONS](https://classic-literature-runes-13.pages.dev/gaming-weapons/)
- [SYM 26BD](https://gothic-bio-fonts-61.pages.dev/symbol/sym-26bd/)
- [FREEFIRE NAMES](https://moe-star-kaomoji-60.pages.dev/ru/freefire-names/)
- [BLUSHING SOFT SMILE KAOMOJI](https://cyber-clan-tags-38.pages.dev/symbol/blushing-soft-smile-kaomoji/)
- [SIXTEEN POINTED STAR](https://gothic-bio-fonts-87.pages.dev/symbol/sixteen-pointed-star/)
- [SYM 1F60B](https://simple-line-symbols-28.pages.dev/symbol/sym-1f60b/)
- [SYM 273E](https://chibi-flower-emoticons-63.pages.dev/symbol/sym-273e/)
- [HEARTS](https://zen-spacing-text-68.pages.dev/hearts/)
- [KAOMOJI](https://chibi-flower-emoticons-63.pages.dev/pt/kaomoji/)
- [SYM 1F47E](https://gothic-bio-fonts-61.pages.dev/symbol/sym-1f47e/)
- [STAR OPERATOR](https://synthwave-game-tags-66.pages.dev/symbol/star-operator/)
- [SYM 26C4](https://cyber-clan-tags-38.pages.dev/symbol/sym-26c4/)
- [SYM 26CC](https://minimal-star-symbols-20.pages.dev/symbol/sym-26cc/)
- [SYM 1D49C](https://chibi-flower-emoticons-63.pages.dev/symbol/sym-1d49c/)
- [DAGGER CROSS SYMBOL](https://chibi-flower-emoticons-63.pages.dev/symbol/dagger-cross-symbol/)
- [SYM 1F641](https://gothic-bio-fonts-87.pages.dev/symbol/sym-1f641/)
- [SYM 2654](https://cyber-clan-tags-38.pages.dev/symbol/sym-2654/)
- [SYM 26F8](https://minimal-star-symbols-20.pages.dev/symbol/sym-26f8/)
- [SYM 1F92B](https://neon-gamer-symbols-64.pages.dev/symbol/sym-1f92b/)
- [SYM 2662](https://cyber-clan-tags-38.pages.dev/symbol/sym-2662/)
- [SYM 26C0](https://classic-literature-runes-13.pages.dev/symbol/sym-26c0/)
- [ZODIAC CELESTIAL](https://mecha-gamer-fonts-53.pages.dev/vi/zodiac-celestial/)
- [ZODIAC CELESTIAL](https://classic-literature-runes-13.pages.dev/vi/zodiac-celestial/)
- [SYM 1D41C](https://techwear-bio-symbols-45.pages.dev/symbol/sym-1d41c/)
- [SYM 2688](https://mecha-gamer-fonts-53.pages.dev/symbol/sym-2688/)
- [SYM 2655](https://zen-spacing-text-68.pages.dev/symbol/sym-2655/)
- [SYM 1F924](https://occult-rune-symbols-64.pages.dev/symbol/sym-1f924/)
- [STARS](https://chibi-flower-emoticons-63.pages.dev/stars/)
- [ZODIAC CELESTIAL](https://mecha-gamer-fonts-53.pages.dev/es/zodiac-celestial/)
- [SYM 2645](https://cyber-clan-tags-38.pages.dev/symbol/sym-2645/)
- [SYM 26E7](https://occult-rune-symbols-64.pages.dev/symbol/sym-26e7/)
- [JA](https://classic-literature-runes-13.pages.dev/ja/)
- [CAPRICORN ZODIAC GOAT](https://clean-unicode-text-68.pages.dev/symbol/capricorn-zodiac-goat/)
- [SYM 2672](https://cyber-clan-tags-38.pages.dev/symbol/sym-2672/)
- [SYM 1D458](https://cyber-clan-tags-38.pages.dev/symbol/sym-1d458/)
- [SYM 1D458](https://chibi-flower-emoticons-63.pages.dev/symbol/sym-1d458/)
- [FREEFIRE NAMES](https://chibi-flower-emoticons-63.pages.dev/ru/freefire-names/)
- [ROBLOX NAMES](https://mecha-gamer-fonts-53.pages.dev/roblox-names/)
- [SYM 1F605](https://gothic-bio-fonts-61.pages.dev/symbol/sym-1f605/)
- [SYM 1F479](https://balletcore-unicode-67.pages.dev/symbol/sym-1f479/)
- [DAGGER CROSS SYMBOL](https://cyber-clan-tags-65.pages.dev/symbol/dagger-cross-symbol/)
- [SYM 1F60B](https://coquette-aesthetic-symbols-45.pages.dev/symbol/sym-1f60b/)
- [SYM 1F602](https://anime-sparkle-text-50.pages.dev/symbol/sym-1f602/)
- [SYM 2738](https://mecha-gamer-fonts-53.pages.dev/symbol/sym-2738/)
- [SYM 1D44B](https://vintage-bow-kaomoji-63.pages.dev/symbol/sym-1d44b/)
- [CHEERING FIGHTING FIST KAOMOJI](https://manga-bubble-fonts-35.pages.dev/symbol/cheering-fighting-fist-kaomoji/)
- [SYM 1D480](https://classic-literature-runes-13.pages.dev/symbol/sym-1d480/)
- [RIGHT WING CLAN FLARE](https://occult-rune-symbols-64.pages.dev/symbol/right-wing-clan-flare/)
- [LATIN CROSS HEAVY](https://minimal-star-symbols-26.pages.dev/symbol/latin-cross-heavy/)
- [AQUARIUS ZODIAC WATER BEARER](https://synthwave-game-tags-66.pages.dev/symbol/aquarius-zodiac-water-bearer/)
- [SYM 1F61A](https://zen-spacing-text-68.pages.dev/symbol/sym-1f61a/)
- [BLACK FOUR POINT STAR](https://coquette-aesthetic-symbols-45.pages.dev/symbol/black-four-point-star/)
- [SYM 1F47B](https://vintage-runes-text-35.pages.dev/symbol/sym-1f47b/)
- [SYM 1D413](https://cyber-clan-tags-38.pages.dev/symbol/sym-1d413/)
- [SYM 1F618](https://glitch-matrix-fonts-28.pages.dev/symbol/sym-1f618/)
- [SYM 26A9](https://mecha-gamer-fonts-53.pages.dev/symbol/sym-26a9/)
- [RIGHT WING CLAN FLARE](https://chibi-flower-emoticons-63.pages.dev/symbol/right-wing-clan-flare/)
- [DISCORD STATUS](https://coquette-aesthetic-symbols-45.pages.dev/es/discord-status/)
- [ES](https://manga-bubble-fonts-35.pages.dev/es/)
- [ROBLOX NAMES](https://occult-rune-symbols-64.pages.dev/ru/roblox-names/)
- [SYM 1D44B](https://soft-ribbon-fonts-77.pages.dev/symbol/sym-1d44b/)
- [KAOMOJI](https://coquette-aesthetic-symbols-45.pages.dev/es/kaomoji/)
- [TIKTOK CAPTIONS](https://classic-literature-runes-13.pages.dev/pt/tiktok-captions/)
- [TIKTOK CAPTIONS](https://occult-rune-symbols-64.pages.dev/ru/tiktok-captions/)
- [SYM 2610](https://classic-literature-runes-13.pages.dev/symbol/sym-2610/)
- [SYM 1F925](https://occult-rune-symbols-64.pages.dev/symbol/sym-1f925/)
- [AESTHETIC MINIMAL CLOUD](https://clean-unicode-text-68.pages.dev/symbol/aesthetic-minimal-cloud/)
- [SYM 26F2](https://glitch-matrix-fonts-28.pages.dev/symbol/sym-26f2/)
- [SYM 1D466](https://cyber-clan-tags-38.pages.dev/symbol/sym-1d466/)
- [LEFT HEAVY BRACKET BOX](https://synthwave-game-tags-66.pages.dev/symbol/left-heavy-bracket-box/)
- [WHITE STAR](https://clean-unicode-text-68.pages.dev/symbol/white-star/)
- [ZODIAC CELESTIAL](https://soft-ribbon-fonts-77.pages.dev/vi/zodiac-celestial/)
- [SYM 1D477](https://occult-rune-symbols-64.pages.dev/symbol/sym-1d477/)
- [SYM 1D493](https://gothic-bio-fonts-87.pages.dev/symbol/sym-1d493/)
- [SYM 1F61C](https://gothic-bio-fonts-61.pages.dev/symbol/sym-1f61c/)
- [CRYING TEARS SAD KAOMOJI](https://balletcore-unicode-67.pages.dev/symbol/crying-tears-sad-kaomoji/)
- [SYM 260B](https://mecha-gamer-fonts-53.pages.dev/symbol/sym-260b/)
- [BRACKETS](https://mecha-gamer-fonts-53.pages.dev/brackets/)
- [SYM 1F49D](https://minimal-star-symbols-22.pages.dev/symbol/sym-1f49d/)
- [ROBLOX NAMES](https://classic-literature-runes-13.pages.dev/vi/roblox-names/)
- [SYM 1D47E](https://classic-literature-runes-13.pages.dev/symbol/sym-1d47e/)
- [ARROWS LINES](https://coquette-aesthetic-symbols-45.pages.dev/pt/arrows-lines/)
- [SYM 26F6](https://minimal-star-symbols-20.pages.dev/symbol/sym-26f6/)
- [SYM 1D470](https://gothic-bio-fonts-87.pages.dev/symbol/sym-1d470/)
- [SYM 274A](https://classic-literature-runes-13.pages.dev/symbol/sym-274a/)
- [SYM 2613](https://vintage-runes-text-35.pages.dev/symbol/sym-2613/)
- [ZODIAC CELESTIAL](https://mecha-gamer-fonts-53.pages.dev/pt/zodiac-celestial/)
- [CUPID FEATHERY ARROW](https://gothic-bio-fonts-87.pages.dev/symbol/cupid-feathery-arrow/)
- [FREEFIRE NAMES](https://classic-literature-runes-13.pages.dev/freefire-names/)
- [SYM 2689](https://chibi-flower-emoticons-63.pages.dev/symbol/sym-2689/)
- [SYM 1D400](https://mecha-gamer-fonts-53.pages.dev/symbol/sym-1d400/)
- [SYM 26B0](https://vintage-runes-text-35.pages.dev/symbol/sym-26b0/)
- [SYM 1D472](https://balletcore-unicode-67.pages.dev/symbol/sym-1d472/)
- [SYM 1F634](https://pearl-heart-symbols-95.pages.dev/symbol/sym-1f634/)
- [KAOMOJI](https://classic-literature-runes-13.pages.dev/es/kaomoji/)
- [SYM 1D43F](https://pearl-heart-symbols-95.pages.dev/symbol/sym-1d43f/)
- [CUTE BUNNY RABBIT FACE](https://mecha-gamer-fonts-53.pages.dev/symbol/cute-bunny-rabbit-face/)
- [SYM 2642](https://alchemist-symbol-hub-29.pages.dev/symbol/sym-2642/)
- [SYM 26F1](https://cyber-clan-tags-20.pages.dev/symbol/sym-26f1/)
- [SYM 1F639](https://vintage-runes-text-63.pages.dev/symbol/sym-1f639/)
- [SYM 26AE](https://mystic-occult-fonts-26.pages.dev/symbol/sym-26ae/)
- [GOTHIC OBSIDIAN SKULL CREST](https://classic-literature-runes-13.pages.dev/symbol/gothic-obsidian-skull-crest/)
- [PT](https://balletcore-unicode-67.pages.dev/pt/)
- [SYM 1D404](https://occult-rune-symbols-64.pages.dev/symbol/sym-1d404/)
- [SYM 1D493](https://classic-literature-runes-13.pages.dev/symbol/sym-1d493/)
- [SYM 1D417](https://zen-typography-hub-86.pages.dev/symbol/sym-1d417/)
- [SYM 1D466](https://sleek-arrow-symbols-42.pages.dev/symbol/sym-1d466/)
