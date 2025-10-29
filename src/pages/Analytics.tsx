import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, parseISO, isSameDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
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
        .eq("user_id", user.id);

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch tasks");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalTimeSpent = tasks
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.duration_minutes, 0);

  // Priority breakdown
  const priorityData = [
    { name: 'High', value: tasks.filter(t => t.priority === 'high').length, color: 'hsl(var(--destructive))' },
    { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, color: 'hsl(var(--warning))' },
    { name: 'Low', value: tasks.filter(t => t.priority === 'low').length, color: 'hsl(var(--success))' },
  ];

  // Weekly completion trend (last 4 weeks)
  const weeklyData = [];
  for (let i = 3; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(new Date(), i));
    const weekEnd = endOfWeek(subWeeks(new Date(), i));
    const weekTasks = tasks.filter(t => {
      if (!t.scheduled_date) return false;
      const taskDate = parseISO(t.scheduled_date);
      return taskDate >= weekStart && taskDate <= weekEnd;
    });
    weeklyData.push({
      week: format(weekStart, 'MMM d'),
      completed: weekTasks.filter(t => t.status === 'completed').length,
      total: weekTasks.length,
    });
  }

  // Daily productivity (this week)
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const dailyData = weekDays.map(day => {
    const dayTasks = tasks.filter(t => {
      if (!t.scheduled_date) return false;
      const taskDate = parseISO(t.scheduled_date);
      return isSameDay(taskDate, day);
    });
    return {
      day: format(day, 'EEE'),
      completed: dayTasks.filter(t => t.status === 'completed').length,
      pending: dayTasks.filter(t => t.status !== 'completed').length,
    };
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading analytics...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-hero p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">Track your productivity and progress</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Total Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalTasks}</div>
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
              <div className="text-3xl font-bold">{completedTasks}</div>
              <p className="text-sm text-muted-foreground">{completionRate}% completion</p>
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
              <div className="text-3xl font-bold">{Math.round(totalTimeSpent / 60)}h</div>
              <p className="text-sm text-muted-foreground">{totalTimeSpent} minutes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-warning" />
                Avg per Day
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {totalTasks > 0 ? Math.round(totalTasks / 30) : 0}
              </div>
              <p className="text-sm text-muted-foreground">tasks/day</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Completion Trend</CardTitle>
              <CardDescription>Last 4 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="completed" stroke="hsl(var(--success))" strokeWidth={2} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Tasks by Priority</CardTitle>
              <CardDescription>Distribution of task priorities</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Daily Productivity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>This Week's Productivity</CardTitle>
              <CardDescription>Daily task completion</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
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
        </div>
      </div>
    </div>
  );
};

export default Analytics;
