/** Reference counts follow owners (chunks), not the number of frames an asset is visible. */
export class ResourceCache {
  #keys = new Map();
  #values = new Map();
  constructor(dispose) { this.disposeResource = dispose; }
  acquire(key, factory) {
    const cached = this.#keys.get(key);
    if (cached) { cached.references++; return cached.value; }
    const value = factory();
    if (this.#values.has(value)) throw new Error('One resource cannot be registered under two cache keys.');
    const entry = { key, value, references: 1 };
    this.#keys.set(key, entry); this.#values.set(value, entry);
    return value;
  }
  release(value) {
    const entry = this.#values.get(value);
    if (!entry) return false;
    if (--entry.references === 0) {
      this.#keys.delete(entry.key); this.#values.delete(value); this.disposeResource(value);
    }
    return true;
  }
  get size() { return this.#keys.size; }
  clear() {
    const values = [...this.#values.keys()]; this.#keys.clear(); this.#values.clear();
    for (const value of values) this.disposeResource(value);
  }
}
