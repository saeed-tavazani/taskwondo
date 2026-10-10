import { api, nsPrefix } from './client'

export interface TrackedTime {
  id: string
  project_id: string
  project_key: string
  project_name: string
  namespace_slug: string
  work_item_id: string | null
  item_number: number | null
  item_title: string | null
  user_id: string
  user_name: string
  started_at: string
  ended_at: string
  duration_seconds: number
  description: string
  can_edit: boolean
  overlap: boolean
}
export interface TimeTimer {
  id: string
  project_key: string
  project_name: string
  namespace_slug: string
  item_number: number | null
  description: string
  started_at: string
  server_now: string
}
export interface TimeInput {
  project_key: string
  item_number: number | null
  description: string
  started_at?: string
  ended_at?: string
}
export interface TimeFilters {
  from: string
  to: string
  timezone?: string
  project_key?: string
  item_number?: number
  user_id?: string
  cursor?: string
  limit?: number
}
export interface TimePage { entries: TrackedTime[]; cursor: string; has_more: boolean }
export interface TimeBucket { key: string; label: string; seconds: number }
export interface TimeReport {
  total_seconds: number
  daily: TimeBucket[]
  projects: TimeBucket[]
  people: TimeBucket[]
  items: TimeBucket[]
  people_options: TimeBucket[]
  details: TimePage
}
const path = (ns: string) => `${nsPrefix(ns)}/time-tracking`
export async function getTimeEntries(ns: string, filters: TimeFilters): Promise<TimePage> {
  return (await api.get(`${path(ns)}/entries`, { params: filters })).data.data
}
export async function saveTrackedTime(ns: string, input: TimeInput, id?: string): Promise<TrackedTime> {
  return (await (id ? api.put(`${path(ns)}/entries/${id}`, input) : api.post(`${path(ns)}/entries`, input))).data.data
}
export async function deleteTrackedTime(ns: string, id: string) { await api.delete(`${path(ns)}/entries/${id}`) }
export async function startTimeTimer(ns: string, input: TimeInput): Promise<TimeTimer> {
  return (await api.post(`${path(ns)}/timers`, input)).data.data
}
export async function activeTimeTimer(): Promise<TimeTimer | null> { return (await api.get('/user/time-timer')).data.data }
export async function stopTimeTimer(id: string): Promise<TrackedTime> { return (await api.post(`/user/time-timers/${id}/stop`)).data.data }
export async function getTimeReport(ns: string, filters: TimeFilters): Promise<TimeReport> {
  return (await api.get(`${path(ns)}/reports`, { params: filters })).data.data
}
export async function exportTimeReport(ns: string, filters: TimeFilters): Promise<Blob> {
  return (await api.get(`${path(ns)}/reports.csv`, { params: { ...filters, cursor: undefined }, responseType: 'blob' })).data
}
