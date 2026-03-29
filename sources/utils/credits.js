// Credit collection and formatting utilities

import { state } from "../state/state.js";
import { replaceInPath } from "../state/path.js";
import { variantToFilename } from "../utils/helpers.js";

/**
 * Helper function to collect credits from all selected items
 * Only includes credits for files actually being used based on current bodyType
 */
export function getAllCredits(selections, bodyType) {
  const allCredits = [];
  const seenFiles = new Set();

  for (const [categoryPath, selection] of Object.entries(selections)) {
    const { itemId } = selection;
    const meta = window.itemMetadata[itemId];

    if (!meta || !meta.credits) continue;

    const fileName = variantToFilename(selection.variant);

    // Build set of actual file paths being used for this item
    const usedPaths = new Set();

    // Check each layer to get the base path for current bodyType
    for (let layerNum = 1; layerNum < 10; layerNum++) {
      const layerKey = `layer_${layerNum}`;
      const layer = meta.layers?.[layerKey];
      if (!layer) break;

      // Get the base path for current body type
      let basePath = layer[bodyType];
      if (!basePath) continue;

      // Replace template variables like ${head} if present
      basePath = replaceInPath(basePath, selections, meta);

      const animation =
        state.selectedAnimation ??
        (meta.animations.includes("walk") ? "walk" : meta.animations[0]);

      // Build full sprite path for this layer and animation
      const fullPath = `${basePath}${animation}/${fileName}.png`;

      usedPaths.add(fullPath);
    }

    // Only include credits whose file path matches one of the used paths
    for (const credit of meta.credits) {
      if (seenFiles.has(credit.file)) continue;

      // Check if this credit's file matches any of the used paths
      const creditFile = credit.file;
      let isUsed = false;
      let lastUsedPath = null;

      for (const usedPath of usedPaths) {
        // Match if used path equals or starts with the credit file path
        // e.g., usedPath="eyes/human/adult/neutral" matches credit.file="eyes/human" or "eyes/human/adult"
        if (usedPath === creditFile || usedPath.startsWith(creditFile + "/")) {
          isUsed = true;
          lastUsedPath = usedPath;
          break;
        }
      }

      if (isUsed && !seenFiles.has(lastUsedPath)) {
        allCredits.push({ fileName: lastUsedPath, ...credit });
        seenFiles.add(lastUsedPath);
      }
    }
  }

  return allCredits;
}

/**
 * Helper function to convert credits to CSV format
 */
export function creditsToCsv(allCredits) {
  const header = "filename,notes,authors,licenses,urls";
  let csvBody = header + "\n";
  allCredits.forEach((credit) => {
    const authors = credit.authors.join(", ");
    const licenses = credit.licenses.join(", ");
    const urls = credit.urls.join(", ");
    const notes = credit.notes || "";
    csvBody += `"${credit.fileName}","${notes}","${authors}","${licenses}","${urls}"\n`;
  });
  return csvBody;
}

/**
 * Helper function to convert credits to TXT format
 */
export function creditsToTxt(allCredits) {
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
