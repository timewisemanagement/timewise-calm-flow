-- Convert all existing pending tasks to scheduled
UPDATE public.tasks 
SET status = 'scheduled' 
WHERE status = 'pending';

-- Update the status column check constraint to remove 'pending'
ALTER TABLE public.tasks 
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('scheduled', 'completed'));