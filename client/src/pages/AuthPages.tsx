import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Mail, UserRound } from 'lucide-react'
import { ApiError, api } from '../api/client'
import { AuthField, PasswordField } from '../components/AuthFields'
import { AuthLayout, SubmitLeaves } from '../components/AuthLayout'

function passwordProblem(password: string, confirm?: string) {
  if (password.length < 10 || password.length > 128) return 'Use a password of 10 to 128 characters.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use at least one letter and one number.'
  if (confirm !== undefined && password !== confirm) return 'The passwords do not match.'
  return ''
}

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      await api.login({ email: email.trim(), password, remember })
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      navigate('/app')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Sign-in did not complete.')
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      scene="login"
      title={<>Welcome back to <span>Notely</span></>}
      footer={<>Don't have an account? <Link to="/signup">Sign up</Link></>}
    >
      <form onSubmit={(event) => void submit(event)}>
        <AuthField label="Email" icon={<Mail size={15} />} type="email" value={email} onChange={setEmail} placeholder="Enter your email" autoComplete="email" />
        <PasswordField label="Password" value={password} onChange={setPassword} shown={show} onToggle={() => setShow((value) => !value)} autoComplete="current-password" />
        <div className="auth-options">
          <label className="auth-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me</label>
          <Link to="/forgot">Forgot password?</Link>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}><SubmitLeaves label="Log in" busy={busy} /></button>
      </form>
    </AuthLayout>
  )
}

export function SignupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = passwordProblem(password, confirmPassword)
    if (!displayName.trim()) {
      setError('Enter your full name.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setBusy(true)
    try {
      await api.register({ displayName: displayName.trim(), email: email.trim(), password, confirmPassword })
      await queryClient.invalidateQueries({ queryKey: ['session'] })
      navigate('/app')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The account could not be created.')
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      scene="signup"
      title={<>Create your <span>Notely account</span></>}
      footer={<>Already have an account? <Link to="/login">Log in</Link></>}
    >
      <form onSubmit={(event) => void submit(event)}>
        <AuthField label="Full name" icon={<UserRound size={15} />} value={displayName} onChange={setDisplayName} placeholder="Roshel Peter" autoComplete="name" />
        <AuthField label="Email" icon={<Mail size={15} />} type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
        <PasswordField label="Password" value={password} onChange={setPassword} shown={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" placeholder="At least 10 characters" />
        <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} shown={showConfirm} onToggle={() => setShowConfirm((value) => !value)} autoComplete="new-password" placeholder="Repeat your password" />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}><SubmitLeaves label="Create account" busy={busy} /></button>
      </form>
    </AuthLayout>
  )
}

function QuietGate({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <AuthLayout scene="login" title={title} footer={footer}>
      {children}
    </AuthLayout>
  )
}

export function ForgotPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [devPath, setDevPath] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await api.forgotPassword(email.trim())
      setMessage(result.message)
      setDevPath(result.devResetPath || '')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The reset could not be started.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <QuietGate title="Reset a password" footer={<Link to="/login">Back to log in</Link>}>
      <form onSubmit={(event) => void submit(event)}>
        <AuthField label="Email" icon={<Mail size={15} />} type="email" value={email} onChange={setEmail} placeholder="Enter your email" autoComplete="email" />
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-note">{message}</p>}
        {devPath && <p className="auth-note">Development reset link: <Link to={devPath}>Open it</Link></p>}
        <button className="auth-submit" type="submit" disabled={busy}><SubmitLeaves label="Send reset link" busy={busy} /></button>
      </form>
    </QuietGate>
  )
}

export function ResetPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const problem = passwordProblem(password, confirmPassword)
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setBusy(true)
    try {
      await api.resetPassword({ token: params.get('token') || '', password, confirmPassword })
      navigate('/login')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The password was not changed.')
      setBusy(false)
    }
  }

  return (
    <QuietGate title="Choose a new password" footer={<Link to="/login">Back to log in</Link>}>
      <form onSubmit={(event) => void submit(event)}>
        <PasswordField label="New password" value={password} onChange={setPassword} shown={show} onToggle={() => setShow((value) => !value)} autoComplete="new-password" />
        <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} shown={show} onToggle={() => setShow((value) => !value)} autoComplete="new-password" />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={busy}><SubmitLeaves label="Update password" busy={busy} /></button>
      </form>
    </QuietGate>
  )
}
