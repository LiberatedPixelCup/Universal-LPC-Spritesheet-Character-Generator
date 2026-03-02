// Item with recolors component
import { state, getSelectionGroup, selectItem } from '../../state/state.js';
import { drawRecolorPreview } from '../../canvas/palette-recolor.js';
import { getMultiRecolors, getPaletteOptions, getPalettesForItem } from '../../state/palettes.js';
import { PaletteSelectModal } from './PaletteSelectModal.js';

const classNames = window.classNames;

export const ItemWithRecolors = {
    oncreate: function() {
        const href = "/styles/components/tree/recolors.css";
        if (!document.querySelector(`link[href="${href}"]`)) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            document.head.appendChild(link);
        }
    },
    view: function(vnode) {
        const { itemId, meta, isSearchMatch, isCompatible, tooltipText } = vnode.attrs;
        const compactDisplay = state.compactDisplay;
        const displayName = meta.name;
        const rootViewNode = vnode;
        let nodePath = itemId;
        if (displayName === 'Body Color') {
            nodePath = 'body-body';
        }

        // Check Selection Status
        const selectionGroup = getSelectionGroup(itemId);
		const isExpanded = state.expandedNodes[nodePath] || false;
        const selection = state.selections[selectionGroup]
        const isSelected = selection?.itemId === itemId;
        const selectedColors = getMultiRecolors(itemId, state.selections);

        // Build palette/color options for all recolor fields
        const paletteOptions = getPaletteOptions(itemId, meta);

        // Check Selection Status
        let paletteModal = null;
        if (typeof rootViewNode.state.showPaletteModal === 'number') {
            const idx = rootViewNode.state.showPaletteModal;
            const opt = paletteOptions[idx];
            paletteModal = m(PaletteSelectModal, {
                itemId,
                opt,
                onClose: () => { rootViewNode.state.showPaletteModal = null; m.redraw(); },
                onSelect: (recolor) => {
                    selectItem(itemId, recolor, false, opt.type_name ? idx : null);
                    m.redraw();
                }
            });
        }

        // Only show the idle preview for the asset
        const layer1 = meta.layers?.layer_1;
        const basePath = layer1?.[state.bodyType];

        let previewSrc = null;
        if (basePath) {
            // Standard animations have animation subfolders (walk, slash, etc.)
            const defaultAnim = meta.animations.includes('walk') ? 'walk' : meta.animations[0];
            previewSrc = `spritesheets/${basePath}${defaultAnim}.png`;
        }

        return m("div", {
            class: classNames({
                "search-result": isSearchMatch,
                "has-text-grey": !isCompatible,
            })
        }, [
            m("div.tree-label", {
                title: tooltipText,
                onclick: () => {
                    state.expandedNodes[nodePath] = !isExpanded;
                }
            }, [
				m("span.tree-arrow", { class: isExpanded ? 'expanded' : 'collapsed' }),
				m("span", displayName),
				!isCompatible ? m("span.ml-1", "⚠️") : null
			]),
            paletteModal,
			isExpanded ? m("div", [
				m("div", { class: rootViewNode.state.isLoading ? "loading" : "" }),
                m("div.is-flex.is-align-items-center", {
						title: tooltipText,
                        onmouseover: (e) => {
                            if (!isCompatible) return;
                            const div = e.currentTarget;
                            if (!isSelected) div.classList.add('has-background-white-ter');
                        },
                        onmouseout: (e) => {
                            if (!isCompatible) return;
                            const div = e.currentTarget;

                            if (!isSelected) div.classList.remove('has-background-white-ter');
                        },
                        onclick: () => {
                            if (!isCompatible) return; // Prevent selecting incompatible
                            const palettes = getPalettesForItem(itemId, meta);
                            const recolor = selectedColors?.[meta.type_name] ?? palettes[meta.type_name].source;
                            selectItem(itemId, recolor, isSelected);
                            m.redraw();
                        }
                    }, [
                    m("div", {
                        class: classNames({
                            "variant-item is-flex is-flex-direction-column is-align-items-center is-clickable": true,
                            "has-background-link-light has-text-weight-bold has-text-link": isSelected,
                            "is-not-compatible": !isCompatible
                        })
                    }, [
                        m("canvas.variant-canvas.box.p-0", {
							width: compactDisplay ? 32 : 64,
							height: compactDisplay ? 32 : 64,
                            class: (compactDisplay ? " compact-display" : ""),
                            oncreate: async (canvasVnode) => {
                                const imagesLoaded = drawRecolorPreview(itemId, meta, canvasVnode.dom, selectedColors);
                                if (imagesLoaded > 0) {
                                    rootViewNode.state.imagesLoaded += imagesLoaded;
                                    rootViewNode.state.oldSelectedColors = selectedColors;
                                }
                            },
                            onupdate: async (canvasVnode) => {
                                if (rootViewNode.state.oldSelectedColors === selectedColors) {
                                    return;
                                }
                                const imagesLoaded = drawRecolorPreview(itemId, meta, canvasVnode.dom, selectedColors);
                                if (imagesLoaded > 0) {
                                    rootViewNode.state.oldSelectedColors = selectedColors;
                                }
                            }
                        })
                    ]),
                    // Small color icons for each recolor category
                    paletteOptions.length ? m("div.ml-3.is-align-items-center.palette-recolor-list",
                        paletteOptions.map((opt, idx) => {
                            const dark = opt.colors[0];
                            const gradient = opt.colors.slice().reverse();
                            return m("div.is-flex.palette-recolor-item", {
                                onclick: (e) => {
                                    e.stopPropagation();
                                    rootViewNode.state.showPaletteModal = idx;
                                    m.redraw();
                                }
                            }, [
                                m("label", opt.label),
                                m("div.palette-swatch", {
                                    style: {
                                        border: `1px solid ${dark}`,
                                        background: dark
                                    }
                                },
                                    gradient.map((color, i) =>
                                        m("span", {
                                            style: {
                                                width: `${100 / gradient.length}%`,
                                                backgroundColor: color
                                            }
                                        })
                                    )
                                )
                            ])
                        })
                    ) : null
                ])
            ]) : null
        ]);
    }
};
