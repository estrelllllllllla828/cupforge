export const CUPFORGE_ICON_SRC = '/cup/IMG_7808.PNG'

interface Props {
  className?: string
}

export default function CupForgeIcon({ className = '' }: Props) {
  return (
    <img
      src={CUPFORGE_ICON_SRC}
      alt=""
      className={className ? `cyber-cup-icon ${className}` : 'cyber-cup-icon'}
      aria-hidden="true"
    />
  )
}
