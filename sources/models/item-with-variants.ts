import type { CatalogReader, ItemMerged } from "../state/catalog.ts";
import { COMPACT_FRAME_SIZE, FRAME_SIZE } from "../state/constants.ts";
import { getLayersToLoad, type LayerToLoad } from "../state/meta.ts";
import { getSelectionGroup, selectItem, type State } from "../state/state.ts";
import { capitalize } from "../utils/helpers.ts";

export type VariantItemModel = {
  readonly key: string;
  readonly label: string;
  readonly isSelected: boolean;
  readonly isCompatible: boolean;
  readonly size: number;
  readonly compactDisplay: boolean;
  select(): void;
  loadPreview(
    canvas: HTMLCanvasElement,
  ): Promise<{ redraw: (size: number) => void; imagesLoaded: number }>;
};

export type ItemWithVariantsModel = {
  readonly name: string;
  readonly isSearchMatch: boolean;
  readonly isCompatible: boolean;
  readonly tooltip?: string;
  readonly isExpanded: boolean;
  readonly imagesToLoad: number;
  readonly variants: readonly VariantItemModel[];
  toggle(): number;
};

function loadLayer(layer: LayerToLoad) {
  return new Promise<{ img: HTMLImageElement | null; layer: LayerToLoad }>(
    (resolve) => {
      const img = new Image();
      img.onload = () => resolve({ img, layer });
      img.onerror = () => resolve({ img: null, layer });
      img.src = layer.path;
    },
  );
}

export const itemWithVariantsModelFactory = {
  create(
    catalog: CatalogReader,
    state: State,
    itemId: string,
    meta: ItemMerged,
    isSearchMatch: boolean,
    isCompatible: boolean,
    tooltip: string,
    showTooltip: boolean,
  ): ItemWithVariantsModel {
    const nodePath = meta.name === "Body Color" ? "body-body" : itemId;
    const isExpanded = state.expandedNodes[nodePath] || false;
    const compact = state.compactDisplay;
    const size = compact ? COMPACT_FRAME_SIZE : FRAME_SIZE;
    const baseLayers = isExpanded
      ? getLayersToLoad(catalog, meta, state.bodyType, state.selections)
      : [];

    return {
      name: meta.name,
      isSearchMatch,
      isCompatible,
      tooltip: showTooltip ? tooltip : undefined,
      isExpanded,
      imagesToLoad: meta.variants.length * baseLayers.length,
      toggle: () => {
        state.expandedNodes[nodePath] = !isExpanded;
        if (isExpanded) return 0;
        return (
          meta.variants.length *
          getLayersToLoad(catalog, meta, state.bodyType, state.selections)
            .length
        );
      },
      variants: isExpanded
        ? meta.variants.map((variant) => {
            const group = getSelectionGroup(itemId);
            const isSelected =
              state.selections[group]?.itemId === itemId &&
              state.selections[group]?.variant === variant;
            return {
              key: variant,
              label: capitalize(variant.replaceAll("_", " ")),
              isSelected,
              isCompatible,
              size,
              compactDisplay: compact,
              select: () => {
                if (isCompatible)
                  selectItem(state, itemId, variant, isSelected);
              },
              loadPreview: async (canvas) => {
                const layers = getLayersToLoad(
                  catalog,
                  meta,
                  state.bodyType,
                  state.selections,
                  variant,
                );
                const loaded = await Promise.all(layers.map(loadLayer));
                const draw = (currentSize: number) => {
                  const context = canvas.getContext("2d", {
                    willReadFrequently: true,
                  });
                  if (!context) return;
                  const row = meta.preview_row ?? 2;
                  const preview = meta as ItemMerged & {
                    preview_column?: number;
                    preview_x_offset?: number;
                    preview_y_offset?: number;
                  };
                  const column = preview.preview_column ?? 0;
                  const xOffset = preview.preview_x_offset ?? 0;
                  const yOffset = preview.preview_y_offset ?? 0;
                  for (const { img } of loaded) {
                    if (!img) continue;
                    context.drawImage(
                      img,
                      column * FRAME_SIZE + xOffset,
                      row * FRAME_SIZE + yOffset,
                      FRAME_SIZE,
                      FRAME_SIZE,
                      0,
                      0,
                      currentSize,
                      currentSize,
                    );
                  }
                };
                draw(size);
                return { redraw: draw, imagesLoaded: loaded.length };
              },
            };
          })
        : [],
    };
  },
};
