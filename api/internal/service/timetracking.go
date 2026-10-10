package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/marcoshack/taskwondo/internal/model"
)

type TimeTrackingRepository interface {
	List(ctx context.Context, filter model.TimeFilter) ([]model.TrackedTime, error)
	Get(ctx context.Context, id uuid.UUID) (*model.TrackedTime, error)
	Save(ctx context.Context, entry *model.TrackedTime, actor uuid.UUID, create bool) error
	Remove(ctx context.Context, id, actor uuid.UUID) error
	Active(ctx context.Context, user uuid.UUID) (*model.TimeTimer, error)
	Start(ctx context.Context, timer *model.TimeTimer) error
	Stop(ctx context.Context, id, user uuid.UUID) (*model.TrackedTime, error)
}

type TimeTrackingService struct {
	repo     TimeTrackingRepository
	projects ProjectRepository
	members  ProjectMemberRepository
	items    WorkItemRepository
	now      func() time.Time
}

func NewTimeTrackingService(repo TimeTrackingRepository, projects ProjectRepository, members ProjectMemberRepository, items WorkItemRepository) *TimeTrackingService {
	return &TimeTrackingService{repo: repo, projects: projects, members: members, items: items, now: time.Now}
}

type TrackedTimeInput struct {
	ProjectKey  string    `json:"project_key"`
	ItemNumber  *int      `json:"item_number"`
	Description string    `json:"description"`
	StartedAt   time.Time `json:"started_at"`
	EndedAt     time.Time `json:"ended_at"`
}

func timeValidation(message string) error {
	return model.NewKeyedError(model.ErrValidation, "time_tracking_invalid", message, nil)
}

func (s *TimeTrackingService) role(ctx context.Context, info *model.AuthInfo, project uuid.UUID) (string, error) {
	if info == nil || info.IsSystemKey() {
		return "", model.ErrForbidden
	}
	if info.GlobalRole == model.RoleAdmin {
		return model.ProjectRoleOwner, nil
	}
	member, err := s.members.GetByProjectAndUser(ctx, project, info.UserID)
	if errors.Is(err, model.ErrNotFound) {
		return "", model.ErrForbidden
	}
	if err != nil {
		return "", fmt.Errorf("checking time tracking membership: %w", err)
	}
	if member.Role != model.ProjectRoleOwner && member.Role != model.ProjectRoleAdmin && member.Role != model.ProjectRoleMember {
		return "", model.ErrForbidden
	}
	return member.Role, nil
}

func (s *TimeTrackingService) scope(ctx context.Context, info *model.AuthInfo, f *model.TimeFilter) error {
	if info == nil || info.IsSystemKey() {
		return model.ErrForbidden
	}
	if f.From.IsZero() || !f.To.After(f.From) || f.To.Sub(f.From) > 366*24*time.Hour {
		return timeValidation("invalid date range")
	}
	var projects []model.Project
	var err error
	if info.GlobalRole == model.RoleAdmin {
		projects, err = s.projects.ListAll(ctx)
	} else {
		projects, err = s.projects.ListByUser(ctx, info.UserID)
	}
	if err != nil {
		return fmt.Errorf("listing time tracking projects: %w", err)
	}
	ns := model.NamespaceIDFromContext(ctx)
	f.ProjectIDs, f.ManagedIDs = []uuid.UUID{}, []uuid.UUID{}
	f.ActorID = info.UserID
	for _, p := range projects {
		if p.NamespaceID == nil || *p.NamespaceID != ns {
			continue
		}
		role, err := s.role(ctx, info, p.ID)
		if errors.Is(err, model.ErrForbidden) {
			continue
		}
		if err != nil {
			return err
		}
		f.ProjectIDs = append(f.ProjectIDs, p.ID)
		if role == model.ProjectRoleOwner || role == model.ProjectRoleAdmin {
			f.ManagedIDs = append(f.ManagedIDs, p.ID)
		}
	}
	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 50
	}
	return nil
}

func timePage(entries []model.TrackedTime, limit int) model.TimePage {
	page := model.TimePage{Entries: entries, HasMore: len(entries) > limit}
	if page.HasMore {
		page.Entries = entries[:limit]
		page.Cursor = page.Entries[limit-1].ID.String()
	}
	return page
}

func (s *TimeTrackingService) List(ctx context.Context, info *model.AuthInfo, f model.TimeFilter) (model.TimePage, error) {
	f.Personal = true
	if err := s.scope(ctx, info, &f); err != nil {
		return model.TimePage{}, err
	}
	limit := f.Limit
	f.Limit++
	entries, err := s.repo.List(ctx, f)
	return timePage(entries, limit), err
}

func (s *TimeTrackingService) resolve(ctx context.Context, info *model.AuthInfo, input TrackedTimeInput) (*model.TrackedTime, error) {
	if strings.TrimSpace(input.ProjectKey) == "" {
		return nil, timeValidation("project is required")
	}
	if len(input.Description) > 10000 {
		return nil, timeValidation("description is too long")
	}
	project, err := s.projects.GetByKey(ctx, input.ProjectKey)
	if err != nil {
		return nil, err
	}
	ns := model.NamespaceIDFromContext(ctx)
	if project.NamespaceID == nil || *project.NamespaceID != ns {
		return nil, model.ErrNotFound
	}
	if _, err := s.role(ctx, info, project.ID); err != nil {
		return nil, err
	}
	entry := &model.TrackedTime{ProjectID: project.ID, UserID: info.UserID, Description: strings.TrimSpace(input.Description), StartedAt: input.StartedAt.UTC(), EndedAt: input.EndedAt.UTC()}
	if input.ItemNumber != nil {
		if *input.ItemNumber <= 0 {
			return nil, timeValidation("invalid item number")
		}
		item, err := s.items.GetByProjectAndNumber(ctx, project.ID, *input.ItemNumber)
		if err != nil {
			return nil, err
		}
		entry.WorkItemID = &item.ID
	}
	return entry, nil
}

func (s *TimeTrackingService) editable(ctx context.Context, info *model.AuthInfo, id uuid.UUID) (*model.TrackedTime, error) {
	entry, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	p, err := s.projects.GetByID(ctx, entry.ProjectID)
	if err != nil {
		return nil, err
	}
	if p.NamespaceID == nil || *p.NamespaceID != model.NamespaceIDFromContext(ctx) {
		return nil, model.ErrNotFound
	}
	role, err := s.role(ctx, info, p.ID)
	if err != nil {
		return nil, err
	}
	if entry.UserID != info.UserID && role == model.ProjectRoleMember {
		return nil, model.ErrForbidden
	}
	return entry, nil
}

func (s *TimeTrackingService) Save(ctx context.Context, info *model.AuthInfo, id *uuid.UUID, input TrackedTimeInput) (*model.TrackedTime, error) {
	entry, err := s.resolve(ctx, info, input)
	if err != nil {
		return nil, err
	}
	if input.StartedAt.IsZero() || !input.EndedAt.After(input.StartedAt) || input.EndedAt.After(s.now()) {
		return nil, timeValidation("start and end must be valid past times")
	}
	seconds := int64(input.EndedAt.Sub(input.StartedAt) / time.Second)
	if seconds < 1 || seconds > 2147483647 {
		return nil, timeValidation("duration is out of range")
	}
	entry.DurationSeconds = int(seconds)
	entry.EndedAt = entry.StartedAt.Add(time.Duration(seconds) * time.Second)
	if id == nil {
		entry.ID = uuid.Must(uuid.NewV7())
	} else {
		previous, err := s.editable(ctx, info, *id)
		if err != nil {
			return nil, err
		}
		// Editing cannot transfer another person's time into an unmanaged project.
		if previous.UserID != info.UserID {
			role, err := s.role(ctx, info, entry.ProjectID)
			if err != nil {
				return nil, err
			}
			if role == model.ProjectRoleMember {
				return nil, model.ErrForbidden
			}
		}
		entry.ID, entry.UserID = *id, previous.UserID
	}
	if err := s.repo.Save(ctx, entry, info.UserID, id == nil); err != nil {
		return nil, fmt.Errorf("saving tracked time: %w", err)
	}
	return s.repo.Get(ctx, entry.ID)
}

func (s *TimeTrackingService) Delete(ctx context.Context, info *model.AuthInfo, id uuid.UUID) error {
	if _, err := s.editable(ctx, info, id); err != nil {
		return err
	}
	return s.repo.Remove(ctx, id, info.UserID)
}

func (s *TimeTrackingService) Start(ctx context.Context, info *model.AuthInfo, input TrackedTimeInput) (*model.TimeTimer, error) {
	entry, err := s.resolve(ctx, info, input)
	if err != nil {
		return nil, err
	}
	timer := &model.TimeTimer{ID: uuid.Must(uuid.NewV7()), UserID: info.UserID, ProjectID: entry.ProjectID, WorkItemID: entry.WorkItemID, Description: entry.Description}
	if err := s.repo.Start(ctx, timer); err != nil {
		return nil, err
	}
	return s.Active(ctx, info)
}

func (s *TimeTrackingService) Active(ctx context.Context, info *model.AuthInfo) (*model.TimeTimer, error) {
	if info == nil || info.IsSystemKey() {
		return nil, model.ErrForbidden
	}
	timer, err := s.repo.Active(ctx, info.UserID)
	if timer != nil {
		timer.ServerNow = s.now().UTC()
	}
	return timer, err
}

func (s *TimeTrackingService) Stop(ctx context.Context, info *model.AuthInfo, id uuid.UUID) (*model.TrackedTime, error) {
	if info == nil || info.IsSystemKey() {
		return nil, model.ErrForbidden
	}
	return s.repo.Stop(ctx, id, info.UserID)
}

func buckets(values map[string]model.TimeBucket) []model.TimeBucket {
	result := make([]model.TimeBucket, 0, len(values))
	for _, value := range values {
		result = append(result, value)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Key < result[j].Key })
	return result
}

func addBucket(values map[string]model.TimeBucket, key, label string, seconds int64) {
	value := values[key]
	value.Key, value.Label = key, label
	value.Seconds += seconds
	values[key] = value
}

// Report allocates actual elapsed seconds at local midnight boundaries, including DST.
func (s *TimeTrackingService) Report(ctx context.Context, info *model.AuthInfo, f model.TimeFilter, timezone string) (*model.TimeReport, []model.TrackedTime, error) {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return nil, nil, timeValidation("invalid timezone")
	}
	if err := s.scope(ctx, info, &f); err != nil {
		return nil, nil, err
	}
	limit, cursor, selectedUser := f.Limit, f.Cursor, f.UserID
	f.Limit, f.Cursor, f.UserID = 0, nil, nil
	entries, err := s.repo.List(ctx, f)
	if err != nil {
		return nil, nil, err
	}
	report := &model.TimeReport{}
	daily, projects, people, items, options := map[string]model.TimeBucket{}, map[string]model.TimeBucket{}, map[string]model.TimeBucket{}, map[string]model.TimeBucket{}, map[string]model.TimeBucket{}
	filtered := make([]model.TrackedTime, 0)
	details := make([]model.TrackedTime, 0)
	pastCursor := cursor == nil
	for _, e := range entries {
		addBucket(options, e.UserID.String(), e.UserName, 0)
		if selectedUser != nil && e.UserID != *selectedUser {
			continue
		}
		filtered = append(filtered, e)
		if pastCursor {
			details = append(details, e)
		} else if e.ID == *cursor {
			pastCursor = true
		}
		start, end := e.StartedAt, e.EndedAt
		if start.Before(f.From) {
			start = f.From
		}
		if end.After(f.To) {
			end = f.To
		}
		seconds := int64(end.Sub(start) / time.Second)
		report.TotalSeconds += seconds
		addBucket(projects, e.ProjectKey, e.ProjectName, seconds)
		addBucket(people, e.UserID.String(), e.UserName, seconds)
		itemKey, itemLabel := "", ""
		if e.ItemNumber != nil {
			itemKey = fmt.Sprintf("%s-%d", e.ProjectKey, *e.ItemNumber)
			itemLabel = itemKey
			if e.ItemTitle != nil {
				itemLabel += " · " + *e.ItemTitle
			}
		}
		addBucket(items, itemKey, itemLabel, seconds)
		allocationStart := start
		for start.Before(end) {
			local := start.In(loc)
			midnight := time.Date(local.Year(), local.Month(), local.Day()+1, 0, 0, 0, 0, loc)
			bound := end
			if midnight.Before(bound) {
				bound = midnight
			}
			// Carry fractional seconds across midnight instead of discarding
			// them independently on both sides of a timer's daily split.
			daySeconds := int64(bound.Sub(allocationStart)/time.Second) - int64(start.Sub(allocationStart)/time.Second)
			addBucket(daily, local.Format("2006-01-02"), local.Format("2006-01-02"), daySeconds)
			start = bound
		}
	}
	report.Daily, report.Projects, report.People, report.Items, report.PeopleOptions = buckets(daily), buckets(projects), buckets(people), buckets(items), buckets(options)
	report.Details = timePage(details, limit)
	return report, filtered, nil
}
