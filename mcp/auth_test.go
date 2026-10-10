package main

import "testing"

func TestResolveAuthBrandEnvironment(t *testing.T) {
	t.Setenv("TASKWONDO_URL", "https://legacy.example.com")
	t.Setenv("TASKWONDO_API_KEY", "twk_legacy")
	t.Setenv("TASKWONDO_NAMESPACE", "legacy")
	t.Setenv("MONTASK_URL", "")
	t.Setenv("MONTASK_API_KEY", "")
	t.Setenv("MONTASK_NAMESPACE", "")
	url, key, namespace, err := ResolveAuth()
	if err != nil || url != "https://legacy.example.com" || key != "twk_legacy" || namespace != "legacy" {
		t.Fatalf("legacy environment: %q %q %q %v", url, key, namespace, err)
	}
	t.Setenv("MONTASK_URL", "https://montask.example.com")
	t.Setenv("MONTASK_API_KEY", "twk_new")
	t.Setenv("MONTASK_NAMESPACE", "new")
	url, key, namespace, err = ResolveAuth()
	if err != nil || url != "https://montask.example.com" || key != "twk_new" || namespace != "new" {
		t.Fatalf("Montask environment: %q %q %q %v", url, key, namespace, err)
	}
}

func TestConfigDirBrandEnvironment(t *testing.T) {
	t.Setenv("MONTASK_CONFIG_DIR", "")
	t.Setenv("TASKWONDO_CONFIG_DIR", t.TempDir())
	legacy := ConfigDir()
	current := t.TempDir()
	t.Setenv("MONTASK_CONFIG_DIR", current)
	if ConfigDir() != current || legacy == current {
		t.Fatal("Montask config override must take precedence over the legacy override")
	}
}
