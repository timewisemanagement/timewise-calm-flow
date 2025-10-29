import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MiniCalendar } from "@/components/MiniCalendar";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, startOfDay, endOfDay } from "date-fns";
import { Calendar, Clock, ChevronRight, TrendingUp, Target, Zap } from "lucide-react";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  start_time: string | null;
  end_time: string | null;
  color?: string;
  duration_minutes: number;
}

const Home = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [tasksResult, profileResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("scheduled_date", { ascending: true })
          .order("scheduled_time", { ascending: true }),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (profileResult.error) throw profileResult.error;

      setTasks(tasksResult.data || []);
      setUserProfile(profileResult.data);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const todayTasks = tasks.filter((task) => {
    if (!task.scheduled_date) return false;
    const taskDate = parseISO(task.scheduled_date);
    return isSameDay(taskDate, new Date());
  });

  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      if (!task.scheduled_date) return false;
      const taskDate = parseISO(task.scheduled_date);
      return isSameDay(taskDate, day);
    });
  };

  const completedToday = todayTasks.filter((t) => t.status === "completed").length;
  const totalToday = todayTasks.length;
  const completionRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const upcomingTasks = tasks
    .filter((t) => t.scheduled_date && new Date(t.scheduled_date) >= startOfDay(new Date()) && t.status !== "completed")
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-hero p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Greeting */}
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {getGreeting()}, {userProfile?.first_name || "there"}!
          </h1>
          <p className="text-xl text-foreground/80">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Today's Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{completionRate}%</div>
              <p className="text-sm text-muted-foreground">
                {completedToday} of {totalToday} tasks completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {
                  tasks.filter(
                    (t) =>
                      t.status === "completed" &&
                      t.scheduled_date &&
                      new Date(t.scheduled_date) >= weekStart &&
                      new Date(t.scheduled_date) <= weekEnd,
                  ).length
                }
              </div>
              <p className="text-sm text-muted-foreground">tasks completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{upcomingTasks.length}</div>
              <p className="text-sm text-muted-foreground">tasks pending</p>
            </CardContent>
          </Card>
        </div>

        {/* Week Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Week</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/schedule")}>
                View Full Schedule <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <CardDescription>Tasks scheduled for this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const dayTasks = getTasksForDay(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className={`p-3 rounded-lg border ${isToday ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <div className="text-center mb-2">
                      <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                      <div className={`text-lg font-semibold ${isToday ? "text-primary" : ""}`}>{format(day, "d")}</div>
                    </div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className="text-xs truncate px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: task.color || "#3b82f6",
                            color: "white",
                          }}
                          title={task.title}
                        >
                          {task.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-xs text-center text-muted-foreground">+{dayTasks.length - 3}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Today's Tasks
              </CardTitle>
              <CardDescription>
                {todayTasks.length === 0 ? "No tasks scheduled" : `${todayTasks.length} tasks today`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No tasks for today. Enjoy your free time!</p>
                    <Button variant="outline" className="mt-4" onClick={() => navigate("/schedule")}>
                      Add a Task
                    </Button>
                  </div>
                ) : (
                  todayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => navigate("/schedule")}
                    >
                      <div
                        className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: task.color || "#3b82f6" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${task.status === "completed" ? "line-through opacity-60" : ""}`}>
                          {task.title}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {task.start_time && task.end_time ? (
                            <span>
                              {task.start_time} - {task.end_time}
                            </span>
                          ) : (
                            task.scheduled_time && <span>{task.scheduled_time}</span>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Calendar Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Calendar
                </CardTitle>
              </div>
              <CardDescription>Click to view full calendar</CardDescription>
            </CardHeader>
            <CardContent>
              <MiniCalendar
                tasks={tasks}
                currentMonth={new Date()}
                onClick={() => navigate("/schedule?view=calendar")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Home;
