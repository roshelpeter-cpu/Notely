import { useEffect, useState } from 'react'
import { SceneArt } from './scenery'
import { QuillMark } from './world'

export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!ready) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.motion === 'reduce'
    const wait = reduce ? 250 : 900
    const timer = window.setTimeout(() => {
      setLeaving(true)
      window.setTimeout(onDone, reduce ? 0 : 420)
    }, wait)
    return () => window.clearTimeout(timer)
  }, [onDone, ready])

  return (
    <div className={`splash ${leaving ? 'is-leaving' : ''}`} role="status" aria-live="polite" aria-label="Opening Notely">
      <SceneArt scene="village" label="A woodland village" />
      <div className="splash-shade" />
      <div className="splash-copy">
        <QuillMark />
        <p className="eyebrow">A space for your thoughts</p>
        <h1>Notely</h1>
        <div className="splash-bar" aria-hidden="true"><span className={ready ? 'is-ready' : ''} /></div>
        <p className="splash-status">{ready ? 'The gate is open' : 'Opening the woodland'}</p>
      </div>
    </div>
  )
}
