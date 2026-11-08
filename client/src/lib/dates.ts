export function localDate(date = new Date()) {
  const z = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`
}

export function addDays(dateStr: string, amount: number) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + amount)
  return localDate(date)
}

export function formatLong(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatMedium(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const today = localDate()
  const day = localDate(date)
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (day === today) return `Today, ${time}`
  if (day === addDays(today, -1)) return `Yesterday, ${time}`
  return `${formatMedium(iso)}, ${time}`
}

export interface CalendarCell {
  date: string
  inMonth: boolean
}

export function monthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - startOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { date: localDate(date), inMonth: date.getMonth() === month }
  })
}

export function weekDays(anchor: string) {
  const [year, month, day] = anchor.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return Array.from({ length: 7 }, (_, index) => addDays(localDate(date), index))
}

export function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
