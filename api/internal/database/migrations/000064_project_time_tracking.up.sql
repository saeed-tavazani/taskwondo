ALTER TABLE time_entries ADD COLUMN project_id UUID REFERENCES projects(id);
UPDATE time_entries t SET project_id = w.project_id FROM work_items w WHERE w.id = t.work_item_id;
ALTER TABLE time_entries ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE time_entries ALTER COLUMN work_item_id DROP NOT NULL;
CREATE INDEX idx_time_entries_project_started ON time_entries(project_id, started_at, id) WHERE deleted_at IS NULL;

CREATE TABLE time_timers (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    work_item_id UUID REFERENCES work_items(id),
    description TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    stopped_at TIMESTAMPTZ,
    entry_id UUID REFERENCES time_entries(id)
);
CREATE UNIQUE INDEX idx_time_timers_active_user ON time_timers(user_id) WHERE stopped_at IS NULL;

CREATE TABLE time_entry_audit (
    id BIGSERIAL PRIMARY KEY,
    entry_id UUID NOT NULL,
    actor_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    before_value JSONB,
    after_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE FUNCTION audit_time_entry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO time_entry_audit(entry_id, actor_id, action, before_value, after_value)
    VALUES (NEW.id, COALESCE(NULLIF(current_setting('montask.time_actor', true), '')::uuid, NEW.user_id),
        CASE WHEN TG_OP = 'INSERT' THEN 'create' WHEN NEW.deleted_at IS NOT NULL THEN 'delete' ELSE 'update' END,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END, to_jsonb(NEW));
    RETURN NEW;
END;
$$;
CREATE TRIGGER time_entry_audit_trigger AFTER INSERT OR UPDATE ON time_entries
FOR EACH ROW EXECUTE FUNCTION audit_time_entry();
