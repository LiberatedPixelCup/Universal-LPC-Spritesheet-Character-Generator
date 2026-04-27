import { getItemMerged } from "../state/catalog.ts";

function addExtensionIfMissing(filename: string, extension: string): string {
  if (filename.toLowerCase().endsWith(extension.toLowerCase())) {
    return filename;
  }
  return `${filename}.${extension}`;
}

export function getItemFileName(
  itemId: string,
  variant: string,
  name: string,
  layerNum: number = 1,
  zOverride?: number,
): string {
  const result = getItemMerged(itemId);
  if (result.isErr()) return addExtensionIfMissing(name, "png");

  // Get zPos from specified layer
  const layer = result.value.layers[`layer_${layerNum}`];
  if (!layer)
    throw new Error(
      "Requested layer number " + layerNum + " not found for item: " + itemId,
    );
  const zPos = zOverride || layer.zPos || 100;
  const altName = `${itemId}_${variant}`;

  // Format: "050 body_male_light" (zPos padded to 3 digits + space + name)
  const safeName = (name || altName).replace(/[^a-z0-9.]/gi, "_").toLowerCase();
  const fileName = `${String(zPos).padStart(3, "0")} ${safeName}`;
  return addExtensionIfMissing(fileName, "png");
}
