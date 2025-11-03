import { format } from "date-fns";
import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Task {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  priority: string;
  tags: string[];
  status: string;
  created_at: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  start_time: string | null;
  end_time: string | null;
  commute_minutes?: number;
  recurrence_pattern?: string;
  color?: string;
}

interface TimelineViewProps {
  tasks: Task[];
  onDeleteTask: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: string) => void;
  onEditTask: (task: Task) => void;
  onTaskClick: (task: Task) => void;
  wakeTime?: string;
  bedTime?: string;
  downtimeStart?: string;
  downtimeEnd?: string;
}

export function TimelineView({ tasks, onDeleteTask, onUpdateStatus, onEditTask, onTaskClick, wakeTime = "08:00", bedTime = "22:00", downtimeStart, downtimeEnd }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Generate all 24 hours starting from midnight
  const [wakeHour] = wakeTime.split(':').map(Number);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Scroll to wake time on mount
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          const hourHeight = 80; // Each hour is 80px tall
          viewport.scrollTop = wakeHour * hourHeight;
        }
      }
    });
  }, [wakeHour]);

  const isSleepHour = (hour: number) => {
    const [bedHour, bedMinute] = bedTime.split(':').map(Number);
    const [wakeHour, wakeMinute] = wakeTime.split(':').map(Number);
    
    // Sleep hours are from bedTime to wakeTime
    if (bedHour < wakeHour) {
      // Sleep spans across midnight (e.g., 9pm to 6am)
      return hour >= bedHour || hour < wakeHour;
    } else {
      // Sleep doesn't span midnight (e.g., 1am to 8am)
      return hour >= bedHour || hour < wakeHour;
    }
  };

  const isDowntimeHour = (hour: number) => {
    if (!downtimeStart || !downtimeEnd) return false;
    const [startHour] = downtimeStart.split(':').map(Number);
    const [endHour] = downtimeEnd.split(':').map(Number);
    
    if (startHour < endHour) {
      return hour >= startHour && hour < endHour;
    } else {
      return hour >= startHour || hour < endHour;
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
    <ScrollArea ref={scrollRef} className="border rounded-lg bg-card" style={{ height: 'calc(100vh - 280px)' }}>
      <div className="relative min-h-full">
        {hours.map((hour) => {
          const isSleep = isSleepHour(hour);
          const isDowntime = isDowntimeHour(hour);
          
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
              <div className={`w-20 flex-shrink-0 p-3 border-r font-medium text-sm ${isSleep ? 'bg-blue-500/10' : isDowntime ? 'bg-black/5' : 'bg-muted/30'}`}>
                {formatHour(hour)}
              </div>
              <div className={`flex-1 relative ${isSleep ? 'bg-blue-500/10' : isDowntime ? 'bg-black/5' : ''}`}>
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
                  
                  const isSmall = heightPx < 60;
                  
                  return (
                    <Card 
                      key={task.id} 
                      className={`absolute left-2 right-2 p-2 transition-opacity cursor-pointer hover:shadow-lg ${isCompleted ? 'opacity-50' : ''}`}
                      style={{ 
                        top: `${topOffset}px`, 
                        height: `${heightPx}px`,
                        minHeight: '40px',
                        zIndex: 10,
                        borderLeft: `4px solid ${task.color || '#3b82f6'}`,
                        backgroundColor: `${task.color || '#3b82f6'}10`
                      }}
                      onClick={() => onTaskClick(task)}
                    >
                      <div className={`h-full ${isSmall ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 overflow-hidden">
                            <div className={`font-medium ${isCompleted ? 'line-through' : ''} ${isSmall ? 'text-xs' : 'text-sm'}`}>
                              {task.title}
                            </div>
                            {!isSmall && (
                              <>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className={`${getPriorityColor(task.priority)} text-xs`}>
                                    {task.priority}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  {task.start_time && task.end_time ? (
                                    <span>{task.start_time} - {task.end_time}</span>
                                  ) : task.scheduled_time && (
                                    <>
                                      <span>{task.scheduled_time}</span>
                                      <span>•</span>
                                      <span>{task.duration_minutes} min</span>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                            {isSmall && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Badge variant="outline" className={`${getPriorityColor(task.priority)} text-xs`}>
                                  {task.priority}
                                </Badge>
                                {task.start_time && task.end_time && (
                                  <span>{task.start_time} - {task.end_time}</span>
                                )}
                              </div>
                            )}
                          </div>
                          {!isSmall && (
                            <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              {!isCompleted && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, 'completed'); }}
                                  title="Mark as finished"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                title="Edit task"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive"
                                onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                                title="Delete task"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
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
    </ScrollArea>
  );
}