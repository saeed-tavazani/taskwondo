import { describe, it, expect, vi } from 'vitest'
import { createInstance } from 'i18next'
import en from '@/i18n/en.json'
import fa from '@/i18n/fa.json'
import { formatDuration, formatRelativeTime, parseDuration } from './duration'

describe('localized time labels', () => {
  it('localizes relative times and durations in both languages', async () => {
    const i18n = createInstance()
    await i18n.init({ lng: 'fa', resources: { en: { translation: en }, fa: { translation: fa } } })
    const now = new Date('2026-10-11T12:00:00Z')
    vi.spyOn(Date, 'now').mockReturnValue(now.getTime())
    try {
      expect(formatRelativeTime('2026-10-11T11:08:00Z', i18n.t)).toBe('52 دقیقه پیش')
      expect(formatRelativeTime(now, i18n.t)).toBe('کمتر از یک دقیقه پیش')
      expect(formatDuration(9000, i18n.t)).toBe('2 ساعت 30 دقیقه')
      expect(formatDuration(0, i18n.t)).toBe('0 دقیقه')
      await i18n.changeLanguage('en')
      expect(formatRelativeTime('2026-10-11T11:08:00Z', i18n.t)).toBe('52m ago')
      expect(formatDuration(9000, i18n.t)).toBe('2h 30m')
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('keeps editable duration syntax compatible with the parser', () => {
    const seconds = 7 * 24 * 3600 + 2 * 3600 + 30 * 60
    expect(parseDuration(formatDuration(seconds))).toBe(seconds)
    expect(formatDuration(0)).toBe('0m')
  })
})
