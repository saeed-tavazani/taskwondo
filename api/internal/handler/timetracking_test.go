package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/marcoshack/taskwondo/internal/model"
)

type trackingHandlerStub struct {
	TimeTrackingService
	called bool
	err    error
}

func (s *trackingHandlerStub) List(_ context.Context, _ *model.AuthInfo, _ model.TimeFilter) (model.TimePage, error) {
	s.called = true
	return model.TimePage{Entries: []model.TrackedTime{}}, s.err
}

func TestTimeTrackingHTTPValidation(t *testing.T) {
	for _, tc := range []struct {
		query  string
		status int
	}{
		{"", 400}, {"?from=no&to=no", 400},
		{"?from=2026-01-01T00:00:00Z&to=2025-01-01T00:00:00Z", 400},
		{"?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z&limit=999", 400},
		{"?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z&item_number=1", 400},
		{"?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z&cursor=bad", 400},
		{"?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z&user_id=bad", 400},
		{"?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z", 200},
	} {
		t.Run(tc.query, func(t *testing.T) {
			stub := &trackingHandlerStub{}
			h := NewTimeTrackingHandler(stub)
			req := httptest.NewRequest("GET", "/entries"+tc.query, nil)
			req = req.WithContext(model.ContextWithAuthInfo(req.Context(), &model.AuthInfo{UserID: uuid.New()}))
			res := httptest.NewRecorder()
			h.List(res, req)
			if res.Code != tc.status {
				t.Fatalf("status %d: %s", res.Code, res.Body.String())
			}
			if tc.status == 400 && stub.called {
				t.Fatal("invalid request reached service")
			}
		})
	}
}

func TestTimeTrackingHTTPAuthAndErrors(t *testing.T) {
	for _, sentinel := range []struct {
		err    error
		status int
	}{{model.ErrForbidden, 403}, {model.ErrNotFound, 404}, {model.ErrConflict, 409}} {
		stub := &trackingHandlerStub{err: sentinel.err}
		h := NewTimeTrackingHandler(stub)
		req := httptest.NewRequest("GET", "/entries?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z", nil)
		res := httptest.NewRecorder()
		h.List(res, req)
		if res.Code != 401 {
			t.Fatalf("unauthenticated request: %d", res.Code)
		}
		req = req.WithContext(model.ContextWithAuthInfo(req.Context(), &model.AuthInfo{UserID: uuid.New()}))
		res = httptest.NewRecorder()
		h.List(res, req)
		if res.Code != sentinel.status {
			t.Fatalf("service error: %d", res.Code)
		}
	}
	h := NewTimeTrackingHandler(&trackingHandlerStub{})
	router := chi.NewRouter()
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(model.ContextWithAuthInfo(r.Context(), &model.AuthInfo{UserID: uuid.New()})))
		})
	})
	h.Routes(router)
	for _, tc := range []struct{ method, path, body string }{{"POST", "/entries", "{"}, {"PUT", "/entries/bad", "{}"}, {"DELETE", "/entries/bad", ""}} {
		res := httptest.NewRecorder()
		router.ServeHTTP(res, httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body)))
		if res.Code != 400 {
			t.Fatalf("invalid request: %d", res.Code)
		}
	}
}

func TestTimeCSVFormulaEscaping(t *testing.T) {
	for _, v := range []string{"=HYPERLINK(1)", " +cmd", "\t@sum(1)", "-1"} {
		if !strings.HasPrefix(csvCell(v), "'") {
			t.Fatalf("unsafe cell %q", v)
		}
	}
	if csvCell("ordinary work") != "ordinary work" {
		t.Fatal("modified ordinary description")
	}
}
