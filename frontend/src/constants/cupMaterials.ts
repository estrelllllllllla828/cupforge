import type { CupMaterialId } from '../types'

export interface CupMaterialPreset {
  label: string
  rgba: [number, number, number, number]
  roughness: number
  metalness: number
}

export const CUP_MATERIAL_PRESETS: Record<CupMaterialId, CupMaterialPreset> = {
  metal: {
    label: '金属',
    rgba: [0.78, 0.79, 0.82, 1],
    roughness: 0.26,
    metalness: 0.92,
  },
  wood: {
    label: '木质',
    rgba: [0.52, 0.34, 0.2, 1],
    roughness: 0.82,
    metalness: 0.04,
  },
  glass: {
    label: '玻璃',
    rgba: [0.72, 0.86, 0.94, 0.42],
    roughness: 0.06,
    metalness: 0.08,
  },
  ceramic: {
    label: '陶瓷',
    rgba: [0.94, 0.93, 0.88, 1],
    roughness: 0.42,
    metalness: 0.06,
  },
  matte: {
    label: '磨砂',
    rgba: [0.38, 0.4, 0.44, 1],
    roughness: 0.94,
    metalness: 0.03,
  },
}

export const CUP_MATERIAL_DEFAULT: CupMaterialId = 'ceramic'

export function getCupMaterialPreset(id: CupMaterialId): CupMaterialPreset {
  return CUP_MATERIAL_PRESETS[id] ?? CUP_MATERIAL_PRESETS.ceramic
}
