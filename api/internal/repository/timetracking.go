package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/marcoshack/taskwondo/internal/model"
)

type TimeTrackingRepository struct{ db *sql.DB }

func NewTimeTrackingRepository(db *sql.DB) *TimeTrackingRepository {
	return &TimeTrackingRepository{db: db}
}

const trackedColumns = `t.id, t.project_id, p.key, p.name, n.slug, t.work_item_id, w.item_number, w.title,
    t.user_id, u.display_name, t.started_at, t.started_at + t.duration_seconds * interval '1 second',
    t.duration_seconds, COALESCE(t.description, '')`
const trackedJoins = ` FROM time_entries t JOIN projects p ON p.id=t.project_id JOIN namespaces n ON n.id=p.namespace_id
    JOIN users u ON u.id=t.user_id LEFT JOIN work_items w ON w.id=t.work_item_id `

type timeScanner interface{ Scan(...interface{}) error }

func scanTracked(row timeScanner, overlap ...bool) (*model.TrackedTime, error) {
	var e model.TrackedTime
	args := []interface{}{&e.ID, &e.ProjectID, &e.ProjectKey, &e.ProjectName, &e.NamespaceSlug, &e.WorkItemID, &e.ItemNumber, &e.ItemTitle, &e.UserID, &e.UserName, &e.StartedAt, &e.EndedAt, &e.DurationSeconds, &e.Description}
	if len(overlap) > 0 {
		args = append(args, &e.Overlap)
	}
	err := row.Scan(args...)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, model.ErrNotFound
	}
	return &e, err
}

func (r *TimeTrackingRepository) Get(ctx context.Context, id uuid.UUID) (*model.TrackedTime, error) {
	return scanTracked(r.db.QueryRowContext(ctx, `SELECT `+trackedColumns+trackedJoins+` WHERE t.id=$1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL`, id))
}

func (r *TimeTrackingRepository) List(ctx context.Context, f model.TimeFilter) ([]model.TrackedTime, error) {
	query := `SELECT ` + trackedColumns + `, EXISTS(SELECT 1 FROM time_entries other WHERE other.user_id=t.user_id
        AND other.id<>t.id AND other.deleted_at IS NULL
        AND other.started_at<t.started_at+t.duration_seconds*interval '1 second'
        AND other.started_at+other.duration_seconds*interval '1 second'>t.started_at)` + trackedJoins + ` WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
      AND t.project_id=ANY($1::uuid[]) AND (t.user_id=$2 OR (NOT $3 AND t.project_id=ANY($4::uuid[])))
      AND t.started_at < $6 AND t.started_at + t.duration_seconds * interval '1 second' > $5
      AND ($7='' OR p.key=$7) AND ($8::integer IS NULL OR w.item_number=$8)
      AND ($9::uuid IS NULL OR t.user_id=$9)
      AND ($10::uuid IS NULL OR (t.started_at,t.id) < (SELECT started_at,id FROM time_entries WHERE id=$10))
      ORDER BY t.started_at DESC,t.id DESC`
	args := []interface{}{pq.Array(f.ProjectIDs), f.ActorID, f.Personal, pq.Array(f.ManagedIDs), f.From, f.To, f.ProjectKey, f.ItemNumber, f.UserID, f.Cursor}
	if f.Limit > 0 {
		query += ` LIMIT $11`
		args = append(args, f.Limit)
	}
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing tracked time: %w", err)
	}
	defer rows.Close()
	entries := make([]model.TrackedTime, 0)
	managed := map[uuid.UUID]bool{}
	for _, id := range f.ManagedIDs {
		managed[id] = true
	}
	for rows.Next() {
		e, err := scanTracked(rows, true)
		if err != nil {
			return nil, err
		}
		e.CanEdit = e.UserID == f.ActorID || managed[e.ProjectID]
		entries = append(entries, *e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return entries, nil
}

func setTimeActor(ctx context.Context, tx *sql.Tx, actor uuid.UUID) error {
	_, err := tx.ExecContext(ctx, `SELECT set_config('montask.time_actor',$1,true)`, actor.String())
	return err
}

func timeItemEvent(ctx context.Context, tx *sql.Tx, item *uuid.UUID, actor, entry uuid.UUID, action string) error {
	if item == nil {
		return nil
	}
	_, err := tx.ExecContext(ctx, `INSERT INTO work_item_events(id,work_item_id,actor_id,event_type,visibility,metadata)
        VALUES($1,$2,$3,$4,'internal',jsonb_build_object('time_entry_id',$5::text))`, uuid.Must(uuid.NewV7()), item, actor, action, entry.String())
	return err
}

func (r *TimeTrackingRepository) Save(ctx context.Context, e *model.TrackedTime, actor uuid.UUID, create bool) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = setTimeActor(ctx, tx, actor); err != nil {
		return err
	}
	action := "time_logged"
	if create {
		_, err = tx.ExecContext(ctx, `INSERT INTO time_entries(id,project_id,work_item_id,user_id,started_at,duration_seconds,description)
            VALUES($1,$2,$3,$4,$5,$6,$7)`, e.ID, e.ProjectID, e.WorkItemID, e.UserID, e.StartedAt, e.DurationSeconds, e.Description)
	} else {
		var oldItem *uuid.UUID
		err = tx.QueryRowContext(ctx, `SELECT work_item_id FROM time_entries WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, e.ID).Scan(&oldItem)
		if errors.Is(err, sql.ErrNoRows) {
			return model.ErrNotFound
		}
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `UPDATE time_entries SET project_id=$2,work_item_id=$3,started_at=$4,duration_seconds=$5,description=$6,updated_at=now() WHERE id=$1`, e.ID, e.ProjectID, e.WorkItemID, e.StartedAt, e.DurationSeconds, e.Description)
		if err != nil {
			return err
		}
		if oldItem != nil && (e.WorkItemID == nil || *oldItem != *e.WorkItemID) {
			if err = timeItemEvent(ctx, tx, oldItem, actor, e.ID, "time_entry_updated"); err != nil {
				return err
			}
		}
		action = "time_entry_updated"
	}
	if err != nil {
		return err
	}
	if err = timeItemEvent(ctx, tx, e.WorkItemID, actor, e.ID, action); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *TimeTrackingRepository) Remove(ctx context.Context, id, actor uuid.UUID) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err = setTimeActor(ctx, tx, actor); err != nil {
		return err
	}
	var item *uuid.UUID
	err = tx.QueryRowContext(ctx, `UPDATE time_entries SET deleted_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING work_item_id`, id).Scan(&item)
	if errors.Is(err, sql.ErrNoRows) {
		return model.ErrNotFound
	}
	if err != nil {
		return err
	}
	if err = timeItemEvent(ctx, tx, item, actor, id, "time_entry_deleted"); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *TimeTrackingRepository) Active(ctx context.Context, user uuid.UUID) (*model.TimeTimer, error) {
	var t model.TimeTimer
	err := r.db.QueryRowContext(ctx, `SELECT t.id,t.user_id,t.project_id,p.key,p.name,n.slug,t.work_item_id,w.item_number,t.description,t.started_at
        FROM time_timers t JOIN projects p ON p.id=t.project_id JOIN namespaces n ON n.id=p.namespace_id
        LEFT JOIN work_items w ON w.id=t.work_item_id WHERE t.user_id=$1 AND t.stopped_at IS NULL`, user).
		Scan(&t.ID, &t.UserID, &t.ProjectID, &t.ProjectKey, &t.ProjectName, &t.NamespaceSlug, &t.WorkItemID, &t.ItemNumber, &t.Description, &t.StartedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &t, err
}

func (r *TimeTrackingRepository) Start(ctx context.Context, t *model.TimeTimer) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO time_timers(id,user_id,project_id,work_item_id,description) VALUES($1,$2,$3,$4,$5)`, t.ID, t.UserID, t.ProjectID, t.WorkItemID, t.Description)
	var pg *pq.Error
	if errors.As(err, &pg) && pg.Code == "23505" {
		return model.NewKeyedError(model.ErrConflict, "time_timer_active", "a timer is already running", nil)
	}
	return err
}

func (r *TimeTrackingRepository) Stop(ctx context.Context, id, user uuid.UUID) (*model.TrackedTime, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var project uuid.UUID
	var item, completed *uuid.UUID
	var description string
	var start time.Time
	err = tx.QueryRowContext(ctx, `SELECT project_id,work_item_id,description,started_at,entry_id FROM time_timers WHERE id=$1 AND user_id=$2 FOR UPDATE`, id, user).Scan(&project, &item, &description, &start, &completed)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, model.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if completed != nil {
		e, err := scanTracked(tx.QueryRowContext(ctx, `SELECT `+trackedColumns+trackedJoins+` WHERE t.id=$1`, completed))
		return e, err
	}
	if err = setTimeActor(ctx, tx, user); err != nil {
		return nil, err
	}
	entryID := uuid.Must(uuid.NewV7())
	// clock_timestamp is evaluated after the lock is acquired. Browser clocks
	// and transaction start times do not determine recorded duration.
	_, err = tx.ExecContext(ctx, `INSERT INTO time_entries(id,project_id,work_item_id,user_id,started_at,duration_seconds,description)
        VALUES($1,$2,$3,$4,$5,GREATEST(1,FLOOR(EXTRACT(EPOCH FROM (clock_timestamp()-$5::timestamptz))))::integer,$6)`, entryID, project, item, user, start, description)
	if err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx, `UPDATE time_timers SET stopped_at=clock_timestamp(),entry_id=$2 WHERE id=$1`, id, entryID)
	if err != nil {
		return nil, err
	}
	if err = timeItemEvent(ctx, tx, item, user, entryID, "time_logged"); err != nil {
		return nil, err
	}
	e, err := scanTracked(tx.QueryRowContext(ctx, `SELECT `+trackedColumns+trackedJoins+` WHERE t.id=$1`, entryID))
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	e.CanEdit = true
	return e, nil
}
