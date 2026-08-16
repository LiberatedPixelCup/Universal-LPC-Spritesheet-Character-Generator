import path from "node:path";
import type { Credit } from "../../sources/state/catalog.ts";
import { ANIMATIONS } from "../../sources/state/constants.ts";
import debugUtils from "../utils/debug.ts";
import {
  categoryTree,
  csvList,
  itemMetadata,
  licensesFound,
  onlyIfTemplate,
  SHEETS_DIR,
  type CsvListEntry,
  type GeneratorItem,
} from "./state.ts";

const { debugLog } = debugUtils;
export const CREDITS_OUTPUT = "CREDITS.csv";

export type CreditEntry = Partial<Credit> & {
  file: string;
  licenses: string[];
  authors: string[];
  urls: string[];
  notes?: string;
};

export type CreditsItemMeta = GeneratorItem & {
  animations: string[];
  required: string[];
  credits: CreditEntry[];
  priority?: number | null;
};

type LayerDefinition = {
  custom_animation?: string;
  [bodyOrField: string]: string | number | null | undefined;
};

type SheetDefinition = Record<string, LayerDefinition | undefined>;

type SortTreeNode = {
  children?: Record<string, SortTreeNode>;
  priority?: number | null;
  label?: string;
};

function searchCredit(
  fileName: string,
  credits: CreditEntry[],
  origFileName: string,
): CreditEntry | undefined {
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
 */
export function parseCredits(
  fileName: string,
  credits: CreditEntry[],
  listCreditToUse: CreditEntry | null,
  addedCreditsFor: string[],
): [CreditEntry, string, string] {
  const creditToUse = searchCredit(fileName, credits, fileName);
  if (creditToUse === undefined)
    throw Error(`missing credit inside ${fileName}`);

  for (const license of creditToUse.licenses) {
    if (!licensesFound.includes(license)) {
      licensesFound.push(license);
    }
  }

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
  const notes = '"' + creditToUse.notes!.replaceAll('"', "**") + '" ';
  let lineText = "";
  if (!addedCreditsFor.includes(imageFileName)) {
    const quotedShortName = '"' + fileName + '.png"';
    lineText = `${quotedShortName},${notes},${authors},${licenses},${urls}\n`;
  }
  return [listCreditToUse, lineText, imageFileName];
}

/**
 * Builds CSV credit rows for one item across all supported animations, body types, and layers.
 */
export function collectCreditsCsvRows(
  definition: SheetDefinition,
  meta: CreditsItemMeta,
): {
  listCreditToUse: CreditEntry | null;
  listItemsCSV: CsvListEntry["csv"];
} {
  let listCreditToUse: CreditEntry | null = null;
  const listItemsCSV: CsvListEntry["csv"] = [];
  const addedCreditsFor: string[] = [];

  for (const anim of meta.animations) {
    const animConfig = ANIMATIONS.find(({ value }) => value === anim);
    if (animConfig?.noExport) continue;

    const snakeItemName = anim.replaceAll(" ", "_");

    for (const sex of meta.required) {
      for (let jdx = 1; jdx < 10; jdx++) {
        const layerDefinition = definition[`layer_${jdx}`];
        if (layerDefinition === undefined) break;

        const file = layerDefinition[sex];
        if (file !== null && file !== "") {
          const filePath = file as string;
          const searchFileName =
            layerDefinition.custom_animation && !filePath.endsWith("/")
              ? filePath
              : filePath + snakeItemName;
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
 */
export function processItemCredits(
  itemId: string,
  filePath: string,
  definition: SheetDefinition,
  sheetsDir: string | null = null,
): { csv: CsvListEntry["csv"]; listCreditToUse: CreditEntry | null } {
  const meta = itemMetadata[itemId] as CreditsItemMeta;
  const { listCreditToUse, listItemsCSV } = collectCreditsCsvRows(
    definition,
    meta,
  );

  if (!meta.licenses) {
    meta.licenses = {};
  }
  for (const sex of meta.required) {
    meta.licenses[sex] = listCreditToUse?.licenses || [];
  }

  csvList.push({
    path: path.relative(sheetsDir ?? SHEETS_DIR, filePath),
    csv: listItemsCSV,
  });

  return { csv: listItemsCSV, listCreditToUse };
}

/**
 * Sorts CSV list entries by category tree priority and label path.
 */
export function sortCsvList(
  csvListToSort: CsvListEntry[],
  tree: SortTreeNode,
): void {
  csvListToSort.sort((a, b) => {
    const pathA = a.path.split(path.sep).filter(Boolean);
    const pathB = b.path.split(path.sep).filter(Boolean);

    const maxLen = Math.max(pathA.length, pathB.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= pathA.length) return -1;
      if (i >= pathB.length) return 1;

      const segA = pathA[i];
      const segB = pathB[i];

      if (segA === segB) continue;

      let nodeA: SortTreeNode | undefined = tree;
      let nodeB: SortTreeNode | undefined = tree;
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
 */
export function generateCreditsCsv(): string {
  sortCsvList(csvList, categoryTree);

  let csvGenerated = "filename,notes,authors,licenses,urls\n";
  for (const result of csvList) {
    for (const item of result.csv) {
      csvGenerated += item.lineText;
    }
  }

  return csvGenerated;
}
