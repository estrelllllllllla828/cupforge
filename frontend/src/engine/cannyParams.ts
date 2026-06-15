export interface CannyRanges {
  t1: [number, number]
  t2: [number, number]
}

/** 统一线条指标 → Canny 双阈值 */
export function lineDetailToThresholds(detail: number, ranges: CannyRanges): { t1: number; t2: number } {
  const t = Math.max(0, Math.min(100, detail)) / 100
  const t1 = Math.round(ranges.t1[0] + t * (ranges.t1[1] - ranges.t1[0]))
  let t2 = Math.round(ranges.t2[0] + t * (ranges.t2[1] - ranges.t2[0]))
  t2 = Math.max(t2, t1 * 2 + 1)
  return { t1, t2: Math.min(t2, ranges.t2[1]) }
}

/** Canny 双阈值 → 统一线条指标（用于初始化） */
export function thresholdsToLineDetail(t1: number, t2: number, ranges: CannyRanges): number {
  const t1Span = ranges.t1[1] - ranges.t1[0]
  const t2Span = ranges.t2[1] - ranges.t2[0]
  const t1Norm = t1Span > 0 ? (t1 - ranges.t1[0]) / t1Span : 0
  const t2Norm = t2Span > 0 ? (t2 - ranges.t2[0]) / t2Span : 0
  return Math.round(((t1Norm + t2Norm) / 2) * 100)
}
