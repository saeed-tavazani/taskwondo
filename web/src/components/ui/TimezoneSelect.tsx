import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  value: string
  onChange: (tz: string) => void
  disabled?: boolean
}

const TIMEZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    // Fallback for older browsers
    return [
      'UTC',
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'America/Mexico_City',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
      'Europe/Moscow', 'Europe/Istanbul',
      'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore',
      'Asia/Seoul', 'Asia/Hong_Kong',
      'Australia/Sydney', 'Australia/Melbourne',
      'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
      'Pacific/Auckland', 'Pacific/Honolulu',
    ]
  }
})()

export function TimezoneSelect({ value, onChange, disabled = false }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = search
    ? TIMEZONES.filter((tz) => tz.toLowerCase().includes(search.toLowerCase()))
    : TIMEZONES

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(tz: string) {
    onChange(tz)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        className="w-full text-left rounded-md border border-border dark:border-border dark:bg-card dark:text-foreground px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring truncate disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={() => {
          setOpen(!open)
          if (!open) {
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
      >
        {value || t('businessHours.selectTimezone')}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 bg-surface dark:bg-card border border-border dark:border-border rounded-md shadow-lg flex flex-col">
          <div className="p-2 border-b border-border dark:border-border">
            <input
              ref={inputRef}
              type="text"
              className="w-full rounded-md border border-border dark:border-border dark:bg-muted dark:text-foreground px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={t('businessHours.searchTimezone')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length > 0) {
                  handleSelect(filtered[0])
                } else if (e.key === 'Escape') {
                  setOpen(false)
                  setSearch('')
                }
              }}
            />
          </div>
          <ul ref={listRef} className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground dark:text-muted-foreground">{t('common.noResults')}</li>
            ) : (
              filtered.map((tz) => (
                <li key={tz}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent dark:hover:bg-accent ${
                      tz === value ? 'bg-accent dark:bg-accent text-foreground dark:text-foreground font-medium' : 'text-foreground dark:text-foreground'
                    }`}
                    onClick={() => handleSelect(tz)}
                  >
                    {tz}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
