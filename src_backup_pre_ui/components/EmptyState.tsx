import { FolderSearch } from "lucide-react";
import { Button } from "./ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-card text-card-foreground rounded-lg border border-dashed border-border shadow-sm transition-colors duration-300">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 transition-colors">
        <FolderSearch className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
