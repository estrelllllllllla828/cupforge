import CupForgeIcon from '../CupForgeIcon'
import type { AppPage } from '../../types'

interface Props {
  page: AppPage
  onNavigate: (page: AppPage) => void
}

export default function CyberHeader({ page, onNavigate }: Props) {
  if (page === 'landing') return null

  const crumbs: { key: AppPage; label: string; show: boolean }[] = [
    { key: 'landing', label: '首页', show: true },
    { key: 'upload', label: '上传页', show: true },
  ]

  return (
    <header className="cyber-header">
      <div className="cyber-header-brand" onClick={() => onNavigate('landing')} role="button" tabIndex={0}>
        <CupForgeIcon />
        <span>筑纹杯 <span className="cupforge-script">CupForge</span></span>
      </div>
      <nav className="cyber-header-nav">
        {crumbs.filter((c) => c.show).map((c, i) => (
          <span key={c.key} className="cyber-nav-item">
            {i > 0 && <span className="cyber-nav-sep">|</span>}
            <button
              type="button"
              className={page === c.key ? 'active' : ''}
              onClick={() => onNavigate(c.key)}
            >
              {c.label}
            </button>
          </span>
        ))}
      </nav>
    </header>
  )
}
