// Main tree component
import { state, resetAll, applyMatchBodyColor } from '../../state/state.js';
import { BodyTypeSelector } from './BodyTypeSelector.js';
import { TreeNode } from './TreeNode.js';

export const CategoryTree = {
	view: function() {
		if (!window.categoryTree) {
			return m("div", "Loading...");
		}

		return m("div.box.has-background-light", [
			m("div.is-flex.is-justify-content-space-between.is-align-items-center.mb-3", [
				m("h3.title.is-5.mb-0", "Available Items"),
				m("div.buttons.mb-0", [
					m("button.button.is-danger.is-small", {
						onclick: resetAll
					}, "Reset all"),
					m("button.button.is-small", {
						onclick: () => { state.expandedNodes = {}; }
					}, "Collapse All"),
					m("button.button.is-small", {
						onclick: () => {
							for (const [categoryPath, selection] of Object.entries(state.selections)) {
								const { itemId } = selection;
								const meta = window.itemMetadata[itemId];
								if (meta && meta.path) {
									let pathSoFar = "";
									// Expand all path segments (categories)
									for (const segment of meta.path) {
										pathSoFar = pathSoFar ? `${pathSoFar}-${segment}` : segment;
										state.expandedNodes[pathSoFar] = true;
									}
									// Also expand the item itself (to show variants)
									state.expandedNodes[itemId] = true;
								}
							}
						}
					}, "Expand Selected"),
					m("button.button.is-small", {
						class: state.compactDisplay ? "is-link" : "",
						onclick: () => { state.compactDisplay = !state.compactDisplay; }
					}, "CompactDisplay"),
				])
			]),
			m("div.mb-3", [
				m("label.checkbox", {
					title: "When enabled, changing body color will automatically update all compatible items (heads, ears, noses, etc.) to the same color variant"
				}, [
					m("input[type=checkbox]", {
						id: "match-body-color-checkbox",
						"aria-describedby": "match-body-color-label",
						checked: state.matchBodyColorEnabled,
						onchange: (e) => {
							state.matchBodyColorEnabled = e.target.checked;
							// If enabling the checkbox, immediately apply match body color
							if (e.target.checked) {
								applyMatchBodyColor();
							}
						}
					}),
					" Match body color"
				]),
				m("p.is-size-7.has-text-grey.mt-1.ml-4", {
					id: "match-body-color-label"
				}, "Auto-update heads, ears, and other items when body color changes")
			]),
			m("div", [
				// Body Type as first tree item
				m(BodyTypeSelector),
				// Rest of the category tree
				Object.entries(window.categoryTree.children || {}).map(([categoryName, categoryNode]) =>
					m(TreeNode, { key: categoryName, name: categoryName, node: categoryNode })
				)
			])
		]);
	}
};
