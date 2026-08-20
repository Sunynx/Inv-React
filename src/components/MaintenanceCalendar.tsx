import React, { useState } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays,
  parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Wrench, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MaintenanceCalendarProps {
  records: any[];
  onRecordClick: (record: any) => void;
  onDayClick?: (date: Date) => void;
}

export default function MaintenanceCalendar({ records, onRecordClick, onDayClick }: MaintenanceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday} className="mr-2 h-8">Today</Button>
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth, { weekStartsOn: 1 }); // Start Monday
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-semibold text-sm text-slate-500 py-2 border-b border-slate-200 dark:border-slate-800">
          {format(addDays(startDate, i), 'EEE')}
        </div>
      );
    }
    return <div className="grid grid-cols-7 mb-2">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        
        // Find records for this day
        const dayRecords = records.filter(r => r.next_due_at && isSameDay(parseISO(r.next_due_at), cloneDay));

        days.push(
          <div
            key={day.toISOString()}
            onClick={() => onDayClick && onDayClick(cloneDay)}
            className={`min-h-[120px] p-2 border-r border-b border-slate-100 dark:border-slate-800/50 transition-colors ${onDayClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
              ${!isSameMonth(day, monthStart) ? 'bg-slate-50/50 dark:bg-slate-900/20 text-slate-400' : 'bg-white dark:bg-slate-900'}
              ${isSameDay(day, new Date()) ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/10' : ''}
            `}
          >
            <div className="flex justify-end">
              <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                ${isSameDay(day, new Date()) ? 'bg-blue-600 text-white' : ''}
              `}>
                {formattedDate}
              </span>
            </div>
            
            <div className="mt-2 space-y-1">
              {dayRecords.map(record => {
                const isCompleted = record.status === 'completed';
                return (
                  <div 
                    key={record.id}
                    onClick={(e) => { e.stopPropagation(); onRecordClick(record); }}
                    className={`text-[10px] p-1.5 rounded-md cursor-pointer truncate flex items-center gap-1.5 transition-all hover:opacity-80
                      ${isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}
                    `}
                  >
                    {isCompleted ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <Wrench className="w-3 h-3 shrink-0" />}
                    <span className="truncate font-medium">{record.assets?.name || record.title || 'Task'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day.toISOString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">{rows}</div>;
  };

  return (
    <div className="w-full bg-card p-4 rounded-xl border border-border/60 shadow-sm">
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  );
}
