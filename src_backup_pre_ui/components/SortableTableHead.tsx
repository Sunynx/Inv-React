import { TableHead } from "@/components/ui/table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface SortableTableHeadProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  currentDirection: 'asc' | 'desc' | null;
  onRequestSort: (key: string) => void;
  className?: string;
}

export function SortableTableHead({ label, sortKey, currentSortKey, currentDirection, onRequestSort, className }: SortableTableHeadProps) {
  const isActive = currentSortKey === sortKey;
  
  return (
    <TableHead 
      className={`cursor-pointer hover:bg-muted/50 transition-colors select-none ${className || ''}`}
      onClick={() => onRequestSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${className?.includes('text-right') ? 'justify-end' : ''}`}>
        {label}
        <span className="inline-flex flex-col opacity-50 ml-1">
          {isActive && currentDirection === 'asc' ? (
            <ChevronUp size={14} className="text-primary opacity-100" />
          ) : isActive && currentDirection === 'desc' ? (
            <ChevronDown size={14} className="text-primary opacity-100" />
          ) : (
            <ChevronsUpDown size={14} className="hover:opacity-100" />
          )}
        </span>
      </div>
    </TableHead>
  );
}
