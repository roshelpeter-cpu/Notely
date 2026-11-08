import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { resolveTheme, type Accent, type ThemeSetting } from '../lib/theme'

interface ThemeValue {
  setting: ThemeSetting
  theme: 'day' | 'night'
  accent: Accent
  motion: 'full' | 'reduce'
  setSetting: (setting: ThemeSetting) => void
  setAccent: (accent: Accent) => void
  setMotion: (motion: 'full' | 'reduce') => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

function readSetting(): ThemeSetting {
  const stored = localStorage.getItem('notely-theme')
  return stored === 'day' || stored === 'night' || stored === 'system' ? stored : 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [setting, setSettingState] = useState<ThemeSetting>(readSetting)
  const [accent, setAccentState] = useState<Accent>((localStorage.getItem('notely-accent') as Accent) || 'forest')
  const [motion, setMotionState] = useState<'full' | 'reduce'>(
    localStorage.getItem('notely-motion') === 'reduce' ? 'reduce' : 'full',
  )
  const [prefersDark, setPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const theme = resolveTheme(setting, prefersDark)
  const painted = useRef(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setPrefersDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (painted.current) root.classList.add('theme-transition')
    painted.current = true
    root.dataset.theme = theme
    root.dataset.themeSetting = setting
    root.dataset.accent = accent
    root.dataset.motion = motion
    root.style.colorScheme = theme === 'night' ? 'dark' : 'light'
    localStorage.setItem('notely-theme', setting)
    localStorage.setItem('notely-accent', accent)
    localStorage.setItem('notely-motion', motion)
    const timer = window.setTimeout(() => root.classList.remove('theme-transition'), 700)
    return () => window.clearTimeout(timer)
  }, [theme, setting, accent, motion])

  const value = useMemo<ThemeValue>(
    () => ({
      setting,
      theme,
      accent,
      motion,
      setSetting: setSettingState,
      setAccent: setAccentState,
      setMotion: setMotionState,
      toggleTheme: () => setSettingState(theme === 'day' ? 'night' : 'day'),
    }),
    [setting, theme, accent, motion],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('Theme is unavailable.')
  return value
}
