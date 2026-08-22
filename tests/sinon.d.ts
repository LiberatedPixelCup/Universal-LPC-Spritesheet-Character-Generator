declare module "sinon" {
  export type SinonSandbox = {
    stub: (
      obj: object,
      method: string,
    ) => {
      callsFake: (fn: (...args: never[]) => unknown) => unknown;
    };
    restore: () => void;
  };

  const sinon: {
    createSandbox: () => SinonSandbox;
  };

  export default sinon;
  export { type SinonSandbox };
}
