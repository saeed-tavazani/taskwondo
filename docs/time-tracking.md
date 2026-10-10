# Time tracking

The **Time tracking** and **Time reports** pages are available below project
navigation. They use the active namespace. Project owners, project admins and
members can track time; viewers and customers cannot.

Choose an existing project before starting a timer or adding manual time. An
item and description are optional. Timers keep running on the server when you
leave the page, close the browser or sign out. Each user can run one timer across
all namespaces. The timer indicator can stop it from any signed-in page, even
after changing namespaces. Starting again from an entry creates a new session.

Manual entries require a start and end in the past. Overlapping entries display
a warning, but can be saved. Reports sum recorded durations, including overlaps;
they do not deduplicate overlapping minutes.

Reports include completed entries and historical item time entries. Users see
their own time. Project owners/admins can report on, edit and delete time within
their managed projects. System admins have access within the selected namespace.
Only the timer owner can stop a running timer. Time edits and soft deletes retain
the actor and before/after values in `time_entry_audit`.

Dates use the browser timezone in the tracker. Reports offer an IANA timezone
selector. Cross-midnight entries are allocated to each local day using actual
elapsed time, including daylight saving transitions. Range totals clip entries
to the selected interval. Detail rows retain the original interval; CSV includes
both original duration and seconds within the report range. CSV exports all
filtered entries regardless of detail pagination.

## API

All routes require authentication and existing API-key method permissions.

- `GET/POST /api/v1/{namespace}/time-tracking/entries`
- `PUT/DELETE /api/v1/{namespace}/time-tracking/entries/{entryId}`
- `POST /api/v1/{namespace}/time-tracking/timers`
- `GET /api/v1/{namespace}/time-tracking/reports`
- `GET /api/v1/{namespace}/time-tracking/reports.csv`
- `GET /api/v1/user/time-timer` — active timer, or `null`
- `POST /api/v1/user/time-timers/{timerId}/stop` — repeat requests return the
  original completed entry without creating another entry

Manual entry input: `project_key`, nullable `item_number`, optional `description`,
and RFC3339 `started_at` / `ended_at`. Timer input uses the same project, item and
description fields; the server supplies the start time.

List/report queries require RFC3339 `from` and exclusive `to` (maximum 366 days),
and accept `project_key`, `item_number`, `user_id`, `cursor`, and `limit` (1–100).
Reports also accept `timezone` (default UTC). The tracker list always returns
the caller's own entries. Report permissions are enforced server-side.

Migration 64 backfills projects for existing entries and adds persistent timers
and audit records. Existing item-level API contracts are unchanged. Rollback
refuses to discard project-only entries or running timers.

## Database integration tests

Set `MONTASK_TEST_DATABASE_URL` to a disposable PostgreSQL server with pgvector
available, then run `go test ./internal/handler -run TestTimeTrackingHTTPIntegration`.
The test creates and drops a uniquely named database and requires database-create
permission. It checks migration backfill, legacy compatibility, authorization,
item totals, audit records, CSV pagination, concurrent starts, and idempotent stops.

The browser acceptance tests are in
`test/e2e/tests/workitems/project-time-tracking.spec.ts` and
`test/e2e/tests/projects/time-tracking-namespace.spec.ts`. They cover personal
tracking, manager corrections, legacy item time, overlap confirmation, CSV,
timer persistence, namespace isolation, command navigation, and Persian mobile
layout. Run the full stack with `make test-e2e` using the pinned toolchain.
