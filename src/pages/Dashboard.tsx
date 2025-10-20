import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Calendar, Clock, LogOut, ListTodo, Sparkles } from "lucide-react";
import SuggestionCard from "@/components/SuggestionCard";
import { Skeleton } from "@/components/ui/skeleton";

interface Suggestion {
  id: string;
  task_id: string;
  suggested_start: string;
  duration_minutes: number;
  score: number;
  outcome: string | null;
  task: {
    title: string;
    description: string;
    priority: string;
    tags: string[];
  };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setUserProfile(profile);

      // Fetch suggestions with task details
      const { data: suggestionsData, error } = await supabase
        .from("suggestions")
        .select(`
          *,
          task:tasks(title, description, priority, tags)
        `)
        .eq("user_id", user.id)
        .is("outcome", null)
        .order("score", { ascending: false })
        .limit(5);

      if (error) throw error;
      setSuggestions(suggestionsData || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  const generateSuggestions = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('generate-suggestions', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      
      toast.success(data.message || 'Suggestions generated!');
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionFeedback = async (suggestionId: string, outcome: string) => {
    try {
      const { error } = await supabase
        .from("suggestions")
        .update({ outcome })
        .eq("id", suggestionId);

      if (error) throw error;

      toast.success(
        outcome === "accepted"
          ? "Task scheduled!"
          : outcome === "snoozed"
          ? "Suggestion snoozed"
          : "Suggestion dismissed"
      );

      // Refresh suggestions
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update suggestion");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-16 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Clock className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Timewise</h1>
              <p className="text-sm text-muted-foreground">
                Welcome back, {userProfile?.display_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate("/tasks")}>
              <ListTodo className="w-4 h-4 mr-2" />
              Tasks
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Focus Preference</CardTitle>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {userProfile?.focus_preference || "Not set"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your optimal working hours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ideal Session</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userProfile?.ideal_focus_duration || 60} min
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Perfect focus duration
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Suggestions</CardTitle>
              <Sparkles className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{suggestions.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                AI-powered recommendations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Suggestions Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Today's Suggestions</h2>
              <p className="text-muted-foreground">
                Smart scheduling recommendations based on your calendar
              </p>
            </div>
            <Button onClick={generateSuggestions} disabled={isLoading}>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate AI Suggestions
            </Button>
          </div>

          {suggestions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No suggestions yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create some tasks to get personalized scheduling suggestions
                </p>
                <Button onClick={() => navigate("/tasks")}>Create Your First Task</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onFeedback={handleSuggestionFeedback}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;