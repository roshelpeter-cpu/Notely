import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { ThemeToggle } from '../components/ThemeToggle'
import { Ambience, QuillMark, WoodlandScene } from '../components/world'

export default function WelcomePage() {
  const navigate = useNavigate()
  const session = useQuery({ queryKey: ['session'], queryFn: api.session, retry: false })
  const [entering, setEntering] = useState(false)
  const signedIn = Boolean(session.data?.user)

  function enter() {
    if (!signedIn) {
      navigate('/login')
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.motion === 'reduce'
    if (reduce) {
      navigate('/app')
      return
    }
    setEntering(true)
    window.setTimeout(() => navigate('/app'), 820)
  }

  return (
    <div className={`welcome ${entering ? 'is-entering' : ''}`}>
      <div className="welcome-scene" aria-hidden="true"><WoodlandScene /><Ambience /></div>
      <section className="welcome-card is-ready">
        <QuillMark />
        <p className="eyebrow">A space for your thoughts</p>
        <h1>Notely</h1>
        <p>A woodland workspace for notes, tasks, and the quiet paths between ideas.</p>
        <div className="quick" style={{ justifyContent: 'center' }}>
          <button className="enter-btn" type="button" onClick={enter} disabled={entering}>
            {entering ? 'Opening the gate…' : signedIn ? 'Enter your workspace' : 'Get started'}
          </button>
        </div>
        <p className="auth-links">
          {signedIn ? <Link to="/app">Open the library</Link> : <><Link to="/login">Log in</Link> · <Link to="/signup">Create an account</Link></>}
        </p>
        <ThemeToggle />
      </section>
    </div>
  )
}
