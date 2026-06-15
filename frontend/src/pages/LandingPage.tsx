import { useState } from 'react'
import { CUP_SHOWCASE } from '../constants/keywords'
import CupForgeIcon from '../components/CupForgeIcon'

interface Props {
  onStart: () => void
}

const STEPS = ['上传', '生成', '编辑', '预览']

export default function LandingPage({ onStart }: Props) {
  const [showcaseIdx, setShowcaseIdx] = useState(0)
  const item = CUP_SHOWCASE[showcaseIdx]

  const nextShowcase = () => {
    setShowcaseIdx((i) => (i + 1) % CUP_SHOWCASE.length)
  }

  return (
    <div className="cyber-landing">
      <div className="cyber-landing-bg" />
      <div className="cyber-landing-hero">
        <div className="cyber-landing-copy">
          <h1>
            筑纹杯 <span className="cupforge-script">CupForge</span>{' '}
            <CupForgeIcon />
          </h1>
          <p className="cyber-landing-sub">工业文化 × 杯具文创</p>
          <div className="cyber-flow">
            {STEPS.map((step, i) => (
              <span key={step} className="cyber-flow-item">
                {i > 0 && <span className="cyber-flow-arrow">→</span>}
                <span className="cyber-pill">{step}</span>
              </span>
            ))}
          </div>
          <button type="button" className="cyber-btn-glass cyber-btn-start" onClick={onStart}>
            开始设计
          </button>
        </div>

        <div className="cyber-landing-visual">
          <div className="cyber-cup-showcase">
            <div className="cyber-cup-glow" />
            <img src={item.image} alt={item.label} className="cyber-cup-photo" />
          </div>
          <button type="button" className="cyber-carousel-next" onClick={nextShowcase} aria-label="查看更多杯子案例">
            ›
          </button>
        </div>
      </div>
    </div>
  )
}
