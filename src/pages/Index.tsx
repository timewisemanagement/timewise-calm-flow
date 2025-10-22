import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Target, Sparkles, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to main page if already authenticated
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          navigate("/");
        }
      });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-20 md:py-32">
          <div className="text-center space-y-8">
            <div className="inline-block p-4 bg-gradient-primary rounded-2xl shadow-xl mb-4">
              <Clock className="w-16 h-16 text-primary-foreground" />
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Timewise
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Smart scheduling that learns from your calendar and suggests the perfect time for every task
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <Button
                size="lg"
                className="bg-gradient-primary text-lg px-8 py-6"
                onClick={() => navigate("/auth")}
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Intelligent Scheduling Made Simple
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-card hover:shadow-xl transition-all">
            <div className="p-3 bg-primary/10 rounded-xl w-fit mb-4">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Calendar Integration</h3>
            <p className="text-muted-foreground">
              Seamlessly syncs with Google Calendar to understand your availability and commitments
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-card hover:shadow-xl transition-all">
            <div className="p-3 bg-accent/10 rounded-xl w-fit mb-4">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-3">AI-Powered Suggestions</h3>
            <p className="text-muted-foreground">
              Smart algorithms find the optimal time slots based on your preferences and work patterns
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-card hover:shadow-xl transition-all">
            <div className="p-3 bg-success/10 rounded-xl w-fit mb-4">
              <Target className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Adaptive Learning</h3>
            <p className="text-muted-foreground">
              Learns from your feedback to continuously improve scheduling recommendations
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="bg-gradient-primary rounded-3xl p-12 text-center shadow-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Ready to optimize your time?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8">
            Join Timewise today and let AI handle your scheduling
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="text-lg px-8 py-6"
            onClick={() => navigate("/auth")}
          >
            Start Free
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 Timewise. Smart scheduling for productive people.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
