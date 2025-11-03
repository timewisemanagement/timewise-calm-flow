import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Undo2, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface DeletedTask {
  id: string;
  title: string;
  description: string | null;
  deleted_at: string;
  scheduled_date: string | null;
  priority: string;
}

interface DeletedTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskRestored: () => void;
}

export function DeletedTasksDialog({
  open,
  onOpenChange,
  onTaskRestored,
}: DeletedTasksDialogProps) {
  const [deletedTasks, setDeletedTasks] = useState<DeletedTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchDeletedTasks();
    }
  }, [open]);

  const fetchDeletedTasks = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, deleted_at, scheduled_date, priority")
        .eq("user_id", user.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      setDeletedTasks(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch deleted tasks");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: null })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task restored successfully");
      fetchDeletedTasks();
      onTaskRestored();
    } catch (error: any) {
      toast.error("Failed to restore task");
      console.error(error);
    }
  };

  const handlePermanentDelete = async (taskId: string) => {
    if (!confirm("Are you sure? This cannot be undone.")) return;

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) throw error;
      toast.success("Task permanently deleted");
      fetchDeletedTasks();
    } catch (error: any) {
      toast.error("Failed to delete task");
      console.error(error);
    }
  };

  const handlePurgeOldTasks = async () => {
    if (!confirm("This will permanently delete all tasks deleted more than 30 days ago. Continue?")) return;

    try {
      const { error } = await supabase.rpc("purge_old_deleted_tasks");

      if (error) throw error;
      toast.success("Old deleted tasks purged");
      fetchDeletedTasks();
    } catch (error: any) {
      toast.error("Failed to purge old tasks");
      console.error(error);
    }
  };

  const getDaysUntilPurge = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt);
    const purgeDate = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.ceil((purgeDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(0, daysLeft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Deleted Tasks</DialogTitle>
          <DialogDescription>
            Tasks are automatically purged after 30 days. Restore them before they're gone forever.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {deletedTasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePurgeOldTasks}
              className="w-full"
            >
              Purge Old Deleted Tasks (30+ days)
            </Button>
          )}

          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : deletedTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No deleted tasks found
              </div>
            ) : (
              <div className="space-y-3">
                {deletedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{task.title}</h3>
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="capitalize">{task.priority} priority</span>
                          {task.scheduled_date && (
                            <span>Scheduled: {format(new Date(task.scheduled_date), "MMM d, yyyy")}</span>
                          )}
                          <span>
                            Deleted: {format(new Date(task.deleted_at), "MMM d, yyyy")}
                          </span>
                          <span className="text-destructive">
                            Purges in {getDaysUntilPurge(task.deleted_at)} days
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(task.id)}
                          title="Restore task"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handlePermanentDelete(task.id)}
                          title="Permanently delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
