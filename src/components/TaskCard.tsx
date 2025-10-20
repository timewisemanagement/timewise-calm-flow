import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Tag, Trash2, Check } from "lucide-react";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    duration_minutes: number;
    priority: string;
    tags: string[];
    status: string;
  };
  onDelete: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: string) => void;
}

const TaskCard = ({ task, onDelete, onUpdateStatus }: TaskCardProps) => {
  const priorityColors = {
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <Card className="hover:shadow-lg transition-all">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">{task.title}</CardTitle>
          <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
            {task.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
        )}
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{task.duration_minutes} minutes</span>
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-muted-foreground" />
            {task.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {task.status !== "completed" && (
          <Button
            size="sm"
            variant="default"
            onClick={() => onUpdateStatus(task.id, "completed")}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-1" />
            Complete
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default TaskCard;