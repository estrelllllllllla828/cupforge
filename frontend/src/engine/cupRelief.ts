import { canvasToHeightmap } from './patternEngine'
import type { CupSurfaceRegion, ReliefDirection } from '../types'
import { reliefRegionMaskFactor } from './cupSurfaceRegions'
import { reliefSign } from './cupSurfaceColor'

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1
}

/** 按 UV 双线性采样高度图（0=暗/低，1=亮/高） */
function sampleHeightmapBilinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  u: number,
  v: number,
): number {
  const fu = wrap01(u) * (width - 1)
  const fv = (1 - wrap01(v)) * (height - 1)

  const x0 = Math.floor(fu)
  const y0 = Math.floor(fv)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = fu - x0
  const ty = fv - y0

  const at = (x: number, y: number) => data[(y * width + x) * 4] / 255

  const v00 = at(x0, y0)
  const v10 = at(x1, y0)
  const v01 = at(x0, y1)
  const v11 = at(x1, y1)

  const top = v00 + (v10 - v00) * tx
  const bottom = v01 + (v11 - v01) * tx
  return top + (bottom - top) * ty
}

export function weldOuterWallSeam(
  positions: Float32Array,
  profileRowCount: number,
  ringSegments: number,
): void {
  const cols = ringSegments + 1
  for (let i = 0; i < profileRowCount; i++) {
    const i0 = i * cols
    const iSeam = i * cols + ringSegments
    positions[iSeam * 3] = positions[i0 * 3]
    positions[iSeam * 3 + 1] = positions[i0 * 3 + 1]
    positions[iSeam * 3 + 2] = positions[i0 * 3 + 2]
  }
}

export function buildHeightmapFromPattern(patternCanvas: HTMLCanvasElement): HTMLCanvasElement {
  return canvasToHeightmap(patternCanvas)
}

/**
 * 沿杯壁外表面真实法线方向位移顶点，根据纹样高度图生成浮雕。
 * 位移垂直于杯壁表面，斜壁/弧壁也不会让浮雕图案产生形变。
 * 仅处理外壁顶点（前 outerVertexCount 个）。
 *
 * 高度图灰度：亮纹区域相对暗底不动，暗底随方向位移，形成凸起/凹陷对比。
 */
export function applyReliefDisplacement(
  positions: Float32Array,
  uvs: Float32Array,
  outerNormals: Float32Array,
  heightmap: HTMLCanvasElement,
  outerVertexCount: number,
  reliefStrength: number,
  direction: ReliefDirection = 'raised',
  surfaceRegions: CupSurfaceRegion[] = [],
  ringSegments = 0,
): void {
  if (reliefStrength <= 0 || outerVertexCount <= 0) return

  const sign = reliefSign(direction)
  const cols = ringSegments > 0 ? ringSegments + 1 : 0

  const ctx = heightmap.getContext('2d')
  if (!ctx) return

  const { width, height } = heightmap
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data

  for (let i = 0; i < outerVertexCount; i++) {
    let u = uvs[i * 2]
    const v = uvs[i * 2 + 1]

    // 接缝列与首列共用 u=0 采样，避免环向纹样跳变
    if (cols > 0 && i % cols === ringSegments) u = 0

    const regionMask = reliefRegionMaskFactor(u, v, surfaceRegions)
    if (regionMask <= 0) continue

    // 反相：亮纹（线稿）保持相对高度，暗底随方向位移
    const h = 1 - sampleHeightmapBilinear(data, width, height, u, v)
    const offset = sign * h * reliefStrength * regionMask

    const nx = outerNormals[i * 3]
    const ny = outerNormals[i * 3 + 1]
    const nz = outerNormals[i * 3 + 2]

    positions[i * 3] += nx * offset
    positions[i * 3 + 1] += ny * offset
    positions[i * 3 + 2] += nz * offset
  }
}
