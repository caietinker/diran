-- Drop old columns and add new flexible ones
ALTER TABLE task 
  DROP COLUMN IF EXISTS repeat_days,
  ADD COLUMN IF NOT EXISTS repeat_weekdays SMALLINT,  -- 7-bit mask: bit0=Mon, bit6=Sun
  ADD COLUMN IF NOT EXISTS repeat_month_days INTEGER;  -- 31-bit mask: bit0=day1, bit30=day31
