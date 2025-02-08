 LPC Spritesheet Character Generator
 =============================================

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

> - Sprites by: Johannes Sjölund (wulax), Michael Whitlock (bigbeargames), Matthew Krohn (makrohn), Nila122, David Conway Jr. (JaidynReiman), Carlo Enrico Victoria (Nemisys), Thane Brimhall (pennomi), bluecarrot16, Luke Mehl, Benjamin K. Smith (BenCreating), ElizaWy, MuffinElZangano, Durrani, kheftel, Stephen Challener (Redshrike), TheraHedwig, Evert, Pierre Vigier (pvigier), Eliza Wyatt (ElizaWy), Johannes Sj?lund (wulax), Sander Frenken (castelonia), dalonedrau, Lanea Zimmerman (Sharm), 
> - Sprites contributed as part of the Liberated Pixel Cup project from OpenGameArt.org: http://opengameart.org/content/lpc-collection
> - License: Creative Commons Attribution-ShareAlike 3.0 (CC-BY-SA 3.0) <http://creativecommons.org/licenses/by-sa/3.0/>
> - Detailed credits: [LINK TO CREDITS.CSV FILE]

**For additional information on the licensing and attribution requirement, please refer here on [OpenGameArt.org](https://opengameart.org/content/faq#q-proprietary).**

### [Contributing](CONTRIBUTING.md) ⤴

### Animation Frame Guide

You can look at [the Animation Guide in Eliza's repository](https://github.com/ElizaWy/LPC/blob/f07f7f5892e67c932c68f70bb04472f2c64e46bc/Characters/_%20Guides%20%26%20Palettes/Animation%20Guides) for a detailed suggested guide to how she recommends you display your animations.

Also, each animation has a frame cycle documented which you can see next to the animation preview.

### Run

#### Web Interface

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

#### Python Image Processor

The project includes a Python module for programmatically generating sprite sheets. This is useful for batch processing or automation workflows.

##### Setup

1. Requirements:
   ```bash
   pip install pillow
   ```

2. Create a configuration file `config.json`:
   ```json
   {
     "sheet_definitions_path": "sheet_definitions",
     "output_dir": "tmp",
     "sprites": [
       {
         "definition_name": "arms_armour",
         "variant": "steel",
         "sex": "male",
         "output_name": "steel_male_armour.png"
       },
       {
         "definition_name": "arms_armour",
         "variant": "gold",
         "sex": "female",
         "output_name": "gold_female_armour.png",
         "template_params": {
           "style": "fancy"
         }
       }
     ],
     "batch_jobs": [
       {
         "definition_name": "arms_armour",
         "variants": ["steel", "gold", "silver"],
         "sexes": ["male", "female"],
         "template_params": {
           "style": "default"
         }
       }
     ]
   }
   ```

3. Run the processor:
   ```bash
   python scripts/example.py config.json
   ```

##### Configuration Options

The `config.json` file supports the following options:

1. Global Settings:
   - `sheet_definitions_path` (optional): Path to JSON definition files (default: "sheet_definitions")
   - `output_dir` (optional): Directory for output files (default: "output")

2. Individual Sprites (`sprites` array):
   - `definition_name` (required): JSON file name without extension (e.g., "arms_armour")
   - `variant` (required): One of the variants defined in the JSON file
   - `sex` (required): One of: male, female, teen, child, muscular, pregnant
   - `output_name` (required): Output file name (e.g., "my_sprite.png")
   - `template_params` (optional): Parameters for template substitution

3. Batch Jobs (`batch_jobs` array):
   - `definition_name` (required): JSON file name without extension
   - `variants` (optional): List of variants to process (default: all variants)
   - `sexes` (optional): List of sexes to process (default: all supported sexes)
   - `template_params` (optional): Parameters for template substitution

##### Example Configurations

1. Basic Single Sprite:
   ```json
   {
     "output_dir": "tmp",
     "sprites": [
       {
         "definition_name": "arms_armour",
         "variant": "steel",
         "sex": "male",
         "output_name": "steel_male_armour.png"
       }
     ]
   }
   ```

2. Multiple Sprites with Templates:
   ```json
   {
     "output_dir": "tmp/armour",
     "sprites": [
       {
         "definition_name": "arms_armour",
         "variant": "gold",
         "sex": "female",
         "output_name": "fancy_gold_armour.png",
         "template_params": {
           "style": "fancy",
           "trim": "gold"
         }
       }
     ]
   }
   ```

3. Batch Processing:
   ```json
   {
     "output_dir": "tmp/batch",
     "batch_jobs": [
       {
         "definition_name": "arms_armour",
         "variants": ["steel", "gold"],
         "sexes": ["male", "female"]
       }
     ]
   }
   ```

##### Directory Structure

The processor expects sprite images to be organized in the following structure under the `spritesheets` directory. Each sprite must include the following animation types:

- spellcast
- thrust
- walk
- slash
- shoot
- hurt

Directory structure example:
```
spritesheets/
  └── category/
      └── type/
          └── style/
              └── sex/
                  ├── spellcast/
                  │   └── variant.png
                  ├── thrust/
                  │   └── variant.png
                  ├── walk/
                  │   └── variant.png
                  ├── slash/
                  │   └── variant.png
                  ├── shoot/
                  │   └── variant.png
                  └── hurt/
                      └── variant.png
```

For example:
```
spritesheets/
  └── arms/
      └── armour/
          └── plate/
              ├── male/
              │   ├── hurt/
              │   │   ├── steel.png
              │   │   └── gold.png
              │   └── walk/
              │       ├── steel.png
              │       └── gold.png
              └── female/
                  ├── hurt/
                  │   ├── steel.png
                  │   └── gold.png
                  └── walk/
                      ├── steel.png
                      └── gold.png
```

##### Output Structure

The processor will:
1. Create the output directory if it doesn't exist
2. Generate individual sprites as specified in `sprites`
3. Process any batch jobs, creating files named `{definition_name}_{variant}_{sex}.png`
4. Combine all animations (hurt, shoot, slash, etc.) horizontally in the output image
5. Maintain the original transparency and layer order from the source images

Each output image will contain all animation frames laid out horizontally in the order specified by the definition's `animations` list (or using the default animation order if not specified).

##### Error Handling

The processor provides error messages for common issues:
- Missing or invalid configuration file
- Invalid sprite definition names
- Unsupported variants or sex types
- Missing template parameters
- File system access errors

For debugging, use the error messages to identify which sprite or batch job failed and why.

### FAQ

<dl>
  <dt>May I use this art in my commercial game?</dt>
  <dd>Yes, however you must follow all the terms of the license(s) for the art you are using. See [Licensing and Attribution (Credits)](#licensing-and-attribution-credits)</dd>
  <dt>How do I use the output of this generator in &lt;insert game engine&gt;?</dt>
  <dd>There may be resources available to do this already. We are working on providing a list in the future for a few common game engines. For now, try Google. In most cases, however, you will likely have to write some code.</dd>
  <dt>I downloaded the image, but I forgot to get the &lt;url, credits, etc.&gt; How do I get back to where I was?</dt>
  <dd>It is recommended that you "export to JSON" to avoid this problem in the future and save the json file with the png image file. See [issue #143](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/issues/143)</dd>
</dl>

### Terms

<dl>
  <dt>Liberated Pixel Cup (LPC)</dt>
  <dd>Originally a competition designed to create a large body of compatible art assets. Now also refers to that body of work and the style art marked as LPC attempts to follow.</dd>
  <dt>Universal LPC (ULPC)</dt>
  <dd>LPC originally expanded to add some new animation sizes and bases. This generator helped ensure that many assets covered all those bases and animations. LPC originally included only spellcast, slash, thrust, walk, shoot, and hurt animations for male and female adult bases. It also stuck to a standard 64x64 format. The most notable change in ULPC was to add weapons with oversize animation frames.</dd>
  <dt>LPC Revised (LPCR)</dt>
  <dd>LPC changes proposed by [@ElizaWy](https://github.com/ElizaWy) that in some cases changed the number and order of animation frames, a new color palette, and the smaller heads.</dd>
  <dt>LPC Expanded (LPCE)</dt>
  <dd>Additional expansion of animations and bases proposed by [@ElizaWy](https://github.com/ElizaWy) and others. New animations included bow, climb, run, and jump. New bases included child and elderly. Many of the assets in this repository are not yet drawn for these new animations and bases. Help wanted.</dd>
</dl>

### Alternative LPC Character generators

- https://pflat.itch.io/lpc-character-generator
- https://vitruvianstudio.github.io/

### Tools

- [lpctools](https://github.com/bluecarrot16/lpctools)

### Python Image Processor

A Python module is available to programmatically layer sprite images based on JSON configuration files. The module is located in `scripts/image_processor.py`.

#### Requirements

- Python 3.x
- Pillow (PIL) library: `pip install pillow`

#### Basic Usage

The Python image processor can be configured using a JSON configuration file. Here's an example:

1. Create a configuration file `config.json`:
```json
{
  "sheet_definitions_path": "sheet_definitions",
  "output_dir": "tmp",
  "sprites": [
    {
      "definition_name": "arms_armour",
      "variant": "steel",
      "sex": "male",
      "output_name": "arms_armour_steel_male.png",
      "template_params": {
        "color": "steel",
        "style": "default"
      }
    }
  ],
  "batch_jobs": [
    {
      "definition_name": "arms_armour",
      "variants": ["steel", "gold"],
      "sexes": ["male", "female"],
      "template_params": {
        "style": "fancy"
      }
    }
  ]
}
```

2. Run the processor:
```bash
python scripts/example.py config.json
```

The configuration file supports:
- `sheet_definitions_path`: Path to JSON definition files (optional, default: "sheet_definitions")
- `output_dir`: Directory for output files (optional, default: "output")
- `sprites`: List of individual sprites to generate
- `batch_jobs`: List of batch jobs to process multiple variants/sexes at once

Each sprite in `sprites` requires:
- `definition_name`: JSON file name without extension
- `variant`: One of the variants from the JSON
- `sex`: One of: male, female, teen, child, muscular, pregnant
- `output_name`: Output file name
- `template_params`: Optional template parameters

Each job in `batch_jobs` requires:
- `definition_name`: JSON file name without extension
- `variants`: Optional list of variants to process
- `sexes`: Optional list of sexes to process
- `template_params`: Optional template parameters

#### Features

- **Layer Support**: Handles up to 9 layers per sprite (layer_1 through layer_9)
- **Template Substitution**: Supports dynamic path templates from JSON definitions
- **Path Replacements**: Handles path replacements specified in JSON definitions
- **Multiple Sex Types**: Supports all base types (male, female, teen, child, muscular, pregnant)
- **Batch Processing**: Can process multiple variants and sex types in one call
- **Error Handling**: Gracefully handles missing images and invalid configurations
- **Transparent Backgrounds**: Uses RGBA mode for proper transparency

#### Advanced Usage

1. **Template Parameters**:
```python
# For JSON definitions that use templates
layerer.layer_images(
    definition_name="my_template_def",
    variant="basic",
    sex="male",
    output_path="output/result.png",
    template_params={
        "color": "red",
        "style": "fancy"
    }
)
```

2. **Custom Sheet Definitions Path**:
```python
# If your JSON definitions are in a different directory
layerer = SpriteLayerer(sheet_definitions_path="my/custom/path")
```

3. **Selective Batch Processing**:
```python
# Process specific combinations
layerer.batch_process(
    definition_name="arms_armour",
    output_dir="output",
    variants=["steel", "gold"],
    sexes=["male"],
    template_params={"style": "fancy"}
)
```

#### Error Handling

The module includes error handling for common issues:
- Invalid sex type for the definition
- Invalid variant name
- Missing image files
- Invalid JSON structure
- Missing required fields

Errors are reported with descriptive messages to help identify and fix issues.

### Examples
![example](/readme-images/example.png)
