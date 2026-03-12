-- Drop old todos table
DROP TABLE IF EXISTS todos;

-- Enums
CREATE TYPE goal_type AS ENUM ('times', 'seconds');
CREATE TYPE goal_period AS ENUM ('week', 'month');
CREATE TYPE repeat_freq AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE instance_status AS ENUM ('pending', 'done', 'skipped');

-- Category
CREATE TABLE category (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#ff6600',
  goal_type goal_type NOT NULL DEFAULT 'times',
  goal_value INT NOT NULL DEFAULT 1,
  goal_period goal_period NOT NULL DEFAULT 'week'
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

-- Task
CREATE TABLE task (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES category(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  repeat_freq repeat_freq,
  repeat_interval INT,
  repeat_days INT[]
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

-- Instance
CREATE TABLE instance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES task(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status instance_status NOT NULL DEFAULT 'pending'
);

ALTER TABLE instance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own instances" ON instance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task
      JOIN category ON category.id = task.category_id
      WHERE task.id = instance.task_id AND category.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own instances" ON instance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM task
      JOIN category ON category.id = task.category_id
      WHERE task.id = instance.task_id AND category.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own instances" ON instance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM task
      JOIN category ON category.id = task.category_id
      WHERE task.id = instance.task_id AND category.user_id = auth.uid()
    )
  );

-- Session
CREATE TABLE session (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES instance(id) ON DELETE CASCADE NOT NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT
);

ALTER TABLE session ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON session
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM instance
      JOIN task ON task.id = instance.task_id
      JOIN category ON category.id = task.category_id
      WHERE instance.id = session.instance_id AND category.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert own sessions" ON session
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM instance
      JOIN task ON task.id = instance.task_id
      JOIN category ON category.id = task.category_id
      WHERE instance.id = session.instance_id AND category.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update own sessions" ON session
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM instance
      JOIN task ON task.id = instance.task_id
      JOIN category ON category.id = task.category_id
      WHERE instance.id = session.instance_id AND category.user_id = auth.uid()
    )
  );

-- Index for fast instance lookups
CREATE INDEX idx_instance_task_date ON instance(task_id, date DESC);
CREATE INDEX idx_session_instance ON session(instance_id);
CREATE INDEX idx_task_category ON task(category_id);
