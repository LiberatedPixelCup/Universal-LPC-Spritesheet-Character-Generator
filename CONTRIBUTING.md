### Contributing

#### Submissions

**Important: all art submitted to this project must be available under one of the supported licenses; see the `Licensing and Attribution (Credits)` section in [README.md](README.md).**

- If you are submitting art that was made by (or derived from work made by) someone else, please be sure that you have the rights to distribute that art under the licenses you choose.

- When adding new artwork to this project, please add valid licensing information inside the json files as well (part of the _credits_ object). Note the entire list of authors for that image, a URL for each piece of art from which this image is derived, and a list of licenses under which the art is available.

- While it is recommended that all new artwork follows either the refined [style guide](https://bztsrc.gitlab.io/lpc-refined/), or the [revised guide](https://github.com/ElizaWy/LPC/wiki/Style-Guide), it is not required.

This information must be part of the JSON definition for the assets, for instance:

```
  "credits": [
    {
      "file": "arms/hands/ring/stud",
      "notes": "",
      "authors": [
        "bluecarrot16"
      ],
      "licenses": [
        "CC0"
      ],
      "urls": [
        "https://opengameart.org/content/lpc-jewelry"
      ]
    }
  ]
```

If you don't add license information for your newly added files, the generation of the site sources will fail.

To add sheets to an existing category, add the sheets to the correct folder(s) in `spritesheets/`.
In addition, locate the correct `sheet_definition` in `sheet_definitions/`, and add the name of your added sheet to the `variants` array.

#### Adding a new category

To add a new category, add the sheets to the correct folder(s) in `spritesheets/`.
In addition, create a json file in `sheet_definitions/`, and define the required properties.
Copy a neighboring definition rather than inventing keys. The accepted shape is the `SheetDefinition` type in [`scripts/generateSources/items.ts`](scripts/generateSources/items.ts).
For example, you have created at this point:

`body_robot.json`

A category can exist of n-layers. For each layer, define the z-position the sheet needs to be drawn at.
For an example of a multi-layered definition, see [tail_lizard.json](sheet_definitions/body/lizard/tail_lizard.json).

You can optionally also specify the available animations the asset supports. You do not have to feel obligated to fill out all animations, and some assets may not work well on all animations anyway. In the sheet definition, you can add the "animations" array below "variants". Again, see [tail_lizard.json](sheet_definitions/body/lizard/tail_lizard.json):

```
  "animations": [
    "spellcast",
    "thrust",
    ...etc
  ]
```

If you add this animations list, users can filter the results based on the animations supported. If this list is not included in your sheet definition, then it is assumed the default list of animations are all supported:

```
    "spellcast",
    "thrust",
    "walk",
    "slash",
    "shoot",
    "hurt",
    "watering",
```

As such, if you wish to include less than this list, such as only walk and slash, you should still include the animations definition to restrict it to just those assets. Users will still be able to access your asset, but it won't appear if the animations filter is used and you did not include that animation in your sheet definition.

#### Adding a standard animation row

This is for a new row on the universal LPC sheet (a new `ANIMATION_OFFSETS` key), not for listing which rows an existing asset supports (that is the `"animations"` array above).

- [`sources/state/constants.ts`](sources/state/constants.ts): add the UI entry to `ANIMATIONS` (`folderName` if the spritesheet folder is not the `value`), the y-key to `ANIMATION_OFFSETS`, and `row` / `num` / `cycle` to `ANIMATION_CONFIGS`. Add the name to `ANIMATION_DEFAULTS` only if sheet definitions that omit `"animations"` should include it.
- [`sources/canvas/renderer.ts`](sources/canvas/renderer.ts): raise `SHEET_HEIGHT` if the new `row + num` is past the current last band (`1h_halfslash` at row 50, 4 rows). Add a `buildDrawCalls` alias branch only if the metadata name is not the offset key (`combat` → `combat_idle`, `1h_slash` → `backslash`, and similar).
- Body sheets: `spritesheets/body/bodies/<bodyType>/<folder>.png` (and any other bases that must support the row).
- [`tests/canvas/render-work_spec.ts`](tests/canvas/render-work_spec.ts): append the **metadata** name to `FULL_OFFSET_ANIMATIONS` (not the offset key). If the new band is now last, point the height formula at that `ANIMATION_CONFIGS` entry instead of `1h_halfslash`.
- Filters, preview, and ZIP only if those call sites gain a new name — copy a neighboring entry; do not invent keys.

The category tree and items in the app come from generated metadata, not from HTML. After you add or change definitions, run **File Generation** (below) and commit the updated **`CREDITS.csv`**, **`scripts/zPositioning/z_positions.csv`**, and any other tracked outputs that changed. The app’s **five** `dist/*-metadata.js` modules (see [File Generation](#file-generation)) are built by **Vite** when you run **`npm run dev`** or **`npm run build`**; they are not committed (**`/dist/`** is gitignored).

#### URL hash

The shareable selection is everything after `#` in the address bar: `key=value` pairs.

```
#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light
```

Each value is `Item_variant`. For example, `expression=Neutral_light` is `type_name` `expression`, item `Neutral`, variant `light`.

Old hashes must keep working. Do not rewrite or delete old hash keys in place. To forward a renamed asset, put `aliases` on the **destination** definition — see [Renaming an Asset](#renaming-an-asset).

#### Renaming an Asset

While rare, sometimes it may be deemed that a specific asset should get renamed or moved. In such situations, the `aliases` key comes into play. Aliases forward old [URL hash](#url-hash) values to a new item so existing links keep working.

##### When should an asset be renamed?

Asset renames should happen rarely, only if it makes sense. Sometimes older assets have generic names. Please discuss any renames in an issue with us before implementing in a PR, as renaming assets require us to carefully consider backward compatibility.

For some examples, we have belts, which show off aliases in action:

```
  "aliases": {
    "Other_belts_white": "white",
    "Other_belts_teal": "teal"
  },
```

The Other Belts category was removed in favor of shifting these belts to separate categories.

##### How to Forward Assets Using Aliases?

Aliases is an object which may be added to sheet definitions (represented by curly brackets `{` and `}`).

As an example, here's how aliases look in action:

```
  "aliases": {
    "Other_belts_white": "white",
    "Other_belts_teal": "teal"
  },
```

You can see the [full Robe Belt sheet definitions here.](./sheet_definitions/torso/waist/belt_robe.json)

The key is the exact name of the old asset and its variant, in this case:
`Other_belts_white`

`Other Belts` was the old asset name, and white was the variant.

The value tells it which variant on the current sheet definition to use. However, this value can take a full key-value pair, like so:
`"Other_belts_white": "Robe_Belt_white",`

If you include the asset name before the variant, it will manually choose which asset to implement instead of assuming the current asset is the one that is being forwarded to.

You can even include a custom type name, both in the original source asset and the forwarded asset:

```
  "belt=Other_belts_white": "Robe_Belt_white",
  "Other_belts_white": "belt=Robe_Belt_white",
```

If the type_name is NOT included, the type_name from the current sheet definition is assumed for both the origin asset and target asset.

It is highly recommended to simply drop the aliases on the sheet definition that the alias was moved to, in which case you do not need to include the type name.

#### Repository layout

| Path | Role |
| --- | --- |
| `sources/` | App TypeScript (components, canvas, state, utils) |
| `scripts/` | Node generation and other tooling (TypeScript) |
| `vite/` | Vite plugins and metadata wiring (TypeScript; config is `vite.config.ts`) |
| `tests/` | Browser Mocha specs, Node specs, Playwright visual tests (migrating to TypeScript) |
| `sheet_definitions/` | Item/category JSON (source of truth for layers, credits, aliases) |
| `palette_definitions/` | Palette JSON for GPU/CPU recolor |
| `spritesheets/` | Licensed art; do not add files without credits |
| `styles/` | App CSS (critical-shell, main, Bulma overrides, components) |
| `sources/styles/` | PurgeCSS SCSS entries (`critical-entry.scss`, `deferred-entry.scss`) |
| `dist/` | Vite output including five `*-metadata.js` modules; gitignored — do not commit |
| `coverage/` | Local/CI coverage HTML + `lcov.info`; gitignored — do not commit |
| `.agents/skills/` | Canonical agent skills (`SKILL.md`); Cursor, Codex, and Copilot load this folder |
| `.claude/skills/` | Generated local links for Claude Code; gitignored except README — `npm run skills:link` |

App CSS lives under **`styles/`**. PurgeCSS entry SCSS lives under **`sources/styles/`**. **`index.html`** is the Vite shell (layout, stylesheets, `sources/main.ts`). Change it only when you mean to adjust the page structure or global assets.

How these pieces fit together at runtime — bootstrap order, the selection-to-canvas flow, the render path, and per-module roles — is in [ARCHITECTURE.md](ARCHITECTURE.md).

#### Requirements

Install these on your machine before you run builds or tests. Versions match what CI uses (see `.github/workflows/`).

**Git**  
Used for clone, branch, and PR workflow. [Download Git](https://git-scm.com/downloads) or use your OS package manager (`git` is often pre-installed on macOS and Linux).

**Node.js 22.18+ (CI: Node.js 24) and npm**  
[`package.json`](package.json) `engines.node` is **`>=22.18.0`** so Node can run first-party **`.ts`** files with [type stripping](https://nodejs.org/docs/latest/api/typescript.html) (no `tsx` / compile step). CI uses **Node.js 24** (see [`.github/workflows/`](.github/workflows/)). Install from [nodejs.org](https://nodejs.org/) or a version manager such as [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm), then confirm your runtime:

```bash
node -v   # v22.18+ locally; CI is v24.x
npm -v    # npm ships with Node
```

After cloning, install JavaScript dependencies from the repo root:

```bash
npm ci
# After a lockfile merge or rebase conflict, use npm run lockfile:fix
# (not npm install — that drops other-platform optional dependencies)
```

Every npm script is listed under [Commands](#commands).

**JavaScript / TypeScript module format (Node)**  
New code must be TypeScript (`.ts`), including tests, scripts, and Vite plugins. Do not add new `.js` files. Editing an existing `.js` file is a chance to convert it, or at least not grow it. The root **`package.json`** sets **`"type": "module"`**, so first-party **`.js`** and **`.ts`** files are **ESM**—use **`import`** and **`export`**, not **`require`** or **`module.exports`**, for new Node scripts and tooling under **`scripts/`**, **`vite/`**, **`tests/node/`**, and similar paths. Relative imports use **explicit extensions** (`.js` or `.ts`, matching the file on disk). TypeScript must stay [erasable](https://www.typescriptlang.org/tsconfig/#erasableSyntaxOnly): no enums, namespaces, or parameter properties, so `node path/to/file.ts` works. One exception: the Testem configuration is **[`testem.cjs`](testem.cjs)** (CommonJS). [Testem](https://github.com/testem/testem) discovers **`testem.cjs`** automatically (same as **`testem.js`**, after **`testem.json` / `testem.yml`**, if those exist). Use **`--file testem.cjs`** only to force a path when you have multiple config files or need a non-default name. Unused bindings that must exist use a **`_`** prefix (ESLint). **`console.*`** except **`console.error`** are lint errors; use **`console.error`**, or **`debugLog`** / **`debugWarn`** from [`sources/utils/debug.ts`](sources/utils/debug.ts) (gated by localhost / `?debug=`).

**Type-check:** `npm run type-check` runs `tsc --noEmit` (also in the Lint workflow). The app under **`sources/`** and Vite plugins/config under **`vite/`** are TypeScript; **`scripts/`** and **`tests/`** are mid-migration (`allowJs` is still on).

**Copying `spritesheets/` into `dist/` (build)**  
**`npm run build`** copies the large **`spritesheets/`** tree into **`dist/`** as part of the Vite build (see `vite.config.ts`). Which tool runs depends on the OS:

- **Windows:** The build invokes **`robocopy`** (built into Windows). You do **not** need **rsync** or any separate copy utility for this step.
- **macOS and Linux:** The build invokes **`rsync` 3.x** on your **`PATH`**, with options that update files incrementally (for example **`-u` / `--update`**: skip overwriting when the destination file is newer).

**rsync 3.x (macOS and Linux only)**  
If you develop on **macOS** or **Linux**, install **rsync 3.x** and ensure it is what runs when you type **`rsync`**:

- **macOS:** The system **`/usr/bin/rsync`** is often **2.x** (Apple’s build). This project needs **3.x**. Check what runs by default:

  ```bash
  rsync --version
  which rsync
  ```

  If the version line does not start with **`rsync  version 3.`**, install a current rsync (for example with [Homebrew](https://brew.sh/)):

  ```bash
  brew install rsync
  ```

  Homebrew puts the binary at **`/opt/homebrew/bin/rsync`** (Apple Silicon) or **`/usr/local/bin/rsync`** (Intel). Ensure that directory appears **before** **`/usr/bin`** in your **`PATH`** (the installer normally documents this; `which rsync` should not print **`/usr/bin/rsync`**). Run **`rsync --version`** again to confirm **3.x**.

- **Linux:** Install via your package manager, for example:
  - Debian / Ubuntu: `sudo apt update && sudo apt install rsync`
  - Fedora: `sudo dnf install rsync`
  - Arch: `sudo pacman -S rsync`

**Windows note:** If you run **`npm run build`** inside **WSL** or another **Linux** environment, that environment uses the **rsync** path above, not **robocopy**. Native **Windows** shells (**cmd**, **PowerShell**, **Git Bash** with Node for Windows) use **robocopy**.

**Critical CSS (PurgeCSS)**  
First-paint CSS is trimmed by PurgeCSS. If you add a class used on first paint (or only from TypeScript), make sure it is still present after a production build. Extend the safelist in [`vite/purgecss-critical-safelist.ts`](vite/purgecss-critical-safelist.ts) when the scanner would drop it. Most styles live under **`styles/`**. PurgeCSS entry SCSS lives under **`sources/styles/`**. A class that exists only at runtime and is not scanned or safelisted can be purged and ship a blank control.

`index.html` sets `width=device-width`. Without that meta tag, mobile Lighthouse lays out at the 980px fallback width, so the 240px header floor and 314px `#download-buttons` floor (`max-width: 430px`) never match. `index.html` reserves first-paint height with **loading-shell** children inside `#mithril-filters`, `#mithril-preview`, and `#mithril-spritesheet-preview` (see [`styles/critical-shell.css`](styles/critical-shell.css)). Those nodes are replaced when Mithril mounts; do not put the reserved `min-height` on the mount roots (it would remain after hydrate). `#header-left` uses width-specific `min-height` floors (75px / 106px / 126px / 240px) so first paint does not grow into the loaded wrap; do not raise the default 75px (huge-desktop is one line). `#download-buttons` uses width-specific `min-height` floors (84px / 130px / 314px) so the wrapping ZIP row does not grow after hydrate; do not raise the default 84px (huge-desktop). Header `.title` / `.subtitle` font metrics, `h1` `margin: 10px 0 0`, and subtitle `padding-left` are pinned in [`styles/bulma-overrides-paint.css`](styles/bulma-overrides-paint.css) so they match the loaded wrap (do not leave that padding only on deferred `.subtitle`; do not leave `h1` margin to lose to `.title` on first paint). `#header-left > div { display: flex }` is in [`styles/critical-shell.css`](styles/critical-shell.css) because Bulma `.is-flex` is deferred; collapsible header/arrow/`margin-top: 1rem` are pinned there too so the Download block does not jump when `main.css` arrives. Re-set `--bulma-family-primary` on `:root, [data-theme="light"]` after Bulma’s light-theme in [`sources/styles/bulma-critical.scss`](sources/styles/bulma-critical.scss) so ZIP buttons do not wrap on Inter then reflow when deferred paint CSS switches to BlinkMacSystemFont.

**Browsers**

- **`npm test`** (browser suite via [Testem](https://github.com/testem/testem) + [Vite](https://vitejs.dev/)) uses **Chrome** and **Firefox** as configured in [`testem.cjs`](testem.cjs). CI installs them with **`browser-actions/setup-chrome`** and **`browser-actions/setup-firefox`** (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

- **`npm run test:visual`** uses Playwright. After `npm ci`, install the browser binaries at least once (or after upgrading `@playwright/test`):

```bash
npx playwright install --with-deps chromium firefox webkit
```

For visual tests only, **`npx playwright install chromium`** is enough. The Argos / visual workflow installs browsers as needed; elsewhere run **`npx playwright install chromium`** (or the full set) and add any system libraries Playwright’s installer or error output asks for if a browser fails to launch.

#### Commands

Every script in [`package.json`](package.json). Run them from the repository root.

**Everyday**

| Command | What it does | When |
| --- | --- | --- |
| `npm run dev` | Vite dev server on **5173**; runs the metadata plugin first | Working on the app. Do not open `index.html` over `file://` |
| `npm run serve:open` | Same as `dev`, opens a browser | Convenience |
| `npm run build` | Production build to `dist/`, including the `spritesheets/` copy | Before `preview`, or to test a production build |
| `npm run preview` | Serves the built `dist/` on **4173** | Checking a production build locally |
| `npm run lint` / `npm run lint:fix` | ESLint over `**/*.{js,cjs,ts}`, Prettier included via `eslint-plugin-prettier` | After any code edit. `lint` is a CI gate |
| `npm run type-check` | `tsc --noEmit` over `sources`, `scripts`, `vite`, `tests` | After any code edit. A CI gate |
| `npm run format` / `npm run format:check` | Prettier over the whole tree, Markdown included | Not gated in CI; ESLint already covers code |

**Tests**

| Command | What it does | When |
| --- | --- | --- |
| `npm test` | Node specs, then the Testem browser suite in Chrome and Firefox. Uninstrumented | Last resort; prefer one spec plus one coverage run |
| `npm run test:node` | Every Node spec under `tests/node/`. Ignores extra CLI args | Broad Node check. For one file use `node --test <file>` |
| `npm run test:server` | Testem in watch mode with a browser picker | Iterating on browser specs; supports `?grep=` |
| `npm run test:browser:coverage` | Full browser suite with Istanbul; writes `coverage/browser/` | After a gated `sources/` edit |
| `npm run test:node:coverage` | Every Node spec under `c8`; writes `coverage/node/`; prints remaining patch `DA:0` | After a gated `scripts/` edit |
| `npm run coverage:patch` | Prints remaining patch `DA:0` from existing `coverage/*/lcov.info` and exits 1 if any | After a coverage run, or to re-read the table |
| `npm run test:visual` | Playwright visual suite; starts its own server | After a layout or CSS change |
| `npm run test:visual:headed` | Same, with a visible browser | Debugging a visual failure |

**Definitions and generated files**

| Command | What it does | When |
| --- | --- | --- |
| `npm run validate-site-sources` | Regenerates `CREDITS.csv` and `z_positions.csv` in parallel | After any `sheet_definitions/` or `palette_definitions/` edit. A CI gate |
| `npm run z-positions` | Writes `z_positions.csv` from the JSON | Inspecting z-positions without the credits pass |
| `npm run z-positions:update` | Writes edited `z_positions.csv` **back** to the JSON | After bulk-editing z-positions in the CSV |
| `npm run fixture:issue382` | Rebuilds the issue-382 regression fixtures under `tests/fixtures/` | Rarely. Review the diff; do not regenerate blindly. Do not run as a drive-by after an item-lite emit change — it would drop `priority` / `tags` / `licenses` from the committed snapshot |
| `npm run metadata:size` | Reports raw, gzip, and brotli bytes per generated metadata module plus the item + index pair. Optional `--json`, `--baseline`, `--bench`. Does not write `dist/` or `CREDITS.csv` | After an emit change, or to record a size baseline |
| `npm run metadata:size:check` | Same generation as `metadata:size`, then fails if `item-metadata.js` raw exceeds 500 KiB or the item + index pair exceeds 600 KiB | After an emit change. CI runs this. Raising a budget is deliberate, not a drive-by |

**Performance and diagnostics**

| Command | What it does | When |
| --- | --- | --- |
| `npm run profile:app` | Live-app profile (WebGL + CPU by default). Headless Playwright Chromium unless `--headed --channel chrome` | `loadImage()`, `renderCharacter()`, hash hydration, or palette recolor changed |
| `npm run profile:app:baseline` | Same run, written to `tmp/baseline-app-profile.json` | Take a baseline **before** your change |
| `npm run diff:app-profile` | Diffs two app-profile JSON files; positive Δ is slower | Comparing baseline against your change |
| `npm run profile:load` | Production catalog-load profile (`vite build` + `vite preview`). Median of 5 fresh navigations: `indexReadyMs`, `liteReadyMs`, `catalogReadyMs` | `loadAllMetadata`, metadata chunks, or catalog bootstrap changed |
| `npm run profile:load:baseline` | Same run, written to `tmp/baseline-app-load-profile.json` | Take a load baseline **before** your change |
| `npm run diff:app-load-profile` | Diffs two load-profile JSON files; positive Δ is slower. Always exits 0 | Comparing load baseline against your change |
| `npm run profile:zip:quick` | Headless ZIP profile with a fake JSZip | Drawing, slicing, or PNG encode changed |
| `npm run profile:zip` | Headless ZIP profile with real JSZip. Slower | `generateAsync` or `zip-helpers` changed |
| `npm run profile:zip:baseline` / `:baseline:quick` | Same runs, written to `tmp/baseline-*.json` | Take a baseline **before** your change |
| `npm run diff:zip-profile` | Diffs two ZIP-profile JSON files; positive Δ is slower | Comparing baseline against your change |
| `npm run compute-style-dump` | Dumps computed CSS for one URL for text diffing | Comparing CSS between two branches or worktrees |
| `npm run compute-style-dump:mobile` | Same at the mobile viewport | Responsive debugging |
| `npm run compute-style-diff-all` | Dumps and diffs both URLs across all Argos viewports and page states | Wide CSS refactors, e.g. a Bulma upgrade |
| `npm run compute-style-diff-all:preview-ports` | Same against ports 4176 and 4177 | Two `npm run preview` instances |

`profile:zip` variants and the computed-style scripts need `dist/` to exist
(`npm run dev` or `npm run build` once). `profile:app` starts Vite serve.
`profile:load` runs `vite build` then `vite preview` (production compact
JSON). All of them need Chromium (`npx playwright install`). Details:
[PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md),
[performance-profiling](.agents/skills/performance-profiling/SKILL.md).

**Maintenance**

| Command | What it does | When |
| --- | --- | --- |
| `npm run lockfile:fix` | Restores `package-lock.json` keeping other-platform optional deps | After a lockfile merge or rebase conflict. Never `npm install` |
| `npm run skills:link` | Creates `.claude/skills/<name>` links to `.agents/skills/<name>` (POSIX symlink, Windows junction) | After clone if you skipped `npm ci`, or if a Claude skill folder is missing. `prepare` runs this on install |
| `npm run prebuild` | Clears `dist/` except `spritesheets/`; runs automatically before `build` | Not called directly |
| `prepare` | Runs `skills:link`; npm runs it on `npm ci` / `npm install` | Not called directly |

#### CI checks

Five workflows in [`.github/workflows/`](.github/workflows/) plus two Codecov
statuses run on pull requests to `master`. All use Node 24.

| Check | Workflow | Runs | Fails when |
| --- | --- | --- | --- |
| **Lint** | `lint.yml` | `npm run lint`, then `npm run type-check` | An ESLint error or any type error, including in `tests/` |
| **Test browsers** | `ci.yml` | `npm run test:node:coverage`, then `npm run test:browser:coverage` under Xvfb | A Node or browser spec fails. A patch miss is printed in the log and fails **`codecov/patch`**, not this job |
| **Validate site sources** | `validate-site-sources.yml` | `npm run validate-site-sources`, then asserts a clean tree, then `npm run metadata:size:check` | `CREDITS.csv` or `z_positions.csv` would change (you did not commit the regenerated file), or generated `item-metadata.js` / the item + index pair exceeds the byte budget. Raising a budget is deliberate. Load time is local (`profile:load`), not this check |
| **Visual regression (Argos)** | `visual.yml` | `npm run test:visual` | A Playwright failure. Screenshot review happens in Argos, not the check |
| **Deploy** | `deploy.yml` | `npm run build` to GitHub Pages | Only on `master`, not a PR gate |
| **`codecov/patch`** | Codecov | Compares uploaded `lcov` | Any new or edited gated production line is uncovered |
| **`codecov/changes`** | Codecov | Compares uploaded `lcov` | Previously covered lines lose hits |

The two Codecov statuses are described in [Unit-test coverage](#unit-test-coverage). Nothing gates
Markdown formatting, so `npm run format:check` is optional for a docs-only change.

#### File Generation

**Generated metadata modules (`dist/`, gitignored)** — The Vite metadata plugin (see [`vite/vite-plugin-item-metadata.ts`](vite/vite-plugin-item-metadata.ts)) runs **`generateSources`** on dev/build and writes **five** ES modules under **`dist/`** from the sheet JSON under **`sheet_definitions/`** and **`palette_definitions/`**. It hashes those trees plus **`scripts/generateSources/`**; if the hash matches a gitignored [`.cache/`](.cache/) copy from the last run and **`dist/index-metadata.js` already exists**, it **skips** all generation. Otherwise it also regenerates **[CREDITS.csv](CREDITS.csv)** and **[scripts/zPositioning/z_positions.csv](scripts/zPositioning/z_positions.csv)** in line with `npm run validate-site-sources`. Set **`VITE_REGENERATE_SOURCES=1`** to always run the full pipeline. Do not edit the generated `dist` files by hand.

| File                      | Main exports (named)                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| **`index-metadata.js`**   | `aliasMetadata`, `categoryTree`, `metadataIndexes` (path/hash indexes: `byTypeName`, `hashMatch`, intern tables `variantArrays` / `recolorVariantArrays` / `paletteArrays`) |
| **`palette-metadata.js`** | `paletteMetadata`                                                                                       |
| **`item-metadata.js`**    | `itemMetadata` — per-item **lite** records: `name`, `type_name`, `required`, `animations`, `path`, `replace_in_path`, `matchBodyColor`, preview offsets, interned `v` / `r` / per-recolor `p`. Unique palettes live in `paletteArrays` on the index chunk, not as embedded maps. No `layers` or `credits`. Deliberately omitted: `licenses` (credits chunk / `CREDITS.csv`), `tags` / `required_tags` / `excluded_tags` (sheet JSON), `priority` (generator tree sort; node `priority` still lives on `categoryTree`) |
| **`credits-metadata.js`** | `itemCredits` — map `itemId → credits[]`                                                                |
| **`layers-metadata.js`**  | `itemLayers` — map `itemId → layer objects`                                                             |

How the app loads these modules: [Catalog and state](#catalog-and-state). Note that source code
imports these as **`../<name>-metadata.js`**, not as a `dist/` path; a
`resolve.alias` in [`vite/wiring.ts`](vite/wiring.ts) rewrites the specifier.
See [ARCHITECTURE.md](ARCHITECTURE.md#generated-metadata-and-the-dist-alias).
Do not run **`npm run fixture:issue382`** as a drive-by after changing the lite
emit shape; it would drop `priority` / `tags` / `licenses` from the committed
snapshot.

**When generation is skipped (stale metadata)** — The plugin fingerprints
`sheet_definitions/`, `palette_definitions/`, and `scripts/generateSources/`
and stores the result under [`.cache/`](.cache/) (gitignored). On the next
run, if the fingerprint matches **and** `dist/index-metadata.js` exists, it
skips generation entirely. That is what makes `npm run dev` fast, but it also
means `dist/` can lag behind reality if the fingerprint inputs did not change
or the cache is stale from an interrupted run.

Symptoms: a seeded catalog resolves nothing, `not-found` errors for items you
just added, or a spec that passes for someone else. Force the full pipeline:

```bash
VITE_REGENERATE_SOURCES=1 npm run dev
```

Deleting `.cache/` has the same effect. If `dist/` is missing altogether,
anything that reads generated metadata fails — including
`seedCatalogWithGeneratedContext` in browser specs and the headless profiling
scripts — so run `npm run dev` or `npm run build` once after a fresh clone.

**Dev vs production JSON in generated files ([PR #432](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/pull/432))** — Payloads are embedded with `JSON.stringify(..., null, indent)`: **pretty-printed** when Vite runs in development (**`npm run dev`**) and **compact** when you run a production build (**`npm run build`**). The same rule applies to **all five** metadata modules, not only `item-metadata.js`. Inspect any of the files under **`dist/`** after a dev run to read structured JSON; CI and release builds use the compact form.

**Credits, z-positions, and when `dist/` is written** — To refresh **[CREDITS.csv](/CREDITS.csv)** and **[scripts/zPositioning/z_positions.csv](/scripts/zPositioning/z_positions.csv)** (without the `dist` modules), from the project root run:

```bash
npm run validate-site-sources
```

That uses **`concurrently`** to run **`generate_credits.ts`** and **`parse_zpos.ts`** (same as writing **`z_positions.csv`** from the JSON) in parallel. Alternatively, run **`node scripts/generate_credits.ts`** and **`node scripts/zPositioning/parse_zpos.ts`** separately. Do not run **`node scripts/generate_sources.ts`** as a CLI; it only prints a pointer to **`npm run validate-site-sources`** (the file’s role is to export **`generateSources`** for Vite and tests).

Vite is responsible for the five `dist/*-metadata.js` files when the plugin runs (and may update **CREDITS** / **z_positions** in the “inputs changed or first run / missing `dist` metadata” case). The plugin passes **`env`** (`development` vs `production`) into **`generateSources`** and controls JSON indentation in metadata.

**`index.html`** is the Vite entry shell (layout, stylesheets, `sources/main.ts`). It is not emitted by `generate_sources.ts`. Change it only when you mean to adjust the page structure or global assets.

The **Validate site sources** workflow (`.github/workflows/validate-site-sources.yml`) runs **`npm run validate-site-sources`**, fails if the working tree is dirty afterward, then runs **`npm run metadata:size:check`**. PRs that touch definitions must include regenerated **`CREDITS.csv`** and **`scripts/zPositioning/z_positions.csv`** whenever those files change.

**What to commit**

| Artifact | How it is produced | Commit? |
| --- | --- | --- |
| `dist/*-metadata.js` (five modules) | Vite metadata plugin on `dev` / `build` | No (`/dist/` gitignored) |
| `CREDITS.csv` | `npm run validate-site-sources` | Yes, if it changed |
| `scripts/zPositioning/z_positions.csv` | same (JSON is source of truth; the CSV is a bulk-edit aid — `npm run z-positions:update` writes back to JSON) | Yes, if it changed |
| `tests/fixtures/**` from [`scripts/fixture-builder.ts`](scripts/fixture-builder.ts) | fixture builder | Yes, but review diffs; do not regenerate blindly |
| `coverage/` | `test:node:coverage` / `test:browser:coverage` | No (`/coverage/` gitignored) |

#### Catalog and state

The app creates a catalog reader and a state object in **[`sources/main.ts`](sources/main.ts)**. `createCatalog()` produces separate runtime reader/writer capabilities over the same private stores. [`sources/install-item-metadata.ts`](sources/install-item-metadata.ts) keeps the writer, registers generated modules with parallel **`import()`**, and returns only the reader to bootstrap. Only **`main.ts`** calls **`configureStateCatalog`**, so production state operations can read that reader without threading it through every `sources/state/` function. That binding is not a hidden global for UI to read.

UI components are Mithril **`m.Component<Attrs, State>`** objects. Thread **`catalog: CatalogReader`** and **`state: State`** to composition boundaries, then prefer render-ready models with narrow commands for leaf components. `CurrentSelections` demonstrates this: `main.ts` builds the application model graph, while `App` and `FiltersPanel` only forward the relevant slice; the leaf receives neither catalog nor application state. Do not read a hidden global catalog or a module-level `state`.

Getters return **`Result<T, LoadError>`** from **`neverthrow`**. `LoadError` is `{ kind: "loading"; chunk }` or `{ kind: "not-found"; id }` ([`sources/state/catalog.ts`](sources/state/catalog.ts)). In views, use **`renderResult`** from [`sources/utils/render-result.ts`](sources/utils/render-result.ts). Elsewhere use **`.match`** / **`.unwrapOr`** / **`if (r.isErr())`**. Production code uses typed getters (`catalog.getCategoryTree()`, `catalog.getItemLite()`, `catalog.getItemLayers()`, `catalog.getItemCredits()`, `catalog.getPaletteMetadata()`, `catalog.getMetadataIndexes()`, …), not ad hoc globals. Views must not call **`CatalogWriter`** methods (`register*Metadata`, `loadCatalogFromFixtures`).

**Staged loading** — Each catalog exposes **`isIndexReady()`**, **`isLiteReady()`**, **`isCreditsReady()`**, **`isPaletteReady()`**, and **`isLayersReady()`** as synchronous predicates. Its **`catalog.ready`** object provides **`onIndexReady`**, **`onLiteReady`**, …, and **`onAllReady`** (each a **`Promise<void>`** that resolves once). The UI and bootstrap can treat **index** (tree skeleton), **lite** (item rows, hash), **credits** (license text), **palette**, and **layers** (canvas, sprite paths) as separate readiness stages.

**Tests** — Destructure **`{ reader, writer } = createCatalog()`** and create a state object with **`createState()`**. Seed through the writer and pass the reader to consumers; call **`configureStateCatalog(reader)`** when the spec exercises `sources/state/` effects. Override individual effects with **`setStateDeps`** and restore them with **`resetStateDeps`**. Use **`seedCatalog`** in [`tests/browser-catalog-fixture.js`](tests/browser-catalog-fixture.js) for explicit fixtures. **`seedCatalogWithGeneratedContext`** keeps generated palette, alias, tree, and index context and imports **`dist/index-metadata.js`** — run **`npm run dev`** or **`npm run build`** first. Alternatively register one stage through the writer with its **`register*Metadata`** method.

#### Running Tests

Browser specs run in real browsers via [Testem](https://github.com/testem/testem). Vite is embedded in middleware mode via [`vite-plugin-testem`](https://www.npmjs.com/package/vite-plugin-testem) (see [`testem.cjs`](testem.cjs)) so specs can `import` ESM from `sources/`. **`testem.cjs`** runs **Node** checks first (`before_tests`), then loads **[`tests_run.html`](tests_run.html)** with Mocha and [`tests/tests.js`](tests/tests.js).

**Run the full suite**

From the project root:

```bash
npm test
```

This runs **`node ./node_modules/testem/testem.js ci`**, which loads **[`testem.cjs`](testem.cjs)** (via Testem’s default config search), executes **`before_tests`** (`node ./tests/node/run-node-tests.js`) then the browser suite (**Chrome** and **Firefox** in CI).

**Testem client URL vs config:** [`tests_run.html`](tests_run.html) loads **`<script src="/testem.js">`**. That path is the **Testem in-browser client** served by the Testem server from the **`testem`** npm package; it is **not** the repo’s config file. Local Testem settings live in **[`testem.cjs`](testem.cjs)** at the repository root.

**`DEBUG` environment variable (optional):** When `DEBUG` is `1` or `true`, the Vite middleware used by Testem defines `import.meta.env.VITEST_DEBUG === "true"`, and [`tests/vitest-setup.js`](tests/vitest-setup.js) turns on test-friendly verbose behavior aligned with `sources/utils/debug.ts`.

```bash
DEBUG=1 npm test
# or
DEBUG=true npm test
```

**Interactive browser UI**

```bash
npm run test:server
```

This runs Testem in dev mode (browser picker / watch) against the same **[`tests_run.html`](tests_run.html)** harness.

**CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) installs **Chrome** and **Firefox**, starts **Xvfb**, and runs **`npm run test:node:coverage`** plus **`npm run test:browser:coverage`** on pushes and pull requests to **`master`**, then uploads `lcov` to [Codecov](https://codecov.io/gh/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator). That workflow uses `npm ci --ignore-scripts`; locally, install with **`npm ci`** (and **`npm run lockfile:fix`** after a lockfile merge or rebase — not `npm install`, which drops other-platform optional dependencies).

#### Unit and component specs

[`tests/tests.js`](tests/tests.js) imports every browser spec listed there. New specs are TypeScript (`*_spec.ts`); do not add a new `.js` spec. **`tests/node/`** is exercised by **`before_tests`** and by **`npm run test:node`** directly. [`tests/node/run-node-tests.js`](tests/node/run-node-tests.js) collects both **`_spec.js`** and **`_spec.ts`** under **`tests/node/`**.

Canvas specs stay flat under [`tests/canvas/`](tests/canvas/) and are grouped in `tests.js` as utils → palette → preview → renderer:

- **Utils:** [`canvas-utils_spec.js`](tests/canvas/canvas-utils_spec.js), [`mask_spec.js`](tests/canvas/mask_spec.js), [`download_spec.js`](tests/canvas/download_spec.js), [`draw-frames_spec.js`](tests/canvas/draw-frames_spec.js), [`load-images_spec.ts`](tests/canvas/load-images_spec.ts).
- **Palette:** [`palette-recolor-merge_spec.ts`](tests/canvas/palette-recolor-merge_spec.ts) (CPU merge), [`palette-recolor-cache_spec.ts`](tests/canvas/palette-recolor-cache_spec.ts), [`palette-recolor-mode_spec.ts`](tests/canvas/palette-recolor-mode_spec.ts) (mode / stats / fallback), [`palette-recolor-webgl_spec.ts`](tests/canvas/palette-recolor-webgl_spec.ts) (pixel parity / snapshot), [`palette-recolor-deferred_spec.ts`](tests/canvas/palette-recolor-deferred_spec.ts) (idle LRU), [`palette-recolor-isolation_spec.ts`](tests/canvas/palette-recolor-isolation_spec.ts), [`palette-recolor-preview_spec.ts`](tests/canvas/palette-recolor-preview_spec.ts) (`loadPalette`, `drawRecolorPreview`, `setPaletteRecolorMode`). Shared [`palette-recolor-test-helpers.ts`](tests/canvas/palette-recolor-test-helpers.ts) and [`palette-recolor-fixtures.ts`](tests/canvas/palette-recolor-fixtures.ts).
- **Preview:** [`preview-canvas_spec.js`](tests/canvas/preview-canvas_spec.js), [`preview-animation_spec.js`](tests/canvas/preview-animation_spec.js).
- **Renderer:** [`renderer_spec.ts`](tests/canvas/renderer_spec.ts) (planning / aliases / path errors), [`renderer-composite_spec.ts`](tests/canvas/renderer-composite_spec.ts) (dest pixels), [`render-work_spec.ts`](tests/canvas/render-work_spec.ts) (per-composite work budget: `drawCalls`, sheet size, image lookups), [`render-call-count_spec.ts`](tests/canvas/render-call-count_spec.ts) (how many times `renderCharacter` runs). Shared [`renderer-test-helpers.ts`](tests/canvas/renderer-test-helpers.ts). `npm run profile:app` is timing.

[`tests/vitest-setup.js`](tests/vitest-setup.js) loads **`sources/vendor-globals.ts`** and sets test flags on **`window`**. Specs create independent catalogs with **`createCatalog()`** and independent state with **`createState()`**, and register only the metadata stages and records they exercise. Shared helpers in [`tests/browser-catalog-fixture.js`](tests/browser-catalog-fixture.js) seed explicit fixture catalogs for larger ZIP scenarios. See [Catalog and state](#catalog-and-state).

Typical patterns:

- Import **`describe`**, **`it`**, **`beforeEach`**, **`afterEach`** (and suite-level **`before`** / **`after`** when needed) from **`"mocha-globals"`** (re-exported in [`tests/bdd-globals.js`](tests/bdd-globals.js)) and **`assert`** or **`expect`** from **`"chai"`**.
- Render with **`m.render(…)`** using the global **`m`**.
- Use **`beforeEach` / `afterEach`** to create and remove DOM containers.
- Seed through the writer and pass the paired reader to consumers. Thread **`catalog: CatalogReader`** and **`state: State`** into components that take them; for a leaf component that takes a render-ready model instead, build the model in the spec and pass it as its attr ([`tests/components/selections/CurrentSelections_spec.js`](tests/components/selections/CurrentSelections_spec.js)).

Example (`tests/components/MyComponent_spec.ts`):

```typescript
import { MyComponent } from "../../sources/components/MyComponent.ts";
import {
  createCatalog,
  type CatalogReader,
  type CatalogWriter,
} from "../../sources/state/catalog.ts";
import { createState, type State } from "../../sources/state/state.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

describe("MyComponent", () => {
  let container: HTMLDivElement;
  let catalog: CatalogReader;
  let catalogWriter: CatalogWriter;
  let state: State;

  beforeEach(() => {
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    state = createState();
    seedCatalog(catalogWriter, {});
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("renders correctly", () => {
    m.render(container, m(MyComponent, { catalog, state, prop: "value" }));
    const element = container.querySelector(".expected-class");
    assert.isNotNull(element);
    assert.strictEqual(element.textContent, "expected content");
  });
});
```

Node specs are listed and run via [`tests/node/run-node-tests.js`](tests/node/run-node-tests.js) (`*_spec.js` or `*_spec.ts`); add new generator tests alongside the existing `tests/node/scripts/**` files.

#### Unit-test coverage

CI measures **unit-test** line coverage only: [`c8`](https://github.com/bcoe/c8) around the Node runner for **`scripts/`** (and local Vite-plugin reports), and Istanbul (`vite-plugin-istanbul`) in the Testem browser suite for **`sources/`**. Reports upload from [`.github/workflows/ci.yml`](.github/workflows/ci.yml) to Codecov as flags **`node`** (`scripts/`) and **`browser`** (`sources/`). Each step sets **`disable_search: true`** so only the processed `lcov.info` is sent — not raw `coverage-final.json` or `coverage/node/tmp/*.json`. The marker also drops Istanbul `FN` / `BRDA` rows; Codecov patch is **line** coverage (`DA`) only. Playwright / Argos visual tests are not instrumented.

**Run locally**

```bash
npm run test:node:coverage
npm run test:browser:coverage
```

Plain **`npm test`** / **`npm run test:server`** stay uninstrumented. Coverage HTML and `lcov.info` land under **`coverage/node/`** and **`coverage/browser/`**. Browser collection is off unless **`VITE_COVERAGE=true`** (the `test:browser:coverage` script sets that).

If you changed patch-gated code under **`scripts/`** (see [`codecov.yml`](codecov.yml) `ignore:`), run **`npm run test:node:coverage`**. Browser coverage will not see those files. If you changed **`sources/`**, run **`npm run test:browser:coverage`**.

**Confirm new lines locally** — Read the printed patch-miss table from **`test:node:coverage`** / **`test:browser:coverage`** (or **`npm run coverage:patch`**), and open **`coverage/browser/index.html`** or **`coverage/node/index.html`**. Do not wait for the Codecov PR comment; it does not list line numbers.

**PR checks** (see [`codecov.yml`](codecov.yml)):

- **`codecov/patch`** — every new or edited production line under `sources/` (browser) or the generate-sources scripts (Node) must be executed by a unit test (100% patch). Comments, blank lines, erased TypeScript, and lines Istanbul does not give a statement counter (argument-only lines, object shorthands, function headers, or source-map holes with no `DA` row) do not count. A `DA:0` row on a straight-line statement in an already-entered function or `try` / `finally`, or on a control-flow header whose body already has a hit, is treated as a neighbor source-map hole; `DA:0` inside an unentered then / catch still fails until a test executes that statement.
- **`codecov/changes`** — existing production lines must not lose hits (deleted or weakened unit tests).
- There is **no** overall coverage-percentage gate. Adding a large file will not fail the PR just because the project average moved.

Ignored in the report: see the `ignore:` block in [`codecov.yml`](codecov.yml).

Contributors do not need a Codecov account or token. Fork pull requests run on the same `pull_request` workflow as today’s browser tests; uploads from forks are tokenless. Maintainers: installing the [Codecov GitHub App](https://github.com/apps/codecov), setting the `CODECOV_TOKEN` Actions secret, and requiring `codecov/patch` plus `codecov/changes` after `master` has a baseline are one-time repo settings. See [Codecov’s GitHub quick start](https://docs.codecov.com/docs/quick-start).

#### Visual regression tests (Playwright + Argos)

Full-page screenshots live under [`tests/visual/`](tests/visual/) and use [`playwright.config.js`](playwright.config.js) (separate from the Testem browser suite). [Argos](https://argos-ci.com/) uploads run only when **`ARGOS_TOKEN`** is set (a repository secret in CI).

**Run locally**

1. Install dependencies and all browsers for Playwright (once per machine or after upgrading Playwright):

   ```bash
   npm ci
   npx playwright install --with-deps
   ```

2. Run the visual suite:

   ```bash
   npm run test:visual
   ```

   Playwright’s **`webServer`** in `playwright.config.js` starts the app for you: locally it runs **`npm run dev`** and waits for **http://localhost:5173**. In CI it runs **`npm run build`** then **`npm run preview -- --port 5173`**.

   By default tests use **headless** Chromium. Use **`npm run test:visual:headed`** to watch the browser.

   [`tests/visual/home-helpers.ts`](tests/visual/home-helpers.ts) waits for the preview canvas, for `.loading` to disappear on the preview panels, and for paint frames before Argos screenshots (with a best-effort **`networkidle`** wait). Without **`ARGOS_TOKEN`**, navigation and layout still run but Argos capture/upload is skipped. Override the origin with **`PLAYWRIGHT_TEST_BASE_URL`** (see [`tests/visual/home.spec.js`](tests/visual/home.spec.js)).

#### Troubleshooting

Symptoms that look like catalog or test bugs are often environment. Check these first.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `not-found`, empty tree, or `seedCatalogWithGeneratedContext` resolves nothing after a fresh clone | `dist/*-metadata.js` was never built | `npm run dev` or `npm run build` once |
| A new definition is invisible, or a spec passes for someone else | `.cache/` fingerprint skipped generation | `VITE_REGENERATE_SOURCES=1 npm run dev`, or delete `.cache/` |
| Codecov patch fails with no Mocha failure | Browser spec is not imported from [`tests/tests.js`](tests/tests.js) | Add `import "./path/foo_spec.ts";` (real on-disk extension) |
| Testem cannot bind | Port **7357** is busy | `TESTEM_PORT=7360 npm run test:server` |
| `npm run test:visual` or `profile:app` / `profile:load` / `profile:zip` cannot launch a browser | Playwright browsers not installed | `npx playwright install chromium` (or `--with-deps`) |
| `profile:app --channel chrome` cannot launch | Google Chrome is not installed, or Playwright cannot see it | Install Chrome; run from a normal terminal, not a sandbox |
| `npm run test:browser:coverage` fails to launch Firefox | Firefox is not installed locally | `VITE_COVERAGE=true node ./node_modules/testem/testem.js ci --launch Chrome`. Firefox-only lines will read as uncovered |

More on stale metadata: [File Generation](#file-generation). More on coverage collection: [Unit-test coverage](#unit-test-coverage).

#### Doc ownership

When a change makes documentation stale, update the file that owns that topic. [AGENTS.md](AGENTS.md) lists the prohibitions and routes each change to its check; the skill or section below owns the detail. Do not duplicate walkthroughs or restate a skill there.

| Change | Update |
| --- | --- |
| `sheet_definitions/`, credits, variants, aliases, z-positions | [sheet-definition](.agents/skills/sheet-definition/SKILL.md); commit dirty `CREDITS.csv` / `z_positions.csv`; [z-positions](#z-positions) |
| `constants.ts` animation lists / new LPC sheet row | [Adding a standard animation row](#adding-a-standard-animation-row) |
| Bootstrap, render path, module roles | [ARCHITECTURE.md](ARCHITECTURE.md) |
| `sources/canvas/`, palette recolor, WebGL vs CPU | [canvas-render](.agents/skills/canvas-render/SKILL.md), [PALETTE_RECOLOR_GUIDE.md](PALETTE_RECOLOR_GUIDE.md) |
| Catalog, `state`, hash | [catalog](.agents/skills/catalog/SKILL.md), [Catalog and state](#catalog-and-state) |
| `dist/` metadata, `.cache/`, Vite metadata plugin | [generated-metadata](.agents/skills/generated-metadata/SKILL.md), [File Generation](#file-generation) |
| Coverage gates or `codecov.yml` | [coverage](.agents/skills/coverage/SKILL.md), [Unit-test coverage](#unit-test-coverage) |
| Layout, first-paint CSS, PurgeCSS safelist, Playwright | [visual-test](.agents/skills/visual-test/SKILL.md), [`vite/purgecss-critical-safelist.ts`](vite/purgecss-critical-safelist.ts) |
| ZIP export, render, or catalog-load timing | [PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md), [performance-profiling](.agents/skills/performance-profiling/SKILL.md) |
| `.js` → `.ts` conversion, erasable syntax, `tsc` | [typescript](.agents/skills/typescript/SKILL.md) |
| New npm script or CI workflow | [Commands](#commands), [CI checks](#ci-checks) |
| Agent skills (`SKILL.md`) | [`.agents/skills/`](.agents/skills/); run `npm run skills:link` so Claude Code sees the new folder |

#### z-positions

In order to facilitate easier management of the z-positions of the assets in this repo, there is a [script](/scripts/zPositioning/parse_zpos.ts) that traverses all JSON files and write's the layer's z-position to a CSV.

To run this script directly:

`node scripts/zPositioning/parse_zpos.ts`

The same script is also available as **`npm run z-positions`**.

This [CSV file](/scripts/zPositioning/z_positions.csv) is regenerated whenever you run:

`npm run validate-site-sources`

Therefore, before creating a PR, make sure you have committed the CSV to the repo as well.

Using this CSV, one can more clearly see the overview of all the z-position used per asset's layer.

Moreover, one can adjust the z-position from within the CSV, and then run:

`node scripts/zPositioning/update_zpos.ts`

(equivalently **`npm run z-positions:update`**)

In order to reflect the changes made back into the JSON files.

**Concluding, please remember that the JSON files will always contain the source of truth with regard to the z-position an asset will be rendered at. The CSV is there to give an overview of the z-positions in use, and provides a mean to easily alter them from a single file.**
