const fs = require("fs");
const readline = require("readline");
const { PALETTE_MATERIALS } = require("../sources/state/palettes.js");

const DEBUG = false; // change this to print debug log
const onlyIfTemplate = false; // print debugging log only if there is a template
const onlyIfReplace = true; // print debugging log only if there is replace key

require("child_process").fork("scripts/zPositioning/parse_zpos.js");

// copied from https://github.com/mikemaccana/dynamic-template/blob/046fee36aecc1f48cf3dc454d9d36bb0e96e0784/index.js
const es6DynamicTemplate = (templateString, templateVariables) =>
  templateString.replace(/\${(.*?)}/g, (_, g) => templateVariables[g]);

const templateHTML = fs.readFileSync("scripts/template-general.html", "utf8");

const licensesFound = [];
const paletteMetadata = {};
const itemMetadata = {}; // Collect metadata for runtime use
function searchCredit(fileName, credits, origFileName) {
  if (credits.count <= 0) {
    console.error("no credits for filename:", fileName);
    return undefined;
  }
  if (credits.count === 1) {
    if (!credits[0].file.includes(fileName)) {
      console.error("Wrong credit at filename:", fileName);
    }
    return undefined;
  }

  for (let creditsIndex = 0; creditsIndex < credits.length; creditsIndex++) {
    const credit = credits[creditsIndex];
    if (
      credit.file === fileName ||
      credit.file === fileName + ".png" ||
      credit.file + "/" === fileName
    ) {
      return credit;
    }
  }

  const index = fileName.lastIndexOf("/");
  if (index > -1) {
    return searchCredit(fileName.substring(0, index), credits, origFileName);
  } else {
    console.error(
      "missing credit after searching recursively filename:",
      origFileName
    );
    return undefined;
  }
}

function parseJson(json) {
  const templateIndex = json.lastIndexOf("%");
  let searchFileName = json;
  let queryObj = null;
  if (templateIndex > -1) {
    searchFileName = searchFileName.substring(0, templateIndex);
    const query = json.substring(templateIndex + 1);
    queryObj = Object.fromEntries(new URLSearchParams(query));
    const replObj = Object.fromEntries(
      Object.keys(queryObj).map(key => [key, ""])
    );
    searchFileName = es6DynamicTemplate(searchFileName, replObj).replace(
      /_+/,
      "_"
    );
  }
  const filePath = `sheet_definitions/${searchFileName}.json`;
  if (DEBUG && (!onlyIfTemplate || queryObj))
    console.log(`Parsing ${filePath}`);
  let definition = null;
  try {
    definition = JSON.parse(fs.readFileSync(filePath));
  } catch (e) {
    console.error("error in", filePath);
    throw e;
  }
  const {
    variants,
    name,
    credits,
    template,
    replace_in_path,
    path
  } = definition;
  const { tags = [], required_tags = [], excluded_tags = [] } = definition;
  const typeName = definition.type_name;
  const defaultAnimations = [
    "spellcast",
    "thrust",
    "walk",
    "slash",
    "shoot",
    "hurt",
    "watering"
  ];

  const requiredSexes = [];
  const animations = definition.animations ?? defaultAnimations;

  const previewRow = definition.preview_row ?? 2;
  const previewColumn = definition.preview_column ?? 0;
  const previewXOffset = definition.preview_x_offset ?? 0;
  const previewYOffset = definition.preview_y_offset ?? 0;

  const sexes = ["male", "female", "teen", "child", "muscular", "pregnant"];
  for (const sex of sexes) {
    if (definition.layer_1[sex]) {
      requiredSexes.push(sex);
    }
  }

  const requiredSex = requiredSexes.join(",");
  const supportedAnimations = animations.join(",");

  // Build unique itemId from filename (not from path or type_name)
  // This ensures each item has a unique ID even if they share the same type_name
  let itemId = searchFileName;
  // Append query parameters if present
  if (queryObj) {
    const vals = Object.values(queryObj)
      .map(val => val.replaceAll(" ", "_"))
      .join("_");
    itemId = `${itemId}_${vals}`;
  }

  // Collect layer information (file paths and zPos)
  const layers = {};
  for (let i = 1; i < 10; i++) {
    const layerDef = definition[`layer_${i}`];
    if (layerDef) {
      layers[`layer_${i}`] = layerDef;
    } else {
      break;
    }
  }

  // Collect recolor information
  const recolors = [];
  if (definition.recolors !== undefined) {
    for (let n = 1; n < 10; n++) {
      const colorDef = definition.recolors[`color_${n}`];
      if (colorDef) {
        recolors.push(colorDef);
      } else {
        break;
      }
    }

    // If no multiple recolors, add single recolor definition
    if (recolors.length === 0) {
      recolors.push(definition.recolors);
    }

    // Add All Palettes
    for (const recolor of recolors) {
      // Get Alt Type if Exists
      const variants = {};
      if (!recolor.base) {
        const material = PALETTE_MATERIALS[recolor.material];
        recolor.base = `${material.default}.${material.base}`;
      }
      for (const palette of recolor.palettes) {
        let [material, version] = palette.split(".");
        if (!version) {
            version = material;
            material = recolor.material;
        }

        // Append Palettes
        variants[`${material}.${version}`] = Object.keys(paletteMetadata[material][version]);
      }
      delete recolor.palettes;
      recolor.variants = variants;
    }
  }


  // Collect metadata for this item
  itemMetadata[itemId] = {
    name: name,
    type_name: typeName,
    required: requiredSexes,
    animations: animations,
    tags: tags,
    required_tags: required_tags,
    excluded_tags: excluded_tags,
    path: path || ["other"],
    replace_in_path: replace_in_path || {},
    variants: variants || [],
    layers: layers,
    credits: credits || [],
    preview_row: previewRow,
    preview_column: previewColumn,
    preview_x_offset: previewXOffset,
    preview_y_offset: previewYOffset,
    matchBodyColor: definition.match_body_color || false,
    recolors: recolors || []
  };

  let startHTML = `<li id="[ID_FOR]" class="variant-list" data-required="[REQUIRED_SEX]" data-animations="[SUPPORTED_ANIMATIONS]" [DATA_FILE]><span class="condensed">${name}</span><ul>`
    .replace("[ID_FOR]", itemId)
    .replace("[REQUIRED_SEX]", requiredSex)
    .replace("[SUPPORTED_ANIMATIONS]", supportedAnimations);

  const endHTML = "</ul></li>";

  let canUseListCredits = true;
  let listCreditToUse = null;
  let listDataFiles = "";

  // Use type_name for radio button grouping (ensures only one item per type can be selected)
  const radioGroupName = typeName.replace(/\//g, "_");
  const id = `${itemId}-none`.replace(/\//g, "_");
  let listItemsHTML = `<li class="excluded-hide"><input type="radio" id="${id}" name="${radioGroupName}" class="none"> <label for="${id}">No ${name}</label></li><li class="excluded-text"></li>`;
  let listItemsCSV = "";
  const addedCreditsFor = [];
  for (const variant of variants) {
    const snakeItemName = variant.replaceAll(" ", "_");
    const itemIdFor = `${itemId}_${snakeItemName}`;
    let matchBodyColor = false;
    if (definition[`match_body_color`] !== undefined) {
      matchBodyColor = true;
    }
    let dataFiles = "";
    for (const sex of requiredSexes) {
      // TODO: move any non-layer, non-variant specific code here!
      for (let jdx = 1; jdx < 10; jdx++) {
        const layerDefinition = definition[`layer_${jdx}`];
        if (layerDefinition === undefined) {
          break;
        }
        if (sex === requiredSexes[0]) {
          const zPos = definition[`layer_${jdx}`].zPos;
          dataFiles += `data-preview_row=${previewRow} data-preview_column=${previewColumn} data-preview_x_offset=${previewXOffset} data-preview_y_offset=${previewYOffset} data-layer_${jdx}_zpos=${zPos} `;
          dataFiles += `data-tags="${tags.join(
            ","
          )}" data-required_tags="${required_tags.join(
            ","
          )}" data-excluded_tags="${excluded_tags.join(",")}" `;
          const custom_animation = layerDefinition.custom_animation;
          if (custom_animation !== undefined) {
            dataFiles += `data-layer_${jdx}_custom_animation=${custom_animation} `;
          }
        }
        const file = layerDefinition[sex];
        if (file !== null && file !== "") {
          let imageFileName = '"' + file + snakeItemName + '.png" ';
          let fileNameForCreditSearch = file + snakeItemName;
          if (queryObj) {
            fileNameForCreditSearch = es6DynamicTemplate(
              fileNameForCreditSearch,
              queryObj
            );
            imageFileName = es6DynamicTemplate(imageFileName, queryObj);
          }
          if (DEBUG && (!onlyIfTemplate || queryObj))
            console.log(
              `Searching for credits to use for ${imageFileName} in ${fileNameForCreditSearch} for layer ${jdx}`
            );
          const creditToUse = searchCredit(
            fileNameForCreditSearch,
            credits,
            fileNameForCreditSearch
          );
          if (DEBUG && (!onlyIfTemplate || queryObj))
            console.log(
              `file name set for ${sex} is ${imageFileName} for layer ${jdx}`
            );
          dataFiles += `data-layer_${jdx}_${sex}=${imageFileName} `;
          if (template) {
            const mungedTemplate = JSON.stringify(template).replace(/"/g, "'");
            dataFiles += `data-layer_${jdx}_template="${mungedTemplate}" `;
          }
          if (replace_in_path) {
            const mungedReplace = JSON.stringify(replace_in_path).replace(
              /"/g,
              "'"
            );
            dataFiles += `data-layer_${jdx}_replace="${mungedReplace}" `;
          }
          if (creditToUse !== undefined) {
            // comparing via JSON.stringify is faster than node-deep-equal library
            if (
              listCreditToUse !== null &&
              JSON.stringify(listCreditToUse) !== JSON.stringify(creditToUse)
            ) {
              canUseListCredits = false;
            } else if (listCreditToUse === null) {
              listCreditToUse = creditToUse;
            }
            for (const license of creditToUse.licenses) {
              if (!licensesFound.includes(license)) {
                licensesFound.push(license);
              }
            }
            const licenses = '"' + creditToUse.licenses.join(",") + '" ';
            const authors = '"' + creditToUse.authors.join(",") + '" ';
            const urls = '"' + creditToUse.urls.join(",") + '" ';
            const notes = '"' + creditToUse.notes.replaceAll('"', "**") + '" ';
            if (!canUseListCredits) {
              dataFiles += `data-layer_${jdx}_${sex}_licenses=${licenses} `;
              dataFiles += `data-layer_${jdx}_${sex}_authors=${authors} `;
              dataFiles += `data-layer_${jdx}_${sex}_urls=${urls} `;
              dataFiles += `data-layer_${jdx}_${sex}_notes=${notes} `;
            }
            if (!addedCreditsFor.includes(imageFileName)) {
              const quotedShortName = '"' + file + variant + '.png"';
              listItemsCSV += `${quotedShortName},${notes},${authors},${licenses},${urls}\n`;
              addedCreditsFor.push(imageFileName);
            }
          } else {
            throw Error(`missing credit inside ${json}`);
          } // if creditToUse
        } // if file
      } // for jdx
    }
    listItemsHTML += templateHTML
      .replaceAll("[ID_FOR]", itemIdFor)
      .replaceAll("[TYPE_NAME]", typeName)
      .replaceAll("[NAME]", variant)
      .replaceAll("[PARENT_NAME]", name.replaceAll(" ", "_"))
      .replaceAll("[MATCH_BODY_COLOR]", matchBodyColor)
      .replaceAll("[VARIANT]", variant)
      .replaceAll("[DATA_FILE]", dataFiles);
  } // for variant

  // Add license info to metadata
  if (!itemMetadata[itemId].licenses) {
    itemMetadata[itemId].licenses = {};
  }

  for (const sex of requiredSexes) {
    const licenses = '"' + listCreditToUse.licenses.join(",") + '" ';
    listDataFiles += `data-${sex}_licenses=${licenses} `;
    const authors = '"' + listCreditToUse.authors.join(",") + '" ';
    listDataFiles += `data-${sex}_authors=${authors} `;
    const urls = '"' + listCreditToUse.urls.join(",") + '" ';
    listDataFiles += `data-${sex}_urls=${urls} `;
    const notes = '"' + listCreditToUse.notes.replaceAll('"', "**") + '" ';
    listDataFiles += `data-${sex}_notes=${notes} `;

    // Store licenses in metadata
    itemMetadata[itemId].licenses[sex] = listCreditToUse.licenses;
  }
  startHTML = startHTML.replaceAll("[DATA_FILE]", listDataFiles);

  const html = startHTML + listItemsHTML + endHTML;
  let parsed = {};
  parsed.html = html;
  parsed.csv = listItemsCSV;
  return parsed;
} // fn parseJson

// Walk Palettes Definitions and build Metadata
const PALETTES_DIR = "palette_definitions/";
const palettes = fs.readdirSync(PALETTES_DIR);
for (const palette of palettes) {
  const filename = palette.replaceAll("\t", "");
  const [material, version] = palette.replace(".json", "").split("_");
  try {
    definition = JSON.parse(fs.readFileSync(PALETTES_DIR + filename));
    if (!paletteMetadata[material]) {
      paletteMetadata[material] = {};
    }
    paletteMetadata[material][version] = definition;
  } catch (e) {
    console.log(`Error parsing palette file: ${filename}`);
    continue;
  }
}

const lineReader = readline.createInterface({
  input: fs.createReadStream("sources/source_index.html")
});
let csvGenerated = "filename,notes,authors,licenses,urls\n";

lineReader.on("line", function(line) {
  if (line.includes("div_sheet_")) {
    const definition = line.replace("div_sheet_", "");
    let parsedResult = null;
    try {
      parsedResult = parseJson(definition.replaceAll("\t", ""));
    } catch (e) {
      return;
    }
    csvGenerated += parsedResult.csv;
  }
});

lineReader.on("close", function(line) {
  fs.writeFile("CREDITS.csv", csvGenerated, function(err) {
    if (err) {
      return console.error(err);
    } else {
      console.log("CSV Updated!");
      printArray(licensesFound, "Found licenses");
    }
  });

  // Generate item-metadata.js for runtime use
  // Build category tree from paths
  const categoryTree = { items: [], children: {} };
  const duplicatePaths = [];

  for (const [itemId, meta] of Object.entries(itemMetadata)) {
    const itemPath = meta.path || ["Other"];

    // Navigate/create tree structure (skip the last element which is the filename)
    let current = categoryTree;
    // Only use path elements except the last one (which is the filename)
    const categoryPath = itemPath.slice(0, -1);

    for (const segment of categoryPath) {
      if (!current.children[segment]) {
        current.children[segment] = { items: [], children: {} };
      }
      current = current.children[segment];
    }

    // Add item to the category (not as a child)
    current.items.push(itemId);
  }

  const metadataJS = `// THIS FILE IS AUTO-GENERATED. PLEASE DON'T ALTER IT MANUALLY
// Generated from sheet_definitions/*.json by scripts/generate_sources.js
// Contains metadata for all customization items to avoid DOM queries at runtime

window.itemMetadata = ${JSON.stringify(itemMetadata, null, 2)};

window.categoryTree = ${JSON.stringify(categoryTree, null, 2)};

window.paletteMetadata = ${JSON.stringify(paletteMetadata, null, 2)};
`;

  fs.writeFile("item-metadata.js", metadataJS, function(err) {
    if (err) {
      return console.error(err);
    } else {
      console.log("Item Metadata JS Updated!");
    }
  });
});

function printArray(array, label) {
  const colors = {
    red: "\x1b[31m",
    reset: "\x1b[0m"
  };
  console.log(`${label}: ${colors.red}[`);
  array.sort();
  for (const item of array) {
    console.log(`  "${item}",`);
  }
  console.log(`]${colors.reset}`);
}
