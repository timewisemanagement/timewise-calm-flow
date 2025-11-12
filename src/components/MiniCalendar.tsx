import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns';

interface Task {
  id: string;
  scheduled_date: string | null;
  color?: string;
}

interface CalendarEvent {
  id: string;
  start_time: string;
}

interface MiniCalendarProps {
  tasks: Task[];
  calendarEvents?: CalendarEvent[];
  currentMonth: Date;
  onClick: () => void;
}

export function MiniCalendar({ tasks, calendarEvents = [], currentMonth, onClick }: MiniCalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      if (!task.scheduled_date) return false;
      const [year, month, dayNum] = task.scheduled_date.split('-').map(Number);
      const taskDate = new Date(year, month - 1, dayNum);
      return isSameDay(taskDate, day);
    });
  };

  const getEventsForDay = (day: Date) => {
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.start_time);
      return isSameDay(eventDate, day);
    });
  };

  return (
    <div 
      className="cursor-pointer hover:bg-accent/50 transition-colors p-4 rounded-lg border"
      onClick={onClick}
    >
      <div className="text-center font-semibold mb-3">
        {format(currentMonth, 'MMMM yyyy')}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-xs font-medium text-muted-foreground p-1">
            {day}
          </div>
        ))}
        
        {days.map(day => {
          const dayTasks = getTasksForDay(day);
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div
              key={day.toISOString()}
              className={`
                p-1 text-center text-xs rounded
                ${!isCurrentMonth ? 'text-muted-foreground/40' : ''}
                ${isToday ? 'bg-primary text-primary-foreground font-bold' : ''}
              `}
            >
              <div>{format(day, 'd')}</div>
              {(dayTasks.length > 0 || dayEvents.length > 0) && (
                <div className="flex justify-center gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((event, i) => (
                    <div
                      key={`event-${i}`}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: '#a855f7' }}
                    />
                  ))}
                  {dayTasks.slice(0, 3 - dayEvents.length).map((task, i) => (
                    <div
                      key={`task-${i}`}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: task.color || '#3b82f6' }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
