/** Move saved login and preferences to Montask without overwriting newer values. */
export function migrateBrandStorage(storage: Storage): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
  for (const key of keys) {
    if (!key?.startsWith('taskwondo_')) continue
    const value = storage.getItem(key)
    if (value === null) continue
    const nextKey = `montask_${key.slice('taskwondo_'.length)}`
    if (storage.getItem(nextKey) === null) storage.setItem(nextKey, value)
    storage.removeItem(key)
  }
}
