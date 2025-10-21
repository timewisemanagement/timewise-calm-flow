-- Add new columns to profiles table for sleep schedule and downtime
ALTER TABLE public.profiles
ADD COLUMN wake_time TIME DEFAULT '08:00:00',
ADD COLUMN bed_time TIME DEFAULT '22:00:00',
ADD COLUMN downtime_start TIME,
ADD COLUMN downtime_end TIME;

-- Add new columns to tasks table for commute and recurrence
ALTER TABLE public.tasks
ADD COLUMN commute_minutes INTEGER DEFAULT 0,
ADD COLUMN recurrence_pattern TEXT CHECK (recurrence_pattern IN ('once', 'daily', 'weekly', 'custom')),
ADD COLUMN recurrence_days TEXT[] DEFAULT '{}',
ADD COLUMN recurrence_end_date DATE,
ADD COLUMN scheduled_date DATE,
ADD COLUMN scheduled_time TIME;

-- Update existing tasks to have 'once' as default recurrence
UPDATE public.tasks SET recurrence_pattern = 'once' WHERE recurrence_pattern IS NULL;