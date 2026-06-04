import {
  customAnimationBase,
  customAnimations,
  type CustomAnimationDefinition,
} from "../custom-animations.ts";
import { LICENSE_CONFIG, ANIMATIONS } from "./constants.ts";
import type { CatalogReader } from "./catalog.ts";
import { state } from "./state.ts";

/**
 * Narrow shapes consumed inside `filters.ts`. Both are structural subsets of
 * `LICENSE_CONFIG[number]` / `ANIMATIONS[number]` from `constants.ts`, so
 * production assignments work; tests can stub with partial fixtures (e.g.
 * `{ value: "walk" }`) without filling unused fields.
 */
export type LicenseEntry = { key: string; versions: string[] };
export type AnimationEntry = {
  value: string;
  folderName?: string;
};

type FiltersDeps = {
  animations: AnimationEntry[];
  licenseConfig: LicenseEntry[];
  state: typeof state;
  customAnimations: Record<string, CustomAnimationDefinition>;
  customAnimationBase: (custAnim: CustomAnimationDefinition) => string;
};

const deps: FiltersDeps = {
  animations: ANIMATIONS,
  licenseConfig: LICENSE_CONFIG,
  state,
  customAnimations,
  customAnimationBase,
};

export function getLicenseConfig(): LicenseEntry[] {
  return deps.licenseConfig;
}

export function setLicenseConfig(config: LicenseEntry[]): void {
  deps.licenseConfig = config;
}

export function setAnimations(anims: AnimationEntry[]): void {
  deps.animations = anims;
}

export function getAnimations(): AnimationEntry[] {
  return deps.animations;
}

export function getState(): typeof state {
  return deps.state;
}

export function updateState(updates: Partial<typeof state>): void {
  Object.assign(deps.state, updates);
}

export function resetState(): void {
  deps.state.bodyType = "male";
  deps.state.selections = {};
  deps.state.enabledLicenses = {};
  deps.state.enabledAnimations = {};
}

export function getCustomAnimationBase(
  custAnim: CustomAnimationDefinition,
): string {
  return deps.customAnimationBase(custAnim);
}

export function setCustomAnimationBase(
  func: (custAnim: CustomAnimationDefinition) => string,
): void {
  deps.customAnimationBase = func;
}

export function getCustomAnimations(): Record<
  string,
  CustomAnimationDefinition
> {
  return deps.customAnimations;
}

export function setCustomAnimations(
  anims: Record<string, CustomAnimationDefinition>,
): void {
  deps.customAnimations = anims;
}

export function getEnabledLicenses(): Record<string, boolean> {
  return deps.state.enabledLicenses;
}

export function setEnabledLicenses(enabledLicenses: string[]): void {
  updateState({
    enabledLicenses: Object.fromEntries(
      enabledLicenses.map((key) => [key, true]),
    ),
  });
}

export function getEnabledAnimations(): Record<string, boolean> {
  return deps.state.enabledAnimations;
}

export function setEnabledAnimations(enabledAnimations: string[]): void {
  updateState({
    enabledAnimations: Object.fromEntries(
      enabledAnimations.map((key) => [key, true]),
    ),
  });
}

/** Expand the enabled license keys into a flat list of allowed version strings. */
export function getAllowedLicenses(): string[] {
  const allowed: string[] = [];
  for (const license of getLicenseConfig()) {
    if (getEnabledLicenses()[license.key]) {
      allowed.push(...license.versions);
    }
  }
  return allowed;
}

/** Whether an item's credits include at least one license that's currently enabled. */
export function isItemLicenseCompatible(
  itemId: string,
  catalog: Pick<CatalogReader, "getItemMerged">,
): boolean {
  const result = catalog.getItemMerged(itemId);
  if (result.isErr()) return true; // chunk loading or unknown id — assume compatible
  const meta = result.value;
  if (meta.credits.length === 0) return true; // No license info = assume compatible

  const allowedLicenses = getAllowedLicenses();
  if (allowedLicenses.length === 0) return false; // No licenses selected = nothing compatible

  const allowedSet = new Set(allowedLicenses.map((l) => l.trim()));

  for (const credit of meta.credits) {
    if (credit.licenses.length > 0) {
      const hasCompatibleLicense = credit.licenses.some((license) =>
        allowedSet.has(license.trim()),
      );
      if (hasCompatibleLicense) return true;
    }
  }

  return false;
}

/** Whether an item supports at least one currently-enabled animation. */
export function isItemAnimationCompatible(
  itemId: string,
  catalog: Pick<CatalogReader, "getItemLite">,
): boolean {
  const meta = catalog.getItemLite(itemId).unwrapOr(null);
  if (!meta) return true; // unknown item — assume compatible
  return isNodeAnimationCompatible(meta);
}

/** Whether a tree node (or item) supports at least one enabled animation. */
export function isNodeAnimationCompatible(node: {
  animations?: string[];
}): boolean {
  const enabledAnims = getAnimations()
    .filter((anim) => getEnabledAnimations()[anim.value])
    .map((anim) => anim.value);

  if (enabledAnims.length === 0) return true;

  if (!node.animations || node.animations.length === 0) return true;

  for (const itemAnim of node.animations) {
    if (enabledAnims.includes(itemAnim)) return true;

    const customAnim = getCustomAnimations()[itemAnim];
    if (!customAnim) continue;
    const baseItemAnim = getCustomAnimationBase(customAnim);
    if (baseItemAnim && enabledAnims.includes(baseItemAnim)) return true;
  }

  return false;
}
