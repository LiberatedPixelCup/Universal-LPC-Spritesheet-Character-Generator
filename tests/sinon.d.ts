declare module "sinon" {
  export type SinonSpy = {
    called: boolean;
    calledOnce: boolean;
    callCount: number;
    args: unknown[][];
    firstCall: { args: unknown[]; returnValue: unknown };
    restore: () => void;
    callsFake: (fn: (...args: never[]) => unknown) => SinonSpy;
    returns: (value: unknown) => SinonSpy;
    throws: (error: Error) => SinonSpy;
  };

  export type SinonSandbox = {
    stub: {
      (obj: object, method: string): SinonSpy;
      (): SinonSpy;
    };
    spy: {
      (obj: object, method: string): SinonSpy;
      (): SinonSpy;
    };
    restore: () => void;
  };

  const sinon: {
    createSandbox: () => SinonSandbox;
    stub: SinonSandbox["stub"];
    spy: SinonSandbox["spy"];
    restore: () => void;
  };

  export default sinon;
  export { type SinonSandbox, type SinonSpy };
}
