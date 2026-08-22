/** Vite alias target is `tests/bdd-globals.js` (untyped globals). */
declare module "mocha-globals" {
  type Done = (err?: unknown) => void;
  type Func = (this: { skip: () => void }, done?: Done) => void;
  type AsyncFunc = (this: { skip: () => void }) => PromiseLike<unknown>;

  export function describe(
    title: string,
    fn: (this: { timeout: (ms: number) => void }) => void,
  ): void;
  export function it(title: string, fn?: Func | AsyncFunc): void;
  export function before(fn: Func | AsyncFunc): void;
  export function after(fn: Func | AsyncFunc): void;
  export function beforeEach(fn: Func | AsyncFunc): void;
  export function afterEach(fn: Func | AsyncFunc): void;
}
