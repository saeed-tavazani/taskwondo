export function formatTimeDuration(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds))
  return [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60].map(part => String(part).padStart(2, '0')).join(':')
}
export function localDateInput(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
export function localDateTimeInput(value: string): string {
  const date = new Date(value)
  return `${localDateInput(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}
export function dateRange(from: string, to: string, timezone: string): { from: string; to: string } {
  // Find a local midnight in any IANA zone, including DST boundaries. Input
  // dates are Gregorian ISO dates; only their displayed labels are localized.
  const midnight = (value: string, next: boolean) => {
    const [y, m, d] = value.split('-').map(Number)
    const target = Date.UTC(y, m - 1, d + (next ? 1 : 0))
    let guess = target
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    for (let i = 0; i < 4; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]))
      const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
      const correction = target - represented
      guess += correction
      if (correction === 0) break
    }
    return new Date(guess).toISOString()
  }
  return { from: midnight(from, false), to: midnight(to, true) }
}
export function weekKey(date: Date, language: string): string {
  const startDay = language.startsWith('fa') ? 6 : 1
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - (start.getDay() - startDay + 7) % 7)
  return localDateInput(start)
}
export function splitTimeDays(startedAt: string, endedAt: string): { day: string; seconds: number }[] {
  let start = new Date(startedAt)
  const end = new Date(endedAt)
  const allocationStart = start.getTime()
  const result: { day: string; seconds: number }[] = []
  while (start < end) {
    const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    const bound = Math.min(next.getTime(), end.getTime())
    result.push({ day: localDateInput(start), seconds: Math.floor((bound - allocationStart) / 1000) - Math.floor((start.getTime() - allocationStart) / 1000) })
    start = new Date(bound)
  }
  return result
}
