import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

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

interface TaskEditDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, updates: Partial<Task>) => void;
}

export function TaskEditDialog({ task, open, onOpenChange, onSave }: TaskEditDialogProps) {
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});

  if (!task) return null;

  const handleSave = () => {
    onSave(task.id, editedTask);
    onOpenChange(false);
    setEditedTask({});
  };

  const getValue = (field: keyof Task) => {
    return editedTask[field] !== undefined ? editedTask[field] : task[field];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={getValue('title') as string}
              onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={getValue('description') as string || ''}
              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Date</Label>
              <Input
                id="scheduled_date"
                type="date"
                value={getValue('scheduled_date') as string || ''}
                onChange={(e) => setEditedTask({ ...editedTask, scheduled_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={getValue('start_time') as string || ''}
                onChange={(e) => setEditedTask({ ...editedTask, start_time: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                value={getValue('end_time') as string || ''}
                onChange={(e) => setEditedTask({ ...editedTask, end_time: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={getValue('priority') as string}
                onValueChange={(value) => setEditedTask({ ...editedTask, priority: value })}
              >
                <SelectTrigger id="priority">
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

          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              type="color"
              value={getValue('color') as string || '#3b82f6'}
              onChange={(e) => setEditedTask({ ...editedTask, color: e.target.value })}
              className="h-10 w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="commute_minutes">Commute Time (minutes)</Label>
            <Input
              id="commute_minutes"
              type="number"
              min="0"
              value={getValue('commute_minutes') as number || 0}
              onChange={(e) => setEditedTask({ ...editedTask, commute_minutes: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
