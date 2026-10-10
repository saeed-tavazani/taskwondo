import { describe, expect, it } from 'vitest'
import { migrateBrandStorage } from './brandStorage'

function storageFrom(values: Record<string, string>): Storage {
  const data = new Map(Object.entries(values))
  return {
    get length() { return data.size },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: (key) => { data.delete(key) },
    clear: () => { data.clear() },
  }
}

describe('brand storage migration', () => {
  it('keeps login, preferences and pending navigation across the rename', () => {
    const storage = storageFrom({ taskwondo_token: 'token', taskwondo_language: 'fa', taskwondo_oauth_next: '/d/projects', unrelated: 'keep' })
    migrateBrandStorage(storage)
    expect(storage.getItem('montask_token')).toBe('token')
    expect(storage.getItem('montask_language')).toBe('fa')
    expect(storage.getItem('montask_oauth_next')).toBe('/d/projects')
    expect(storage.getItem('taskwondo_token')).toBeNull()
    expect(storage.getItem('unrelated')).toBe('keep')
    migrateBrandStorage(storage)
    expect(storage.length).toBe(4)
  })

  it('keeps newer values and prevents an old token from returning after logout', () => {
    const storage = storageFrom({ taskwondo_token: 'old', montask_token: 'new' })
    migrateBrandStorage(storage)
    expect(storage.getItem('montask_token')).toBe('new')
    storage.removeItem('montask_token')
    migrateBrandStorage(storage)
    expect(storage.getItem('montask_token')).toBeNull()
  })
})
