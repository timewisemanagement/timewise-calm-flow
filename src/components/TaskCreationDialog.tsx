import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface TaskCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
  userProfile: {
    downtime_start: string | null;
    downtime_end: string | null;
  } | null;
}

interface NewTask {
  title: string;
  description: string;
  duration_minutes: number;
  priority: string;
  tags: string;
  scheduled_date: string;
  scheduled_time: string;
  commute_minutes: number;
  recurrence_pattern: string;
  recurrence_days: string[];
  recurrence_end_date: string;
}

export function TaskCreationDialog({ open, onOpenChange, onTaskCreated, userProfile }: TaskCreationDialogProps) {
  const [newTask, setNewTask] = useState<NewTask>({
    title: '',
    description: '',
    duration_minutes: 60,
    priority: 'medium',
    tags: '',
    scheduled_date: '',
    scheduled_time: '',
    commute_minutes: 0,
    recurrence_pattern: 'once',
    recurrence_days: [],
    recurrence_end_date: '',
  });
  const [showDowntimeWarning, setShowDowntimeWarning] = useState(false);
  const [pendingTask, setPendingTask] = useState<NewTask | null>(null);

  const isTimeInDowntime = (time: string) => {
    if (!userProfile?.downtime_start || !userProfile?.downtime_end || !time) return false;
    const taskTime = time.split(':').map(Number);
    const downtimeStart = userProfile.downtime_start.split(':').map(Number);
    const downtimeEnd = userProfile.downtime_end.split(':').map(Number);
    
    const taskMinutes = taskTime[0] * 60 + taskTime[1];
    const startMinutes = downtimeStart[0] * 60 + downtimeStart[1];
    const endMinutes = downtimeEnd[0] * 60 + downtimeEnd[1];
    
    return taskMinutes >= startMinutes && taskMinutes < endMinutes;
  };

  const handleCreateTask = async (taskToCreate: NewTask = newTask, force: boolean = false) => {
    if (!taskToCreate.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    if (taskToCreate.scheduled_time && !taskToCreate.scheduled_date) {
      toast.error('Please select a date before setting a time');
      return;
    }

    if (!force && taskToCreate.scheduled_time && isTimeInDowntime(taskToCreate.scheduled_time)) {
      setPendingTask(taskToCreate);
      setShowDowntimeWarning(true);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: taskToCreate.title,
        description: taskToCreate.description,
        duration_minutes: taskToCreate.duration_minutes,
        priority: taskToCreate.priority,
        tags: taskToCreate.tags.split(',').map(t => t.trim()).filter(Boolean),
        scheduled_date: taskToCreate.scheduled_date || null,
        scheduled_time: taskToCreate.scheduled_time || null,
        commute_minutes: taskToCreate.commute_minutes,
        recurrence_pattern: taskToCreate.recurrence_pattern,
        recurrence_days: taskToCreate.recurrence_days,
        recurrence_end_date: taskToCreate.recurrence_end_date || null,
        status: 'pending',
      });

      if (error) throw error;

      // If task has no date/time, automatically schedule it with AI
      if (!taskToCreate.scheduled_date || !taskToCreate.scheduled_time) {
        toast.success('Task created! AI is scheduling it for you...');
        
        // Call AI to schedule the task
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke('generate-suggestions', {
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          });
        } catch (aiError) {
          console.error('AI scheduling error:', aiError);
          toast.error('Task created but AI scheduling failed. You can schedule it manually.');
        }
      } else {
        toast.success('Task created successfully!');
      }

      setNewTask({
        title: '',
        description: '',
        duration_minutes: 60,
        priority: 'medium',
        tags: '',
        scheduled_date: '',
        scheduled_time: '',
        commute_minutes: 0,
        recurrence_pattern: 'once',
        recurrence_days: [],
        recurrence_end_date: '',
      });
      onOpenChange(false);
      onTaskCreated();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleConfirmDowntime = () => {
    if (pendingTask) {
      handleCreateTask(pendingTask, true);
      setPendingTask(null);
    }
    setShowDowntimeWarning(false);
  };

  const handleCancelDowntime = () => {
    setPendingTask(null);
    setShowDowntimeWarning(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={newTask.duration_minutes}
                  onChange={(e) => setNewTask({ ...newTask, duration_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label>Priority</Label>
                <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Tags (comma separated)</Label>
              <Input
                value={newTask.tags}
                onChange={(e) => setNewTask({ ...newTask, tags: e.target.value })}
                placeholder="work, personal, urgent"
              />
            </div>

            <div>
              <Label>Commute Time (minutes)</Label>
              <Input
                type="number"
                value={newTask.commute_minutes}
                onChange={(e) => setNewTask({ ...newTask, commute_minutes: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            <div>
              <Label>Recurrence</Label>
              <Select value={newTask.recurrence_pattern} onValueChange={(value) => setNewTask({ ...newTask, recurrence_pattern: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">One-time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newTask.recurrence_pattern === 'weekly' && (
              <div>
                <Label>Repeat on days</Label>
                <div className="flex gap-2 flex-wrap mt-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <Button
                      key={day}
                      type="button"
                      variant={newTask.recurrence_days.includes(day) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const days = newTask.recurrence_days.includes(day)
                          ? newTask.recurrence_days.filter(d => d !== day)
                          : [...newTask.recurrence_days, day];
                        setNewTask({ ...newTask, recurrence_days: days });
                      }}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {(newTask.recurrence_pattern === 'daily' || newTask.recurrence_pattern === 'weekly') && (
              <div>
                <Label>End Date (optional)</Label>
                <Input
                  type="date"
                  value={newTask.recurrence_end_date}
                  onChange={(e) => setNewTask({ ...newTask, recurrence_end_date: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date (optional)</Label>
                <Input
                  type="date"
                  value={newTask.scheduled_date}
                  onChange={(e) => setNewTask({ ...newTask, scheduled_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Time (optional, requires date)</Label>
                <Input
                  type="time"
                  value={newTask.scheduled_time}
                  onChange={(e) => setNewTask({ ...newTask, scheduled_time: e.target.value })}
                  disabled={!newTask.scheduled_date}
                />
              </div>
            </div>

            <Button onClick={() => handleCreateTask()} className="w-full">
              Create Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDowntimeWarning} onOpenChange={setShowDowntimeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scheduling During Downtime</AlertDialogTitle>
            <AlertDialogDescription>
              This task is scheduled during your downtime. Are you sure you want to schedule it at this time?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDowntime}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDowntime}>Yes, Schedule It</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}