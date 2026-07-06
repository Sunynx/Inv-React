import { supabase } from '@/lib/supabase';

export async function syncNotifications() {
  try {
    const notesToInsert: any[] = [];
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Fetch existing unread notifications to avoid duplicates
    const { data: existingUnread } = await supabase
      .from('notifications')
      .select('message')
      .eq('is_read', false);
      
    const existingMessages = new Set(existingUnread?.map(n => n.message) || []);

    // 1. Pending Tickets
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(now.getDate() - 2);
    
    const { data: tickets } = await supabase
      .from('repair_tickets')
      .select('id, title, created_at, status')
      .in('status', ['รอคิว', 'กำลังดำเนินการ'])
      .lt('created_at', twoDaysAgo.toISOString());
      
    tickets?.forEach(t => {
      const msg = `Ticket #${t.id.substring(0,6)} (${t.title}) has been pending for over 2 days.`;
      if (!existingMessages.has(msg)) {
        notesToInsert.push({ title: 'Pending Ticket Alert', message: msg, type: 'ticket', severity: 'warning', link_page: '/tickets' });
      }
    });

    // 2. Expiring Warranties
    const { data: assets } = await supabase
      .from('assets')
      .select('id, name, asset_code, warranty_expiry')
      .not('warranty_expiry', 'is', null)
      .lt('warranty_expiry', thirtyDaysFromNow.toISOString())
      .gt('warranty_expiry', now.toISOString());

    assets?.forEach(a => {
      const msg = `${a.name} (${a.asset_code}) warranty expires on ${a.warranty_expiry}.`;
      if (!existingMessages.has(msg)) {
        notesToInsert.push({ title: 'Warranty Expiring Soon', message: msg, type: 'warranty', severity: 'error', link_page: '/assets', asset_id: a.id });
      }
    });

    // 3. Low Stock Items
    const { data: allStock } = await supabase.from('stock_items').select('id, name, quantity, min_stock');
    allStock?.filter(s => s.quantity <= (s.min_stock || 0)).forEach(s => {
      const msg = `${s.name} is running low (${s.quantity} remaining).`;
      if (!existingMessages.has(msg)) {
        notesToInsert.push({ title: 'Low Stock Alert', message: msg, type: 'stock', severity: 'warning', link_page: '/stock' });
      }
    });

    // 4. Expiring Licenses
    const { data: licenses } = await supabase
      .from('licenses')
      .select('id, name, expiry_date')
      .not('expiry_date', 'is', null)
      .lt('expiry_date', thirtyDaysFromNow.toISOString())
      .gt('expiry_date', now.toISOString());

    licenses?.forEach(l => {
      const msg = `${l.name} license expires on ${l.expiry_date}.`;
      if (!existingMessages.has(msg)) {
        notesToInsert.push({ title: 'License Expiring Soon', message: msg, type: 'license', severity: 'warning', link_page: '/licenses' });
      }
    });

    // 5. Maintenance
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);
    
    const { data: maintenance } = await supabase
      .from('maintenance_schedules')
      .select('id, title, next_due_at, status, assets(name)')
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .lt('next_due_at', sevenDaysFromNow.toISOString());

    maintenance?.forEach(m => {
      const isOverdue = new Date(m.next_due_at) < now;
      const msg = `${m.title} for ${m.assets?.name || 'Asset'} ${isOverdue ? 'was due' : 'is due'} on ${m.next_due_at}.`;
      if (!existingMessages.has(msg)) {
        notesToInsert.push({ 
          title: isOverdue ? 'Overdue Maintenance' : 'Upcoming Maintenance', 
          message: msg, 
          type: 'maintenance', 
          severity: isOverdue ? 'error' : 'info', 
          link_page: '/maintenance' 
        });
      }
    });

    // Insert new notifications
    if (notesToInsert.length > 0) {
      await supabase.from('notifications').insert(notesToInsert);
    }
  } catch (error) {
    console.error('Error syncing notifications:', error);
  }
}
