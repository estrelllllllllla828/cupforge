import type { ColorMapState, PaletteColor } from '../types'

function seededRandom(seed: number): () => number {
  let state = Math.abs(seed) % 2147483646 || 1
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

function shufflePickIndices(length: number, count: number, rand: () => number): number[] {
  const indices = Array.from({ length }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.slice(0, Math.min(count, length))
}

/** 基于上传色卡为方案缩略图生成随机染色配置（保留纹样明暗结构） */
export function createRandomSchemeColorMap(
  palette: PaletteColor[],
  seed: number,
): ColorMapState {
  const rand = seededRandom(seed)

  if (!palette.length) {
    return {
      enabled: true,
      mode: 'free',
      selectedPaletteIndices: [],
      saturation: 100,
      contrast: 100,
      brightness: 0,
      temperature: 0,
      tint: 0,
      freeColors: ['#f5f5f0', '#2c3e50', '#3498db', '#f1c40f'],
    }
  }

  const pickCount = Math.max(2, Math.min(palette.length, 2 + Math.floor(rand() * 3)))
  const pickedIndices = shufflePickIndices(palette.length, pickCount, rand)
  const useTinted = rand() > 0.35

  if (useTinted) {
    return {
      enabled: true,
      mode: 'tinted',
      selectedPaletteIndices: pickedIndices,
      saturation: Math.round(80 + rand() * 40),
      contrast: Math.round(88 + rand() * 28),
      brightness: Math.round(-12 + rand() * 24),
      temperature: Math.round(-30 + rand() * 60),
      tint: Math.round(-20 + rand() * 40),
      freeColors: pickedIndices.map((i) => palette[i].hex),
    }
  }

  return {
    enabled: true,
    mode: 'free',
    selectedPaletteIndices: pickedIndices,
    saturation: 100,
    contrast: 100,
    brightness: Math.round(-8 + rand() * 16),
    temperature: 0,
    tint: 0,
    freeColors: pickedIndices.map((i) => palette[i].hex),
  }
}

export function pickPaletteBackground(
  palette: PaletteColor[],
  seed: number,
): [number, number, number] {
  if (!palette.length) return [245, 245, 240]
  const rand = seededRandom(seed + 9137)
  const idx = Math.floor(rand() * palette.length)
  const [r, g, b] = palette[idx].rgb
  return [r, g, b]
}
