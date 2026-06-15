export interface PaletteColor {
  rgb: number[]
  hex: string
  ratio: number
}

export interface ImageSize {
  w: number
  h: number
}

export type ExpressionForm = 'original' | 'outline' | 'pixel' | 'halftone' | 'silhouette'

export type SampleShape =
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'trapezoid'

export type ColorMapMode = 'auto' | 'tinted' | 'free'

export type ScaleGradientDirection = 'vertical' | 'horizontal'

export type TilingMode =
  | 'grid'
  | 'mirror_h'
  | 'mirror_v'
  | 'kaleidoscope'
  | 'offset_brick'
  | 'glide_reflection'
  | 'radial_4way'
  | 'scale_gradient'

export interface DetectedSubject {
  label: string
  confidence: number
}

export type WorkflowMode = 'texture' | 'relief'

export interface UploadResult {
  session_id: string
  original: string
  palette: PaletteColor[]
  image_size: ImageSize
  expression_forms: Record<ExpressionForm, string>
  default_form: ExpressionForm
  detected_subject?: DetectedSubject | null
}

export interface ReprocessResult {
  expression_forms: Record<ExpressionForm, string>
}

export interface AppConfig {
  canny: {
    t1_default: number
    t2_default: number
    t1_range: [number, number]
    t2_range: [number, number]
    detail_default: number
    detail_min: number
    detail_max: number
  }
  expression_forms: ExpressionForm[]
  expression_form_labels: Record<ExpressionForm, string>
  expression_form_default: ExpressionForm
  tiling_modes: string[]
  tiling_mode_labels: Record<string, string>
  kaleidoscope_angles: number[]
  sample_box_ratio_default: number
  offset_brick_ratio: number
  scale_gradient_min: number
  scale_gradient_directions: ScaleGradientDirection[]
  scale_gradient_direction_labels: Record<ScaleGradientDirection, string>
  scale_gradient_direction_default: ScaleGradientDirection
  outline_line_thickness: {
    default: number
    min: number
    max: number
  }
  pixel_downscale: {
    default: number
    min: number
    max: number
  }
  sample_shapes: SampleShape[]
  sample_shape_labels: Record<SampleShape, string>
  sample_min_size: number
  cup?: CupConfig
}

export type AppPage = 'landing' | 'upload' | 'schemes' | 'pattern-edit' | 'cup-3d' | 'relief-studio'

export type CupShapeId =
  | 'straight'
  | 'mug'
  | 'tea'
  | 'goblet'
  | 'vase'

export type CupMaterialId = 'metal' | 'wood' | 'glass' | 'ceramic' | 'matte'

export interface CupMaterialPresetDef {
  label: string
  rgba: [number, number, number, number]
  roughness: number
  metalness: number
}

export interface CupConfig {
  center_x: number
  base_height: number
  wall_thickness: { default: number; min: number; max: number }
  height: { default: number; min: number; max: number }
  shape_presets: Record<CupShapeId, { label: string; points: [number, number][] }>
  shape_default: CupShapeId
  material_presets: Record<CupMaterialId, CupMaterialPresetDef>
  material_default: CupMaterialId
}

export interface CupMeshRequest {
  control_points: [number, number][]
  center_x: number
  wall_thickness: number
  cup_height: number
}

export type CupSurfaceMode = 'plain' | 'texture' | 'relief'

export type ReliefDirection = 'raised' | 'depressed'

export type CupColorStyle = 'solid' | 'gradient'

/** 渐变色标：position 为 0–100，表示沿杯身高度（杯底→杯口）的位置 */
export interface GradientStop {
  id: string
  color: string
  position: number
}

export const DEFAULT_GRADIENT_STOPS: GradientStop[] = [
  { id: 'g0', color: '#f0f0ea', position: 0 },
  { id: 'g1', color: '#5eb8e8', position: 100 },
]

/** 杯身展开图上的贴图/浮雕区域（UV 0–1，u 环向，v 自杯底至杯口） */
export interface CupSurfaceRegion {
  id: string
  u0: number
  v0: number
  u1: number
  v1: number
}

export const DEFAULT_SURFACE_REGIONS: CupSurfaceRegion[] = [
  { id: 'sr0', u0: 0, v0: 0, u1: 1, v1: 1 },
]

export interface CupEditorState {
  shapeId: CupShapeId
  controlPoints: { x: number; y: number }[]
  wallThickness: number
  cupHeight: number
  customColor: [number, number, number, number]
  surfaceMode: CupSurfaceMode
  reliefStrength: number
  reliefDirection: ReliefDirection
  colorStyle: CupColorStyle
  gradientStops: GradientStop[]
  /** 有图案/浮雕的杯壁区域，可多块、不连续 */
  surfaceRegions: CupSurfaceRegion[]
}

export interface SampleBox {
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

export interface ColorMapState {
  enabled: boolean
  mode: ColorMapMode
  selectedPaletteIndices: number[]
  saturation: number
  contrast: number
  brightness: number
  /** 色温：负偏冷（偏蓝），正偏暖（偏黄/红） */
  temperature: number
  /** 色调：负偏绿，正偏品红 */
  tint: number
  freeColors: string[]
}

export const DEFAULT_COLOR_MAP: ColorMapState = {
  enabled: false,
  mode: 'auto',
  selectedPaletteIndices: [0, 1, 2, 3, 4],
  saturation: 100,
  contrast: 100,
  brightness: 0,
  temperature: 0,
  tint: 0,
  freeColors: ['#f5f5f0', '#2c3e50', '#3498db', '#f1c40f', '#e74c3c'],
}

export function createDefaultSampleBox(w: number, h: number, ratio: number): SampleBox {
  const sw = Math.round(w * ratio)
  const sh = Math.round(h * ratio)
  return {
    x: Math.round((w - sw) / 2),
    y: Math.round((h - sh) / 2),
    w: sw,
    h: sh,
    rotation: 0,
  }
}
