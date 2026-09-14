import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
// @ts-expect-error: xlsx-populate does not have types
import XlsxPopulate from 'xlsx-populate';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    // 1. Fetch data from Supabase
    const { data: licenseMaster, error: masterError } = await supabase
      .from('license_master')
      .select('*')
      .order('name');
    
    if (masterError) throw masterError;

    const { data: licenses, error: licenseError } = await supabase
      .from('licenses')
      .select(`
        *,
        license_master (*),
        employees (name, email),
        assets (name, asset_code)
      `)
      .order('license_master_id');
      
    if (licenseError) throw licenseError;

    // Calculate assigned seats map
    const assignedMap: Record<string, number> = {};
    licenses.forEach(l => {
      if (!assignedMap[l.license_master_id]) assignedMap[l.license_master_id] = 0;
      if (l.assignment_status === 'Assigned') {
        assignedMap[l.license_master_id]++;
      }
    });

    // 2. Load the template using fetch since fs is not available in Edge runtime
    const templateUrl = new URL('/templates/license_template.xlsx', request.url);
    const templateRes = await fetch(templateUrl);
    if (!templateRes.ok) throw new Error('Failed to fetch template');
    
    const arrayBuffer = await templateRes.arrayBuffer();
    const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);

    // 3. Populate "License Register" (Master Data)
    const registerSheet = workbook.sheet('License Register');
    if (registerSheet) {
      // Clear existing rows (assuming headers on row 1, data starts row 2)
      // Note: xlsx-populate doesn't have a simple "clear sheet" that keeps charts intact easily if they reference ranges,
      // but overwriting values with null/undefined is safe.
      for (let i = 2; i < 1000; i++) {
        const row = registerSheet.row(i);
        if (!row.cell(1).value()) break; // Stop if empty
        for (let col = 1; col <= 16; col++) {
          row.cell(col).value(undefined);
        }
      }

      // Write new data
      licenseMaster.forEach((master, index) => {
        const rowNum = index + 2;
        const row = registerSheet.row(rowNum);
        const assigned = assignedMap[master.id] || 0;
        const total = master.total_seats || 1;

        row.cell(1).value(master.name || '');
        row.cell(2).value(master.vendor || '');
        row.cell(3).value(master.category || '');
        row.cell(4).value(master.license_type || '');
        row.cell(5).value(''); // License Key (master level usually empty if seat level)
        row.cell(6).value(total);
        row.cell(7).value(assigned);
        row.cell(8).value(total - assigned);
        row.cell(9).value(master.renewal_type || '');
        row.cell(10).value(master.billing_cycle || '');
        row.cell(11).value(master.unit_cost || 0);
        row.cell(12).value(master.annual_cost || 0);
        row.cell(13).value(''); // Owner
        row.cell(14).value('Active');
        row.cell(15).value(master.notes || '');
        row.cell(16).value(master.updated_at ? new Date(master.updated_at).toLocaleDateString() : '');
      });
    }

    // 4. Populate "License Raw Data" (Seat Data)
    const rawSheet = workbook.sheet('License Raw Data');
    if (rawSheet) {
      for (let i = 2; i < 2000; i++) {
        const row = rawSheet.row(i);
        if (!row.cell(1).value()) break;
        for (let col = 1; col <= 28; col++) {
          row.cell(col).value(undefined);
        }
      }

      licenses.forEach((seat, index) => {
        const rowNum = index + 2;
        const row = rawSheet.row(rowNum);
        const master = seat.license_master;
        
        if (!master) return;

        const assigned = assignedMap[master.id] || 0;
        const total = master.total_seats || 1;
        const userName = seat.employees?.name || seat.assigned_to || '';
        const userEmail = seat.employees?.email || seat.account_email || '';
        const deviceName = seat.assets?.name || seat.device_hostname || '';

        row.cell(1).value(`${master.name}|${seat.seat_no || index + 1}`);
        row.cell(2).value(master.name || '');
        row.cell(3).value(master.vendor || '');
        row.cell(4).value(master.category || '');
        row.cell(5).value(master.license_type || '');
        row.cell(6).value(seat.license_key || '');
        row.cell(7).value(seat.seat_no || '');
        row.cell(8).value(userName);
        row.cell(9).value(userEmail);
        row.cell(10).value(deviceName);
        row.cell(11).value(seat.start_date ? new Date(seat.start_date).toLocaleDateString() : '');
        row.cell(12).value(seat.expiry_date ? new Date(seat.expiry_date).toLocaleDateString() : '');
        
        // Skip formula cells (13, 14) so Excel calculates them if they exist in the template
        
        row.cell(15).value(seat.assignment_status || 'Unassigned');
        row.cell(16).value(total);
        row.cell(17).value(assigned);
        row.cell(18).value(total - assigned);
        row.cell(19).value(master.renewal_type || '');
        row.cell(20).value(master.billing_cycle || '');
        row.cell(21).value(master.unit_cost || 0);
        row.cell(22).value(master.annual_cost || 0);
        row.cell(23).value(seat.owner || '');
        row.cell(24).value(seat.status || 'active');
        row.cell(25).value(master.notes || '');
        row.cell(26).value(seat.assignment_notes || '');
        row.cell(27).value(seat.updated_at ? new Date(seat.updated_at).toLocaleDateString() : '');
        row.cell(28).value(master.name || '');
      });
    }

    // 5. Output buffer
    const buffer = await workbook.outputAsync();

    // 6. Return response
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="RPM_Software_License_Register_Export.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Export Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
