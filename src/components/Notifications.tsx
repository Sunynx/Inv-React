'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Bell, Wrench, ShieldAlert, AlertTriangle, Key, CalendarClock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default function Notifications() {
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const notes: any[] = [];
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(now.getDate() + 30);

      // 1. Pending Tickets (Older than 2 days)
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(now.getDate() - 2);
      
      const { data: tickets } = await supabase
        .from('repair_tickets')
        .select('id, title, description, created_at, status')
        .in('status', ['เปิด', 'กำลังดำเนินการ'])
        .lt('created_at', twoDaysAgo.toISOString());
        
      if (tickets) {
        tickets.forEach(t => {
          notes.push({
            id: `ticket_${t.id}`,
            type: 'ticket',
            title: 'Pending Ticket Alert',
            message: `Ticket #${t.id.substring(0,6)} (${t.title}) has been pending for over 2 days.`,
            link: '/tickets',
            icon: Wrench,
            color: 'text-amber-500',
            date: new Date(t.created_at)
          });
        });
      }

      // 2. Expiring Warranties
      const { data: assets } = await supabase
        .from('assets')
        .select('id, name, asset_code, warranty_expiry')
        .not('warranty_expiry', 'is', null)
        .lt('warranty_expiry', thirtyDaysFromNow.toISOString())
        .gt('warranty_expiry', now.toISOString());

      if (assets) {
        assets.forEach(a => {
          notes.push({
            id: `warranty_${a.id}`,
            type: 'warranty',
            title: 'Warranty Expiring Soon',
            message: `${a.name} (${a.asset_code}) warranty expires on ${a.warranty_expiry}.`,
            link: '/assets',
            icon: ShieldAlert,
            color: 'text-red-500',
            date: new Date()
          });
        });
      }

      // 3. Low Stock Items
      const { data: allStock } = await supabase.from('stock_items').select('id, name, quantity, min_stock');
      if (allStock) {
        const lowStock = allStock.filter(s => s.quantity <= (s.min_stock || 0));
        lowStock.forEach(s => {
          notes.push({
            id: `stock_${s.id}`,
            type: 'stock',
            title: 'Low Stock Alert',
            message: `${s.name} is running low (${s.quantity} remaining).`,
            link: '/stock',
            icon: AlertTriangle,
            color: 'text-orange-500',
            date: new Date()
          });
        });
      }

      // 4. Expiring Licenses
      const { data: licenses } = await supabase
        .from('licenses')
        .select('id, name, expiry_date')
        .not('expiry_date', 'is', null)
        .lt('expiry_date', thirtyDaysFromNow.toISOString())
        .gt('expiry_date', now.toISOString());

      if (licenses) {
        licenses.forEach(l => {
          notes.push({
            id: `license_${l.id}`,
            type: 'license',
            title: 'License Expiring Soon',
            message: `${l.name} license expires on ${l.expiry_date}.`,
            link: '/licenses',
            icon: Key,
            color: 'text-amber-500',
            date: new Date()
          });
        });
      }

      // 5. Upcoming/Overdue Maintenance
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(now.getDate() + 7);
      
      const { data: maintenance } = await supabase
        .from('maintenance_schedules')
        .select('id, title, next_due_at, status, assets(name)')
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .lt('next_due_at', sevenDaysFromNow.toISOString());

      if (maintenance) {
        maintenance.forEach(m => {
          const isOverdue = new Date(m.next_due_at) < now;
          notes.push({
            id: `pm_${m.id}`,
            type: 'maintenance',
            title: isOverdue ? 'Overdue Maintenance' : 'Upcoming Maintenance',
            message: `${m.title} for ${m.assets?.name || 'Asset'} ${isOverdue ? 'was due' : 'is due'} on ${m.next_due_at}.`,
            link: '/maintenance',
            icon: CalendarClock,
            color: isOverdue ? 'text-red-500' : 'text-blue-500',
            date: new Date(m.next_due_at)
          });
        });
      }

      return notes.sort((a, b) => b.date.getTime() - a.date.getTime());
    },
    refetchInterval: 300000 // Refetch every 5 minutes
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-muted hover:text-foreground rounded-full h-10 w-10 transition-colors" />}>
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden shadow-lg border-border bg-popover text-popover-foreground transition-colors duration-300">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <span className="font-semibold text-foreground">Notifications</span>
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-blue-50 text-blue-700 hover:bg-blue-100">{notifications.length} New</span>
        </div>
        
        <div className="max-h-[350px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500 flex justify-center items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                <Bell className="h-5 w-5 text-gray-300" />
              </div>
              You're all caught up!
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((note, i) => {
                const Icon = note.icon;
                return (
                  <div key={note.id}>
                    {i > 0 && <DropdownMenuSeparator className="m-0" />}
                    <DropdownMenuItem render={<Link href={note.link} />} className="p-4 cursor-pointer focus:bg-muted items-start gap-4">
                      <div className={`mt-0.5 shrink-0 bg-background shadow-sm h-8 w-8 rounded-full border border-border flex items-center justify-center`}>
                        <Icon className={`h-4 w-4 ${note.color}`} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium text-foreground">{note.title}</p>
                        <p className="text-xs text-muted-foreground leading-snug">{note.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 font-medium">
                          {formatDistanceToNow(note.date, { addSuffix: true })}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
