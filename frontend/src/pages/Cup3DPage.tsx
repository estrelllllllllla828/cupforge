import { useRef, useState } from 'react'
import CupProfileEditor from '../components/CupProfileEditor'
import CupSurfaceRegionEditor from '../components/CupSurfaceRegionEditor'
import Cup3DPreview from '../components/Cup3DPreview'
import { downloadBlob, exportCupMesh } from '../api/client'
import { buildTexturedCupObjZip } from '../engine/cupObjExport'
import { CUP_MATERIAL_DEFAULT, CUP_MATERIAL_PRESETS } from '../constants/cupMaterials'
import type { AppConfig, CupConfig, CupEditorState, CupShapeId } from '../types'
import { DEFAULT_GRADIENT_STOPS, DEFAULT_SURFACE_REGIONS } from '../types'

const DEFAULT_SOLID_COLOR: [number, number, number, number] = [0.94, 0.93, 0.88, 1]

/** 按设计稿展示的杯型预设（标签覆盖原始命名） */
export const CUP_SHAPE_PILLS: { id: CupShapeId; label: string }[] = [
  { id: 'straight', label: '直杯' },
  { id: 'tea', label: '茶杯' },
  { id: 'goblet', label: '酒杯' },
  { id: 'mug', label: '笔筒' },
  { id: 'vase', label: '花瓶' },
]

export const FALLBACK_CUP_CONFIG: CupConfig = {
  center_x: 280,
  base_height: 350,
  wall_thickness: { default: 12, min: 4, max: 40 },
  height: { default: 350, min: 220, max: 750 },
  shape_presets: {
    straight: { label: '直杯', points: [[200, 80], [203, 190], [206, 300], [209, 410], [212, 510]] },
    mug: { label: '笔筒', points: [[198, 80], [198, 150], [198, 230], [199, 300], [200, 360]] },
    tea: { label: '茶杯', points: [[180, 80], [184, 120], [198, 165], [222, 210], [250, 250]] },
    goblet: { label: '酒杯', points: [[222, 80], [202, 150], [234, 230], [268, 310], [268, 400], [260, 470], [208, 540]] },
    vase: { label: '花瓶', points: [[216, 80], [236, 150], [198, 230], [188, 320], [216, 420], [230, 510]] },
  },
  shape_default: 'straight',
  material_presets: CUP_MATERIAL_PRESETS,
  material_default: CUP_MATERIAL_DEFAULT,
}

export function pointsFromPreset(preset: [number, number][]) {
  return preset.map(([x, y]) => ({ x, y }))
}

export function createCupEditorState(cupCfg: CupConfig, surfaceMode: 'texture' | 'relief'): CupEditorState {
  const shapeId = cupCfg.shape_default as CupShapeId
  const preset = cupCfg.shape_presets[shapeId]
  return {
    shapeId,
    controlPoints: preset ? pointsFromPreset(preset.points) : [{ x: 200, y: 80 }, { x: 208, y: 500 }],
    wallThickness: cupCfg.wall_thickness.default,
    cupHeight: cupCfg.height.default,
    customColor: DEFAULT_SOLID_COLOR,
    surfaceMode,
    reliefStrength: 4,
    reliefDirection: 'raised',
    colorStyle: 'solid',
    gradientStops: DEFAULT_GRADIENT_STOPS.map((s) => ({ ...s })),
    surfaceRegions: DEFAULT_SURFACE_REGIONS.map((r) => ({ ...r })),
  }
}

interface Props {
  config: AppConfig | null
  patternCanvas: HTMLCanvasElement | null
  schemeKeywords: string[]
  onBack: () => void
}

/** 贴图流程 3D 预览页：杯型 + 厚度/高度 + 杯壁轮廓 + 导出 */
export default function Cup3DPage({
  config,
  patternCanvas,
  schemeKeywords,
  onBack,
}: Props) {
  const cupCfg: CupConfig = config?.cup ?? FALLBACK_CUP_CONFIG

  const [state, setState] = useState<CupEditorState>(() => createCupEditorState(cupCfg, 'texture'))
  const [exporting, setExporting] = useState<'stl' | 'obj' | null>(null)
  const preview3dRef = useRef<HTMLDivElement>(null)
  const resetViewRef = useRef<(() => void) | null>(null)

  const patch = (p: Partial<CupEditorState>) => setState((s) => ({ ...s, ...p }))

  const meshRequest = {
    control_points: state.controlPoints.map((p) => [p.x, p.y] as [number, number]),
    center_x: cupCfg.center_x,
    wall_thickness: state.wallThickness,
    cup_height: state.cupHeight,
  }

  const handleExportStl = async () => {
    setExporting('stl')
    try {
      const blob = await exportCupMesh('stl', meshRequest)
      downloadBlob(blob, 'cupforge_cup.stl')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'STL 导出失败')
    } finally {
      setExporting(null)
    }
  }

  const handleExportObj = async () => {
    setExporting('obj')
    try {
      const blob = await buildTexturedCupObjZip({
        controlPoints: state.controlPoints,
        centerX: cupCfg.center_x,
        wallThickness: state.wallThickness,
        cupHeight: state.cupHeight,
        baseHeight: cupCfg.base_height,
        patternCanvas,
        surfaceRegions: state.surfaceRegions,
        bodyColor: state.customColor,
      })
      downloadBlob(blob, 'cupforge_cup_textured.zip')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'OBJ 导出失败')
    } finally {
      setExporting(null)
    }
  }

  const handleFullscreen = () => {
    preview3dRef.current?.requestFullscreen?.()
  }

  const pickOutsideColor = () => {
    const [r, g, b] = state.customColor
    const initial = `#${[r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`
    const input = document.createElement('input')
    input.type = 'color'
    input.value = initial
    input.onchange = () => {
      const n = parseInt(input.value.slice(1), 16)
      patch({
        customColor: [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1],
      })
    }
    input.click()
  }

  const hasPattern = !!patternCanvas
  const shapeLabel = CUP_SHAPE_PILLS.find((s) => s.id === state.shapeId)?.label
    ?? cupCfg.shape_presets[state.shapeId]?.label
    ?? state.shapeId

  return (
    <div className="cyber-cup3d-page">
      <aside className="cyber-glass-panel cyber-cup3d-sidebar">
        <div className="cyber-sidebar-scroll">
          <button type="button" className="cyber-btn-glass cyber-back-link" onClick={onBack}>
            ← 返回纹样编辑
          </button>

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
        </div>

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
            patternCanvas={patternCanvas}
            modeLabel="贴图"
            allowEmptyRegions
            outsideColor={[state.customColor[0], state.customColor[1], state.customColor[2]]}
          />
          <label className="cyber-color-row">
            非贴图区域颜色
            <button
              type="button"
              className="cyber-color-chip"
              style={{
                background: `rgb(${Math.round(state.customColor[0] * 255)}, ${Math.round(state.customColor[1] * 255)}, ${Math.round(state.customColor[2] * 255)})`,
              }}
              onClick={pickOutsideColor}
              aria-label="选择非贴图区域颜色"
            />
          </label>
        </div>
        </div>

        <div className="cyber-export-actions">
          <button
            type="button"
            className="cyber-btn-primary cyber-btn-export"
            disabled={exporting !== null}
            onClick={handleExportStl}
          >
            {exporting === 'stl' ? '导出中…' : '导出 STL'}
          </button>
          <button
            type="button"
            className="cyber-btn-glass cyber-btn-export-secondary"
            disabled={exporting !== null}
            onClick={handleExportObj}
          >
            {exporting === 'obj' ? '打包中…' : '导出 OBJ（含贴图）'}
          </button>
        </div>
      </aside>

      <div className="cyber-cup3d-viewport" ref={preview3dRef}>
        <div className="cyber-3d-toolbar">
          <span>3D预览图</span>
          <div>
            <button type="button" className="cyber-btn-glass small" onClick={() => resetViewRef.current?.()}>
              重置视角
            </button>
            <button type="button" className="cyber-btn-glass small" onClick={handleFullscreen}>
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
          patternCanvas={patternCanvas}
          surfaceMode={hasPattern ? 'texture' : 'plain'}
          reliefStrength={state.reliefStrength}
          reliefDirection={state.reliefDirection}
          colorStyle={state.colorStyle}
          gradientStops={state.gradientStops}
          surfaceRegions={state.surfaceRegions}
          onResetViewReady={(fn) => { resetViewRef.current = fn }}
        />

        <div className="cyber-3d-meta">
          <p>杯型参数：{shapeLabel} · 壁厚 {state.wallThickness} · 高度 {state.cupHeight}</p>
          <p>纹样风格：{schemeKeywords.join(' / ') || '自定义'}</p>
        </div>
      </div>
    </div>
  )
}
