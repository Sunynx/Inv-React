'use client';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { Wrench, Clock, CheckCircle2, AlertCircle, Ban, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const STATUS_COLUMNS = [
  { id: 'เปิด', title: 'Open (เปิด)', color: 'border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/20' },
  { id: 'กำลังดำเนินการ', title: 'In Progress (กำลังดำเนินการ)', color: 'border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/20' },
  { id: 'รอะไหล่', title: 'Waiting Parts (รออะไหล่)', color: 'border-orange-200 bg-orange-50 dark:bg-orange-500/10 dark:border-orange-500/20' },
  { id: 'เสร็จสิ้น', title: 'Done (เสร็จสิ้น)', color: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/20' },
];

const priorityConfig: Record<string, string> = {
  'ต่ำ': 'bg-gray-100 text-gray-600',
  'ปกติ': 'bg-blue-100 text-blue-700',
  'สูง': 'bg-red-100 text-red-700',
  'เร่งด่วน': 'bg-red-200 text-red-800',
};

export default function TicketKanbanBoard({ 
  tickets, 
  onTicketClick, 
  onStatusChange 
}: { 
  tickets: any[], 
  onTicketClick: (ticket: any) => void,
  onStatusChange: () => void 
}) {
  const [columns, setColumns] = useState<Record<string, any[]>>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Group tickets by status
    const grouped = STATUS_COLUMNS.reduce((acc, col) => {
      acc[col.id] = tickets.filter(t => t.status === col.id);
      return acc;
    }, {} as Record<string, any[]>);
    
    setColumns(grouped);
  }, [tickets]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceCol = result.source.droppableId;
    const destCol = result.destination.droppableId;

    if (sourceCol === destCol && result.source.index === result.destination.index) return;

    // Optimistic UI update
    const sourceItems = Array.from(columns[sourceCol]);
    const destItems = sourceCol === destCol ? sourceItems : Array.from(columns[destCol]);
    
    const [movedItem] = sourceItems.splice(result.source.index, 1);
    movedItem.status = destCol;
    destItems.splice(result.destination.index, 0, movedItem);

    setColumns(prev => ({
      ...prev,
      [sourceCol]: sourceItems,
      [destCol]: destItems
    }));

    if (sourceCol !== destCol) {
      try {
        const { error } = await supabase
          .from('repair_tickets')
          .update({ status: destCol, updated_at: new Date().toISOString() })
          .eq('id', movedItem.id);
          
        if (error) throw error;
        toast.success(`Ticket moved to ${destCol}`);
        onStatusChange(); // trigger react-query invalidate
      } catch (err: any) {
        toast.error('Failed to move ticket');
        onStatusChange(); // Revert optimistic update
      }
    }
  };

  if (!isClient) return null; // Avoid hydration mismatch

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-280px)] min-h-[500px] hide-scrollbar">
        {STATUS_COLUMNS.map(column => (
          <div key={column.id} className={`flex flex-col w-80 shrink-0 rounded-xl border ${column.color} overflow-hidden flex-1`}>
            <div className="p-3 border-b border-black/5 dark:border-white/5 font-semibold text-sm flex justify-between items-center bg-black/5 dark:bg-white/5">
              <span>{column.title}</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-background dark:bg-slate-800">{columns[column.id]?.length || 0}</span>
            </div>
            
            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div 
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`flex-1 p-3 overflow-y-auto space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-black/5 dark:bg-white/5' : ''}`}
                >
                  {columns[column.id]?.map((ticket, index) => (
                    <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => onTicketClick(ticket)}
                          className={`bg-card border border-border shadow-sm rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-all ${
                            snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/20 rotate-2 z-50' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${priorityConfig[ticket.priority] || 'bg-muted text-muted-foreground'}`}>
                              {ticket.priority || 'ปกติ'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(ticket.created_at), 'MMM dd')}
                            </span>
                          </div>
                          
                          <h4 className="text-sm font-medium leading-snug line-clamp-2 mb-1 text-foreground">{ticket.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{ticket.description}</p>
                          
                          <div className="flex items-center justify-between pt-2 border-t border-border/50">
                            <span className="text-[11px] font-medium truncate pr-2 text-foreground/80">
                              💻 {ticket.assets?.name || 'Unknown Asset'}
                            </span>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
