import ControlPanel from '../components/ControlPanel'
import ColorMapPanel from '../components/ColorMapPanel'
import SampleCanvas from '../components/SampleCanvas'
import PatternPreview from '../components/PatternPreview'
import type {
  AppConfig,
  ColorMapState,
  ExpressionForm,
  PaletteColor,
  SampleBox,
  SampleShape,
  ScaleGradientDirection,
  TilingMode,
  UploadResult,
} from '../types'

interface Props {
  config: AppConfig | null
  uploadResult: UploadResult | null
  sessionId: string | null
  expressionForms: Record<ExpressionForm, string> | null
  processedExpressionSrc: string | null
  palette: PaletteColor[]
  colorMap: ColorMapState
  onColorMapChange: (v: ColorMapState) => void
  previewCanvas: HTMLCanvasElement | null
  onCanvasReady: (c: HTMLCanvasElement | null) => void
  reprocessing: boolean
  loading: boolean
  lineDetail: number
  onLineDetailChange: (v: number) => void
  expressionForm: ExpressionForm
  onExpressionFormChange: (f: ExpressionForm) => void
  outlineThickness: number
  onOutlineThicknessChange: (v: number) => void
  pixelDownscaleFactor: number
  onPixelDownscaleFactorChange: (v: number) => void
  sampleShape: SampleShape
  onSampleShapeChange: (s: SampleShape) => void
  tilingMode: TilingMode
  onTilingModeChange: (m: TilingMode) => void
  tileCols: number
  tileRows: number
  onTileColsChange: (v: number) => void
  onTileRowsChange: (v: number) => void
  kaleidoscopeSegments: number
  onKaleidoscopeSegmentsChange: (v: number) => void
  scaleGradientDirection: ScaleGradientDirection
  onScaleGradientDirectionChange: (d: ScaleGradientDirection) => void
  sampleBox: SampleBox
  onSampleBoxChange: (b: SampleBox) => void
  onBack: () => void
  onEnter3D: () => void
}

export default function PatternEditPage(props: Props) {
  const currentExpressionSrc = props.expressionForms?.[props.expressionForm] ?? null

  return (
    <div className="cyber-pattern-page">
      <aside className="cyber-glass-panel cyber-pattern-sidebar">
        <button
          type="button"
          className="cyber-btn-glass cyber-back-link"
          onClick={props.onBack}
        >
          ← 返回方案页
        </button>
        <div className="cyber-sidebar-scroll">
          <ControlPanel
            config={props.config}
            lineDetail={props.lineDetail}
            onLineDetailChange={props.onLineDetailChange}
            expressionForm={props.expressionForm}
            onExpressionFormChange={props.onExpressionFormChange}
            outlineThickness={props.outlineThickness}
            onOutlineThicknessChange={props.onOutlineThicknessChange}
            pixelDownscaleFactor={props.pixelDownscaleFactor}
            onPixelDownscaleFactorChange={props.onPixelDownscaleFactorChange}
            sampleShape={props.sampleShape}
            onSampleShapeChange={props.onSampleShapeChange}
            tilingMode={props.tilingMode}
            onTilingModeChange={props.onTilingModeChange}
            tileCols={props.tileCols}
            tileRows={props.tileRows}
            onTileColsChange={props.onTileColsChange}
            onTileRowsChange={props.onTileRowsChange}
            kaleidoscopeSegments={props.kaleidoscopeSegments}
            onKaleidoscopeSegmentsChange={props.onKaleidoscopeSegmentsChange}
            scaleGradientDirection={props.scaleGradientDirection}
            onScaleGradientDirectionChange={props.onScaleGradientDirectionChange}
            hasSession={!!props.sessionId}
            reprocessing={props.reprocessing || props.loading}
          />
          <ColorMapPanel
            palette={props.palette}
            colorMap={props.colorMap}
            onChange={props.onColorMapChange}
          />
        </div>
        <button
          type="button"
          className="cyber-btn-primary cyber-btn-3d-entry"
          disabled={!props.previewCanvas}
          onClick={props.onEnter3D}
        >
          进入3D预览
        </button>
      </aside>

      <div className="cyber-pattern-workspace">
        <div className="cyber-pattern-top">
          <div className="cyber-preview-frame">
            <span className="cyber-frame-label">原图</span>
            <SampleCanvas
              imageSrc={props.uploadResult?.original ?? null}
              sampleBox={props.sampleBox}
              sampleShape={props.sampleShape}
              imageSize={props.uploadResult?.image_size ?? null}
              onSampleBoxChange={props.onSampleBoxChange}
              showOverlay={!!props.sessionId}
              interactive={!!props.sessionId}
            />
          </div>
          <div className="cyber-preview-frame">
            <span className="cyber-frame-label">当前效果图</span>
            <SampleCanvas
              imageSrc={props.processedExpressionSrc}
              sampleBox={props.sampleBox}
              sampleShape={props.sampleShape}
              imageSize={props.uploadResult?.image_size ?? null}
              onSampleBoxChange={props.onSampleBoxChange}
              showOverlay={!!props.sessionId}
              interactive={!!props.sessionId}
              emptyText="切换视觉形态后显示。"
            />
          </div>
        </div>
        <div className="cyber-pattern-tile">
          <span className="cyber-frame-label">纹样平铺效果图</span>
          <PatternPreview
            expressionSrc={currentExpressionSrc}
            expressionForm={props.expressionForm}
            sampleBox={props.sampleBox}
            sampleShape={props.sampleShape}
            tilingMode={props.tilingMode}
            tileCols={props.tileCols}
            tileRows={props.tileRows}
            kaleidoscopeSegments={props.kaleidoscopeSegments}
            offsetBrickRatio={props.config?.offset_brick_ratio ?? 0.5}
            scaleGradientMin={props.config?.scale_gradient_min ?? 0.35}
            scaleGradientDirection={props.scaleGradientDirection}
            palette={props.palette}
            colorMap={props.colorMap}
            outlineThickness={props.outlineThickness}
            onCanvasReady={props.onCanvasReady}
          />
        </div>
      </div>
    </div>
  )
}
