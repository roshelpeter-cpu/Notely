import { COVER_ART } from '../lib/art'
import { SceneArt } from './scenery'

export function QuillMark() {
  return (
    <svg className="quill" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M30 6c8 6 12 14 10 24-6 1-12-1-16-5 2-6 2-12 6-19z" fill="#f4e7c4" />
      <path d="M24 25c-6 6-12 8-18 8 2 4 8 6 14 4 4-6 6-10 4-12z" fill="#e7d3a4" />
      <path d="M14 37c6 2 12-2 16-8" fill="none" stroke="#8d6a32" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function SidebarVine() {
  return (
    <svg className="sidebar-vine" viewBox="0 0 260 90" aria-hidden="true">
      <path d="M180 8c18 16 28 18 48 14" fill="none" stroke="#7dba86" strokeWidth="2" opacity=".55" />
      <ellipse cx="214" cy="18" rx="14" ry="7" fill="#3f7a52" transform="rotate(-28 214 18)" opacity=".8" />
      <ellipse cx="236" cy="16" rx="12" ry="6" fill="#69a56e" transform="rotate(18 236 16)" opacity=".75" />
      <ellipse cx="196" cy="28" rx="11" ry="5" fill="#2f6844" transform="rotate(40 196 28)" opacity=".7" />
    </svg>
  )
}

const LEAF_SHAPES = [
  { d: 'M16 2c8 8 12 16 10 28-6 2-12 0-16-4 2-8 2-16 6-24z', fill: '#6f8f55' },
  { d: 'M18 4c7 9 5 18-1 30-8-5-13-14-9-26 3-3 7-4 10-4z', fill: '#c4a15a' },
  { d: 'M14 3c11 5 15 16 7 31-11-1-16-12-13-27 2-2 4-4 6-4z', fill: '#3e7a54' },
  { d: 'M20 2c3 12 1 22-5 34-7-8-11-18-6-30 3-3 8-4 11-4z', fill: '#8d5a32' },
]

const LEAVES = Array.from({ length: 22 }, (_, index) => ({
  shape: index % LEAF_SHAPES.length,
  left: `${(index * 13 + 3) % 100}%`,
  delay: `${-(index * 0.62)}s`,
  duration: `${8 + (index % 6) * 1.35}s`,
  size: 14 + (index % 5) * 6,
  drift: index % 2 === 0 ? 'sway-a' : 'sway-b',
}))

const FIREFLIES = Array.from({ length: 16 }, (_, index) => ({
  left: `${(index * 17 + 4) % 96}%`,
  top: `${8 + (index * 11) % 78}%`,
  delay: `${-(index * 0.45)}s`,
  duration: `${5.5 + (index % 5) * 0.8}s`,
}))

const LANTERNS = [
  [7, 16], [16, 38], [9, 64], [28, 22], [42, 12], [58, 18],
  [74, 14], [86, 32], [92, 58], [68, 72], [34, 76], [50, 48],
]

const STARS = Array.from({ length: 18 }, (_, index) => ({
  left: `${(index * 19 + 6) % 100}%`,
  top: `${(index * 7) % 42}%`,
  delay: `${(index % 7) * 0.35}s`,
}))

export function WoodlandEffects() {
  return (
    <div className="woodland-effects" aria-hidden="true">
      {LEAVES.map((leaf, index) => {
        const shape = LEAF_SHAPES[leaf.shape]
        return (
          <svg
            key={index}
            className={`falling-leaf ${leaf.drift}`}
            viewBox="0 0 32 48"
            style={{ left: leaf.left, animationDelay: leaf.delay, animationDuration: leaf.duration, width: leaf.size, height: leaf.size * 1.5 }}
          >
            <path d={shape.d} fill={shape.fill} />
          </svg>
        )
      })}
      {STARS.map((star, index) => (
        <span key={`star-${index}`} className="night-star" style={{ left: star.left, top: star.top, animationDelay: star.delay }} />
      ))}
      {FIREFLIES.map((fly, index) => (
        <span key={`fly-${index}`} className="firefly" style={{ left: fly.left, top: fly.top, animationDelay: fly.delay, animationDuration: fly.duration }} />
      ))}
      {LANTERNS.map(([left, top], index) => (
        <span key={`lantern-${index}`} className="lantern-glow" style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${index * 0.27}s`, animationDuration: `${1.8 + (index % 4) * 0.45}s` }} />
      ))}
    </div>
  )
}

export function Ambience() {
  return (
    <div className="ambience" aria-hidden="true">
      <WoodlandEffects />
    </div>
  )
}

export function WoodlandScene({ label = 'A woodland village' }: { label?: string }) {
  return <SceneArt scene="village" label={label} />
}

export function NotebookCover({ cover }: { cover: string }) {
  return <img src={COVER_ART[cover] || COVER_ART.floral} alt="" loading="lazy" />
}
