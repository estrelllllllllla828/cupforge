import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildCupMesh } from '../engine/cupMesh'
import { createCupSurfaceMaterial } from '../engine/cupMaterial'
import { applyReliefDisplacement, buildHeightmapFromPattern, weldOuterWallSeam } from '../engine/cupRelief'
import { applyCupVertexGradient, sampleGradientStops } from '../engine/cupSurfaceColor'
import type {
  CupColorStyle,
  CupSurfaceMode,
  CupSurfaceRegion,
  GradientStop,
  ReliefDirection,
} from '../types'
import { buildRegionMaskedPatternCanvas } from '../engine/cupSurfaceRegions'
import type { Point2D } from '../engine/cupCurve'

interface Props {
  controlPoints: Point2D[]
  centerX: number
  wallThickness: number
  cupHeight: number
  baseHeight: number
  customColor: [number, number, number, number]
  patternCanvas: HTMLCanvasElement | null
  surfaceMode: CupSurfaceMode
  reliefStrength: number
  reliefDirection: ReliefDirection
  colorStyle: CupColorStyle
  gradientStops: GradientStop[]
  surfaceRegions: CupSurfaceRegion[]
  onResetViewReady?: (reset: () => void) => void
  /** 网格重建延迟（毫秒），略慢可减轻拖动轮廓时的卡顿 */
  meshRebuildDelay?: number
}

function frameCup(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
) {
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1)

  controls.target.copy(center)

  const fovRad = (camera.fov * Math.PI) / 180
  const distance = (maxDim / (2 * Math.tan(fovRad / 2))) * 1.55

  camera.position.set(
    center.x + distance * 0.75,
    center.y + maxDim * 0.45,
    center.z + distance * 0.75,
  )
  camera.near = Math.max(0.1, distance / 200)
  camera.far = Math.max(2000, distance * 20)
  camera.updateProjectionMatrix()
  controls.update()
}

export default function Cup3DPreview({
  controlPoints,
  centerX,
  wallThickness,
  cupHeight,
  baseHeight,
  customColor,
  patternCanvas,
  surfaceMode,
  reliefStrength,
  reliefDirection,
  colorStyle,
  gradientStops,
  surfaceRegions,
  onResetViewReady,
  meshRebuildDelay = 360,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const frameRef = useRef<number>(0)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const defaultViewRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)

  const frameScene = () => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const mesh = meshRef.current
    if (!camera || !controls || !mesh) return

    frameCup(mesh, camera, controls)
    defaultViewRef.current = {
      pos: camera.position.clone(),
      target: controls.target.clone(),
    }
  }

  const rebuildMesh = () => {
    const scene = sceneRef.current
    const renderer = rendererRef.current
    if (!scene) return

    if (meshRef.current) {
      scene.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      const mat = meshRef.current.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
      meshRef.current = null
    }

    if (textureRef.current) {
      textureRef.current.dispose()
      textureRef.current = null
    }

    const reliefActive = surfaceMode === 'relief' && !!patternCanvas && patternCanvas.width > 0

    const meshData = buildCupMesh({
      controlPoints,
      centerX,
      wallThickness,
      cupHeight,
      baseHeight,
      // 浮雕模式需要更高的网格密度才能清晰还原纹样细节
      thetaSegments: reliefActive ? 288 : 120,
      profileSamples: reliefActive ? 360 : 180,
    })

    const positions = new Float32Array(meshData.positions)

    const useTexture =
      surfaceMode === 'texture'
      && !!patternCanvas
      && patternCanvas.width > 0
      && surfaceRegions.length > 0
    const useRelief = reliefActive

    if (useRelief) {
      const heightmap = buildHeightmapFromPattern(patternCanvas!)
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
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(meshData.uvs, 2))
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1))

    const useGradient = colorStyle === 'gradient' && (surfaceMode === 'plain' || surfaceMode === 'relief')
    const splitSurface = useTexture || useRelief
    const solidRgba = customColor
    const bodyMaterialColor: [number, number, number, number] = useGradient ? [1, 1, 1, 1] : solidRgba
    const innerRgb: [number, number, number] = useGradient
      ? sampleGradientStops(gradientStops, 0)
      : [solidRgba[0], solidRgba[1], solidRgba[2]]

    if (useGradient) {
      applyCupVertexGradient(
        geometry,
        meshData.uvs,
        gradientStops,
        splitSurface
          ? { outerVertexCount: meshData.outerVertexCount, innerRgb }
          : {},
      )
    }

    geometry.computeVertexNormals()

    const innerMaterial = createCupSurfaceMaterial({
      color: bodyMaterialColor,
      useVertexColors: useGradient && splitSurface,
    })
    innerMaterial.side = THREE.FrontSide

    let materials: THREE.Material | THREE.Material[]
    if (useTexture) {
      const outsideRgb: [number, number, number] = [solidRgba[0], solidRgba[1], solidRgba[2]]
      const maskedCanvas = buildRegionMaskedPatternCanvas(patternCanvas!, surfaceRegions, outsideRgb)
      const tex = new THREE.CanvasTexture(maskedCanvas)
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.colorSpace = THREE.SRGBColorSpace
      tex.flipY = true
      tex.needsUpdate = true
      if (renderer) {
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      }
      textureRef.current = tex

      const outerMaterial = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.FrontSide,
      })
      geometry.addGroup(0, meshData.outerFaceCount, 0)
      geometry.addGroup(meshData.outerFaceCount, meshData.indices.length - meshData.outerFaceCount, 1)
      materials = [outerMaterial, innerMaterial]
    } else if (useRelief) {
      const outerMaterial = createCupSurfaceMaterial({
        color: bodyMaterialColor,
        useVertexColors: useGradient,
      })
      outerMaterial.side = THREE.FrontSide
      geometry.addGroup(0, meshData.outerFaceCount, 0)
      geometry.addGroup(meshData.outerFaceCount, meshData.indices.length - meshData.outerFaceCount, 1)
      materials = [outerMaterial, innerMaterial]
    } else {
      materials = createCupSurfaceMaterial({
        color: bodyMaterialColor,
        useVertexColors: useGradient,
      })
    }

    const mesh = new THREE.Mesh(geometry, materials)
    meshRef.current = mesh
    scene.add(mesh)
    frameScene()
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08

    onResetViewReady?.(() => {
      const view = defaultViewRef.current
      if (!view) return
      camera.position.copy(view.pos)
      controls.target.copy(view.target)
      controls.update()
    })

    // 较低环境光 + 强方向光，让浮雕的明暗起伏更清晰可见
    scene.add(new THREE.AmbientLight(0xffffff, 0.32))
    const dir = new THREE.DirectionalLight(0xffffff, 1.05)
    dir.position.set(160, 300, 220)
    scene.add(dir)
    // 侧向补光：从另一侧斜射，凸显浮雕侧壁
    const sideFill = new THREE.DirectionalLight(0xbfe0ff, 0.55)
    sideFill.position.set(-220, 120, -60)
    scene.add(sideFill)
    // 顶部柔光，避免暗部死黑
    const topFill = new THREE.DirectionalLight(0xffffff, 0.35)
    topFill.position.set(0, 320, -200)
    scene.add(topFill)

    const grid = new THREE.GridHelper(500, 20, 0x444444, 0x2a2a2a)
    scene.add(grid)

    sceneRef.current = scene
    cameraRef.current = camera
    rendererRef.current = renderer
    controlsRef.current = controls

    const resize = () => {
      const w = Math.max(container.clientWidth, 1)
      const h = Math.max(container.clientHeight, 1)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
      frameScene()
    }

    resize()
    const ro = new ResizeObserver(() => resize())
    ro.observe(container)

    rebuildMesh()

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    requestAnimationFrame(() => {
      resize()
      rebuildMesh()
    })

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      controls.dispose()
      if (meshRef.current) {
        meshRef.current.geometry.dispose()
        const mat = meshRef.current.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat.dispose()
      }
      textureRef.current?.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current)
    rebuildTimerRef.current = setTimeout(() => {
      rebuildMesh()
    }, meshRebuildDelay)
    return () => {
      if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlPoints, centerX, wallThickness, cupHeight, baseHeight, customColor, patternCanvas, surfaceMode, reliefStrength, reliefDirection, colorStyle, gradientStops, surfaceRegions, meshRebuildDelay])

  return <div ref={containerRef} className="cup-3d-preview" />
}
