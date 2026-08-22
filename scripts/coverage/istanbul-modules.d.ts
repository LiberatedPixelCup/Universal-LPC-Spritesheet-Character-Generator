declare module "istanbul-lib-report" {
  import type { CoverageMap } from "istanbul-lib-coverage";

  export function createContext(opts: {
    dir: string;
    coverageMap: CoverageMap;
    defaultSummarizer: string;
  }): unknown;
}

declare module "istanbul-reports" {
  export function create(
    name: string,
    opts?: { file?: string },
  ): { execute: (context: unknown) => void };
}
