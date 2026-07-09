'use client';
import { LucideIcon, FolderSearch, Plus } from "lucide-react";
import { Button } from "./ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  iconClassName?: string;
}

export function EmptyState({ 
  title, 
  description, 
  actionLabel, 
  onAction, 
  icon: Icon = FolderSearch,
  iconClassName = 'text-muted-foreground'
}: EmptyStateProps) {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-card text-card-foreground rounded-lg border border-dashed border-border shadow-sm transition-colors duration-300">
      {/* Animated icon with rings */}
      <div className="relative mb-6">
        <div className="absolute inset-0 w-20 h-20 rounded-full bg-primary/5 animate-ping opacity-30" style={{ animationDuration: '3s' }} />
        <div className="absolute -inset-3 w-26 h-26 rounded-full bg-primary/5" />
        <div className="relative w-20 h-20 bg-gradient-to-br from-muted to-muted/50 rounded-full flex items-center justify-center border border-border/50 shadow-sm">
          <Icon className={`w-9 h-9 ${iconClassName}`} strokeWidth={1.5} />
        </div>
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">{description}</p>
      
      {actionLabel && onAction && (
        <Button 
          onClick={onAction} 
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all gap-2 rounded-xl px-6"
        >
          <Plus size={16} />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/** Compact version for inside tables */
export function EmptyStateCompact({ 
  title, 
  description, 
  actionLabel, 
  onAction, 
  icon: Icon = FolderSearch,
  iconClassName = 'text-muted-foreground'
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 bg-gradient-to-br from-muted to-muted/50 rounded-full flex items-center justify-center mb-4 border border-border/50">
        <Icon className={`w-7 h-7 ${iconClassName}`} strokeWidth={1.5} />
      </div>
      <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-xs mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="gap-1.5 rounded-lg text-xs">
          <Plus size={14} />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
