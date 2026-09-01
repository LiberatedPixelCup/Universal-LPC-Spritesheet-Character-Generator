import { downloadFile } from "../canvas/download.ts";
import type { CatalogReader } from "../state/catalog.ts";
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
  | { readonly kind: "empty" }
  | {
      readonly kind: "ready";
      readonly credits: readonly CreditRowModel[];
      downloadTxt(): void;
      downloadCsv(): void;
    };

export const creditsModelFactory = {
  create(catalog: CatalogReader, state: State): CreditsModel {
    if (!state.previewBootstrapRenderDone) return { kind: "loading" };

    const credits = getAllCredits(
      catalog,
      state.selections,
      state.bodyType,
      state.selectedAnimation,
    );
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
      downloadTxt: () => downloadFile(creditsToTxt(credits), "credits.txt"),
      downloadCsv: () => downloadFile(creditsToCsv(credits), "credits.csv"),
    };
  },
};
