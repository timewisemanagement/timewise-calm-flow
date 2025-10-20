import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Sunrise, Sunset, Clock } from "lucide-react";

const Onboarding = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [focusPreference, setFocusPreference] = useState<"morning" | "evening" | "flexible">("flexible");
  const [idealFocusDuration, setIdealFocusDuration] = useState([60]);

  const handleComplete = async () => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not found");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          focus_preference: focusPreference,
          ideal_focus_duration: idealFocusDuration[0],
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Preferences saved!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to save preferences");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Welcome to Timewise!</CardTitle>
          <CardDescription className="text-base">
            Let's personalize your experience to maximize your productivity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Focus Preference */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">When do you focus best?</Label>
            <RadioGroup value={focusPreference} onValueChange={(value: any) => setFocusPreference(value)}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className={`cursor-pointer transition-all ${focusPreference === "morning" ? "ring-2 ring-primary" : ""}`}>
                  <CardContent className="p-6 text-center space-y-2">
                    <RadioGroupItem value="morning" id="morning" className="sr-only" />
                    <Label htmlFor="morning" className="cursor-pointer">
                      <Sunrise className="w-12 h-12 mx-auto text-primary mb-2" />
                      <div className="font-semibold">Morning Person</div>
                      <div className="text-sm text-muted-foreground">Peak hours: 6AM - 12PM</div>
                    </Label>
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-all ${focusPreference === "evening" ? "ring-2 ring-primary" : ""}`}>
                  <CardContent className="p-6 text-center space-y-2">
                    <RadioGroupItem value="evening" id="evening" className="sr-only" />
                    <Label htmlFor="evening" className="cursor-pointer">
                      <Sunset className="w-12 h-12 mx-auto text-accent mb-2" />
                      <div className="font-semibold">Evening Person</div>
                      <div className="text-sm text-muted-foreground">Peak hours: 2PM - 8PM</div>
                    </Label>
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-all ${focusPreference === "flexible" ? "ring-2 ring-primary" : ""}`}>
                  <CardContent className="p-6 text-center space-y-2">
                    <RadioGroupItem value="flexible" id="flexible" className="sr-only" />
                    <Label htmlFor="flexible" className="cursor-pointer">
                      <Clock className="w-12 h-12 mx-auto text-success mb-2" />
                      <div className="font-semibold">Flexible</div>
                      <div className="text-sm text-muted-foreground">Adapt to my schedule</div>
                    </Label>
                  </CardContent>
                </Card>
              </div>
            </RadioGroup>
          </div>

          {/* Ideal Focus Duration */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Ideal focus session duration</Label>
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-4xl font-bold text-primary">{idealFocusDuration[0]}</span>
                <span className="text-xl text-muted-foreground ml-2">minutes</span>
              </div>
              <Slider
                value={idealFocusDuration}
                onValueChange={setIdealFocusDuration}
                min={15}
                max={180}
                step={15}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>15 min</span>
                <span>90 min</span>
                <span>180 min</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleComplete}
            disabled={isLoading}
            className="w-full bg-gradient-primary text-lg py-6"
          >
            {isLoading ? "Saving..." : "Complete Setup"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;