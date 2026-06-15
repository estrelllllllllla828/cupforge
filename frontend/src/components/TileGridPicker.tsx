import { useState } from 'react'

interface Props {
  cols: number
  rows: number
  maxCols?: number
  maxRows?: number
  disabled?: boolean
  onChange: (cols: number, rows: number) => void
}

/** WPS 表格式行列选择器：悬停预览，点击确定行×列 */
export default function TileGridPicker({
  cols,
  rows,
  maxCols = 8,
  maxRows = 8,
  disabled = false,
  onChange,
}: Props) {
  const [hover, setHover] = useState<{ c: number; r: number } | null>(null)

  const activeC = hover?.c ?? cols
  const activeR = hover?.r ?? rows

  return (
    <div className="cyber-grid-picker-wrap">
      <div
        className={`cyber-grid-picker ${disabled ? 'disabled' : ''}`}
        style={{ gridTemplateColumns: `repeat(${maxCols}, 1fr)` }}
        onMouseLeave={() => setHover(null)}
        role="grid"
        aria-label="选择平铺行列数"
      >
        {Array.from({ length: maxRows }, (_, r) =>
          Array.from({ length: maxCols }, (_, c) => {
            const on = c < activeC && r < activeR
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={`cyber-grid-picker-cell ${on ? 'on' : ''}`}
                disabled={disabled}
                onMouseEnter={() => setHover({ c: c + 1, r: r + 1 })}
                onClick={() => onChange(c + 1, r + 1)}
                aria-label={`${c + 1} 列 × ${r + 1} 行`}
              />
            )
          }),
        )}
      </div>
      <span className="cyber-grid-picker-value">{activeC} 列 × {activeR} 行</span>
    </div>
  )
}
