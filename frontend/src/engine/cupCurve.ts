export interface Point2D {
  x: number
  y: number
}

/** Catmull-Rom 样条，用于 2D 杯型轮廓平滑 */
export function catmullRomSpline(points: Point2D[], samples: number): Point2D[] {
  if (points.length < 2) return points
  if (points.length === 2) {
    const out: Point2D[] = []
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1)
      out.push({
        x: points[0].x + (points[1].x - points[0].x) * t,
        y: points[0].y + (points[1].y - points[0].y) * t,
      })
    }
    return out
  }

  const result: Point2D[] = []
  const n = points.length
  const segs = samples / (n - 1)

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(n - 1, i + 2)]
    const count = i === n - 2 ? Math.ceil(segs) : Math.floor(segs)

    for (let j = 0; j < count; j++) {
      const t = j / segs
      const t2 = t * t
      const t3 = t2 * t
      result.push({
        x: 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        ),
        y: 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        ),
      })
    }
  }
  result.push(points[n - 1])
  return result.slice(0, samples)
}

export function scaleControlPoints(
  points: Point2D[],
  cupHeight: number,
  baseHeight: number,
  topY = 80,
): Point2D[] {
  const scale = cupHeight / baseHeight
  return points.map((p) => ({
    x: p.x,
    y: topY + (p.y - topY) * scale,
  }))
}
