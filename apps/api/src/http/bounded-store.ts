/**
 * Size-bounded key/value store for throttling state.
 *
 * - Every write advances a resumable sweep cursor over the whole map, removing a
 *   few expired entries per call, so stale keys are reclaimed without O(n) work
 *   on the hot path and no part of the map is skipped.
 * - When a new key arrives and the store is full, the cursor finishes a full
 *   pass; if every entry is still active, the entry with the least time left is
 *   evicted and `onEvict` is called (the caller logs a warning). New keys are
 *   never refused outright, so an attacker cannot lock everyone out by filling it.
 *
 * Internal mutation is confined to this class; callers only see get/set/delete.
 */
export interface BoundedStoreOptions<V> {
  readonly maxKeys: number;
  /** Instant after which the entry carries no information and may be swept. */
  readonly expiresAt: (value: V) => number;
  /** Remaining protective time; the smallest is evicted under pressure. */
  readonly timeLeft: (value: V, now: number) => number;
  readonly now: () => number;
  readonly onEvict?: (key: string) => void;
  readonly sweepBudget?: number;
}

export class BoundedStore<V> {
  private readonly entries = new Map<string, V>();
  private cursor: Iterator<[string, V]> | null = null;

  constructor(private readonly options: BoundedStoreOptions<V>) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    return this.entries.get(key);
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  set(key: string, value: V): void {
    this.sweep(this.options.sweepBudget ?? 32);
    if (!this.entries.has(key) && this.entries.size >= this.options.maxKeys) this.makeRoom();
    this.entries.set(key, value);
  }

  /** Examine up to `budget` entries from where the last sweep stopped. */
  private sweep(budget: number): void {
    const time = this.options.now();
    for (let examined = 0; examined < budget && this.entries.size > 0; examined += 1) {
      this.cursor ??= this.entries.entries();
      const next = this.cursor.next();
      if (next.done) {
        this.cursor = null;
        continue;
      }
      const [key, value] = next.value;
      if (this.options.expiresAt(value) <= time) this.entries.delete(key);
    }
  }

  private makeRoom(): void {
    this.cursor = null;
    this.sweep(this.entries.size + 1);
    if (this.entries.size < this.options.maxKeys) return;
    const time = this.options.now();
    let victim: string | null = null;
    let least = Infinity;
    for (const [key, value] of this.entries) {
      const left = this.options.timeLeft(value, time);
      if (left < least) {
        least = left;
        victim = key;
      }
    }
    if (victim !== null) {
      this.entries.delete(victim);
      this.options.onEvict?.(victim);
    }
  }
}
