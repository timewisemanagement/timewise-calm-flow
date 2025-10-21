import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import TaskCard from "@/components/TaskCard";
import { TaskCreationDialog } from "@/components/TaskCreationDialog";
import { CalendarView } from "@/components/CalendarView";
import { format, startOfDay, endOfDay, addDays, parseISO } from "date-fns";

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
  commute_minutes?: number;
  recurrence_pattern?: string;
}

const Tasks = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

      const [tasksResult, profileResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (profileResult.error) throw profileResult.error;

      setTasks(tasksResult.data || []);
      setUserProfile(profileResult.data);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch tasks");
    } finally {
      setIsLoading(false);
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

  const getTasksForDate = (date: Date) => {
    const dateStart = startOfDay(date);
    const dateEnd = endOfDay(date);
    
    return tasks.filter(task => {
      if (task.scheduled_date) {
        const taskDate = parseISO(task.scheduled_date);
        return taskDate >= dateStart && taskDate <= dateEnd;
      }
      return false;
    }).sort((a, b) => {
      if (!a.scheduled_time || !b.scheduled_time) return 0;
      return a.scheduled_time.localeCompare(b.scheduled_time);
    });
  };

  const todayTasks = getTasksForDate(currentDate);
  const pendingTasks = todayTasks.filter(t => t.status === 'pending' || t.status === 'scheduled');
  const completedTasks = todayTasks.filter(t => t.status === 'completed');

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
              <p className="text-sm text-muted-foreground">Manage your tasks and schedule</p>
            </div>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="daily">Daily View</TabsTrigger>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{format(currentDate, 'EEEE, MMMM d, yyyy')}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">Loading tasks...</div>
            ) : todayTasks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <h3 className="text-lg font-semibold mb-2">No tasks for {format(currentDate, 'MMMM d')}</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a task or let AI schedule your pending tasks
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)}>Create Task</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {pendingTasks.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Pending / Scheduled</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pendingTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onDelete={handleDeleteTask}
                          onUpdateStatus={handleUpdateStatus}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {completedTasks.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Completed</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                      {completedTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onDelete={handleDeleteTask}
                          onUpdateStatus={handleUpdateStatus}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">Loading calendar...</div>
            ) : (
              <CalendarView
                tasks={tasks}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                onTaskClick={(task) => {
                  toast.info(`Task: ${task.title}`);
                }}
              />
            )}
          </TabsContent>
        </Tabs>

        <TaskCreationDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onTaskCreated={fetchTasks}
          userProfile={userProfile}
        />
      </main>
    </div>
  );
};

export default Tasks;