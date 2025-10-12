const fs = require("fs");
const readline = require("readline");

const DEBUG = false; // change this to print debug log
const onlyIfTemplate = false; // print debugging log only if there is a template
const onlyIfReplace = true; // print debugging log only if there is replace key

require("child_process").fork("scripts/zPositioning/parse_zpos.js");

// copied from https://github.com/mikemaccana/dynamic-template/blob/046fee36aecc1f48cf3dc454d9d36bb0e96e0784/index.js
const es6DynamicTemplate = (templateString, templateVariables) =>
  templateString.replace(/\${(.*?)}/g, (_, g) => templateVariables[g]);

const templateHTML = fs.readFileSync("scripts/template-general.html", "utf8");

const licensesFound = [];
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
      Object.keys(queryObj).map((key) => [key, ""])
    );
    searchFileName = es6DynamicTemplate(searchFileName, replObj)
      .replace(/_+/, "_");
  }
  const filePath = `sheet_definitions/${searchFileName}.json`;
  if (DEBUG && (!onlyIfTemplate || queryObj))
    console.log(`Parsing ${filePath}`);
  let definition = null;
  try {
    definition = JSON.parse(fs.readFileSync(filePath));
  } catch(e) {
    console.error("error in", filePath);
    throw e;
  }
  const { variants, name, credits, template, replace_in_path } = definition;
  const { tags = [], required_tags = [], excluded_tags = [] } = definition;
  const typeName = definition.type_name;
  const defaultAnimations = [
    "spellcast",
    "thrust",
    "walk",
    "slash",
    "shoot",
    "hurt",
    "watering",
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
  const snakeName = name.replaceAll(" ", "_");
  let idFor = `${typeName}-${snakeName}`;
  if (queryObj) {
    const vals = Object.values(queryObj)
      .map(val => val.replaceAll(" ", "_"))
      .join("_");
    idFor = `${typeName}-${snakeName}_${vals}`;
  }

  let startHTML =
    `<li id="[ID_FOR]" class="variant-list" data-required="[REQUIRED_SEX]" data-animations="[SUPPORTED_ANIMATIONS]" [DATA_FILE]><span class="condensed">${name}</span><ul>`
      .replace("[ID_FOR]", idFor)
      .replace("[REQUIRED_SEX]", requiredSex)
      .replace("[SUPPORTED_ANIMATIONS]", supportedAnimations);

  const endHTML = "</ul></li>";
  
  let canUseListCredits = true;
  let listCreditToUse = null;
  let listDataFiles = "";

  const id = `${typeName}-none_${name.replaceAll(' ', '_')}`;
  let listItemsHTML = `<li class="excluded-hide"><input type="radio" id="${id}" name="${typeName}" class="none"> <label for="${id}">No ${typeName}</label></li><li class="excluded-text"></li>`;
  let listItemsCSV = "";
  const addedCreditsFor = [];
  for (const variant of variants) {
    const snakeItemName = variant.replaceAll(" ", "_");
    const itemIdFor = `${idFor}_${snakeItemName}`;
    let matchBodyColor = false;
    if (definition[`match_body_color`] !== undefined) {
      matchBodyColor = true;
    }
    let dataFiles = "";
    for (const sex of requiredSexes) {
      // TODO: move any non-layer, non-variant specific code here!
      for (jdx = 1; jdx < 10; jdx++) {
        const layerDefinition = definition[`layer_${jdx}`];
        if (layerDefinition === undefined) {
          break;
        }
        if (sex === requiredSexes[0]) {
          const zPos = definition[`layer_${jdx}`].zPos;
          dataFiles += `data-preview_row=${previewRow} data-preview_column=${previewColumn} data-preview_x_offset=${previewXOffset} data-preview_y_offset=${previewYOffset} data-layer_${jdx}_zpos=${zPos} `;
          dataFiles += `data-tags="${tags.join(',')}" data-required_tags="${required_tags.join(',')}" data-excluded_tags="${excluded_tags.join(',')}" `;
          const custom_animation = layerDefinition.custom_animation;
          if (custom_animation !== undefined) {
            dataFiles += `data-layer_${jdx}_custom_animation=${custom_animation} `;
          }
        }
        const file = layerDefinition[sex];
        if (file !== null && file !== "") {
          let imageFileName =
            '"' + file + snakeItemName + '.png" ';
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
            const mungedTemplate = JSON.stringify(template)
              .replace(/"/g, "'");
            dataFiles += `data-layer_${jdx}_template="${mungedTemplate}" `;
          }
          if (replace_in_path) {
            const mungedReplace = JSON.stringify(replace_in_path)
              .replace(/"/g, "'");
            dataFiles += `data-layer_${jdx}_replace="${mungedReplace}" `;
          }
          if (creditToUse !== undefined) {
            // comparing via JSON.stringify is faster than node-deep-equal library
            if (listCreditToUse !== null &&
                JSON.stringify(listCreditToUse) !== JSON.stringify(creditToUse))
            {
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
            const notes =
              '"' + creditToUse.notes.replaceAll('"', "**") + '" ';
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

  for (const sex of requiredSexes) {
    const licenses = '"' + listCreditToUse.licenses.join(",") + '" ';
    listDataFiles += `data-${sex}_licenses=${licenses} `;
    const authors = '"' + listCreditToUse.authors.join(",") + '" ';
    listDataFiles += `data-${sex}_authors=${authors} `;
    const urls = '"' + listCreditToUse.urls.join(",") + '" ';
    listDataFiles += `data-${sex}_urls=${urls} `;
    const notes =
      '"' + listCreditToUse.notes.replaceAll('"', "**") + '" ';
    listDataFiles += `data-${sex}_notes=${notes} `;
  }
  startHTML = startHTML.replaceAll("[DATA_FILE]", listDataFiles);

  const html = startHTML + listItemsHTML + endHTML;
  let parsed = {};
  parsed.html = html;
  parsed.csv = listItemsCSV;
  return parsed;
} // fn parseJson

const lineReader = readline.createInterface({
  input: fs.createReadStream("sources/source_index.html"),
});
let htmlGenerated =
  "<!-- THIS FILE IS AUTO-GENERATED. PLEASE DONT ALTER IT MANUALLY -->\n";
let csvGenerated = "filename,notes,authors,licenses,urls\n";

lineReader.on("line", function (line) {
  if (line.includes("div_sheet_")) {
    const definition = line.replace("div_sheet_", "");
    let parsedResult = null
    try {
      parsedResult = parseJson(definition.replaceAll("\t", ""));
    } catch(e) {
      return;
    }
    const newLineHTML = parsedResult.html;
    htmlGenerated += newLineHTML + "\n";
    csvGenerated += parsedResult.csv;
  } else {
    htmlGenerated += line + "\n";
  }
});

lineReader.on("close", function (line) {
  fs.writeFile("index.html", htmlGenerated, function (err) {
    if (err) {
      return console.error(err);
    } else {
      console.log("HTML Updated!");
    }
  });
  fs.writeFile("CREDITS.csv", csvGenerated, function (err) {
    if (err) {
      return console.error(err);
    } else {
      console.log("CSV Updated!");
      printArray(licensesFound, "Found licenses");
    }
  });
});

function printArray(array, label) {
  const colors = {
    red: "\x1b[31m",
    reset: "\x1b[0m",
  };
  console.log(`${label}: ${colors.red}[`);
  array.sort();
  for (const item of array) {
    console.log(`  "${item}",`);
  }
  console.log(`]${colors.reset}`);
}
