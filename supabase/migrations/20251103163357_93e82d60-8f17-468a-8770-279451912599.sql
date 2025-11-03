-- Add soft delete support to tasks table
ALTER TABLE public.tasks
ADD COLUMN deleted_at timestamp with time zone;

-- Create index for efficiently querying non-deleted tasks
CREATE INDEX idx_tasks_deleted_at ON public.tasks(deleted_at) WHERE deleted_at IS NULL;

-- Create function to permanently delete tasks older than 30 days
CREATE OR REPLACE FUNCTION public.purge_old_deleted_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tasks
  WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Add comment explaining the columns
COMMENT ON COLUMN public.tasks.deleted_at IS 'Timestamp when task was soft-deleted. Tasks are permanently deleted after 30 days.';