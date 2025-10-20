import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Star, Check, X, PauseCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface SuggestionCardProps {
  suggestion: {
    id: string;
    suggested_start: string;
    duration_minutes: number;
    score: number;
    task: {
      title: string;
      description: string;
      priority: string;
      tags: string[];
    };
  };
  onFeedback: (suggestionId: string, outcome: string) => void;
}

const SuggestionCard = ({ suggestion, onFeedback }: SuggestionCardProps) => {
  const startTime = parseISO(suggestion.suggested_start);
  const priorityColors = {
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{suggestion.task.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={priorityColors[suggestion.task.priority as keyof typeof priorityColors]}>
              {suggestion.task.priority}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" />
              {suggestion.score.toFixed(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestion.task.description && (
          <p className="text-sm text-muted-foreground">{suggestion.task.description}</p>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(startTime, "EEE, MMM d")}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              {format(startTime, "h:mm a")} ({suggestion.duration_minutes} min)
            </span>
          </div>
        </div>

        {suggestion.task.tags && suggestion.task.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {suggestion.task.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          size="sm"
          onClick={() => onFeedback(suggestion.id, "accepted")}
          className="flex-1 bg-success hover:bg-success/90"
        >
          <Check className="w-4 h-4 mr-1" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onFeedback(suggestion.id, "snoozed")}
        >
          <PauseCircle className="w-4 h-4 mr-1" />
          Snooze
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onFeedback(suggestion.id, "dismissed")}
        >
          <X className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SuggestionCard;