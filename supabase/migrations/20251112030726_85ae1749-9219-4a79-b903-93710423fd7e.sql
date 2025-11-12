-- Create a secure table for OAuth tokens
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_calendar', 'canvas')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Enable RLS on oauth_tokens
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Create strict RLS policies - users can only access their own tokens
CREATE POLICY "Users can view only their own OAuth tokens"
  ON public.oauth_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert only their own OAuth tokens"
  ON public.oauth_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update only their own OAuth tokens"
  ON public.oauth_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete only their own OAuth tokens"
  ON public.oauth_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Migrate existing Google Calendar tokens from profiles to oauth_tokens
INSERT INTO public.oauth_tokens (user_id, provider, access_token, refresh_token, token_expires_at)
SELECT 
  id as user_id,
  'google_calendar' as provider,
  google_calendar_access_token,
  google_calendar_refresh_token,
  google_calendar_token_expires_at
FROM public.profiles
WHERE google_calendar_access_token IS NOT NULL
ON CONFLICT (user_id, provider) DO NOTHING;

-- Migrate existing Canvas tokens from profiles to oauth_tokens
INSERT INTO public.oauth_tokens (user_id, provider, access_token, refresh_token, token_expires_at)
SELECT 
  id as user_id,
  'canvas' as provider,
  canvas_access_token,
  canvas_refresh_token,
  canvas_token_expires_at
FROM public.profiles
WHERE canvas_access_token IS NOT NULL
ON CONFLICT (user_id, provider) DO NOTHING;

-- Drop token columns from profiles table
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS google_calendar_access_token,
  DROP COLUMN IF EXISTS google_calendar_refresh_token,
  DROP COLUMN IF EXISTS google_calendar_token_expires_at,
  DROP COLUMN IF EXISTS canvas_access_token,
  DROP COLUMN IF EXISTS canvas_refresh_token,
  DROP COLUMN IF EXISTS canvas_token_expires_at;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider ON public.oauth_tokens(user_id, provider);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();