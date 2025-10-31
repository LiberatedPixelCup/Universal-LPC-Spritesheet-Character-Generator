// Credits/Attribution component
import { state } from '../../state/state.js';
import { getAllCredits, creditsToCsv, creditsToTxt } from '../../utils/credits.js';
import { CollapsibleSection } from '../CollapsibleSection.js';
import { downloadFile } from '../../canvas/download.js';

export const Credits = {
	view: function() {
		// Collect credits from all selected items
		const allCredits = getAllCredits(state.selections, state.bodyType);

		return m(CollapsibleSection, {
			title: "Credits & Attribution",
			storageKey: "credits",
			defaultOpen: true,
			boxClass: "box",
			id: "credits-section"
		}, [
			m("p.is-size-7.mb-2", [
				"You must credit the authors of this artwork. ",
				m("a", {
					href: "https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/README.md",
					target: "_blank"
				}, "Detailed attribution instructions")
			]),
			m("p.is-size-7.mb-3", [
				"License information for all spritesheets in this generator is available ",
				m("a", {
					href: "https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/raw/refs/heads/master/CREDITS.csv",
					target: "_blank"
				}, "here")
			]),

			allCredits.length > 0 ? [
				m("div.content.has-background-light.p-3",
					allCredits.map(credit =>
						m("div.mb-3", { key: credit.file }, [
							m("strong.is-size-6", credit.fileName),
							credit.notes ? m("p.is-size-7", credit.notes) : null,
							m("p.is-size-7", [
								m("strong", "Licenses: "),
								credit.licenses.join(", ")
							]),
							m("p.is-size-7", [
								m("strong", "Authors: "),
								credit.authors.join(", ")
							])
						])
					)
				),
				m("div.buttons.mt-3", [
					m("button.button.is-small", {
						onclick: () => downloadFile(creditsToTxt(allCredits), "credits.txt")
					}, "Download TXT"),
					m("button.button.is-small", {
						onclick: () => downloadFile(creditsToCsv(allCredits), "credits.csv")
					}, "Download CSV")
				])
			] : m("p.has-text-grey", "No items selected")
		]);
	}
};
