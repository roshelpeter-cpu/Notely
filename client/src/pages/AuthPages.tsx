import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '../api/client'
import { ThemeToggle } from '../components/ThemeToggle'
import { WoodlandScene } from '../components/world'

function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="welcome">
      <div className="welcome-scene" aria-hidden="true"><WoodlandScene /></div>
      <section className="welcome-card auth-card">
        <p className="eyebrow">Notely</p>
        <h1>{title}</h1>
        {children}
        <ThemeToggle />
      </section>
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await api.login({ email, password, remember })
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      navigate('/app')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Sign-in did not complete.')
    }
  }

  return (
    <AuthCard title="Welcome back">
      <form onSubmit={(event) => void submit(event)}>
        <label className="field"><span>Email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="field"><span>Password</span>
          <span className="password-row">
            <input type={show ? 'text' : 'password'} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="btn btn-small btn-ghost" type="button" onClick={() => setShow((value) => !value)}>{show ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        <label className="checkline"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember this device</label>
        {error && <p className="save-bad">{error}</p>}
        <button className="enter-btn" type="submit">Log in</button>
      </form>
      <p><Link to="/forgot">Forgot password</Link> · <Link to="/signup">Create an account</Link></p>
    </AuthCard>
  )
}

export function SignupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await api.register({ displayName, email, password, confirmPassword })
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      navigate('/app')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The account could not be created.')
    }
  }

  return (
    <AuthCard title="Create your library">
      <form onSubmit={(event) => void submit(event)}>
        <label className="field"><span>Full name</span><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label className="field"><span>Email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="field"><span>Password</span>
          <span className="password-row">
            <input type={show ? 'text' : 'password'} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="btn btn-small btn-ghost" type="button" onClick={() => setShow((value) => !value)}>{show ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        <label className="field"><span>Confirm password</span><input type={show ? 'text' : 'password'} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        <p className="muted">Use 10 or more characters, with a letter and a number.</p>
        {error && <p className="save-bad">{error}</p>}
        <button className="enter-btn" type="submit">Create account</button>
      </form>
      <p><Link to="/login">Already have a library? Log in</Link></p>
    </AuthCard>
  )
}

export function ForgotPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [devPath, setDevPath] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const result = await api.forgotPassword(email)
      setMessage(result.message)
      setDevPath(result.devResetPath || '')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The reset could not be started.')
    }
  }

  return (
    <AuthCard title="Reset a password">
      <form onSubmit={(event) => void submit(event)}>
        <label className="field"><span>Email</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        {error && <p className="save-bad">{error}</p>}
        {message && <p>{message}</p>}
        {devPath && <p>Development reset link: <Link to={devPath}>Open it</Link></p>}
        <button className="enter-btn" type="submit">Send reset link</button>
      </form>
      <p><Link to="/login">Back to log in</Link></p>
    </AuthCard>
  )
}

export function ResetPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await api.resetPassword({ token: params.get('token') || '', password, confirmPassword })
      navigate('/login')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The password was not changed.')
    }
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={(event) => void submit(event)}>
        <label className="field"><span>New password</span><input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="field"><span>Confirm password</span><input type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        {error && <p className="save-bad">{error}</p>}
        <button className="enter-btn" type="submit">Update password</button>
      </form>
    </AuthCard>
  )
}
