import type { AppConfig, CupMeshRequest, ReprocessResult, UploadResult } from '../types'

const BASE = '/api'

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${BASE}/config`)
  if (!res.ok) throw new Error('配置加载失败')
  return res.json()
}

export async function uploadImage(
  file: File,
  cannyT1: number,
  cannyT2: number,
  pixelDownscaleFactor: number,
): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  const qs = new URLSearchParams({
    canny_t1: String(cannyT1),
    canny_t2: String(cannyT2),
    pixel_downscale_factor: String(pixelDownscaleFactor),
  })
  const res = await fetch(`${BASE}/upload?${qs}`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '上传失败' }))
    throw new Error(err.detail || '上传失败')
  }
  return res.json()
}

export async function reprocessExpressions(
  sessionId: string,
  cannyT1: number,
  cannyT2: number,
  pixelDownscaleFactor: number,
): Promise<ReprocessResult> {
  const res = await fetch(`${BASE}/reprocess?session_id=${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canny_t1: cannyT1,
      canny_t2: cannyT2,
      pixel_downscale_factor: pixelDownscaleFactor,
    }),
  })
  if (!res.ok) throw new Error('重新处理失败')
  return res.json()
}

export async function exportCupMesh(format: 'obj' | 'stl', params: CupMeshRequest): Promise<Blob> {
  const res = await fetch(`${BASE}/cup/export/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '杯型导出失败' }))
    throw new Error(err.detail || '杯型导出失败')
  }
  return res.blob()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
