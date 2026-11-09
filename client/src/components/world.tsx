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

function Leaf({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 32 48" aria-hidden="true">
      <path d="M16 2c8 8 12 16 10 28-6 2-12 0-16-4 2-8 2-16 6-24z" fill="#6f8f55" />
      <path d="M16 8c1 10 1 18 0 30" fill="none" stroke="#3d5a32" strokeWidth="1" />
    </svg>
  )
}

function Cloud({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 180 70" aria-hidden="true">
      <ellipse cx="58" cy="40" rx="38" ry="18" fill="rgba(255,255,255,.72)" />
      <ellipse cx="96" cy="32" rx="34" ry="20" fill="rgba(255,255,255,.8)" />
      <ellipse cx="128" cy="40" rx="30" ry="16" fill="rgba(255,255,255,.68)" />
    </svg>
  )
}

export function Ambience() {
  return (
    <div className="ambience" aria-hidden="true">
      <Leaf className="leaf-fall" />
      <Leaf className="leaf-fall leaf-b" />
      <Leaf className="leaf-fall leaf-c" />
      <span className="firefly f1" />
      <span className="firefly f2" />
      <span className="firefly f3" />
      <Cloud className="cloud-drift" />
      <Cloud className="cloud-drift cloud-b" />
    </div>
  )
}

export function WoodlandScene({ label = 'A woodland village' }: { label?: string }) {
  return <SceneArt scene="village" label={label} />
}

export function NotebookCover({ cover }: { cover: string }) {
  return <img src={COVER_ART[cover] || COVER_ART.floral} alt="" loading="lazy" />
}
