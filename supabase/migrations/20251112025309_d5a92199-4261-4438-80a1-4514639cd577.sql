-- Add attended status to calendar events
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS attended boolean DEFAULT false;