import type { ReactNode } from 'react'

export type SceneName = 'village' | 'library' | 'cottage' | 'map'

const ART: Record<SceneName, { day: string; night: string }> = {
  village: { day: '/art/day-village.jpg', night: '/art/night-village.jpg' },
  library: { day: '/art/day-library.jpg', night: '/art/night-library.jpg' },
  cottage: { day: '/art/day-cottage.jpg', night: '/art/night-cottage.jpg' },
  map: { day: '/art/day-map.jpg', night: '/art/night-map.jpg' },
}

export function SceneArt({ scene, label, crop = 'center' }: { scene: SceneName; label?: string; crop?: 'center' | 'top' | 'bottom' | 'left' }) {
  const art = ART[scene]
  return (
    <div className={`scene-art crop-${crop}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <img className="art-day" src={art.day} alt="" />
      <img className="art-night" src={art.night} alt="" />
    </div>
  )
}

export function PageHead({
  eyebrow,
  title,
  scene,
  crop,
  actions,
}: {
  eyebrow: string
  title: string
  scene: SceneName
  crop?: 'center' | 'top' | 'bottom' | 'left'
  actions?: ReactNode
}) {
  return (
    <header className={`page-head scene-${scene}`}>
      <div className="page-head-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {actions && <div className="page-head-actions">{actions}</div>}
      </div>
      <SceneArt scene={scene} crop={crop} />
    </header>
  )
}
