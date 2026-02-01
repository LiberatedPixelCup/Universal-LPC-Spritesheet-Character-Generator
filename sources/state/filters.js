import { customAnimationBase, customAnimations } from "../custom-animations.js";
import { LICENSE_CONFIG, ANIMATIONS } from "./constants.js";
import { state } from "./state.js";

// Helper function to get all allowed license strings (expanded from categories)
function getAllowedLicenses() {
	const allowed = [];
	for (const license of LICENSE_CONFIG) {
		if (state.enabledLicenses[license.key]) {
			allowed.push(...license.versions);
		}
	}
	return allowed;
}

// Helper function to check if an item is compatible with selected licenses
export function isItemLicenseCompatible(itemId) {
	const meta = window.itemMetadata?.[itemId];
	if (!meta || !meta.credits || meta.credits.length === 0) return true; // No license info = assume compatible

	const allowedLicenses = getAllowedLicenses();
	if (allowedLicenses.length === 0) return false; // No licenses selected = nothing compatible

	// Create normalized Set for fast lookup
	const allowedSet = new Set(allowedLicenses.map((l) => l.trim()));

	// Check if item has at least one credit with a compatible license
	for (const credit of meta.credits) {
		if (credit.licenses && credit.licenses.length > 0) {
			const hasCompatibleLicense = credit.licenses.some((license) =>
				allowedSet.has(license.trim()),
			);
			if (hasCompatibleLicense) return true;
		}
	}

	return false;
}

// Helper function to check if an item is compatible with selected animations
export function isItemAnimationCompatible(itemId) {
	// Get list of enabled animations
	const enabledAnims = ANIMATIONS.filter(
		(anim) => state.enabledAnimations[anim.value],
	).map((anim) => anim.value);

	// If no animations are selected, filter is disabled - show all items
	if (enabledAnims.length === 0) return true;

	const meta = window.itemMetadata?.[itemId];
	if (!meta || !meta.animations || meta.animations.length === 0) return true; // No animation info = assume compatible

	// Check if item supports at least one enabled animation
	for (const itemAnim of meta.animations) {
		if (enabledAnims.includes(itemAnim)) return true;

    // check if enabledAnims includes base version of itemAnim
    const customAnim = customAnimations[itemAnim];
    if (!customAnim) continue;
    const baseItemAnim = customAnimationBase(customAnim);
    if (baseItemAnim && enabledAnims.includes(baseItemAnim)) return true;
	}

	return false;
}

// Helper function to check if a node path is compatible with selected animations
export function isNodeAnimationCompatible(node) {
	// Get list of enabled animations
	const enabledAnims = ANIMATIONS.filter(
		(anim) => state.enabledAnimations[anim.value],
	).map((anim) => anim.value);

	// If no animations are selected, filter is disabled - show all items
	if (enabledAnims.length === 0) return true;

	const meta = node;
	if (!meta || !meta.animations || meta.animations.length === 0) return true; // No animation info = assume compatible

	// Check if item supports at least one enabled animation
	for (const itemAnim of meta.animations) {
		if (enabledAnims.includes(itemAnim)) return true;

    // check if enabledAnims includes base version of itemAnim
    const customAnim = customAnimations[itemAnim];
    if (!customAnim) continue;
    const baseItemAnim = customAnimationBase(customAnim);
    if (baseItemAnim && enabledAnims.includes(baseItemAnim)) return true;
	}

	return false;
}