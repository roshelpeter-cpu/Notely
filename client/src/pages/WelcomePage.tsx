import { Link } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { WoodlandScene } from '../components/world'

export default function WelcomePage() {
  return (
    <div className="welcome">
      <div className="welcome-scene" aria-hidden="true"><WoodlandScene /></div>
      <section className="welcome-card">
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
