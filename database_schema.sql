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
