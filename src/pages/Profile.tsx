import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, User, Clock, Moon, Sun, Coffee } from "lucide-react";

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
}

const Profile = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
  });

  useEffect(() => {
    checkAuth();
    fetchProfile();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

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
      const { data: { user } } = await supabase.auth.getUser();
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
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
              <CardDescription>
                Set a time range during the day when you don't want tasks scheduled
              </CardDescription>
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

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
