import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Play, Trash2 } from 'lucide-react'
import type { Project } from '@/api/projects'
import type { TrackedTime } from '@/api/timeTracking'
import { useActiveTimeTimer, useTimeMutations } from '@/hooks/useTimeTracking'
import { getLocalizedError } from '@/utils/apiError'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TimeEntryForm } from '@/components/TimeEntryForm'

export function TimeEntryActions({ ns, entry, projects, personal = false }: { ns: string; entry: TrackedTime; projects: Project[]; personal?: boolean }) {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)
  const { data: timer, isPending: loadingTimer, isError: timerError } = useActiveTimeTimer()
  const { start, remove } = useTimeMutations(ns)
  return <div className="flex flex-wrap items-center gap-1">
    {personal && <Button size="sm" variant="ghost" disabled={!!timer || loadingTimer || timerError || start.isPending} aria-label={t('timeTracking.repeat')} onClick={() => start.mutate({ project_key: entry.project_key, item_number: entry.item_number, description: entry.description })}><Play className="h-4 w-4" aria-hidden="true" /></Button>}
    {entry.can_edit && <><Button size="sm" variant="ghost" aria-label={t('timeTracking.edit')} onClick={() => setDialog('edit')}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>
      <Button size="sm" variant="ghost" aria-label={t('timeTracking.delete')} onClick={() => setDialog('delete')}><Trash2 className="h-4 w-4 text-red-500" aria-hidden="true" /></Button></>}
    {start.error && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{getLocalizedError(start.error, t, 'timeTracking.error')}</span>}
    <Modal open={dialog === 'edit'} onClose={() => setDialog(null)} title={t('timeTracking.edit')}>
      {dialog === 'edit' && <TimeEntryForm key={entry.id} ns={ns} projects={projects} entry={entry} onSaved={() => setDialog(null)} onCancel={() => setDialog(null)} />}
    </Modal>
    <Modal open={dialog === 'delete'} onClose={() => { if (!remove.isPending) setDialog(null) }} title={t('timeTracking.delete')}>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{t('timeTracking.removeConfirm')}</p>
      {remove.error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{getLocalizedError(remove.error, t, 'timeTracking.error')}</p>}
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDialog(null)} disabled={remove.isPending}>{t('common.cancel')}</Button><Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(entry.id, { onSuccess: () => setDialog(null) })}>{t('common.delete')}</Button></div>
    </Modal>
  </div>
}
