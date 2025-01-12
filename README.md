This generator attempts to include all [LPC](https://lpc.opengameart.org) created art up to now.

Try it [here](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/).


The Liberated Pixel Effort is a collaborative effort from a number of different great artists who helped produce sprites for the project.
**If you wish to use LPC sprites in your project, you will need to credit everyone who helped contribute to the LPC sprites you are using.** See below for how to do this.

### Licensing and Attribution (Credits)

Each piece of artwork distributed from this project (all images in the `spritesheets` subdirectory) is licensed under one or more of the following supported open license(s):

- [CC0](https://creativecommons.org/public-domain/cc0/)
- [CC-BY-SA](https://creativecommons.org/licenses/by-sa/4.0/deed.en)
- [CC-BY](https://creativecommons.org/licenses/by/4.0/)
- [OGA-BY](https://static.opengameart.org/OGA-BY-3.0.txt)
- [GPL](https://www.gnu.org/licenses/gpl-3.0.en.html#license-text)

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

> - Sprites by: Johannes Sjölund (wulax), Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Nila122, David Conway Jr. (JaidynReiman), Carlo Enrico Victoria (Nemisys), Thane Brimhall (pennomi), bluecarrot16, Luke Mehl, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, kheftel, Stephen Challener (Redshrike), TheraHedwig, Evert, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Johannes Sj?lund (wulax), Sander Frenken (castelonia), dalonedrau, Lanea Zimmerman (Sharm), 
> - Sprites contributed as part of the Liberated Pixel Cup project from OpenGameArt.org: http://opengameart.org/content/lpc-collection
> - License: Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0) <http://creativecommons.org/licenses/by-sa/3.0/>
> - Detailed credits: [LINK TO CREDITS.CSV FILE]

**For additional information on the licensing and attribution requirement, please refer here on [OpenGameArt.org](https://opengameart.org/content/faq#q-proprietary).**

### Contributing

**Important: all art submitted to this project must be available under one of the supported licenses, see above section `Licensing and Attribution (Credits)`.**

- If you are submitting art that was made by (or derived from work made by) someone else, please be sure that you have the rights to distribute that art under the licenses you choose.

- When adding new artwork to this project, please add valid licensing information inside the json files as well (part of the *credits* object). Note the entire list of authors for that image, a URL for each piece of art from which this image is derived, and a list of licenses under which the art is available. 

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

Finally, to get your sheet to appear, in `source_index.html`, add your new category at the desired position by adding a `div_sheet_` like this:

`div_sheet_body_robot`

Make sure the name starts with `div_sheet_`, and match the postfix with the name of your json, in this case `body_robot`.

At this point, you will need to run a script that will generate the final `index.html`.
In order to do that, run:

`node scripts/generate_sources.js` 

This will generate the `index.html` from the `source_index.html`.

In case you want to push your changes, be sure to run this script and never change the `index.html` manually.
The CI will reject any PR's that contain manual changes made on the `index.html`.

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

### Run

To run this project, just clone the repo and open `index.html` in your browser of choice.

### Examples
![example](/readme-images/example.png)
