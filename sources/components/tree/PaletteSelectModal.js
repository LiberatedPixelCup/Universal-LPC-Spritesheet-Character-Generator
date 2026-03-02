// PaletteSelectModal.js
import { state, getSelectionGroup } from '../../state/state.js';
import { ucwords } from "../../utils/helpers.js";

const classNames = window.classNames;

export const PaletteSelectModal = {
    view: function(vnode) {
        const {
            itemId,
            opt,
            onClose,
            onSelect
        } = vnode.attrs;

        // Selection Group
        const selectionGroup = opt.type_name ?? getSelectionGroup(itemId);
        const selection = state.selections[selectionGroup];

        // Overlay for outside click
        const overlay = m('div.palette-modal-overlay', {
            onclick: onClose
        });

        // Try to align modal to right side of mithril filters and match exact height of chooser-column
        const modalStyle = {};
        const minWidth = 300;
        if (typeof window !== 'undefined') {
            const chooser = document.getElementById('chooser-column');
            const filters = document.getElementById('mithril-filters');
            if (chooser && filters) {
                const rect = chooser.getBoundingClientRect();
                const fRect = filters.getBoundingClientRect();
                const newWidth = (rect.width / 4 < minWidth) ? minWidth : rect.width / 4;
                modalStyle.left = (fRect.right - newWidth) + 'px';
                modalStyle.top = rect.top + 'px';
                modalStyle.width = modalStyle.maxWidth = newWidth + 'px';
                modalStyle.height = modalStyle.maxHeight = rect.height + 'px';
                modalStyle.right = 'auto';
            }
        }

        return [
            overlay,
            m("div.palette-modal", {
                style: modalStyle,
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
                    const paletteMeta = window.paletteMetadata;
                    const paletteVersionMeta = paletteMeta.versions[version];
                    const materialMeta = paletteMeta.materials[material];
                    const recolors = materialMeta.palettes[version];
                    return [
                        m("div.palette-version",
                            paletteVersionMeta?.label +
                            (material !== opt.material ? ` - ${materialMeta?.label}` : '')
                        ),
                        ...Object.entries(recolors).map(([palette, colors]) => {
                            const dark = colors[0];
                            const gradient = colors.slice().reverse();
                            const key = (material !== opt.material ? material + '.' : '') + (version !== opt.default ? version + '.' : '') + palette;
                            const isSelected = selection?.itemId === itemId && selection?.recolor === key;
                            return m("div.palette-row", {
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
                                m("div.palette-name", ucwords(palette.replaceAll('_', ' '))),
                                m("div.palette-swatch", {
                                        style: {
                                            borderColor: dark,
                                            backgroundColor: dark
                                        }
                                    },
                                    gradient.map((color, i) =>
                                        m("span", {
                                            style: {
                                                width: `${100 / colors.length}%`,
                                                backgroundColor: color
                                            }
                                        })
                                    )
                                )
                            ])
                        })
                    ];
                })),
                m('footer', " ")
            ])
        ];
    }
};
