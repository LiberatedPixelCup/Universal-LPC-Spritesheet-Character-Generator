// Recursive tree node component
import m from "mithril";
import { state, getSelectionGroup } from "../../state/state.ts";
import { isCreditsReady, isLiteReady } from "../../state/catalog.ts";
import {
  chunkReady,
  getItemCredits,
  getItemLite,
  getItemMerged,
} from "../../state/catalog.ts";
import { ResultBoundary } from "../ResultBoundary.js";
import {
  isItemLicenseCompatible,
  isItemAnimationCompatible,
  isNodeAnimationCompatible,
} from "../../state/filters.js";
import {
  capitalize,
  matchesSearch,
  nodeHasMatches,
} from "../../utils/helpers.ts";
import { ItemWithVariants } from "./ItemWithVariants.js";
import { ItemWithRecolors } from "./ItemWithRecolors.js";

function renderSkeletons(itemIds) {
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

function renderItem(itemId, meta, ctx) {
  const { isNodeAnimCompatible, searchQuery } = ctx;
  const displayName = meta.name;
  const hasVariants = meta.variants && meta.variants.length > 0;
  const hasRecolors = !hasVariants && meta.recolors && meta.recolors.length > 0;
  const isSearchMatch =
    searchQuery &&
    searchQuery.length >= 2 &&
    matchesSearch(meta.name, searchQuery);

  const isLicenseCompatibleFlag = isItemLicenseCompatible(itemId);
  const isAnimCompatibleFlag =
    isItemAnimationCompatible(itemId) && isNodeAnimCompatible;
  const isCompatible = isLicenseCompatibleFlag && isAnimCompatibleFlag;

  // Build tooltip text (license list needs credits chunk)
  let licensesText;
  if (!isCreditsReady()) {
    licensesText = "License info loading…";
  } else {
    const allLicenses = new Set();
    const credits = getItemCredits(itemId).unwrapOr([]);
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
    const issues = [];
    if (!isLicenseCompatibleFlag) issues.push("licenses");
    if (!isAnimCompatibleFlag) issues.push("animations");
    tooltipText = `⚠️ Incompatible with selected ${issues.join(" and ")}\n`;
  }
  tooltipText += `${licensesText}\n${animsText}`;

  const showItemTooltips = isCreditsReady();

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

function renderItemList(itemIds, ctx) {
  const { isNodeAnimCompatible, searchQuery } = ctx;
  return itemIds
    .filter((itemId) => {
      const liteResult = getItemLite(itemId);
      if (liteResult.isErr()) return false; // unknown id (stale URL etc.)
      const lite = liteResult.value;
      // Filter: Only show items compatible with current body type
      if (!lite.required.includes(state.bodyType)) return false;
      if (!isItemAnimationCompatible(itemId) || !isNodeAnimCompatible)
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
      const mergedResult = getItemMerged(itemId);
      if (mergedResult.isErr()) return null; // unknown id
      return renderItem(itemId, mergedResult.value, ctx);
    });
}

export const TreeNode = {
  view: function (vnode) {
    const { name, node, pathPrefix = "" } = vnode.attrs;
    const nodePath = pathPrefix ? `${pathPrefix}-${name}` : name;
    const searchQuery = state.searchQuery;
    const hasSearchMatches = nodeHasMatches(node, searchQuery);
    const isNodeAnimCompatible = isNodeAnimationCompatible(node);

    // Filter: Only show items compatible with current body type
    if (
      node.required &&
      node.required.length > 0 &&
      !node.required.includes(state.bodyType)
    )
      return false;

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
      (searchQuery && searchQuery.length >= 2 && hasSearchMatches) ||
      state.expandedNodes[nodePath] ||
      false;
    const displayName = node.label ?? capitalize(name);

    const categoryTitle = isLiteReady() ? tooltipText : undefined;

    const itemIds = node.items ?? [];
    const itemListCtx = { isNodeAnimCompatible, searchQuery };

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
              }),
            ),
            // Render items in this category. Skeletons until lite registers,
            // then real items via .filter / .map using typed getters.
            m(ResultBoundary, {
              read: () => chunkReady("lite"),
              view: () => renderItemList(itemIds, itemListCtx),
              renderError: () => renderSkeletons(itemIds),
            }),
          ])
        : null,
    );
  },
};
