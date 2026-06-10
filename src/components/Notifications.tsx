'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Bell, Wrench, ShieldAlert, AlertTriangle, Key, CalendarClock, CheckCircle2 } from 'lucide-react';
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
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
      return data || [];
    },
    refetchInterval: 60000 // Refetch every 1 min
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const getIcon = (type: string) => {
    switch(type) {
      case 'ticket': return <Wrench className="h-4 w-4" />;
      case 'warranty': return <ShieldAlert className="h-4 w-4" />;
      case 'stock': return <AlertTriangle className="h-4 w-4" />;
      case 'license': return <Key className="h-4 w-4" />;
      case 'maintenance': return <CalendarClock className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getColor = (severity: string) => {
    switch(severity) {
      case 'error': return 'text-red-500 bg-red-100';
      case 'warning': return 'text-amber-500 bg-amber-100';
      case 'info': return 'text-blue-500 bg-blue-100';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-muted hover:text-foreground rounded-full h-10 w-10 transition-colors" />}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-red-500 animate-pulse border-2 border-background" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-[400px] p-0 rounded-xl overflow-hidden shadow-lg border-border/60">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary" onClick={(e) => { e.preventDefault(); markAllAsReadMutation.mutate(); }}>
              Mark all as read
            </Button>
          )}
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No new notifications right now.</p>
            </div>
          ) : (
            <div className="py-2">
              {notifications.map((n: any) => (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${!n.is_read ? 'bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <div className={`p-2 rounded-full shrink-0 ${getColor(n.severity)}`}>
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    <div className="flex items-center justify-between mt-2 pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        {n.link_page && (
                          <Link href={n.link_page} className="text-[10px] font-medium text-primary hover:underline">
                            View
                          </Link>
                        )}
                        {!n.is_read && (
                          <Button variant="ghost" size="sm" className="h-auto p-0 text-muted-foreground hover:text-primary" onClick={(e) => { e.preventDefault(); markAsReadMutation.mutate(n.id); }}>
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
