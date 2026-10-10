package model

import (
	"time"

	"github.com/google/uuid"
)

// TrackedTime is the project-level view of a completed time entry. Existing
// item-level TimeEntry responses remain unchanged.
type TrackedTime struct {
	ID              uuid.UUID  `json:"id"`
	ProjectID       uuid.UUID  `json:"project_id"`
	ProjectKey      string     `json:"project_key"`
	ProjectName     string     `json:"project_name"`
	NamespaceSlug   string     `json:"namespace_slug"`
	WorkItemID      *uuid.UUID `json:"work_item_id"`
	ItemNumber      *int       `json:"item_number"`
	ItemTitle       *string    `json:"item_title"`
	UserID          uuid.UUID  `json:"user_id"`
	UserName        string     `json:"user_name"`
	StartedAt       time.Time  `json:"started_at"`
	EndedAt         time.Time  `json:"ended_at"`
	DurationSeconds int        `json:"duration_seconds"`
	Description     string     `json:"description"`
	CanEdit         bool       `json:"can_edit"`
	Overlap         bool       `json:"overlap"`
}

type TimeTimer struct {
	ID            uuid.UUID  `json:"id"`
	UserID        uuid.UUID  `json:"user_id"`
	ProjectID     uuid.UUID  `json:"project_id"`
	ProjectKey    string     `json:"project_key"`
	ProjectName   string     `json:"project_name"`
	NamespaceSlug string     `json:"namespace_slug"`
	WorkItemID    *uuid.UUID `json:"work_item_id"`
	ItemNumber    *int       `json:"item_number"`
	Description   string     `json:"description"`
	StartedAt     time.Time  `json:"started_at"`
	ServerNow     time.Time  `json:"server_now"`
}

// TimeFilter uses exclusive end bounds and clips durations to the requested
// interval. Permissions are supplied by the service, never by the client.
type TimeFilter struct {
	From       time.Time
	To         time.Time
	ProjectKey string
	ItemNumber *int
	UserID     *uuid.UUID
	Cursor     *uuid.UUID
	Limit      int
	ProjectIDs []uuid.UUID
	ManagedIDs []uuid.UUID
	ActorID    uuid.UUID
	Personal   bool
}

type TimePage struct {
	Entries []TrackedTime `json:"entries"`
	Cursor  string        `json:"cursor"`
	HasMore bool          `json:"has_more"`
}

type TimeBucket struct {
	Key     string `json:"key"`
	Label   string `json:"label"`
	Seconds int64  `json:"seconds"`
}

type TimeReport struct {
	TotalSeconds  int64        `json:"total_seconds"`
	Daily         []TimeBucket `json:"daily"`
	Projects      []TimeBucket `json:"projects"`
	People        []TimeBucket `json:"people"`
	Items         []TimeBucket `json:"items"`
	PeopleOptions []TimeBucket `json:"people_options"`
	Details       TimePage     `json:"details"`
}
