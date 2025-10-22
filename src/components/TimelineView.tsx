import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Task {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  priority: string;
  scheduled_time: string | null;
  commute_minutes?: number;
  status: string;
}

interface TimelineViewProps {
  tasks: Task[];
}

export function TimelineView({ tasks }: TimelineViewProps) {
  // Generate hours from 12am to 11pm
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getTasksForHour = (hour: number) => {
    return tasks.filter(task => {
      if (!task.scheduled_time) return false;
      const [taskHour] = task.scheduled_time.split(':').map(Number);
      return taskHour === hour;
    }).sort((a, b) => {
      const [, aMin] = a.scheduled_time!.split(':').map(Number);
      const [, bMin] = b.scheduled_time!.split(':').map(Number);
      return aMin - bMin;
    });
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12am';
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    return `${hour - 12}pm`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-success text-success-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-0 border rounded-lg overflow-hidden bg-card">
      {hours.map((hour) => {
        const hourTasks = getTasksForHour(hour);
        
        return (
          <div key={hour} className="flex border-b last:border-b-0">
            <div className="w-20 flex-shrink-0 p-3 border-r bg-muted/30 font-medium text-sm">
              {formatHour(hour)}
            </div>
            <div className="flex-1 p-2 min-h-[60px]">
              {hourTasks.length > 0 ? (
                <div className="space-y-2">
                  {hourTasks.map((task) => (
                    <Card 
                      key={task.id} 
                      className={`p-3 ${task.status === 'completed' ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{task.title}</span>
                            <Badge variant="outline" className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{task.scheduled_time}</span>
                            <span>•</span>
                            <span>{task.duration_minutes} min</span>
                            {task.commute_minutes && task.commute_minutes > 0 && (
                              <>
                                <span>•</span>
                                <span>Commute: {task.commute_minutes} min</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center text-muted-foreground text-sm">
                  {/* Empty slot */}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}