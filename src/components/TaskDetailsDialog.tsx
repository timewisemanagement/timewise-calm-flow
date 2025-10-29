import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Tag, AlignLeft, Repeat, MapPin } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  priority: string;
  tags: string[];
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  start_time: string | null;
  end_time: string | null;
  commute_minutes?: number;
  recurrence_pattern?: string;
  recurrence_days?: string[];
  recurrence_end_date?: string | null;
  color?: string;
}

interface TaskDetailsDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onUpdateStatus?: (taskId: string, status: string) => void;
}

export function TaskDetailsDialog({ task, open, onOpenChange, onEdit, onDelete, onUpdateStatus }: TaskDetailsDialogProps) {
  if (!task) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-success text-success-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const isCompleted = task.status === 'completed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0" 
              style={{ backgroundColor: task.color || '#3b82f6' }}
            />
            <span className={isCompleted ? 'line-through opacity-60' : ''}>{task.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {task.description && (
            <div className="flex gap-3">
              <AlignLeft className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Description</p>
                <p className="text-muted-foreground">{task.description}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Date & Time</p>
              <div className="space-y-1">
                {task.scheduled_date && (
                  <p className="text-muted-foreground">
                    {format(new Date(task.scheduled_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                  </p>
                )}
                {task.start_time && task.end_time && (
                  <p className="text-muted-foreground">
                    {task.start_time} - {task.end_time}
                  </p>
                )}
                {task.scheduled_time && !task.start_time && (
                  <p className="text-muted-foreground">
                    Starts at {task.scheduled_time}
                  </p>
                )}
                {task.duration_minutes > 0 && (
                  <p className="text-muted-foreground">
                    Duration: {task.duration_minutes} minutes
                  </p>
                )}
              </div>
            </div>
          </div>

          {task.recurrence_pattern && (
            <div className="flex gap-3">
              <Repeat className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Recurrence</p>
                <p className="text-muted-foreground capitalize">{task.recurrence_pattern}</p>
                {task.recurrence_days && task.recurrence_days.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    On: {task.recurrence_days.join(', ')}
                  </p>
                )}
                {task.recurrence_end_date && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Until: {format(new Date(task.recurrence_end_date + 'T00:00:00'), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
          )}

          {task.commute_minutes && task.commute_minutes > 0 && (
            <div className="flex gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Commute Time</p>
                <p className="text-muted-foreground">{task.commute_minutes} minutes</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Tag className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Priority</p>
              <Badge variant="outline" className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
            </div>
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-3">
              <Tag className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Status</p>
              <Badge variant={isCompleted ? "default" : "outline"}>
                {isCompleted ? 'Completed' : 'Pending'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          {!isCompleted && onUpdateStatus && (
            <Button onClick={() => onUpdateStatus(task.id, 'completed')}>
              Mark as Finished
            </Button>
          )}
          {isCompleted && onUpdateStatus && (
            <Button variant="outline" onClick={() => onUpdateStatus(task.id, 'pending')}>
              Undo Completion
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" onClick={() => onEdit(task)}>
              Edit Task
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" onClick={() => onDelete(task.id)}>
              Delete Task
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
