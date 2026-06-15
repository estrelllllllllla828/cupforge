import { useEffect, useRef } from 'react'
import type { ColorMapState, ExpressionForm, PaletteColor, SampleBox, SampleShape, ScaleGradientDirection, TilingMode } from '../types'
import { buildPatternCanvas } from '../engine/patternEngine'

interface Props {
  expressionSrc: string | null
  expressionForm: ExpressionForm
  sampleBox: SampleBox
  sampleShape: SampleShape
  tilingMode: TilingMode
  tileCols: number
  tileRows: number
  kaleidoscopeSegments: number
  offsetBrickRatio: number
  scaleGradientMin: number
  scaleGradientDirection: ScaleGradientDirection
  palette: PaletteColor[]
  colorMap: ColorMapState
  outlineThickness: number
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
}

export default function PatternPreview({
  expressionSrc,
  expressionForm,
  sampleBox,
  sampleShape,
  tilingMode,
  tileCols,
  tileRows,
  kaleidoscopeSegments,
  offsetBrickRatio,
  scaleGradientMin,
  scaleGradientDirection,
  palette,
  colorMap,
  outlineThickness,
  onCanvasReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const displayRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      const display = displayRef.current
      const container = containerRef.current

      if (!expressionSrc || !display || !container) {
        onCanvasReady?.(null)
        return
      }

      try {
        const bg: [number, number, number] = colorMap.enabled && colorMap.mode === 'free' && colorMap.freeColors[0]
          ? (() => {
              const h = colorMap.freeColors[0].replace('#', '')
              const n = parseInt(h, 16)
              return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number]
            })()
          : palette.length > 0
            ? palette[0].rgb as [number, number, number]
            : [245, 245, 240]

        const tiled = await buildPatternCanvas(expressionSrc, {
          sampleBox,
          sampleShape,
          tiling: {
            mode: tilingMode,
            cols: tileCols,
            rows: tileRows,
            kaleidoscopeSegments,
            offsetBrickRatio,
            scaleGradientMin,
            scaleGradientDirection,
          },
          palette,
          colorMap,
          outlineThickness,
          isOutline: expressionForm === 'outline',
          tileBackground: bg,
        })

        if (cancelled || !tiled) {
          onCanvasReady?.(null)
          return
        }

        const maxW = container.clientWidth
        const maxH = container.clientHeight
        const scale = Math.min(maxW / tiled.width, maxH / tiled.height, 1)
        display.width = Math.max(1, Math.round(tiled.width * scale))
        display.height = Math.max(1, Math.round(tiled.height * scale))

        const ctx = display.getContext('2d')!
        ctx.imageSmoothingEnabled = true
        ctx.clearRect(0, 0, display.width, display.height)
        ctx.drawImage(tiled, 0, 0, display.width, display.height)

        onCanvasReady?.(tiled)
      } catch {
        onCanvasReady?.(null)
      }
    }

    render()
    return () => { cancelled = true }
  }, [
    expressionSrc,
    expressionForm,
    sampleBox,
    sampleShape,
    tilingMode,
    tileCols,
    tileRows,
    kaleidoscopeSegments,
    offsetBrickRatio,
    scaleGradientMin,
    scaleGradientDirection,
    palette,
    colorMap,
    outlineThickness,
    onCanvasReady,
  ])

  if (!expressionSrc) {
    return (
      <div className="pattern-preview empty-state">
        <p>上传工业建造照片后，此处将实时显示无缝纹样平铺预览。</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="pattern-preview">
      <canvas ref={displayRef} />
    </div>
  )
}
