import type { CupSurfaceRegion, ReliefDirection } from '../types'
import type { Point2D } from './cupCurve'
import { buildCupMesh } from './cupMesh'
import {
  applyReliefDisplacement,
  buildHeightmapFromPattern,
  weldOuterWallSeam,
} from './cupRelief'

export interface ReliefCupStlParams {
  controlPoints: Point2D[]
  centerX: number
  wallThickness: number
  cupHeight: number
  baseHeight: number
  patternCanvas: HTMLCanvasElement
  reliefStrength: number
  reliefDirection: ReliefDirection
  surfaceRegions: CupSurfaceRegion[]
  /** 环向分段，默认与 3D 预览浮雕模式一致 */
  thetaSegments?: number
  profileSamples?: number
}

/** Three.js Y 轴朝上 → STL 常用 Z 轴朝上 */
function toStlCoords(x: number, yUp: number, z: number): [number, number, number] {
  return [x, z, yUp]
}

function writeStlTriangle(
  view: DataView,
  offset: number,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): number {
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  let nx = uy * vz - uz * vy
  let ny = uz * vx - ux * vz
  let nz = ux * vy - uy * vx
  const len = Math.hypot(nx, ny, nz) || 1
  nx /= len
  ny /= len
  nz /= len

  view.setFloat32(offset, nx, true)
  view.setFloat32(offset + 4, ny, true)
  view.setFloat32(offset + 8, nz, true)
  view.setFloat32(offset + 12, a[0], true)
  view.setFloat32(offset + 16, a[1], true)
  view.setFloat32(offset + 20, a[2], true)
  view.setFloat32(offset + 24, b[0], true)
  view.setFloat32(offset + 28, b[1], true)
  view.setFloat32(offset + 32, b[2], true)
  view.setFloat32(offset + 36, c[0], true)
  view.setFloat32(offset + 40, c[1], true)
  view.setFloat32(offset + 44, c[2], true)
  view.setUint16(offset + 48, 0, true)
  return offset + 50
}

function meshToStlBlob(positions: Float32Array, indices: Uint32Array): Blob {
  const triCount = indices.length / 3
  const buffer = new ArrayBuffer(84 + triCount * 50)
  const view = new DataView(buffer)

  const header = 'CupForge relief cup - for 3D printing'
  for (let i = 0; i < Math.min(80, header.length); i++) {
    view.setUint8(i, header.charCodeAt(i))
  }
  view.setUint32(80, triCount, true)

  let offset = 84
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3]
    const i1 = indices[t * 3 + 1]
    const i2 = indices[t * 3 + 2]
    const a = toStlCoords(
      positions[i0 * 3],
      positions[i0 * 3 + 1],
      positions[i0 * 3 + 2],
    )
    const b = toStlCoords(
      positions[i1 * 3],
      positions[i1 * 3 + 1],
      positions[i1 * 3 + 2],
    )
    const c = toStlCoords(
      positions[i2 * 3],
      positions[i2 * 3 + 1],
      positions[i2 * 3 + 2],
    )
    offset = writeStlTriangle(view, offset, a, b, c)
  }

  return new Blob([buffer], { type: 'model/stl' })
}

/** 生成带浮雕细节的 STL（与 3D 预览同一套网格与位移算法） */
export function buildReliefCupStlBlob(params: ReliefCupStlParams): Blob {
  const {
    controlPoints,
    centerX,
    wallThickness,
    cupHeight,
    baseHeight,
    patternCanvas,
    reliefStrength,
    reliefDirection,
    surfaceRegions,
    thetaSegments = 288,
    profileSamples = 360,
  } = params

  if (reliefStrength <= 0 || patternCanvas.width <= 0) {
    throw new Error('浮雕深度须大于 0，且需要有效纹样')
  }

  const meshData = buildCupMesh({
    controlPoints,
    centerX,
    wallThickness,
    cupHeight,
    baseHeight,
    thetaSegments,
    profileSamples,
  })

  const positions = new Float32Array(meshData.positions)
  const heightmap = buildHeightmapFromPattern(patternCanvas)

  applyReliefDisplacement(
    positions,
    meshData.uvs,
    meshData.outerNormals,
    heightmap,
    meshData.outerVertexCount,
    reliefStrength,
    reliefDirection,
    surfaceRegions,
    meshData.ringSegments,
  )
  weldOuterWallSeam(positions, meshData.profileRowCount, meshData.ringSegments)

  return meshToStlBlob(positions, meshData.indices)
}
