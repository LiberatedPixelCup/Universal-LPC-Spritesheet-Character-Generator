This generator attempts to include all [LPC](https://lpc.opengameart.org) created art up to now.

Try it [here](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/).


The Liberated Pixel Effort is a collaborative effort from a number of different great artists who helped produce sprites for the project.
**If you wish to use LPC sprites in your project, you will need to credit everyone who helped contribute to the LPC sprites you are using.** See below for how to do this.

### Licensing and Attribution (Credits)

All art distributed with this project (all images in the `spritesheets` subdirectory) is licensed under the [GNU GPL 3.0](http://www.gnu.org/licenses/gpl-3.0.html) ([text](gpl-3_0.txt)) and/or [Creative Commons Attribution-ShareAlike 3.0](http://creativecommons.org/licenses/by-sa/3.0/) ([text](cc-by-sa-3_0.txt)) license(s). Some art may be available under other licenses too.

The file `CREDITS.csv` lists the authors, license(s), and links to the original URL(s), for each image in `spritesheets`. **If you generate a sprite using this tool, you must credit all the authors**. You can do this one of two ways:

- Distribute the entire `CREDITS.csv` file along with your project.
- Based on the layers you use the generator outputs the used spritesheets and their credits to a textfield. You are also enabled here to download this text as csv or txt straight to your machiness.

Either way, make sure this credits file is accessible from within your game or app and can be reasonably discovered by users (for instance, show the information on the "Credits" screen directly, or provide a visible link). If you don't want to *show* the entire credits file directly, should include a statement like this on your credits screen:

> Sprites by: Johannes Sjölund (wulax), Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Nila122, David Conway Jr. (JaidynReiman), Carlo Enrico Victoria (Nemisys), Thane Brimhall (pennomi), bluecarrot16, Luke Mehl, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, kheftel, Stephen Challener (Redshrike), TheraHedwig, Evert, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Johannes Sj?lund (wulax), Sander Frenken (castelonia), dalonedrau, Lanea Zimmerman (Sharm), laetissima, kirts, Mark Weyer, Joe White, Mandi Paugh, William.Thompsonj, Manuel Riecke (MrBeast), Barbara Riviera, thecilekli, Yamilian, Fabzy, Skorpio, Radomir Dopieralski, Emilio J. Sanchez-Sierra, kcilds/Rocetti/Eredah, Cobra Hubbard (BlueVortexGames), DCSS authors, Marcel van de Steeg (MadMarcel), DarkwallLKE, Charles Sanchez (CharlesGabriel), Shaun Williams, Tuomo Untinen (reemax), Stafford McIntyre, PlatForge project, Tracy, Daniel Eddeland (daneeklu), William.Thomsponj, Joshua Taylor, Zi Ye, AntumDeluge, drjamgo@hotmail.com, Lori Angela Nagel (jastiv), gr3yh47, pswerlang, XOR, tskaufma, Inboxninja, Dr. Jamgo, LordNeo
> Sprites contributed as part of the Liberated Pixel Cup project from OpenGameArt.org: http://opengameart.org/content/lpc-collection
> License: Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0) <http://creativecommons.org/licenses/by-sa/3.0/>
> Detailed credits: [LINK TO CREDITS.CSV FILE]

### Contributing

**Important: all art submitted to this project must be available under the [Creative Commons Attribution-ShareAlike 3.0](http://creativecommons.org/licenses/by-sa/3.0/) and/or the [GNU GPL 3.0](http://www.gnu.org/licenses/gpl-3.0.html) licenses**.
- **By contributing original work to this project, you agree to license any orginal contributions made by you under _both_ of these licenses.**

- If you are submitting art that was made by (or derived from work made by) someone else, please be sure that you have the rights to distribute that art under one of the two licenses.

To add sheets to an existing category, add the sheets to the correct folder(s) in `spritesheets/`.
In addition, locate the correct `sheet_definition` in `sheet_definitions/`, and add the name of your added sheet to the `variants` array.

To add a new category, add the sheets to the correct folder(s) in `spritesheets/`.
In addition, create a json file in `sheet_definitions/`, and define the required properties.
For example, you have created at this point:

`body_robot.json`

A category can exist of n-layers. For each layer, define the z-position the sheet needs to be drawn at.
For an example of a multi-layered definition, refer here [here](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/sheet_definitions/tail_lizard.json).

You can optionally also specify the available animations the asset supports. You do not have to feel obligated to fill out all animations, and some assets may not work well on all animations anyway. In the sheet definition, you can add the "animations" array below "variants". Again, refer here [here](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/sheet_definitions/tail_lizard.json):
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

When adding files to the project, please add valid licensing information inside the json files as well. Note the entire list of authors for that image, a URL for each piece of art from which this image is derived, and a list of licenses under which the art is available. If you don't add license information for your newly added files, the generation of the site sources will fail.

At this point, you will need to run a script that will generate the final `index.html`.
In order to do that, run `node scripts/generate_sources.js` from the root folder.
This will generate the `index.html` from the `source_index.html`.

In case you want to push your changes, be sure to run this script and never change the `index.html` manually.
The CI will reject any PR's that contain manual changes made on the `index.html`.

### Run

To run this project, just clone the repo and open `index.html` in your browser of choice.

### z-positions

TBD

### Examples
![example](https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/example.png)