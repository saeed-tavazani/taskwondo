import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, BarChart3, AlertTriangle } from 'lucide-react'
import { TimeEntryForm } from '@/components/TimeEntryForm'
import { TimeEntryActions } from '@/components/TimeEntryActions'
import { Button } from '@/components/ui/Button'
import { LocalizedDatePicker } from '@/components/ui/LocalizedDatePicker'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { useTimeProjects, useTrackedTime, useTimeReport } from '@/hooks/useTimeTracking'
import { useNamespacePath } from '@/hooks/useNamespacePath'
import { formatTimeDuration, localDateInput, dateRange, weekKey, splitTimeDays } from '@/utils/timeTracking'
import { getLocalizedError } from '@/utils/apiError'
import type { TrackedTime } from '@/api/timeTracking'
import { useLayout } from '@/contexts/LayoutContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNamespaceContext } from '@/contexts/NamespaceContext'

const panel = 'rounded-lg border border-border bg-surface dark:border-border dark:bg-card'

export function TimeTrackingPage() {
  const { activeNamespace } = useNamespaceContext()
  return <TimeTrackingContent key={activeNamespace?.slug ?? 'default'} />
}

function TimeTrackingContent() {
  const { t, i18n } = useTranslation()
  const { p } = useNamespacePath()
  const { containerClass } = useLayout()
  const { ns, projects, canTrackTime, isPending: projectsLoading, error: projectsError } = useTimeProjects()
  const today = localDateInput(new Date())
  const [from, setFrom] = useState(weekKey(new Date(), i18n.language))
  const [to, setTo] = useState(today)
  const [project, setProject] = useState('')
  const [cursor, setCursor] = useState('')
  const [previous, setPrevious] = useState<string[]>([])
  const valid = !!from && !!to && from <= to
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const range = dateRange(valid ? from : today, valid ? to : today, timezone)
  const filters = { ...range, project_key: project || undefined, cursor: cursor || undefined, timezone }
  const list = useTrackedTime(ns, filters)
  // Force the personal filter for totals as well, so project owners do not
  // see their team's totals mixed into their personal tracker.
  const { user } = useAuth()
  const totals = useTimeReport(ns, { ...filters, cursor: undefined, user_id: user?.id })
  const daily = new Map(totals.data?.daily.map(b => [b.key, b.seconds]) ?? [])
  const groups = new Map<string, TrackedTime[]>()
  for (const entry of list.data?.entries ?? []) {
    const day = localDateInput(new Date(entry.started_at))
    groups.set(day, [...(groups.get(day) ?? []), entry])
  }
  // Show carry-over days even when no entry begins on that date.
  for (const day of daily.keys()) if (!groups.has(day)) groups.set(day, [])
  const weeks = new Map<string, number>()
  for (const [day, seconds] of daily) { const key = weekKey(new Date(`${day}T12:00:00`), i18n.language); weeks.set(key, (weeks.get(key) ?? 0) + seconds) }
  const ordered = [...groups].sort(([a], [b]) => b.localeCompare(a))
  const resetPage = () => { setCursor(''); setPrevious([]) }
  const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(i18n.language === 'fa' ? 'fa-IR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  let lastWeek = ''
  return <div className={`${containerClass(true)} py-6`}><div className="flex gap-6">
    <div className="min-w-0 flex-1 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-2 text-xl font-semibold text-foreground dark:text-foreground"><Clock className="h-5 w-5" aria-hidden="true" />{t('timeTracking.title')}</h1><Link to={p('/time-reports')} className="inline-flex items-center gap-2 text-sm text-foreground dark:text-foreground"><BarChart3 className="h-4 w-4" aria-hidden="true" />{t('timeTracking.reports')}</Link></div>
      {projectsLoading ? <Spinner /> : projectsError ? <p role="alert">{getLocalizedError(projectsError, t, 'timeTracking.error')}</p> : !canTrackTime ? <p role="alert">{t('timeTracking.noAccess')}</p> : <>
        <div className={`${panel} p-4 sm:p-5`}><TimeEntryForm key={ns} ns={ns} projects={projects} /></div>
        {!projects.length && <p className="text-sm text-muted-foreground dark:text-muted-foreground">{t('timeTracking.noProjects')}</p>}
        <div className="grid gap-3 sm:grid-cols-3"><LocalizedDatePicker label={t('timeTracking.from')} type="date" value={from} onChange={value => { setFrom(value); resetPage() }} /><LocalizedDatePicker label={t('timeTracking.to')} type="date" value={to} onChange={value => { setTo(value); resetPage() }} /><Select label={t('timeTracking.project')} value={project} onChange={e => { setProject(e.target.value); resetPage() }}><option value="">{t('timeTracking.allProjects')}</option>{projects.map(pr => <option key={pr.id} value={pr.key}>{pr.name}</option>)}</Select></div>
        {!valid && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t('timeTracking.invalidRange')}</p>}
        {list.isPending || totals.isPending ? <Spinner /> : list.error || totals.error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{getLocalizedError(list.error ?? totals.error, t, 'timeTracking.error')}</p> : <>
          <div className="flex items-center justify-between text-sm text-muted-foreground dark:text-muted-foreground"><span>{t('timeTracking.total')}</span><span dir="ltr" className="font-mono text-lg font-semibold tabular-nums text-foreground dark:text-foreground">{formatTimeDuration(totals.data?.total_seconds ?? 0)}</span></div>
          {!ordered.length && <div className={`${panel} p-10 text-center text-muted-foreground dark:text-muted-foreground`}>{t('timeTracking.empty')}</div>}
          {ordered.map(([day, entries]) => {
            const week = weekKey(new Date(`${day}T12:00:00`), i18n.language)
            const newWeek = week !== lastWeek; lastWeek = week
            return <section key={day} className="space-y-3">
              {newWeek && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground dark:text-muted-foreground"><span>{t('timeTracking.weekOf', { date: dateLabel(week) })}</span><span>{t('timeTracking.weekTotal')} <b dir="ltr" className="inline-block font-mono tabular-nums">{formatTimeDuration(weeks.get(week) ?? 0)}</b></span></div>}
              <div className={panel}><div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-3 text-sm dark:border-border dark:bg-background"><h2 className="font-medium text-foreground dark:text-foreground">{dateLabel(day)}</h2><span dir="ltr" className="font-mono font-semibold tabular-nums text-foreground dark:text-foreground">{formatTimeDuration(daily.get(day) ?? 0)}</span></div>
                {!entries.length && <p className="p-4 text-sm text-muted-foreground dark:text-muted-foreground">{t('timeTracking.carryOver')}</p>}
                {entries.map(entry => <div key={entry.id} className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-4 last:border-b-0 dark:border-border/70">
                  <div className="min-w-0 flex-1 basis-48"><p className="break-words text-sm font-medium text-foreground dark:text-foreground">{entry.description || t('timeTracking.noDescription')}</p><p className="mt-1 text-xs text-foreground dark:text-foreground">{entry.project_name}{entry.item_number ? ` · ${entry.project_key}-${entry.item_number}` : ''}</p>{entry.overlap && <span className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3 w-3" aria-hidden="true" />{t('timeTracking.overlap')}</span>}</div>
                  <div dir="ltr" className="text-xs text-muted-foreground dark:text-muted-foreground">{new Date(entry.started_at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', hour12: false })} – {new Date(entry.ended_at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', hour12: false })}{splitTimeDays(entry.started_at, entry.ended_at).length > 1 && <span className="block">{new Date(entry.ended_at).toLocaleDateString(i18n.language)}</span>}</div>
                  <span dir="ltr" className="font-mono font-semibold tabular-nums text-foreground dark:text-foreground">{formatTimeDuration(entry.duration_seconds)}</span>
                  <TimeEntryActions ns={ns} entry={entry} projects={projects} personal />
                </div>)}
              </div>
            </section>
          })}
          <div className="flex justify-end gap-2"><Button variant="secondary" disabled={!previous.length} onClick={() => { setCursor(previous.at(-1) ?? ''); setPrevious(previous.slice(0, -1)) }}>{t('timeTracking.previous')}</Button><Button variant="secondary" disabled={!list.data?.has_more} onClick={() => { setPrevious([...previous, cursor]); setCursor(list.data?.cursor ?? '') }}>{t('timeTracking.next')}</Button></div>
        </>}
      </>}
    </div>
  </div></div>
}
