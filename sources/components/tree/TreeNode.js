// Recursive tree node component
import { state, getSelectionGroup, isItemLicenseCompatible, isItemAnimationCompatible } from '../../state/state.js';
import { capitalize, matchesSearch, nodeHasMatches } from '../../utils/helpers.js';
import { ItemWithVariants } from './ItemWithVariants.js';

export const TreeNode = {
	view: function(vnode) {
		const { name, node, pathPrefix = "", label } = vnode.attrs;
		const nodePath = pathPrefix ? `${pathPrefix}-${name}` : name;
		const searchQuery = state.searchQuery;
		const hasSearchMatches = nodeHasMatches(node, searchQuery);

		// Filter: Only show items compatible with current body type
		if (node.required && node.required.length > 0 && !node.required.includes(state.bodyType)) return false;

		// Hide this node if search is active and there are no matches
		if (searchQuery && searchQuery.length >= 2 && !hasSearchMatches) {
			return null;
		}

		// Auto-expand if search is active and has matches
		const isExpanded = (searchQuery && searchQuery.length >= 2 && hasSearchMatches) || state.expandedNodes[nodePath] || false;
		const displayName = node.label ?? capitalize(name);

		return m("div",
			m("div.tree-label", {
				onclick: () => {
					state.expandedNodes[nodePath] = !isExpanded;
				}
			}, [
				m("span.tree-arrow", { class: isExpanded ? 'expanded' : 'collapsed' }),
				m("span", displayName)
			]),
			isExpanded ? m("div.ml-4", [
				// Render child categories
				Object.entries(node.children || {}).map(([childName, childNode]) =>
					m(TreeNode, { key: childName, name: childName, node: childNode, pathPrefix: nodePath })
				),
				// Render items in this category
				(node.items || [])
					.filter(itemId => {
						const meta = window.itemMetadata[itemId];
						// Filter: Only show items compatible with current body type
						if (!meta || !meta.required.includes(state.bodyType)) return false;

						// Filter: Only show items matching search query
						if (searchQuery && searchQuery.length >= 2 && !matchesSearch(meta.name, searchQuery)) {
							return false;
						}

						return true;
					})
					.map(itemId => {
						const meta = window.itemMetadata[itemId];
						const displayName = meta.name;
						const hasVariants = meta.variants && meta.variants.length > 0;
						const isSearchMatch = searchQuery && searchQuery.length >= 2 && matchesSearch(meta.name, searchQuery);

						const isLicenseCompatibleFlag = isItemLicenseCompatible(itemId);
						const isAnimCompatibleFlag = isItemAnimationCompatible(itemId);
						const isCompatible = isLicenseCompatibleFlag && isAnimCompatibleFlag;

						// Build tooltip text
						const allLicenses = new Set();
						if (meta?.credits) {
							meta.credits.forEach(credit => {
								if (credit.licenses) {
									credit.licenses.forEach(lic => allLicenses.add(lic.trim()));
								}
							});
						}
						const licensesText = allLicenses.size > 0 ?
							`Licenses: ${Array.from(allLicenses).join(', ')}` :
							'No license info';

						const supportedAnims = meta?.animations || [];
						const animsText = supportedAnims.length > 0 ?
							`Animations: ${supportedAnims.join(', ')}` :
							'No animation info';

						let tooltipText = '';
						if (!isCompatible) {
							const issues = [];
							if (!isLicenseCompatibleFlag) issues.push('licenses');
							if (!isAnimCompatibleFlag) issues.push('animations');
							tooltipText = `⚠️ Incompatible with selected ${issues.join(' and ')}\n`;
						}
						tooltipText += `${licensesText}\n${animsText}`;

						if (!hasVariants) {
							// Simple item with no variants
							const selectionGroup = getSelectionGroup(itemId);
							const isSelected = state.selections[selectionGroup]?.itemId === itemId;
							return m("div.tree-node", {
								key: itemId,
								class: `${isSearchMatch ? "search-result" : ""} ${!isCompatible ? "has-text-grey" : ""}`,
								style: (isSelected ? " font-weight: bold; color: #3273dc;" : ""),
								title: tooltipText,
								onclick: () => {
									if (!isCompatible) return; // Prevent selecting incompatible
									if (isSelected) {
										delete state.selections[selectionGroup];
									} else {
										state.selections[selectionGroup] = { itemId, name: displayName };
									}
								}
							}, [
								displayName,
								!isCompatible ? m("span.ml-1", "⚠️") : null
							]);
						}

						// Item with variants - create a sub-component
						return m(ItemWithVariants, { key: itemId, itemId, meta, isSearchMatch, isCompatible, tooltipText });
					})
			]) : null
		);
	}
};
