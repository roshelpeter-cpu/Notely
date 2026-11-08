export function greetingFor(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function welcomeLine(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return 'The village is bright. There is room for a clear thought.'
  if (hour < 17) return 'The day is underway. Capture what you want to keep.'
  return 'The lanterns are lit. Set down what the day taught you.'
}
