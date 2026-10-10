import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useNamespaceContext } from '@/contexts/NamespaceContext'
import { api, nsPrefix } from '@/api/client'
import type { Project } from '@/api/projects'
import { activeTimeTimer, stopTimeTimer, startTimeTimer, saveTrackedTime, deleteTrackedTime, getTimeEntries, getTimeReport, type TimeFilters, type TimeInput } from '@/api/timeTracking'

export function useActiveTimeTimer() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['time-timer', user?.id], queryFn: activeTimeTimer, enabled: !!user, refetchInterval: 15000, refetchOnWindowFocus: 'always' })
}
export function useTimerSeconds() {
  const query = useActiveTimeTimer()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!query.data) return
    const interval = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [query.data])
  const seconds = query.data ? Math.max(0, Math.floor((Date.parse(query.data.server_now) - Date.parse(query.data.started_at) + Math.max(0, (tick || query.dataUpdatedAt) - query.dataUpdatedAt)) / 1000)) : 0
  return { ...query, seconds }
}
export function useTimeMutations(ns: string) {
  const client = useQueryClient()
  const invalidate = async () => {
    await Promise.all(['time-timer', 'tracked-time', 'time-report', 'projects', 'workitems', 'milestones'].map(key => client.invalidateQueries({ queryKey: [key] })))
  }
  return {
    start: useMutation({ mutationFn: (input: TimeInput) => startTimeTimer(ns, input), onSuccess: invalidate, retry: false }),
    stop: useMutation({ mutationFn: stopTimeTimer, onSuccess: invalidate, retry: false }),
    save: useMutation({ mutationFn: ({ input, id }: { input: TimeInput; id?: string }) => saveTrackedTime(ns, input, id), onSuccess: invalidate, retry: false }),
    remove: useMutation({ mutationFn: (id: string) => deleteTrackedTime(ns, id), onSuccess: invalidate, retry: false }),
  }
}

export function useTimeProjects() {
  const { user } = useAuth()
  const { activeNamespace } = useNamespaceContext()
  const ns = activeNamespace?.slug ?? 'default'
  const query = useQuery({ queryKey: ['time-projects', user?.id, ns], queryFn: async () => (await api.get<{ data: Project[] }>(`${nsPrefix(ns)}/projects`)).data.data, enabled: !!user })
  const projects = (query.data ?? []).filter(p => user?.global_role === 'admin' || ['owner', 'admin', 'member'].includes(p.member_role ?? ''))
  return { ...query, ns, projects, canTrackTime: !!query.data && (projects.length > 0 || query.data.length === 0) }
}
export function useTrackedTime(ns: string, filters: TimeFilters) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['tracked-time', user?.id, ns, filters], queryFn: () => getTimeEntries(ns, filters) })
}
export function useTimeReport(ns: string, filters: TimeFilters) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['time-report', user?.id, ns, filters], queryFn: () => getTimeReport(ns, filters) })
}
