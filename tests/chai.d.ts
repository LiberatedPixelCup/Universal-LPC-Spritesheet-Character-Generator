declare module "chai" {
  type Assertion = {
    equal: (expected: unknown) => void;
    include: (expected: unknown) => void;
    instanceOf: (ctor: unknown) => void;
    a: (type: string) => void;
    true: boolean;
    false: boolean;
    exist: boolean;
    at: { least: (n: number) => void };
    match: (pattern: RegExp) => void;
  };

  export const expect: (actual: unknown) => {
    to: Assertion & {
      deep: {
        include: (expected: unknown) => void;
        equal: (expected: unknown) => void;
      };
      be: Assertion;
      not: Assertion & { be: Assertion; equal: (expected: unknown) => void };
    };
  };
}
