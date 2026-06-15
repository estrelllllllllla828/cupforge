import { useCallback, useEffect, useMemo, useState } from 'react'

import {

  fetchConfig,

  uploadImage,

  reprocessExpressions,

} from './api/client'

import CyberHeader from './components/layout/CyberHeader'

import LandingPage from './pages/LandingPage'

import UploadPage from './pages/UploadPage'

import SchemesPage from './pages/SchemesPage'

import PatternEditPage from './pages/PatternEditPage'

import Cup3DPage from './pages/Cup3DPage'

import ReliefStudioPage from './pages/ReliefStudioPage'

import {
  buildRandomSchemes,
  buildReliefDefaults,
  resolveDetectedBuilding,
  schemeToEditPatch,
} from './constants/schemes'

import { lineDetailToThresholds } from './engine/cannyParams'
import { loadProcessedExpression } from './engine/patternEngine'

import { useThrottleCallback } from './hooks/useThrottleCallback'

import type {

  AppConfig,

  AppPage,

  ColorMapState,

  ExpressionForm,

  PaletteColor,

  SampleBox,

  SampleShape,

  ScaleGradientDirection,

  TilingMode,

  UploadResult,

  WorkflowMode,

} from './types'

import { DEFAULT_COLOR_MAP, createDefaultSampleBox } from './types'



export default function App() {

  const [page, setPage] = useState<AppPage>('landing')

  const [config, setConfig] = useState<AppConfig | null>(null)

  const [sessionId, setSessionId] = useState<string | null>(null)

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  const [expressionForms, setExpressionForms] = useState<Record<ExpressionForm, string> | null>(null)

  const [palette, setPalette] = useState<PaletteColor[]>([])

  const [status, setStatus] = useState('')

  const [loading, setLoading] = useState(false)

  const [reprocessing, setReprocessing] = useState(false)

  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null)

  const [processedExpressionSrc, setProcessedExpressionSrc] = useState<string | null>(null)

  const [workflowMode, setWorkflowMode] = useState<WorkflowMode | null>(null)

  const [activeSchemeKeywords, setActiveSchemeKeywords] = useState<string[]>([])



  const [lineDetail, setLineDetail] = useState(25)

  const [expressionForm, setExpressionForm] = useState<ExpressionForm>('outline')

  const [outlineThickness, setOutlineThickness] = useState(2)

  const [pixelDownscaleFactor, setPixelDownscaleFactor] = useState(8)

  const [sampleShape, setSampleShape] = useState<SampleShape>('rect')

  const [tilingMode, setTilingMode] = useState<TilingMode>('grid')

  const [tileCols, setTileCols] = useState(4)

  const [tileRows, setTileRows] = useState(4)

  const [kaleidoscopeSegments, setKaleidoscopeSegments] = useState(6)

  const [scaleGradientDirection, setScaleGradientDirection] = useState<ScaleGradientDirection>('vertical')

  const [sampleBoxRatio, setSampleBoxRatio] = useState(0.25)

  const [sampleBox, setSampleBox] = useState<SampleBox>(createDefaultSampleBox(100, 100, 0.25))

  const [colorMap, setColorMap] = useState<ColorMapState>(DEFAULT_COLOR_MAP)



  useEffect(() => {

    fetchConfig().then((cfg) => {

      setConfig(cfg)

      setLineDetail(cfg.canny.detail_default ?? 25)

      setSampleBoxRatio(cfg.sample_box_ratio_default)

      setScaleGradientDirection(cfg.scale_gradient_direction_default)

      setExpressionForm(cfg.expression_form_default)

      setOutlineThickness(cfg.outline_line_thickness.default)

      setPixelDownscaleFactor(cfg.pixel_downscale.default)

    }).catch(() => setStatus('后端服务未连接'))

  }, [])



  useEffect(() => {

    if (!status) return

    const delay = status.startsWith('错误') ? 4000 : 2600

    const timer = window.setTimeout(() => setStatus(''), delay)

    return () => window.clearTimeout(timer)

  }, [status])



  const currentExpressionSrc = expressionForms?.[expressionForm]
    ?? (expressionForm === 'original' ? uploadResult?.original ?? null : null)



  useEffect(() => {

    if (!currentExpressionSrc) {

      setProcessedExpressionSrc(null)

      return

    }

    let cancelled = false

    const run = async () => {

      if (expressionForm === 'outline' && outlineThickness > 1) {

        const canvas = await loadProcessedExpression(currentExpressionSrc, true, outlineThickness)

        if (!cancelled) setProcessedExpressionSrc(canvas.toDataURL('image/png'))

      } else if (!cancelled) {

        setProcessedExpressionSrc(currentExpressionSrc)

      }

    }

    run()

    return () => { cancelled = true }

  }, [currentExpressionSrc, expressionForm, outlineThickness])



  const initSampleBox = useCallback((size: { w: number; h: number }, ratio: number) => {

    setSampleBox(createDefaultSampleBox(size.w, size.h, ratio))

  }, [])



  const cannyThresholds = useMemo(() => {
    if (!config) return { t1: 50, t2: 150 }
    return lineDetailToThresholds(lineDetail, {
      t1: config.canny.t1_range,
      t2: config.canny.t2_range,
    })
  }, [lineDetail, config])



  const handleUpload = useCallback(async (file: File) => {

    if (loading) return

    setLoading(true)

    setWorkflowMode(null)

    setStatus('正在上传并识别…')

    try {

      const { t1, t2 } = cannyThresholds
      const result = await uploadImage(file, t1, t2, pixelDownscaleFactor)

      setSessionId(result.session_id)

      setUploadResult(result)

      setExpressionForms(result.expression_forms)

      setPalette(result.palette)

      setExpressionForm(result.default_form)

      initSampleBox(result.image_size, sampleBoxRatio)

      setColorMap({

        ...DEFAULT_COLOR_MAP,

        selectedPaletteIndices: result.palette.map((_, i) => i),

        freeColors: result.palette.map((c) => c.hex).concat(DEFAULT_COLOR_MAP.freeColors).slice(0, 5),

      })

      const building = resolveDetectedBuilding(result.detected_subject)
      setStatus(
        result.detected_subject?.label
          ? `识别完成：${result.detected_subject.label}`
          : `上传完成（未识别工业主题，将使用「${building}」继续）`,
      )

    } catch (e) {

      setStatus(`错误: ${e instanceof Error ? e.message : '处理失败'}`)

    } finally {

      setLoading(false)

    }

  }, [loading, cannyThresholds, pixelDownscaleFactor, sampleBoxRatio, initSampleBox])



  const doReprocess = useCallback(async (t1: number, t2: number, pf: number) => {

    if (!sessionId) return

    setReprocessing(true)

    try {

      const result = await reprocessExpressions(sessionId, t1, t2, pf)

      setExpressionForms(result.expression_forms)

    } finally {

      setReprocessing(false)

    }

  }, [sessionId])



  const throttledReprocess = useThrottleCallback(doReprocess, 300)



  const handleLineDetailChange = (v: number) => {

    setLineDetail(v)

    if (sessionId && config) {

      const { t1, t2 } = lineDetailToThresholds(v, {
        t1: config.canny.t1_range,
        t2: config.canny.t2_range,
      })

      throttledReprocess(t1, t2, pixelDownscaleFactor)

    }

  }



  const handlePixelDownscaleFactorChange = (v: number) => {

    setPixelDownscaleFactor(v)

    if (sessionId) throttledReprocess(cannyThresholds.t1, cannyThresholds.t2, v)

  }



  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {

    setPreviewCanvas(canvas)

  }, [])



  const schemes = useMemo(() => {
    if (!uploadResult) return []
    const seed = uploadResult.session_id.split('').reduce(
      (acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0,
      0,
    )
    return buildRandomSchemes(
      resolveDetectedBuilding(uploadResult.detected_subject),
      uploadResult.image_size,
      uploadResult.palette,
      Math.abs(seed) || 1,
    )
  }, [uploadResult])

  const applyScheme = (schemeId: number) => {
    const scheme = schemes.find((s) => s.id === schemeId)
    if (!scheme) return

    const patch = schemeToEditPatch(scheme)
    setExpressionForm(patch.expressionForm)
    setTilingMode(patch.tilingMode)
    setTileCols(patch.tileCols)
    setTileRows(patch.tileRows)
    setSampleShape(patch.sampleShape)
    setSampleBox(patch.sampleBox)
    setSampleBoxRatio(patch.sampleBoxRatio)
    setColorMap(patch.colorMap)
    setOutlineThickness(patch.outlineThickness)
    setLineDetail(patch.lineDetail)
    setKaleidoscopeSegments(patch.kaleidoscopeSegments)
    setScaleGradientDirection(patch.scaleGradientDirection)
    setPixelDownscaleFactor(patch.pixelDownscaleFactor)
    setActiveSchemeKeywords(patch.activeSchemeKeywords)

    if (sessionId && config && scheme.expressionForm === 'outline') {
      const { t1, t2 } = lineDetailToThresholds(scheme.lineDetail, {
        t1: config.canny.t1_range,
        t2: config.canny.t2_range,
      })
      doReprocess(t1, t2, scheme.pixelDownscaleFactor)
    } else if (sessionId && scheme.expressionForm === 'pixel') {
      doReprocess(cannyThresholds.t1, cannyThresholds.t2, scheme.pixelDownscaleFactor)
    }
  }



  const handleNavigate = (target: AppPage) => {

    setPage(target)

  }



  return (

    <div className={`cyber-app ${page}`}>

      <CyberHeader page={page} onNavigate={handleNavigate} />



      {page === 'landing' && (

        <LandingPage onStart={() => setPage('upload')} />

      )}



      {page === 'upload' && (

        <UploadPage

          thumbnail={uploadResult?.original ?? null}

          detectedSubject={uploadResult?.detected_subject ?? null}

          workflowMode={workflowMode}

          loading={loading}

          onWorkflowModeChange={setWorkflowMode}

          onUpload={handleUpload}

          onGenerate={() => {

            if (!uploadResult) {

              setStatus('请先上传图片')

              return

            }

            if (!workflowMode) {

              setStatus('请选择贴图或浮雕')

              return

            }

            const building = resolveDetectedBuilding(uploadResult.detected_subject)

            if (workflowMode === 'texture') {

              setPage('schemes')

              return

            }

            const defaults = buildReliefDefaults(building)

            setExpressionForm(defaults.expressionForm)

            setTilingMode(defaults.tilingMode)

            setTileCols(defaults.tileCols)

            setTileRows(defaults.tileRows)

            setActiveSchemeKeywords(defaults.keywords)

            setPage('relief-studio')

          }}

        />

      )}



      {page === 'schemes' && (

        <SchemesPage

          schemes={schemes}

          originalSrc={uploadResult?.original ?? null}

          bwSrc={expressionForms?.outline ?? null}

          imageSize={uploadResult?.image_size ?? null}

          palette={palette}

          expressionForms={expressionForms}

          offsetBrickRatio={config?.offset_brick_ratio ?? 0.5}

          scaleGradientMin={config?.scale_gradient_min ?? 0.35}

          onEnterEdit={(id) => {

            applyScheme(id)

            setPage('pattern-edit')

          }}

        />

      )}



      {page === 'pattern-edit' && (

        <PatternEditPage

          config={config}

          uploadResult={uploadResult}

          sessionId={sessionId}

          expressionForms={expressionForms}

          processedExpressionSrc={processedExpressionSrc}

          palette={palette}

          colorMap={colorMap}

          onColorMapChange={setColorMap}

          previewCanvas={previewCanvas}

          onCanvasReady={handleCanvasReady}

          reprocessing={reprocessing}

          loading={loading}

          lineDetail={lineDetail}

          onLineDetailChange={handleLineDetailChange}

          expressionForm={expressionForm}

          onExpressionFormChange={setExpressionForm}

          outlineThickness={outlineThickness}

          onOutlineThicknessChange={setOutlineThickness}

          pixelDownscaleFactor={pixelDownscaleFactor}

          onPixelDownscaleFactorChange={handlePixelDownscaleFactorChange}

          sampleShape={sampleShape}

          onSampleShapeChange={setSampleShape}

          tilingMode={tilingMode}

          onTilingModeChange={setTilingMode}

          tileCols={tileCols}

          tileRows={tileRows}

          onTileColsChange={setTileCols}

          onTileRowsChange={setTileRows}

          kaleidoscopeSegments={kaleidoscopeSegments}

          onKaleidoscopeSegmentsChange={setKaleidoscopeSegments}

          scaleGradientDirection={scaleGradientDirection}

          onScaleGradientDirectionChange={setScaleGradientDirection}

          sampleBox={sampleBox}

          onSampleBoxChange={setSampleBox}

          onBack={() => setPage('schemes')}

          onEnter3D={() => {

            if (!previewCanvas) return

            setPage('cup-3d')

          }}

        />

      )}



      {page === 'cup-3d' && (

        <Cup3DPage

          config={config}

          patternCanvas={previewCanvas}

          schemeKeywords={activeSchemeKeywords}

          onBack={() => setPage('pattern-edit')}

        />

      )}



      {page === 'relief-studio' && (

        <ReliefStudioPage

          config={config}

          expressionSrc={expressionForms?.outline ?? null}

          palette={palette}

          colorMap={colorMap}

          patternCanvas={previewCanvas}

          onCanvasReady={handleCanvasReady}

          schemeKeywords={activeSchemeKeywords}

          hasSession={!!sessionId}

          reprocessing={reprocessing || loading}

          lineDetail={lineDetail}

          onLineDetailChange={handleLineDetailChange}

          outlineThickness={outlineThickness}

          onOutlineThicknessChange={setOutlineThickness}

          sampleShape={sampleShape}

          onSampleShapeChange={setSampleShape}

          tilingMode={tilingMode}

          onTilingModeChange={setTilingMode}

          tileCols={tileCols}

          tileRows={tileRows}

          onTileColsChange={setTileCols}

          onTileRowsChange={setTileRows}

          kaleidoscopeSegments={kaleidoscopeSegments}

          onKaleidoscopeSegmentsChange={setKaleidoscopeSegments}

          scaleGradientDirection={scaleGradientDirection}

          onScaleGradientDirectionChange={setScaleGradientDirection}

          sampleBox={sampleBox}

          onSampleBoxChange={setSampleBox}

          uploadResult={uploadResult}

        />

      )}



      {status && page !== 'landing' && (

        <div className="cyber-toast">{status}</div>

      )}

    </div>

  )

}


