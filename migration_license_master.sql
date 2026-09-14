-- ==============================================================================
-- RPM IT Inventory - License Master Architecture Migration
-- Run this in the Supabase SQL Editor
-- ==============================================================================

-- 1. Create Employees Table (if not exists)
DROP TABLE IF EXISTS public.employees CASCADE;
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department_id UUID REFERENCES public.departments(id),
    position TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create License Master Table
DROP TABLE IF EXISTS public.license_master CASCADE;
CREATE TABLE public.license_master (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Drop and Recreate Licenses Table (Seat Assignments)
-- WARNING: This will delete existing license records. Since this is a structural change for a new feature, we recreate it cleanly.
DROP TABLE IF EXISTS public.licenses CASCADE;

CREATE TABLE public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_master_id UUID NOT NULL REFERENCES public.license_master(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    
    license_key TEXT,
    seat_no INTEGER,
    start_date DATE,
    expiry_date DATE,
    
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    assignment_status TEXT DEFAULT 'Assigned' CHECK (assignment_status IN ('Assigned', 'Unassigned')),
    
    notes TEXT,
    assignment_notes TEXT,
    source_sheet TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies for License Master
ALTER TABLE public.license_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON public.license_master FOR ALL USING (true);

-- RLS Policies for Employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON public.employees FOR ALL USING (true);

-- RLS Policies for Licenses (Seats)
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All" ON public.licenses FOR ALL USING (true);
