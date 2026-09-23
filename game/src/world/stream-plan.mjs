/** Replacements keep old geometry/collision alive until their new chunk is ready. */
export function planStreaming(loaded, needed, detail) {
  const keep = new Set(needed.map(cell => cell.key));
  return {
    remove: [...loaded.keys()].filter(key => !keep.has(key)),
    pending: needed.filter(cell => !loaded.has(cell.key) || loaded.get(cell.key).detail !== detail),
  };
}
