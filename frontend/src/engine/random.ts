export function seededRandom(seed: number): () => number {
  let state = Math.abs(seed) % 2147483646 || 1
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

/** 从 [0, length) 中无重复随机取 count 个下标 */
export function pickRandomIndices(length: number, count: number, seed: number): number[] {
  if (length <= 0 || count <= 0) return []
  const n = Math.min(count, length)
  const indices = Array.from({ length }, (_, i) => i)
  const rand = seededRandom(seed)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rand() * (length - i))
    const tmp = indices[i]
    indices[i] = indices[j]
    indices[j] = tmp
  }
  return indices.slice(0, n)
}
