import type { SampleBox, SampleShape } from '../types'

export const MIN_SAMPLE_SIZE = 20
export const HANDLE_SIZE = 8
export const ROTATE_HANDLE_OFFSET = 24

export type DragMode =
  | 'move'
  | 'rotate'
  | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  | null

export function clampBox(box: SampleBox, imgW: number, imgH: number, minSize = MIN_SAMPLE_SIZE): SampleBox {
  const w = Math.max(minSize, Math.min(box.w, imgW))
  const h = Math.max(minSize, Math.min(box.h, imgH))
  const x = Math.max(0, Math.min(box.x, imgW - w))
  const y = Math.max(0, Math.min(box.y, imgH - h))
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
    rotation: box.rotation ?? 0,
  }
}

export function buildClipPath(ctx: CanvasRenderingContext2D, shape: SampleShape, w: number, h: number) {
  ctx.beginPath()
  switch (shape) {
    case 'circle':
      ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2)
      break
    case 'triangle':
      ctx.moveTo(w / 2, 0)
      ctx.lineTo(w, h)
      ctx.lineTo(0, h)
      ctx.closePath()
      break
    case 'diamond':
      ctx.moveTo(w / 2, 0)
      ctx.lineTo(w, h / 2)
      ctx.lineTo(w / 2, h)
      ctx.lineTo(0, h / 2)
      ctx.closePath()
      break
    case 'trapezoid':
      ctx.moveTo(w * 0.2, 0)
      ctx.lineTo(w * 0.8, 0)
      ctx.lineTo(w, h)
      ctx.lineTo(0, h)
      ctx.closePath()
      break
    default:
      ctx.rect(0, 0, w, h)
  }
}

function toLocalCoords(
  px: number,
  py: number,
  scale: number,
  box: SampleBox,
): { x: number; y: number } {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const lx = px / scale - cx
  const ly = py / scale - cy
  const rad = (-(box.rotation ?? 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: lx * cos - ly * sin + box.w / 2,
    y: lx * sin + ly * cos + box.h / 2,
  }
}

function pointInShape(x: number, y: number, shape: SampleShape, w: number, h: number): boolean {
  switch (shape) {
    case 'circle': {
      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) / 2
      return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2
    }
    case 'triangle':
      return y >= (h / w) * Math.abs(x - w / 2) * 2 && y <= h
    case 'diamond':
      return Math.abs(x - w / 2) / (w / 2) + Math.abs(y - h / 2) / (h / 2) <= 1
    case 'trapezoid': {
      if (y < 0 || y > h) return false
      const topHalf = (w * 0.6) / 2
      const topLeft = w / 2 - topHalf
      const topRight = w / 2 + topHalf
      const t = y / h
      const left = topLeft * (1 - t)
      const right = w - (w - topRight) * (1 - t)
      return x >= left && x <= right
    }
  }
  return x >= 0 && y >= 0 && x <= w && y <= h
}

function getRotateHandleScreen(box: SampleBox, scale: number) {
  const cx = (box.x + box.w / 2) * scale
  const cy = (box.y + box.h / 2) * scale
  const rad = ((box.rotation ?? 0) * Math.PI) / 180
  const dist = box.h / 2 + ROTATE_HANDLE_OFFSET
  return {
    x: cx + Math.sin(rad) * dist * scale,
    y: cy - Math.cos(rad) * dist * scale,
  }
}

function getHandlePositions(box: SampleBox, scale: number) {
  const cx = (box.x + box.w / 2) * scale
  const cy = (box.y + box.h / 2) * scale
  const rot = ((box.rotation ?? 0) * Math.PI) / 180
  const corners = [
    { id: 'nw' as const, lx: -box.w / 2, ly: -box.h / 2 },
    { id: 'n' as const, lx: 0, ly: -box.h / 2 },
    { id: 'ne' as const, lx: box.w / 2, ly: -box.h / 2 },
    { id: 'e' as const, lx: box.w / 2, ly: 0 },
    { id: 'se' as const, lx: box.w / 2, ly: box.h / 2 },
    { id: 's' as const, lx: 0, ly: box.h / 2 },
    { id: 'sw' as const, lx: -box.w / 2, ly: box.h / 2 },
    { id: 'w' as const, lx: -box.w / 2, ly: 0 },
  ]
  return corners.map((c) => {
    const rx = c.lx * Math.cos(rot) - c.ly * Math.sin(rot)
    const ry = c.lx * Math.sin(rot) + c.ly * Math.cos(rot)
    return { id: c.id, x: cx + rx * scale, y: cy + ry * scale }
  })
}

export function drawSampleOverlay(
  ctx: CanvasRenderingContext2D,
  box: SampleBox,
  shape: SampleShape,
  scale: number,
  interactive: boolean,
) {
  if (box.w <= 0 || box.h <= 0) return

  const cx = (box.x + box.w / 2) * scale
  const cy = (box.y + box.h / 2) * scale
  const rot = ((box.rotation ?? 0) * Math.PI) / 180

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.scale(scale, scale)
  ctx.translate(-box.w / 2, -box.h / 2)

  buildClipPath(ctx, shape, box.w, box.h)
  ctx.fillStyle = 'rgba(241, 196, 15, 0.1)'
  ctx.fill()

  buildClipPath(ctx, shape, box.w, box.h)
  ctx.strokeStyle = '#f1c40f'
  ctx.lineWidth = 2 / scale
  ctx.setLineDash([6 / scale, 4 / scale])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  if (!interactive) return

  const rh = getRotateHandleScreen(box, scale)
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(rh.x, rh.y)
  ctx.strokeStyle = '#f1c40f'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = '#3498db'
  ctx.beginPath()
  ctx.arc(rh.x, rh.y, HANDLE_SIZE / 2, 0, Math.PI * 2)
  ctx.fill()

  const handles = getHandlePositions(box, scale)
  ctx.fillStyle = '#f1c40f'
  ctx.strokeStyle = '#1a252f'
  ctx.lineWidth = 1
  for (const h of handles) {
    ctx.fillRect(h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
    ctx.strokeRect(h.x - HANDLE_SIZE / 2, h.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
  }
}

export function hitTestSampleBox(
  box: SampleBox,
  shape: SampleShape,
  scale: number,
  px: number,
  py: number,
  interactive: boolean,
): DragMode {
  if (box.w <= 0 || box.h <= 0) return null

  if (interactive) {
    const rh = getRotateHandleScreen(box, scale)
    if (
      (px - rh.x) ** 2 + (py - rh.y) ** 2 <= (HANDLE_SIZE + 4) ** 2
    ) {
      return 'rotate'
    }

    const handles = getHandlePositions(box, scale)
    for (const h of handles) {
      if (
        px >= h.x - HANDLE_SIZE &&
        px <= h.x + HANDLE_SIZE &&
        py >= h.y - HANDLE_SIZE &&
        py <= h.y + HANDLE_SIZE
      ) {
        return h.id
      }
    }
  }

  const local = toLocalCoords(px, py, scale, box)
  if (pointInShape(local.x, local.y, shape, box.w, box.h)) {
    return interactive ? 'move' : null
  }
  return null
}

export function applyDrag(
  mode: DragMode,
  box: SampleBox,
  imgW: number,
  imgH: number,
  startBox: SampleBox,
  dx: number,
  dy: number,
  mouseX?: number,
  mouseY?: number,
  scale = 1,
): SampleBox {
  if (!mode) return box

  if (mode === 'rotate' && mouseX !== undefined && mouseY !== undefined) {
    const cx = (startBox.x + startBox.w / 2) * scale
    const cy = (startBox.y + startBox.h / 2) * scale
    const angle = (Math.atan2(mouseY - cy, mouseX - cx) * 180) / Math.PI + 90
    return clampBox({ ...startBox, rotation: Math.round(angle) % 360 }, imgW, imgH)
  }

  if (mode === 'move') {
    return clampBox({
      ...startBox,
      x: startBox.x + dx,
      y: startBox.y + dy,
    }, imgW, imgH)
  }

  const rotation = startBox.rotation ?? 0
  if (Math.abs(rotation) < 0.5) {
    let { x, y, w, h } = startBox
    if (mode.includes('e')) w = startBox.w + dx
    if (mode.includes('w')) { w = startBox.w - dx; x = startBox.x + dx }
    if (mode.includes('s')) h = startBox.h + dy
    if (mode.includes('n')) { h = startBox.h - dy; y = startBox.y + dy }
    return clampBox({ ...startBox, x, y, w, h }, imgW, imgH)
  }

  const theta = (rotation * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const ldx = dx * cos + dy * sin
  const ldy = dx * sin + dy * cos

  let w = startBox.w
  let h = startBox.h
  let cx = startBox.x + startBox.w / 2
  let cy = startBox.y + startBox.h / 2

  let dw = 0
  let dh = 0
  if (mode.includes('e')) dw += ldx
  if (mode.includes('w')) dw -= ldx
  if (mode.includes('s')) dh += ldy
  if (mode.includes('n')) dh -= ldy

  w += dw
  h += dh

  const shiftLx = dw / 2
  const shiftLy = dh / 2
  cx += shiftLx * cos - shiftLy * sin
  cy += shiftLx * sin + shiftLy * cos

  const x = cx - w / 2
  const y = cy - h / 2

  return clampBox({ ...startBox, x, y, w, h }, imgW, imgH)
}

export function cursorForDragMode(mode: DragMode): string {
  switch (mode) {
    case 'move': return 'move'
    case 'rotate': return 'grab'
    case 'nw': case 'se': return 'nwse-resize'
    case 'ne': case 'sw': return 'nesw-resize'
    case 'n': case 's': return 'ns-resize'
    case 'e': case 'w': return 'ew-resize'
    default: return 'default'
  }
}
