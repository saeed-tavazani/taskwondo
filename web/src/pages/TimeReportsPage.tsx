import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BarChart3, Download, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { AppSidebar } from '@/components/AppSidebar'
import { TimeEntryActions } from '@/components/TimeEntryActions'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { TimezoneSelect } from '@/components/ui/TimezoneSelect'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Spinner } from '@/components/ui/Spinner'
import { useTimeProjects, useTimeReport } from '@/hooks/useTimeTracking'
import { useNamespacePath } from '@/hooks/useNamespacePath'
import { exportTimeReport } from '@/api/timeTracking'
import { formatTimeDuration, localDateInput, dateRange } from '@/utils/timeTracking'
import { getLocalizedError } from '@/utils/apiError'
import { useLayout } from '@/contexts/LayoutContext'
import { useNamespaceContext } from '@/contexts/NamespaceContext'

const panel = 'rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'

export function TimeReportsPage() {
  const { activeNamespace } = useNamespaceContext()
  return <TimeReportsContent key={activeNamespace?.slug ?? 'default'} />
}

function TimeReportsContent() {
  const { t, i18n } = useTranslation()
  const { p } = useNamespacePath()
  const { containerClass } = useLayout()
  const { ns, projects, canTrackTime, isPending: loadingProjects, error: projectsError } = useTimeProjects()
  const today = localDateInput(new Date())
  const [from, setFrom] = useState(localDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo] = useState(today)
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [project, setProject] = useState('')
  const [item, setItem] = useState('')
  const [person, setPerson] = useState('')
  const [group, setGroup] = useState('projects')
  const [cursor, setCursor] = useState('')
  const [previous, setPrevious] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<unknown>(null)
  const valid = !!from && !!to && from <= to
  const filters = { ...dateRange(valid ? from : today, valid ? to : today, timezone), timezone, project_key: project || undefined, item_number: item && project ? Number(item) : undefined, user_id: person || undefined, cursor: cursor || undefined }
  const report = useTimeReport(ns, filters)
  const data = report.data
  const summaries = group === 'people' ? data?.people : group === 'items' ? data?.items : data?.projects
  const reset = () => { setCursor(''); setPrevious([]) }
  async function download() {
    setExporting(true); setExportError(null)
    try {
      const blob = await exportTimeReport(ns, filters)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = 'time-report.csv'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { setExportError(err) } finally { setExporting(false) }
  }
  const displayDate = (date: string) => new Date(date).toLocaleString(i18n.language === 'fa' ? 'fa-IR' : 'en-US', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short', hour12: false })
  return <div className={`${containerClass(true)} py-6`}><div className="flex gap-6"><AppSidebar /><div className="min-w-0 flex-1 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="inline-flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100"><BarChart3 className="h-5 w-5" aria-hidden="true" />{t('timeTracking.reports')}</h1><Link to={p('/time-tracking')} className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400"><Clock className="h-4 w-4" aria-hidden="true" />{t('timeTracking.title')}</Link></div>
    {loadingProjects ? <Spinner /> : projectsError ? <p role="alert">{getLocalizedError(projectsError, t, 'timeTracking.error')}</p> : !canTrackTime ? <p role="alert">{t('timeTracking.noAccess')}</p> : <>
      <div className={`${panel} grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3`}>
        <Input label={t('timeTracking.from')} type="date" value={from} onChange={e => { setFrom(e.target.value); reset() }} />
        <Input label={t('timeTracking.to')} type="date" value={to} onChange={e => { setTo(e.target.value); reset() }} />
        <Select label={t('timeTracking.project')} value={project} onChange={e => { setProject(e.target.value); setItem(''); reset() }}><option value="">{t('timeTracking.allProjects')}</option>{projects.map(pr => <option key={pr.id} value={pr.key}>{pr.name}</option>)}</Select>
        <Input label={t('timeTracking.itemNumber')} type="number" min="1" value={item} disabled={!project} onChange={e => { setItem(e.target.value); reset() }} />
        <Select label={t('timeTracking.person')} value={person} onChange={e => { setPerson(e.target.value); reset() }}><option value="">{t('timeTracking.allPeople')}</option>{(data?.people_options ?? []).map(pe => <option key={pe.key} value={pe.key}>{pe.label}</option>)}</Select>
        <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('timeTracking.timezone')}</label><TimezoneSelect value={timezone} onChange={tz => { setTimezone(tz); reset() }} /></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-gray-500 dark:text-gray-400">{t('timeTracking.completedOnly')}</p><Button variant="secondary" disabled={exporting || !valid || report.isPending || report.isError} onClick={() => void download()} className="inline-flex items-center gap-2"><Download className="h-4 w-4" aria-hidden="true" />{t('timeTracking.export')}</Button></div>
      {exportError != null && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{getLocalizedError(exportError, t, 'timeTracking.error')}</p>}
      {!valid && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t('timeTracking.invalidRange')}</p>}
      {report.isPending ? <Spinner /> : report.error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{getLocalizedError(report.error, t, 'timeTracking.error')}</p> : <>
        <div className={`${panel} p-5`}><p className="text-sm text-gray-500 dark:text-gray-400">{t('timeTracking.total')}</p><p dir="ltr" className="mt-2 w-fit font-mono text-3xl font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">{formatTimeDuration(data?.total_seconds ?? 0)}</p></div>
        <section className={`${panel} p-4`}><h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{t('timeTracking.daily')}</h2>{!data?.daily.length ? <p className="py-8 text-center text-gray-500 dark:text-gray-400">{t('timeTracking.empty')}</p> : <div dir="ltr" className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.daily}><XAxis dataKey="key" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => new Date(`${v}T12:00:00`).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })} /><YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => formatTimeDuration(Number(v))} width={80} /><Tooltip formatter={v => [formatTimeDuration(Number(v)), t('timeTracking.duration')]} /><Bar dataKey="seconds" fill="#6366f1" radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>}</section>
        <section className={`${panel} p-4`}><Tabs tabs={[{ key: 'projects', label: t('timeTracking.byProject') }, { key: 'people', label: t('timeTracking.byPerson') }, { key: 'items', label: t('timeTracking.byItem') }]} activeTab={group} onTabChange={setGroup} /><div className="mt-4 space-y-3">{(summaries ?? []).map(bucket => <div key={bucket.key} className="space-y-1"><div className="flex items-center justify-between gap-4 text-sm text-gray-700 dark:text-gray-200"><span className="truncate">{bucket.label || t('timeTracking.noItem')}</span><span dir="ltr" className="font-mono tabular-nums">{formatTimeDuration(bucket.seconds)}</span></div><div className="h-1.5 rounded bg-gray-100 dark:bg-gray-700"><div className="h-full rounded bg-indigo-500" style={{ width: `${data?.total_seconds ? bucket.seconds / data.total_seconds * 100 : 0}%` }} /></div></div>)}</div></section>
        <section className={panel}><h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">{t('timeTracking.details')}</h2><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead className="bg-gray-50 text-gray-500 dark:bg-gray-900/40 dark:text-gray-400"><tr>{['description', 'project', 'person', 'item', 'startTime', 'endTime', 'duration', 'actions'].map(key => <th key={key} className="whitespace-nowrap px-4 py-3 text-start font-medium">{t(`timeTracking.${key}`)}</th>)}</tr></thead><tbody>{(data?.details.entries ?? []).map(entry => <tr key={entry.id} className="border-t border-gray-100 text-gray-700 dark:border-gray-700 dark:text-gray-200"><td className="max-w-64 break-words px-4 py-3">{entry.description || t('timeTracking.noDescription')}{entry.overlap && <span className="block text-xs text-amber-700 dark:text-amber-300">{t('timeTracking.overlap')}</span>}</td><td className="px-4 py-3">{entry.project_name}</td><td className="px-4 py-3">{entry.user_name}</td><td className="px-4 py-3">{entry.item_number ? `${entry.project_key}-${entry.item_number}` : t('timeTracking.noItem')}</td><td className="whitespace-nowrap px-4 py-3">{displayDate(entry.started_at)}</td><td className="whitespace-nowrap px-4 py-3">{displayDate(entry.ended_at)}</td><td className="px-4 py-3"><span dir="ltr" className="inline-block font-mono tabular-nums">{formatTimeDuration(entry.duration_seconds)}</span></td><td className="px-4 py-3"><TimeEntryActions ns={ns} entry={entry} projects={projects} /></td></tr>)}</tbody></table></div>{!data?.details.entries.length && <p className="p-8 text-center text-gray-500 dark:text-gray-400">{t('timeTracking.empty')}</p>}</section>
        <div className="flex justify-end gap-2"><Button variant="secondary" disabled={!previous.length} onClick={() => { setCursor(previous.at(-1) ?? ''); setPrevious(previous.slice(0, -1)) }}>{t('timeTracking.previous')}</Button><Button variant="secondary" disabled={!data?.details.has_more} onClick={() => { setPrevious([...previous, cursor]); setCursor(data?.details.cursor ?? '') }}>{t('timeTracking.next')}</Button></div>
      </>}
    </>}
  </div></div></div>
}
