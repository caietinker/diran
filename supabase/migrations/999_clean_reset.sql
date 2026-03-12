-- Clean database: drop all tables and recreate from scratch
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS history CASCADE;
DROP TABLE IF EXISTS task CASCADE;
DROP TABLE IF EXISTS category CASCADE;

-- Recreate category table
CREATE TABLE category (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#ff6600',
  goal_type VARCHAR(20) NOT NULL DEFAULT 'times',
  goal_value INT NOT NULL DEFAULT 1,
  goal_period VARCHAR(20) NOT NULL DEFAULT 'week'
);

ALTER TABLE category ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON category
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON category
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON category
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON category
  FOR DELETE USING (auth.uid() = user_id);

-- Recreate task table
CREATE TABLE task (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES category(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  repeat_freq VARCHAR(20),
  repeat_interval INT,
  repeat_weekdays INT,     -- 7-bit mask: bit0=Mon, bit6=Sun
  repeat_month_days INT,   -- 31-bit mask: bit0=day1, bit30=day31
  start_date BIGINT,       -- Unix timestamp (midnight) for once-time or start of repeat
  end_date BIGINT,         -- Unix timestamp (midnight) for end of repeat
  completed_at BIGINT      -- Unix timestamp (midnight) when a once-task was globally completed; NULL if not yet done
);

ALTER TABLE task ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON task
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM category WHERE category.id = task.category_id AND category.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own tasks" ON task
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM category WHERE category.id = task.category_id AND category.user_id = auth.uid())
  );
CREATE POLICY "Users can update own tasks" ON task
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM category WHERE category.id = task.category_id AND category.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own tasks" ON task
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM category WHERE category.id = task.category_id AND category.user_id = auth.uid())
  );

-- Recreate session table
CREATE TABLE session (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES task(id) ON DELETE CASCADE NOT NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT
);

ALTER TABLE session ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON session
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task
      JOIN category ON category.id = task.category_id
      WHERE task.id = session.task_id AND category.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own sessions" ON session
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM task
      JOIN category ON category.id = task.category_id
      WHERE task.id = session.task_id AND category.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own sessions" ON session
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM task
      JOIN category ON category.id = task.category_id
      WHERE task.id = session.task_id AND category.user_id = auth.uid()
    )
  );

-- Recreate history table
CREATE TABLE history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES task(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('done', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT history_task_date_unique UNIQUE (task_id, date)
);

ALTER TABLE history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history" ON history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task
      JOIN category ON category.id = task.category_id
      WHERE task.id = history.task_id AND category.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own history" ON history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM task
      JOIN category ON category.id = task.category_id
      WHERE task.id = history.task_id AND category.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own history" ON history
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM task
      JOIN category ON category.id = task.category_id
      WHERE task.id = history.task_id AND category.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own history" ON history
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM task
      JOIN category ON category.id = task.category_id
      WHERE task.id = history.task_id AND category.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_category ON task(category_id);
CREATE INDEX IF NOT EXISTS idx_session_task ON session(task_id);
CREATE INDEX IF NOT EXISTS idx_history_task_date ON history(task_id, date DESC);
