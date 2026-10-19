import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { supabase } from '@/lib/supabase';

export interface BackupProgress {
  stage: 'idle' | 'database' | 'images' | 'zipping' | 'done' | 'error';
  message: string;
  percent: number;
  current?: number;
  total?: number;
}

export const BACKUP_TABLES = [
  'categories',
  'departments',
  'employees',
  'assets',
  'asset_images',
  'signatures',
  'license_master',
  'licenses',
  'repair_tickets',
  'stock_items',
  'stock_transactions',
  'asset_transfers',
  'asset_checkouts',
  'maintenance_schedules',
  'procurement',
  'notifications',
  'audit_log',
  'settings'
] as const;

export interface FileToDownload {
  url: string;
  zipPath: string;
  sourceTable: string;
  sourceId: string;
  description?: string;
}

/**
 * Fetch all records for a given table with auto-pagination
 */
export async function fetchTableData(tableName: string): Promise<any[]> {
  try {
    let allRows: any[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, from + pageSize - 1);

      if (error) {
        console.warn(`Table [${tableName}] fetch warning/error:`, error.message);
        break;
      }

      if (data && data.length > 0) {
        allRows = allRows.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      } else {
        hasMore = false;
      }
    }
    return allRows;
  } catch (err: any) {
    console.warn(`Failed to fetch table ${tableName}:`, err);
    return [];
  }
}

/**
 * Fetch counts for all tables quickly
 */
export async function fetchDatabaseStats(): Promise<{
  counts: Record<string, number>;
  totalRecords: number;
  totalImagesEstimated: number;
}> {
  const counts: Record<string, number> = {};
  let totalRecords = 0;

  await Promise.all(
    BACKUP_TABLES.map(async (table) => {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        counts[table] = (!error && count !== null) ? count : 0;
        totalRecords += counts[table];
      } catch {
        counts[table] = 0;
      }
    })
  );

  const totalImagesEstimated = 
    (counts['asset_images'] || 0) + 
    (counts['signatures'] || 0) + 
    (counts['assets'] || 0);

  return { counts, totalRecords, totalImagesEstimated };
}

/**
 * Extract all image and document URLs across the entire database
 */
export function extractFilesToDownload(tablesData: Record<string, any[]>): FileToDownload[] {
  const files: FileToDownload[] = [];
  const seenUrls = new Set<string>();

  const addFile = (url: string | null | undefined, zipPath: string, sourceTable: string, sourceId: string, description?: string) => {
    if (!url || typeof url !== 'string' || url.trim() === '') return;
    const cleanUrl = url.trim();
    if (seenUrls.has(cleanUrl)) return;
    seenUrls.add(cleanUrl);
    files.push({ url: cleanUrl, zipPath, sourceTable, sourceId, description });
  };

  // 1. Assets thumbnail & reference docs
  (tablesData['assets'] || []).forEach((asset) => {
    const assetKey = asset.asset_code || asset.name?.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_') || asset.id;
    if (asset.thumbnail_url) {
      const ext = getExtensionFromUrl(asset.thumbnail_url, 'jpg');
      addFile(asset.thumbnail_url, `images/assets/${assetKey}/thumbnail.${ext}`, 'assets', asset.id, `Thumbnail for ${asset.name}`);
    }

    if (asset.reference_url) {
      try {
        const parsed = JSON.parse(asset.reference_url);
        if (Array.isArray(parsed)) {
          parsed.forEach((doc: any, idx: number) => {
            if (doc?.url) {
              const ext = getExtensionFromUrl(doc.url, 'pdf');
              const name = doc.name ? doc.name.replace(/[^a-zA-Z0-9ก-๙._-]/g, '_') : `doc_${idx + 1}.${ext}`;
              addFile(doc.url, `documents/assets/${assetKey}/${name}`, 'assets', asset.id, doc.name || 'Asset document');
            }
          });
        } else if (typeof parsed === 'string') {
          const ext = getExtensionFromUrl(parsed, 'pdf');
          addFile(parsed, `documents/assets/${assetKey}/attachment.${ext}`, 'assets', asset.id, 'Asset document');
        }
      } catch {
        const ext = getExtensionFromUrl(asset.reference_url, 'pdf');
        addFile(asset.reference_url, `documents/assets/${assetKey}/attachment.${ext}`, 'assets', asset.id, 'Asset document');
      }
    }
  });

  // 2. Asset Images (Gallery)
  (tablesData['asset_images'] || []).forEach((img, idx) => {
    if (img.file_url) {
      const asset = (tablesData['assets'] || []).find(a => a.id === img.asset_id);
      const assetKey = asset?.asset_code || asset?.name?.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_') || img.asset_id || 'unknown';
      const ext = getExtensionFromUrl(img.file_url, 'jpg');
      const filename = img.file_name ? img.file_name.replace(/[^a-zA-Z0-9ก-๙._-]/g, '_') : `photo_${idx + 1}.${ext}`;
      addFile(img.file_url, `images/assets/${assetKey}/${filename}`, 'asset_images', img.id, `Gallery photo for ${assetKey}`);
    }
  });

  // 3. Signatures
  (tablesData['signatures'] || []).forEach((sig, idx) => {
    if (sig.signature_url) {
      const asset = (tablesData['assets'] || []).find(a => a.id === sig.asset_id);
      const assetKey = asset?.asset_code || sig.asset_id || 'general';
      const ext = sig.signature_url.startsWith('data:image/svg') ? 'svg' : 'png';
      addFile(sig.signature_url, `images/signatures/${assetKey}_signature_${idx + 1}.${ext}`, 'signatures', sig.id, `Signature for ${assetKey}`);
    }
  });

  // 4. Asset Transfers signatures
  (tablesData['asset_transfers'] || []).forEach((tr, idx) => {
    if (tr.signature_url) {
      const ext = tr.signature_url.startsWith('data:image/svg') ? 'svg' : 'png';
      addFile(tr.signature_url, `images/transfers/transfer_${tr.id || idx + 1}_signature.${ext}`, 'asset_transfers', tr.id, 'Transfer signature');
    }
  });

  // 5. Stock Items thumbnails and docs
  (tablesData['stock_items'] || []).forEach((stock) => {
    const stockKey = stock.sku || stock.name?.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_') || stock.id;
    if (stock.thumbnail_url) {
      const ext = getExtensionFromUrl(stock.thumbnail_url, 'jpg');
      addFile(stock.thumbnail_url, `images/stock/${stockKey}_thumbnail.${ext}`, 'stock_items', stock.id, `Stock thumbnail for ${stock.name}`);
    }
    if (stock.reference_url) {
      const ext = getExtensionFromUrl(stock.reference_url, 'pdf');
      addFile(stock.reference_url, `documents/stock/${stockKey}_doc.${ext}`, 'stock_items', stock.id, 'Stock document');
    }
  });

  // 6. Procurement attachments
  (tablesData['procurement'] || []).forEach((pr) => {
    const prKey = pr.document_number || pr.id;
    if (pr.metadata && typeof pr.metadata === 'object' && Array.isArray(pr.metadata.attachments)) {
      pr.metadata.attachments.forEach((att: any, idx: number) => {
        if (att?.url) {
          const ext = getExtensionFromUrl(att.url, 'pdf');
          const name = att.name ? att.name.replace(/[^a-zA-Z0-9ก-๙._-]/g, '_') : `attachment_${idx + 1}.${ext}`;
          addFile(att.url, `documents/procurement/${prKey}/${name}`, 'procurement', pr.id, att.name || 'PR document');
        }
      });
    }
  });

  return files;
}

/**
 * Extract clean file extension from URL or fallback
 */
function getExtensionFromUrl(url: string, fallback = 'bin'): string {
  if (url.startsWith('data:image/png')) return 'png';
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'jpg';
  if (url.startsWith('data:image/webp')) return 'webp';
  if (url.startsWith('data:image/svg')) return 'svg';
  if (url.startsWith('data:application/pdf')) return 'pdf';

  try {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const parts = cleanUrl.split('.');
    if (parts.length > 1) {
      const ext = parts.pop()?.toLowerCase();
      if (ext && ext.length <= 4 && /^[a-z0-9]+$/.test(ext)) {
        return ext;
      }
    }
  } catch {}
  return fallback;
}

/**
 * Fetch a single URL as binary ArrayBuffer or DataURL
 */
async function fetchFileBinary(url: string): Promise<ArrayBuffer | null> {
  // Check if base64 data URL
  if (url.startsWith('data:')) {
    try {
      const commaIdx = url.indexOf(',');
      if (commaIdx !== -1) {
        const base64Str = url.substring(commaIdx + 1);
        const binaryStr = atob(base64Str);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return bytes.buffer;
      }
    } catch (e) {
      console.warn('Failed to parse base64 data url', e);
      return null;
    }
  }

  // Fetch from HTTP/HTTPS with timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.arrayBuffer();
  } catch (err: any) {
    console.warn(`Could not download file [${url}]:`, err.message);
    return null;
  }
}

/**
 * Escape SQL value properly
 */
function escapeSqlValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return isFinite(val) ? String(val) : 'NULL';
  if (typeof val === 'object') {
    // Array or JSON
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

/**
 * Generate complete SQL restore dump script
 */
export function generateSqlDump(tablesData: Record<string, any[]>): string {
  const timestamp = new Date().toISOString();
  let sql = `-- =============================================================================\n`;
  sql += `-- RPM IT Inventory - Complete Database Restore Dump\n`;
  sql += `-- Generated At: ${timestamp}\n`;
  sql += `-- Instructions: Run this script in your Supabase SQL Editor or psql to restore data\n`;
  sql += `-- =============================================================================\n\n`;

  sql += `BEGIN;\n\n`;

  // Insert tables in dependency order
  const orderedTables = [
    'categories',
    'departments',
    'employees',
    'assets',
    'asset_images',
    'signatures',
    'license_master',
    'licenses',
    'repair_tickets',
    'stock_items',
    'stock_transactions',
    'asset_transfers',
    'asset_checkouts',
    'maintenance_schedules',
    'procurement',
    'notifications',
    'audit_log',
    'settings'
  ];

  for (const table of orderedTables) {
    const rows = tablesData[table] || [];
    if (rows.length === 0) continue;

    sql += `-- -----------------------------------------------------------------------------\n`;
    sql += `-- Table: ${table} (${rows.length} records)\n`;
    sql += `-- -----------------------------------------------------------------------------\n`;

    const cols = Object.keys(rows[0]);
    const quotedCols = cols.map(c => `"${c}"`).join(', ');

    // Chunk in batches of 100
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      sql += `INSERT INTO public."${table}" (${quotedCols}) VALUES\n`;
      
      const valuesLines = chunk.map((row) => {
        const rowVals = cols.map(col => escapeSqlValue(row[col])).join(', ');
        return `  (${rowVals})`;
      }).join(',\n');

      sql += `${valuesLines}\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET\n`;
      const updateCols = cols.filter(c => c !== 'id' && c !== 'created_at');
      if (updateCols.length > 0) {
        sql += `  ` + updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(',\n  ');
      } else {
        sql += `  "id" = EXCLUDED."id"`;
      }
      sql += `;\n\n`;
    }
  }

  sql += `COMMIT;\n`;
  return sql;
}

/**
 * Generate DDL Schema for table creation if restoring to a clean database
 */
export function getDdlSchemaSql(): string {
  return `-- =============================================================================
-- RPM IT Inventory - Complete DDL Schema (Create Tables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT 'box',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    position TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'ใช้งาน',
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    price NUMERIC,
    brand TEXT,
    model TEXT,
    cpu TEXT,
    ram TEXT,
    storage TEXT,
    gpu TEXT,
    display TEXT,
    os TEXT,
    os_key TEXT,
    windows_version TEXT,
    office_version TEXT,
    office_license TEXT,
    ip_address TEXT,
    mac_address TEXT,
    nas_user TEXT,
    password TEXT,
    purchase_date DATE,
    warranty_expiry DATE,
    supplier TEXT,
    po_number TEXT,
    location TEXT,
    assigned_user TEXT,
    assigned_email TEXT,
    user_position TEXT,
    previous_user TEXT,
    signer_name TEXT,
    signer_position TEXT,
    notes TEXT,
    thumbnail_url TEXT,
    reference_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asset_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    signature_url TEXT NOT NULL,
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.license_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    vendor TEXT,
    category TEXT,
    license_type TEXT,
    renewal_type TEXT,
    billing_cycle TEXT,
    total_seats INTEGER DEFAULT 1,
    unit_cost DECIMAL(10, 2),
    annual_cost DECIMAL(10, 2),
    owner TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_master_id UUID REFERENCES public.license_master(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    name TEXT,
    license_key TEXT,
    seat_no INTEGER,
    start_date DATE,
    expiry_date DATE,
    status TEXT DEFAULT 'active',
    assignment_status TEXT DEFAULT 'Assigned',
    notes TEXT,
    assignment_notes TEXT,
    source_sheet TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.repair_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    title TEXT,
    issue_description TEXT,
    description TEXT,
    status TEXT DEFAULT 'รอคิว',
    priority TEXT DEFAULT 'ปานกลาง',
    assigned_to TEXT,
    cost NUMERIC,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    unit_price NUMERIC,
    unit TEXT DEFAULT 'ชิ้น',
    quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    supplier TEXT,
    location TEXT,
    notes TEXT,
    thumbnail_url TEXT,
    reference_doc TEXT,
    reference_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    recipient TEXT,
    department TEXT,
    notes TEXT,
    performed_by TEXT DEFAULT 'Admin',
    reference_doc TEXT,
    reference_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asset_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    from_department TEXT,
    to_department TEXT,
    from_location TEXT,
    to_location TEXT,
    transferred_by TEXT,
    notes TEXT,
    signature_url TEXT,
    status TEXT DEFAULT 'เสร็จสมบูรณ์',
    reason TEXT,
    transfer_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asset_checkouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    checked_out_to TEXT NOT NULL,
    department TEXT,
    expected_return_date DATE,
    actual_return_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    status TEXT DEFAULT 'checked_out',
    checkout_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    maintenance_type TEXT,
    description TEXT,
    scheduled_date DATE,
    last_performed_at TIMESTAMP WITH TIME ZONE,
    next_due_at TIMESTAMP WITH TIME ZONE,
    assigned_to TEXT,
    frequency TEXT DEFAULT 'monthly',
    interval_days INTEGER DEFAULT 30,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.procurement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'PR',
    status TEXT DEFAULT 'รอดำเนินการ',
    supplier TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    total_amount NUMERIC DEFAULT 0,
    expected_delivery DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    performed_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT,
    asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    link_page TEXT,
    link_params TEXT,
    type TEXT DEFAULT 'system',
    severity TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;
}

/**
 * Generate README instructions for the user on how to restore
 */
export function getRestoreInstructionsText(stats: { tables: number; records: number; images: number }): string {
  const timestamp = new Date().toLocaleString('th-TH');
  return `================================================================================
RPM IT Inventory - Backup & Disaster Recovery Guide
วันที่สำรองข้อมูล: ${timestamp}
จำนวนตารางทั้งหมด: ${stats.tables} ตาราง
จำนวนข้อมูลทั้งหมด: ${stats.records} รายการ
จำนวนรูปภาพและเอกสารที่สำรอง: ${stats.images} ไฟล์
================================================================================

โครงสร้างของไฟล์ Backup ชุดนี้:
--------------------------------------------------------------------------------
1. database/
   ├── full_database.json   (ไฟล์ JSON รวมข้อมูลทุกตารางอย่างสมบูรณ์แบบ ไม่สูญหาย)
   ├── tables/              (ไฟล์ JSON แยกรายตาราง เช่น assets.json, licenses.json)
   ├── restore.sql          (SQL Script สำหรับกู้คืนข้อมูลเดิมทั้งหมดเข้า Database)
   └── schema.sql           (SQL Script สำหรับสร้างโครงสร้างตารางใหม่ตั้งแต่ศูนย์)
2. images/
   ├── assets/              (รูปภาพอุปกรณ์ทั้งหมด จัดเก็บแยกตามโฟลเดอร์รหัสอุปกรณ์)
   ├── signatures/          (ภาพลายเซ็นผู้รับมอบและส่งมอบอุปกรณ์)
   └── stock/               (รูปภาพสต็อกอะไหล่และอุปกรณ์เสริม)
3. documents/
   ├── assets/              (เอกสารแนบของอุปกรณ์ เช่น ใบรับประกัน, สเปก)
   └── procurement/         (เอกสารจัดซื้อ เช่น ใบเสนอราคา, ใบสั่งซื้อ)
4. manifest.json            (รายละเอียดสรุปข้อมูลและรายการไฟล์ทั้งหมดใน Backup)

================================================================================
วิธีนำข้อมูลกลับมาใช้ (How to Restore):
================================================================================

กรณีที่ 1: Supabase หรือ PostgreSQL มีปัญหา แต่ยังต้องการกู้ข้อมูลกลับเข้า Database เดิมหรือ Database ใหม่
--------------------------------------------------------------------------------
1. เปิดเข้าไปที่ Supabase Dashboard (หรือโปรแกรมจัดการ Database เช่น pgAdmin, DBeaver)
2. ไปที่เมนู "SQL Editor"
3. หากเป็น Database ที่สร้างใหม่เอี่ยม (ยังไม่มีตาราง):
   - เปิดไฟล์ "database/schema.sql" แล้ว Copy ข้อความทั้งหมดไปวางใน SQL Editor แล้วกด "Run" เพื่อสร้างตารางทั้งหมด
4. รันข้อมูล:
   - เปิดไฟล์ "database/restore.sql" แล้ว Copy ข้อความทั้งหมดไปวางใน SQL Editor แล้วกด "Run"
   - ข้อมูลทุกตารางจะถูกกู้คืนกลับมาเหมือนเดิม 100%

กรณีที่ 2: ต้องการเปิดดูข้อมูลทันทีโดยไม่ต้องต่อ Database
--------------------------------------------------------------------------------
1. สามารถเปิดไฟล์ JSON ในโฟลเดอร์ "database/tables/" ด้วยโปรแกรม Text Editor ทั่วไป หรือนำไป Import เข้า Excel ได้ทันที
2. รูปภาพและเอกสารแนบทั้งหมดอยู่ในโฟลเดอร์ "images/" และ "documents/" สามารถเปิดดูได้ทันทีโดยไม่ต้องใช้อินเทอร์เน็ต

================================================================================
ไฟล์ Backup นี้สร้างขึ้นโดยระบบ RPM IT Inventory System
แนะนำให้เก็บไฟล์นี้ไว้ใน Google Drive, External HDD หรือ Local Storage ที่ปลอดภัย
================================================================================
`;
}

/**
 * Execute full backup (Database JSON + SQL + All Images + Docs) -> ZIP
 */
export async function runFullBackup(
  onProgress?: (p: BackupProgress) => void
): Promise<void> {
  const updateProgress = (stage: BackupProgress['stage'], message: string, percent: number, current?: number, total?: number) => {
    onProgress?.({ stage, message, percent, current, total });
  };

  try {
    updateProgress('database', 'กำลังดึงข้อมูลทุกตารางจากฐานข้อมูล...', 5);

    // 1. Fetch all tables
    const tablesData: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (let i = 0; i < BACKUP_TABLES.length; i++) {
      const table = BACKUP_TABLES[i];
      const percent = 5 + Math.round(((i + 1) / BACKUP_TABLES.length) * 20);
      updateProgress('database', `กำลังดึงข้อมูลตาราง: ${table} (${i + 1}/${BACKUP_TABLES.length})...`, percent);
      const rows = await fetchTableData(table);
      tablesData[table] = rows;
      tableCounts[table] = rows.length;
      totalRecords += rows.length;
    }

    // 2. Extract image and file URLs
    updateProgress('images', 'กำลังรวบรวมรายการรูปภาพและเอกสารแนบ...', 28);
    const filesToDownload = extractFilesToDownload(tablesData);

    const zip = new JSZip();

    // 3. Add Database files to ZIP
    updateProgress('database', 'กำลังสร้างไฟล์ฐานข้อมูล JSON และ SQL Restore script...', 30);
    const dbFolder = zip.folder('database');
    const tablesFolder = dbFolder?.folder('tables');

    // Individual JSONs
    for (const [table, rows] of Object.entries(tablesData)) {
      tablesFolder?.file(`${table}.json`, JSON.stringify(rows, null, 2));
    }

    // Full JSON
    dbFolder?.file('full_database.json', JSON.stringify({
      version: '1.0',
      exported_at: new Date().toISOString(),
      counts: tableCounts,
      total_records: totalRecords,
      tables: tablesData
    }, null, 2));

    // SQL Dump & Schema
    const sqlDump = generateSqlDump(tablesData);
    dbFolder?.file('restore.sql', sqlDump);
    dbFolder?.file('schema.sql', getDdlSchemaSql());

    // 4. Download images and documents with controlled concurrency
    const totalFiles = filesToDownload.length;
    let downloadedCount = 0;
    let failedCount = 0;
    const failedFiles: { url: string; zipPath: string; reason: string }[] = [];

    updateProgress('images', `พบรูปภาพและเอกสารทั้งหมด ${totalFiles} ไฟล์ กำลังดาวน์โหลด...`, 35, 0, totalFiles);

    const concurrency = 6;
    for (let i = 0; i < totalFiles; i += concurrency) {
      const batch = filesToDownload.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const buffer = await fetchFileBinary(item.url);
            if (buffer) {
              zip.file(item.zipPath, buffer);
              downloadedCount++;
            } else {
              failedCount++;
              failedFiles.push({ url: item.url, zipPath: item.zipPath, reason: 'Failed to fetch binary data' });
            }
          } catch (e: any) {
            failedCount++;
            failedFiles.push({ url: item.url, zipPath: item.zipPath, reason: e.message || 'Unknown error' });
          }
        })
      );

      const processed = Math.min(i + concurrency, totalFiles);
      const imagePercent = 35 + Math.round((processed / (totalFiles || 1)) * 45);
      updateProgress('images', `กำลังดาวน์โหลดรูปภาพและไฟล์ (${processed}/${totalFiles})...`, imagePercent, processed, totalFiles);
    }

    // 5. Add Manifest & README
    const manifest = {
      system: 'RPM IT Inventory System',
      backup_type: 'full',
      created_at: new Date().toISOString(),
      summary: {
        total_tables: BACKUP_TABLES.length,
        total_records: totalRecords,
        table_counts: tableCounts,
        total_files_found: totalFiles,
        files_downloaded: downloadedCount,
        files_failed: failedCount
      },
      failed_files: failedFiles
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('README_RESTORE.txt', getRestoreInstructionsText({
      tables: BACKUP_TABLES.length,
      records: totalRecords,
      images: downloadedCount
    }));

    // 6. Generate ZIP file
    updateProgress('zipping', 'กำลังบีบอัดไฟล์ ZIP ทั้งหมด...', 85);
    const content = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    }, (metadata) => {
      const zipPercent = 85 + Math.round((metadata.percent / 100) * 14);
      updateProgress('zipping', `กำลังบีบอัดไฟล์ ZIP (${Math.round(metadata.percent)}%)...`, zipPercent);
    });

    // 7. Save file
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '');
    const filename = `RPM_Inventory_FULL_BACKUP_${dateStr}_${timeStr}.zip`;
    
    saveAs(content, filename);
    localStorage.setItem('rpm_last_backup_time', new Date().toISOString());

    updateProgress('done', `สำรองข้อมูลสำเร็จ! ดาวน์โหลดไฟล์ ${filename} เรียบร้อยแล้ว`, 100);
  } catch (err: any) {
    console.error('Backup error:', err);
    updateProgress('error', `เกิดข้อผิดพลาดในการสำรองข้อมูล: ${err.message}`, 0);
    throw err;
  }
}

/**
 * Execute Database-only backup (JSON + SQL Dump) -> ZIP
 */
export async function runDatabaseBackup(
  onProgress?: (p: BackupProgress) => void
): Promise<void> {
  const updateProgress = (stage: BackupProgress['stage'], message: string, percent: number) => {
    onProgress?.({ stage, message, percent });
  };

  try {
    updateProgress('database', 'กำลังดึงข้อมูลทุกตาราง...', 10);

    const tablesData: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (let i = 0; i < BACKUP_TABLES.length; i++) {
      const table = BACKUP_TABLES[i];
      const percent = 10 + Math.round(((i + 1) / BACKUP_TABLES.length) * 50);
      updateProgress('database', `กำลังดึงข้อมูลตาราง: ${table}...`, percent);
      const rows = await fetchTableData(table);
      tablesData[table] = rows;
      tableCounts[table] = rows.length;
      totalRecords += rows.length;
    }

    updateProgress('zipping', 'กำลังสร้างไฟล์ SQL Restore และ JSON...', 70);
    const zip = new JSZip();
    const dbFolder = zip.folder('database');
    const tablesFolder = dbFolder?.folder('tables');

    for (const [table, rows] of Object.entries(tablesData)) {
      tablesFolder?.file(`${table}.json`, JSON.stringify(rows, null, 2));
    }

    dbFolder?.file('full_database.json', JSON.stringify({
      version: '1.0',
      exported_at: new Date().toISOString(),
      counts: tableCounts,
      total_records: totalRecords,
      tables: tablesData
    }, null, 2));

    dbFolder?.file('restore.sql', generateSqlDump(tablesData));
    dbFolder?.file('schema.sql', getDdlSchemaSql());

    zip.file('manifest.json', JSON.stringify({
      system: 'RPM IT Inventory System',
      backup_type: 'database_only',
      created_at: new Date().toISOString(),
      total_tables: BACKUP_TABLES.length,
      total_records: totalRecords,
      table_counts: tableCounts
    }, null, 2));

    zip.file('README_RESTORE.txt', getRestoreInstructionsText({
      tables: BACKUP_TABLES.length,
      records: totalRecords,
      images: 0
    }));

    updateProgress('zipping', 'กำลังสร้างไฟล์ ZIP...', 85);
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '');
    const filename = `RPM_Inventory_DB_BACKUP_${dateStr}_${timeStr}.zip`;

    saveAs(content, filename);
    localStorage.setItem('rpm_last_backup_time', new Date().toISOString());

    updateProgress('done', `สำรองข้อมูล Database สำเร็จ! (${filename})`, 100);
  } catch (err: any) {
    console.error('DB Backup error:', err);
    updateProgress('error', `เกิดข้อผิดพลาด: ${err.message}`, 0);
    throw err;
  }
}
