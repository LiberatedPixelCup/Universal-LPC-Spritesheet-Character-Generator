// Body type selector component (styled as tree category)
import { state } from '../../state/state.js';
import { capitalize } from '../../utils/helpers.js';

export const BodyTypeSelector = {
	oninit: function(vnode) {
		vnode.state.isExpanded = true; // Start expanded by default
	},
	view: function(vnode) {
		const bodyTypes = ["male", "female", "teen", "child", "muscular", "pregnant"];

		return m("div.mb-3", [
			m("div.tree-label", {
				onclick: () => {
					vnode.state.isExpanded = !vnode.state.isExpanded;
				}
			}, [
				m("span.tree-arrow", { class: vnode.state.isExpanded ? 'expanded' : 'collapsed' }),
				m("span.has-text-weight-semibold", "Body Type")
			]),
			vnode.state.isExpanded ? m("div.ml-4.mt-2", [
				m("div.buttons.ml-4",
					bodyTypes.map(type =>
						m("button.button.is-small", {
							class: state.bodyType === type ? "is-primary" : "",
							onclick: () => {
								state.bodyType = type;

							}
						}, capitalize(type))
					)
				)
			]) : null
		]);
	}
};
