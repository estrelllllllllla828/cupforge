import * as THREE from 'three'

export interface SurfaceMaterialOptions {
  color: [number, number, number, number]
  useVertexColors: boolean
}

export function createCupSurfaceMaterial(options: SurfaceMaterialOptions): THREE.MeshStandardMaterial {
  const rgba = options.color

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(rgba[0], rgba[1], rgba[2]),
    roughness: 0.52,
    metalness: 0.1,
    transparent: rgba[3] < 0.99,
    opacity: rgba[3],
    vertexColors: options.useVertexColors,
    side: THREE.DoubleSide,
  })
}
