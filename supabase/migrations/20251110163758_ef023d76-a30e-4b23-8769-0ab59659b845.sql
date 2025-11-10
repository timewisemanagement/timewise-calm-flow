-- Add column to store Google account email
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_calendar_email text;