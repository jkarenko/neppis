// The boot screen lives in index.html and paints before this bundle runs; this is the module's side of it.
interface BootApi {
  step(name: string, frac: number): void;
  ready(cb: () => void): void;
  fail(msg: string): void;
  dismiss(): void;
}

const api = (): BootApi | undefined => (window as unknown as { __boot?: BootApi }).__boot;

export const boot = {
  step: (name: string, frac: number): void => api()?.step(name, frac),
  /** Loading is done: show "Tap to play" and call back when the player taps or presses a key. */
  ready: (cb: () => void): void => (api() ? api()!.ready(cb) : cb()),
  fail: (msg: string): void => api()?.fail(msg),
  /** Headless runs skip the title. */
  dismiss: (): void => api()?.dismiss(),
};
