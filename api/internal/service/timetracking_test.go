package service

import (
	"context"
	"errors"
	"testing"
	"time"
	_ "time/tzdata"

	"github.com/google/uuid"
	"github.com/marcoshack/taskwondo/internal/model"
)

type timeReportRepo struct {
	TimeTrackingRepository
	entries []model.TrackedTime
	filter  model.TimeFilter
}

func (r *timeReportRepo) List(_ context.Context, f model.TimeFilter) ([]model.TrackedTime, error) {
	r.filter = f
	return r.entries, nil
}

type timeProjects struct {
	ProjectRepository
	projects []model.Project
}

func (r *timeProjects) ListAll(_ context.Context) ([]model.Project, error) { return r.projects, nil }
func (r *timeProjects) ListByUser(_ context.Context, _ uuid.UUID) ([]model.Project, error) {
	return r.projects, nil
}

type timeMembers struct {
	ProjectMemberRepository
	role string
}

func (r *timeMembers) GetByProjectAndUser(_ context.Context, _, _ uuid.UUID) (*model.ProjectMember, error) {
	return &model.ProjectMember{Role: r.role}, nil
}

func TestTimeReportMidnightDSTAndPagination(t *testing.T) {
	ns, otherNS, user, project, otherProject := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	loc, _ := time.LoadLocation("America/New_York")
	start := time.Date(2026, 3, 7, 23, 30, 0, 0, loc)
	end := time.Date(2026, 3, 9, 0, 30, 0, 0, loc)
	e := model.TrackedTime{ID: uuid.New(), ProjectID: project, ProjectKey: "TF", ProjectName: "Project", UserID: user, UserName: "Person", StartedAt: start, EndedAt: end, DurationSeconds: int(end.Sub(start) / time.Second)}
	repo := &timeReportRepo{entries: []model.TrackedTime{e, e}}
	repo.entries[1].ID = uuid.New()
	projects := &timeProjects{projects: []model.Project{{ID: project, NamespaceID: &ns}, {ID: otherProject, NamespaceID: &otherNS}}}
	svc := NewTimeTrackingService(repo, projects, &timeMembers{role: model.ProjectRoleOwner}, nil)
	ctx := model.ContextWithNamespaceID(context.Background(), ns)
	info := &model.AuthInfo{UserID: user}
	f := model.TimeFilter{From: start, To: end, Limit: 1}
	report, all, err := svc.Report(ctx, info, f, "America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 2 || len(report.Details.Entries) != 1 || !report.Details.HasMore {
		t.Fatalf("pagination lost report entries: %+v", report)
	}
	if report.TotalSeconds != 2*24*3600 {
		t.Fatalf("total %d", report.TotalSeconds)
	}
	if len(report.Daily) != 3 || report.Daily[1].Seconds != 2*23*3600 {
		t.Fatalf("incorrect DST allocation: %+v", report.Daily)
	}
	if len(repo.filter.ProjectIDs) != 1 || repo.filter.ProjectIDs[0] != project {
		t.Fatal("namespace leaked")
	}
	if len(repo.filter.ManagedIDs) != 1 {
		t.Fatal("manager scope missing")
	}
	f.Cursor = &repo.entries[0].ID
	next, _, err := svc.Report(ctx, info, f, "America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	if next.TotalSeconds != report.TotalSeconds || len(next.Details.Entries) != 1 || next.Details.Entries[0].ID != repo.entries[1].ID {
		t.Fatal("pagination changed totals")
	}
	f.From = start.Add(15 * time.Minute)
	f.To = start.Add(45 * time.Minute)
	f.Cursor = nil
	clipped, _, err := svc.Report(ctx, info, f, "America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	if clipped.TotalSeconds != 3600 {
		t.Fatal("range clipping failed")
	}
	if _, _, err := svc.Report(ctx, info, f, "not/a/timezone"); !errors.Is(err, model.ErrValidation) {
		t.Fatal("invalid timezone accepted")
	}
	// Database timer starts carry subsecond precision. Daily allocation must
	// preserve the recorded second even when it straddles midnight.
	start = time.Date(2026, 10, 10, 23, 59, 59, 500000000, time.UTC)
	repo.entries = []model.TrackedTime{{ID: uuid.New(), ProjectID: project, UserID: user, StartedAt: start, EndedAt: start.Add(time.Second), DurationSeconds: 1}}
	f.From, f.To = start.Add(-time.Hour), start.Add(time.Hour)
	fractional, _, err := svc.Report(ctx, info, f, "UTC")
	if err != nil {
		t.Fatal(err)
	}
	var dailySeconds int64
	for _, day := range fractional.Daily {
		dailySeconds += day.Seconds
	}
	if fractional.TotalSeconds != 1 || dailySeconds != 1 {
		t.Fatalf("midnight lost a timer second: %+v", fractional)
	}
}

func TestTimeTrackingRoleScopes(t *testing.T) {
	ns, project, user := uuid.New(), uuid.New(), uuid.New()
	repo := &timeReportRepo{entries: []model.TrackedTime{}}
	projects := &timeProjects{projects: []model.Project{{ID: project, NamespaceID: &ns}}}
	members := &timeMembers{}
	svc := NewTimeTrackingService(repo, projects, members, nil)
	f := model.TimeFilter{From: time.Now().Add(-time.Hour), To: time.Now()}
	ctx := model.ContextWithNamespaceID(context.Background(), ns)
	for _, role := range []string{"owner", "admin", "member", "viewer", "customer"} {
		members.role = role
		if _, err := svc.List(ctx, &model.AuthInfo{UserID: user}, f); err != nil {
			t.Fatal(err)
		}
		eligible := role == "owner" || role == "admin" || role == "member"
		if (len(repo.filter.ProjectIDs) > 0) != eligible {
			t.Fatalf("scope for %s", role)
		}
		if !repo.filter.Personal {
			t.Fatal("tracker included others")
		}
		_, _, err := svc.Report(ctx, &model.AuthInfo{UserID: user}, f, "UTC")
		if err != nil {
			t.Fatal(err)
		}
		if (len(repo.filter.ManagedIDs) > 0) != (role == "owner" || role == "admin") {
			t.Fatalf("manager access for %s", role)
		}
	}
	if _, err := svc.List(ctx, &model.AuthInfo{UserID: user, KeyType: model.KeyTypeSystem}, f); !errors.Is(err, model.ErrForbidden) {
		t.Fatal("system key allowed")
	}
}
