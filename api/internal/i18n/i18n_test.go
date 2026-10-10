package i18n

import (
	"regexp"
	"sort"
	"testing"
)

var (
	placeholderPattern = regexp.MustCompile(`\{\{\w+\}\}`)
	htmlTagPattern     = regexp.MustCompile(`<\/?\w+\s*\/?>`)
)

func placeholders(value string) []string { return sortedMatches(placeholderPattern, value) }

func htmlTags(value string) []string { return sortedMatches(htmlTagPattern, value) }

func sortedMatches(pattern *regexp.Regexp, value string) []string {
	matches := pattern.FindAllString(value, -1)
	sort.Strings(matches)
	return matches
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestT_English(t *testing.T) {
	got := T("en", "email.assignment.cta")
	if got != "View Work Item" {
		t.Errorf("expected 'View Work Item', got %q", got)
	}
}

func TestT_Substitution(t *testing.T) {
	got := T("en", "email.assignment.subject",
		"projectKey", "TP",
		"itemNumber", "42",
		"title", "Fix bug",
	)
	want := "[TP] Work item #42 assigned to you: Fix bug"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestT_FallbackToEnglish(t *testing.T) {
	// Use a language that doesn't exist — should fall back to English
	got := T("xx", "email.assignment.cta")
	if got != "View Work Item" {
		t.Errorf("expected English fallback, got %q", got)
	}
}

func TestT_MissingKeyReturnsKey(t *testing.T) {
	got := T("en", "nonexistent.key")
	if got != "nonexistent.key" {
		t.Errorf("expected key returned as-is, got %q", got)
	}
}

func TestT_Persian(t *testing.T) {
	got := T("fa", "email.namespace_invite.cta")
	if got != "پذیرش دعوت‌نامه" {
		t.Errorf("expected Persian namespace invite CTA, got %q", got)
	}
}

func TestPersianTranslationsComplete(t *testing.T) {
	english := translations["en"]
	persian := translations["fa"]
	if len(persian) != 51 {
		t.Fatalf("expected 51 Persian email translations, got %d", len(persian))
	}
	if len(persian) != len(english) {
		t.Fatalf("Persian translation count %d does not match English count %d", len(persian), len(english))
	}

	for key, englishValue := range english {
		persianValue, ok := persian[key]
		if !ok {
			t.Errorf("missing Persian translation for %q", key)
			continue
		}
		if persianValue == "" {
			t.Errorf("Persian translation for %q is empty", key)
		}

		if got, want := placeholders(persianValue), placeholders(englishValue); !equalStrings(got, want) {
			t.Errorf("placeholder mismatch for %q: got %v, want %v", key, got, want)
		}
		if got, want := htmlTags(persianValue), htmlTags(englishValue); !equalStrings(got, want) {
			t.Errorf("HTML tag mismatch for %q: got %v, want %v", key, got, want)
		}
	}
}

func TestT_AllLanguagesLoaded(t *testing.T) {
	expected := []string{"en", "fa"}
	if len(translations) != len(expected) {
		t.Fatalf("expected only %v to be loaded, got %v", expected, loadedLanguages())
	}
	for _, lang := range expected {
		if _, ok := translations[lang]; !ok {
			t.Errorf("language %q not loaded", lang)
		}
	}
}

func loadedLanguages() []string {
	languages := make([]string, 0, len(translations))
	for language := range translations {
		languages = append(languages, language)
	}
	sort.Strings(languages)
	return languages
}
