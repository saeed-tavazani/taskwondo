UPDATE system_settings
SET value = '"Taskwondo"'::jsonb, updated_at = now()
WHERE key = 'brand_name' AND value = '"Montask"'::jsonb;

UPDATE namespaces
SET display_name = 'Taskwondo', updated_at = now()
WHERE is_default = true AND display_name = 'Montask'
  AND NOT EXISTS (
    SELECT 1 FROM system_settings
    WHERE key = 'brand_name' AND value NOT IN ('"Taskwondo"'::jsonb, '""'::jsonb, 'null'::jsonb)
  );

UPDATE system_settings
SET value = jsonb_set(value, '{from_name}', '"Taskwondo"'::jsonb), updated_at = now()
WHERE key = 'smtp_config' AND value->>'from_name' = 'Montask';

UPDATE system_settings
SET value = '["admin", "taskwondo"]'::jsonb, updated_at = now()
WHERE key = 'reserved_namespace_slugs' AND value = '["admin", "montask"]'::jsonb;
