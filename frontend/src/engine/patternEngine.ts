import type { ColorMapState, PaletteColor, SampleBox, SampleShape, ScaleGradientDirection, TilingMode } from '../types'
import { buildClipPath, clampBox, MIN_SAMPLE_SIZE } from './sampleRegion'

export type { SampleBox }

export interface TilingParams {
  mode: TilingMode
  cols: number
  rows: number
  kaleidoscopeSegments: number
  offsetBrickRatio: number
  scaleGradientMin: number
  scaleGradientDirection: ScaleGradientDirection
}

export interface PatternBuildOptions {
  sampleBox: SampleBox
  sampleShape: SampleShape
  tiling: TilingParams
  palette: PaletteColor[]
  colorMap: ColorMapState
  outlineThickness: number
  isOutline: boolean
  tileBackground: [number, number, number]
}

function clampBoxToImage(box: SampleBox, imgW: number, imgH: number): SampleBox {
  if (imgW <= 0 || imgH <= 0) return box
  return clampBox(box, imgW, imgH, MIN_SAMPLE_SIZE)
}

export function rotateCanvas(src: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  if (Math.abs(degrees) < 0.5) return src
  const rad = (degrees * Math.PI) / 180
  const sin = Math.abs(Math.sin(rad))
  const cos = Math.abs(Math.cos(rad))
  const nw = Math.ceil(src.width * cos + src.height * sin)
  const nh = Math.ceil(src.width * sin + src.height * cos)
  const out = document.createElement('canvas')
  out.width = Math.max(1, nw)
  out.height = Math.max(1, nh)
  const ctx = out.getContext('2d')!
  ctx.translate(nw / 2, nh / 2)
  ctx.rotate(rad)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return out
}

export function extractSample(
  source: CanvasImageSource,
  imgW: number,
  imgH: number,
  box: SampleBox,
  shape: SampleShape,
): HTMLCanvasElement {
  const safe = clampBoxToImage(box, imgW, imgH)
  const canvas = document.createElement('canvas')
  canvas.width = safe.w
  canvas.height = safe.h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, safe.w, safe.h)
  buildClipPath(ctx, shape, safe.w, safe.h)
  ctx.clip()
  ctx.drawImage(source, safe.x, safe.y, safe.w, safe.h, 0, 0, safe.w, safe.h)
  const rot = safe.rotation ?? 0
  return rot !== 0 ? rotateCanvas(canvas, rot) : canvas
}

export function applyOutlineThickness(
  source: CanvasImageSource,
  thickness: number,
): HTMLCanvasElement {
  const w = 'naturalWidth' in source ? source.naturalWidth : (source as HTMLCanvasElement).width
  const h = 'naturalHeight' in source ? source.naturalHeight : (source as HTMLCanvasElement).height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0)

  if (thickness <= 1) return canvas

  const imgData = ctx.getImageData(0, 0, w, h)
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    const lum = 0.299 * imgData.data[o] + 0.587 * imgData.data[o + 1] + 0.114 * imgData.data[o + 2]
    mask[i] = lum >= 128 ? 1 : 0
  }

  const dilated = new Uint8Array(w * h)
  const r = thickness - 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0
      for (let dy = -r; dy <= r && !on; dy++) {
        for (let dx = -r; dx <= r && !on; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny * w + nx]) on = 1
        }
      }
      dilated[y * w + x] = on
    }
  }

  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    if (dilated[i]) {
      imgData.data[o] = 255
      imgData.data[o + 1] = 255
      imgData.data[o + 2] = 255
    } else {
      imgData.data[o] = 0
      imgData.data[o + 1] = 0
      imgData.data[o + 2] = 0
    }
    imgData.data[o + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas
}

function nearestPaletteIndex(r: number, g: number, b: number, palette: PaletteColor[]): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i].rgb
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s * 100, l * 100]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

function applyColorAdjustments(
  r: number, g: number, b: number,
  saturation: number, contrast: number, brightness: number,
  temperature = 0, tint = 0,
): [number, number, number] {
  let [h, s, l] = rgbToHsl(r, g, b)
  s = Math.max(0, Math.min(100, s * (saturation / 100)))
  l = Math.max(0, Math.min(100, l + brightness))
  ;[r, g, b] = hslToRgb(h, s, l)
  const factor = contrast / 100
  r = (r - 128) * factor + 128
  g = (g - 128) * factor + 128
  b = (b - 128) * factor + 128
  // 色温：暖（+）增红减蓝，冷（−）减红增蓝
  r += temperature
  b -= temperature
  // 色调：品红（+）增红蓝减绿，绿（−）增绿减红蓝
  g -= tint
  r += tint * 0.5
  b += tint * 0.5
  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))
  return [Math.round(r), Math.round(g), Math.round(b)]
}

function getActivePalette(palette: PaletteColor[], indices: number[]): PaletteColor[] {
  const active = indices
    .filter((i) => i >= 0 && i < palette.length)
    .map((i) => palette[i])
  return active.length > 0 ? active : palette
}

function nearestFromSubset(r: number, g: number, b: number, subset: PaletteColor[]): number[] {
  let best = subset[0].rgb
  let bestDist = Infinity
  for (const c of subset) {
    const [pr, pg, pb] = c.rgb
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2
    if (d < bestDist) { bestDist = d; best = c.rgb }
  }
  return best
}

export function applyColorMap(
  canvas: HTMLCanvasElement,
  palette: PaletteColor[],
  colorMap: ColorMapState,
): HTMLCanvasElement {
  if (!palette.length && colorMap.mode !== 'free') return canvas

  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(canvas, 0, 0)
  const imgData = ctx.getImageData(0, 0, out.width, out.height)

  if (colorMap.mode === 'auto') {
    for (let i = 0; i < imgData.data.length; i += 4) {
      if (imgData.data[i + 3] < 10) continue
      const [r, g, b] = palette[nearestPaletteIndex(
        imgData.data[i], imgData.data[i + 1], imgData.data[i + 2], palette,
      )].rgb
      imgData.data[i] = r
      imgData.data[i + 1] = g
      imgData.data[i + 2] = b
    }
  } else if (colorMap.mode === 'tinted') {
    const subset = getActivePalette(palette, colorMap.selectedPaletteIndices)
    for (let i = 0; i < imgData.data.length; i += 4) {
      if (imgData.data[i + 3] < 10) continue
      let [r, g, b] = nearestFromSubset(
        imgData.data[i], imgData.data[i + 1], imgData.data[i + 2], subset,
      )
      ;[r, g, b] = applyColorAdjustments(
        r, g, b,
        colorMap.saturation, colorMap.contrast, colorMap.brightness,
        colorMap.temperature ?? 0, colorMap.tint ?? 0,
      )
      imgData.data[i] = r
      imgData.data[i + 1] = g
      imgData.data[i + 2] = b
    }
  } else {
    const colors = colorMap.freeColors.map(hexToRgb)
    const n = colors.length
    if (n === 0) return canvas
    for (let i = 0; i < imgData.data.length; i += 4) {
      if (imgData.data[i + 3] < 10) continue
      const lum = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2]
      const idx = Math.min(n - 1, Math.floor((lum / 256) * n))
      const [r, g, b] = colors[idx]
      imgData.data[i] = r
      imgData.data[i + 1] = g
      imgData.data[i + 2] = b
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return out
}

function fillBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: [number, number, number]) {
  ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`
  ctx.fillRect(0, 0, w, h)
}

function tileGrid(
  sample: HTMLCanvasElement,
  cols: number,
  rows: number,
  bg: [number, number, number],
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = sample.width * cols
  out.height = sample.height * rows
  const ctx = out.getContext('2d')!
  fillBackground(ctx, out.width, out.height, bg)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.drawImage(sample, c * sample.width, r * sample.height)
    }
  }
  return out
}

function tileMirrorH(sample: HTMLCanvasElement, cols: number, rows: number, bg: [number, number, number]): HTMLCanvasElement {
  const pair = document.createElement('canvas')
  pair.width = sample.width * 2
  pair.height = sample.height
  const pctx = pair.getContext('2d')!
  fillBackground(pctx, pair.width, pair.height, bg)
  pctx.drawImage(sample, 0, 0)
  pctx.save()
  pctx.translate(pair.width, 0)
  pctx.scale(-1, 1)
  pctx.drawImage(sample, 0, 0)
  pctx.restore()
  return tileGrid(pair, Math.max(1, Math.ceil(cols / 2)), rows, bg)
}

function tileMirrorV(sample: HTMLCanvasElement, cols: number, rows: number, bg: [number, number, number]): HTMLCanvasElement {
  const pair = document.createElement('canvas')
  pair.width = sample.width
  pair.height = sample.height * 2
  const pctx = pair.getContext('2d')!
  fillBackground(pctx, pair.width, pair.height, bg)
  pctx.drawImage(sample, 0, 0)
  pctx.save()
  pctx.translate(0, pair.height)
  pctx.scale(1, -1)
  pctx.drawImage(sample, 0, 0)
  pctx.restore()
  const out = tileGrid(pair, cols, Math.max(1, Math.ceil(rows / 2)), bg)
  if (out.height > sample.height * rows) {
    const trimmed = document.createElement('canvas')
    trimmed.width = out.width
    trimmed.height = sample.height * rows
    const tctx = trimmed.getContext('2d')!
    fillBackground(tctx, trimmed.width, trimmed.height, bg)
    tctx.drawImage(out, 0, 0)
    return trimmed
  }
  return out
}

/**
 * 单个万花筒单元：扇形 clip + 交替镜像。
 */
function buildKaleidoscopeCell(
  sample: HTMLCanvasElement,
  segments: number,
  bg: [number, number, number],
): HTMLCanvasElement {
  const cellSize = Math.ceil(Math.max(sample.width, sample.height) * 1.15)
  const out = document.createElement('canvas')
  out.width = cellSize
  out.height = cellSize
  const ctx = out.getContext('2d')!
  fillBackground(ctx, cellSize, cellSize, bg)

  const cx = cellSize / 2
  const cy = cellSize / 2
  const wedgeAngle = (2 * Math.PI) / segments
  const drawRadius = cellSize * 0.55

  for (let i = 0; i < segments; i++) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(i * wedgeAngle)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, drawRadius, -wedgeAngle / 2, wedgeAngle / 2)
    ctx.closePath()
    ctx.clip()
    if (i % 2 === 1) ctx.scale(1, -1)
    ctx.drawImage(sample, -sample.width / 2, -sample.height / 2)
    ctx.restore()
  }
  return out
}

/** 万花筒：先生成单元，再按列行平铺多个多边形单元。 */
function tileKaleidoscope(
  sample: HTMLCanvasElement,
  cols: number,
  rows: number,
  segments: number,
  bg: [number, number, number],
): HTMLCanvasElement {
  const cell = buildKaleidoscopeCell(sample, segments, bg)
  return tileGrid(cell, cols, rows, bg)
}

function tileGlideReflection(
  sample: HTMLCanvasElement,
  cols: number,
  rows: number,
  bg: [number, number, number],
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = sample.width * cols
  out.height = sample.height * rows
  const ctx = out.getContext('2d')!
  fillBackground(ctx, out.width, out.height, bg)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * sample.width
      const y = r * sample.height
      ctx.save()
      ctx.translate(x + sample.width / 2, y + sample.height / 2)
      if (c % 2 === 1) ctx.scale(1, -1)
      ctx.drawImage(sample, -sample.width / 2, -sample.height / 2)
      ctx.restore()
    }
  }
  return out
}

function tileScaleGradient(
  sample: HTMLCanvasElement,
  cols: number,
  rows: number,
  minScale: number,
  direction: ScaleGradientDirection,
  bg: [number, number, number],
): HTMLCanvasElement {
  if (direction === 'horizontal') {
    const maxH = sample.height * rows
    let totalW = 0
    const colWidths: number[] = []
    for (let c = 0; c < cols; c++) {
      const t = cols > 1 ? c / (cols - 1) : 0
      const sc = 1 - t * (1 - minScale)
      colWidths.push(Math.round(sample.width * sc))
      totalW += colWidths[c]
    }
    const out = document.createElement('canvas')
    out.width = Math.max(1, totalW)
    out.height = maxH
    const ctx = out.getContext('2d')!
    fillBackground(ctx, out.width, out.height, bg)
    let x = 0
    for (let c = 0; c < cols; c++) {
      const cw = colWidths[c]
      const sc = cw / sample.width
      const sh = sample.height * sc
      for (let r = 0; r < rows; r++) {
        ctx.drawImage(
          sample,
          0,
          0,
          sample.width,
          sample.height,
          x,
          Math.round(r * sh),
          cw,
          Math.round(sh),
        )
      }
      x += cw
    }
    return out
  }

  const maxW = sample.width * cols
  let totalH = 0
  const rowHeights: number[] = []
  for (let r = 0; r < rows; r++) {
    const t = rows > 1 ? r / (rows - 1) : 0
    const sc = 1 - t * (1 - minScale)
    rowHeights.push(Math.round(sample.height * sc))
    totalH += rowHeights[r]
  }
  const out = document.createElement('canvas')
  out.width = maxW
  out.height = Math.max(1, totalH)
  const ctx = out.getContext('2d')!
  fillBackground(ctx, out.width, out.height, bg)
  let y = 0
  for (let r = 0; r < rows; r++) {
    const rh = rowHeights[r]
    const sc = rh / sample.height
    const sw = sample.width * sc
    for (let c = 0; c < cols; c++) {
      ctx.drawImage(sample, 0, 0, sample.width, sample.height, Math.round(c * sw), y, Math.round(sw), rh)
    }
    y += rh
  }
  return out
}

function buildRadial4Cell(sample: HTMLCanvasElement, bg: [number, number, number]): HTMLCanvasElement {
  const w = sample.width
  const h = sample.height
  const out = document.createElement('canvas')
  out.width = w * 2
  out.height = h * 2
  const ctx = out.getContext('2d')!
  fillBackground(ctx, out.width, out.height, bg)
  const placements: [number, number, number][] = [
    [0, 0, 0],
    [w, 0, 90],
    [0, h, 270],
    [w, h, 180],
  ]
  for (const [dx, dy, deg] of placements) {
    ctx.save()
    ctx.translate(dx + w / 2, dy + h / 2)
    ctx.rotate((deg * Math.PI) / 180)
    ctx.drawImage(sample, -w / 2, -h / 2)
    ctx.restore()
  }
  return out
}

function tileRadial4Way(
  sample: HTMLCanvasElement,
  cols: number,
  rows: number,
  bg: [number, number, number],
): HTMLCanvasElement {
  const cell = buildRadial4Cell(sample, bg)
  return tileGrid(cell, cols, rows, bg)
}

function tileOffsetBrick(
  sample: HTMLCanvasElement,
  cols: number,
  rows: number,
  offsetRatio: number,
  bg: [number, number, number],
): HTMLCanvasElement {
  const offsetPx = Math.round(sample.width * offsetRatio)
  const out = document.createElement('canvas')
  out.width = sample.width * cols + offsetPx
  out.height = sample.height * rows
  const ctx = out.getContext('2d')!
  fillBackground(ctx, out.width, out.height, bg)
  for (let r = 0; r < rows; r++) {
    const xShift = r % 2 === 1 ? offsetPx : 0
    for (let c = 0; c < cols; c++) {
      ctx.drawImage(sample, c * sample.width + xShift, r * sample.height)
    }
  }
  return out
}

export function applyTiling(
  sample: HTMLCanvasElement,
  params: TilingParams,
  bg: [number, number, number],
): HTMLCanvasElement {
  if (sample.width <= 0 || sample.height <= 0) {
    const empty = document.createElement('canvas')
    empty.width = 1
    empty.height = 1
    return empty
  }
  switch (params.mode) {
    case 'mirror_h':
      return tileMirrorH(sample, params.cols, params.rows, bg)
    case 'mirror_v':
      return tileMirrorV(sample, params.cols, params.rows, bg)
    case 'kaleidoscope':
      return tileKaleidoscope(sample, params.cols, params.rows, params.kaleidoscopeSegments, bg)
    case 'offset_brick':
      return tileOffsetBrick(sample, params.cols, params.rows, params.offsetBrickRatio, bg)
    case 'glide_reflection':
      return tileGlideReflection(sample, params.cols, params.rows, bg)
    case 'radial_4way':
      return tileRadial4Way(sample, params.cols, params.rows, bg)
    case 'scale_gradient':
      return tileScaleGradient(
        sample,
        params.cols,
        params.rows,
        params.scaleGradientMin,
        params.scaleGradientDirection,
        bg,
      )
    default:
      return tileGrid(sample, params.cols, params.rows, bg)
  }
}

/**
 * 统一纹样构建管道。
 * 根因修复：使用 img.naturalWidth/Height  clamp 取样框，平铺前填充背景色，
 * 避免 silhouette 等形态因透明/纯色取样导致预览区看似空白。
 */
export async function buildPatternCanvas(
  expressionSrc: string,
  options: PatternBuildOptions,
): Promise<HTMLCanvasElement | null> {
  const img = await loadImage(expressionSrc)
  const imgW = img.naturalWidth
  const imgH = img.naturalHeight

  if (options.sampleBox.w < MIN_SAMPLE_SIZE || options.sampleBox.h < MIN_SAMPLE_SIZE) {
    return null
  }

  let processed: CanvasImageSource = img
  if (options.isOutline && options.outlineThickness > 1) {
    processed = applyOutlineThickness(img, options.outlineThickness)
  }

  let sample = extractSample(processed, imgW, imgH, options.sampleBox, options.sampleShape)

  if (options.colorMap.enabled) {
    sample = applyColorMap(sample, options.palette, options.colorMap)
  }

  return applyTiling(sample, options.tiling, options.tileBackground)
}

export function canvasToHeightmap(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(canvas, 0, 0)
  const imgData = ctx.getImageData(0, 0, out.width, out.height)
  for (let i = 0; i < imgData.data.length; i += 4) {
    const gray = Math.round(
      0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2],
    )
    imgData.data[i] = gray
    imgData.data[i + 1] = gray
    imgData.data[i + 2] = gray
  }
  ctx.putImageData(imgData, 0, 0)
  return out
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export async function loadProcessedExpression(
  expressionSrc: string,
  isOutline: boolean,
  outlineThickness: number,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(expressionSrc)
  if (isOutline && outlineThickness > 1) {
    return applyOutlineThickness(img, outlineThickness)
  }
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  c.getContext('2d')!.drawImage(img, 0, 0)
  return c
}
