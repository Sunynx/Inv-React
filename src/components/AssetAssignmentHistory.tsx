'use client';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { User, Calendar, ArrowRight, History } from 'lucide-react';

export default function AssetAssignmentHistory({ assetId, onUserClick }: { assetId: string; onUserClick?: (userName: string) => void }) {
  const { data: transfers, isLoading } = useQuery({
    queryKey: ['asset_assignment_history', assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_transfers')
        .select('id, transfer_date, from_user, to_user')
        .eq('asset_id', assetId)
        .order('transfer_date', { ascending: true });
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!assetId
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground animate-pulse">Loading history...</div>;
  }

  if (!transfers || transfers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2 italic">
        <History className="w-4 h-4 opacity-50" /> ไม่มีประวัติการเปลี่ยนมือ
      </div>
    );
  }

  // Build chronological sequence of users
  const sequence: { user: string; startDate: string; endDate?: string }[] = [];
  
  transfers.forEach((t, i) => {
    // If it's the first transfer, record the from_user if they exist
    if (i === 0 && t.from_user) {
      sequence.push({
        user: t.from_user,
        startDate: 'Unknown',
        endDate: t.transfer_date
      });
    } else if (i > 0 && t.from_user && sequence[sequence.length - 1]?.user !== t.from_user) {
       // If there's a gap (from_user doesn't match last to_user), record it
       sequence[sequence.length - 1].endDate = t.transfer_date;
       sequence.push({
         user: t.from_user,
         startDate: 'Unknown',
         endDate: t.transfer_date
       });
    }
    
    // Add the to_user
    if (t.to_user) {
      if (sequence.length > 0) {
        sequence[sequence.length - 1].endDate = t.transfer_date;
      }
      sequence.push({
        user: t.to_user,
        startDate: t.transfer_date
      });
    }
  });

  if (sequence.length === 0) {
    return <div className="text-sm text-muted-foreground">ไม่มีข้อมูลผู้ใช้งานที่ชัดเจน</div>;
  }

  return (
    <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-700 before:to-transparent">
      {sequence.map((item, idx) => (
        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-blue-100 text-blue-600 dark:bg-slate-800 dark:border-slate-900 dark:text-blue-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
            <User size={12} />
          </div>
          <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
              <button 
                onClick={() => onUserClick && onUserClick(item.user)}
                className="font-semibold text-sm text-blue-600 dark:text-blue-400 hover:underline text-left"
              >
                {item.user}
              </button>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
              <Calendar className="w-3 h-3" />
              <span>
                {item.startDate !== 'Unknown' ? format(new Date(item.startDate), 'dd MMM yyyy') : 'ก่อนหน้า'} 
                {' - '}
                {item.endDate ? format(new Date(item.endDate), 'dd MMM yyyy') : 'ปัจจุบัน'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
