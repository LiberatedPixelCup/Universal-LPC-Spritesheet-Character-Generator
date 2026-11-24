// Credit collection and formatting utilities

import type { CatalogReader, Credit } from "../state/catalog.ts";
import type { Selections } from "../state/state.ts";
import { replaceInPath } from "../state/path.ts";
import { variantToFilename } from "../utils/helpers.ts";

type CreditWithFileName = Credit & { fileName: string };

const BOWS_WITH_CUSTOM_WALK = new Set([
  "weapon_ranged_bow_great",
  "weapon_ranged_bow_normal",
  "weapon_ranged_bow_recurve",
]);

/**
 * Collect credits from all selected items. Only includes credits for files
 * actually being used based on current bodyType.
 */
export function getAllCredits(
  catalog: CatalogReader,
  selections: Selections,
  bodyType: string,
  selectedAnimation?: string,
): CreditWithFileName[] {
  const allCredits: CreditWithFileName[] = [];
  const seenFiles = new Set<string>();

  for (const [, selection] of Object.entries(selections)) {
    const { itemId } = selection;
    const metaResult = catalog.getItemMerged(itemId);
    if (metaResult.isErr()) continue;
    const meta = metaResult.value;
    if (meta.credits.length === 0) continue;

    // Build set of actual file paths being used for this item
    const usedPaths = new Set<string>();
    const variantFileName = variantToFilename(selection.variant ?? "");
    const animation =
      selectedAnimation ??
      (meta.animations?.includes("walk") ? "walk" : meta.animations?.[0]);
    const useCustomWalk =
      BOWS_WITH_CUSTOM_WALK.has(itemId) &&
      (animation === "walk" || animation === "walk_128");

    // Check each layer to get the base path for current bodyType
    for (let layerNum = 1; layerNum < 10; layerNum++) {
      const layerKey = `layer_${layerNum}`;
      const layer = meta.layers?.[layerKey];
      if (!layer) break;
      if (useCustomWalk && layer.custom_animation !== "walk_128") continue;

      // Get the base path for current body type. `LayerEntry`'s index
      // signature widens body-type values to `string | number`; the
      // body-type keys hold paths (always strings).
      let basePath = layer[bodyType] as string | undefined;
      if (!basePath) continue;

      if (layer.custom_animation) {
        if (!variantFileName && basePath.endsWith("/")) continue;
        usedPaths.add(`${basePath}${variantFileName}.png`);
        continue;
      }

      // Replace template variables like ${head} if present
      basePath = replaceInPath(catalog, basePath, selections, meta, bodyType);

      // Build full sprite path for this layer and animation
      let fullPath = `${basePath}${animation}.png`;
      if (selection.variant) {
        fullPath = `${basePath}${animation}/${variantFileName}.png`;
      }

      usedPaths.add(fullPath);
    }

    // Only include credits whose file path matches one of the used paths
    for (const credit of meta.credits) {
      if (seenFiles.has(credit.file)) continue;

      const creditFile = credit.file;
      let isUsed = false;
      let lastUsedPath: string | null = null;

      for (const usedPath of usedPaths) {
        // Match if used path equals or starts with the credit file path
        // e.g., usedPath="eyes/human/adult/neutral" matches credit.file="eyes/human" or "eyes/human/adult"
        if (usedPath === creditFile || usedPath.startsWith(creditFile + "/")) {
          isUsed = true;
          lastUsedPath = usedPath;
          break;
        }
      }

      if (isUsed && lastUsedPath !== null && !seenFiles.has(lastUsedPath)) {
        allCredits.push({ fileName: lastUsedPath, ...credit });
        seenFiles.add(lastUsedPath);
      }
    }
  }

  return allCredits;
}

export function creditsToCsv(allCredits: CreditWithFileName[]): string {
  const header = "filename,notes,authors,licenses,urls";
  let csvBody = header + "\n";
  allCredits.forEach((credit) => {
    const authors = credit.authors.join(", ");
    const licenses = credit.licenses.join(", ");
    const urls = credit.urls.join(", ");
    const notes = credit.notes || "";
    const fields = [credit.fileName, notes, authors, licenses, urls];
    csvBody +=
      fields.map((value) => `"${value.replaceAll('"', '""')}"`).join(",") +
      "\n";
  });
  return csvBody;
}

export function creditsToTxt(allCredits: CreditWithFileName[]): string {
  let txt = "";
  allCredits.forEach((credit) => {
    txt += `${credit.fileName}\n`;
    if (credit.notes) {
      txt += `\t- Note: ${credit.notes}\n`;
    }
    txt += `\t- Licenses:\n\t\t- ${credit.licenses.join("\n\t\t- ")}\n`;
    txt += `\t- Authors:\n\t\t- ${credit.authors.join("\n\t\t- ")}\n`;
    txt += `\t- Links:\n\t\t- ${credit.urls.join("\n\t\t- ")}\n\n`;
  });
  return txt;
}
