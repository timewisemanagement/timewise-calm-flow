import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Trash2, Edit, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

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

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  provider_event_id: string;
}

interface CalendarViewProps {
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: string) => void;
  onEditTask: (task: Task) => void;
}

export function CalendarView({ tasks, calendarEvents, currentMonth, onMonthChange, onTaskClick, onDeleteTask, onUpdateStatus, onEditTask }: CalendarViewProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      if (!task.scheduled_date) return false;
      // Parse date as local date to avoid timezone shift
      const [year, month, dayNum] = task.scheduled_date.split('-').map(Number);
      const taskDate = new Date(year, month - 1, dayNum);
      return isSameDay(taskDate, day);
    }).sort((a, b) => {
      // Sort by scheduled time, earliest first
      if (!a.scheduled_time || !b.scheduled_time) return 0;
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });
  };

  const getEventsForDay = (day: Date) => {
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.start_time);
      return isSameDay(eventDate, day);
    }).sort((a, b) => {
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
  };

  const previousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onMonthChange(newDate);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-semibold p-2">
            {day}
          </div>
        ))}
        
        {days.map(day => {
          const dayTasks = getTasksForDay(day);
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Card 
              key={day.toISOString()} 
              className={`min-h-[100px] p-2 ${!isCurrentMonth ? 'opacity-50' : ''} ${isToday ? 'border-primary' : ''}`}
            >
              <div className="font-semibold mb-1">{format(day, 'd')}</div>
              <div className="space-y-1">
                {/* Render calendar events first */}
                {dayEvents.map(event => {
                  const eventStart = new Date(event.start_time);
                  const eventEnd = new Date(event.end_time);
                  return (
                    <div
                      key={event.id}
                      className="cursor-default rounded p-1 text-xs border-l-2 border-purple-500 bg-purple-50"
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-purple-600">📅</span>
                        <span className="text-xs font-medium">Google Calendar</span>
                      </div>
                      <div className="truncate font-medium">{event.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {format(eventStart, 'h:mm a')} - {format(eventEnd, 'h:mm a')}
                      </div>
                    </div>
                  );
                })}
                {/* Render tasks */}
                {dayTasks.map(task => {
                  const isCompleted = task.status === 'completed';
                  return (
                    <ContextMenu key={task.id}>
                      <ContextMenuTrigger>
                        <div
                          onClick={() => onTaskClick(task)}
                          className={`cursor-pointer hover:bg-accent rounded p-1 text-xs transition-opacity ${isCompleted ? 'opacity-50' : ''}`}
                        >
                          <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'} className="text-xs mb-1">
                            {task.priority}
                          </Badge>
                          <div className={`truncate ${isCompleted ? 'line-through' : ''}`}>{task.title}</div>
                          {task.scheduled_time && (
                            <div className="text-muted-foreground text-xs">
                              {format(new Date(`2000-01-01T${task.scheduled_time}`), 'h:mm a')}
                            </div>
                          )}
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        {!isCompleted && (
                          <ContextMenuItem onClick={() => onUpdateStatus(task.id, 'completed')}>
                            <Check className="mr-2 h-4 w-4" />
                            Mark as Finished
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem onClick={() => onEditTask(task)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onDeleteTask(task.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}