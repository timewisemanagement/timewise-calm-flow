-- Add Canvas integration fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN canvas_url text,
ADD COLUMN canvas_connected boolean DEFAULT false,
ADD COLUMN canvas_last_sync timestamp with time zone;