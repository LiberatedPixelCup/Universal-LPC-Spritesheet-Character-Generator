/**
 * Helper function to get item filename with zPos prefix
 */
export function getItemFileName(itemId, variant, name, layerNum = 1) {
	const meta = window.itemMetadata[itemId];
	if (!meta) return name;

	// Get zPos from specified layer
	const layer = meta.layers?.[`layer_${layerNum}`];
	if (!layer) throw new Error("Requested layer number " + layerNum + " not found for item: " + itemId);
	const zPos = layer?.zPos || 100;
	const altName = `${itemId}_${variant ?? ''}`;

	// Format: "050 body_male_light" (zPos padded to 3 digits + space + name)
	const safeName = (name || altName).replace(/[^a-z0-9]/gi, "_").toLowerCase();
	const fileName = `${String(zPos).padStart(3, "0")} ${safeName}`;
	if (fileName.endsWith('.png')) {
		return fileName;
	}
	return `${fileName}.png`;
}
