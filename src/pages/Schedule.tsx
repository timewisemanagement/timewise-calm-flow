import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { TaskCreationDialog } from "@/components/TaskCreationDialog";
import { TaskDetailsDialog } from "@/components/TaskDetailsDialog";
import { TaskEditDialog } from "@/components/TaskEditDialog";
import { CalendarView } from "@/components/CalendarView";
import { TimelineView } from "@/components/TimelineView";
import { Celebration } from "@/components/Celebration";
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
  start_time: string | null;
  end_time: string | null;
  commute_minutes?: number;
  recurrence_pattern?: string;
  color?: string;
}

const Schedule = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchTasks();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchTasks = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [tasksResult, profileResult] = await Promise.all([
        supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
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
      const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
      if (error) throw error;
      if (status === "completed") {
        toast.success("Task completed! 🎉");
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 3000);
      } else {
        toast.success("Task updated");
      }
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    }
  };

  const handleEditTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
      if (error) throw error;
      toast.success("Task updated successfully");
      fetchTasks();
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getTasksForDate = (date: Date) => {
    const dateStart = startOfDay(date);
    const dateEnd = endOfDay(date);

    return tasks
      .filter((task) => {
        if (task.scheduled_date) {
          const taskDate = parseISO(task.scheduled_date);
          return taskDate >= dateStart && taskDate <= dateEnd;
        }
        return false;
      })
      .sort((a, b) => {
        if (!a.scheduled_time || !b.scheduled_time) return 0;
        return a.scheduled_time.localeCompare(b.scheduled_time);
      });
  };

  const todayTasks = getTasksForDate(currentDate);
  const pendingTasks = todayTasks.filter((t) => t.status === "pending" || t.status === "scheduled");
  const completedTasks = todayTasks.filter((t) => t.status === "completed");

  return (
    <div className="min-h-screen grey">
      <Celebration trigger={celebrate} />
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Schedule</h1>
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
              <h2 className="text-2xl font-bold">{format(currentDate, "EEEE, MMMM d, yyyy")}</h2>
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
            ) : (
              <TimelineView
                tasks={todayTasks}
                onDeleteTask={handleDeleteTask}
                onUpdateStatus={handleUpdateStatus}
                onEditTask={(task) => {
                  setSelectedTask(task);
                  setShowEditDialog(true);
                }}
                onTaskClick={(task) => {
                  setSelectedTask(task);
                  setShowDetailsDialog(true);
                }}
                wakeTime={userProfile?.wake_time || "08:00"}
                bedTime={userProfile?.bed_time || "22:00"}
                downtimeStart={userProfile?.downtime_start}
                downtimeEnd={userProfile?.downtime_end}
              />
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
                  setSelectedTask(task);
                  setShowDetailsDialog(true);
                }}
                onDeleteTask={handleDeleteTask}
                onUpdateStatus={handleUpdateStatus}
                onEditTask={(task) => {
                  setSelectedTask(task);
                  setShowDetailsDialog(true);
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

        <TaskDetailsDialog
          task={selectedTask}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          onEdit={(task) => {
            setShowDetailsDialog(false);
            setSelectedTask(task);
            setShowEditDialog(true);
          }}
          onDelete={handleDeleteTask}
          onUpdateStatus={handleUpdateStatus}
        />

        <TaskEditDialog
          task={selectedTask}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSave={handleEditTask}
        />
      </main>
    </div>
  );
};

export default Schedule;
