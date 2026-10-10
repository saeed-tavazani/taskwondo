package handler

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/marcoshack/taskwondo/internal/model"
	"github.com/marcoshack/taskwondo/internal/service"
	"github.com/rs/zerolog/log"
)

type TimeTrackingService interface {
	List(context.Context, *model.AuthInfo, model.TimeFilter) (model.TimePage, error)
	Save(context.Context, *model.AuthInfo, *uuid.UUID, service.TrackedTimeInput) (*model.TrackedTime, error)
	Delete(context.Context, *model.AuthInfo, uuid.UUID) error
	Start(context.Context, *model.AuthInfo, service.TrackedTimeInput) (*model.TimeTimer, error)
	Active(context.Context, *model.AuthInfo) (*model.TimeTimer, error)
	Stop(context.Context, *model.AuthInfo, uuid.UUID) (*model.TrackedTime, error)
	Report(context.Context, *model.AuthInfo, model.TimeFilter, string) (*model.TimeReport, []model.TrackedTime, error)
}

type TimeTrackingHandler struct{ service TimeTrackingService }

func NewTimeTrackingHandler(s TimeTrackingService) *TimeTrackingHandler {
	return &TimeTrackingHandler{service: s}
}

func (h *TimeTrackingHandler) Routes(r chi.Router) {
	r.Get("/entries", h.List)
	r.Post("/entries", h.Create)
	r.Put("/entries/{entryId}", h.Update)
	r.Delete("/entries/{entryId}", h.Delete)
	r.Post("/timers", h.Start)
	r.Get("/reports", h.Report)
	r.Get("/reports.csv", h.Export)
}

func timeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, model.ErrValidation):
		writeErrorKeyed(w, http.StatusBadRequest, CodeValidationError, "time_tracking_invalid", err.Error(), nil)
	case errors.Is(err, model.ErrForbidden):
		writeErrorKeyed(w, http.StatusForbidden, CodeForbidden, "time_tracking_forbidden", "time tracking access denied", nil)
	case errors.Is(err, model.ErrNotFound):
		writeErrorKeyed(w, http.StatusNotFound, CodeNotFound, "time_tracking_not_found", "time entry or project not found", nil)
	case errors.Is(err, model.ErrConflict):
		writeErrorFromService(w, http.StatusConflict, CodeConflict, err)
	default:
		log.Ctx(r.Context()).Error().Err(err).Msg("time tracking request failed")
		writeErrorKeyed(w, http.StatusInternalServerError, CodeInternalError, "time_tracking_failed", "time tracking request failed", nil)
	}
}

func timeAuth(w http.ResponseWriter, r *http.Request) *model.AuthInfo {
	info := model.AuthInfoFromContext(r.Context())
	if info == nil {
		writeError(w, http.StatusUnauthorized, CodeUnauthorized, "not authenticated")
	}
	return info
}

func timeFilter(r *http.Request) (model.TimeFilter, error) {
	q := r.URL.Query()
	var f model.TimeFilter
	var err error
	f.From, err = time.Parse(time.RFC3339, q.Get("from"))
	if err != nil {
		return f, model.ErrValidation
	}
	f.To, err = time.Parse(time.RFC3339, q.Get("to"))
	if err != nil {
		return f, model.ErrValidation
	}
	if !f.To.After(f.From) || f.To.Sub(f.From) > 366*24*time.Hour {
		return f, model.ErrValidation
	}
	f.ProjectKey = q.Get("project_key")
	f.Limit = 50
	if v := q.Get("limit"); v != "" {
		f.Limit, err = strconv.Atoi(v)
		if err != nil || f.Limit < 1 || f.Limit > 100 {
			return f, model.ErrValidation
		}
	}
	if v := q.Get("item_number"); v != "" {
		n, e := strconv.Atoi(v)
		if e != nil || n < 1 || f.ProjectKey == "" {
			return f, model.ErrValidation
		}
		f.ItemNumber = &n
	}
	for _, field := range []string{"user_id", "cursor"} {
		if v := q.Get(field); v != "" {
			id, e := uuid.Parse(v)
			if e != nil {
				return f, model.ErrValidation
			}
			if field == "user_id" {
				f.UserID = &id
			} else {
				f.Cursor = &id
			}
		}
	}
	return f, nil
}

func decodeTime(w http.ResponseWriter, r *http.Request) (service.TrackedTimeInput, bool) {
	var input service.TrackedTimeInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		timeError(w, r, model.ErrValidation)
		return input, false
	}
	return input, true
}

func (h *TimeTrackingHandler) List(w http.ResponseWriter, r *http.Request) {
	info := timeAuth(w, r)
	if info == nil {
		return
	}
	f, err := timeFilter(r)
	if err != nil {
		timeError(w, r, err)
		return
	}
	page, err := h.service.List(r.Context(), info, f)
	if err != nil {
		timeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, page)
}
func (h *TimeTrackingHandler) Create(w http.ResponseWriter, r *http.Request) { h.save(w, r, false) }
func (h *TimeTrackingHandler) Update(w http.ResponseWriter, r *http.Request) { h.save(w, r, true) }
func (h *TimeTrackingHandler) save(w http.ResponseWriter, r *http.Request, update bool) {
	info := timeAuth(w, r)
	if info == nil {
		return
	}
	input, ok := decodeTime(w, r)
	if !ok {
		return
	}
	var id *uuid.UUID
	if update {
		parsed, ok := parseUUIDParam(w, r, "entryId", "invalid entry ID")
		if !ok {
			return
		}
		id = &parsed
	}
	e, err := h.service.Save(r.Context(), info, id, input)
	if err != nil {
		timeError(w, r, err)
		return
	}
	status := http.StatusCreated
	if update {
		status = http.StatusOK
	}
	writeData(w, status, e)
}
func (h *TimeTrackingHandler) Delete(w http.ResponseWriter, r *http.Request) {
	info := timeAuth(w, r)
	if info == nil {
		return
	}
	id, ok := parseUUIDParam(w, r, "entryId", "invalid entry ID")
	if !ok {
		return
	}
	if err := h.service.Delete(r.Context(), info, id); err != nil {
		timeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
func (h *TimeTrackingHandler) Start(w http.ResponseWriter, r *http.Request) {
	info := timeAuth(w, r)
	if info == nil {
		return
	}
	input, ok := decodeTime(w, r)
	if !ok {
		return
	}
	timer, err := h.service.Start(r.Context(), info, input)
	if err != nil {
		timeError(w, r, err)
		return
	}
	writeData(w, http.StatusCreated, timer)
}
func (h *TimeTrackingHandler) Active(w http.ResponseWriter, r *http.Request) {
	info := timeAuth(w, r)
	if info == nil {
		return
	}
	timer, err := h.service.Active(r.Context(), info)
	if err != nil {
		timeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, timer)
}
func (h *TimeTrackingHandler) Stop(w http.ResponseWriter, r *http.Request) {
	info := timeAuth(w, r)
	if info == nil {
		return
	}
	id, ok := parseUUIDParam(w, r, "timerId", "invalid timer ID")
	if !ok {
		return
	}
	entry, err := h.service.Stop(r.Context(), info, id)
	if err != nil {
		timeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, entry)
}
func (h *TimeTrackingHandler) Report(w http.ResponseWriter, r *http.Request) {
	info := timeAuth(w, r)
	if info == nil {
		return
	}
	f, err := timeFilter(r)
	if err != nil {
		timeError(w, r, err)
		return
	}
	tz := r.URL.Query().Get("timezone")
	if tz == "" {
		tz = "UTC"
	}
	report, _, err := h.service.Report(r.Context(), info, f, tz)
	if err != nil {
		timeError(w, r, err)
		return
	}
	writeData(w, http.StatusOK, report)
}

// Prevent descriptions and names from becoming spreadsheet formulas.
func csvCell(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) > 0 && strings.ContainsRune("=+-@", rune(trimmed[0])) {
		return "'" + value
	}
	return value
}
func (h *TimeTrackingHandler) Export(w http.ResponseWriter, r *http.Request) {
	info := timeAuth(w, r)
	if info == nil {
		return
	}
	f, err := timeFilter(r)
	if err != nil {
		timeError(w, r, err)
		return
	}
	tz := r.URL.Query().Get("timezone")
	if tz == "" {
		tz = "UTC"
	}
	_, entries, err := h.service.Report(r.Context(), info, f, tz)
	if err != nil {
		timeError(w, r, err)
		return
	}
	loc, _ := time.LoadLocation(tz)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="time-report.csv"`)
	_, _ = w.Write([]byte("\xef\xbb\xbf"))
	out := csv.NewWriter(w)
	_ = out.Write([]string{"Project", "Person", "Item", "Description", "Start", "End", "Duration seconds", "Seconds in report range", "Timezone"})
	for _, e := range entries {
		item := ""
		if e.ItemNumber != nil {
			item = e.ProjectKey + "-" + strconv.Itoa(*e.ItemNumber)
		}
		start, end := e.StartedAt, e.EndedAt
		if start.Before(f.From) {
			start = f.From
		}
		if end.After(f.To) {
			end = f.To
		}
		if err = out.Write([]string{csvCell(e.ProjectName), csvCell(e.UserName), item, csvCell(e.Description), e.StartedAt.In(loc).Format(time.RFC3339), e.EndedAt.In(loc).Format(time.RFC3339), strconv.Itoa(e.DurationSeconds), strconv.FormatInt(int64(end.Sub(start)/time.Second), 10), tz}); err != nil {
			break
		}
	}
	out.Flush()
	if err = out.Error(); err != nil {
		log.Ctx(r.Context()).Error().Err(err).Msg("exporting time report")
	}
}
