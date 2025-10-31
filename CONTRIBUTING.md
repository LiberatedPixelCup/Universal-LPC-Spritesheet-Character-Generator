### Contributing

#### Submissions

**Important: all art submitted to this project must be available under one of the supported licenses, see above section `Licensing and Attribution (Credits)`.**

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

#### File Generation

Finally, to get your sheet to appear, in `source_index.html`, add your new category at the desired position by adding a `div_sheet_` like this:

`div_sheet_body_robot`

Make sure the name starts with `div_sheet_`, and match the postfix with the name of your json, in this case `body_robot`.

At this point, you will need to run a script that will generate the final `index.html`.
In order to do that, run:

`node scripts/generate_sources.js` 

This will generate the `index.html` from the `source_index.html`.

In case you want to push your changes, be sure to run this script and never change the `index.html` manually.
The CI will reject any PR's that contain manual changes made on the `index.html`.

#### Running Tests

The project includes automated tests for the Mithril components that run directly in the browser.

**Running Tests Locally**:

1. Start a local HTTP server in the project root:
   ```bash
   python -m http.server 8080
   # or use any other HTTP server
   ```

2. Open the test runner in your browser:
   ```
   http://localhost:8080/tests_run.html
   ```

The tests will display with visual pass/fail indicators, error details, and a summary.

**CI Integration**: Tests run automatically in GitHub Actions on every push and pull request using Chrome headless. All tests must pass before a PR can be merged.

**Test Framework**: The project uses [ospec](https://github.com/MithrilJS/mithril.js/tree/master/ospec) (Mithril's official test framework) running directly in the browser with real DOM.

**Test Autodiscovery**: Test files are automatically discovered - just drop any `*.test.js` file in the `tests/` directory and it will be found and executed automatically. No configuration needed!

**Adding New Tests**: When adding new Mithril components, please add corresponding test files in the `tests/` directory. Test files should:
- Be named `ComponentName.test.js`
- Use `window.o` and `window.m` (globally available in the test runner)
- Use `o.spec()` to group related tests
- Create and cleanup DOM containers in `beforeEach`/`afterEach`
- Use `m.render()` to render components to the real DOM
- Use native DOM queries (`querySelector`, etc.) for assertions

Example test structure:
```javascript
import { MyComponent } from "../sources/components/MyComponent.js";

const o = window.o;
const m = window.m;

o.spec("MyComponent", function() {
  let container;

  o.beforeEach(function() {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  o.afterEach(function() {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  o("renders correctly", function() {
    m.render(container, m(MyComponent, { prop: "value" }));
    const element = container.querySelector(".expected-class");
    o(element).notEquals(null);
    o(element.textContent).equals("expected content");
  });
});
```

#### z-positions

In order to facilitate easier management of the z-positions of the assets in this repo, there is a [script](/scripts/zPositioning/parse_zpos.js) that traverses all JSON files and write's the layer's z-position to a CSV.

To run this script, use:

`node scripts/zPositioning/parse_zpos.js`

This [CSV file](/scripts/zPositioning/z_positions.csv) will be regenerated each time one invokes:

`node scripts/generate_sources.js`

Therefore, before creating a PR, make sure you have committed the CSV to the repo as well.

Using this CSV, one can more clearly see the overview of all the z-position used per asset's layer.

Moreover, one can adjust the z-position from within the CSV, and then run:

`node scripts/zPositioning/update_zpos.js`

In order to reflect the changes made back into the JSON files.

**Concluding, please remember that the JSON files will always contain the source of truth with regard to the z-position an asset will be rendered at. The CSV is there to give an overview of the z-positions in use, and provides a mean to easily alter them from a single file.**
