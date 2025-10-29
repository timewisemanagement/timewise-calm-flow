-- Add color field to tasks table for color coding
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS color text DEFAULT '#3b82f6';

-- Add start_time and end_time fields to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_time time without time zone;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS end_time time without time zone;