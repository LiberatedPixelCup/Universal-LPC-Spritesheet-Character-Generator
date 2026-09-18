import type { CatalogReader, ItemMerged } from "../state/catalog.ts";
import { drawRecolorPreview } from "../canvas/palette-recolor.ts";
import { getPaletteOptions, type PaletteOption } from "../state/palettes.ts";
import { getSelectionGroup, selectItem, type State } from "../state/state.ts";
import {
  paletteSelectModalModelFactory,
  type PaletteSelectModalModel,
} from "./palette-select-modal.ts";

export type ItemWithRecolorsModel = {
  readonly name: string;
  readonly isSearchMatch: boolean;
  readonly isCompatible: boolean;
  readonly tooltip?: string;
  readonly isExpanded: boolean;
  readonly isSelected: boolean;
  readonly paletteReady: boolean;
  readonly compactDisplay: boolean;
  readonly paletteOptions: readonly RecolorPaletteOptionModel[];
  readonly selectedColors: Record<string, string>;
  toggle(): void;
  drawPreview(
    canvas: HTMLCanvasElement,
    colors?: Record<string, string>,
    isCancelled?: () => boolean,
  ): Promise<number>;
};

export type RecolorPaletteOptionModel = {
  readonly label?: string;
  readonly colors?: string[] | null;
  prepareSelection(): void;
  readonly createModalModel: () => PaletteSelectModalModel;
};

function applyRememberedColors(
  state: State,
  itemId: string,
  meta: ItemMerged,
  options: readonly PaletteOption[],
  selectedColors: Record<string, string>,
  isSelected: boolean,
  isCompatible: boolean,
): void {
  if (isSelected || !isCompatible) return;
  if (!state.selections[getSelectionGroup(itemId)]) return;

  for (let index = 0; index < options.length; index++) {
    const option = options[index];
    const group =
      index === 0 ? meta.type_name : (option.type_name ?? meta.type_name);
    const mapped = selectedColors[group];
    const recolor =
      mapped ?? (index === 0 ? meta.recolors[0]?.variants?.[0] : undefined);
    if (recolor) {
      selectItem(
        state,
        itemId,
        recolor,
        false,
        option.type_name ? index : null,
      );
    }
  }
}

export const itemWithRecolorsModelFactory = {
  create(
    catalog: CatalogReader,
    state: State,
    itemId: string,
    meta: ItemMerged,
    isSearchMatch: boolean,
    isCompatible: boolean,
    tooltip: string,
    showTooltip: boolean,
  ): ItemWithRecolorsModel {
    const nodePath = meta.name === "Body Color" ? "body-body" : itemId;
    const isExpanded = state.expandedNodes[nodePath] || false;
    const group = getSelectionGroup(itemId);
    const selection = state.selections[group];
    const isSelected = selection?.itemId === itemId;
    const [paletteOptions, selectedColors] = isExpanded
      ? getPaletteOptions(catalog, state, itemId, meta)
      : [[], {}];
    const selectColor = (index: number, recolor: string) => {
      const option = paletteOptions[index];
      const subGroup =
        option.type_name !== meta.type_name ? option.type_name : null;
      selectItem(
        state,
        itemId,
        recolor,
        isSelected && selectedColors[subGroup ?? meta.type_name] === recolor,
        option.type_name ? index : null,
      );
    };
    const optionModels = paletteOptions.map((option, index) => ({
      label: option.label,
      colors: option.colors,
      prepareSelection: () => {
        applyRememberedColors(
          state,
          itemId,
          meta,
          paletteOptions,
          selectedColors,
          isSelected,
          isCompatible,
        );
      },
      createModalModel: () =>
        paletteSelectModalModelFactory.create(
          catalog,
          state,
          itemId,
          option,
          selectedColors,
          state.compactDisplay,
          (recolor) => selectColor(index, recolor),
        ),
    }));

    return {
      name: meta.name,
      isSearchMatch,
      isCompatible,
      tooltip: showTooltip ? tooltip : undefined,
      isExpanded,
      isSelected,
      paletteReady: catalog.isPaletteReady(),
      compactDisplay: state.compactDisplay,
      paletteOptions: optionModels,
      selectedColors,
      toggle: () => {
        state.expandedNodes[nodePath] = !state.expandedNodes[nodePath];
      },
      drawPreview: (canvas, colors = selectedColors, isCancelled) =>
        drawRecolorPreview(
          catalog,
          state,
          itemId,
          meta,
          canvas,
          colors,
          isCancelled,
        ),
    };
  },
};
