import { EXPRESSION_FORM_LABELS, EXPRESSION_FORM_ORDER } from '../constants/expressionForms'
import TileGridPicker from './TileGridPicker'
import type { AppConfig, ExpressionForm, SampleShape, ScaleGradientDirection, TilingMode } from '../types'

interface Props {
  /** texture：完整视觉区（线条形式可切换）；relief：固定线稿，仅密集程度/粗细 */
  variant?: 'texture' | 'relief'
  config: AppConfig | null
  lineDetail: number
  onLineDetailChange: (v: number) => void
  expressionForm: ExpressionForm
  onExpressionFormChange: (form: ExpressionForm) => void
  outlineThickness: number
  onOutlineThicknessChange: (v: number) => void
  pixelDownscaleFactor: number
  onPixelDownscaleFactorChange: (v: number) => void
  sampleShape: SampleShape
  onSampleShapeChange: (shape: SampleShape) => void
  tilingMode: TilingMode
  onTilingModeChange: (mode: TilingMode) => void
  tileCols: number
  tileRows: number
  onTileColsChange: (v: number) => void
  onTileRowsChange: (v: number) => void
  kaleidoscopeSegments: number
  onKaleidoscopeSegmentsChange: (v: number) => void
  scaleGradientDirection: ScaleGradientDirection
  onScaleGradientDirectionChange: (direction: ScaleGradientDirection) => void
  hasSession: boolean
  reprocessing: boolean
}

const FALLBACK_TILING_LABELS: Record<TilingMode, string> = {
  grid: '普通平铺',
  mirror_h: '水平镜像',
  mirror_v: '垂直镜像',
  kaleidoscope: '旋转万花筒',
  offset_brick: '错位砖墙',
  glide_reflection: '移步互换',
  radial_4way: '四轴中心对称',
  scale_gradient: '比例渐变',
}

const SHAPE_GLYPHS: Record<SampleShape, string> = {
  rect: '■',
  circle: '●',
  triangle: '▲',
  diamond: '◆',
  trapezoid: '⏢',
}

function SliderControl({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="control-group">
      <label>
        {label}
        <span className="value-display">{typeof value === 'number' && step < 1 ? value.toFixed(2) : value}</span>
      </label>
      {hint && <p className="slider-hint">{hint}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export default function ControlPanel({
  variant = 'texture',
  config,
  lineDetail,
  onLineDetailChange,
  expressionForm,
  onExpressionFormChange,
  outlineThickness,
  onOutlineThicknessChange,
  pixelDownscaleFactor,
  onPixelDownscaleFactorChange,
  sampleShape,
  onSampleShapeChange,
  tilingMode,
  onTilingModeChange,
  tileCols,
  tileRows,
  onTileColsChange,
  onTileRowsChange,
  kaleidoscopeSegments,
  onKaleidoscopeSegmentsChange,
  scaleGradientDirection,
  onScaleGradientDirectionChange,
  hasSession,
  reprocessing,
}: Props) {
  const tilingLabels = { ...FALLBACK_TILING_LABELS, ...(config?.tiling_mode_labels ?? {}) }
  const expressionLabels = { ...EXPRESSION_FORM_LABELS, ...(config?.expression_form_labels ?? {}) }
  const expressionForms = config?.expression_forms?.length
    ? config.expression_forms
    : EXPRESSION_FORM_ORDER

  const lineSliders = (
    <>
      <SliderControl
        label="密集程度"
        hint="数值越低线条越多越密，越高则线条更精简"
        value={lineDetail}
        min={config?.canny.detail_min ?? 0}
        max={config?.canny.detail_max ?? 100}
        onChange={onLineDetailChange}
      />
      <SliderControl
        label="线条粗细"
        value={outlineThickness}
        min={config?.outline_line_thickness.min ?? 1}
        max={config?.outline_line_thickness.max ?? 6}
        onChange={onOutlineThicknessChange}
      />
      {reprocessing && <p className="reprocess-hint">正在重算线稿…</p>}
    </>
  )

  const visualSection = (
    <>
      <div className="panel-title">视觉</div>

      {variant === 'texture' && (
        <div className="control-group">
          <label>线条形式</label>
          <div className="cyber-pill-group">
            {expressionForms.map((f) => (
              <button
                key={f}
                type="button"
                className={`cyber-tag small ${expressionForm === f ? 'active' : ''}`}
                disabled={!hasSession}
                onClick={() => onExpressionFormChange(f as ExpressionForm)}
              >
                {expressionLabels[f as ExpressionForm] ?? f}
              </button>
            ))}
          </div>
        </div>
      )}

      {(variant === 'relief' || expressionForm === 'outline') && config && lineSliders}

      {variant === 'texture' && expressionForm === 'pixel' && config && (
        <SliderControl
          label="像素化程度"
          hint="数值越大，像素块越大、细节越少"
          value={pixelDownscaleFactor}
          min={config.pixel_downscale.min}
          max={config.pixel_downscale.max}
          onChange={onPixelDownscaleFactorChange}
        />
      )}
    </>
  )

  const arraySection = (
    <>
      <div className="panel-title">排列</div>

      <div className="control-group">
        <label>阵列模式</label>
        <div className="cyber-pill-group">
          {(config?.tiling_modes ?? Object.keys(FALLBACK_TILING_LABELS)).map((m) => (
            <button
              key={m}
              type="button"
              className={`cyber-tag small ${tilingMode === m ? 'active' : ''}`}
              disabled={!hasSession}
              onClick={() => onTilingModeChange(m as TilingMode)}
            >
              {tilingLabels[m as TilingMode] ?? m}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <label>取样形状</label>
        <div className="cyber-pill-group cyber-shape-pills">
          {(config?.sample_shapes ?? ['rect']).map((s) => (
            <button
              key={s}
              type="button"
              className={`cyber-tag cyber-shape-pill ${sampleShape === s ? 'active' : ''}`}
              disabled={!hasSession}
              title={config?.sample_shape_labels[s as SampleShape] ?? s}
              aria-label={config?.sample_shape_labels[s as SampleShape] ?? s}
              onClick={() => onSampleShapeChange(s as SampleShape)}
            >
              {SHAPE_GLYPHS[s as SampleShape] ?? s}
            </button>
          ))}
        </div>
      </div>

      <p className="slider-hint">
        在原图上直接拖动取样框可移动；拖动边角调整大小；拖动顶部蓝色圆点可旋转角度。
      </p>

      <div className="control-group">
        <label>取样框（行列数）</label>
        <TileGridPicker
          cols={tileCols}
          rows={tileRows}
          disabled={!hasSession}
          onChange={(c, r) => {
            onTileColsChange(c)
            onTileRowsChange(r)
          }}
        />
      </div>

      {tilingMode === 'kaleidoscope' && (
        <SliderControl
          label="万花筒分段数"
          hint="每个单元为一段放射对称图案，列×行决定平铺数量"
          value={kaleidoscopeSegments}
          min={3}
          max={12}
          onChange={onKaleidoscopeSegmentsChange}
        />
      )}

      {tilingMode === 'scale_gradient' && (
        <div className="control-group">
          <label>渐变方向</label>
          <div className="cyber-pill-group">
            {(config?.scale_gradient_directions ?? ['vertical', 'horizontal']).map((d) => (
              <button
                key={d}
                type="button"
                className={`cyber-tag small ${scaleGradientDirection === d ? 'active' : ''}`}
                disabled={!hasSession}
                onClick={() => onScaleGradientDirectionChange(d as ScaleGradientDirection)}
              >
                {config?.scale_gradient_direction_labels[d as ScaleGradientDirection] ?? d}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )

  return variant === 'relief' ? (
    <>
      {arraySection}
      {visualSection}
    </>
  ) : (
    <>
      {visualSection}
      {arraySection}
    </>
  )
}
