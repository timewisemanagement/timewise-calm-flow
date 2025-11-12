import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { WarningDialog } from '@/components/WarningDialog';
import { taskSchema } from '@/lib/validationSchemas';
import { z } from 'zod';

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
  const [warningDialog, setWarningDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
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
    // Validate task inputs
    try {
      const validationData = {
        title: taskToCreate.title,
        description: taskToCreate.description || undefined,
        duration_minutes: taskToCreate.duration_minutes,
        priority: taskToCreate.priority,
        tags: taskToCreate.tags || undefined,
        scheduled_date: taskToCreate.scheduled_date || undefined,
        scheduled_time: taskToCreate.scheduled_time || undefined,
        commute_minutes: taskToCreate.commute_minutes || 0,
      };

      const result = taskSchema.safeParse(validationData);
      if (!result.success) {
        const firstError = result.error.errors[0];
        toast.error(firstError.message);
        return;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    if (taskToCreate.scheduled_time && !taskToCreate.scheduled_date && taskToCreate.recurrence_pattern === 'once') {
      toast.error('Please select a date before setting a time');
      return;
    }

    if (!force && taskToCreate.scheduled_time && isTimeInDowntime(taskToCreate.scheduled_time)) {
      setPendingTask(taskToCreate);
      setWarningDialog({
        open: true,
        title: "Scheduling During Downtime",
        description: "This task is scheduled during your downtime. Are you sure you want to schedule it at this time?",
        onConfirm: () => {
          if (pendingTask) {
            handleCreateTask(pendingTask, true);
            setPendingTask(null);
          }
          setWarningDialog(null);
        },
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch existing tasks for validation
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);

      // Validation: Check for duplicate task names on the same day
      if (taskToCreate.scheduled_date && taskToCreate.recurrence_pattern === 'once') {
        const duplicateTask = existingTasks?.find(
          t => t.title === taskToCreate.title && t.scheduled_date === taskToCreate.scheduled_date
        );
        if (duplicateTask) {
          return new Promise<void>((resolve) => {
            setWarningDialog({
              open: true,
              title: "Duplicate Task Name",
              description: `You already have a task named "${taskToCreate.title}" on ${taskToCreate.scheduled_date}. Are you sure you want to create another one?`,
              onConfirm: () => {
                setWarningDialog(null);
                resolve();
              },
            });
          }).then(() => {
            // Continue with the rest of the validation
          });
        }
      }

      // Validation: Check for overlapping tasks (only if both date and time are specified)
      if (taskToCreate.scheduled_date && taskToCreate.scheduled_time) {
        const startTime = new Date(`${taskToCreate.scheduled_date}T${taskToCreate.scheduled_time}`);
        const endTime = new Date(startTime.getTime() + taskToCreate.duration_minutes * 60000);

        const overlappingTask = existingTasks?.find(t => {
          if (!t.scheduled_date || !t.scheduled_time) return false;
          const existingStart = new Date(`${t.scheduled_date}T${t.scheduled_time}`);
          const existingEnd = new Date(existingStart.getTime() + t.duration_minutes * 60000);
          
          return t.scheduled_date === taskToCreate.scheduled_date && (
            (startTime >= existingStart && startTime < existingEnd) ||
            (endTime > existingStart && endTime <= existingEnd) ||
            (startTime <= existingStart && endTime >= existingEnd)
          );
        });

        if (overlappingTask) {
          setWarningDialog({
            open: true,
            title: "Task Overlap Detected",
            description: `This task overlaps with "${overlappingTask.title}". Please choose a different time.`,
            onConfirm: () => {
              setWarningDialog(null);
            },
          });
          return;
        }

        // Validation: Check for commute window conflicts (including before AND after task)
        const commuteConflict = existingTasks?.find(t => {
          if (!t.scheduled_date || !t.scheduled_time) return false;
          if (!t.commute_minutes && !taskToCreate.commute_minutes) return false;
          
          const existingStart = new Date(`${t.scheduled_date}T${t.scheduled_time}`);
          const existingEnd = new Date(existingStart.getTime() + t.duration_minutes * 60000);
          const existingCommuteStart = new Date(existingStart.getTime() - (t.commute_minutes || 0) * 60000);
          const existingCommuteEnd = new Date(existingEnd.getTime() + (t.commute_minutes || 0) * 60000);

          const taskCommuteStart = new Date(startTime.getTime() - (taskToCreate.commute_minutes || 0) * 60000);
          const taskCommuteEnd = new Date(endTime.getTime() + (taskToCreate.commute_minutes || 0) * 60000);

          return t.scheduled_date === taskToCreate.scheduled_date && (
            (taskCommuteStart >= existingCommuteStart && taskCommuteStart < existingCommuteEnd) ||
            (taskCommuteEnd > existingCommuteStart && taskCommuteEnd <= existingCommuteEnd) ||
            (taskCommuteStart <= existingCommuteStart && taskCommuteEnd >= existingCommuteEnd) ||
            (startTime >= existingCommuteStart && startTime < existingCommuteEnd) ||
            (endTime > existingCommuteStart && endTime <= existingCommuteEnd)
          );
        });

        if (commuteConflict) {
          return new Promise<void>((resolve, reject) => {
            setWarningDialog({
              open: true,
              title: "Commute Window Conflict",
              description: `This task conflicts with the commute window for "${commuteConflict.title}". Commute times extend before and after tasks. Are you sure you want to schedule it at this time?`,
              onConfirm: () => {
                setWarningDialog(null);
                resolve();
              },
            });
          }).then(() => {
            // Continue with task creation
          }).catch(() => {
            return; // User cancelled
          });
        }
      }

      // Determine if AI should be triggered
      const hasSpecificDateTime = taskToCreate.scheduled_date && taskToCreate.scheduled_time && taskToCreate.recurrence_pattern === 'once';
      const hasOnlyDate = taskToCreate.scheduled_date && !taskToCreate.scheduled_time && taskToCreate.recurrence_pattern === 'once';
      const hasNoScheduling = !taskToCreate.scheduled_date && !taskToCreate.scheduled_time && taskToCreate.recurrence_pattern === 'once';
      const isRecurringWithTime = (taskToCreate.recurrence_pattern === 'daily' || taskToCreate.recurrence_pattern === 'weekly') && taskToCreate.scheduled_time;
      const isRecurringWithoutTime = (taskToCreate.recurrence_pattern === 'daily' || taskToCreate.recurrence_pattern === 'weekly') && !taskToCreate.scheduled_time;
      
      const shouldTriggerAI = hasOnlyDate || hasNoScheduling || isRecurringWithoutTime;

      // Handle recurring tasks with specific time - create multiple instances
      if (isRecurringWithTime) {
        const tasksToCreate = [];
        const startDate = new Date();
        const endDate = taskToCreate.recurrence_end_date ? new Date(taskToCreate.recurrence_end_date) : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
        
        // Generate a unique group ID for this recurring sequence
        const recurrenceGroupId = crypto.randomUUID();

        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          if (taskToCreate.recurrence_pattern === 'daily') {
            tasksToCreate.push({
              user_id: user.id,
              title: taskToCreate.title,
              description: taskToCreate.description,
              duration_minutes: taskToCreate.duration_minutes,
              priority: taskToCreate.priority,
              tags: taskToCreate.tags.split(',').map(t => t.trim()).filter(Boolean),
              status: 'scheduled',
              scheduled_date: currentDate.toISOString().split('T')[0],
              scheduled_time: taskToCreate.scheduled_time,
              commute_minutes: taskToCreate.commute_minutes,
              recurrence_pattern: taskToCreate.recurrence_pattern,
              recurrence_days: taskToCreate.recurrence_days,
              recurrence_end_date: taskToCreate.recurrence_end_date || null,
              recurrence_group_id: recurrenceGroupId,
            });
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
          } else if (taskToCreate.recurrence_pattern === 'weekly' && taskToCreate.recurrence_days.length > 0) {
            const dayOfWeek = currentDate.getDay();
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            if (taskToCreate.recurrence_days.includes(dayNames[dayOfWeek])) {
              tasksToCreate.push({
                user_id: user.id,
                title: taskToCreate.title,
                description: taskToCreate.description,
                duration_minutes: taskToCreate.duration_minutes,
                priority: taskToCreate.priority,
                tags: taskToCreate.tags.split(',').map(t => t.trim()).filter(Boolean),
                status: 'scheduled',
                scheduled_date: currentDate.toISOString().split('T')[0],
                scheduled_time: taskToCreate.scheduled_time,
                commute_minutes: taskToCreate.commute_minutes,
                recurrence_pattern: taskToCreate.recurrence_pattern,
                recurrence_days: taskToCreate.recurrence_days,
                recurrence_end_date: taskToCreate.recurrence_end_date || null,
                recurrence_group_id: recurrenceGroupId,
              });
            }
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
          }
        }

        if (tasksToCreate.length === 0) {
          toast.error('No tasks to create. Please select days for weekly recurrence.');
          return;
        }

        const { error } = await supabase.from('tasks').insert(tasksToCreate);
        if (error) throw error;
        
        toast.success(`Created ${tasksToCreate.length} recurring tasks`);
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
        return;
      }

      // Handle recurring tasks WITHOUT time - create multiple pending instances for AI to schedule
      if (isRecurringWithoutTime) {
        const tasksToCreate = [];
        const startDate = new Date();
        const endDate = taskToCreate.recurrence_end_date ? new Date(taskToCreate.recurrence_end_date) : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
        
        // Generate a unique group ID for this recurring sequence
        const recurrenceGroupId = crypto.randomUUID();

        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          if (taskToCreate.recurrence_pattern === 'daily') {
            tasksToCreate.push({
              user_id: user.id,
              title: taskToCreate.title,
              description: taskToCreate.description,
              duration_minutes: taskToCreate.duration_minutes,
              priority: taskToCreate.priority,
              tags: taskToCreate.tags.split(',').map(t => t.trim()).filter(Boolean),
              status: 'pending',  // Pending because AI needs to schedule
              scheduled_date: null,  // AI will set this
              scheduled_time: null,  // AI will set this
              commute_minutes: taskToCreate.commute_minutes,
              recurrence_pattern: taskToCreate.recurrence_pattern,
              recurrence_days: taskToCreate.recurrence_days,
              recurrence_end_date: taskToCreate.recurrence_end_date || null,
              recurrence_group_id: recurrenceGroupId,
            });
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
          } else if (taskToCreate.recurrence_pattern === 'weekly' && taskToCreate.recurrence_days.length > 0) {
            const dayOfWeek = currentDate.getDay();
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            if (taskToCreate.recurrence_days.includes(dayNames[dayOfWeek])) {
              tasksToCreate.push({
                user_id: user.id,
                title: taskToCreate.title,
                description: taskToCreate.description,
                duration_minutes: taskToCreate.duration_minutes,
                priority: taskToCreate.priority,
                tags: taskToCreate.tags.split(',').map(t => t.trim()).filter(Boolean),
                status: 'pending',  // Pending because AI needs to schedule
                scheduled_date: null,  // AI will set this
                scheduled_time: null,  // AI will set this
                commute_minutes: taskToCreate.commute_minutes,
                recurrence_pattern: taskToCreate.recurrence_pattern,
                recurrence_days: taskToCreate.recurrence_days,
                recurrence_end_date: taskToCreate.recurrence_end_date || null,
                recurrence_group_id: recurrenceGroupId,
              });
            }
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
          }
        }

        if (tasksToCreate.length === 0) {
          toast.error('No tasks to create. Please select days for weekly recurrence.');
          return;
        }

        const { error } = await supabase.from('tasks').insert(tasksToCreate);
        if (error) throw error;
        
        toast.success(`Created ${tasksToCreate.length} recurring tasks`);
        
        // Trigger AI to schedule all these tasks
        toast.info('AI is optimizing your schedule...');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke('generate-suggestions', {
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          });
          // Wait for DB updates to propagate
          await new Promise(resolve => setTimeout(resolve, 1500));
          toast.success('Tasks scheduled by AI!');
        } catch (aiError) {
          console.error('AI scheduling error:', aiError);
          toast.error('Tasks created but AI optimization failed.');
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
        return;
      }

      // Create single task
      // If both date AND time are provided, set status to 'scheduled' (user manually scheduled)
      // Otherwise set to 'pending' (AI will schedule it)
      const taskStatus = (taskToCreate.scheduled_date && taskToCreate.scheduled_time) ? 'scheduled' : 'pending';
      
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
        status: taskStatus,
      });

      if (error) throw error;

      // Auto-trigger AI scheduling if needed (no date/time provided)
      if (shouldTriggerAI) {
        toast.info('AI is scheduling your task...');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const { data, error: invokeError } = await supabase.functions.invoke('generate-suggestions', {
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          });
          
          if (invokeError) {
            console.error('AI scheduling error:', invokeError);
            toast.error('Task created but AI scheduling failed. Check Profile to manually schedule.');
          } else {
            console.log('AI scheduling completed, waiting for DB sync...');
            // Wait for DB updates to propagate before refreshing UI
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log('DB sync complete, refreshing UI');
            toast.success('Task created and scheduled by AI!');
          }
        } catch (aiError) {
          console.error('AI scheduling error:', aiError);
          toast.error('Task created but AI scheduling failed. Check Profile to manually schedule.');
        }
      } else {
        toast.success('Task created!');
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


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Fill in the details for your new task</DialogDescription>
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

            {newTask.recurrence_pattern === 'once' && (
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
            )}

            {(newTask.recurrence_pattern === 'daily' || newTask.recurrence_pattern === 'weekly') && (
              <div>
                <Label>Time (optional)</Label>
                <Input
                  type="time"
                  value={newTask.scheduled_time}
                  onChange={(e) => setNewTask({ ...newTask, scheduled_time: e.target.value })}
                />
              </div>
            )}

            <Button onClick={() => handleCreateTask()} className="w-full">
              Create Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {warningDialog && (
        <WarningDialog
          open={warningDialog.open}
          onOpenChange={(open) => !open && setWarningDialog(null)}
          title={warningDialog.title}
          description={warningDialog.description}
          onConfirm={warningDialog.onConfirm}
          onCancel={() => setWarningDialog(null)}
        />
      )}
    </>
  );
}