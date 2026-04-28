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

#### Adding a new category / sheet definition

To add a new category, add the sheets to the correct folder(s) in `spritesheets/`.
In addition, create a json file in `sheet_definitions/`, and define the required properties.
For example, you have created at this point:

`body_robot.json`

A category can exist of n-layers. For each layer, define the z-position the sheet needs to be drawn at.
For an example of a multi-layered definition, refer here [here](/sheet_definitions/tail_lizard.json).

You can optionally also specify the available animations the asset supports. You do not have to feel obligated to fill out all animations, and some assets may not work well on all animations anyway. In the sheet definition, you can add the "animations" array below "variants". Again, refer here [here](/sheet_definitions/tail_lizard.json):

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

The category tree and items in the app come from generated metadata, not from HTML. After you add or change definitions, run **File Generation** (below) and commit the updated **`CREDITS.csv`**, **`scripts/zPositioning/z_positions.csv`**, and any other tracked outputs that changed. The app’s **five** `dist/*-metadata.js` modules (see [File Generation](#file-generation)) are built by **Vite** when you run **`npm run dev`** or **`npm run build`**; they are not committed (**`/dist/`** is gitignored).

#### Renaming an Asset

While rare, sometimes it may be deemed that a specific asset should get renamed or moved. In such situations, the aliases key comes into play.

Aliases are a way to forward one asset path into another in order to maintain backward compatibility. This comes in the form of key=value pairs in the current url hash:

```
#sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light
```

The hash tag is everything after `#` in the address bar. This shows the currently selected assets. The keys are before the equals sign and the values are after.

For example, `expression=Neutral_light` shows the type_name of `expression`, the selected item as `Neutral` and the variant as `light`.

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

#### Requirements

Install these on your machine before you run builds or tests. Versions match what CI uses (see `.github/workflows/`).

**Git**  
Used for clone, branch, and PR workflow. [Download Git](https://git-scm.com/downloads) or use your OS package manager (`git` is often pre-installed on macOS and Linux).

**Node.js 24 and npm**  
CI uses **Node.js 24** (see [`.github/workflows/`](.github/workflows/)). Install from [nodejs.org](https://nodejs.org/) or a version manager such as [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm), then confirm your runtime matches or is compatible with CI:

```bash
node -v   # expect v24.x
npm -v    # npm ships with Node
```

After cloning, install JavaScript dependencies from the repo root:

```bash
npm ci
# or, for everyday work: npm install
```

**JavaScript module format (Node)**  
The root **`package.json`** sets **`"type": "module"`**, so first-party **`.js`** files are **ESM**—use **`import`** and **`export`**, not **`require`** or **`module.exports`**, for new Node scripts and tooling under **`scripts/`**, **`vite/`**, **`tests/node/`**, and similar paths. One exception: the Testem configuration is **[`testem.cjs`](testem.cjs)** (CommonJS). [Testem](https://github.com/testem/testem) discovers **`testem.cjs`** automatically (same as **`testem.js`**, after **`testem.json` / `testem.yml`**, if those exist). Use **`--file testem.cjs`** only to force a path when you have multiple config files or need a non-default name.

**Copying `spritesheets/` into `dist/` (build)**  
**`npm run build`** copies the large **`spritesheets/`** tree into **`dist/`** as part of the Vite build (see `vite.config.js`). Which tool runs depends on the OS:

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

**Browsers**

- **`npm test`** (browser suite via [Testem](https://github.com/testem/testem) + [Vite](https://vitejs.dev/)) uses **Chrome** and **Firefox** as configured in [`testem.cjs`](testem.cjs). CI installs them with **`browser-actions/setup-chrome`** and **`browser-actions/setup-firefox`** (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

- **`npm run test:visual`** uses Playwright. After `npm ci`, install the browser binaries at least once (or after upgrading `@playwright/test`):

```bash
npx playwright install --with-deps chromium firefox webkit
```

For visual tests only, **`npx playwright install chromium`** is enough. The Argos / visual workflow installs browsers as needed; elsewhere run **`npx playwright install chromium`** (or the full set) and add any system libraries Playwright’s installer or error output asks for if a browser fails to launch.

#### File Generation

**Generated metadata modules (`dist/`, gitignored)** — The Vite metadata plugin (see [`vite/vite-plugin-item-metadata.js`](vite/vite-plugin-item-metadata.js)) runs **`generateSources`** on dev/build and writes **five** ES modules under **`dist/`** from the sheet JSON under **`sheet_definitions/`** and **`palette_definitions/`**. It hashes both trees; if the hash matches a gitignored [`.cache/`](.cache/) copy from the last run and **`dist/index-metadata.js` already exists**, it **skips** all generation. Otherwise it also regenerates **[CREDITS.csv](CREDITS.csv)** and **[scripts/zPositioning/z_positions.csv](scripts/zPositioning/z_positions.csv)** in line with `npm run validate-site-sources`. Set **`VITE_REGENERATE_SOURCES=1`** to always run the full pipeline. Do not edit the generated `dist` files by hand.

| File                      | Main exports (named)                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| **`index-metadata.js`**   | `aliasMetadata`, `categoryTree`, `metadataIndexes` (path/hash indexes: `byTypeName`, `hashMatch`, etc.) |
| **`palette-metadata.js`** | `paletteMetadata`                                                                                       |
| **`item-metadata.js`**    | `itemMetadata` — per-item **lite** records (no `layers`, no `credits`)                                  |
| **`credits-metadata.js`** | `itemCredits` — map `itemId → credits[]`                                                                |
| **`layers-metadata.js`**  | `itemLayers` — map `itemId → layer objects`                                                             |

The app loads them with **parallel `import()`** and registers each chunk in **[`sources/state/catalog.ts`](sources/state/catalog.ts)** (entry: [`sources/install-item-metadata.js`](sources/install-item-metadata.js)). Production code should use the **catalog getters** (`getCategoryTree`, `getItemLite`, `getItemLayers`, `getItemCredits`, `getPaletteMetadata`, `getMetadataIndexes`, …), not ad hoc globals.

**Staged loading** — The catalog exposes **`isIndexReady`**, **`isLiteReady`**, **`isCreditsReady`**, **`isPaletteReady`**, and **`isLayersReady`** as synchronous predicates. The export **`catalogReady`** provides **`onIndexReady`**, **`onLiteReady`**, …, and **`onAllReady`** (each a **`Promise<void>`** that resolves once). The UI and bootstrap can treat **index** (tree skeleton), **lite** (item rows, hash), **credits** (license text), **palette**, and **layers** (canvas, sprite paths) as separate readiness stages. Browser tests await **`catalogReady.onAllReady`** in [`tests/vitest-setup.js`](tests/vitest-setup.js) after the metadata imports.

**Dev vs production JSON in generated files ([PR #432](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/pull/432))** — Payloads are embedded with `JSON.stringify(..., null, indent)`: **pretty-printed** when Vite runs in development (**`npm run dev`**) and **compact** when you run a production build (**`npm run build`**). The same rule applies to **all five** metadata modules, not only `item-metadata.js`. Inspect any of the files under **`dist/`** after a dev run to read structured JSON; CI and release builds use the compact form.

**Credits, z-positions, and when `dist/` is written** — To refresh **[CREDITS.csv](/CREDITS.csv)** and **[scripts/zPositioning/z_positions.csv](/scripts/zPositioning/z_positions.csv)** (without the `dist` modules), from the project root run:

```bash
npm run validate-site-sources
```

That uses **`concurrently`** to run **`generate_credits.js`** and **`parse_zpos.js`** (same as writing **`z_positions.csv`** from the JSON) in parallel. Alternatively, run **`node scripts/generate_credits.js`** and **`node scripts/zPositioning/parse_zpos.js`** separately. Do not run **`node scripts/generate_sources.js`** as a CLI; it only prints a pointer to **`npm run validate-site-sources`** (the file’s role is to export **`generateSources`** for Vite and tests).

Vite is responsible for the five `dist/*-metadata.js` files when the plugin runs (and may update **CREDITS** / **z_positions** in the “inputs changed or first run / missing `dist` metadata” case). The plugin passes **`env`** (`development` vs `production`) into **`generateSources`** and controls JSON indentation in metadata.

**`index.html`** is the Vite entry shell (layout, stylesheets, `sources/main.js`). It is not emitted by `generate_sources.js`. Change it only when you mean to adjust the page structure or global assets.

The **Validate site sources** workflow (`.github/workflows/validate-site-sources.yml`) runs **`npm run validate-site-sources`** and fails if the working tree is dirty afterward. PRs that touch definitions must include regenerated **`CREDITS.csv`** and **`scripts/zPositioning/z_positions.csv`** whenever those files change.

#### Running Tests

Browser specs run in real browsers via [Testem](https://github.com/testem/testem). Vite is embedded in middleware mode via [`vite-plugin-testem`](https://www.npmjs.com/package/vite-plugin-testem) (see [`testem.cjs`](testem.cjs)) so specs can `import` ESM from `sources/`. **`testem.cjs`** runs **Node** checks first (`before_tests`), then loads **[`tests_run.html`](tests_run.html)** with Mocha and [`tests/tests.js`](tests/tests.js).

**Run the full suite**

From the project root:

```bash
npm test
```

This runs **`node ./node_modules/testem/testem.js ci`**, which loads **[`testem.cjs`](testem.cjs)** (via Testem’s default config search), executes **`before_tests`** (`node ./tests/node/run-node-tests.js`) then the browser suite (**Chrome** and **Firefox** in CI).

**Testem client URL vs config:** [`tests_run.html`](tests_run.html) loads **`<script src="/testem.js">`**. That path is the **Testem in-browser client** served by the Testem server from the **`testem`** npm package; it is **not** the repo’s config file. Local Testem settings live in **[`testem.cjs`](testem.cjs)** at the repository root.

**`DEBUG` environment variable (optional):** When `DEBUG` is `1` or `true`, the Vite middleware used by Testem defines `import.meta.env.VITEST_DEBUG === "true"`, and [`tests/vitest-setup.js`](tests/vitest-setup.js) turns on test-friendly verbose behavior aligned with `sources/utils/debug.js`.

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

**CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) installs **Chrome** and **Firefox**, starts **Xvfb**, and runs **`npm test`** on pushes and pull requests to **`master`**. That workflow uses `npm ci --ignore-scripts`; for local development, `npm ci` or `npm install` without `--ignore-scripts` is typical.

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

   [`tests/visual/home-helpers.js`](tests/visual/home-helpers.js) waits for the preview canvas, for `.loading` to disappear on the preview panels, and for paint frames before Argos screenshots (with a best-effort **`networkidle`** wait). Without **`ARGOS_TOKEN`**, navigation and layout still run but Argos capture/upload is skipped. Override the origin with **`PLAYWRIGHT_TEST_BASE_URL`** (see [`tests/visual/home.spec.js`](tests/visual/home.spec.js)).

**Unit and component specs (Mocha + Chai)**

[`tests/tests.js`](tests/tests.js) imports every `tests/**/*_spec.js` file (except files only used from **`tests/node/`**). **`tests/node/`** is exercised by **`before_tests`** and by **`npm run test:node`** directly.

[`tests/vitest-setup.js`](tests/vitest-setup.js) loads **`sources/vendor-globals.js`**, sets test flags on **`window`**, imports [`sources/install-item-metadata.js`](sources/install-item-metadata.js) (which **dynamic-imports** the five `dist/*-metadata.js` modules on the test runner page and **registers** them with [`sources/state/catalog.ts`](sources/state/catalog.ts)), and **`await`s** **`catalogReady.onAllReady`** so the browser suite runs with the same **catalog** state as the app. Specs that need isolation use **`resetCatalogForTests`**, [`seedBrowserCatalog`](tests/browser-catalog-fixture.js), or **`restoreAppCatalogAfterTest`**.

Typical patterns:

- Import **`describe`**, **`it`**, **`beforeEach`**, **`afterEach`** (and suite-level **`before`** / **`after`** when needed) from **`"mocha-globals"`** (re-exported in [`tests/bdd-globals.js`](tests/bdd-globals.js)) and **`assert`** or **`expect`** from **`"chai"`**.
- Render with **`m.render(…)`** using the global **`m`**.
- Use **`beforeEach` / `afterEach`** to create and remove DOM containers.

Example:

```javascript
import { MyComponent } from "../sources/components/MyComponent.js";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

describe("MyComponent", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container?.remove();
  });

  it("renders correctly", () => {
    m.render(container, m(MyComponent, { prop: "value" }));
    const element = container.querySelector(".expected-class");
    assert.isNotNull(element);
    assert.strictEqual(element.textContent, "expected content");
  });
});
```

Node specs are listed and run via [`tests/node/run-node-tests.js`](tests/node/run-node-tests.js); add new generator tests alongside the existing `tests/node/scripts/**` files.

#### z-positions

In order to facilitate easier management of the z-positions of the assets in this repo, there is a [script](/scripts/zPositioning/parse_zpos.js) that traverses all JSON files and write's the layer's z-position to a CSV.

To run this script directly:

`node scripts/zPositioning/parse_zpos.js`

The same script is also available as **`npm run z-positions`**.

This [CSV file](/scripts/zPositioning/z_positions.csv) is regenerated whenever you run:

`npm run validate-site-sources`

Therefore, before creating a PR, make sure you have committed the CSV to the repo as well.

Using this CSV, one can more clearly see the overview of all the z-position used per asset's layer.

Moreover, one can adjust the z-position from within the CSV, and then run:

`node scripts/zPositioning/update_zpos.js`

(equivalently **`npm run z-positions:update`**)

In order to reflect the changes made back into the JSON files.

**Concluding, please remember that the JSON files will always contain the source of truth with regard to the z-position an asset will be rendered at. The CSV is there to give an overview of the z-positions in use, and provides a mean to easily alter them from a single file.**
