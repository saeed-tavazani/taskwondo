import { Link } from 'react-router-dom'
import { Clock, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTimerSeconds, useTimeMutations } from '@/hooks/useTimeTracking'
import { formatTimeDuration } from '@/utils/timeTracking'
import { toUrlSegment } from '@/utils/namespaceUrl'
import { getLocalizedError } from '@/utils/apiError'

export function ActiveTimeTimer() {
  const { t } = useTranslation()
  const { data: timer, seconds } = useTimerSeconds()
  const { stop } = useTimeMutations(timer?.namespace_slug ?? 'default')
  if (!timer) return null
  return <div className="border-b border-border bg-accent px-4 py-2 text-sm dark:border-border dark:bg-accent">
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Clock className="h-4 w-4 text-foreground dark:text-foreground" aria-hidden="true" />
      <Link className="max-w-64 truncate font-medium text-foreground dark:text-foreground" to={`/${toUrlSegment(timer.namespace_slug)}/time-tracking`}>{timer.project_name}{timer.description ? ` · ${timer.description}` : ''}</Link>
      <span dir="ltr" className="font-mono tabular-nums text-foreground dark:text-foreground">{formatTimeDuration(seconds)}</span>
      <button onClick={() => stop.mutate(timer.id)} disabled={stop.isPending} className="inline-flex items-center gap-1 rounded px-2 py-1 text-red-600 hover:bg-red-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950" aria-label={t('timeTracking.stop')}><Square className="h-3 w-3" aria-hidden="true" />{t('timeTracking.stop')}</button>
      {stop.error && <span role="alert" className="text-red-600 dark:text-red-400">{getLocalizedError(stop.error, t, 'timeTracking.error')}</span>}
    </div>
  </div>
}
