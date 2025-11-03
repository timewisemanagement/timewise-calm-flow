-- Add recurrence_group_id column to tasks table to link recurring task sequences
ALTER TABLE public.tasks
ADD COLUMN recurrence_group_id uuid;

-- Add index for better query performance
CREATE INDEX idx_tasks_recurrence_group_id ON public.tasks(recurrence_group_id);

-- Add comment explaining the column
COMMENT ON COLUMN public.tasks.recurrence_group_id IS 'Links tasks that were created together as part of the same recurring sequence';