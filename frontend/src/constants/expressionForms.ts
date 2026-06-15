import type { ExpressionForm } from '../types'

export const EXPRESSION_FORM_LABELS: Record<ExpressionForm, string> = {
  original: '原图模式',
  outline: '纯粹线稿',
  pixel: '复古像素化',
  halftone: '报纸半调',
  silhouette: '高反差剪影',
}

export const EXPRESSION_FORM_ORDER: ExpressionForm[] = [
  'original',
  'outline',
  'pixel',
  'halftone',
  'silhouette',
]
