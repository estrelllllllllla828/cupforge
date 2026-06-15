import { useRef, useState } from 'react'
import ControlPanel from '../components/ControlPanel'
import CupProfileEditor from '../components/CupProfileEditor'
import Cup3DPreview from '../components/Cup3DPreview'
import PatternPreview from '../components/PatternPreview'
import SampleCanvas from '../components/SampleCanvas'
import CupGradientEditor from '../components/CupGradientEditor'
import CupSurfaceRegionEditor from '../components/CupSurfaceRegionEditor'
import { downloadBlob } from '../api/client'
import { buildReliefCupStlBlob } from '../engine/cupStlExport'
import { sampleGradientStops } from '../engine/cupSurfaceColor'
import {
  CUP_SHAPE_PILLS,
  FALLBACK_CUP_CONFIG,
  createCupEditorState,
  pointsFromPreset,
} from './Cup3DPage'
import type {
  AppConfig,
  ColorMapState,
  CupConfig,
  CupEditorState,
  PaletteColor,
  SampleBox,
  SampleShape,
  ScaleGradientDirection,
  TilingMode,
  UploadResult,
} from '../types'

interface Props {
  config: AppConfig | null
  expressionSrc: string | null
  palette: PaletteColor[]
  colorMap: ColorMapState
  patternCanvas: HTMLCanvasElement | null
  onCanvasReady: (c: HTMLCanvasElement | null) => void
  schemeKeywords: string[]
  hasSession: boolean
  reprocessing: boolean
  lineDetail: number
  onLineDetailChange: (v: number) => void
  outlineThickness: number
  onOutlineThicknessChange: (v: number) => void
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
  uploadResult: UploadResult | null
}

/** 浮雕流程单页：纹样控件 + 3D 控件 + 3D 预览同屏 */
export default function ReliefStudioPage(props: Props) {
  const cupCfg: CupConfig = props.config?.cup ?? FALLBACK_CUP_CONFIG

  const [state, setState] = useState<CupEditorState>(() => createCupEditorState(cupCfg, 'relief'))
  const [exporting, setExporting] = useState(false)
  const preview3dRef = useRef<HTMLDivElement>(null)
  const resetViewRef = useRef<(() => void) | null>(null)

  const patch = (p: Partial<CupEditorState>) => setState((s) => ({ ...s, ...p }))

  const handleExport = async () => {
    if (!props.patternCanvas || props.patternCanvas.width <= 0) {
      alert('请先生成纹样后再导出带浮雕的 STL')
      return
    }
    if (state.reliefStrength <= 0) {
      alert('浮雕深度须大于 0')
      return
    }
    setExporting(true)
    try {
      const blob = buildReliefCupStlBlob({
        controlPoints: state.controlPoints,
        centerX: cupCfg.center_x,
        wallThickness: state.wallThickness,
        cupHeight: state.cupHeight,
        baseHeight: cupCfg.base_height,
        patternCanvas: props.patternCanvas,
        reliefStrength: state.reliefStrength,
        reliefDirection: state.reliefDirection,
        surfaceRegions: state.surfaceRegions,
      })
      downloadBlob(blob, 'cupforge_cup_relief.stl')
    } catch (e) {
      alert(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  const pickHexColor = (onPick: (hex: string) => void, initial = '#ffffff') => {
    const input = document.createElement('input')
    input.type = 'color'
    input.value = initial
    input.onchange = () => onPick(input.value)
    input.click()
  }

  const rgbaToHex = (r: number, g: number, b: number) => {
    const byte = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0')
    return `#${byte(r)}${byte(g)}${byte(b)}`
  }

  const selectSolidColor = () => {
    const [r, g, b] = sampleGradientStops(state.gradientStops, 0.5)
    patch({ colorStyle: 'solid', customColor: [r, g, b, 1] })
  }

  const selectGradientColor = () => {
    const [r, g, b] = state.customColor
    const hex = rgbaToHex(r, g, b)
    patch({
      colorStyle: 'gradient',
      gradientStops: state.gradientStops.map((stop, index) => (
        index === 0 ? { ...stop, color: hex } : stop
      )),
    })
  }

  const hasPattern = !!props.patternCanvas
  const shapeLabel = CUP_SHAPE_PILLS.find((s) => s.id === state.shapeId)?.label
    ?? cupCfg.shape_presets[state.shapeId]?.label
    ?? state.shapeId

  return (
    <div className="cyber-cup3d-page cyber-relief-page">
      <aside className="cyber-glass-panel cyber-cup3d-sidebar cyber-relief-sidebar">
        <div className="cyber-sidebar-scroll">
          <ControlPanel
            variant="relief"
            config={props.config}
            lineDetail={props.lineDetail}
            onLineDetailChange={props.onLineDetailChange}
            expressionForm="outline"
            onExpressionFormChange={() => {}}
            outlineThickness={props.outlineThickness}
            onOutlineThicknessChange={props.onOutlineThicknessChange}
            pixelDownscaleFactor={8}
            onPixelDownscaleFactorChange={() => {}}
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
            hasSession={props.hasSession}
            reprocessing={props.reprocessing}
          />

          <div className="panel-title">3D</div>

          <div className="cyber-cup-mini-controls">
            <label>杯型预设</label>
            <div className="cyber-pill-group">
              {CUP_SHAPE_PILLS.map(({ id, label }) => {
                const preset = cupCfg.shape_presets[id]
                if (!preset) return null
                return (
                  <button
                    key={id}
                    type="button"
                    className={`cyber-tag small ${state.shapeId === id ? 'active' : ''}`}
                    onClick={() => patch({ shapeId: id, controlPoints: pointsFromPreset(preset.points) })}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <label>杯壁厚度 <span>{state.wallThickness}</span></label>
            <input
              type="range"
              min={cupCfg.wall_thickness.min}
              max={cupCfg.wall_thickness.max}
              value={state.wallThickness}
              onChange={(e) => patch({ wallThickness: Number(e.target.value) })}
            />

            <label>杯壁高度 <span>{state.cupHeight}</span></label>
            <input
              type="range"
              min={cupCfg.height.min}
              max={cupCfg.height.max}
              value={state.cupHeight}
              onChange={(e) => patch({ cupHeight: Number(e.target.value) })}
            />

            <div className="cyber-surface-mode">
              <span className="cyber-surface-label">浮雕方向</span>
              <div className="cyber-segmented">
                <button
                  type="button"
                  className={state.reliefDirection === 'depressed' ? 'active' : ''}
                  onClick={() => patch({ reliefDirection: 'depressed' })}
                >
                  凹陷
                </button>
                <button
                  type="button"
                  className={state.reliefDirection === 'raised' ? 'active' : ''}
                  onClick={() => patch({ reliefDirection: 'raised' })}
                >
                  凸起
                </button>
              </div>
            </div>

            <label>浮雕深度 <span>{state.reliefStrength.toFixed(1)}</span></label>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.1}
              value={state.reliefStrength}
              onChange={(e) => patch({ reliefStrength: Number(e.target.value) })}
            />

            <div className="cyber-surface-mode">
              <span className="cyber-surface-label">杯体颜色</span>
              <div className="cyber-segmented">
                <button
                  type="button"
                  className={state.colorStyle === 'solid' ? 'active' : ''}
                  onClick={selectSolidColor}
                >
                  纯色
                </button>
                <button
                  type="button"
                  className={state.colorStyle === 'gradient' ? 'active' : ''}
                  onClick={selectGradientColor}
                >
                  渐变
                </button>
              </div>
            </div>

            {state.colorStyle === 'solid' ? (
              <label className="cyber-color-row">
                杯体颜色
                <button
                  type="button"
                  className="cyber-color-chip"
                  style={{
                    background: `rgb(${Math.round(state.customColor[0] * 255)}, ${Math.round(state.customColor[1] * 255)}, ${Math.round(state.customColor[2] * 255)})`,
                  }}
                  onClick={() => pickHexColor((hex) => {
                    const n = parseInt(hex.slice(1), 16)
                    patch({
                      customColor: [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1],
                    })
                  })}
                  aria-label="选择杯体颜色"
                />
              </label>
            ) : (
              <CupGradientEditor
                stops={state.gradientStops}
                onChange={(gradientStops) => patch({ gradientStops })}
              />
            )}

            <div className="cyber-cup-profile-block">
              <span className="cyber-surface-label">杯壁效果</span>
              <div className="cyber-cup2d-embed cyber-cup2d-embed-sm">
                <CupProfileEditor
                  controlPoints={state.controlPoints}
                  centerX={cupCfg.center_x}
                  wallThickness={state.wallThickness}
                  cupHeight={state.cupHeight}
                  baseHeight={cupCfg.base_height}
                  onControlPointsChange={(pts) => patch({ controlPoints: pts })}
                />
              </div>
              <CupSurfaceRegionEditor
                regions={state.surfaceRegions}
                onChange={(surfaceRegions) => patch({ surfaceRegions })}
                patternCanvas={props.patternCanvas}
                modeLabel="浮雕"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          className="cyber-btn-primary cyber-btn-export"
          disabled={exporting}
          onClick={handleExport}
        >
          {exporting ? '导出中…' : '导出浮雕 STL'}
        </button>
      </aside>

      <div className="cyber-relief-workspace">
        <div className="cyber-preview-frame">
          <span className="cyber-frame-label">原图</span>
          <SampleCanvas
            imageSrc={props.uploadResult?.original ?? null}
            sampleBox={props.sampleBox}
            sampleShape={props.sampleShape}
            imageSize={props.uploadResult?.image_size ?? null}
            onSampleBoxChange={props.onSampleBoxChange}
            showOverlay={props.hasSession}
            interactive={props.hasSession}
          />
        </div>
        <div className="cyber-relief-tile">
          <span className="cyber-frame-label">当前效果图</span>
          <PatternPreview
            expressionSrc={props.expressionSrc}
            expressionForm="outline"
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

      <div className="cyber-cup3d-viewport" ref={preview3dRef}>
        <div className="cyber-3d-toolbar">
          <span>3D预览图</span>
          <div>
            <button type="button" className="cyber-btn-glass small" onClick={() => resetViewRef.current?.()}>
              重置视角
            </button>
            <button type="button" className="cyber-btn-glass small" onClick={() => preview3dRef.current?.requestFullscreen?.()}>
              全屏模式
            </button>
          </div>
        </div>

        <Cup3DPreview
          controlPoints={state.controlPoints}
          centerX={cupCfg.center_x}
          wallThickness={state.wallThickness}
          cupHeight={state.cupHeight}
          baseHeight={cupCfg.base_height}
          customColor={state.customColor}
          patternCanvas={props.patternCanvas}
          surfaceMode={hasPattern ? 'relief' : 'plain'}
          reliefStrength={state.reliefStrength}
          reliefDirection={state.reliefDirection}
          colorStyle={state.colorStyle}
          gradientStops={state.gradientStops}
          surfaceRegions={state.surfaceRegions}
          onResetViewReady={(fn) => { resetViewRef.current = fn }}
        />

        <div className="cyber-3d-meta">
          <p>杯型参数：{shapeLabel} · 壁厚 {state.wallThickness} · 高度 {state.cupHeight}</p>
          <p>杯壁效果：图案浮雕（{state.reliefDirection === 'raised' ? '凸起' : '凹陷'} · 深度 {state.reliefStrength.toFixed(1)}）</p>
          <p>纹样风格：{props.schemeKeywords.join(' / ') || '自定义'}</p>
        </div>
      </div>
    </div>
  )
}
