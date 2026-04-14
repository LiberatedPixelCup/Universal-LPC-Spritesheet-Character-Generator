### Contributing

#### Submissions

**Important: all art submitted to this project must be available under one of the supported licenses; see the `Licensing and Attribution (Credits)` section in [README.md](README.md).**

- If you are submitting art that was made by (or derived from work made by) someone else, please be sure that you have the rights to distribute that art under the licenses you choose.

- When adding new artwork to this project, please add valid licensing information inside the json files as well (part of the *credits* object). Note the entire list of authors for that image, a URL for each piece of art from which this image is derived, and a list of licenses under which the art is available.

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

The category tree and items in the app come from generated metadata, not from HTML. After you add or change definitions, run **File Generation** (below) and commit the updated **`item-metadata.js`** and any other generated outputs that changed.

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


#### File Generation

The runtime UI loads **`item-metadata.js`**, which is **generated** from the sheet JSON under `sheet_definitions/` (and related inputs). When you add or change artwork definitions, credits, or tree metadata, regenerate the outputs and commit them.

From the project root:

```bash
node scripts/generate_sources.mjs
```

or:

```bash
npm run validate-site-sources
```

This updates **[CREDITS.csv](/CREDITS.csv)** and **[item-metadata.js](/item-metadata.js)**, and it runs **`scripts/zPositioning/parse_zpos.js`** in the background so **[scripts/zPositioning/z_positions.csv](/scripts/zPositioning/z_positions.csv)** stays aligned with z-positions in the JSON files.

**Do not edit `item-metadata.js` by hand.** Edit the sheet definitions (and related sources) and re-run the generator.

**`index.html`** is the Vite entry shell (layout, stylesheets, `sources/main.js`). It is not emitted by this script. Change it only when you mean to adjust the page structure or global assets.

The **Validate site sources** workflow (`.github/workflows/validate-site-sources.yml`) runs the same generation and fails if the working tree is dirty afterward. PRs that touch definitions must include regenerated **`item-metadata.js`**, **`CREDITS.csv`**, and **`scripts/zPositioning/z_positions.csv`** whenever those files change.

#### Running Tests

Browser specs use [Vitest](https://vitest.dev/) in **browser** mode with the [Playwright](https://playwright.dev/) provider (see [`vitest.config.js`](vitest.config.js)). **Chromium, Firefox, and WebKit** each run the suite headlessly by default. Node-based tests under [`tests/node/`](tests/node/) cover the `generate_sources` pipeline and related scripts.

**Run the full suite**

From the project root:

```bash
npm test
```

This runs **`npm run test:node`** then **`npm run test:vitest`**.

**`DEBUG` environment variable (optional):** When `DEBUG` is `1` or `true`, Vitest exposes `import.meta.env.VITEST_DEBUG === "true"` (see `vitest.config.js`), and [`tests/vitest-setup.js`](tests/vitest-setup.js) turns on test-friendly verbose behavior aligned with `sources/utils/debug.js`.

```bash
DEBUG=1 npm test
# or
DEBUG=true npm test
```

**Interactive browser UI**

```bash
npm run test:server
```

This runs **`vitest --browser --ui`** so you can drive tests from Vitest’s UI.

**CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) installs Playwright browsers (**Chromium, Firefox, WebKit**), starts **Xvfb**, and runs **`npm test`** on pushes and pull requests to **`master`**. That workflow uses `npm ci --ignore-scripts`; for local development, `npm ci` or `npm install` without `--ignore-scripts` is typical.

#### Visual regression tests (Playwright + Argos)

Full-page screenshots live under [`tests/visual/`](tests/visual/) and use [`playwright.config.js`](playwright.config.js) (separate from Vitest’s browser config). [Argos](https://argos-ci.com/) uploads run only when **`ARGOS_TOKEN`** is set (a repository secret in CI).

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

**Unit and component specs (Vitest + Chai)**

Vitest picks up **`tests/**/*_spec.js`**, excluding **`tests/visual/**`** and **`tests/node/**`**.

[`tests/vitest-setup.js`](tests/vitest-setup.js) assigns **`globalThis.m`** (Mithril), sets test flags on `window`, and exposes exports from **`item-metadata.js`** on **`window`** so tests see the same catalog data as the app.

Typical patterns:

- Import **`describe`**, **`it`**, **`beforeEach`**, **`afterEach`** from **`"vitest"`** and **`assert`** or **`expect`** from **`"chai"`** (Vitest’s **`expect`** is fine too if you prefer it).
- Render with **`m.render(…)`** using the global **`m`**.
- Use **`beforeEach` / `afterEach`** to create and remove DOM containers.

Example:

```javascript
import { MyComponent } from "../sources/components/MyComponent.js";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "vitest";

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

`node scripts/generate_sources.mjs`

Therefore, before creating a PR, make sure you have committed the CSV to the repo as well.

Using this CSV, one can more clearly see the overview of all the z-position used per asset's layer.

Moreover, one can adjust the z-position from within the CSV, and then run:

`node scripts/zPositioning/update_zpos.js`

(equivalently **`npm run z-positions:update`**)

In order to reflect the changes made back into the JSON files.

**Concluding, please remember that the JSON files will always contain the source of truth with regard to the z-position an asset will be rendered at. The CSV is there to give an overview of the z-positions in use, and provides a mean to easily alter them from a single file.**
