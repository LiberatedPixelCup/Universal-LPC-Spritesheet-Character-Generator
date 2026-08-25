import type { CatalogReader } from "../state/catalog.ts";
import type { State } from "../state/state.ts";
import {
  currentSelectionsModelFactory,
  type CurrentSelectionsModel,
} from "./current-selections.ts";

export type ApplicationModels = {
  createCurrentSelectionsModel(): CurrentSelectionsModel;
};

/** Builds the render-ready model graph at the application composition root. */
export function createApplicationModels(
  catalog: CatalogReader,
  state: State,
): ApplicationModels {
  return {
    createCurrentSelectionsModel: () =>
      currentSelectionsModelFactory.create(catalog, state),
  };
}
