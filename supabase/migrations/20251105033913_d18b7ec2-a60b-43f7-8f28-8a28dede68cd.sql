-- Add Canvas OAuth token storage to profiles
ALTER TABLE public.profiles
ADD COLUMN canvas_access_token TEXT,
ADD COLUMN canvas_refresh_token TEXT,
ADD COLUMN canvas_token_expires_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.profiles.canvas_access_token IS 'Encrypted Canvas OAuth access token';
COMMENT ON COLUMN public.profiles.canvas_refresh_token IS 'Encrypted Canvas OAuth refresh token';
COMMENT ON COLUMN public.profiles.canvas_token_expires_at IS 'When the Canvas access token expires';