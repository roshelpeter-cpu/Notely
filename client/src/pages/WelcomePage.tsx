import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Splash } from '../components/Splash'
import { ThemeToggle } from '../components/ThemeToggle'
import { Ambience, WoodlandScene } from '../components/world'

export default function WelcomePage() {
  const navigate = useNavigate()
  const [splash, setSplash] = useState(() => sessionStorage.getItem('notely-splash') !== 'seen')
  const [entering, setEntering] = useState(false)

  function finishSplash() {
    sessionStorage.setItem('notely-splash', 'seen')
    setSplash(false)
  }

  function enter() {
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
      {splash && <Splash onDone={finishSplash} />}
      <div className="welcome-scene" aria-hidden="true"><WoodlandScene /><Ambience /></div>
      <section className={`welcome-card ${splash ? 'is-waiting' : 'is-ready'}`}>
        <p className="eyebrow">A space for your thoughts</p>
        <h1>Notely</h1>
        <p>A woodland workspace for notes, tasks, and the quiet paths between ideas.</p>
        <div className="quick" style={{ justifyContent: 'center' }}>
          <button className="enter-btn" type="button" onClick={enter} disabled={entering}>
            {entering ? 'Opening the gate…' : 'Enter your workspace'}
          </button>
        </div>
        <ThemeToggle />
      </section>
    </div>
  )
}
