declare module "chai" {
  type Assertion = {
    equal: (expected: unknown) => void;
    include: ((expected: unknown) => Assertion) & {
      keys: (...keys: string[]) => void;
    };
    instanceOf: (ctor: unknown) => void;
    a: (type: string) => Assertion;
    true: boolean;
    false: boolean;
    exist: boolean;
    null: boolean;
    at: { least: (n: number) => void };
    match: (pattern: RegExp) => void;
    length: (n: number) => void;
    property: (name: string) => Assertion;
    greaterThan: (n: number) => void;
  };

  export const expect: (actual: unknown) => {
    to: Assertion & {
      deep: {
        include: (expected: unknown) => void;
        equal: (expected: unknown) => void;
      };
      be: Assertion;
      not: Assertion & {
        be: Assertion;
        equal: (expected: unknown) => void;
        include: (expected: unknown) => void;
      };
      have: Assertion;
    };
  };
}
