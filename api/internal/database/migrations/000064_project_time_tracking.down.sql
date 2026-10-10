-- Project-only entries cannot be represented by the previous schema. Refuse
-- rollback until they have been explicitly migrated, rather than discard time.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM time_entries WHERE work_item_id IS NULL) OR
       EXISTS (SELECT 1 FROM time_timers WHERE stopped_at IS NULL) THEN
        RAISE EXCEPTION 'Migrate project-only time entries and stop active timers before rollback';
    END IF;
END $$;
DROP TRIGGER time_entry_audit_trigger ON time_entries;
DROP FUNCTION audit_time_entry();
DROP TABLE time_entry_audit;
DROP TABLE time_timers;
DROP INDEX idx_time_entries_project_started;
ALTER TABLE time_entries DROP COLUMN project_id;
ALTER TABLE time_entries ALTER COLUMN work_item_id SET NOT NULL;
