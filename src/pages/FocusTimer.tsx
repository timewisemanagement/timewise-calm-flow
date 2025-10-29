import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Play, Pause, RotateCcw, Coffee, Brain } from "lucide-react";

const FocusTimer = () => {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [time, setTime] = useState(25 * 60); // 25 minutes default
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [focusTime, setFocusTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    let interval: any = null;

    if (isActive && !isPaused && time > 0) {
      interval = setInterval(() => {
        setTime((time) => time - 1);
      }, 1000);
    } else if (time === 0) {
      handleTimerComplete();
    } else if (!isActive || isPaused) {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isActive, isPaused, time]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleTimerComplete = () => {
    setIsActive(false);
    if (mode === "focus") {
      toast.success("Focus session complete! Time for a break.");
      setMode("break");
      setTime(breakTime * 60);
    } else {
      toast.success("Break complete! Ready for another focus session?");
      setMode("focus");
      setTime(focusTime * 60);
    }
  };

  const handleStartPause = () => {
    if (!isActive) {
      setIsActive(true);
      setIsPaused(false);
    } else {
      setIsPaused(!isPaused);
    }
  };

  const handleReset = () => {
    setIsActive(false);
    setIsPaused(false);
    setTime(mode === "focus" ? focusTime * 60 : breakTime * 60);
  };

  const handleModeSwitch = (newMode: "focus" | "break") => {
    setMode(newMode);
    setIsActive(false);
    setIsPaused(false);
    setTime(newMode === "focus" ? focusTime * 60 : breakTime * 60);
  };

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  const totalTime = mode === "focus" ? focusTime * 60 : breakTime * 60;
  const progress = ((totalTime - time) / totalTime) * 100;

  return (
    <div className="min-h-screen grey p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Focus Timer</h1>
          <p className="text-muted-foreground">Use the Pomodoro Technique to boost productivity</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {mode === "focus" ? (
                    <>
                      <Brain className="h-5 w-5 text-primary" />
                      Focus Session
                    </>
                  ) : (
                    <>
                      <Coffee className="h-5 w-5 text-success" />
                      Break Time
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {mode === "focus" ? "Stay focused and eliminate distractions" : "Take a well-deserved break"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={mode === "focus" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleModeSwitch("focus")}
                  disabled={isActive}
                >
                  Focus
                </Button>
                <Button
                  variant={mode === "break" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleModeSwitch("break")}
                  disabled={isActive}
                >
                  Break
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Timer Display */}
            <div className="text-center space-y-4">
              <div className="text-8xl font-bold font-mono">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" onClick={handleStartPause} className="w-32">
                {!isActive || isPaused ? (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Start
                  </>
                ) : (
                  <>
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button size="lg" variant="outline" onClick={handleReset} className="w-32">
                <RotateCcw className="h-5 w-5 mr-2" />
                Reset
              </Button>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium mb-2 block">Focus Duration (min)</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFocusTime(Math.max(1, focusTime - 5))}
                    disabled={isActive}
                  >
                    -5
                  </Button>
                  <div className="flex-1 text-center py-2 border rounded">{focusTime}</div>
                  <Button variant="outline" size="sm" onClick={() => setFocusTime(focusTime + 5)} disabled={isActive}>
                    +5
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Break Duration (min)</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBreakTime(Math.max(1, breakTime - 5))}
                    disabled={isActive}
                  >
                    -5
                  </Button>
                  <div className="flex-1 text-center py-2 border rounded">{breakTime}</div>
                  <Button variant="outline" size="sm" onClick={() => setBreakTime(breakTime + 5)} disabled={isActive}>
                    +5
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Pomodoro Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Focus for 25 minutes, then take a 5-minute break</li>
              <li>• After 4 focus sessions, take a longer 15-30 minute break</li>
              <li>• Eliminate all distractions during focus time</li>
              <li>• Use breaks to stretch, hydrate, and rest your eyes</li>
              <li>• Track your completed sessions to build momentum</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FocusTimer;
