/** A small counting semaphore: at most `max` tasks run at once, the rest wait in FIFO order. */
export class Limiter {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(readonly max: number) {
    if (!Number.isInteger(max) || max < 1) throw new RangeError("Limiter max must be a positive integer");
  }

  get inFlight(): number {
    return this.active;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else {
      this.active += 1;
    }
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next(); // hand the slot straight to the next waiter: active stays constant
      else this.active -= 1;
    }
  }
}
