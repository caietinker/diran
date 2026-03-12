-- Add start_date and end_date columns to task table for date-based scheduling
ALTER TABLE task 
  ADD COLUMN IF NOT EXISTS start_date BIGINT,  -- Unix timestamp (midnight) for once-time tasks or start of repeat
  ADD COLUMN IF NOT EXISTS end_date BIGINT;    -- Optional Unix timestamp for when repeat ends
