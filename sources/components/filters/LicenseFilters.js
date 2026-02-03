// License Filters component
import { state } from '../../state/state.js';
import { isItemLicenseCompatible } from '../../state/filters.js';
import { LICENSE_CONFIG } from '../../state/constants.js';

// Dependency injection for testability
let deps = {
  isItemLicenseCompatible,
  licenseConfig: LICENSE_CONFIG,
};

export function setLicenseCompatible({ isItemLicenseCompatible }) {
  deps.isItemLicenseCompatible = isItemLicenseCompatible;
}
export function isLicenseCompatible() {
  return deps.isItemLicenseCompatible(...arguments);
}

export function setLicenseConfig(config) {
  deps.licenseConfig = config;
}
export function getLicenseConfig() {
  return deps.licenseConfig;
}

export const LicenseFilters = {
  isLicenseCompatible() { return deps.isItemLicenseCompatible(...arguments); },
  licenseConfig() { return deps.licenseConfig; },

	oninit: function(vnode) {
		vnode.state.isExpanded = false; // Start collapsed by default
	},
	view: function(vnode) {

		// Function to remove incompatible items from selections
    const self = this;
		const removeIncompatibleItems = () => {
			const toRemove = [];
			for (const [selectionGroup, selection] of Object.entries(state.selections)) {
				if (!self.isLicenseCompatible(selection.itemId)) {
					toRemove.push(selectionGroup);
				}
			}

			if (toRemove.length > 0) {
				toRemove.forEach(key => delete state.selections[key]);
				alert(`Removed ${toRemove.length} incompatible item(s)`);
			} else {
				alert('No incompatible items found');
			}
		};

		// Check if there are any incompatible selected items
		const incompatibleSelections = Object.values(state.selections).filter(
			selection => !self.isLicenseCompatible(selection.itemId)
		);
		const hasIncompatibleItems = incompatibleSelections.length > 0;

		// Count how many licenses are enabled
		const enabledCount = Object.values(state.enabledLicenses).filter(Boolean).length;
		const totalCount = self.licenseConfig().length;

		return m("div.box.mb-4.has-background-light", [
			m("div.tree-label", {
				onclick: () => {
					vnode.state.isExpanded = !vnode.state.isExpanded;
				}
			}, [
				m("span.tree-arrow", { class: vnode.state.isExpanded ? 'expanded' : 'collapsed' }),
				m("span.title.is-6.is-inline", "License Filters"),
				m("span.is-size-7.has-text-grey.ml-2", `(${enabledCount}/${totalCount} enabled)`)
			]),
			vnode.state.isExpanded ? m("div.content.mt-3", [
				m("ul.tree-list",
					self.licenseConfig().map(license =>
						m("li", { key: license.key, class: "mb-2" }, [
							m("label.checkbox", [
								m("input[type=checkbox]", {
									checked: state.enabledLicenses[license.key],
									onchange: (e) => {
										state.enabledLicenses[license.key] = e.target.checked;
									}
								}),
								` ${license.label} `,
								m("a.is-size-7", {
									href: license.url,
									target: "_blank",
									rel: "noopener noreferrer"
								}, `(Show license${license.urlLabel ? ' ' + license.urlLabel : ''})`)
							])
						])
					)
				),
				hasIncompatibleItems ? [
					m("div.notification.is-warning.is-light.p-3.mt-2", [
						m("p.is-size-7", [
							m("strong", `${incompatibleSelections.length} selected item${incompatibleSelections.length > 1 ? 's are' : ' is'} incompatible`),
							" with your current license selection. ",
							m("span.has-text-grey", "(marked with ⚠️ above)")
						])
					]),
					m("button.button.is-small.is-warning.mt-2", {
						onclick: removeIncompatibleItems,
						title: `Remove ${incompatibleSelections.length} incompatible item${incompatibleSelections.length > 1 ? 's' : ''}`
					}, `Remove ${incompatibleSelections.length} Incompatible Asset${incompatibleSelections.length > 1 ? 's' : ''}`)
				] : null
			]) : null
		]);
	}
};
