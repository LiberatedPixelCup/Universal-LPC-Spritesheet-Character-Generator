// Advanced Tools component - Custom file upload with z-position
import { state } from '../../state/state.js';
import { CollapsibleSection } from '../CollapsibleSection.js';

export const AdvancedTools = {
	view: function() {
		const handleFileUpload = (e) => {
			const file = e.target.files[0];
			if (!file) return;

			// Load the image file
			const img = new Image();
			img.onload = function() {
				state.customUploadedImage = img;
				m.redraw();
			};
			img.src = URL.createObjectURL(file);
		};

		const handleZPosChange = (e) => {
			const value = parseInt(e.target.value);
			state.customImageZPos = isNaN(value) ? 0 : value;
			m.redraw();
		};

		const clearCustomImage = () => {
			state.customUploadedImage = null;
			state.customImageZPos = 0;
			// Clear the file input
			const fileInput = document.getElementById('customFileInput');
			if (fileInput) fileInput.value = '';
			m.redraw();
		};

		return m(CollapsibleSection, {
			title: "Advanced Tools",
			storageKey: "advanced",
			defaultOpen: false
		}, [
			m("div.field", [
				m("label.label", "Custom File Upload"),
				m("div.control", [
					m("input.input[type=file]#customFileInput", {
						accept: "image/*",
						onchange: handleFileUpload
					})
				]),
				m("p.help", "Upload a local image file to overlay on the spritesheet")
			]),
			m("div.field", [
				m("label.label", "Z-Position"),
				m("div.control", [
					m("input.input[type=number]", {
						value: state.customImageZPos,
						oninput: handleZPosChange,
						placeholder: "0"
					})
				]),
				m("p.help", [
					"Layer order: ",
					m("code", "0=shadow"),
					", ",
					m("code", "10=body"),
					", ",
					m("code", "70=arms"),
					", ",
					m("code", "110=beard")
				])
			]),
			state.customUploadedImage && m("div.field", [
				m("div.control", [
					m("button.button.is-small.is-warning", {
						onclick: clearCustomImage
					}, "Clear Custom Image")
				])
			])
		]);
	}
};
