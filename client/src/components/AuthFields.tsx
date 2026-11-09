import type { ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function AuthField({
  label,
  icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string
  icon: ReactNode
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete?: string
}) {
  return (
    <label className="auth-field">
      <span className="auth-label">{icon}{label}</span>
      <span className="auth-input">
        {icon}
        <input
          type={type}
          required
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  )
}

export function PasswordField({
  label,
  value,
  onChange,
  shown,
  onToggle,
  autoComplete,
  placeholder = 'Enter your password',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  shown: boolean
  onToggle: () => void
  autoComplete?: string
  placeholder?: string
}) {
  return (
    <label className="auth-field">
      <span className="auth-label">
        <LockMark />
        {label}
      </span>
      <span className="auth-input">
        <LockMark />
        <input
          type={shown ? 'text' : 'password'}
          required
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
        <button className="auth-eye" type="button" aria-label={shown ? 'Hide password' : 'Show password'} onClick={onToggle}>
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  )
}

function LockMark() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
