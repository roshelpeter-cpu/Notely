import type { ReactNode } from 'react'
import { Leaf } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { WoodlandEffects } from './world'

export function AuthLayout({
  scene,
  title,
  children,
  footer,
}: {
  scene: 'login' | 'signup'
  title: ReactNode
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className={`auth-gate scene-${scene}`}>
      <div className="auth-scene" aria-hidden="true">
        <img className="auth-day" src={scene === 'login' ? '/art/auth-login.jpg' : '/art/auth-signup.jpg'} alt="" />
        <img className="auth-night" src="/art/auth-night.jpg" alt="" />
        <WoodlandEffects />
      </div>
      <div className="auth-toggle"><ThemeToggle /></div>
      <section className="auth-panel">
        <PanelVines />
        <h1>{title}</h1>
        <div className="auth-divider" aria-hidden="true"><span /><LeafMotif /><span /></div>
        {children}
        <div className="auth-footer">{footer}</div>
      </section>
    </div>
  )
}

export function LeafMotif() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M5 16c6-2 10-8 12-13-1 8-4 13-12 13z" fill="#3e7a54" />
      <path d="M7 16c2-4 4-8 6-11" fill="none" stroke="#1c3d2e" strokeWidth="1" />
    </svg>
  )
}

function PanelVines() {
  return (
    <svg className="auth-vines" viewBox="0 0 520 640" preserveAspectRatio="none" aria-hidden="true">
      <path d="M40 80c30 40 20 90 8 140" fill="none" stroke="#7ea36a" strokeWidth="2" opacity=".7" />
      <ellipse cx="48" cy="120" rx="14" ry="7" fill="#3f7a52" transform="rotate(-30 48 120)" />
      <ellipse cx="62" cy="150" rx="12" ry="6" fill="#8fba78" transform="rotate(20 62 150)" />
      <path d="M470 90c-24 50-10 100 8 150" fill="none" stroke="#7ea36a" strokeWidth="2" opacity=".7" />
      <ellipse cx="468" cy="140" rx="14" ry="7" fill="#3f7a52" transform="rotate(24 468 140)" />
      <ellipse cx="452" cy="176" rx="11" ry="5" fill="#c4a15a" transform="rotate(-18 452 176)" />
      <path d="M70 560c40-20 80-10 120 8" fill="none" stroke="#7ea36a" strokeWidth="1.6" opacity=".55" />
      <path d="M340 570c40-16 80-8 120 12" fill="none" stroke="#7ea36a" strokeWidth="1.6" opacity=".55" />
    </svg>
  )
}

export function SubmitLeaves({ label, busy }: { label: string; busy: boolean }) {
  return (
    <>
      <Leaf size={16} aria-hidden="true" />
      <span>{busy ? 'Opening the gate…' : label}</span>
    </>
  )
}
