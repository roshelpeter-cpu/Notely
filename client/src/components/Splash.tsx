import { useEffect } from 'react'
import { SceneArt } from './scenery'
import { QuillMark } from './world'

export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.motion === 'reduce'
    const timer = window.setTimeout(onDone, reduce ? 350 : 2100)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div className="splash" role="status" aria-live="polite" aria-label="Opening Notely">
      <SceneArt scene="village" label="A woodland village" />
      <div className="splash-shade" />
      <div className="splash-copy">
        <QuillMark />
        <p className="eyebrow">A space for your thoughts</p>
        <h1>Notely</h1>
        <div className="splash-bar" aria-hidden="true"><span /></div>
      </div>
      <div className="ambience" aria-hidden="true">
        <span className="leaf-fall" />
        <span className="leaf-fall leaf-b" />
        <span className="firefly f1" />
        <span className="firefly f2" />
        <span className="firefly f3" />
      </div>
    </div>
  )
}
