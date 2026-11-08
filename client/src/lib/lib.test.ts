import { describe, expect, it } from 'vitest'
import { addDays, monthGrid } from './dates'
import { greetingFor, welcomeLine } from './greeting'
import { resolveTheme } from './theme'

describe('woodland helpers', () => {
  it('resolves the system theme from the preference', () => {
    expect(resolveTheme('system', true)).toBe('night')
    expect(resolveTheme('system', false)).toBe('day')
    expect(resolveTheme('night', false)).toBe('night')
  })

  it('greets by the hour', () => {
    expect(greetingFor(new Date(2026, 10, 6, 8))).toBe('Good morning')
    expect(greetingFor(new Date(2026, 10, 6, 14))).toBe('Good afternoon')
    expect(greetingFor(new Date(2026, 10, 6, 20))).toBe('Good evening')
    expect(welcomeLine(new Date(2026, 10, 6, 8), 'night')).toMatch(/lanterns/i)
  })

  it('builds a Monday-first month without duplicate days', () => {
    const cells = monthGrid(2026, 10)
    expect(cells).toHaveLength(42)
    expect(new Set(cells.map((cell) => cell.date)).size).toBe(42)
    expect(cells.find((cell) => cell.date === '2026-11-01')?.inMonth).toBe(true)
    expect(addDays('2026-11-06', 1)).toBe('2026-11-07')
  })
})
