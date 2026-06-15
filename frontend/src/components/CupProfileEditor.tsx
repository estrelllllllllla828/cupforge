import { useCallback, useEffect, useRef, useState } from 'react'
import { catmullRomSpline, scaleControlPoints, type Point2D } from '../engine/cupCurve'

interface Props {
  controlPoints: Point2D[]
  centerX: number
  wallThickness: number
  cupHeight: number
  baseHeight: number
  onControlPointsChange: (points: Point2D[]) => void
  onDraggingChange?: (dragging: boolean) => void
}

const CANVAS_W = 560
const CANVAS_H = 620

export default function CupProfileEditor({
  controlPoints,
  centerX,
  wallThickness,
  cupHeight,
  baseHeight,
  onControlPointsChange,
  onDraggingChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [dragPoints, setDragPoints] = useState<Point2D[] | null>(null)
  const dragging = useRef(false)
  const rafRef = useRef<number | null>(null)

  const activePoints = dragPoints ?? controlPoints
  const scaledPoints = scaleControlPoints(activePoints, cupHeight, baseHeight)
  const pendingDrawRef = useRef<Point2D[] | null>(null)

  const renderProfile = useCallback((points: Point2D[], selectedIdx: number | null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scaled = scaleControlPoints(points, cupHeight, baseHeight)

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#181818'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(centerX, 20)
    ctx.lineTo(centerX, CANVAS_H - 20)
    ctx.stroke()
    ctx.setLineDash([])

    const curve = catmullRomSpline(scaled, 180)
    const xs = curve.map((p) => p.x)
    const ys = curve.map((p) => p.y)
    const inner = xs.map((x) => x + wallThickness)
    const leftOuter = xs.map((x) => centerX - (x - centerX))
    const leftInner = inner.map((x) => centerX - (x - centerX))

    const fillPoly = (points: { x: number; y: number }[], fill: string) => {
      ctx.beginPath()
      points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()
    }

    const outerPoly = [
      ...curve,
      ...leftOuter.map((x, i) => ({ x, y: ys[i] })).reverse(),
    ]
    fillPoly(outerPoly, 'rgba(45,45,45,0.95)')

    const innerPoly = [
      ...inner.map((x, i) => ({ x, y: ys[i] })),
      ...leftInner.map((x, i) => ({ x, y: ys[i] })).reverse(),
    ]
    fillPoly(innerPoly, '#181818')

    const strokeCurve = (arr: number[], color: string, width: number) => {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      arr.forEach((x, i) => (i === 0 ? ctx.moveTo(x, ys[i]) : ctx.lineTo(x, ys[i])))
      ctx.stroke()
    }

    strokeCurve(xs, '#00F5FF', 3)
    strokeCurve(leftOuter, '#00F5FF', 3)
    strokeCurve(inner, '#FFAA00', 2)
    strokeCurve(leftInner, '#FFAA00', 2)

    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(inner[0], ys[0])
    ctx.lineTo(leftInner[0], ys[0])
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(inner[inner.length - 1], ys[ys.length - 1])
    ctx.lineTo(leftInner[leftInner.length - 1], ys[ys.length - 1])
    ctx.stroke()

    scaled.forEach((p, i) => {
      ctx.beginPath()
      ctx.fillStyle = selectedIdx === i ? '#00F5FF' : '#fff'
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [centerX, wallThickness, cupHeight, baseHeight])

  const draw = useCallback(() => {
    renderProfile(activePoints, selected)
  }, [renderProfile, activePoints, selected])

  useEffect(() => {
    if (dragging.current) return
    setDragPoints(null)
  }, [controlPoints])

  useEffect(() => {
    draw()
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  const toCanvas = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const sx = CANVAS_W / rect.width
    const sy = CANVAS_H / rect.height
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    }
  }

  const hitTest = (x: number, y: number) => {
    for (let i = 0; i < scaledPoints.length; i++) {
      const p = scaledPoints[i]
      const d = Math.hypot(x - p.x, y - p.y)
      if (d < 14) return i
    }
    return null
  }

  const movePoint = (idx: number, x: number, y: number) => {
    const nx = Math.max(120, Math.min(320, x))
    const ny = Math.max(60, Math.min(580, y))
    const base = dragPoints ?? controlPoints
    const next = [...base]
    const scale = cupHeight / baseHeight
    next[idx] = {
      x: nx,
      y: 80 + (ny - 80) / scale,
    }
    return next
  }

  const scheduleDraw = (points: Point2D[], selectedIdx: number) => {
    pendingDrawRef.current = points
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const pts = pendingDrawRef.current
      if (pts) renderProfile(pts, selectedIdx)
    })
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = toCanvas(e.clientX, e.clientY)
    const idx = hitTest(x, y)
    if (idx !== null) {
      setSelected(idx)
      dragging.current = true
      onDraggingChange?.(true)
      canvasRef.current?.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || selected === null) return
    const { x, y } = toCanvas(e.clientX, e.clientY)
    const next = movePoint(selected, x, y)
    setDragPoints(next)
    scheduleDraw(next, selected)
  }

  const finishDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    onDraggingChange?.(false)
    if (dragPoints) {
      onControlPointsChange(dragPoints)
      setDragPoints(null)
    }
    setSelected(null)
    canvasRef.current?.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="cup-profile-editor">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="cup-profile-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerLeave={finishDrag}
      />
      <p className="cup-profile-hint">拖动白色控制点调整杯型轮廓 · 青色外壁 · 橙色内壁</p>
    </div>
  )
}
