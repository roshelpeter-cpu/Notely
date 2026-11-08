import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Splash } from '../components/Splash'
import { ThemeToggle } from '../components/ThemeToggle'
import { WoodlandScene } from '../components/world'

export default function WelcomePage() {
  const [splash, setSplash] = useState(() => sessionStorage.getItem('notely-splash') !== 'seen')

  function finishSplash() {
    sessionStorage.setItem('notely-splash', 'seen')
    setSplash(false)
  }

  return (
    <div className="welcome">
      {splash && <Splash onDone={finishSplash} />}
      <div className="welcome-scene" aria-hidden="true"><WoodlandScene /></div>
      <section className={`welcome-card ${splash ? 'is-waiting' : 'is-ready'}`}>
        <p className="eyebrow">A space for your thoughts</p>
        <h1>Notely</h1>
        <p>A woodland workspace for notes, tasks, and the quiet paths between ideas.</p>
        <div className="quick" style={{ justifyContent: 'center' }}>
          <Link className="enter-btn" to="/app">Enter your workspace</Link>
        </div>
        <ThemeToggle />
      </section>
    </div>
  )
}
