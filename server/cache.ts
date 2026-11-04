interface Entry {
  value: unknown
  size: number
  expires: number
}

// A small in-memory LRU with expiry, capped by the rough JSON size of what it holds.
// Results that are null or undefined are never stored, so a failed lookup is retried.
export class Cache {
  #entries = new Map<string, Entry>()
  #pending = new Map<string, Promise<unknown>>()
  #bytes = 0
  readonly maxBytes: number

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes
  }

  get<T>(key: string): T | undefined {
    const entry = this.#entries.get(key)
    if (!entry) return undefined
    if (entry.expires <= Date.now()) {
      this.delete(key)
      return undefined
    }
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    return entry.value as T
  }

  set(key: string, value: unknown, ttlMs: number) {
    this.delete(key)
    if (value === null || value === undefined) return
    const size = JSON.stringify(value)?.length ?? 0
    if (size > this.maxBytes / 4) return
    this.#entries.set(key, { value, size, expires: Date.now() + ttlMs })
    this.#bytes += size
    for (const [oldest] of this.#entries) {
      if (this.#bytes <= this.maxBytes) break
      this.delete(oldest)
    }
  }

  delete(key: string) {
    const entry = this.#entries.get(key)
    if (!entry) return
    this.#entries.delete(key)
    this.#bytes -= entry.size
  }

  async fetch<T>(key: string, ttlMs: number, load: () => Promise<T | null | undefined>): Promise<T | null> {
    const hit = this.get<T>(key)
    if (hit !== undefined) return hit
    const running = this.#pending.get(key)
    if (running) return (await running) as T | null
    const promise = load()
      .then((value) => {
        this.set(key, value, ttlMs)
        return value ?? null
      })
      .finally(() => this.#pending.delete(key))
    this.#pending.set(key, promise)
    return promise
  }
}
