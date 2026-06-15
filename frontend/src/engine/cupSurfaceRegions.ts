import type { CupSurfaceRegion } from '../types'

export const MIN_REGION_SIZE = 0.06
/** 可见控制点尺寸 */
export const REGION_HANDLE = 14
/** 角点命中容差 */
export const REGION_HIT_SLOP = 18
/** 上下边命中容差（比左右边更宽，便于拖动杯口/杯底方向） */
export const REGION_NS_EDGE_SLOP = 28
/** 左右边命中容差 */
export const REGION_EW_EDGE_SLOP = 14

export type RegionDragMode =
  | 'move'
  | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  | null

export function cursorForRegionDragMode(mode: RegionDragMode): string {
  switch (mode) {
    case 'nw':
    case 'se':
      return 'nwse-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'move':
      return 'move'
    default:
      return 'crosshair'
  }
}

export function createSurfaceRegionId() {
  return `sr${Date.now()}${Math.random().toString(36).slice(2, 5)}`
}

export function normalizeRegion(r: CupSurfaceRegion): CupSurfaceRegion {
  const u0 = Math.max(0, Math.min(1, Math.min(r.u0, r.u1)))
  const u1 = Math.max(0, Math.min(1, Math.max(r.u0, r.u1)))
  const v0 = Math.max(0, Math.min(1, Math.min(r.v0, r.v1)))
  const v1 = Math.max(0, Math.min(1, Math.max(r.v0, r.v1)))
  const minSpan = MIN_REGION_SIZE
  const uSpan = Math.max(minSpan, u1 - u0)
  const vSpan = Math.max(minSpan, v1 - v0)
  let nu0 = u0
  let nv0 = v0
  if (nu0 + uSpan > 1) nu0 = 1 - uSpan
  if (nv0 + vSpan > 1) nv0 = 1 - vSpan
  return { ...r, u0: nu0, u1: nu0 + uSpan, v0: nv0, v1: nv0 + vSpan }
}

export function isUvInSurfaceRegions(
  u: number,
  v: number,
  regions: CupSurfaceRegion[],
): boolean {
  if (regions.length === 0) return true
  const uNorm = ((u % 1) + 1) % 1
  return regions.some((r) => uNorm >= r.u0 && uNorm <= r.u1 && v >= r.v0 && v <= r.v1)
}

/** 浮雕区域边缘羽化系数 0–1，避免区域内外出现明显台阶 */
export function reliefRegionMaskFactor(
  u: number,
  v: number,
  regions: CupSurfaceRegion[],
  feather = 0.05,
): number {
  if (regions.length === 0) return 1

  const uNorm = ((u % 1) + 1) % 1
  let best = 0

  for (const r of regions) {
    const du0 = uNorm - r.u0
    const du1 = r.u1 - uNorm
    const dv0 = v - r.v0
    const dv1 = r.v1 - v

    if (du0 < 0 || du1 < 0 || dv0 < 0 || dv1 < 0) continue

    const edgeDist = Math.min(du0, du1, dv0, dv1)
    let t = feather <= 0 ? 1 : Math.min(1, edgeDist / feather)
    t = t * t * (3 - 2 * t)
    best = Math.max(best, t)
  }

  return best
}

export function regionToPixelRect(
  region: CupSurfaceRegion,
  width: number,
  height: number,
) {
  return {
    x: region.u0 * width,
    y: (1 - region.v1) * height,
    w: (region.u1 - region.u0) * width,
    h: (region.v1 - region.v0) * height,
  }
}

export function pixelRectToRegion(
  x: number,
  y: number,
  w: number,
  h: number,
  width: number,
  height: number,
  id: string,
): CupSurfaceRegion {
  return normalizeRegion({
    id,
    u0: x / width,
    v0: 1 - (y + h) / height,
    u1: (x + w) / width,
    v1: 1 - y / height,
  })
}

function pointInRect(px: number, py: number, x: number, y: number, w: number, h: number) {
  return px >= x && px <= x + w && py >= y && py <= y + h
}

export function hitTestSurfaceRegion(
  regions: CupSurfaceRegion[],
  width: number,
  height: number,
  px: number,
  py: number,
): { id: string; mode: RegionDragMode } | null {
  const cornerR = REGION_HIT_SLOP
  const nsSlop = REGION_NS_EDGE_SLOP
  const ewSlop = REGION_EW_EDGE_SLOP

  for (let i = regions.length - 1; i >= 0; i--) {
    const rect = regionToPixelRect(regions[i], width, height)
    const { x, y, w, h } = rect
    const inX = px >= x - ewSlop && px <= x + w + ewSlop

    const corners: [RegionDragMode, number, number][] = [
      ['nw', x, y],
      ['ne', x + w, y],
      ['se', x + w, y + h],
      ['sw', x, y + h],
    ]
    for (const [mode, cx, cy] of corners) {
      if (Math.hypot(px - cx, py - cy) <= cornerR) {
        return { id: regions[i].id, mode }
      }
    }

    // 上下边优先于左右边检测，避免贴左右缘时误触 west/east
    if (Math.abs(py - y) <= nsSlop && inX) {
      return { id: regions[i].id, mode: 'n' }
    }
    if (Math.abs(py - (y + h)) <= nsSlop && inX) {
      return { id: regions[i].id, mode: 's' }
    }

    const midHandles: [RegionDragMode, number, number][] = [
      ['n', x + w / 2, y],
      ['s', x + w / 2, y + h],
      ['w', x, y + h / 2],
      ['e', x + w, y + h / 2],
    ]
    for (const [mode, cx, cy] of midHandles) {
      if (Math.hypot(px - cx, py - cy) <= cornerR) {
        return { id: regions[i].id, mode }
      }
    }

    const inY = py >= y - nsSlop && py <= y + h + nsSlop

    if (Math.abs(px - x) <= ewSlop && inY) return { id: regions[i].id, mode: 'w' }
    if (Math.abs(px - (x + w)) <= ewSlop && inY) return { id: regions[i].id, mode: 'e' }

    if (pointInRect(px, py, x, y, w, h)) {
      return { id: regions[i].id, mode: 'move' }
    }
  }
  return null
}

export function applyRegionDrag(
  region: CupSurfaceRegion,
  mode: RegionDragMode,
  startRegion: CupSurfaceRegion,
  dxNorm: number,
  dyNorm: number,
): CupSurfaceRegion {
  if (!mode) return region

  let { u0, v0, u1, v1 } = startRegion

  if (mode === 'move') {
    const uw = u1 - u0
    const vh = v1 - v0
    u0 = Math.max(0, Math.min(1 - uw, u0 + dxNorm))
    u1 = u0 + uw
    v0 = Math.max(0, Math.min(1 - vh, v0 + dyNorm))
    v1 = v0 + vh
    return normalizeRegion({ ...region, u0, v0, u1, v1 })
  }

  if (mode.includes('e')) u1 = startRegion.u1 + dxNorm
  if (mode.includes('w')) u0 = startRegion.u0 + dxNorm
  // 屏幕上方 = 杯口(v1)，屏幕下方 = 杯底(v0)
  if (mode.includes('n')) v1 = startRegion.v1 + dyNorm
  if (mode.includes('s')) v0 = startRegion.v0 + dyNorm

  return normalizeRegion({ ...region, u0, v0, u1, v1 })
}

/** 贴图模式：区域外填杯体色，仅保留选定区域的纹样 */
export function buildRegionMaskedPatternCanvas(
  patternCanvas: HTMLCanvasElement,
  regions: CupSurfaceRegion[],
  outsideRgb: [number, number, number],
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = patternCanvas.width
  out.height = patternCanvas.height
  const ctx = out.getContext('2d')!
  const [r, g, b] = outsideRgb
  ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
  ctx.fillRect(0, 0, out.width, out.height)

  const active = regions.length > 0 ? regions : [{ id: 'all', u0: 0, v0: 0, u1: 1, v1: 1 }]

  for (const region of active) {
    const rect = regionToPixelRect(region, out.width, out.height)
    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.clip()
    ctx.drawImage(patternCanvas, 0, 0, out.width, out.height)
    ctx.restore()
  }

  return out
}
