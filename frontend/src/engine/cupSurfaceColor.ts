import * as THREE from 'three'
import type { GradientStop, ReliefDirection } from '../types'

export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.padEnd(6, '0').slice(0, 6), 16)
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** 按 position (0–100) 在多色标间插值采样 RGB */
export function sampleGradientStops(stops: GradientStop[], t: number): [number, number, number] {
  if (stops.length === 0) return [0.5, 0.5, 0.5]
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  if (sorted.length === 1) return hexToRgb01(sorted[0].color)

  const clampedT = Math.max(0, Math.min(1, t))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const t0 = first.position / 100
  const t1 = last.position / 100

  if (clampedT <= t0) return hexToRgb01(first.color)
  if (clampedT >= t1) return hexToRgb01(last.color)

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const pa = a.position / 100
    const pb = b.position / 100
    if (clampedT >= pa && clampedT <= pb) {
      const local = pb === pa ? 0 : (clampedT - pa) / (pb - pa)
      const [ar, ag, ab] = hexToRgb01(a.color)
      const [br, bg, bb] = hexToRgb01(b.color)
      return [
        ar + (br - ar) * local,
        ag + (bg - ag) * local,
        ab + (bb - ab) * local,
      ]
    }
  }
  return hexToRgb01(last.color)
}

export function gradientStopsToCss(stops: GradientStop[]): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  if (sorted.length === 0) return '#888'
  const parts = sorted.map((s) => `${s.color} ${s.position}%`)
  return `linear-gradient(to right, ${parts.join(', ')})`
}

export interface CupVertexGradientOptions {
  /** 仅外壁顶点使用渐变，内壁填纯色 */
  outerVertexCount?: number
  innerRgb?: [number, number, number]
}

/** 按 UV 纵向（杯底→杯口）为杯体顶点写入多色标渐变色 */
export function applyCupVertexGradient(
  geometry: THREE.BufferGeometry,
  uvs: Float32Array,
  stops: GradientStop[],
  options: CupVertexGradientOptions = {},
): void {
  const vertexCount = uvs.length / 2
  const [ir, ig, ib] = options.innerRgb ?? sampleGradientStops(stops, 0)
  const outerOnly = options.outerVertexCount ?? vertexCount
  const colors = new Float32Array(vertexCount * 3)

  for (let i = 0; i < vertexCount; i++) {
    if (i >= outerOnly) {
      colors[i * 3] = ir
      colors[i * 3 + 1] = ig
      colors[i * 3 + 2] = ib
      continue
    }
    const t = uvs[i * 2 + 1]
    const [r, g, b] = sampleGradientStops(stops, t)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

export function reliefSign(direction: ReliefDirection): number {
  return direction === 'raised' ? -1 : 1
}
