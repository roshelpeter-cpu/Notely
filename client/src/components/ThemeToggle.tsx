import { useQueryClient } from '@tanstack/react-query'
import { Moon, Sun } from 'lucide-react'
import { api } from '../api/client'
import { useTheme } from '../context/ThemeContext'

export function ThemeToggle({ variant = 'pill' }: { variant?: 'pill' | 'icon' }) {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const night = theme.theme === 'night'

  async function toggle() {
    const next = night ? 'day' : 'night'
    await queryClient.cancelQueries({ queryKey: ['preferences'] })
    theme.setSetting(next)
    try {
      const preferences = await api.updatePreferences({ theme: next })
      queryClient.setQueryData(['preferences'], preferences)
    } catch {
      /* The choice remains on this device if the API is quiet. */
    }
  }

  return (
    <button
      className={`theme-toggle ${variant === 'icon' ? 'icon-btn' : 'theme-pill'} ${night ? 'is-night' : 'is-day'}`}
      type="button"
      aria-pressed={night}
      aria-label={night ? 'Switch to day' : 'Switch to night'}
      onClick={() => void toggle()}
    >
      <span className="theme-sun"><Sun size={16} aria-hidden="true" /></span>
      <span className="theme-moon"><Moon size={16} aria-hidden="true" /></span>
    </button>
  )
}
