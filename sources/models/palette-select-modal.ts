import type {
  CatalogReader,
  ItemMerged,
  PaletteMetadata,
} from "../state/catalog.ts";
import { drawRecolorPreview } from "../canvas/palette-recolor.ts";
import { COMPACT_FRAME_SIZE, FRAME_SIZE } from "../state/constants.ts";
import {
  compilePaletteKey,
  CUSTOM_KEY,
  CUSTOM_VERSION,
  type PaletteOption,
} from "../state/palettes.ts";
import { getSelectionGroup, type State } from "../state/state.ts";
import { ucwords } from "../utils/helpers.ts";

export type PaletteTileModel = {
  readonly key: string;
  readonly label: string;
  readonly colors: readonly string[];
  readonly isSelected: boolean;
  select(): void;
  draw(canvas: HTMLCanvasElement, isCancelled: () => boolean): Promise<number>;
};

export type PaletteVersionModel = {
  readonly key: string;
  readonly label: string;
  readonly isSource: boolean;
  readonly isExpanded: boolean;
  readonly tiles: readonly PaletteTileModel[];
  toggle(): void;
};

export type PaletteSelectModalModel =
  | { readonly loadingMessage: string }
  | {
      readonly title: string;
      readonly size: number;
      readonly compactDisplay: boolean;
      readonly previewCount: number;
      readonly versions: readonly PaletteVersionModel[];
    };

function createReadyModel(
  catalog: CatalogReader,
  state: State,
  itemId: string,
  item: ItemMerged,
  option: PaletteOption,
  selectedColors: Record<string, string>,
  compactDisplay: boolean,
  select: (recolor: string) => void,
  palette: PaletteMetadata,
): PaletteSelectModalModel {
  const firstPath = `${itemId}-${option.idx}-${option.versions[0]}`;
  if (state.expandedNodes[firstPath] === undefined) {
    state.expandedNodes[firstPath] = true;
  }
  const selectionGroup = option.type_name ?? getSelectionGroup(itemId);
  const selection = state.selections[selectionGroup];
  const activeRecolor = selection?.recolor ?? selectedColors[selectionGroup];
  const versions = option.versions.map((category) => {
    const [material, version] = category.split(".");
    const path = `${itemId}-${option.idx}-${category}`;
    const versionMeta = palette.versions?.[version];
    const materialMeta = palette.materials[material];
    const isExpanded = state.expandedNodes[path] || false;
    let recolors = materialMeta?.palettes?.[version] ?? {};
    if (version === CUSTOM_VERSION && option.sourceColors?.length) {
      recolors = { [CUSTOM_KEY]: option.sourceColors };
    }
    const tiles = isExpanded
      ? Object.entries(recolors).map(([paletteName, colors]) => {
          const key = compilePaletteKey(material, version, paletteName, option);
          const itemColors = { ...selectedColors, [selectionGroup]: key };
          return {
            key,
            label: ucwords(paletteName.replaceAll("_", " ")),
            colors: colors.slice().reverse(),
            isSelected:
              (selection?.itemId === itemId ||
                selectionGroup === option.type_name) &&
              activeRecolor === key,
            select: () => select(key),
            draw: (canvas: HTMLCanvasElement, isCancelled: () => boolean) =>
              drawRecolorPreview(
                catalog,
                state,
                itemId,
                item,
                canvas,
                itemColors,
                isCancelled,
              ),
          };
        })
      : [];
    return {
      key: path,
      label:
        (versionMeta?.label ?? "") +
        (material !== option.material ? ` - ${materialMeta?.label}` : ""),
      isSource: version === CUSTOM_VERSION,
      isExpanded,
      tiles,
      toggle: () => {
        state.expandedNodes[path] = !isExpanded;
      },
    };
  });
  return {
    title: option.label ?? "",
    size: compactDisplay ? COMPACT_FRAME_SIZE : FRAME_SIZE,
    compactDisplay,
    previewCount: versions.reduce(
      (total, version) => total + version.tiles.length,
      0,
    ),
    versions,
  };
}

export const paletteSelectModalModelFactory = {
  create(
    catalog: CatalogReader,
    state: State,
    itemId: string,
    option: PaletteOption,
    selectedColors: Record<string, string>,
    compactDisplay: boolean,
    select: (recolor: string) => void,
  ): PaletteSelectModalModel {
    if (!catalog.isPaletteReady()) {
      return { loadingMessage: "Loading palette data…" };
    }
    if (!catalog.isLiteReady() || !catalog.isLayersReady()) {
      return { loadingMessage: "Loading layer data…" };
    }
    const palette = catalog.getPaletteMetadata().unwrapOr(null);
    const item = catalog.getItemMerged(itemId).unwrapOr(null);
    if (!palette) return { loadingMessage: "Loading palette data…" };
    if (!item) return { loadingMessage: "Loading layer data…" };
    return createReadyModel(
      catalog,
      state,
      itemId,
      item,
      option,
      selectedColors,
      compactDisplay,
      select,
      palette,
    );
  },
};
