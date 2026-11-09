import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '../api/client'
import { PageHead } from '../components/scenery'
import { useToast } from '../context/ToastContext'
import { useUi } from '../context/UiContext'
import { useWorkspace } from '../context/WorkspaceContext'

export default function AccountPage() {
  const { profile } = useWorkspace()
  const { notify } = useToast()
  const ui = useUi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState(profile?.displayName || '')
  const [tagline, setTagline] = useState(profile?.tagline || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (!profile) return
    setName((value) => value || profile.displayName || '')
    setTagline((value) => value || profile.tagline || '')
  }, [profile])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    try {
      await api.updateProfile({ displayName: name, tagline })
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      notify('Profile saved.', 'success')
    } catch (reason) {
      notify(reason instanceof ApiError ? reason.message : 'The profile could not be saved.', 'error')
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    try {
      await api.changePassword({ currentPassword, password, confirmPassword })
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
      notify('Password updated.', 'success')
    } catch (reason) {
      notify(reason instanceof ApiError ? reason.message : 'The password was not changed.', 'error')
    }
  }

  async function removeAccount() {
    const passwordValue = await ui.ask({ title: 'Delete this account?', label: 'Password', confirmLabel: 'Continue' })
    if (!passwordValue) return
    if (!(await ui.confirm({ title: 'Delete the account and its library?', message: 'Notes, tasks, and sessions will be removed.', confirmLabel: 'Delete account', danger: true }))) return
    try {
      await api.deleteAccount({ password: passwordValue, confirm: 'delete' })
      queryClient.clear()
      navigate('/')
    } catch (reason) {
      notify(reason instanceof ApiError ? reason.message : 'The account was not deleted.', 'error')
    }
  }

  return (
    <div className="page page-workshop">
      <PageHead eyebrow="Your account" title="Account" scene="cottage" crop="top" />
      <section className="panel">
        <h2>Profile</h2>
        <p className="muted">{profile?.email}</p>
        {profile?.avatar && <img className="avatar" src={profile.avatar} alt="" />}
        <label className="field"><span>Picture</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              const avatar = String(reader.result || '')
              void api.updateProfile({ avatar }).then(() => queryClient.invalidateQueries({ queryKey: ['profile'] })).catch((reason) => {
                notify(reason instanceof ApiError ? reason.message : 'The picture could not be saved.', 'error')
              })
            }
            reader.readAsDataURL(file)
          }} />
        </label>
        <form onSubmit={(event) => void saveProfile(event)}>
          <label className="field"><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>Tagline</span><input value={tagline} onChange={(event) => setTagline(event.target.value)} /></label>
          <button className="btn btn-primary" type="submit">Save profile</button>
        </form>
      </section>
      <section className="panel">
        <h2>Password</h2>
        <form onSubmit={(event) => void savePassword(event)}>
          <label className="field"><span>Current password</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
          <label className="field"><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label className="field"><span>Confirm password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          <button className="btn" type="submit">Change password</button>
        </form>
      </section>
      <section className="panel">
        <h2>Leave</h2>
        <button className="btn btn-danger" type="button" onClick={() => void removeAccount()}>Delete account</button>
      </section>
    </div>
  )
}
