import { useEffect, useState } from 'react'
import type { SchemePreset } from '../constants/schemes'
import { buildSchemeSampleVariants } from '../constants/schemes'
import { buildPatternCanvas } from '../engine/patternEngine'
import { pickPaletteBackground } from '../engine/schemeThumbColor'
import type { ImageSize, PaletteColor } from '../types'

const THUMB_COUNT = 3

interface Props {
  scheme: SchemePreset
  expressionSrc: string | null
  imageSize: ImageSize | null
  palette: PaletteColor[]
  offsetBrickRatio: number
  scaleGradientMin: number
}

export default function SchemePatternThumbs({
  scheme,
  expressionSrc,
  imageSize,
  palette,
  offsetBrickRatio,
  scaleGradientMin,
}: Props) {
  const [thumbs, setThumbs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!expressionSrc || !imageSize) {
        setThumbs([])
        return
      }

      setLoading(true)
      try {
        const isOutline = scheme.expressionForm === 'outline'
        const baseBg = pickPaletteBackground(palette, scheme.id * 5003)
        const variants = buildSchemeSampleVariants(scheme, imageSize, THUMB_COUNT)

        // 同一方案：仅取样框（位置/大小/角度）不同，其余参数完全一致
        const built = await Promise.all(
          variants.map((sampleBox) =>
            buildPatternCanvas(expressionSrc, {
              sampleBox,
              sampleShape: scheme.sampleShape,
              tiling: {
                mode: scheme.tilingMode,
                cols: scheme.tileCols,
                rows: scheme.tileRows,
                kaleidoscopeSegments: scheme.kaleidoscopeSegments,
                offsetBrickRatio,
                scaleGradientMin,
                scaleGradientDirection: scheme.scaleGradientDirection,
              },
              palette,
              colorMap: scheme.colorMap,
              outlineThickness: scheme.outlineThickness,
              isOutline,
              tileBackground: baseBg,
            }),
          ),
        )

        if (cancelled) return

        const nextThumbs = built
          .map((canvas) => (canvas ? canvas.toDataURL('image/png') : null))
          .filter((src): src is string => !!src)

        setThumbs(nextThumbs)
      } catch {
        if (!cancelled) setThumbs([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [scheme, expressionSrc, imageSize, palette, offsetBrickRatio, scaleGradientMin])

  return (
    <div className="cyber-scheme-patterns">
      {Array.from({ length: THUMB_COUNT }, (_, i) => (
        <div key={i} className="cyber-pattern-thumb">
          {thumbs[i] ? (
            <img src={thumbs[i]} alt={`${scheme.title}纹样预览 ${i + 1}`} />
          ) : (
            <span>{loading ? '生成中…' : '纹样'}</span>
          )}
        </div>
      ))}
    </div>
  )
}
