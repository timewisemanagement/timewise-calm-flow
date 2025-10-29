import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subWeeks,
  subMonths,
  parseISO,
  isSameDay,
} from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, CheckCircle2, Clock, Target } from "lucide-react";

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  scheduled_date: string | null;
  duration_minutes: number;
  created_at: string;
}

const Analytics = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

      const { data, error } = await supabase.from("tasks").select("*").eq("user_id", user.id);

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const getWeeklyStats = () => {
    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(new Date());
    const weekTasks = tasks.filter((t) => {
      if (!t.scheduled_date) return false;
      const taskDate = parseISO(t.scheduled_date);
      return taskDate >= weekStart && taskDate <= weekEnd;
    });

    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const dailyData = weekDays.map((day) => {
      const dayTasks = weekTasks.filter((t) => {
        const taskDate = parseISO(t.scheduled_date!);
        return isSameDay(taskDate, day);
      });
      return {
        day: format(day, "EEE"),
        completed: dayTasks.filter((t) => t.status === "completed").length,
        pending: dayTasks.filter((t) => t.status !== "completed").length,
      };
    });

    return {
      total: weekTasks.length,
      completed: weekTasks.filter((t) => t.status === "completed").length,
      timeSpent: weekTasks.filter((t) => t.status === "completed").reduce((sum, t) => sum + t.duration_minutes, 0),
      dailyData,
    };
  };

  const getMonthlyStats = () => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const monthTasks = tasks.filter((t) => {
      if (!t.scheduled_date) return false;
      const taskDate = parseISO(t.scheduled_date);
      return taskDate >= monthStart && taskDate <= monthEnd;
    });

    const weeklyData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i));
      const weekEnd = endOfWeek(subWeeks(new Date(), i));
      const weekTasks = monthTasks.filter((t) => {
        const taskDate = parseISO(t.scheduled_date!);
        return taskDate >= weekStart && taskDate <= weekEnd;
      });
      weeklyData.push({
        week: format(weekStart, "MMM d"),
        completed: weekTasks.filter((t) => t.status === "completed").length,
        pending: weekTasks.filter((t) => t.status !== "completed").length,
      });
    }

    return {
      total: monthTasks.length,
      completed: monthTasks.filter((t) => t.status === "completed").length,
      timeSpent: monthTasks.filter((t) => t.status === "completed").reduce((sum, t) => sum + t.duration_minutes, 0),
      weeklyData,
    };
  };

  const getAllTimeStats = () => {
    const completed = tasks.filter((t) => t.status === "completed").length;
    const timeSpent = tasks.filter((t) => t.status === "completed").reduce((sum, t) => sum + t.duration_minutes, 0);

    const priorityData = [
      { name: "High", value: tasks.filter((t) => t.priority === "high").length, color: "hsl(var(--destructive))" },
      { name: "Medium", value: tasks.filter((t) => t.priority === "medium").length, color: "hsl(var(--warning))" },
      { name: "Low", value: tasks.filter((t) => t.priority === "low").length, color: "hsl(var(--success))" },
    ];

    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(subMonths(new Date(), i));
      const monthTasks = tasks.filter((t) => {
        if (!t.scheduled_date) return false;
        const taskDate = parseISO(t.scheduled_date);
        return taskDate >= monthStart && taskDate <= monthEnd;
      });
      monthlyData.push({
        month: format(monthStart, "MMM"),
        completed: monthTasks.filter((t) => t.status === "completed").length,
        total: monthTasks.length,
      });
    }

    return {
      total: tasks.length,
      completed,
      timeSpent,
      priorityData,
      monthlyData,
    };
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading analytics...</div>;
  }

  const weeklyStats = getWeeklyStats();
  const monthlyStats = getMonthlyStats();
  const allTimeStats = getAllTimeStats();

  return (
    <div className="min-h-screen bg-gradient-lighter p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">Track your productivity and progress</p>
        </div>

        <Tabs defaultValue="weekly" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="all-time">All Time</TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Total Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{weeklyStats.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{weeklyStats.completed}</div>
                  <p className="text-sm text-muted-foreground">
                    {weeklyStats.total > 0 ? Math.round((weeklyStats.completed / weeklyStats.total) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Time Spent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{Math.round(weeklyStats.timeSpent / 60)}h</div>
                  <p className="text-sm text-muted-foreground">{weeklyStats.timeSpent} min</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-warning" />
                    Daily Avg
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{Math.round(weeklyStats.completed / 7)}</div>
                  <p className="text-sm text-muted-foreground">tasks/day</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>This Week's Productivity</CardTitle>
                <CardDescription>Daily task completion</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklyStats.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completed" fill="hsl(var(--success))" name="Completed" />
                    <Bar dataKey="pending" fill="hsl(var(--muted))" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Total Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{monthlyStats.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{monthlyStats.completed}</div>
                  <p className="text-sm text-muted-foreground">
                    {monthlyStats.total > 0 ? Math.round((monthlyStats.completed / monthlyStats.total) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Time Spent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{Math.round(monthlyStats.timeSpent / 60)}h</div>
                  <p className="text-sm text-muted-foreground">{monthlyStats.timeSpent} min</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-warning" />
                    Daily Avg
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{Math.round(monthlyStats.completed / 30)}</div>
                  <p className="text-sm text-muted-foreground">tasks/day</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Weekly Trend</CardTitle>
                <CardDescription>Last 4 weeks</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyStats.weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completed" fill="hsl(var(--success))" name="Completed" />
                    <Bar dataKey="pending" fill="hsl(var(--muted))" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all-time" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Total Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{allTimeStats.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{allTimeStats.completed}</div>
                  <p className="text-sm text-muted-foreground">
                    {allTimeStats.total > 0 ? Math.round((allTimeStats.completed / allTimeStats.total) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Total Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{Math.round(allTimeStats.timeSpent / 60)}h</div>
                  <p className="text-sm text-muted-foreground">{allTimeStats.timeSpent} min</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-warning" />
                    Completion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {allTimeStats.total > 0 ? Math.round((allTimeStats.completed / allTimeStats.total) * 100) : 0}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Trend</CardTitle>
                  <CardDescription>Last 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={allTimeStats.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="completed" fill="hsl(var(--success))" name="Completed" />
                      <Bar dataKey="total" fill="hsl(var(--primary))" name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tasks by Priority</CardTitle>
                  <CardDescription>Distribution across all tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={allTimeStats.priorityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {allTimeStats.priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analytics;
