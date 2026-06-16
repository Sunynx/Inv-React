-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Assets Table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'ใช้งาน',
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    price NUMERIC,
    model TEXT,
    cpu TEXT,
    ram TEXT,
    storage TEXT,
    purchase_date DATE,
    warranty_expiry DATE,
    location TEXT,
    assigned_user TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Repair Tickets Table (Missing)
CREATE TABLE IF NOT EXISTS repair_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    issue_description TEXT NOT NULL,
    status TEXT DEFAULT 'รอคิว',
    priority TEXT DEFAULT 'ปานกลาง',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Stock Items Table
CREATE TABLE IF NOT EXISTS stock_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    unit TEXT DEFAULT 'ชิ้น',
    min_stock INTEGER DEFAULT 5,
    price NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Licenses Table (Missing)
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    software_name TEXT NOT NULL,
    license_key TEXT,
    expiration_date DATE,
    status TEXT DEFAULT 'ใช้งาน',
    assigned_to TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Maintenance Schedules Table
CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    maintenance_type TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    status TEXT DEFAULT 'รอดำเนินการ',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Procurement (PR/PO) Table
CREATE TABLE IF NOT EXISTS procurement (
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

-- Allow anonymous read/write (If you haven't setup RLS yet)
-- Note: In a real production app, you should set up Row Level Security.
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All" ON departments FOR ALL USING (true);
CREATE POLICY "Allow All" ON categories FOR ALL USING (true);
CREATE POLICY "Allow All" ON assets FOR ALL USING (true);
CREATE POLICY "Allow All" ON repair_tickets FOR ALL USING (true);
CREATE POLICY "Allow All" ON stock_items FOR ALL USING (true);
CREATE POLICY "Allow All" ON licenses FOR ALL USING (true);
CREATE POLICY "Allow All" ON maintenance_schedules FOR ALL USING (true);
CREATE POLICY "Allow All" ON procurement FOR ALL USING (true);

-- 9. Audit Log (ประวัติการแก้ไข)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    performed_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON audit_log FOR ALL USING (true);

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.categories (
  name text NOT NULL UNIQUE,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  icon text DEFAULT 'box'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.departments (
  name text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.assets (
  previous_user text,
  brand text,
  windows_version text,
  office_version text,
  office_license text,
  reference_url text,
  assigned_email text,
  name text NOT NULL,
  asset_code text UNIQUE,
  serial_number text,
  category_id uuid,
  department_id uuid,
  location text,
  purchase_date date,
  warranty_expiry date,
  supplier text,
  price numeric,
  notes text,
  thumbnail_url text,
  assigned_user text,
  user_position text,
  signer_name text,
  signer_position text,
  model text,
  cpu text,
  ram text,
  storage text,
  gpu text,
  display text,
  os text,
  os_key text,
  ip_address text,
  mac_address text,
  password text,
  po_number text,
  nas_user text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text DEFAULT 'ใช้งาน'::text CHECK (status = ANY (ARRAY['ใช้งาน'::text, 'ส่งซ่อม'::text, 'ส่งคืน'::text, 'สำรอง'::text, 'ชำรุด'::text, 'จำหน่าย'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT assets_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.asset_images (
  asset_id uuid,
  file_url text NOT NULL,
  file_name text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT asset_images_pkey PRIMARY KEY (id),
  CONSTRAINT asset_images_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.signatures (
  asset_id uuid,
  signature_url text NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  signed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT signatures_pkey PRIMARY KEY (id),
  CONSTRAINT signatures_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.repair_tickets (
  asset_id uuid,
  title text NOT NULL,
  description text,
  assigned_to text,
  cost numeric,
  resolved_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text DEFAULT 'เปิด'::text CHECK (status = ANY (ARRAY['เปิด'::text, 'กำลังดำเนินการ'::text, 'รอะไหล่'::text, 'เสร็จสิ้น'::text, 'ยกเลิก'::text])),
  priority text DEFAULT 'ปกติ'::text CHECK (priority = ANY (ARRAY['ต่ำ'::text, 'ปกติ'::text, 'สูง'::text, 'เร่งด่วน'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT repair_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT repair_tickets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.asset_transfers (
  asset_id uuid,
  from_department text,
  to_department text,
  from_location text,
  to_location text,
  transferred_by text,
  notes text,
  signature_url text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transfer_date timestamp with time zone DEFAULT now(),
  CONSTRAINT asset_transfers_pkey PRIMARY KEY (id),
  CONSTRAINT asset_transfers_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.audit_log (
  asset_id uuid,
  action text NOT NULL,
  details text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  performed_by text DEFAULT 'Admin'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.settings (
  key text NOT NULL UNIQUE,
  value text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.licenses (
  name text NOT NULL,
  license_key text,
  vendor text,
  start_date date,
  expiry_date date,
  seats integer,
  assigned_to text,
  notes text,
  asset_id uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text DEFAULT 'Software'::text CHECK (type = ANY (ARRAY['Software'::text, 'Cloud'::text, 'Hardware'::text, 'Subscription'::text, 'Other'::text])),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT licenses_pkey PRIMARY KEY (id),
  CONSTRAINT licenses_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.maintenance_schedules (
  asset_id uuid,
  title text NOT NULL,
  description text,
  last_performed_at timestamp with time zone,
  next_due_at timestamp with time zone NOT NULL,
  assigned_to text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  frequency text DEFAULT 'monthly'::text CHECK (frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text, 'custom'::text])),
  interval_days integer DEFAULT 30,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'overdue'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT maintenance_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT maintenance_schedules_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.asset_checkouts (
  asset_id uuid,
  checked_out_to text NOT NULL,
  department text,
  expected_return_date date,
  actual_return_date timestamp with time zone,
  notes text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  checkout_date timestamp with time zone DEFAULT now(),
  status text DEFAULT 'checked_out'::text CHECK (status = ANY (ARRAY['checked_out'::text, 'returned'::text, 'overdue'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT asset_checkouts_pkey PRIMARY KEY (id),
  CONSTRAINT asset_checkouts_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.notifications (
  title text NOT NULL,
  message text,
  asset_id uuid,
  link_page text,
  link_params text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text DEFAULT 'system'::text CHECK (type = ANY (ARRAY['warranty'::text, 'maintenance'::text, 'checkout'::text, 'ticket'::text, 'system'::text])),
  severity text DEFAULT 'info'::text CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'danger'::text])),
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id)
);
CREATE TABLE public.stock_items (
  name text NOT NULL,
  sku text,
  category_id uuid,
  unit_price numeric,
  supplier text,
  location text,
  notes text,
  thumbnail_url text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  unit text DEFAULT 'ชิ้น'::text,
  quantity integer DEFAULT 0,
  min_stock integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  reference_doc text,
  reference_url text,
  CONSTRAINT stock_items_pkey PRIMARY KEY (id),
  CONSTRAINT stock_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.stock_transactions (
  stock_item_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['receive'::text, 'distribute'::text, 'return'::text, 'adjust'::text])),
  quantity integer NOT NULL,
  recipient text,
  department text,
  notes text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  performed_by text DEFAULT 'Admin'::text,
  created_at timestamp with time zone DEFAULT now(),
  reference_doc text,
  reference_url text,
  CONSTRAINT stock_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT stock_transactions_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id)
);
CREATE TABLE public.procurement (
  document_number text NOT NULL UNIQUE,
  title text NOT NULL,
  supplier text,
  expected_delivery date,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text DEFAULT 'PR'::text,
  status text DEFAULT 'รอดำเนินการ'::text,
  items jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  total_amount numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT procurement_pkey PRIMARY KEY (id)
);