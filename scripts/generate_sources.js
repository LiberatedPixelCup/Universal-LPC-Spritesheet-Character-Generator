const fs = require("fs");
const readline = require("readline");
const path = require("path");
const SHEETS_DIR = "sheet_definitions" + path.sep;

const DEBUG = false; // change this to print debug log
const onlyIfTemplate = false; // print debugging log only if there is a template
// const onlyIfReplace = true; // print debugging log only if there is replace key

require("child_process").fork("scripts/zPositioning/parse_zpos.js");

// copied from https://github.com/mikemaccana/dynamic-template/blob/046fee36aecc1f48cf3dc454d9d36bb0e96e0784/index.js
const es6DynamicTemplate = (templateString, templateVariables) =>
  templateString.replace(/\${(.*?)}/g, (_, g) => templateVariables[g]);

// Collect metadata for runtime use
const licensesFound = [];
const itemMetadata = {};
const categoryTree = { items: [], children: {} };

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

// Parse Category Tree From Meta Files and Folder Paths
function parseTree(filePath, fileName) {
  // Get Full Path
  const fullPath = path.join(filePath, fileName);
  if (DEBUG && !onlyIfTemplate)
    console.log(`Parsing tree ${fullPath}`);

  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(fullPath));
  } catch (e) {
    console.error("error in", fullPath);
    throw e;
  }

  const { label, priority, required, animations, path: itemPath } = meta;

  let current = categoryTree;
  const categoryPath = filePath.replace("sheet_definitions" + path.sep, "").split(path.sep);
  const treeId = filePath.split(path.sep).pop();

  for (let segment of categoryPath) {
    if (!current.children[segment]) {
      current.children[segment] = {
        items: [],
        children: {}
      };

      // Only Set Metadata on Current Tree ID
      if (segment === treeId) {
        current.children[segment].label = label;
        current.children[segment].priority = priority || null;
        current.children[segment].required = required || [];
        current.children[segment].animations = animations || [];
      }
    }
    current = current.children[segment];
  }
} // fn parseTree

// Parse Asset JSON File
function parseJson(filePath, fileName) {
  let queryObj = null;
  let treePath = null;
  /*const templateIndex = fileName.lastIndexOf("%");
  let searchFileName = fileName;
  let queryObj = null;
  if (templateIndex > -1) {
    searchFileName = searchFileName.substring(0, templateIndex);
    const query = fileName.substring(templateIndex + 1);
    queryObj = Object.fromEntries(new URLSearchParams(query));
    const replObj = Object.fromEntries(
      Object.keys(queryObj).map(key => [key, ""])
    );
    searchFileName = es6DynamicTemplate(searchFileName, replObj).replace(
      /_+/,
      "_"
    );
  }*/
  const fullPath = path.join(filePath, fileName);
  const searchFileName = fileName.replace(".json", "");
  if (DEBUG && (!onlyIfTemplate || queryObj))
    console.log(`Parsing ${fullPath}`);

  // Read JSON Definition
  let definition = null;
  try {
    definition = JSON.parse(fs.readFileSync(fullPath));
  } catch (e) {
    console.error("error in", fullPath);
    throw e;
  }

  const {
    variants,
    name,
    credits,
    replace_in_path,
    //path: itemPath,
    priority,
    ignore
  } = definition;

  // Skip Ignored Items
  if (ignore === true) {
    throw Error(`Skipping ignored item: ${searchFileName}`);
  }


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

  // Build unique itemId from filename (not from path or type_name)
  // This ensures each item has a unique ID even if they share the same type_name
  let itemId = searchFileName;
  // Append query parameters if present
  /*if (queryObj) {
    const vals = Object.values(queryObj)
      .map(val => val.replaceAll(" ", "_"))
      .join("_");
    itemId = `${itemId}_${vals}`;
  }*/
  const itemPath = filePath.replace("sheet_definitions" + path.sep, "").split(path.sep);
  itemPath.push(itemId);

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

  // Collect metadata for this item
  itemMetadata[itemId] = {
    name: name,
    priority: priority || null,
    type_name: typeName,
    required: requiredSexes,
    animations: animations,
    tags: tags,
    required_tags: required_tags,
    excluded_tags: excluded_tags,
    path: itemPath || treePath || ["other"],
    replace_in_path: replace_in_path || {},
    variants: variants || [],
    layers: layers,
    credits: credits || [],
    preview_row: previewRow,
    preview_column: previewColumn,
    preview_x_offset: previewXOffset,
    preview_y_offset: previewYOffset,
    matchBodyColor: definition.match_body_color || false
  };

  let listCreditToUse = null;
  let listItemsCSV = [];

  // Use type_name for radio button grouping (ensures only one item per type can be selected)
  const addedCreditsFor = [];
  for (const variant of variants) {
    const snakeItemName = variant.replaceAll(" ", "_");
    for (const sex of requiredSexes) {
      // TODO: move any non-layer, non-variant specific code here!
      for (let jdx = 1; jdx < 10; jdx++) {
        const layerDefinition = definition[`layer_${jdx}`];
        if (layerDefinition === undefined) {
          break;
        }
        const file = layerDefinition[sex];
        if (file !== null && file !== "") {
          let imageFileName = '"' + file + snakeItemName + '.png" ';
          let fileNameForCreditSearch = file + snakeItemName;
          /*if (queryObj) {
            fileNameForCreditSearch = es6DynamicTemplate(
              fileNameForCreditSearch,
              queryObj
            );
            imageFileName = es6DynamicTemplate(imageFileName, queryObj);
          }*/
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
          if (creditToUse !== undefined) {
            // comparing via JSON.stringify is faster than node-deep-equal library
            if (
              listCreditToUse !== null &&
              JSON.stringify(listCreditToUse) !== JSON.stringify(creditToUse)
            ) {
              // do nothing
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
            if (!addedCreditsFor.includes(imageFileName)) {
              const quotedShortName = '"' + file + variant + '.png"';
              listItemsCSV.push({
                priority,
                lineText: `${quotedShortName},${notes},${authors},${licenses},${urls}\n`
              });
              addedCreditsFor.push(imageFileName);
            }
          } else {
            throw Error(`missing credit inside ${fileName}`);
          } // if creditToUse
        } // if file
      } // for jdx
    } // for sex
  } // for variant

  // Add license info to metadata
  if (!itemMetadata[itemId].licenses) {
    itemMetadata[itemId].licenses = {};
  }

  for (const sex of requiredSexes) {
    // Store licenses in metadata
    itemMetadata[itemId].licenses[sex] = listCreditToUse.licenses;
  }

  let parsed = {};
  parsed.csv = listItemsCSV;
  return parsed;
} // fn parseJson


// Read sheet_definitions/*.json line by line
const files = fs.readdirSync(SHEETS_DIR, { 
  recursive: true,
  withFileTypes: true 
}).sort((a, b) => {
  const pa = path.join(a.path, a.name);
  const pb = path.join(b.path, b.name);

  const depthA = pa.split(path.sep).length;
  const depthB = pb.split(path.sep).length;
  if (depthA !== depthB) return depthA - depthB;

  return pa.localeCompare(pb);
});

// Initialize CSV
csvList = [];
files.forEach(file => {
  if (file.isDirectory()) {
    return;
  } else if (file.name.startsWith("meta_")) {
    // Handle Category Tree
    parseTree(file.path, file.name);
    return;
  } else {
    let parsedResult = null;
    try {
      parsedResult = parseJson(file.path, file.name);
    } catch (e) {
      if (DEBUG && !onlyIfTemplate)
        console.log(e);
      return;
    }
    csvList.push({path: file.path.replace(SHEETS_DIR, ''), csv: parsedResult.csv});
  }
});

// Generate item-metadata.js for runtime use
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
} // for itemMetadata

// Sort Category Tree and Subitems
function sortCategoryTree(node) {
  const sortedChildren = Object.entries(node.children || {}).sort(
    ([keyA, valA], [keyB, valB]) => {
      const a = valA.priority ?? Number.POSITIVE_INFINITY;
      const b = valB.priority ?? Number.POSITIVE_INFINITY;
      if (a !== b) return a - b;
      const labelA = valA.label ?? keyA;
      const labelB = valB.label ?? keyB;
      return labelA.localeCompare(labelB);
    }
  );

  const reordered = {};
  for (const [key, child] of sortedChildren) {
    sortCategoryTree(child);
    reordered[key] = child;
  }
  node.children = reordered;

  if (node.items) {
    node.items.sort((idA, idB) => {
      const metaA = itemMetadata[idA] || {};
      const metaB = itemMetadata[idB] || {};
      const a = metaA.priority ?? Number.POSITIVE_INFINITY;
      const b = metaB.priority ?? Number.POSITIVE_INFINITY;
      if (a !== b) return a - b;
      const nameA = metaA.name ?? idA;
      const nameB = metaB.name ?? idB;
      return nameA.localeCompare(nameB);
    });
  }

  return node;
}

sortCategoryTree(categoryTree);

// Sort csvList by category tree priorities
csvList.sort((a, b) => {
  const pathA = a.path.split(path.sep).filter(Boolean);
  const pathB = b.path.split(path.sep).filter(Boolean);

  // Compare each path segment
  const maxLen = Math.max(pathA.length, pathB.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= pathA.length) return -1; // a is shorter, comes first
    if (i >= pathB.length) return 1;  // b is shorter, comes first

    const segA = pathA[i];
    const segB = pathB[i];

    if (segA === segB) continue;

    // Navigate to parent node to get priorities
    let nodeA = categoryTree;
    let nodeB = categoryTree;
    for (let j = 0; j <= i; j++) {
      nodeA = nodeA.children?.[pathA[j]];
      nodeB = nodeB.children?.[pathB[j]];
      if (!nodeA || !nodeB) break;
    }

    const prioA = nodeA?.priority ?? Number.POSITIVE_INFINITY;
    const prioB = nodeB?.priority ?? Number.POSITIVE_INFINITY;

    if (prioA !== prioB) return prioA - prioB;

    const labelA = nodeA?.label ?? segA;
    const labelB = nodeB?.label ?? segB;
    return labelA.localeCompare(labelB);
  }

  return 0;
});

// Generate CREDITS.csv After Sorting Everything
let csvGenerated = "filename,notes,authors,licenses,urls\n";
for (const result of csvList) {
  for (const item of result.csv) {
    csvGenerated += item.lineText;
  }
}
fs.writeFile("CREDITS.csv", csvGenerated, function(err) {
  if (err) {
    return console.error(err);
  } else {
    console.log("CSV Updated!");
    printArray(licensesFound, "Found licenses");
  }
});

const metadataJS = `// THIS FILE IS AUTO-GENERATED. PLEASE DON'T ALTER IT MANUALLY
// Generated from sheet_definitions/*.json by scripts/generate_sources.js
// Contains metadata for all customization items to avoid DOM queries at runtime

window.itemMetadata = ${JSON.stringify(itemMetadata, null, 2)};

window.categoryTree = ${JSON.stringify(categoryTree, null, 2)};
`;

fs.writeFile("item-metadata.js", metadataJS, function(err) {
  if (err) {
    return console.error(err);
  } else {
    console.log("Item Metadata JS Updated!");
  }
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
