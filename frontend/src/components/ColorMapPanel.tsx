import type { ColorMapState, PaletteColor } from '../types'

interface Props {
  palette: PaletteColor[]
  colorMap: ColorMapState
  onChange: (next: ColorMapState) => void
}

const MODE_LABELS: Record<ColorMapState['mode'], string> = {
  auto: '自动吸附',
  tinted: '基于原图色卡调色',
  free: '自由选择颜色',
}

export default function ColorMapPanel({ palette, colorMap, onChange }: Props) {
  if (!palette.length) return null

  const set = (patch: Partial<ColorMapState>) => onChange({ ...colorMap, ...patch })

  const togglePaletteIndex = (idx: number) => {
    const set_ = new Set(colorMap.selectedPaletteIndices)
    if (set_.has(idx)) {
      if (set_.size > 1) set_.delete(idx)
    } else {
      set_.add(idx)
    }
    set({ selectedPaletteIndices: Array.from(set_).sort((a, b) => a - b) })
  }

  const updateFreeColor = (index: number, hex: string) => {
    const next = [...colorMap.freeColors]
    next[index] = hex
    set({ freeColors: next })
  }

  return (
    <>
      <div className="panel-title">色彩映射</div>

      <div className="control-group">
        <label>
          <input
            type="checkbox"
            checked={colorMap.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
            style={{ marginRight: '0.5rem' }}
          />
          启用色彩映射
        </label>
      </div>

      {colorMap.enabled && (
        <>
          <div className="control-group">
            <label>映射模式</label>
            <select
              value={colorMap.mode}
              onChange={(e) => set({ mode: e.target.value as ColorMapState['mode'] })}
            >
              {(Object.keys(MODE_LABELS) as ColorMapState['mode'][]).map((m) => (
                <option key={m} value={m}>{MODE_LABELS[m]}</option>
              ))}
            </select>
          </div>

          {colorMap.mode === 'auto' && (
            <p className="export-hint">每个像素自动吸附到 K-means 色卡最近色。</p>
          )}

          {colorMap.mode === 'tinted' && (
            <>
              <p className="export-hint">从提取色卡中勾选参与映射的颜色，并调节色彩属性。</p>
              <div className="control-group">
                <label>选用色卡颜色</label>
                <div className="palette-select-row">
                  {palette.map((c, i) => (
                    <button
                      key={`sel-${c.hex}`}
                      className={`palette-select ${colorMap.selectedPaletteIndices.includes(i) ? 'active' : ''}`}
                      style={{ background: c.hex }}
                      title={c.hex}
                      onClick={() => togglePaletteIndex(i)}
                    />
                  ))}
                </div>
              </div>
              <div className="control-group">
                <label>
                  饱和度
                  <span className="value-display">{colorMap.saturation}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={colorMap.saturation}
                  onChange={(e) => set({ saturation: Number(e.target.value) })}
                />
              </div>
              <div className="control-group">
                <label>
                  对比度
                  <span className="value-display">{colorMap.contrast}%</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={200}
                  value={colorMap.contrast}
                  onChange={(e) => set({ contrast: Number(e.target.value) })}
                />
              </div>
              <div className="control-group">
                <label>
                  亮度偏移
                  <span className="value-display">{colorMap.brightness}</span>
                </label>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  value={colorMap.brightness}
                  onChange={(e) => set({ brightness: Number(e.target.value) })}
                />
              </div>
              <div className="control-group">
                <label>
                  色温
                  <span className="value-display">{colorMap.temperature > 0 ? `+${colorMap.temperature}` : colorMap.temperature}</span>
                </label>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  value={colorMap.temperature}
                  onChange={(e) => set({ temperature: Number(e.target.value) })}
                />
                <p className="slider-hint">负值偏冷（蓝），正值偏暖（黄红）</p>
              </div>
              <div className="control-group">
                <label>
                  色调
                  <span className="value-display">{colorMap.tint > 0 ? `+${colorMap.tint}` : colorMap.tint}</span>
                </label>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  value={colorMap.tint}
                  onChange={(e) => set({ tint: Number(e.target.value) })}
                />
                <p className="slider-hint">负值偏绿，正值偏品红</p>
              </div>
            </>
          )}

          {colorMap.mode === 'free' && (
            <>
              <p className="export-hint">按亮度区间映射到自定义颜色，可完全脱离原图色值。</p>
              {colorMap.freeColors.map((hex, i) => (
                <div className="control-group color-picker-row" key={i}>
                  <label>色阶 {i + 1}</label>
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) => updateFreeColor(i, e.target.value)}
                  />
                  <span className="color-hex-label">{hex}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}

      <div className="panel-title" style={{ marginTop: '1rem' }}>提取色卡</div>
      <div className="palette-row">
        {palette.map((c) => (
          <div key={c.hex} className="palette-swatch" style={{ background: c.hex }} title={c.hex}>
            <span className="ratio">{(c.ratio * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </>
  )
}
