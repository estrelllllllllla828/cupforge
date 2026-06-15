import { useCallback, useRef, useState } from 'react'
import { gradientStopsToCss, sampleGradientStops } from '../engine/cupSurfaceColor'
import type { GradientStop } from '../types'

interface Props {
  stops: GradientStop[]
  onChange: (stops: GradientStop[]) => void
}

function createStopId() {
  return `g${Date.now()}${Math.random().toString(36).slice(2, 5)}`
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) => Math.round(Math.max(0, Math.min(255, n * 255))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function interpolateStopColor(stops: GradientStop[], position: number): string {
  const [r, g, b] = sampleGradientStops(stops, position / 100)
  return rgbToHex(r, g, b)
}

/** 渐变色标编辑器：可拖动色标、增删、选色 */
export default function CupGradientEditor({ stops, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string>(() => stops[0]?.id ?? '')
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null)

  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const selected = stops.find((s) => s.id === selectedId) ?? sorted[0]

  const updateStop = useCallback((id: string, patch: Partial<GradientStop>) => {
    onChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [onChange, stops])

  const positionFromPointer = (clientX: number) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.round(Math.max(0, Math.min(100, ratio * 100)))
  }

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    e.preventDefault()
    setSelectedId(id)
    dragRef.current = { id, pointerId: e.pointerId }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    updateStop(drag.id, { position: positionFromPointer(e.clientX) })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
    }
  }

  const pickColor = (id: string, initial: string) => {
    const input = document.createElement('input')
    input.type = 'color'
    input.value = initial
    input.onchange = () => {
      updateStop(id, { color: input.value })
      setSelectedId(id)
    }
    input.click()
  }

  const handleAdd = () => {
    const pos = selected ? Math.min(98, Math.max(2, selected.position + 8)) : 50
    const color = interpolateStopColor(stops, pos)
    const id = createStopId()
    onChange([...stops, { id, color, position: pos }].sort((a, b) => a.position - b.position))
    setSelectedId(id)
  }

  const handleRemove = () => {
    if (stops.length <= 2 || !selected) return
    const next = stops.filter((s) => s.id !== selected.id)
    onChange(next)
    setSelectedId(next[0]?.id ?? '')
  }

  return (
    <div className="cyber-gradient-editor">
      <span className="cyber-surface-label">渐变色标</span>
      <div className="cyber-gradient-row">
        <div
          ref={trackRef}
          className="cyber-gradient-track"
          style={{ background: gradientStopsToCss(stops) }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {sorted.map((stop) => (
            <button
              key={stop.id}
              type="button"
              className={`cyber-gradient-stop ${selected?.id === stop.id ? 'selected' : ''}`}
              style={{ left: `${stop.position}%` }}
              onPointerDown={(e) => handlePointerDown(stop.id, e)}
              onDoubleClick={() => pickColor(stop.id, stop.color)}
              onClick={() => setSelectedId(stop.id)}
              aria-label={`色标 ${stop.position}%`}
            >
              <span className="cyber-gradient-stop-tip" style={{ background: stop.color }} />
            </button>
          ))}
        </div>
        <div className="cyber-gradient-actions">
          <button type="button" className="cyber-gradient-action add" onClick={handleAdd} aria-label="添加色标">
            +
          </button>
          <button
            type="button"
            className="cyber-gradient-action remove"
            onClick={handleRemove}
            disabled={stops.length <= 2}
            aria-label="删除色标"
          >
            ×
          </button>
        </div>
      </div>
      {selected && (
        <button
          type="button"
          className="cyber-gradient-selected-row"
          onClick={() => pickColor(selected.id, selected.color)}
        >
          <span className="cyber-color-chip" style={{ background: selected.color }} />
          <span>{selected.position}% · 双击色标或点此改色</span>
        </button>
      )}
    </div>
  )
}
