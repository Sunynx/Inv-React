'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Box, Wrench, ArrowRightLeft, Shield } from 'lucide-react';

export default function AssetTimeline({ assetId }: { assetId: string }) {
  const { data: timelineEvents, isLoading } = useQuery({
    queryKey: ['asset_timeline', assetId],
    queryFn: async () => {
      const [ticketsRes, transfersRes, assetRes] = await Promise.all([
        supabase.from('repair_tickets').select('*').eq('asset_id', assetId),
        supabase.from('asset_transfers').select('*').eq('asset_id', assetId),
        supabase.from('assets').select('created_at, created_by').eq('id', assetId).single()
      ]);

      const events: any[] = [];

      if (assetRes.data) {
        events.push({
          id: 'created',
          date: new Date(assetRes.data.created_at),
          type: 'creation',
          title: 'Asset Added to Inventory',
          description: assetRes.data.created_by ? `Added by ${assetRes.data.created_by}` : 'Initial record created',
          icon: Box,
          color: 'bg-emerald-500'
        });
      }

      if (ticketsRes.data) {
        ticketsRes.data.forEach(t => {
          events.push({
            id: `ticket_${t.id}`,
            date: new Date(t.created_at),
            type: 'repair',
            title: 'Repair Ticket Created',
            description: `Issue: ${t.description || t.title} - Status: ${t.status}`,
            icon: Wrench,
            color: 'bg-amber-500'
          });
          
          if (t.status === 'เสร็จสิ้น' && t.updated_at) {
            events.push({
              id: `ticket_resolved_${t.id}`,
              date: new Date(t.updated_at),
              type: 'repair_resolved',
              title: 'Repair Completed',
              description: `Cost: ฿${t.cost || 0}`,
              icon: Shield,
              color: 'bg-blue-500'
            });
          }
        });
      }

      if (transfersRes.data) {
        transfersRes.data.forEach(tr => {
          events.push({
            id: `transfer_${tr.id}`,
            date: new Date(tr.transfer_date || tr.created_at),
            type: 'transfer',
            title: 'Asset Transferred',
            description: `From: ${tr.from_location || 'Unknown'} → To: ${tr.to_location}`,
            icon: ArrowRightLeft,
            color: 'bg-purple-500'
          });
        });
      }

      return events.sort((a, b) => b.date.getTime() - a.date.getTime());
    },
    enabled: !!assetId
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground text-sm flex justify-center items-center gap-2">
      <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Loading timeline...
    </div>;
  }

  if (!timelineEvents || timelineEvents.length === 0) {
    return <div className="p-8 text-center text-muted-foreground text-sm">No historical events found.</div>;
  }

  return (
    <div className="relative border-l border-border ml-4 py-2 space-y-6 transition-colors">
      {timelineEvents.map((event, index) => {
        const Icon = event.icon;
        return (
          <div key={event.id} className="relative pl-6">
            <span className={`absolute -left-[11px] top-1.5 h-5 w-5 rounded-full ring-4 ring-background flex items-center justify-center ${event.color} transition-colors`}>
              <Icon className="h-3 w-3 text-white" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground mb-0.5">{format(event.date, 'MMM dd, yyyy HH:mm')}</span>
              <h4 className="text-sm font-semibold text-foreground">{event.title}</h4>
              <p className="text-sm text-foreground/80 mt-1">{event.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
