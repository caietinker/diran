-- Add optional description field to task table
ALTER TABLE task ADD COLUMN IF NOT EXISTS description TEXT;
