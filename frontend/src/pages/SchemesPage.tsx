import SchemePatternThumbs from '../components/SchemePatternThumbs'
import type { SchemePreset } from '../constants/schemes'
import type { ExpressionForm, ImageSize, PaletteColor } from '../types'

interface Props {
  schemes: SchemePreset[]
  originalSrc: string | null
  bwSrc: string | null
  imageSize: ImageSize | null
  palette: PaletteColor[]
  expressionForms: Record<ExpressionForm, string> | null
  offsetBrickRatio: number
  scaleGradientMin: number
  onEnterEdit: (schemeId: number) => void
}

export default function SchemesPage({
  schemes,
  originalSrc,
  bwSrc,
  imageSize,
  palette,
  expressionForms,
  offsetBrickRatio,
  scaleGradientMin,
  onEnterEdit,
}: Props) {
  return (
    <div className="cyber-schemes-page">
      <aside className="cyber-glass-panel cyber-schemes-preview">
        <h3 className="cyber-schemes-preview-title">原图预览</h3>
        <div className="cyber-schemes-preview-stack">
          <div className="cyber-preview-slot">
            {originalSrc ? (
              <img src={originalSrc} alt="原图彩色" />
            ) : (
              <span className="cyber-preview-placeholder">原图彩色图</span>
            )}
          </div>
          <div className="cyber-preview-slot">
            {bwSrc ? (
              <img src={bwSrc} alt="原图黑白" />
            ) : (
              <span className="cyber-preview-placeholder">原图黑白图</span>
            )}
          </div>
        </div>
      </aside>

      <div className="cyber-schemes-list">
        {schemes.map((scheme) => {
          const swatchColors = scheme.colorMap.enabled
            ? scheme.colorMap.freeColors.slice(0, 4)
            : palette.slice(0, 4).map((c) => c.hex)

          return (
            <article key={scheme.id} className="cyber-glass-panel cyber-scheme-card">
              <header className="cyber-scheme-head">
                <h3>{scheme.title}</h3>
                <div className="cyber-scheme-keywords">
                  {scheme.keywords.map((k) => (
                    <span key={`${scheme.id}-${k}`} className="cyber-scheme-keyword">{k}</span>
                  ))}
                </div>
              </header>

              <div className="cyber-scheme-body">
                <SchemePatternThumbs
                  scheme={scheme}
                  expressionSrc={expressionForms?.[scheme.expressionForm] ?? null}
                  imageSize={imageSize}
                  palette={palette}
                  offsetBrickRatio={offsetBrickRatio}
                  scaleGradientMin={scaleGradientMin}
                />

                <div className="cyber-scheme-side">
                  <div className="cyber-scheme-palette">
                    {swatchColors.map((hex) => (
                      <div key={`${scheme.id}-${hex}`} className="cyber-color-swatch">
                        <span style={{ background: hex }} aria-hidden="true" />
                        <small>{hex.toUpperCase()}</small>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="cyber-scheme-enter"
                    onClick={() => onEnterEdit(scheme.id)}
                  >
                    进入编辑
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
