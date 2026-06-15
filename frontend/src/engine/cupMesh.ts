import { catmullRomSpline, scaleControlPoints, type Point2D } from './cupCurve'

export interface CupMeshParams {
  controlPoints: Point2D[]
  centerX: number
  wallThickness: number
  cupHeight: number
  baseHeight?: number
  thetaSegments?: number
  profileSamples?: number
}

export interface CupMeshData {
  positions: Float32Array
  indices: Uint32Array
  uvs: Float32Array
  /** 外壁顶点的真实曲面法线（与 positions 前 outerVertexCount 个顶点一一对应） */
  outerNormals: Float32Array
  yMin: number
  yMax: number
  outerVertexCount: number
  /** 外壁三角面在 indices 中的数量（用于多材质分组） */
  outerFaceCount: number
  profileRowCount: number
  /** 环向分段数（顶点列数 = ringSegments + 1，含闭合接缝） */
  ringSegments: number
}

export function buildCupMesh(params: CupMeshParams): CupMeshData {
  const {
    controlPoints,
    centerX,
    wallThickness,
    cupHeight,
    baseHeight = 350,
    thetaSegments = 120,
    profileSamples = 180,
  } = params

  const scaled = scaleControlPoints(controlPoints, cupHeight, baseHeight)
  const curve = catmullRomSpline(scaled, profileSamples)

  const outerR = curve.map((p) => Math.abs(p.x - centerX))
  const innerR = outerR.map((r) => Math.max(2, r - wallThickness))

  // Three.js 使用 Y 轴朝上：杯底 y=0，杯口朝上
  const profileBottomY = Math.max(...curve.map((p) => p.y))
  const heights = curve.map((p) => profileBottomY - p.y)
  const innerFloorY = heights[heights.length - 1]
  const outerBottomY = innerFloorY - wallThickness
  const yMin = outerBottomY
  const yMax = Math.max(...heights)
  const yRange = Math.max(1, yMax - yMin)

  // 子午线（半径, 高度）平面内的外壁法线，逐行计算后旋转得到 3D 曲面法线
  const meridianN: { nr: number; nh: number }[] = []
  for (let i = 0; i < heights.length; i++) {
    const ip = Math.max(0, i - 1)
    const iq = Math.min(heights.length - 1, i + 1)
    const dR = outerR[iq] - outerR[ip]
    const dH = heights[iq] - heights[ip]
    // 切线 (dR, dH) 的法线，取径向分量为正（指向杯外）
    let nr = dH
    let nh = -dR
    if (nr < 0) {
      nr = -nr
      nh = -nh
    }
    const len = Math.hypot(nr, nh) || 1
    meridianN.push({ nr: nr / len, nh: nh / len })
  }

  const verts: number[] = []
  const uvs: number[] = []
  const outerNorm: number[] = []
  const faces: number[] = []
  const outerIdx: number[][] = []
  const innerIdx: number[][] = []

  const ringSegments = thetaSegments
  const cols = ringSegments + 1

  for (let i = 0; i < heights.length; i++) {
    const row: number[] = []
    const { nr, nh } = meridianN[i]
    const yOuter = i === heights.length - 1 ? outerBottomY : heights[i]
    for (let j = 0; j <= ringSegments; j++) {
      const theta = (j / ringSegments) * Math.PI * 2
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      const vx = outerR[i] * cos
      const vz = outerR[i] * sin
      verts.push(vx, yOuter, vz)
      uvs.push(j / ringSegments, (yOuter - yMin) / yRange)
      outerNorm.push(nr * cos, nh, nr * sin)
      row.push((verts.length / 3) - 1)
    }
    outerIdx.push(row)
  }

  for (let i = 0; i < heights.length; i++) {
    const row: number[] = []
    const yInner = i === heights.length - 1 ? innerFloorY : heights[i]
    for (let j = 0; j <= ringSegments; j++) {
      const theta = (j / ringSegments) * Math.PI * 2
      const vx = innerR[i] * Math.cos(theta)
      const vz = innerR[i] * Math.sin(theta)
      verts.push(vx, yInner, vz)
      uvs.push(j / ringSegments, (yInner - yMin) / yRange)
      row.push((verts.length / 3) - 1)
    }
    innerIdx.push(row)
  }

  // 环向闭合：最后一列与第一列同位置（θ=2π ≡ 0）
  for (let i = 0; i < heights.length - 1; i++) {
    for (let j = 0; j < ringSegments; j++) {
      const a = outerIdx[i][j]
      const b = outerIdx[i][j + 1]
      const c = outerIdx[i + 1][j]
      const d = outerIdx[i + 1][j + 1]
      faces.push(a, b, c, b, d, c)
    }
  }

  const outerFaceCount = faces.length

  for (let i = 0; i < heights.length - 1; i++) {
    for (let j = 0; j < ringSegments; j++) {
      const a = innerIdx[i][j]
      const b = innerIdx[i + 1][j]
      const c = innerIdx[i][j + 1]
      const d = innerIdx[i + 1][j + 1]
      faces.push(a, b, c, c, b, d)
    }
  }

  // 杯口壁厚环（法线朝上，连接内外壁，像真实杯沿）
  const topOuter = outerIdx[0]
  const topInner = innerIdx[0]
  for (let j = 0; j < ringSegments; j++) {
    const a = topOuter[j]
    const b = topInner[j]
    const c = topOuter[j + 1]
    const d = topInner[j + 1]
    faces.push(a, b, c, b, d, c)
  }

  const bottomOuter = outerIdx[heights.length - 1]
  const bottomInner = innerIdx[heights.length - 1]

  // 杯底壁厚环：内底缘（innerFloorY）→ 外底缘（outerBottomY），竖直厚度 = wallThickness
  for (let j = 0; j < ringSegments; j++) {
    const a = bottomInner[j]
    const b = bottomInner[j + 1]
    const c = bottomOuter[j + 1]
    const d = bottomOuter[j]
    faces.push(a, b, c, a, c, d)
  }

  const innerCenterIndex = verts.length / 3
  verts.push(0, innerFloorY, 0)
  uvs.push(0.5, 1)

  const outerCenterIndex = verts.length / 3
  verts.push(0, outerBottomY, 0)
  uvs.push(0.5, 0)

  // 内底面（法线朝上，从杯内可见）
  for (let j = 0; j < ringSegments; j++) {
    faces.push(innerCenterIndex, bottomInner[j + 1], bottomInner[j])
  }

  // 外底面（法线朝下，从杯外/桌面方向可见）
  for (let j = 0; j < ringSegments; j++) {
    faces.push(outerCenterIndex, bottomOuter[j], bottomOuter[j + 1])
  }

  return {
    positions: new Float32Array(verts),
    indices: new Uint32Array(faces),
    uvs: new Float32Array(uvs),
    outerNormals: new Float32Array(outerNorm),
    yMin,
    yMax,
    outerVertexCount: heights.length * cols,
    outerFaceCount,
    profileRowCount: heights.length,
    ringSegments,
  }
}
