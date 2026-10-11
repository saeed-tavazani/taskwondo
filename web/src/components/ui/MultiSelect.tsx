import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export interface MultiSelectOption {
  value: string
  label: string
  group?: string
}

export interface GroupAction {
  label: string
  values: string[]
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  searchable?: boolean
  groupActions?: GroupAction[]
  dropdownWidthClass?: string
  renderOption?: (option: MultiSelectOption) => React.ReactNode
}

export function MultiSelect({ options, selected, onChange, placeholder = 'All', className = '', searchable = false, groupActions, dropdownWidthClass, renderOption }: MultiSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && searchable) {
      // Focus search input when dropdown opens
      setTimeout(() => searchRef.current?.focus(), 0)
    }
    if (!open) setSearch('')
  }, [open, searchable])

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const filteredOptions = useMemo(() => {
    if (!search) return options
    const lower = search.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(lower))
  }, [options, search])

  function selectAll() {
    onChange(filteredOptions.map((o) => o.value))
  }

  function clearAll() {
    onChange([])
  }

  const hasSelection = selected.length > 0 && selected.length < options.length
  const selectionCount = hasSelection ? selected.length : 0

  // Group options if any have a group
  const hasGroups = filteredOptions.some((o) => o.group)
  const groups: { name: string | null; items: MultiSelectOption[] }[] = []
  if (hasGroups) {
    const groupMap = new Map<string | null, MultiSelectOption[]>()
    for (const opt of filteredOptions) {
      const g = opt.group ?? null
      if (!groupMap.has(g)) groupMap.set(g, [])
      groupMap.get(g)!.push(opt)
    }
    for (const [name, items] of groupMap) {
      groups.push({ name, items })
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        className={`flex items-center justify-between w-full rounded-md border border-border dark:border-border bg-surface dark:bg-card px-3 py-2 text-sm shadow-sm hover:bg-muted dark:hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${
          hasSelection ? 'text-foreground dark:text-foreground' : 'text-muted-foreground dark:text-muted-foreground'
        }`}
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">{placeholder}</span>
        {selectionCount > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded-full bg-accent text-foreground dark:bg-accent dark:text-foreground text-[11px] font-semibold leading-none">
            {selectionCount}
          </span>
        )}
        <svg className="ml-1 h-4 w-4 shrink-0 text-muted-foreground dark:text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className={`absolute z-20 mt-1 ${dropdownWidthClass ?? 'w-full'} min-w-[180px] rounded-md border border-border dark:border-border bg-surface dark:bg-card shadow-lg`}>
          {searchable && (
            <div className="px-2 pt-2 pb-1">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
                className="w-full rounded border border-border dark:border-border bg-surface dark:bg-muted px-2 py-1 text-sm text-foreground dark:text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border dark:border-border">
            <button type="button" className="text-xs text-foreground hover:text-foreground" onClick={selectAll}>
              {t('common.all')}
            </button>
            {groupActions?.map((action) => (
              <button key={action.label} type="button" className="text-xs text-foreground hover:text-foreground" onClick={() => onChange(action.values)}>
                {action.label}
              </button>
            ))}
            <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-muted-foreground" onClick={clearAll}>
              {t('common.none')}
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground dark:text-muted-foreground">{t('common.noResults')}</div>
            ) : hasGroups ? (
              groups.map((group) => (
                <div key={group.name ?? '__default'}>
                  {group.name && (
                    <div className="px-3 pt-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                      {group.name}
                    </div>
                  )}
                  {group.items.map((opt) => (
                    <OptionRow key={opt.value} option={opt} checked={selected.includes(opt.value)} onToggle={toggle} renderOption={renderOption} />
                  ))}
                </div>
              ))
            ) : (
              filteredOptions.map((opt) => (
                <OptionRow key={opt.value} option={opt} checked={selected.includes(opt.value)} onToggle={toggle} renderOption={renderOption} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function OptionRow({ option, checked, onToggle, renderOption }: { option: MultiSelectOption; checked: boolean; onToggle: (value: string) => void; renderOption?: (option: MultiSelectOption) => React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted dark:hover:bg-muted cursor-pointer text-sm text-foreground dark:text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(option.value)}
        className="rounded border-border text-foreground focus:ring-ring shrink-0"
      />
      {renderOption ? renderOption(option) : option.label}
    </label>
  )
}