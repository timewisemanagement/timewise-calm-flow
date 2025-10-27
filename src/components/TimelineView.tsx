import { format } from "date-fns";
import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Check } from "lucide-react";

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
  onDeleteTask: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: string) => void;
  onEditTask: (task: Task) => void;
  wakeTime?: string;
  bedTime?: string;
}

export function TimelineView({ tasks, onDeleteTask, onUpdateStatus, onEditTask, wakeTime = "08:00", bedTime = "22:00" }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Generate hours from 12am to 11pm (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Parse wake time to scroll to it on mount
  useEffect(() => {
    if (scrollRef.current && wakeTime) {
      const [wakeHour] = wakeTime.split(':').map(Number);
      const hourHeight = 80; // Approximate height per hour
      scrollRef.current.scrollTop = wakeHour * hourHeight - 100;
    }
  }, [wakeTime]);

  // Check if an hour is within sleep time
  const isSleepHour = (hour: number) => {
    const [bedHour] = bedTime.split(':').map(Number);
    const [wakeHour] = wakeTime.split(':').map(Number);
    
    if (bedHour < wakeHour) {
      // Sleep crosses midnight (e.g., 22:00 to 08:00)
      return hour >= bedHour || hour < wakeHour;
    } else {
      // Sleep within same day (unusual, but handle it)
      return hour >= bedHour && hour < wakeHour;
    }
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12am';
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    if (hour === 23) return '11pm';
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
    <div ref={scrollRef} className="border rounded-lg overflow-y-auto bg-card" style={{ height: 'calc(100vh - 280px)' }}>
      <div className="relative">
        {hours.map((hour) => {
          const isSleep = isSleepHour(hour);
          
          // Get all tasks that overlap with this hour slot
          const overlappingTasks = tasks.filter(task => {
            if (!task.scheduled_time) return false;
            const [taskHour, taskMinute] = task.scheduled_time.split(':').map(Number);
            const taskStartMinutes = taskHour * 60 + taskMinute;
            const taskEndMinutes = taskStartMinutes + task.duration_minutes;
            const hourStartMinutes = hour * 60;
            const hourEndMinutes = (hour + 1) * 60;
            
            return taskStartMinutes < hourEndMinutes && taskEndMinutes > hourStartMinutes;
          });
          
          return (
            <div key={hour} className="flex border-b last:border-b-0 relative" style={{ height: '80px' }}>
              <div className={`w-20 flex-shrink-0 p-3 border-r font-medium text-sm ${isSleep ? 'bg-primary/5' : 'bg-muted/30'}`}>
                {formatHour(hour)}
              </div>
              <div className={`flex-1 relative ${isSleep ? 'bg-primary/5' : ''}`}>
                {overlappingTasks.map((task) => {
                  const isCompleted = task.status === 'completed';
                  const [taskHour, taskMinute] = task.scheduled_time!.split(':').map(Number);
                  const taskStartMinutes = taskHour * 60 + taskMinute;
                  const taskEndMinutes = taskStartMinutes + task.duration_minutes;
                  
                  // Calculate position within hour
                  const hourStartMinutes = hour * 60;
                  const hourEndMinutes = (hour + 1) * 60;
                  
                  // Only render if task starts in this hour
                  if (taskHour !== hour) return null;
                  
                  // Calculate offset from top of hour (in minutes from hour start)
                  const minutesFromHourStart = taskMinute;
                  const topOffset = (minutesFromHourStart / 60) * 80; // 80px per hour
                  
                  // Calculate height based on duration
                  const heightPx = (task.duration_minutes / 60) * 80;
                  
                  return (
                    <Card 
                      key={task.id} 
                      className={`absolute left-2 right-2 p-3 transition-opacity ${isCompleted ? 'opacity-50' : ''}`}
                      style={{ 
                        top: `${topOffset}px`, 
                        height: `${heightPx}px`,
                        minHeight: '40px',
                        zIndex: 10
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 h-full">
                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-medium truncate ${isCompleted ? 'line-through' : ''}`}>{task.title}</span>
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
                        <div className="flex gap-1 flex-shrink-0">
                          {!isCompleted && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => onUpdateStatus(task.id, 'completed')}
                              title="Mark as finished"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => onEditTask(task)}
                            title="Edit task"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => onDeleteTask(task.id)}
                            title="Delete task"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}