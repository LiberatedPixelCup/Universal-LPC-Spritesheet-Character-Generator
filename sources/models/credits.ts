import { downloadFile } from "../canvas/download.ts";
import { getCatalogFailure, type CatalogReader } from "../state/catalog.ts";
import type { State } from "../state/state.ts";
import { creditsToCsv, creditsToTxt, getAllCredits } from "../utils/credits.ts";

export type CreditRowModel = {
  readonly key: string;
  readonly fileName: string;
  readonly notes?: string;
  readonly licenses: readonly string[];
  readonly authors: readonly string[];
};

export type CreditsModel =
  | { readonly kind: "loading" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "empty" }
  | {
      readonly kind: "ready";
      readonly credits: readonly CreditRowModel[];
      downloadTxt(): void;
      downloadCsv(): void;
    };

export const creditsModelFactory = {
  create(catalog: CatalogReader, state: State): CreditsModel {
    const failed = getCatalogFailure(
      catalog,
      "index",
      "lite",
      "layers",
      "credits",
    );
    if (failed) return { kind: "failed", message: failed };
    if (
      !state.previewBootstrapRenderDone ||
      !catalog.isCreditsReady() ||
      !catalog.isLayersReady()
    ) {
      return { kind: "loading" };
    }

    const getCurrentCredits = () =>
      getAllCredits(catalog, state.selections, state.bodyType);
    const credits = getCurrentCredits();
    if (credits.length === 0) return { kind: "empty" };

    return {
      kind: "ready",
      credits: credits.map((credit) => ({
        key: credit.file,
        fileName: credit.fileName,
        notes: credit.notes,
        licenses: credit.licenses,
        authors: credit.authors,
      })),
      downloadTxt: () =>
        downloadFile(creditsToTxt(getCurrentCredits()), "credits.txt"),
      downloadCsv: () =>
        downloadFile(
          creditsToCsv(getCurrentCredits()),
          "credits.csv",
          "text/csv",
        ),
    };
  },
};
