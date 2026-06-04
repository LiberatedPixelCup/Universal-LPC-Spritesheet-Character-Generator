// Recursive tree node component
import m from "mithril";
import { state, getSelectionGroup } from "../../state/state.ts";
import type {
  CatalogReader,
  CategoryTreeNode,
  ItemMerged,
} from "../../state/catalog.ts";
import { renderResult } from "../../utils/render-result.ts";
import {
  isItemLicenseCompatible,
  isItemAnimationCompatible,
  isNodeAnimationCompatible,
} from "../../state/filters.ts";
import {
  capitalize,
  matchesSearch,
  nodeHasMatches,
} from "../../utils/helpers.ts";
import { ItemWithVariants } from "./ItemWithVariants.ts";
import { ItemWithRecolors } from "./ItemWithRecolors.ts";

// Forwarder: catalog flows to ItemWithRecolors → PaletteSelectModal. Full
// reader avoids enumerating the transitive union of downstream needs. The
// leaf (PaletteSelectModal) narrows.
export type TreeNodeAttrs = {
  name: string;
  node: CategoryTreeNode & {
    required?: string[];
    animations?: string[];
    label?: string;
  };
  pathPrefix?: string;
  catalog: CatalogReader;
};

type ItemListCtx = {
  isNodeAnimCompatible: boolean;
  searchQuery: string;
  catalog: CatalogReader;
};

function renderSkeletons(itemIds: string[]) {
  return itemIds.map((itemId) =>
    m(
      "div.skeleton-row",
      {
        key: `sk-${itemId}`,
        "aria-hidden": "true",
      },
      m("span.skeleton-row__bar.skeleton-row__bar--long"),
    ),
  );
}

function renderItem(itemId: string, meta: ItemMerged, ctx: ItemListCtx) {
  const { isNodeAnimCompatible, searchQuery, catalog } = ctx;
  const displayName = meta.name;
  const hasVariants = meta.variants && meta.variants.length > 0;
  const hasRecolors = !hasVariants && meta.recolors && meta.recolors.length > 0;
  const isSearchMatch =
    !!searchQuery &&
    searchQuery.length >= 2 &&
    matchesSearch(meta.name, searchQuery);

  const isLicenseCompatibleFlag = isItemLicenseCompatible(itemId, catalog);
  const isAnimCompatibleFlag =
    isItemAnimationCompatible(itemId, catalog) && isNodeAnimCompatible;
  const isCompatible = isLicenseCompatibleFlag && isAnimCompatibleFlag;

  // Build tooltip text (license list needs credits chunk)
  let licensesText: string;
  if (!catalog.isCreditsReady()) {
    licensesText = "License info loading…";
  } else {
    const allLicenses = new Set<string>();
    const credits = catalog.getItemCredits(itemId).unwrapOr([]);
    for (const credit of credits) {
      for (const lic of credit.licenses) {
        allLicenses.add(lic.trim());
      }
    }
    licensesText =
      allLicenses.size > 0
        ? `Licenses: ${Array.from(allLicenses).join(", ")}`
        : "No license info";
  }

  const supportedAnims = meta.animations || [];
  const animsText =
    supportedAnims.length > 0
      ? `Animations: ${supportedAnims.join(", ")}`
      : "No animation info";

  let tooltipText = "";
  if (!isCompatible) {
    const issues: string[] = [];
    if (!isLicenseCompatibleFlag) issues.push("licenses");
    if (!isAnimCompatibleFlag) issues.push("animations");
    tooltipText = `⚠️ Incompatible with selected ${issues.join(" and ")}\n`;
  }
  tooltipText += `${licensesText}\n${animsText}`;

  const showItemTooltips = catalog.isCreditsReady();

  if (!hasVariants && !hasRecolors) {
    // Simple item with no variants or recolors
    const selectionGroup = getSelectionGroup(itemId);
    const isSelected = state.selections[selectionGroup]?.itemId === itemId;
    return m(
      "div.tree-node",
      {
        key: itemId,
        class: `${isSearchMatch ? "search-result" : ""} ${!isCompatible ? "has-text-grey" : ""}`,
        style: isSelected ? " font-weight: bold; color: #3273dc;" : "",
        title: showItemTooltips ? tooltipText : undefined,
        onclick: () => {
          if (!isCompatible) return; // Prevent selecting incompatible
          if (isSelected) {
            delete state.selections[selectionGroup];
          } else {
            state.selections[selectionGroup] = {
              itemId,
              name: displayName,
            };
          }
        },
      },
      [displayName, !isCompatible ? m("span.ml-1", "⚠️") : null],
    );
  }

  // Item with variants or recolors - create a sub-component
  if (hasRecolors) {
    return m(ItemWithRecolors, {
      key: itemId,
      itemId,
      meta,
      isSearchMatch,
      isCompatible,
      tooltipText,
      showItemTooltips,
      catalog,
    });
  }
  return m(ItemWithVariants, {
    key: itemId,
    itemId,
    meta,
    isSearchMatch,
    isCompatible,
    tooltipText,
    showItemTooltips,
  });
}

function renderItemList(itemIds: string[], ctx: ItemListCtx) {
  const { isNodeAnimCompatible, searchQuery, catalog } = ctx;
  return itemIds
    .filter((itemId) => {
      const liteResult = catalog.getItemLite(itemId);
      if (liteResult.isErr()) return false; // unknown id (stale URL etc.)
      const lite = liteResult.value;
      // Filter: Only show items compatible with current body type
      if (!lite.required.includes(state.bodyType)) return false;
      if (!isItemAnimationCompatible(itemId, catalog) || !isNodeAnimCompatible)
        return false;
      // Filter: Only show items matching search query
      if (
        searchQuery &&
        searchQuery.length >= 2 &&
        !matchesSearch(lite.name, searchQuery)
      ) {
        return false;
      }
      return true;
    })
    .map((itemId) => {
      const mergedResult = catalog.getItemMerged(itemId);
      if (mergedResult.isErr()) return null; // unknown id
      return renderItem(itemId, mergedResult.value, ctx);
    });
}

export const TreeNode: m.Component<TreeNodeAttrs> = {
  view(vnode) {
    const { name, node, pathPrefix = "", catalog } = vnode.attrs;
    const nodePath = pathPrefix ? `${pathPrefix}-${name}` : name;
    const searchQuery = state.searchQuery;
    const hasSearchMatches = nodeHasMatches(node, searchQuery, catalog);
    const isNodeAnimCompatible = isNodeAnimationCompatible(node);

    // Filter: Only show items compatible with current body type
    if (
      node.required &&
      node.required.length > 0 &&
      !node.required.includes(state.bodyType)
    )
      return null;

    // Hide this node if search is active and there are no matches
    if (searchQuery && searchQuery.length >= 2 && !hasSearchMatches) {
      return null;
    }

    // Get supported animations for this item
    const supportedAnims = node.animations || [];
    const animsText =
      supportedAnims.length > 0
        ? `Animations: ${supportedAnims.join(", ")}`
        : null;

    // Build tooltip text
    let tooltipText = "";
    if (!isNodeAnimCompatible) {
      tooltipText = `⚠️ Incompatible with selected animations\n`;
    }
    tooltipText += `${animsText}`;

    // Auto-expand if search is active and has matches
    const isExpanded =
      (!!searchQuery && searchQuery.length >= 2 && hasSearchMatches) ||
      state.expandedNodes[nodePath] ||
      false;
    const displayName = node.label ?? capitalize(name);

    const categoryTitle = catalog.isLiteReady() ? tooltipText : undefined;

    const itemIds = node.items ?? [];
    const itemListCtx: ItemListCtx = {
      isNodeAnimCompatible,
      searchQuery,
      catalog,
    };

    return m(
      "div",
      m(
        "div.tree-label",
        {
          class: `${!isNodeAnimCompatible ? "has-text-grey" : ""}`,
          title: categoryTitle,
          onclick: () => {
            if (!isNodeAnimCompatible) return; // Prevent selecting incompatible
            state.expandedNodes[nodePath] = !isExpanded;
          },
        },
        [
          m("span.tree-arrow", {
            class: isExpanded ? "expanded" : "collapsed",
          }),
          m("span", displayName),
          !isNodeAnimCompatible ? m("span.ml-1", "⚠️") : null,
        ],
      ),
      isExpanded
        ? m("div.ml-4", [
            // Render child categories
            Object.entries(node.children ?? {}).map(([childName, childNode]) =>
              m(TreeNode, {
                key: childName,
                name: childName,
                node: childNode,
                pathPrefix: nodePath,
                catalog,
              }),
            ),
            // Render items in this category. Skeletons until lite registers,
            // then real items via .filter / .map using typed getters.
            renderResult(
              catalog.chunkReady("lite"),
              () => renderItemList(itemIds, itemListCtx),
              () => renderSkeletons(itemIds),
            ),
          ])
        : null,
    );
  },
};
