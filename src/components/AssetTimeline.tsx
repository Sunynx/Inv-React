'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Box, Wrench, ArrowRightLeft, Shield, User, Tag, MessageSquare } from 'lucide-react';

export default function AssetTimeline({ assetId }: { assetId: string }) {
  const { data: timelineEvents, isLoading } = useQuery({
    queryKey: ['asset_timeline', assetId],
    queryFn: async () => {
      const [ticketsRes, transfersRes, assetRes, auditRes, deptsRes] = await Promise.all([
        supabase.from('repair_tickets').select('*').eq('asset_id', assetId),
        supabase.from('asset_transfers').select('*').eq('asset_id', assetId),
        supabase.from('assets').select('created_at, created_by').eq('id', assetId).single(),
        supabase.from('audit_log').select('*').eq('asset_id', assetId),
        supabase.from('departments').select('id, name')
      ]);
      
      const departments = deptsRes.data || [];
      const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || id;

      const events: any[] = [];

      if (assetRes.data) {
        events.push({
          id: 'created',
          date: new Date(assetRes.data.created_at),
          type: 'creation',
          title: 'Asset Added to Inventory',
          description: (
            <div className="flex items-center gap-2 mt-1.5 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
              <User className="w-4 h-4 shrink-0" />
              <span className="text-sm">{assetRes.data.created_by ? `Added by ${assetRes.data.created_by}` : 'Initial record created'}</span>
            </div>
          ),
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
            description: (
              <div className="flex flex-col gap-1.5 mt-1.5 border border-amber-500/20 rounded-md p-2.5 bg-amber-500/5 shadow-sm">
                <div className="grid grid-cols-[50px_1fr] items-start gap-2">
                  <span className="text-xs text-amber-600/70 dark:text-amber-400/70 font-semibold uppercase tracking-wider mt-0.5">Issue</span>
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400 leading-snug">{t.description || t.title}</span>
                </div>
                <div className="grid grid-cols-[50px_1fr] items-center gap-2">
                  <span className="text-xs text-amber-600/70 dark:text-amber-400/70 font-semibold uppercase tracking-wider">Status</span>
                  <span className="text-sm text-foreground">{t.status}</span>
                </div>
              </div>
            ),
            icon: Wrench,
            color: 'bg-amber-500'
          });
          
          if (t.status === 'เสร็จสิ้น' && t.updated_at) {
            events.push({
              id: `ticket_resolved_${t.id}`,
              date: new Date(t.updated_at),
              type: 'repair_resolved',
              title: 'Repair Completed',
              description: (
                <div className="flex items-center gap-2 mt-1.5 p-2 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400">
                  <Tag className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">Cost: ฿{t.cost ? Number(t.cost).toLocaleString() : 0}</span>
                </div>
              ),
              icon: Shield,
              color: 'bg-blue-500'
            });
          }
        });
      }

      if (transfersRes.data) {
        transfersRes.data.forEach(tr => {
          const hasUserChange = tr.from_user || tr.to_user;
          const hasDeptChange = tr.from_department_id || tr.to_department_id;
          const hasLocChange = tr.from_location || tr.to_location;
          
          const descNode = (
            <div className="flex flex-col gap-1.5 mt-1.5 border border-border/60 rounded-md p-2.5 bg-muted/10 shadow-sm">
              {hasUserChange && (
                <div className="grid grid-cols-[40px_1fr] items-center gap-2">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">User</span>
                  <div className="flex items-center gap-2 text-sm">
                    {tr.from_user ? <span className="line-through text-muted-foreground decoration-muted-foreground/50">{tr.from_user}</span> : <span className="text-muted-foreground">-</span>}
                    <ArrowRightLeft className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                    <span className="font-medium text-primary">{tr.to_user || '-'}</span>
                  </div>
                </div>
              )}
              {hasDeptChange && (
                <div className="grid grid-cols-[40px_1fr] items-center gap-2">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Dept</span>
                  <div className="flex items-center gap-2 text-sm">
                    {tr.from_department_id ? <span className="line-through text-muted-foreground decoration-muted-foreground/50">{getDeptName(tr.from_department_id)}</span> : <span className="text-muted-foreground">-</span>}
                    <ArrowRightLeft className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                    <span className="font-medium text-primary">{tr.to_department_id ? getDeptName(tr.to_department_id) : '-'}</span>
                  </div>
                </div>
              )}
              {hasLocChange && (
                <div className="grid grid-cols-[40px_1fr] items-center gap-2">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Loc</span>
                  <div className="flex items-center gap-2 text-sm">
                    {tr.from_location ? <span className="line-through text-muted-foreground decoration-muted-foreground/50">{tr.from_location}</span> : <span className="text-muted-foreground">-</span>}
                    <ArrowRightLeft className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                    <span className="font-medium text-primary">{tr.to_location || '-'}</span>
                  </div>
                </div>
              )}
              {tr.signature_url && (
                <div className="mt-2 pt-2 border-t border-border/40">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Signature</span>
                  <img src={tr.signature_url} alt="Transfer Signature" className="h-12 object-contain dark:invert" />
                </div>
              )}
            </div>
          );

          events.push({
            id: `transfer_${tr.id}`,
            date: new Date(tr.transfer_date || tr.created_at),
            type: 'transfer',
            title: 'Asset Transferred',
            description: (hasUserChange || hasDeptChange || hasLocChange || tr.signature_url) ? descNode : `From: ${tr.from_location || 'Unknown'} → To: ${tr.to_location}`,
            icon: ArrowRightLeft,
            color: 'bg-purple-500'
          });
        });
      }

      if (auditRes.data) {
        auditRes.data.forEach(log => {
          let icon = Shield;
          let color = 'bg-gray-500';
          
          if (log.action.includes('สร้าง') || log.action.includes('เพิ่ม')) {
            icon = Box;
            color = 'bg-emerald-500';
          } else if (log.action.includes('แก้ไข')) {
            icon = Wrench;
            color = 'bg-blue-500';
          } else if (log.action.includes('ลบ') || log.action.includes('เบิก')) {
            icon = Shield;
            color = 'bg-orange-500';
          }

          events.push({
            id: `audit_${log.id}`,
            date: new Date(log.created_at),
            type: 'audit',
            title: log.action,
            description: (
              <div className="flex flex-col gap-1.5 mt-1.5 border border-border/50 rounded-md p-2.5 bg-muted/30">
                <div className="flex items-start gap-2 text-sm text-foreground">
                  <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{log.details}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t border-border/50 pt-1.5 mt-1.5">
                  <User className="w-3 h-3" />
                  <span>By: {log.performed_by || 'System'}</span>
                </div>
              </div>
            ),
            icon: icon,
            color: color
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
              <div className="text-sm text-foreground/80 mt-1">{event.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
