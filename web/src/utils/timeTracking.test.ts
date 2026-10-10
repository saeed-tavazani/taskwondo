import { describe, it, expect } from 'vitest'
import { formatTimeDuration, dateRange, weekKey, splitTimeDays } from './timeTracking'

describe('time tracking calendar arithmetic', () => {
  it('keeps seconds and durations over 24 hours', () => {
    expect(formatTimeDuration(90061)).toBe('25:01:01')
    expect(formatTimeDuration(-1)).toBe('00:00:00')
  })
  it('uses Tehran calendar boundaries rather than UTC dates', () => {
    expect(dateRange('2026-10-10', '2026-10-10', 'Asia/Tehran')).toEqual({ from: '2026-10-09T20:30:00.000Z', to: '2026-10-10T20:30:00.000Z' })
  })
  it('handles both short and long DST days', () => {
    const spring = dateRange('2026-03-08', '2026-03-08', 'America/New_York')
    const fall = dateRange('2026-11-01', '2026-11-01', 'America/New_York')
    expect(Date.parse(spring.to) - Date.parse(spring.from)).toBe(23 * 3600000)
    expect(Date.parse(fall.to) - Date.parse(fall.from)).toBe(25 * 3600000)
  })
  it('starts Persian weeks on Saturday and English weeks on Monday', () => {
    expect(weekKey(new Date(2026, 9, 11), 'fa')).toBe('2026-10-10')
    expect(weekKey(new Date(2026, 9, 11), 'en')).toBe('2026-10-05')
  })
  it('allocates a cross-midnight entry without duplicating its duration', () => {
    const start = new Date(2026, 9, 10, 23, 30).toISOString()
    const end = new Date(2026, 9, 11, 0, 30).toISOString()
    expect(splitTimeDays(start, end)).toEqual([{ day: '2026-10-10', seconds: 1800 }, { day: '2026-10-11', seconds: 1800 }])
  })
  it('preserves a timer second split across midnight', () => {
    const start = new Date(2026, 9, 10, 23, 59, 59, 500).toISOString()
    const end = new Date(2026, 9, 11, 0, 0, 0, 500).toISOString()
    expect(splitTimeDays(start, end).reduce((sum, day) => sum + day.seconds, 0)).toBe(1)
  })
})
