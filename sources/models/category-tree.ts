import type {
  CatalogReader,
  CategoryTreeNode,
  ItemMerged,
} from "../state/catalog.ts";
import {
  applyMatchBodyColor,
  getSelectionGroup,
  resetAll,
  type State,
} from "../state/state.ts";
import {
  isItemAnimationCompatible,
  isItemLicenseCompatible,
  isNodeAnimationCompatible,
} from "../state/filters.ts";
import { BODY_TYPES } from "../state/constants.ts";
import { capitalize, matchesSearch, nodeHasMatches } from "../utils/helpers.ts";
import {
  itemWithVariantsModelFactory,
  type ItemWithVariantsModel,
} from "./item-with-variants.ts";
import {
  itemWithRecolorsModelFactory,
  type ItemWithRecolorsModel,
} from "./item-with-recolors.ts";

export type BodyTypeSelectorModel = {
  readonly selected: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  select(value: string): void;
};

type ModelProvider<T> = {
  readonly key: string;
  readonly createModel: () => T;
};

type TreeNodeShape = CategoryTreeNode & {
  required?: string[];
  animations?: string[];
  label?: string;
};

export type TreeItemModel =
  | {
      readonly kind: "skeleton";
      readonly key: string;
    }
  | {
      readonly kind: "simple";
      readonly key: string;
      readonly name: string;
      readonly isSearchMatch: boolean;
      readonly isCompatible: boolean;
      readonly isSelected: boolean;
      readonly tooltip?: string;
      select(): void;
    }
  | {
      readonly kind: "variants";
      readonly key: string;
      readonly createModel: () => ItemWithVariantsModel;
    }
  | {
      readonly kind: "recolors";
      readonly key: string;
      readonly createModel: () => ItemWithRecolorsModel;
    };

export type TreeNodeModel = {
  readonly name: string;
  readonly title?: string;
  readonly isCompatible: boolean;
  readonly isExpanded: boolean;
  readonly children: readonly ModelProvider<TreeNodeModel | null>[];
  readonly items: readonly TreeItemModel[];
  toggle(): void;
};

export type CategoryTreeModel =
  | { readonly isLoading: true }
  | {
      readonly isLoading: false;
      readonly liteReady: boolean;
      readonly compactDisplay: boolean;
      readonly matchBodyColorEnabled: boolean;
      readonly bodyTypes: BodyTypeSelectorModel;
      readonly roots: readonly ModelProvider<TreeNodeModel | null>[];
      reset(): void;
      collapseAll(): void;
      expandSelected(): void;
      toggleCompactDisplay(): void;
      setMatchBodyColor(enabled: boolean): void;
    };

function itemTooltip(
  catalog: CatalogReader,
  itemId: string,
  meta: ItemMerged,
  isLicenseCompatible: boolean,
  isAnimationCompatible: boolean,
): string {
  let licensesText = "License info loading…";
  if (catalog.isCreditsReady()) {
    const licenses = new Set<string>();
    for (const credit of catalog.getItemCredits(itemId).unwrapOr([])) {
      for (const license of credit.licenses) licenses.add(license.trim());
    }
    licensesText =
      licenses.size > 0
        ? `Licenses: ${Array.from(licenses).join(", ")}`
        : "No license info";
  }

  const animationsText = meta.animations?.length
    ? `Animations: ${meta.animations.join(", ")}`
    : "No animation info";
  const issues = [
    !isLicenseCompatible ? "licenses" : null,
    !isAnimationCompatible ? "animations" : null,
  ].filter(Boolean);
  const warning = issues.length
    ? `⚠️ Incompatible with selected ${issues.join(" and ")}\n`
    : "";
  return `${warning}${licensesText}\n${animationsText}`;
}

function createItemModel(
  catalog: CatalogReader,
  state: State,
  itemId: string,
  meta: ItemMerged,
  nodeCompatible: boolean,
  searchQuery: string,
): TreeItemModel {
  const licenseCompatible = isItemLicenseCompatible(catalog, state, itemId);
  const animationCompatible =
    isItemAnimationCompatible(catalog, state, itemId) && nodeCompatible;
  const isCompatible = licenseCompatible && animationCompatible;
  const tooltip = itemTooltip(
    catalog,
    itemId,
    meta,
    licenseCompatible,
    animationCompatible,
  );
  const isSearchMatch =
    searchQuery.length >= 2 && matchesSearch(meta.name, searchQuery);
  const showTooltip = catalog.isCreditsReady();

  if (meta.variants?.length) {
    return {
      kind: "variants",
      key: itemId,
      createModel: () =>
        itemWithVariantsModelFactory.create(
          catalog,
          state,
          itemId,
          meta,
          isSearchMatch,
          isCompatible,
          tooltip,
          showTooltip,
        ),
    };
  }
  if (meta.recolors?.length) {
    return {
      kind: "recolors",
      key: itemId,
      createModel: () =>
        itemWithRecolorsModelFactory.create(
          catalog,
          state,
          itemId,
          meta,
          isSearchMatch,
          isCompatible,
          tooltip,
          showTooltip,
        ),
    };
  }

  const selectionGroup = getSelectionGroup(itemId);
  const isSelected = state.selections[selectionGroup]?.itemId === itemId;
  return {
    kind: "simple",
    key: itemId,
    name: meta.name,
    isSearchMatch,
    isCompatible,
    isSelected,
    tooltip: showTooltip ? tooltip : undefined,
    select: () => {
      if (!isCompatible) return;
      if (isSelected) delete state.selections[selectionGroup];
      else state.selections[selectionGroup] = { itemId, name: meta.name };
    },
  };
}

function createTreeNodeModel(
  catalog: CatalogReader,
  state: State,
  name: string,
  node: TreeNodeShape,
  pathPrefix = "",
): TreeNodeModel | null {
  const nodePath = pathPrefix ? `${pathPrefix}-${name}` : name;
  const searchQuery = state.searchQuery;
  const hasSearchMatches = nodeHasMatches(node, searchQuery, catalog);
  const isCompatible = isNodeAnimationCompatible(node, state);
  if (node.required?.length && !node.required.includes(state.bodyType)) {
    return null;
  }
  if (searchQuery.length >= 2 && !hasSearchMatches) return null;

  const isExpanded =
    (searchQuery.length >= 2 && hasSearchMatches) ||
    state.expandedNodes[nodePath] ||
    false;
  const animationText = node.animations?.length
    ? `Animations: ${node.animations.join(", ")}`
    : "null";
  const title = catalog.isLiteReady()
    ? `${isCompatible ? "" : "⚠️ Incompatible with selected animations\n"}${animationText}`
    : undefined;
  const children = isExpanded
    ? Object.entries(node.children ?? {}).map(([childName, childNode]) => ({
        key: childName,
        createModel: () =>
          createTreeNodeModel(catalog, state, childName, childNode, nodePath),
      }))
    : [];

  let items: TreeItemModel[] = [];
  if (isExpanded && !catalog.isLiteReady()) {
    items = (node.items ?? []).map((key) => ({ kind: "skeleton", key }));
  } else if (isExpanded) {
    for (const itemId of node.items ?? []) {
      const lite = catalog.getItemLite(itemId).unwrapOr(null);
      if (!lite || !lite.required.includes(state.bodyType)) continue;
      if (!isItemAnimationCompatible(catalog, state, itemId) || !isCompatible)
        continue;
      if (searchQuery.length >= 2 && !matchesSearch(lite.name, searchQuery))
        continue;
      const meta = catalog.getItemMerged(itemId).unwrapOr(null);
      if (meta)
        items.push(
          createItemModel(
            catalog,
            state,
            itemId,
            meta,
            isCompatible,
            searchQuery,
          ),
        );
    }
  }

  return {
    name: node.label ?? capitalize(name),
    title,
    isCompatible,
    isExpanded,
    children,
    items,
    toggle: () => {
      if (isCompatible) state.expandedNodes[nodePath] = !isExpanded;
    },
  };
}

export const treeNodeModelFactory = {
  create: createTreeNodeModel,
};

export const categoryTreeModelFactory = {
  create(catalog: CatalogReader, state: State): CategoryTreeModel {
    const tree = catalog.getCategoryTree().unwrapOr(null);
    if (!tree) return { isLoading: true };

    return {
      isLoading: false,
      liteReady: catalog.isLiteReady(),
      compactDisplay: state.compactDisplay,
      matchBodyColorEnabled: state.matchBodyColorEnabled,
      bodyTypes: {
        selected: state.bodyType,
        options: BODY_TYPES.map((value) => ({
          value,
          label: capitalize(value),
        })),
        select: (value) => {
          state.bodyType = value;
        },
      },
      roots: Object.entries(tree.children ?? {}).map(([name, node]) => ({
        key: name,
        createModel: () =>
          treeNodeModelFactory.create(catalog, state, name, node),
      })),
      reset: () => resetAll(state),
      collapseAll: () => {
        state.expandedNodes = {};
      },
      expandSelected: () => {
        if (!catalog.isLiteReady()) return;
        for (const selection of Object.values(state.selections)) {
          const meta = catalog.getItemMerged(selection.itemId).unwrapOr(null);
          if (!meta) continue;
          let path = "";
          for (const segment of meta.path) {
            path = path ? `${path}-${segment}` : segment;
            state.expandedNodes[path] = true;
          }
          state.expandedNodes[selection.itemId] = true;
        }
      },
      toggleCompactDisplay: () => {
        state.compactDisplay = !state.compactDisplay;
      },
      setMatchBodyColor: (enabled) => {
        state.matchBodyColorEnabled = enabled;
        if (!enabled) return;
        const body = state.selections[getSelectionGroup("body-body")];
        if (body?.variant) {
          applyMatchBodyColor(
            state,
            body.variant,
            body.recolor ?? body.variant,
          );
        }
      },
    };
  },
};
