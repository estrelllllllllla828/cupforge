import { useRef, useEffect, useCallback, useState } from 'react'
import type { SampleBox, SampleShape } from '../types'
import {
  applyDrag,
  cursorForDragMode,
  drawSampleOverlay,
  hitTestSampleBox,
  type DragMode,
} from '../engine/sampleRegion'

interface Props {
  imageSrc: string | null
  sampleBox: SampleBox
  sampleShape: SampleShape
  imageSize: { w: number; h: number } | null
  onSampleBoxChange: (box: SampleBox) => void
  showOverlay: boolean
  interactive: boolean
  emptyText?: string
}

export default function SampleCanvas({
  imageSrc,
  sampleBox,
  sampleShape,
  imageSize,
  onSampleBoxChange,
  showOverlay,
  interactive,
  emptyText = '上传后在此拖动取样框。',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const scaleRef = useRef(1)
  const dragModeRef = useRef<DragMode>(null)
  const startBoxRef = useRef<SampleBox>(sampleBox)
  const startMouseRef = useRef({ x: 0, y: 0 })
  const [cursor, setCursor] = useState('default')
  const [dragging, setDragging] = useState(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !img.complete) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const container = containerRef.current
    const maxW = container ? container.clientWidth - 16 : 300
    const maxH = container ? container.clientHeight - 16 : 240
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
    scaleRef.current = scale

    canvas.width = img.naturalWidth * scale
    canvas.height = img.naturalHeight * scale

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    if (showOverlay && sampleBox.w > 0 && sampleBox.h > 0) {
      drawSampleOverlay(ctx, sampleBox, sampleShape, scale, interactive)
    }
  }, [sampleBox, sampleShape, showOverlay, interactive])

  useEffect(() => {
    if (!imageSrc) {
      imgRef.current = null
      return
    }
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      draw()
    }
    img.src = imageSrc
  }, [imageSrc, draw])

  useEffect(() => {
    draw()
  }, [sampleBox, sampleShape, draw])

  const toCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!interactive || !imageSize) return
    const { x, y } = toCanvasCoords(e.clientX, e.clientY)
    const mode = hitTestSampleBox(sampleBox, sampleShape, scaleRef.current, x, y, true)
    if (!mode) return
    dragModeRef.current = mode
    startBoxRef.current = { ...sampleBox, rotation: sampleBox.rotation ?? 0 }
    startMouseRef.current = { x, y }
    setDragging(true)
    setCursor(cursorForDragMode(mode))
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = toCanvasCoords(e.clientX, e.clientY)

    if (dragging && dragModeRef.current && imageSize) {
      if (dragModeRef.current === 'rotate') {
        onSampleBoxChange(
          applyDrag(
            'rotate',
            sampleBox,
            imageSize.w,
            imageSize.h,
            startBoxRef.current,
            0,
            0,
            x,
            y,
            scaleRef.current,
          ),
        )
        return
      }
      const dx = (x - startMouseRef.current.x) / scaleRef.current
      const dy = (y - startMouseRef.current.y) / scaleRef.current
      onSampleBoxChange(
        applyDrag(
          dragModeRef.current,
          sampleBox,
          imageSize.w,
          imageSize.h,
          startBoxRef.current,
          dx,
          dy,
        ),
      )
      return
    }

    if (interactive) {
      const mode = hitTestSampleBox(sampleBox, sampleShape, scaleRef.current, x, y, true)
      setCursor(cursorForDragMode(mode))
    }
  }

  const handleMouseUp = () => {
    dragModeRef.current = null
    setDragging(false)
    setCursor('default')
  }

  if (!imageSrc) {
    return (
      <div className="sample-canvas empty-state">
        <p>{emptyText}</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="sample-canvas">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: interactive ? cursor : 'default' }}
      />
    </div>
  )
}
