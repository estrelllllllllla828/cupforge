import { useCallback, useEffect, useRef, useState } from 'react'
import type { CupSurfaceRegion } from '../types'
import {
  REGION_HANDLE,
  applyRegionDrag,
  createSurfaceRegionId,
  cursorForRegionDragMode,
  hitTestSurfaceRegion,
  normalizeRegion,
  regionToPixelRect,
  type RegionDragMode,
} from '../engine/cupSurfaceRegions'

interface Props {
  regions: CupSurfaceRegion[]
  onChange: (regions: CupSurfaceRegion[]) => void
  patternCanvas?: HTMLCanvasElement | null
  modeLabel?: string
  /** 非贴图/非浮雕区域预览色 */
  outsideColor?: [number, number, number]
}

const CANVAS_W = 480
const CANVAS_H = 300

export default function CupSurfaceRegionEditor({
  regions,
  onChange,
  patternCanvas,
  modeLabel = '图案',
  outsideColor,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedId, setSelectedId] = useState<string>(() => regions[0]?.id ?? '')
  const [cursor, setCursor] = useState('crosshair')
  const dragRef = useRef<{
    id: string
    mode: RegionDragMode
    startRegion: CupSurfaceRegion
    startX: number
    startY: number
  } | null>(null)

  const selected = regions.find((r) => r.id === selectedId) ?? regions[regions.length - 1]

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    if (outsideColor) {
      const [r, g, b] = outsideColor
      ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    } else {
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }

    if (patternCanvas && patternCanvas.width > 0) {
      for (const region of regions) {
        const { x, y, w, h } = regionToPixelRect(region, CANVAS_W, CANVAS_H)
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.clip()
        ctx.drawImage(patternCanvas, 0, 0, CANVAS_W, CANVAS_H)
        ctx.restore()
      }
    } else if (!outsideColor) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      for (let x = 0; x < CANVAS_W; x += 24) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, CANVAS_H)
        ctx.stroke()
      }
      for (let y = 0; y < CANVAS_H; y += 24) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(CANVAS_W, y)
        ctx.stroke()
      }
    }

    // 非贴图区域轻微暗化，突出选框
    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.globalCompositeOperation = 'destination-out'
    for (const region of regions) {
      const { x, y, w, h } = regionToPixelRect(region, CANVAS_W, CANVAS_H)
      ctx.fillRect(x, y, w, h)
    }
    ctx.restore()

    for (const region of regions) {
      const { x, y, w, h } = regionToPixelRect(region, CANVAS_W, CANVAS_H)
      const isSel = region.id === selected?.id
      ctx.strokeStyle = isSel ? '#00F5FF' : 'rgba(126, 200, 232, 0.85)'
      ctx.lineWidth = isSel ? 3 : 2
      ctx.setLineDash(isSel ? [] : [6, 4])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])

      if (isSel) {
        const hr = REGION_HANDLE / 2
        const handles = [
          [x, y], [x + w / 2, y], [x + w, y],
          [x, y + h / 2], [x + w, y + h / 2],
          [x, y + h], [x + w / 2, y + h], [x + w, y + h],
        ]
        for (const [hx, hy] of handles) {
          ctx.beginPath()
          ctx.fillStyle = '#fff'
          ctx.arc(hx, hy, hr + 1, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.fillStyle = '#00F5FF'
          ctx.arc(hx, hy, hr - 1, 0, Math.PI * 2)
          ctx.fill()
        }

        // 上下边加宽可拖提示条
        ctx.fillStyle = 'rgba(0, 245, 255, 0.35)'
        ctx.fillRect(x + hr, y - 3, w - hr * 2, 6)
        ctx.fillRect(x + hr, y + h - 3, w - hr * 2, 6)
      }
    }

    ctx.fillStyle = 'rgba(168, 200, 224, 0.75)'
    ctx.font = '11px sans-serif'
    ctx.fillText('← 环向 · 杯底', 8, CANVAS_H - 8)
    ctx.textAlign = 'right'
    ctx.fillText('杯口 →', CANVAS_W - 8, 14)
    ctx.textAlign = 'left'
  }, [patternCanvas, regions, selected?.id, outsideColor])

  useEffect(() => {
    draw()
  }, [draw])

  const toCanvas = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * (CANVAS_W / rect.width),
      y: (clientY - rect.top) * (CANVAS_H / rect.height),
    }
  }

  const updateRegion = (id: string, patch: Partial<CupSurfaceRegion>) => {
    onChange(regions.map((r) => (r.id === id ? normalizeRegion({ ...r, ...patch }) : r)))
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const { x, y } = toCanvas(e.clientX, e.clientY)

    if (!dragRef.current) {
      const hit = hitTestSurfaceRegion(regions, CANVAS_W, CANVAS_H, x, y)
      setCursor(cursorForRegionDragMode(hit?.mode ?? null))
      if (hit && hit.id !== selectedId) setSelectedId(hit.id)
      return
    }

    const drag = dragRef.current
    const dxNorm = (x - drag.startX) / CANVAS_W
    const dyNorm = -(y - drag.startY) / CANVAS_H
    const region = regions.find((r) => r.id === drag.id)
    if (!region) return
    const next = applyRegionDrag(region, drag.mode, drag.startRegion, dxNorm, dyNorm)
    updateRegion(drag.id, next)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = toCanvas(e.clientX, e.clientY)
    const hit = hitTestSurfaceRegion(regions, CANVAS_W, CANVAS_H, x, y)
    if (!hit) return
    const region = regions.find((r) => r.id === hit.id)
    if (!region || !hit.mode) return
    setSelectedId(hit.id)
    setCursor(cursorForRegionDragMode(hit.mode))
    dragRef.current = {
      id: hit.id,
      mode: hit.mode,
      startRegion: { ...region },
      startX: x,
      startY: y,
    }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null
      canvasRef.current?.releasePointerCapture(e.pointerId)
      const { x, y } = toCanvas(e.clientX, e.clientY)
      const hit = hitTestSurfaceRegion(regions, CANVAS_W, CANVAS_H, x, y)
      setCursor(cursorForRegionDragMode(hit?.mode ?? null))
    }
  }

  const handleAdd = () => {
    const id = createSurfaceRegionId()
    const next: CupSurfaceRegion = normalizeRegion({
      id,
      u0: 0.25,
      v0: 0.2,
      u1: 0.75,
      v1: 0.8,
    })
    onChange([...regions, next])
    setSelectedId(id)
  }

  const handleRemove = () => {
    if (regions.length <= 1 || !selected) return
    const next = regions.filter((r) => r.id !== selected.id)
    onChange(next)
    setSelectedId(next[next.length - 1]?.id ?? '')
  }

  return (
    <div className="cup-surface-region-editor">
      <div className="cup-surface-region-toolbar">
        <span className="cyber-surface-label">{modeLabel}区域</span>
        <div className="cup-surface-region-actions">
          <button type="button" className="cyber-gradient-action add" onClick={handleAdd} aria-label="添加区域">
            +
          </button>
          <button
            type="button"
            className="cyber-gradient-action remove"
            onClick={handleRemove}
            disabled={regions.length <= 1}
            aria-label="删除区域"
          >
            ×
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="cup-surface-region-canvas"
        style={{ cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <p className="cup-surface-region-hint">
        靠近边缘/角点更易选中 · 拖动框体移动 · 拖控制点调整大小 · 可添加多块不连续{modeLabel}区域
        {regions.length > 1 ? ` · 共 ${regions.length} 块` : ''}
      </p>
    </div>
  )
}
