declare module "chai" {
  export const expect: (actual: unknown) => {
    to: {
      equal: (expected: unknown) => void;
      deep: { include: (expected: unknown) => void };
      be: { instanceOf: (ctor: unknown) => void; a: (type: string) => void };
    };
  };
}
