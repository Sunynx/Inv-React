-- Migration: Add new columns to the `licenses` table based on the new CSV template

ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS license_type text,
  ADD COLUMN IF NOT EXISTS seat_no integer,
  ADD COLUMN IF NOT EXISTS account_email text,
  ADD COLUMN IF NOT EXISTS device_hostname text,
  ADD COLUMN IF NOT EXISTS assignment_status text,
  ADD COLUMN IF NOT EXISTS total_seats integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_seats integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS available_seats integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renewal_type text,
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS unit_cost numeric,
  ADD COLUMN IF NOT EXISTS annual_cost numeric,
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS assignment_notes text,
  ADD COLUMN IF NOT EXISTS source_sheet text;

-- You can run this in the Supabase SQL Editor
