import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RecurringTaskDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteOne: () => void;
  onDeleteAll: () => void;
  taskTitle: string;
}

export function RecurringTaskDeleteDialog({
  open,
  onOpenChange,
  onDeleteOne,
  onDeleteAll,
  taskTitle,
}: RecurringTaskDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Recurring Task</AlertDialogTitle>
          <AlertDialogDescription>
            "{taskTitle}" is a recurring task. Do you want to delete just this occurrence or all occurrences in the sequence?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDeleteOne}
            className="bg-orange-500 hover:bg-orange-600"
          >
            Delete This One
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onDeleteAll}
            className="bg-destructive hover:bg-destructive/90"
          >
            Delete All Occurrences
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
