// Pure utility functions with no state dependencies

/**
 * Simple ES6 template string replacement
 * e.g. es6DynamicTemplate("Hello ${name}", {name: "World"}) => "Hello World"
 * Note: does not support complex expressions, only simple variable replacement
 * @param {string} templateString - Template string with ${var} placeholders
 * @param {Object} templateVariables - Object with variable values
 * @returns {string} - Resulting string with variables replaced
 */
// copied from https://github.com/mikemaccana/dynamic-template/blob/046fee36aecc1f48cf3dc454d9d36bb0e96e0784/index.js
export const es6DynamicTemplate = (templateString, templateVariables) =>
	templateString.replace(/\${(.*?)}/g, (_, g) => templateVariables[g] ?? `\${${g}}`);

/**
 * Convert variant name to filename format (spaces to underscores)
 * @param {string} variant - Variant name (e.g., "light brown")
 * @returns {string} - Filename format (e.g., "light_brown")
 */
export function variantToFilename(variant) {
	return variant.replaceAll(' ', '_');
}

/**
 * Helper function to capitalize strings for display
 */
export function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Helper function to check if item matches search query
 */
export function matchesSearch(text, query) {
	if (!query || query.length < 2) return true;
	return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Helper function to check if a node or its children contain search matches
 */
export function nodeHasMatches(node, query) {
	if (!query || query.length < 2) return true;

	// Check if any items in this node match
	if (node.items && node.items.some(itemId => {
		const meta = window.itemMetadata[itemId];
		return meta && matchesSearch(meta.name, query);
	})) {
		return true;
	}

	// Check if any child nodes have matches
	if (node.children) {
		return Object.values(node.children).some(childNode => nodeHasMatches(childNode, query));
	}

	return false;
}
