import { migrateBrandStorage } from './brandStorage'

// Run before the API client and language detector read their stored settings.
for (const name of ['localStorage', 'sessionStorage'] as const) {
  try {
    migrateBrandStorage(window[name])
  } catch {
    // Storage may be unavailable or full; retry on the next page load.
  }
}
