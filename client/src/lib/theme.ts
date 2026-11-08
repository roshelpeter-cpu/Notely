export type ThemeSetting = 'day' | 'night' | 'system'
export type Accent = 'forest' | 'gold' | 'berry' | 'river'

export function resolveTheme(setting: ThemeSetting, prefersDark: boolean): 'day' | 'night' {
  if (setting === 'day' || setting === 'night') return setting
  return prefersDark ? 'night' : 'day'
}
