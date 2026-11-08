export const NOTE_COLORS = ['parchment', 'sage', 'moss', 'gold', 'sky', 'rose', 'dusk', 'slate'] as const
export const NOTEBOOK_COLORS = ['sage', 'moss', 'forest', 'gold', 'bark', 'rose', 'sky', 'dusk'] as const
export const TAG_COLORS = ['moss', 'gold', 'rose', 'sky', 'dusk', 'bark', 'forest', 'berry'] as const
export const COVERS = ['floral', 'moon', 'cottage', 'river', 'fern', 'lantern', 'mushroom', 'stars'] as const

export function toneClass(color?: string | null) {
  return `tone-${color || 'sage'}`
}
