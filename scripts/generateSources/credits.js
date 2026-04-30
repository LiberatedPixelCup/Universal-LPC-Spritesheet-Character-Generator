import path from "node:path";
import debugUtils from "../utils/debug.js";
import { ANIMATIONS } from "../../sources/state/constants.ts";
import {
  categoryTree,
  csvList,
  itemMetadata,
  licensesFound,
  onlyIfTemplate,
  SHEETS_DIR,
} from "./state.js";

const { debugLog } = debugUtils;
export const CREDITS_OUTPUT = "CREDITS.csv";

/**
 * Recursively resolves the best credit entry for a generated sprite filename.
 * @param {string} fileName Candidate filename or path fragment to match.
 * @param {Array<Object>} credits Credits list from a sheet definition.
 * @param {string} origFileName Original filename used for terminal error logging.
 * @return {Object|undefined} Matching credit object when found; otherwise undefined.
 * @throws {TypeError} If credits is not an array-like object and indexed access fails.
 */
function searchCredit(fileName, credits, origFileName) {
  if (credits.length <= 0) {
    console.error("no credits for filename:", fileName);
    return undefined;
  }
  if (credits.length === 1) {
    if (
      !credits[0].file.includes(fileName) &&
      !fileName.includes(credits[0].file)
    ) {
      console.error("Wrong credit at filename:", fileName);
      return undefined;
    }
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
      origFileName,
    );
  }
  return undefined;
}

/**
 * Builds CSV credit row data for a specific rendered frame and tracks encountered licenses.
 * @param {string} fileName Render path to resolve credit information for.
 * @param {Array<Object>} credits Credit entries defined for the item.
 * @param {Object|null} listCreditToUse Current selected credit for this item run.
 * @param {Array<string>} addedCreditsFor Paths already emitted to CSV.
 * @return {[Object|null, string, string]} Updated selected credit, generated CSV line text, and image filename token.
 * @throws {Error} If no matching credit can be resolved for the requested filename.
 */
export function parseCredits(
  fileName,
  credits,
  listCreditToUse,
  addedCreditsFor,
) {
  // Find Credit or Throw Error
  const creditToUse = searchCredit(fileName, credits, fileName);
  if (creditToUse === undefined)
    throw Error(`missing credit inside ${fileName}`);

  // Append Licenses
  for (const license of creditToUse.licenses) {
    if (!licensesFound.includes(license)) {
      licensesFound.push(license);
    }
  }

  // Fallback to CreditToUse
  if (listCreditToUse === null) {
    listCreditToUse = creditToUse;
  }

  const imageFileName = '"' + fileName + '.png" ';
  if (!onlyIfTemplate)
    debugLog(
      `Searching for credits to use for ${imageFileName} in ${fileName}`,
    );

  const licenses = '"' + creditToUse.licenses.join(",") + '" ';
  const authors = '"' + creditToUse.authors.join(",") + '" ';
  const urls = '"' + creditToUse.urls.join(",") + '" ';
  const notes = '"' + creditToUse.notes.replaceAll('"', "**") + '" ';
  let lineText = "";
  if (!addedCreditsFor.includes(imageFileName)) {
    const quotedShortName = '"' + fileName + '.png"';
    lineText = `${quotedShortName},${notes},${authors},${licenses},${urls}\n`;
  }
  return [listCreditToUse, lineText, imageFileName];
}

/**
 * Builds CSV credit rows for one item across all supported animations, body types, and layers.
 * @param {Object} definition Parsed sheet definition object.
 * @param {Object} meta Parsed metadata object.
 * @return {{listCreditToUse: Object|null, listItemsCSV: Array<{priority: (number|null|undefined), lineText: string}>}} Generated CSV row payloads and selected credit.
 * @throws {Error} Propagates missing-credit errors from parseCredits.
 */
export function collectCreditsCsvRows(definition, meta) {
  let listCreditToUse = null;
  const listItemsCSV = [];
  const addedCreditsFor = [];

  // Get Credits Per Animation Type
  for (const anim of meta.animations) {
    // Skip Animation if No Export
    const animConfig = ANIMATIONS.find(({ value }) => value === anim);
    if (animConfig?.noExport) continue;

    // Convert animation name to snake_case for file naming
    const snakeItemName = anim.replaceAll(" ", "_");

    // Loop Body Types
    for (const sex of meta.required) {
      for (let jdx = 1; jdx < 10; jdx++) {
        const layerDefinition = definition[`layer_${jdx}`];
        if (layerDefinition === undefined) break;

        const file = layerDefinition[sex];
        if (file !== null && file !== "") {
          const searchFileName = file + snakeItemName;
          const [newCreditToUse, lineText, creditsFor] = parseCredits(
            searchFileName,
            meta.credits,
            listCreditToUse,
            addedCreditsFor,
          );
          listCreditToUse = newCreditToUse;
          listItemsCSV.push({
            priority: meta.priority,
            lineText,
          });
          addedCreditsFor.push(creditsFor);
        }
      }
    }
  }

  return { listCreditToUse, listItemsCSV };
}

/**
 * Generates CSV rows and injects resolved license data for one parsed item.
 * @param {string} itemId Parsed item identifier used to look up shared metadata.
 * @param {string} filePath Parent directory path of the processed sheet file.
 * @param {Object} definition Parsed sheet definition object used for layer traversal.
 * @param {string} [sheetsDir] Optional sheets root used for CSV path normalization.
 * @return {{csv: Array<{priority: (number|null|undefined), lineText: string}>, listCreditToUse: Object|null}} Generated CSV rows and selected credit.
 * @throws {Error} Propagates missing-credit errors from collectCreditsCsvRows.
 */
export function processItemCredits(
  itemId,
  filePath,
  definition,
  sheetsDir = null,
) {
  const meta = itemMetadata[itemId];
  const { listCreditToUse, listItemsCSV } = collectCreditsCsvRows(
    definition,
    meta,
  );

  // Insert Licenses Per Body Type
  if (!meta.licenses) {
    meta.licenses = {};
  }
  for (const sex of meta.required) {
    meta.licenses[sex] = listCreditToUse?.licenses || [];
  }

  // Append CSV List
  csvList.push({
    path: path.relative(sheetsDir ?? SHEETS_DIR, filePath),
    csv: listItemsCSV,
  });

  return { csv: listItemsCSV, listCreditToUse };
}

/**
 * Sorts CSV list entries by category tree priority and label path.
 * @param {Array<{path: string, csv: Array<{priority: (number|null|undefined), lineText: string}>}>} csvList CSV sections grouped by directory path.
 * @param {{children?: Object<string, any>}} categoryTree Category tree used for priority and label lookup.
 * @return {void} No return value; sorts csvList in place.
 */
export function sortCsvList(csvList, categoryTree) {
  csvList.sort((a, b) => {
    const pathA = a.path.split(path.sep).filter(Boolean);
    const pathB = b.path.split(path.sep).filter(Boolean);

    const maxLen = Math.max(pathA.length, pathB.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= pathA.length) return -1;
      if (i >= pathB.length) return 1;

      const segA = pathA[i];
      const segB = pathB[i];

      if (segA === segB) continue;

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
      return labelA.localeCompare(labelB, ["en"]);
    }

    return 0;
  });
}

/**
 * Generates final CREDITS.csv content text from shared CSV/category state.
 * @return {string} Full generated CSV text.
 */
export function generateCreditsCsv() {
  sortCsvList(csvList, categoryTree);

  let csvGenerated = "filename,notes,authors,licenses,urls\n";
  for (const result of csvList) {
    for (const item of result.csv) {
      csvGenerated += item.lineText;
    }
  }

  return csvGenerated;
}
