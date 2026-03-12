-- 1. Add completed_at to task (for once-task global completion)
ALTER TABLE task ADD COLUMN completed_at BIGINT DEFAULT NULL;

-- 2. Add unique constraint to history for upsert support
ALTER TABLE history ADD CONSTRAINT history_task_date_unique UNIQUE (task_id, date);

-- 3. Add missing RLS policies for history (UPDATE and DELETE were missing)
CREATE POLICY "Users can update own history" ON history
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM task JOIN category ON category.id = task.category_id
    WHERE task.id = history.task_id AND category.user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete own history" ON history
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM task JOIN category ON category.id = task.category_id
    WHERE task.id = history.task_id AND category.user_id = auth.uid()
  )
);

-- 4. Drop old array columns (do last)
ALTER TABLE task DROP COLUMN done_dates;
ALTER TABLE task DROP COLUMN skipped_dates;
