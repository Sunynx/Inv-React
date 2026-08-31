'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Monitor, Clock, User, ArrowRightLeft, Calendar, Shield, X, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function UserHistoryModal({ isOpen, onClose, userName }: { isOpen: boolean; onClose: () => void; userName?: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user_history', userName],
    queryFn: async () => {
      if (!userName) return { current: [], historical: [] };

      // Fire all 3 queries in parallel instead of sequential awaits
      const [currentRes, prevRes, transfersRes] = await Promise.all([
        // 1. Current assets
        supabase
          .from('assets')
          .select('id, name, asset_code, status, location, categories(name), departments(name)')
          .eq('assigned_user', userName)
          .order('name'),

        // 2. Assets where this user is previous_user
        supabase
          .from('assets')
          .select('id, name, asset_code, status, categories(name), departments(name)')
          .eq('previous_user', userName),

        // 3. Transfers involving this user — fixed .or() syntax (no quotes around value)
        supabase
          .from('asset_transfers')
          .select('asset_id, transfer_date, from_user, to_user, notes, assets(id, name, asset_code, status, categories(name))')
          .or(`from_user.eq.${userName},to_user.eq.${userName}`)
          .order('transfer_date', { ascending: false }),
      ]);

      if (currentRes.error) throw currentRes.error;
      if (prevRes.error) throw prevRes.error;

      const currentAssets = currentRes.data || [];
      const prevAssets = prevRes.data || [];
      const transfers = transfersRes.data || [];

      const currentIds = new Set(currentAssets.map(a => a.id));
      const historicalMap = new Map();

      // Add prevAssets
      prevAssets.forEach(a => {
        if (!currentIds.has(a.id)) {
          historicalMap.set(a.id, { asset: a, events: [] });
        }
      });

      // Add transfers
      transfers.forEach(t => {
        const aId = t.asset_id;
        if (!currentIds.has(aId)) {
          if (!historicalMap.has(aId) && t.assets) {
            historicalMap.set(aId, { asset: t.assets, events: [] });
          }
          if (historicalMap.has(aId)) {
            historicalMap.get(aId).events.push({
              date: t.transfer_date,
              from: t.from_user,
              to: t.to_user,
              notes: t.notes
            });
          }
        }
      });

      return {
        current: currentAssets || [],
        historical: Array.from(historicalMap.values())
      };
    },
    enabled: isOpen && !!userName
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <User size={24} />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {userName || 'Unknown User'}
              </DialogTitle>
              <DialogDescription className="text-sm mt-1">
                Equipment Assignment Profile & History
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 p-12 flex flex-col items-center justify-center text-muted-foreground gap-4">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-sm">กำลังโหลดข้อมูลอุปกรณ์...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar">
            <Tabs defaultValue="current" className="w-full mt-4">
              <TabsList className="w-full grid grid-cols-2 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="current" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                  <Monitor className="w-4 h-4 mr-2" />
                  อุปกรณ์ปัจจุบัน ({data?.current?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="historical" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm">
                  <History className="w-4 h-4 mr-2" />
                  ประวัติอุปกรณ์เดิม ({data?.historical?.length || 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="current" className="mt-6 space-y-4">
                {data?.current?.length === 0 ? (
                  <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed border-border">
                    <Monitor className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">ไม่มีอุปกรณ์ที่ถือครองอยู่ปัจจุบัน</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {data?.current.map((asset: any) => (
                      <div key={asset.id} className="p-4 rounded-xl border border-border bg-card hover:border-blue-200 dark:hover:border-blue-800 transition-colors shadow-sm">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h4 className="font-semibold text-foreground text-base">{asset.name}</h4>
                            <p className="text-sm text-muted-foreground font-mono mt-0.5">{asset.asset_code}</p>
                            
                            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {asset.status}
                              </span>
                              {asset.categories?.name && (
                                <span className="flex items-center gap-1">
                                  • {asset.categories.name}
                                </span>
                              )}
                              {asset.departments?.name && (
                                <span className="flex items-center gap-1">
                                  • {asset.departments.name}
                                </span>
                              )}
                              {asset.location && (
                                <span className="flex items-center gap-1">
                                  • 📍 {asset.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="historical" className="mt-6 space-y-4">
                {data?.historical?.length === 0 ? (
                  <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed border-border">
                    <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">ไม่มีประวัติการใช้งานอุปกรณ์อื่นในอดีต</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {data?.historical.map((item: any, idx: number) => {
                      const asset = item.asset;
                      const events = item.events || [];
                      return (
                        <div key={idx} className="p-4 rounded-xl border border-border bg-muted/10 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-slate-300 dark:bg-slate-700" />
                          <div className="pl-3">
                            <h4 className="font-semibold text-foreground/80">{asset.name}</h4>
                            <p className="text-sm text-muted-foreground font-mono mt-0.5">{asset.asset_code}</p>
                            
                            {events.length > 0 && (
                              <div className="mt-4 space-y-3">
                                {events.map((ev: any, eIdx: number) => (
                                  <div key={eIdx} className="text-xs bg-white dark:bg-slate-900 border border-border/50 rounded-lg p-2.5 shadow-sm">
                                    <div className="flex items-center justify-between mb-1.5 text-muted-foreground">
                                      <span className="font-medium flex items-center gap-1.5">
                                        <ArrowRightLeft className="w-3 h-3" /> 
                                        การโอนย้าย
                                      </span>
                                      <span>{ev.date ? format(new Date(ev.date), 'dd MMM yyyy') : '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={ev.from === userName ? 'font-semibold text-orange-600 dark:text-orange-400' : 'text-foreground'}>
                                        {ev.from || 'IT'}
                                      </span>
                                      <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                                      <span className={ev.to === userName ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-foreground'}>
                                        {ev.to || 'IT'}
                                      </span>
                                    </div>
                                    {ev.notes && (
                                      <p className="mt-1.5 text-muted-foreground/80 italic border-t border-border/40 pt-1">
                                        "{ev.notes}"
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
