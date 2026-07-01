import { supabase } from './supabase';

type AuditAction = 'create' | 'update' | 'delete' | 'transfer' | 'checkout' | 'return' | 'repair' | 'status_change';

interface AuditLogEntry {
  asset_id?: string;
  action: AuditAction;
  details: string;
  performed_by?: string;
}

export async function logAudit({ asset_id, action, details, performed_by = 'Admin' }: AuditLogEntry) {
  try {
    const { error } = await supabase.from('audit_log').insert([{
      asset_id: asset_id || null,
      action,
      details,
      performed_by,
    }]);
    if (error) console.error('Audit log error:', error);
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

export function formatAuditDetails(action: AuditAction, assetName?: string, extra?: string): string {
  const prefixes: Record<AuditAction, string> = {
    create: 'สร้างทรัพย์สินใหม่',
    update: 'แก้ไขข้อมูลทรัพย์สิน',
    delete: 'ลบทรัพย์สิน',
    transfer: 'โอนย้ายทรัพย์สิน',
    checkout: 'เบิกใช้ทรัพย์สิน',
    return: 'คืนทรัพย์สิน',
    repair: 'แจ้งซ่อมทรัพย์สิน',
    status_change: 'เปลี่ยนสถานะทรัพย์สิน',
  };
  const parts = [prefixes[action]];
  if (assetName) parts.push(`"${assetName}"`);
  if (extra) parts.push(`- ${extra}`);
  return parts.join(' ');
}
