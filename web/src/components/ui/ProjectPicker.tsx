import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Project } from '@/api/projects'
import { ProjectKeyBadge } from '@/components/ui/ProjectKeyBadge'
import { NamespaceIcon } from '@/components/NamespaceIcon'
import { useNamespaceContext } from '@/contexts/NamespaceContext'

interface ProjectPickerProps {
  projects: Project[]
  value: string
  onChange: (projectKey: string) => void
  disabled?: boolean
  ariaLabel?: string
  /** Validation message; also turns the control's border red. */
  error?: string
}

export function ProjectPicker({ projects, value, onChange, disabled, error, ariaLabel }: ProjectPickerProps) {
  const { t } = useTranslation()
  const { showSwitcher: showNamespaces } = useNamespaceContext()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selected = projects.find((p) => p.key === value)

  const filtered = projects.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) || (p.namespace_slug ?? '').toLowerCase().includes(q)
  })

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative" onKeyDown={e => {
      if (e.key === 'Escape' && open) {
        e.stopPropagation()
        setOpen(false)
        setSearch('')
        buttonRef.current?.focus()
      }
    }}>
      <label className="block text-sm font-medium text-foreground dark:text-foreground mb-1">
        {t('workitems.form.project')} <span className="text-red-500" aria-hidden="true">*</span>
      </label>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`block w-full rounded-md border px-3 py-2 text-sm text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-surface dark:bg-card ${
          error ? 'border-red-300' : 'border-border dark:border-border'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => { if (disabled) return; setOpen(!open); setTimeout(() => inputRef.current?.focus(), 0) }}
        disabled={disabled}
      >
        {selected ? (
          <span className="flex items-center gap-2 text-foreground dark:text-foreground">
            <ProjectKeyBadge size="icon">{selected.key}</ProjectKeyBadge>
            <span className="truncate">{selected.name}</span>
            {showNamespaces && selected.namespace_slug && (
              <span className="ml-auto flex items-center gap-1 text-[0.7rem] text-muted-foreground dark:text-muted-foreground shrink-0">
                <span>{selected.namespace_slug}</span>
                <NamespaceIcon icon={selected.namespace_icon ?? 'building2'} color={selected.namespace_color ?? 'slate'} className="h-3 w-3" />
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground dark:text-muted-foreground">{t('workitems.form.projectPlaceholder')}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-surface dark:bg-card border border-border dark:border-border rounded-md shadow-lg">
          <div className="p-2">
            <input
              ref={inputRef}
              className="block w-full rounded-md border border-border dark:border-border dark:bg-muted dark:text-foreground px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={t('workitems.form.projectSearchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ul className="max-h-48 overflow-auto">
            {filtered.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted dark:hover:bg-muted ${
                    p.key === value ? 'bg-accent dark:bg-accent' : ''
                  }`}
                  onClick={() => { onChange(p.key); setOpen(false); setSearch('') }}
                >
                  <ProjectKeyBadge size="icon">{p.key}</ProjectKeyBadge>
                  <span className="text-foreground dark:text-foreground font-medium truncate">{p.name}</span>
                  {showNamespaces && p.namespace_slug && (
                    <span className="ml-auto flex items-center gap-1 text-[0.7rem] text-muted-foreground dark:text-muted-foreground shrink-0">
                      <span>{p.namespace_slug}</span>
                      <NamespaceIcon icon={p.namespace_icon ?? 'building2'} color={p.namespace_color ?? 'slate'} className="h-3 w-3" />
                    </span>
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground dark:text-muted-foreground">{t('workitems.form.noProjectsFound')}</li>
            )}
          </ul>
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
