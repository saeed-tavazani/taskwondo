import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Clock, Play, Square, ListPlus } from 'lucide-react'
import { api, nsPrefix } from '@/api/client'
import type { Project } from '@/api/projects'
import type { WorkItem } from '@/api/workitems'
import { getTimeReport, type TrackedTime, type TimeInput } from '@/api/timeTracking'
import { useAuth } from '@/contexts/AuthContext'
import { useTimerSeconds, useTimeMutations } from '@/hooks/useTimeTracking'
import { localDateTimeInput, formatTimeDuration } from '@/utils/timeTracking'
import { getLocalizedError } from '@/utils/apiError'
import { ProjectPicker } from '@/components/ui/ProjectPicker'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { useDebounce } from '@/hooks/useDebounce'

export function TimeEntryForm({ ns, projects, entry, onSaved, onCancel }: { ns: string; projects: Project[]; entry?: TrackedTime; onSaved?: () => void; onCancel?: () => void }) {
  const { t } = useTranslation()
  const formId = useId()
  const { user } = useAuth()
  const [mode, setMode] = useState(entry ? 'manual' : 'timer')
  const [project, setProject] = useState(entry?.project_key ?? '')
  const [item, setItem] = useState(entry?.item_number?.toString() ?? '')
  const [search, setSearch] = useState('')
  const query = useDebounce(search, 250)
  const [description, setDescription] = useState(entry?.description ?? '')
  const [start, setStart] = useState(localDateTimeInput(entry?.started_at ?? new Date(Date.now() - 3600000).toISOString()))
  const [end, setEnd] = useState(localDateTimeInput(entry?.ended_at ?? new Date().toISOString()))
  const [warning, setWarning] = useState<TimeInput | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [invalidRange, setInvalidRange] = useState(false)
  const [saved, setSaved] = useState(false)
  const { data: timer, seconds, isPending: timerLoading, isError: timerError } = useTimerSeconds()
  const mutations = useTimeMutations(ns)
  const { data: items, error: itemError } = useQuery({
    queryKey: ['time-picker-items', ns, project, query],
    queryFn: async () => (await api.get<{ data: WorkItem[] }>(`${nsPrefix(ns)}/projects/${project}/items`, { params: { q: query || undefined, limit: 100 } })).data.data,
    enabled: !!project,
  })
  const pending = checking || Object.values(mutations).some(m => m.isPending)
  const input: TimeInput = { project_key: project, item_number: item ? Number(item) : null, description }

  async function save(value: TimeInput) {
    await mutations.save.mutateAsync({ input: value, id: entry?.id })
    setWarning(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved?.()
  }
  async function submit() {
    setError(null)
    setInvalidRange(false)
    try {
      if (mode === 'timer') { await mutations.start.mutateAsync(input); return }
      const value = { ...input, started_at: new Date(start).toISOString(), ended_at: new Date(end).toISOString() }
      if (Date.parse(value.ended_at) <= Date.parse(value.started_at) || Date.parse(value.ended_at) > Date.now()) {
        setInvalidRange(true); return
      }
      setChecking(true)
      // Query overlapping entries independently of the currently visible page.
      const overlapping = await getTimeReport(ns, { from: value.started_at, to: value.ended_at, user_id: entry?.user_id ?? user?.id, timezone: 'UTC', limit: 100 })
      if (overlapping.details.entries.some(e => e.id !== entry?.id)) { setWarning(value); return }
      await save(value)
    } catch (err) { setError(err) } finally { setChecking(false) }
  }
  const manualSeconds = Math.max(0, Math.floor((Date.parse(end) - Date.parse(start)) / 1000))
  return <div className="space-y-4">
    {!entry && <Tabs tabs={[{ key: 'timer', label: t('timeTracking.timer'), icon: Clock }, { key: 'manual', label: t('timeTracking.manual'), icon: ListPlus }]} activeTab={mode} onTabChange={key => { setMode(key); setWarning(null) }} />}
    <form onSubmit={e => { e.preventDefault(); void submit() }} className="space-y-4" onChange={() => setWarning(null)}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Input id={`${formId}-description`} label={t('timeTracking.description')} placeholder={t('timeTracking.activityPlaceholder')} value={description} onChange={e => setDescription(e.target.value)} maxLength={10000} />
        <ProjectPicker projects={projects} value={project} ariaLabel={t('timeTracking.project')} onChange={key => { setProject(key); setItem(''); setSearch(''); setWarning(null) }} disabled={pending} />
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select id={`${formId}-item`} label={t('timeTracking.item')} value={item} onChange={e => setItem(e.target.value)} disabled={!project || pending}>
          <option value="">{t('timeTracking.noItem')}</option>
          {item && !items?.some(i => i.item_number === Number(item)) && <option value={item}>{project}-{item}{entry?.item_title ? ` · ${entry.item_title}` : ''}</option>}
          {(items ?? []).map(i => <option key={i.id} value={i.item_number}>{project}-{i.item_number} · {i.title}</option>)}
        </Select>
        <Input id={`${formId}-search`} label={t('timeTracking.searchItems')} value={search} onChange={e => setSearch(e.target.value)} disabled={!project} />
        <div className="flex items-center justify-between gap-4 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('timeTracking.duration')}</span>
          <span dir="ltr" className="font-mono text-2xl tabular-nums text-gray-900 dark:text-gray-100">{formatTimeDuration(mode === 'manual' ? manualSeconds || 0 : seconds)}</span>
        </div>
      </div>
      {mode === 'manual' && <div className="grid gap-4 sm:grid-cols-2">
        <Input id={`${formId}-start`} label={t('timeTracking.startTime')} type="datetime-local" step="1" required value={start} onChange={e => setStart(e.target.value)} dir="ltr" />
        <Input id={`${formId}-end`} label={t('timeTracking.endTime')} type="datetime-local" step="1" required value={end} onChange={e => setEnd(e.target.value)} dir="ltr" />
      </div>}
      {itemError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{getLocalizedError(itemError, t, 'timeTracking.error')}</p>}
      {invalidRange && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t('timeTracking.invalidRange')}</p>}
      {error != null && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{getLocalizedError(error, t, 'timeTracking.error')}</p>}
      {warning && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <span>{t('timeTracking.overlapWarning')}</span>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => { setError(null); void save(warning).catch(setError) }}>{t('timeTracking.saveAnyway')}</Button>
      </div>}
      <div className="flex flex-wrap items-center gap-3">
        {mode === 'timer' && timer ? <Button type="button" variant="danger" disabled={pending} onClick={() => { setError(null); void mutations.stop.mutateAsync(timer.id).catch(setError) }} className="inline-flex items-center gap-2"><Square className="h-4 w-4" aria-hidden="true" />{t('timeTracking.stop')}</Button> :
          <Button type="submit" disabled={pending || !project || !!warning || (mode === 'timer' && (timerLoading || timerError))} className="inline-flex items-center gap-2"><Play className="h-4 w-4" aria-hidden="true" />{mode === 'timer' ? t('timeTracking.start') : t('common.save')}</Button>}
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>}
        {saved && <span role="status" className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400"><Check className="h-4 w-4" aria-hidden="true" />{t('timeTracking.saved')}</span>}
        {mode === 'timer' && timer && <span className="text-sm text-gray-500 dark:text-gray-400">{t('timeTracking.runningProject', { project: timer.project_name })}</span>}
        {mode === 'timer' && timerError && <span role="alert" className="text-sm text-red-600 dark:text-red-400">{t('timeTracking.error')}</span>}
      </div>
    </form>
  </div>
}
