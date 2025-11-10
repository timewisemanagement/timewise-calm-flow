-- Add Google Calendar OAuth token storage to profiles
ALTER TABLE public.profiles
ADD COLUMN google_calendar_access_token TEXT,
ADD COLUMN google_calendar_refresh_token TEXT,
ADD COLUMN google_calendar_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN google_calendar_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN google_calendar_last_sync TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.profiles.google_calendar_access_token IS 'Encrypted Google Calendar OAuth access token';
COMMENT ON COLUMN public.profiles.google_calendar_refresh_token IS 'Encrypted Google Calendar OAuth refresh token';
COMMENT ON COLUMN public.profiles.google_calendar_token_expires_at IS 'When the Google Calendar access token expires';
COMMENT ON COLUMN public.profiles.google_calendar_connected IS 'Whether user has connected Google Calendar';
COMMENT ON COLUMN public.profiles.google_calendar_last_sync IS 'Last time calendar was synced';