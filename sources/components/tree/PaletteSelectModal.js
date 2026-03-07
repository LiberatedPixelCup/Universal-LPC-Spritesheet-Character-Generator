// PaletteSelectModal.js
import { drawRecolorPreview } from '../../canvas/palette-recolor.js';
import { state, getSelectionGroup } from '../../state/state.js';
import { ucwords } from "../../utils/helpers.js";
import { COMPACT_FRAME_SIZE, FRAME_SIZE } from '../../state/constants.js';

const classNames = window.classNames;

export const PaletteSelectModal = {
    view: function(vnode) {
        const {
            itemId,
            opt,
            selectedColors,
            compactDisplay,
            rootViewNode,
            onClose,
            onSelect
        } = vnode.attrs;

        // Selection Group
        const meta = window.itemMetadata[itemId];
        const selectionGroup = opt.type_name ?? getSelectionGroup(itemId);
        const selection = state.selections[selectionGroup];
        const nodePath = `${itemId}-${opt.idx}-${opt.versions[0]}`;
        if (state.expandedNodes[nodePath] === undefined) {
            state.expandedNodes[nodePath] = true;
        }

        // Overlay for outside click
        const overlay = m('div.palette-modal-overlay', {
            onclick: onClose
        });

        return [
            overlay,
            m("div.palette-modal", {
                onclick: (e) => e.stopPropagation()
            }, [
                m('header.is-flex', [
                    m("h4", opt.label),
                    m("button", {
                        onclick: onClose
                    }, "x")
                ]),
                m('section',
                opt.versions.map((cat) => {
                    const [material, version] = cat.split('.');
                    const nodePath = `${itemId}-${opt.idx}-${cat}`;
                    const paletteMeta = window.paletteMetadata;
                    const paletteVersionMeta = paletteMeta.versions[version];
                    const materialMeta = paletteMeta.materials[material];
                    const recolors = materialMeta.palettes[version];
                    const isExpanded = state.expandedNodes[nodePath] || false;
                    return [
                        m("div.tree-label", {
                            onclick: () => {
                                state.expandedNodes[nodePath] = !isExpanded;
                            }
                        },
                        [
                            m("span.tree-arrow", { class: isExpanded ? 'expanded' : 'collapsed' }),
                            m("span.palette-version",
                                paletteVersionMeta?.label +
                                (material !== opt.material ? ` - ${materialMeta?.label}` : '')
                            )
                        ]),
                        isExpanded ? m("div.variants-container.is-flex.is-flex-wrap-wrap", [
                            ...Object.entries(recolors).map(([palette, colors]) => {
                                const gradient = colors.slice().reverse();
                                const key = (material !== opt.material ? material + '.' : '') + (version !== opt.default ? version + '.' : '') + palette;
                                const isSelected = (selection?.itemId === itemId || selectionGroup === opt.type_name) && selection?.recolor === key;
                                const itemColors = {
                                    ...selectedColors,
                                    [selectionGroup]: key
                                };
                                return m("div.cell", [
                                  m("div.variant-item.is-flex.is-flex-direction-column.is-align-items-center.is-clickable", {
                                    class: classNames({
                                        "has-background-link-light has-text-weight-bold has-text-link": isSelected
                                    }),
                                    onmouseover: (e) => {
                                        const div = e.currentTarget;
                                        if (!isSelected) div.classList.add('has-background-white-ter');
                                    },
                                    onmouseout: (e) => {
                                        const div = e.currentTarget;
                                        if (!isSelected) div.classList.remove('has-background-white-ter');
                                    },
                                    onclick: (e) => {
                                        e.stopPropagation();
                                        onSelect(key);
                                    }
                                  }, [
                                    m("span.variant-display-name.has-text-centered.is-size-7", ucwords(palette.replaceAll('_', ' '))),
                                    m("canvas.variant-canvas.box.p-0", {
                                        width: compactDisplay ? COMPACT_FRAME_SIZE : FRAME_SIZE,
                                        height: compactDisplay ? COMPACT_FRAME_SIZE : FRAME_SIZE,
                                        class: (compactDisplay ? " compact-display" : ""),
                                        onremove: (canvasVnode) => {
                                            canvasVnode.dom._recolorRenderId = (canvasVnode.dom._recolorRenderId || 0) + 1;
                                        },
                                        oncreate: (canvasVnode) => {
                                            const renderId = (canvasVnode.dom._recolorRenderId || 0) + 1;
                                            canvasVnode.dom._recolorRenderId = renderId;
                                            const imagesLoaded = drawRecolorPreview(itemId, meta, canvasVnode.dom, itemColors, renderId);
                                            if (imagesLoaded > 0) {
                                                rootViewNode.state.imagesLoaded += imagesLoaded;
                                            }
                                        }
                                    }),
                                    m("div.palette-swatch",
                                        gradient.map((color, i) =>
                                            m("span", {
                                                style: {
                                                    backgroundColor: color
                                                }
                                            })
                                        )
                                    )
                                ])
                              ])
                            })
                        ]) : null // ends expanded variant container
                    ];
                })),
                m('footer', " ")
            ])
        ];
    }
};
