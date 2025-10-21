import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { ArrowLeft, Plus, Clock, Target, CalendarIcon } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  priority: string;
  tags: string[];
  status: string;
  created_at: string;
  scheduled_at: string | null;
}

const Tasks = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    duration_minutes: 60,
    priority: "medium",
    tags: "",
    scheduled_at: null as Date | null,
  });

  useEffect(() => {
    checkAuth();
    fetchTasks();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tagsArray = newTask.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: newTask.title,
        description: newTask.description || null,
        duration_minutes: newTask.duration_minutes,
        priority: newTask.priority,
        tags: tagsArray,
        scheduled_at: newTask.scheduled_at?.toISOString() || null,
      });

      if (error) throw error;

      toast.success("Task created successfully!");
      setIsDialogOpen(false);
      setNewTask({
        title: "",
        description: "",
        duration_minutes: 60,
        priority: "medium",
        tags: "",
        scheduled_at: null,
      });
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to create task");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) throw error;
      toast.success("Task deleted");
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete task");
    }
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status })
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task updated");
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">My Tasks</h1>
              <p className="text-sm text-muted-foreground">Manage your tasks and priorities</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Add a new task to get AI-powered scheduling suggestions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Write project proposal"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Add any relevant details..."
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="15"
                      step="15"
                      value={newTask.duration_minutes}
                      onChange={(e) =>
                        setNewTask({ ...newTask, duration_minutes: parseInt(e.target.value) })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority *</Label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
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
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="e.g., work, urgent, research"
                    value={newTask.tags}
                    onChange={(e) => setNewTask({ ...newTask, tags: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Schedule for specific time (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newTask.scheduled_at && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newTask.scheduled_at ? (
                          format(newTask.scheduled_at, "PPP 'at' p")
                        ) : (
                          <span>Pick a date and time</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newTask.scheduled_at || undefined}
                        onSelect={(date) => setNewTask({ ...newTask, scheduled_at: date || null })}
                        initialFocus
                        className="pointer-events-auto"
                      />
                      {newTask.scheduled_at && (
                        <div className="p-3 border-t">
                          <Label htmlFor="time">Time</Label>
                          <Input
                            id="time"
                            type="time"
                            value={format(newTask.scheduled_at, "HH:mm")}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":");
                              const newDate = new Date(newTask.scheduled_at!);
                              newDate.setHours(parseInt(hours), parseInt(minutes));
                              setNewTask({ ...newTask, scheduled_at: newDate });
                            }}
                            className="mt-2"
                          />
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  {newTask.scheduled_at && (
                    <p className="text-xs text-muted-foreground">
                      AI suggestions will not change this scheduled time
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleCreateTask}
                  disabled={!newTask.title}
                  className="w-full bg-gradient-primary"
                >
                  Create Task
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {isLoading ? (
          <div className="text-center py-12">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first task to get started with smart scheduling
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>Create Task</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks
                .filter((t) => t.status === "pending" || t.status === "scheduled")
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onDelete={handleDeleteTask}
                    onUpdateStatus={handleUpdateStatus}
                  />
                ))}
            </div>

            {tasks.some((t) => t.status === "completed") && (
              <>
                <h3 className="text-lg font-semibold mt-8 mb-4">Completed Tasks</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                  {tasks
                    .filter((t) => t.status === "completed")
                    .map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onDelete={handleDeleteTask}
                        onUpdateStatus={handleUpdateStatus}
                      />
                    ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Tasks;