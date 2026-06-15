import { useRef } from 'react'

import type { DetectedSubject, WorkflowMode } from '../types'

interface Props {
  thumbnail: string | null
  detectedSubject: DetectedSubject | null
  workflowMode: WorkflowMode | null
  loading: boolean
  onWorkflowModeChange: (mode: WorkflowMode) => void
  onUpload: (file: File) => void
  onGenerate: () => void
}

export default function UploadPage({
  thumbnail,
  detectedSubject,
  workflowMode,
  loading,
  onWorkflowModeChange,
  onUpload,
  onGenerate,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    if (files.length > 1) return
    onUpload(files[0])
    e.target.value = ''
  }

  const detectTagLabel = loading && thumbnail
    ? '识别中…'
    : detectedSubject?.label
      ? detectedSubject.label
      : thumbnail
        ? '工业建筑'
        : null

  return (
    <div className="cyber-upload-page">
      <div className="cyber-upload-bg" aria-hidden="true">
        <img
          className="cyber-upload-crane-art"
          src="/upload/crane-cutout.png"
          alt=""
          draggable={false}
        />
      </div>

      <div className="cyber-upload-main">
        <div className="cyber-upload-center">
          <p className="cyber-upload-prompt">请上传工业建筑照片</p>

          <button
            type="button"
            className={`cyber-upload-slot ${thumbnail ? 'has-image' : ''}`}
            onClick={() => fileRef.current?.click()}
            aria-label={thumbnail ? '更换图片' : '上传图片'}
          >
            {thumbnail ? (
              <img src={thumbnail} alt="已上传图片" />
            ) : (
              <span className="cyber-upload-plus-wrap">
                <span className="cyber-upload-plus-glow" aria-hidden="true" />
                <span className="cyber-upload-plus-icon">+</span>
              </span>
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileChange}
          />

          <button
            type="button"
            className="cyber-upload-generate"
            disabled={!thumbnail || !workflowMode || loading}
            onClick={onGenerate}
          >
            {loading ? '处理中…' : '开始生成'}
          </button>
        </div>

        <aside className="cyber-upload-tags">
          <section className="cyber-upload-tag-section">
            <p className="cyber-upload-tags-title">识别主题</p>
            <div className="cyber-upload-tag-row">
              {detectTagLabel ? (
                <span
                  className={`cyber-upload-tag cyber-upload-tag-detect ${loading ? 'is-loading' : ''}`}
                >
                  {detectTagLabel}
                  {detectedSubject?.label && !loading ? (
                    <span className="cyber-upload-tag-meta">
                      {Math.round(detectedSubject.confidence * 100)}%
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="cyber-upload-tag cyber-upload-tag-detect is-placeholder">
                  上传后自动识别
                </span>
              )}
            </div>
          </section>

          <section className="cyber-upload-tag-section">
            <p className="cyber-upload-tags-title">请选择风格关键词</p>
            <div className="cyber-upload-tag-row">
              <button
                type="button"
                className={`cyber-upload-tag cyber-upload-tag-mode ${workflowMode === 'texture' ? 'active' : ''}`}
                disabled={!thumbnail || loading}
                onClick={() => onWorkflowModeChange('texture')}
              >
                贴图纹样
              </button>
              <button
                type="button"
                className={`cyber-upload-tag cyber-upload-tag-mode ${workflowMode === 'relief' ? 'active' : ''}`}
                disabled={!thumbnail || loading}
                onClick={() => onWorkflowModeChange('relief')}
              >
                浮雕
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
