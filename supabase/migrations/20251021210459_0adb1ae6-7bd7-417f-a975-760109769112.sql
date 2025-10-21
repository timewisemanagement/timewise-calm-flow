-- Add scheduled_at column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN scheduled_at timestamp with time zone;