// Search control component
import { state } from '../../state/state.js';

export const SearchControl = {
	view: function() {
		return m("div.field", [
			m("label.label", "Search:"),
			m("input.input[type=search][placeholder=Search]", {
				value: state.searchQuery,
				oninput: (e) => {
					state.searchQuery = e.target.value;
				}
			})
		]);
	}
};
