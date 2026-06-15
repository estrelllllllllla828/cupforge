import { EXPRESSION_FORM_LABELS } from './expressionForms'
import { createRandomSchemeColorMap } from '../engine/schemeThumbColor'
import { seededRandom } from '../engine/random'
import { clampBox, MIN_SAMPLE_SIZE } from '../engine/sampleRegion'
import type {
  ColorMapState,
  DetectedSubject,
  ExpressionForm,
  ImageSize,
  PaletteColor,
  SampleBox,
  SampleShape,
  ScaleGradientDirection,
  TilingMode,
} from '../types'

/** 识别失败或低置信度时的默认工业主题 */
export const DEFAULT_DETECTED_BUILDING = '工业建筑'

export function resolveDetectedBuilding(subject?: DetectedSubject | null): string {
  const label = subject?.label?.trim()
  if (!label || label === DEFAULT_DETECTED_BUILDING) {
    return DEFAULT_DETECTED_BUILDING
  }
  return label
}

export interface SchemePreset {
  id: number
  title: string
  keywords: string[]
  expressionForm: ExpressionForm
  tilingMode: TilingMode
  tileCols: number
  tileRows: number
  sampleShape: SampleShape
  sampleBox: SampleBox
  sampleBoxRatio: number
  colorMap: ColorMapState
  outlineThickness: number
  lineDetail: number
  kaleidoscopeSegments: number
  scaleGradientDirection: ScaleGradientDirection
  pixelDownscaleFactor: number
}

const SCHEME_EXPRESSION_FORMS: ExpressionForm[] = ['outline', 'silhouette', 'halftone', 'pixel']

const TILING_OPTIONS: { mode: TilingMode; label: string }[] = [
  { mode: 'grid', label: '平铺' },
  { mode: 'mirror_h', label: '水平镜像' },
  { mode: 'mirror_v', label: '垂直镜像' },
  { mode: 'offset_brick', label: '错位砖墙' },
  { mode: 'glide_reflection', label: '移步互换' },
  { mode: 'scale_gradient', label: '比例渐变' },
  { mode: 'kaleidoscope', label: '旋转万花筒' },
  { mode: 'radial_4way', label: '四轴对称' },
]

const SAMPLE_SHAPES: SampleShape[] = ['rect', 'circle', 'triangle', 'diamond', 'trapezoid']

const SHAPE_LABELS: Record<SampleShape, string> = {
  rect: '矩形',
  circle: '圆形',
  triangle: '三角',
  diamond: '菱形',
  trapezoid: '梯形',
}

function pickUnique<T>(pool: T[], used: Set<T>, rand: () => number): T {
  const available = pool.filter((item) => !used.has(item))
  const source = available.length > 0 ? available : pool
  return source[Math.floor(rand() * source.length)]
}

function randomSampleBox(imageSize: ImageSize, rand: () => number): SampleBox {
  const ratio = 0.18 + rand() * 0.32
  const w = Math.max(MIN_SAMPLE_SIZE, Math.round(imageSize.w * ratio))
  const h = Math.max(MIN_SAMPLE_SIZE, Math.round(imageSize.h * ratio))
  const maxX = Math.max(0, imageSize.w - w)
  const maxY = Math.max(0, imageSize.h - h)
  return clampBox(
    {
      x: Math.round(rand() * maxX),
      y: Math.round(rand() * maxY),
      w,
      h,
      rotation: Math.round(rand() * 360),
    },
    imageSize.w,
    imageSize.h,
    MIN_SAMPLE_SIZE,
  )
}

function sampleBoxRatio(box: SampleBox, imageSize: ImageSize): number {
  return Math.max(box.w / imageSize.w, box.h / imageSize.h)
}

/** 贴图流程：为每次上传随机生成 3 套互不相同的纹样方案 */
export function buildRandomSchemes(
  detectedBuilding: string,
  imageSize: ImageSize,
  palette: PaletteColor[],
  seed: number,
): SchemePreset[] {
  const rand = seededRandom(seed)
  const usedForms = new Set<ExpressionForm>()
  const usedTiling = new Set<TilingMode>()
  const usedShapes = new Set<SampleShape>()

  return [1, 2, 3].map((id) => {
    const expressionForm = pickUnique(SCHEME_EXPRESSION_FORMS, usedForms, rand)
    usedForms.add(expressionForm)

    const tilingAvailable = TILING_OPTIONS.filter((t) => !usedTiling.has(t.mode))
    const tilingPool = tilingAvailable.length > 0 ? tilingAvailable : TILING_OPTIONS
    const tilingChoice = tilingPool[Math.floor(rand() * tilingPool.length)]
    usedTiling.add(tilingChoice.mode)

    const shapeAvailable = SAMPLE_SHAPES.filter((s) => !usedShapes.has(s))
    const shapePool = shapeAvailable.length > 0 ? shapeAvailable : SAMPLE_SHAPES
    const sampleShape = shapePool[Math.floor(rand() * shapePool.length)]
    usedShapes.add(sampleShape)

    const sampleBox = randomSampleBox(imageSize, rand)
    const tileCols = 2 + Math.floor(rand() * 5)
    const tileRows = 2 + Math.floor(rand() * 5)
    const outlineThickness = 1 + Math.floor(rand() * 4)
    const lineDetail = 10 + Math.floor(rand() * 61)
    const kaleidoscopeSegments = 3 + Math.floor(rand() * 10)
    const scaleGradientDirection: ScaleGradientDirection = rand() > 0.5 ? 'vertical' : 'horizontal'
    const pixelDownscaleFactor = 4 + Math.floor(rand() * 9)
    const colorMap = createRandomSchemeColorMap(palette, id * 10007 + seed)

    const keywords = [
      detectedBuilding,
      EXPRESSION_FORM_LABELS[expressionForm],
      tilingChoice.label,
      SHAPE_LABELS[sampleShape],
    ]

    return {
      id,
      title: `方案 ${id}`,
      keywords,
      expressionForm,
      tilingMode: tilingChoice.mode,
      tileCols,
      tileRows,
      sampleShape,
      sampleBox,
      sampleBoxRatio: sampleBoxRatio(sampleBox, imageSize),
      colorMap,
      outlineThickness,
      lineDetail,
      kaleidoscopeSegments,
      scaleGradientDirection,
      pixelDownscaleFactor,
    }
  })
}

/**
 * 为同一方案生成多个取样框变体：仅位置 / 大小 / 角度不同，其余参数一致。
 * 第 1 个为方案自身取样框（与进入编辑后一致），其余为随机变体。
 */
export function buildSchemeSampleVariants(
  scheme: SchemePreset,
  imageSize: ImageSize,
  count: number,
): SampleBox[] {
  const variants: SampleBox[] = [scheme.sampleBox]
  const rand = seededRandom(scheme.id * 92821 + 7)
  while (variants.length < count) {
    variants.push(randomSampleBox(imageSize, rand))
  }
  return variants.slice(0, count)
}

/** 浮雕流程默认纹样参数 */
export function buildReliefDefaults(detectedBuilding: string) {
  return {
    expressionForm: 'outline' as ExpressionForm,
    tilingMode: 'grid' as TilingMode,
    tileCols: 4,
    tileRows: 4,
    keywords: [detectedBuilding, '线稿', '浮雕'],
  }
}

/** 将方案参数完整同步到编辑页状态 */
export function schemeToEditPatch(scheme: SchemePreset) {
  return {
    expressionForm: scheme.expressionForm,
    tilingMode: scheme.tilingMode,
    tileCols: scheme.tileCols,
    tileRows: scheme.tileRows,
    sampleShape: scheme.sampleShape,
    sampleBox: scheme.sampleBox,
    sampleBoxRatio: scheme.sampleBoxRatio,
    colorMap: scheme.colorMap,
    outlineThickness: scheme.outlineThickness,
    lineDetail: scheme.lineDetail,
    kaleidoscopeSegments: scheme.kaleidoscopeSegments,
    scaleGradientDirection: scheme.scaleGradientDirection,
    pixelDownscaleFactor: scheme.pixelDownscaleFactor,
    activeSchemeKeywords: scheme.keywords,
  }
}
