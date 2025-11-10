import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, User, Clock, Moon, Sun, Coffee, Trash2, Book } from "lucide-react";
import { DeletedTasksDialog } from "@/components/DeletedTasksDialog";

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
  wake_time: string;
  bed_time: string;
  downtime_start: string | null;
  downtime_end: string | null;
  focus_preference: string | null;
  ideal_focus_duration: number;
  canvas_url: string | null;
  canvas_connected: boolean;
  canvas_last_sync: string | null;
  google_calendar_connected: boolean;
  google_calendar_last_sync: string | null;
  google_calendar_email: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeletedTasks, setShowDeletedTasks] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    first_name: "",
    last_name: "",
    email: "",
    wake_time: "08:00",
    bed_time: "22:00",
    downtime_start: null,
    downtime_end: null,
    focus_preference: null,
    ideal_focus_duration: 60,
    canvas_url: null,
    canvas_connected: false,
    canvas_last_sync: null,
    google_calendar_connected: false,
    google_calendar_last_sync: null,
    google_calendar_email: null,
  });

  useEffect(() => {
    checkAuth();
    fetchProfile();
    
    // Check if returning from Google Calendar OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_calendar') === 'connected') {
      toast.success('Google Calendar connected successfully!');
      // Remove the query parameter
      window.history.replaceState({}, '', '/profile');
      // Refresh profile to get updated connection status
      setTimeout(() => fetchProfile(), 500);
    }
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      if (error) throw error;

      if (data) {
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          wake_time: data.wake_time || "08:00",
          bed_time: data.bed_time || "22:00",
          downtime_start: data.downtime_start,
          downtime_end: data.downtime_end,
          focus_preference: data.focus_preference,
          ideal_focus_duration: data.ideal_focus_duration || 60,
          canvas_url: data.canvas_url || null,
          canvas_connected: data.canvas_connected || false,
          canvas_last_sync: data.canvas_last_sync || null,
          google_calendar_connected: data.google_calendar_connected || false,
          google_calendar_last_sync: data.google_calendar_last_sync || null,
          google_calendar_email: data.google_calendar_email || null,
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          wake_time: profile.wake_time,
          bed_time: profile.bed_time,
          downtime_start: profile.downtime_start,
          downtime_end: profile.downtime_end,
          focus_preference: profile.focus_preference,
          ideal_focus_duration: profile.ideal_focus_duration,
          canvas_url: profile.canvas_url,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCanvasSync = async () => {
    if (!profile.canvas_url) {
      toast.error('Please enter your Canvas URL first and save');
      return;
    }

    try {
      setIsSyncing(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('sync-canvas', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast.success(data.message || 'Canvas synced successfully');
      fetchProfile(); // Refresh to show updated sync time
    } catch (error: any) {
      console.error('Canvas sync error:', error);
      toast.error(error.message || 'Failed to sync Canvas');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleCalendarConnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to connect Google Calendar');
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('google-calendar-oauth', {
        body: { 
          action: 'authorize', 
          userId: user.id,
          appOrigin: window.location.origin
        },
      });

      if (error) throw error;

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error: any) {
      console.error('Google Calendar connect error:', error);
      toast.error(error.message || 'Failed to connect Google Calendar');
    }
  };

  const handleGoogleCalendarSync = async () => {
    try {
      setIsSyncingGoogle(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast.success(data.message || 'Google Calendar synced successfully');
      fetchProfile(); // Refresh to show updated sync time
    } catch (error: any) {
      console.error('Google Calendar sync error:', error);
      toast.error(error.message || 'Failed to sync Google Calendar');
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  const handleGoogleCalendarDisconnect = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          google_calendar_connected: false,
          google_calendar_access_token: null,
          google_calendar_refresh_token: null,
          google_calendar_token_expires_at: null,
          google_calendar_last_sync: null,
          google_calendar_email: null,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Google Calendar disconnected");
      fetchProfile();
    } catch (error: any) {
      console.error('Google Calendar disconnect error:', error);
      toast.error(error.message || 'Failed to disconnect Google Calendar');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grey">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Profile Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your preferences</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-8">
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Basic Information
              </CardTitle>
              <CardDescription>Your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={profile.last_name}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="your.email@example.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Sleep Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="w-5 h-5" />
                Sleep Schedule
              </CardTitle>
              <CardDescription>When do you typically wake up and go to bed?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wake_time" className="flex items-center gap-2">
                    <Sun className="w-4 h-4" />
                    Wake Time
                  </Label>
                  <Input
                    id="wake_time"
                    type="time"
                    value={profile.wake_time}
                    onChange={(e) => setProfile({ ...profile, wake_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bed_time" className="flex items-center gap-2">
                    <Moon className="w-4 h-4" />
                    Bed Time
                  </Label>
                  <Input
                    id="bed_time"
                    type="time"
                    value={profile.bed_time}
                    onChange={(e) => setProfile({ ...profile, bed_time: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Downtime */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coffee className="w-5 h-5" />
                Downtime (Optional)
              </CardTitle>
              <CardDescription>Set a time range during the day when you don't want tasks scheduled</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="downtime_start">Downtime Start</Label>
                  <Input
                    id="downtime_start"
                    type="time"
                    value={profile.downtime_start || ""}
                    onChange={(e) => setProfile({ ...profile, downtime_start: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="downtime_end">Downtime End</Label>
                  <Input
                    id="downtime_end"
                    type="time"
                    value={profile.downtime_end || ""}
                    onChange={(e) => setProfile({ ...profile, downtime_end: e.target.value || null })}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Note: Manually scheduled tasks will override downtime preferences
              </p>
            </CardContent>
          </Card>

          {/* Focus Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Focus Preferences
              </CardTitle>
              <CardDescription>Help AI understand your work style</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ideal_focus_duration">Ideal Focus Duration (minutes)</Label>
                <Input
                  id="ideal_focus_duration"
                  type="number"
                  min="15"
                  max="240"
                  value={profile.ideal_focus_duration}
                  onChange={(e) => setProfile({ ...profile, ideal_focus_duration: parseInt(e.target.value) || 60 })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Canvas Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Book className="w-5 h-5" />
                Canvas Integration
              </CardTitle>
              <CardDescription>Connect your Canvas account to import homework assignments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="canvas_url">Canvas URL</Label>
                <Input
                  id="canvas_url"
                  value={profile.canvas_url || ""}
                  onChange={(e) => setProfile({ ...profile, canvas_url: e.target.value })}
                  placeholder="https://canvas.instructure.com"
                />
                <p className="text-sm text-muted-foreground">
                  Enter your Canvas instance URL (e.g., https://canvas.instructure.com)
                </p>
              </div>
              {profile.canvas_connected && profile.canvas_last_sync && (
                <p className="text-sm text-muted-foreground">
                  Last synced: {new Date(profile.canvas_last_sync).toLocaleString()}
                </p>
              )}
              <Button 
                onClick={handleCanvasSync} 
                disabled={isSyncing || !profile.canvas_url}
                variant="outline" 
                className="w-full"
              >
                {isSyncing ? "Syncing..." : profile.canvas_connected ? "Sync Canvas" : "Connect Canvas"}
              </Button>
            </CardContent>
          </Card>

          {/* Google Calendar Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Google Calendar Integration
              </CardTitle>
              <CardDescription>Connect your Google Calendar to import events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.google_calendar_connected ? (
                <>
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="font-medium">Connected</span>
                    </div>
                    {profile.google_calendar_email && (
                      <p className="text-sm text-muted-foreground">
                        {profile.google_calendar_email}
                      </p>
                    )}
                    {profile.google_calendar_last_sync && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {new Date(profile.google_calendar_last_sync).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleGoogleCalendarSync} 
                      disabled={isSyncingGoogle}
                      variant="outline" 
                      className="flex-1"
                    >
                      {isSyncingGoogle ? "Syncing..." : "Sync Calendar"}
                    </Button>
                    <Button 
                      onClick={handleGoogleCalendarDisconnect} 
                      variant="destructive"
                      size="icon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <Button 
                  onClick={handleGoogleCalendarConnect} 
                  variant="outline" 
                  className="w-full"
                >
                  Connect Google Calendar
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Task History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Task History
              </CardTitle>
              <CardDescription>View and restore deleted tasks (auto-purged after 30 days)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowDeletedTasks(true)} variant="outline" className="w-full">
                View Deleted Tasks
              </Button>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </main>

      <DeletedTasksDialog
        open={showDeletedTasks}
        onOpenChange={setShowDeletedTasks}
        onTaskRestored={fetchProfile}
      />
    </div>
  );
};

export default Profile;
