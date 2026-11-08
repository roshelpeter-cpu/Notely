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

export function WoodlandScene({ label = 'A woodland village' }: { label?: string }) {
  return <SceneArt scene="village" label={label} />
}

export function NotebookCover({ cover }: { cover: string }) {
  return <img src={COVER_ART[cover] || COVER_ART.floral} alt="" loading="lazy" />
}
