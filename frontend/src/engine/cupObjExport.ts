import type { CupSurfaceRegion } from '../types'
import type { Point2D } from './cupCurve'
import { buildCupMesh } from './cupMesh'
import { buildRegionMaskedPatternCanvas } from './cupSurfaceRegions'

const TEXTURE_NAME = 'cupforge_texture.png'
const MTL_NAME = 'cupforge_cup.mtl'
const OBJ_NAME = 'cupforge_cup.obj'

export interface TexturedCupObjParams {
  controlPoints: Point2D[]
  centerX: number
  wallThickness: number
  cupHeight: number
  baseHeight: number
  patternCanvas: HTMLCanvasElement | null
  surfaceRegions: CupSurfaceRegion[]
  bodyColor: [number, number, number, number]
  thetaSegments?: number
  profileSamples?: number
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('纹理 PNG 生成失败'))
          return
        }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject)
      },
      'image/png',
    )
  })
}

/** Store-only ZIP（无额外依赖） */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createZipStore(files: { name: string; data: Uint8Array }[]): Blob {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encodeText(file.name)
    const crc = crc32(file.data)
    const local = new Uint8Array(30 + nameBytes.length + file.data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, 0, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, file.data.length, true)
    lv.setUint32(22, file.data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(file.data, 30 + nameBytes.length)
    chunks.push(local)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, file.data.length, true)
    cv.setUint32(24, file.data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += local.length
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...chunks, ...central, end], { type: 'application/zip' })
}

function buildObjContent(
  positions: Float32Array,
  uvs: Float32Array,
  indices: Uint32Array,
  outerFaceCount: number,
  useTexture: boolean,
): string {
  const lines: string[] = [
    '# CupForge textured cup export',
    `mtllib ${MTL_NAME}`,
    '',
  ]

  const vertCount = positions.length / 3
  for (let i = 0; i < vertCount; i++) {
    lines.push(
      `v ${positions[i * 3].toFixed(6)} ${positions[i * 3 + 1].toFixed(6)} ${positions[i * 3 + 2].toFixed(6)}`,
    )
  }

  lines.push('')
  for (let i = 0; i < vertCount; i++) {
    // OBJ 纹理 v 轴与 Canvas 行序一致（与 Three.js flipY 预览对齐）
    lines.push(`vt ${uvs[i * 2].toFixed(6)} ${uvs[i * 2 + 1].toFixed(6)}`)
  }

  const triCount = indices.length / 3
  const outerTriCount = outerFaceCount / 3

  if (useTexture && outerTriCount > 0) {
    lines.push('', 'usemtl cup_pattern', 's cup_outer')
    for (let t = 0; t < outerTriCount; t++) {
      const a = indices[t * 3] + 1
      const b = indices[t * 3 + 1] + 1
      const c = indices[t * 3 + 2] + 1
      lines.push(`f ${a}/${a} ${b}/${b} ${c}/${c}`)
    }
  } else if (outerTriCount > 0) {
    lines.push('', 'usemtl cup_body', 's cup_outer')
    for (let t = 0; t < outerTriCount; t++) {
      const a = indices[t * 3] + 1
      const b = indices[t * 3 + 1] + 1
      const c = indices[t * 3 + 2] + 1
      lines.push(`f ${a} ${b} ${c}`)
    }
  }

  if (outerTriCount < triCount) {
    lines.push('', 'usemtl cup_body', 's cup_inner')
    for (let t = outerTriCount; t < triCount; t++) {
      const a = indices[t * 3] + 1
      const b = indices[t * 3 + 1] + 1
      const c = indices[t * 3 + 2] + 1
      lines.push(`f ${a} ${b} ${c}`)
    }
  }

  return lines.join('\n') + '\n'
}

function buildMtlContent(
  bodyColor: [number, number, number],
  useTexture: boolean,
): string {
  const [r, g, b] = bodyColor
  const lines = [
    '# CupForge cup materials',
    'newmtl cup_body',
    `Kd ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`,
    'Ns 50.0000',
    'd 1.0',
    'illum 2',
    '',
  ]

  if (useTexture) {
    lines.push(
      'newmtl cup_pattern',
      `Kd ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`,
      `map_Kd ${TEXTURE_NAME}`,
      'Ns 50.0000',
      'd 1.0',
      'illum 2',
      '',
    )
  }

  return lines.join('\n') + '\n'
}

/** 生成含贴图的 OBJ 包（obj + mtl + png，ZIP 下载） */
export async function buildTexturedCupObjZip(params: TexturedCupObjParams): Promise<Blob> {
  const {
    controlPoints,
    centerX,
    wallThickness,
    cupHeight,
    baseHeight,
    patternCanvas,
    surfaceRegions,
    bodyColor,
    thetaSegments = 120,
    profileSamples = 180,
  } = params

  const meshData = buildCupMesh({
    controlPoints,
    centerX,
    wallThickness,
    cupHeight,
    baseHeight,
    thetaSegments,
    profileSamples,
  })

  const bodyRgb: [number, number, number] = [bodyColor[0], bodyColor[1], bodyColor[2]]
  const useTexture = !!(
    patternCanvas
    && patternCanvas.width > 0
    && surfaceRegions.length > 0
  )

  const objText = buildObjContent(
    meshData.positions,
    meshData.uvs,
    meshData.indices,
    meshData.outerFaceCount,
    useTexture,
  )
  const mtlText = buildMtlContent(bodyRgb, useTexture)

  const files: { name: string; data: Uint8Array }[] = [
    { name: OBJ_NAME, data: encodeText(objText) },
    { name: MTL_NAME, data: encodeText(mtlText) },
  ]

  if (useTexture && patternCanvas) {
    const textureCanvas = buildRegionMaskedPatternCanvas(
      patternCanvas,
      surfaceRegions,
      bodyRgb,
    )
    const pngBytes = await canvasToPngBytes(textureCanvas)
    files.push({ name: TEXTURE_NAME, data: pngBytes })
  }

  return createZipStore(files)
}
