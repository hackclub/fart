export class RateLimit {
  #hits = new Map<string, { count: number; reset: number }>()
  readonly limit: number
  readonly windowMs: number

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  allow(key: string) {
    const now = Date.now()
    if (this.#hits.size > 10_000) for (const [k, v] of this.#hits) if (v.reset <= now) this.#hits.delete(k)
    const hit = this.#hits.get(key)
    if (!hit || hit.reset <= now) {
      this.#hits.set(key, { count: 1, reset: now + this.windowMs })
      return true
    }
    hit.count += 1
    return hit.count <= this.limit
  }
}
