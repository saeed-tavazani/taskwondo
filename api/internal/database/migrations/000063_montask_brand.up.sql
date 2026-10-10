-- Replace the previous default branding while preserving customized names.
UPDATE system_settings
SET value = '"Montask"'::jsonb, updated_at = now()
WHERE key = 'brand_name' AND value = '"Taskwondo"'::jsonb;

UPDATE namespaces
SET display_name = 'Montask', updated_at = now()
WHERE is_default = true AND display_name = 'Taskwondo'
  AND NOT EXISTS (
    SELECT 1 FROM system_settings
    WHERE key = 'brand_name' AND value NOT IN ('"Montask"'::jsonb, '""'::jsonb, 'null'::jsonb)
  );

UPDATE system_settings
SET value = jsonb_set(value, '{from_name}', '"Montask"'::jsonb), updated_at = now()
WHERE key = 'smtp_config' AND value->>'from_name' = 'Taskwondo';

UPDATE system_settings
SET value = '["admin", "montask"]'::jsonb, updated_at = now()
WHERE key = 'reserved_namespace_slugs' AND value = '["admin", "taskwondo"]'::jsonb;
