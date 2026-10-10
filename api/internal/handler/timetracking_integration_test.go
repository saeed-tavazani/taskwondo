package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/google/uuid"
	"github.com/marcoshack/taskwondo/internal/model"
	"github.com/marcoshack/taskwondo/internal/repository"
	"github.com/marcoshack/taskwondo/internal/service"
)

// Set MONTASK_TEST_DATABASE_URL to a disposable PostgreSQL/pgvector server.
// Each run creates and drops its own uniquely named database. Transaction,
// constraint and migration behavior requires PostgreSQL, not repository mocks.
func TestTimeTrackingHTTPIntegration(t *testing.T) {
	base := os.Getenv("MONTASK_TEST_DATABASE_URL")
	if base == "" {
		t.Skip("MONTASK_TEST_DATABASE_URL not set")
	}
	admin, err := sql.Open("postgres", base)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close() })
	name := "test_time_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err = admin.Exec(`CREATE DATABASE ` + name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, err := admin.Exec(`DROP DATABASE ` + name + ` WITH (FORCE)`)
		if err != nil {
			t.Error(err)
		}
	})
	parsed, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	parsed.Path = "/" + name
	db, err := sql.Open("postgres", parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	migrator, err := migrate.New("file://../database/migrations", parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer migrator.Close()
	if err = migrator.Steps(63); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	owner, member, other, viewer, customer, adminUser := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	for _, id := range []uuid.UUID{owner, member, other, viewer, customer, adminUser} {
		if _, err = db.Exec(`INSERT INTO users(id,email,display_name) VALUES($1,$2,$3)`, id, id.String()+"@test.local", id.String()); err != nil {
			t.Fatal(err)
		}
	}
	ns := uuid.New()
	if _, err = db.Exec(`INSERT INTO namespaces(id,slug,display_name,is_default,created_by) VALUES($1,'default','Default',true,$2)`, ns, owner); err != nil {
		t.Fatal(err)
	}
	ns2 := uuid.New()
	if _, err = db.Exec(`INSERT INTO namespaces(id,slug,display_name,created_by) VALUES($1,'other','Other',$2)`, ns2, owner); err != nil {
		t.Fatal(err)
	}
	project, project2, item, oldEntry := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	for _, p := range []struct {
		id, ns uuid.UUID
		key    string
	}{{project, ns, "TT"}, {project2, ns2, "TT"}} {
		if _, err = db.Exec(`INSERT INTO projects(id,key,name,namespace_id) VALUES($1,$2,'Time project',$3)`, p.id, p.key, p.ns); err != nil {
			t.Fatal(err)
		}
	}
	for _, m := range []struct {
		id   uuid.UUID
		role string
	}{{owner, "owner"}, {member, "member"}, {other, "member"}, {viewer, "viewer"}, {customer, "customer"}} {
		if _, err = db.Exec(`INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,$3)`, project, m.id, m.role); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = db.Exec(`INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'owner')`, project2, owner); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(`INSERT INTO work_items(id,project_id,item_number,display_id,type,title,reporter_id) VALUES($1,$2,1,'TT-1','task','Task',$3)`, item, project, owner); err != nil {
		t.Fatal(err)
	}
	start := time.Now().UTC().Add(-3 * time.Hour).Truncate(time.Second)
	if _, err = db.Exec(`INSERT INTO time_entries(id,work_item_id,user_id,started_at,duration_seconds) VALUES($1,$2,$3,$4,3600)`, oldEntry, item, member, start); err != nil {
		t.Fatal(err)
	}
	if err = migrator.Up(); err != nil {
		t.Fatal(err)
	}
	var backfill uuid.UUID
	if err = db.QueryRow(`SELECT project_id FROM time_entries WHERE id=$1`, oldEntry).Scan(&backfill); err != nil || backfill != project {
		t.Fatalf("backfill: %v", err)
	}
	repo := repository.NewTimeTrackingRepository(db)
	svc := service.NewTimeTrackingService(repo, repository.NewProjectRepository(db), repository.NewProjectMemberRepository(db), repository.NewWorkItemRepository(db))
	h := NewTimeTrackingHandler(svc)
	router := chi.NewRouter()
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if id, err := uuid.Parse(r.Header.Get("X-Test-User")); err == nil {
				role := "user"
				if id == adminUser {
					role = "admin"
				}
				r = r.WithContext(model.ContextWithAuthInfo(r.Context(), &model.AuthInfo{UserID: id, GlobalRole: role}))
			}
			next.ServeHTTP(w, r)
		})
	})
	router.Get("/timer", h.Active)
	router.Post("/stop/{timerId}", h.Stop)
	router.Route("/{namespace}", func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				id := ns
				if chi.URLParam(r, "namespace") == "other" {
					id = ns2
				}
				next.ServeHTTP(w, r.WithContext(model.ContextWithNamespaceID(r.Context(), id)))
			})
		})
		h.Routes(r)
	})
	call := func(user uuid.UUID, method, path, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("X-Test-User", user.String())
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		return res
	}
	mustStatus := func(res *httptest.ResponseRecorder, status int) {
		t.Helper()
		if res.Code != status {
			t.Fatalf("HTTP %d want %d: %s", res.Code, status, res.Body.String())
		}
	}
	rangeQuery := "?from=" + url.QueryEscape(start.Add(-time.Hour).Format(time.RFC3339)) + "&to=" + url.QueryEscape(time.Now().Add(time.Hour).Format(time.RFC3339)) + "&timezone=UTC"
	body := fmt.Sprintf(`{"project_key":"TT","item_number":1,"description":"work","started_at":%q,"ended_at":%q}`, start.Add(time.Hour).Format(time.RFC3339), start.Add(2*time.Hour).Format(time.RFC3339))
	mustStatus(call(viewer, "POST", "/default/entries", body), 403)
	mustStatus(call(customer, "POST", "/default/entries", body), 403)
	mustStatus(call(member, "POST", "/other/entries", body), 403)
	mustStatus(call(member, "POST", "/default/entries", strings.Replace(body, `"item_number":1`, `"item_number":999`, 1)), 404)
	mustStatus(call(member, "POST", "/default/entries", `{"project_key":"TT"}`), 400)
	res := call(member, "POST", "/default/entries", body)
	mustStatus(res, 201)
	var created struct{ Data model.TrackedTime }
	if err = json.Unmarshal(res.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	id := created.Data.ID
	mustStatus(call(other, "PUT", "/default/entries/"+id.String(), body), 403)
	mustStatus(call(owner, "PUT", "/other/entries/"+id.String(), body), 404)
	mustStatus(call(owner, "PUT", "/default/entries/"+id.String(), body), 200)
	var actor uuid.UUID
	if err = db.QueryRow(`SELECT actor_id FROM time_entry_audit WHERE entry_id=$1 AND action='update' ORDER BY id DESC LIMIT 1`, id).Scan(&actor); err != nil || actor != owner {
		t.Fatalf("audit actor: %v", err)
	}
	summary, err := repository.NewTimeEntryRepository(db).SumByWorkItem(ctx, item)
	if err != nil || summary != 7200 {
		t.Fatalf("item total %d %v", summary, err)
	}
	for _, tc := range []struct {
		user  uuid.UUID
		ns    string
		total int64
	}{{member, "default", 7200}, {other, "default", 0}, {owner, "default", 7200}, {adminUser, "default", 7200}, {owner, "other", 0}, {viewer, "default", 0}} {
		res := call(tc.user, "GET", "/"+tc.ns+"/reports"+rangeQuery, "")
		mustStatus(res, 200)
		var report struct{ Data model.TimeReport }
		if err = json.Unmarshal(res.Body.Bytes(), &report); err != nil {
			t.Fatal(err)
		}
		if report.Data.TotalSeconds != tc.total {
			t.Fatalf("report leaked: got %d want %d", report.Data.TotalSeconds, tc.total)
		}
	}
	// A limited details page still exports all entries.
	res = call(owner, "GET", "/default/reports.csv"+rangeQuery+"&limit=1", "")
	mustStatus(res, 200)
	if strings.Count(res.Body.String(), "Time project") != 2 {
		t.Fatal("CSV exported only one page")
	}
	res = call(member, "POST", "/default/timers", `{"project_key":"TT"}`)
	mustStatus(res, 201)
	var timer struct{ Data model.TimeTimer }
	if err = json.Unmarshal(res.Body.Bytes(), &timer); err != nil {
		t.Fatal(err)
	}
	mustStatus(call(member, "POST", "/default/timers", `{"project_key":"TT"}`), 409)
	mustStatus(call(other, "POST", "/stop/"+timer.Data.ID.String(), ""), 404)
	mustStatus(call(member, "GET", "/timer", ""), 200)
	// Independent namespaces share the per-user active-timer constraint.
	ownerTimer := call(owner, "POST", "/default/timers", `{"project_key":"TT"}`)
	mustStatus(ownerTimer, 201)
	var crossNamespaceTimer struct{ Data model.TimeTimer }
	if err = json.Unmarshal(ownerTimer.Body.Bytes(), &crossNamespaceTimer); err != nil {
		t.Fatal(err)
	}
	mustStatus(call(owner, "POST", "/other/timers", `{"project_key":"TT"}`), 409)
	mustStatus(call(owner, "POST", "/stop/"+crossNamespaceTimer.Data.ID.String(), ""), 200)
	var wg sync.WaitGroup
	responses := make(chan *httptest.ResponseRecorder, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); responses <- call(member, "POST", "/stop/"+timer.Data.ID.String(), "") }()
	}
	wg.Wait()
	close(responses)
	var finalID uuid.UUID
	for res := range responses {
		mustStatus(res, 200)
		var stopped struct{ Data model.TrackedTime }
		if err = json.Unmarshal(res.Body.Bytes(), &stopped); err != nil {
			t.Fatal(err)
		}
		if finalID != uuid.Nil && finalID != stopped.Data.ID {
			t.Fatal("duplicate stop created multiple entries")
		}
		finalID = stopped.Data.ID
		if stopped.Data.DurationSeconds < 1 {
			t.Fatal("subsecond timer lost")
		}
	}
	// Simultaneous starts from separate tabs must leave exactly one active timer.
	starts := make(chan *httptest.ResponseRecorder, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			starts <- call(member, "POST", "/default/timers", `{"project_key":"TT"}`)
		}()
	}
	wg.Wait()
	close(starts)
	winners := 0
	for res := range starts {
		if res.Code == http.StatusCreated {
			winners++
			if err = json.Unmarshal(res.Body.Bytes(), &timer); err != nil {
				t.Fatal(err)
			}
		} else {
			mustStatus(res, http.StatusConflict)
		}
	}
	if winners != 1 {
		t.Fatalf("concurrent starts created %d timers", winners)
	}
	mustStatus(call(member, "POST", "/stop/"+timer.Data.ID.String(), ""), http.StatusOK)
	// Old item routes remain compatible and write the same shared source.
	legacy := repository.NewTimeEntryRepository(db)
	entry := &model.TimeEntry{ID: uuid.New(), WorkItemID: item, UserID: member, StartedAt: start, DurationSeconds: 60}
	if err = legacy.Create(ctx, entry); err != nil {
		t.Fatal(err)
	}
	entry.DurationSeconds = 120
	actorCtx := model.ContextWithAuthInfo(ctx, &model.AuthInfo{UserID: owner})
	if err = legacy.Update(actorCtx, entry); err != nil {
		t.Fatal(err)
	}
	if err = db.QueryRow(`SELECT actor_id FROM time_entry_audit WHERE entry_id=$1 AND action='update'`, entry.ID).Scan(&actor); err != nil || actor != owner {
		t.Fatalf("legacy audit: %v", err)
	}
	mustStatus(call(owner, "DELETE", "/default/entries/"+id.String(), ""), 204)
	var deleted bool
	if err = db.QueryRow(`SELECT deleted_at IS NOT NULL FROM time_entries WHERE id=$1`, id).Scan(&deleted); err != nil || !deleted {
		t.Fatal("delete was not soft")
	}
	rollbackSQL, err := os.ReadFile("../database/migrations/000064_project_time_tracking.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(string(rollbackSQL)); err == nil {
		t.Fatal("rollback discarded project-only entries")
	}
}
