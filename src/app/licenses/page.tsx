'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Filter, Edit, Trash2, Upload, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import LicenseModal from '@/components/LicenseModal';
import LicenseImportModal from '@/components/LicenseImportModal';
import { format } from 'date-fns';
import { DataTable } from '@/components/DataTable';
import { saveAs } from 'file-saver';
import { ColumnDef } from '@tanstack/react-table';
import Script from 'next/script';

export default function LicensesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('license_master')
        .select(`*, licenses ( id, assignment_status )`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      
      const mappedData = data.map(master => {
         const assignedCount = master.licenses?.filter((l: any) => l.assignment_status === 'Assigned').length || 0;
         return {
            ...master,
            assigned_seats: assignedCount
         };
      });
      
      return mappedData || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('license_master').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('License deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
    },
    onError: (err: any) => toast.error('Error deleting license: ' + err.message)
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this license?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredLicenses = records.filter(l => {
    const matchSearch = l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        l.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        l.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // We don't have a direct "status" on the master right now, so we can ignore it or assume it's active.
    // In a real app, master might have a status, or we filter by something else.
    // For now, let's just always return true for status since master doesn't have it natively, or we can use l.status if we added it.
    const matchStatus = true; 
    return matchSearch && matchStatus;
  });

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['licenses'] });
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const loadingToast = toast.loading('Fetching data & Generating Excel...');
      
      // @ts-expect-error window extension
      if (!window.XlsxPopulate) {
        throw new Error('Excel library not loaded yet. Please wait a moment and try again.');
      }
      
      // Fetch Master Data
      const { data: licenseMaster, error: masterError } = await supabase
        .from('license_master')
        .select('*')
        .order('name');
      if (masterError) throw masterError;

      // Fetch Seats Data
      const { data: licenses, error: licenseError } = await supabase
        .from('licenses')
        .select(`*, license_master (*), employees (name, email), assets (name, asset_code)`)
        .order('license_master_id');
      if (licenseError) throw licenseError;

      const assignedMap: Record<string, number> = {};
      licenses.forEach((l: any) => {
        if (!assignedMap[l.license_master_id]) assignedMap[l.license_master_id] = 0;
        if (l.assignment_status === 'Assigned') assignedMap[l.license_master_id]++;
      });

      // Load Template
      const templateRes = await fetch('/templates/license_template.xlsx');
      if (!templateRes.ok) throw new Error('Failed to load template');
      const arrayBuffer = await templateRes.arrayBuffer();
      
      // @ts-expect-error window extension
      const workbook = await window.XlsxPopulate.fromDataAsync(arrayBuffer);

      // Populate Master Data
      const registerSheet = workbook.sheet('License Register');
      if (registerSheet) {
        for (let i = 2; i < 1000; i++) {
          const row = registerSheet.row(i);
          if (!row.cell(1).value()) break;
          for (let col = 1; col <= 16; col++) row.cell(col).value(undefined);
        }

        licenseMaster.forEach((master: any, index: number) => {
          const row = registerSheet.row(index + 2);
          const assigned = assignedMap[master.id] || 0;
          const total = master.total_seats || 1;

          row.cell(1).value(master.name || '');
          row.cell(2).value(master.vendor || '');
          row.cell(3).value(master.category || '');
          row.cell(4).value(master.license_type || '');
          row.cell(5).value(''); // License Key
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

      // Populate Seats Data
      const rawSheet = workbook.sheet('License Raw Data');
      if (rawSheet) {
        for (let i = 2; i < 2000; i++) {
          const row = rawSheet.row(i);
          if (!row.cell(1).value()) break;
          for (let col = 1; col <= 28; col++) row.cell(col).value(undefined);
        }

        licenses.forEach((seat: any, index: number) => {
          const row = rawSheet.row(index + 2);
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

      const blob = await workbook.outputAsync();
      saveAs(blob, `RPM_Software_License_Register_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      
      toast.success('Export successful', { id: loadingToast });
    } catch (error: any) {
      toast.error(error.message || 'Error exporting to Excel');
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'name',
      header: 'Software',
      cell: ({ row }) => (
        <a href={`/licenses/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.name}
        </a>
      )
    },
    {
      accessorKey: 'vendor',
      header: 'Vendor',
      cell: ({ row }) => <span>{row.original.vendor || '-'}</span>
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => <span>{row.original.category || '-'}</span>
    },
    {
      accessorKey: 'total_seats',
      header: 'Seats (Assigned/Total)',
      cell: ({ row }) => (
        <span>{row.original.assigned_seats || 0} / {row.original.total_seats || 1}</span>
      )
    },
    {
      accessorKey: 'annual_cost',
      header: 'Annual Cost',
      cell: ({ row }) => {
        const cost = row.original.annual_cost;
        return <span>{cost ? `${Number(cost).toLocaleString()} THB` : '-'}</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: () => {
        return (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
            Active
          </span>
        );
      }
    },
    {
      accessorKey: 'updated_at',
      header: 'Last Updated',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.updated_at ? format(new Date(row.original.updated_at), 'dd MMM yyyy') : '-'}
        </span>
      )
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href={`/licenses/${record.id}`}>
              <Button variant="ghost" size="icon">
                <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </Button>
            </a>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx-populate/1.21.0/xlsx-populate.min.js" strategy="lazyOnload" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Software Licenses</h1>
          <p className="text-muted-foreground mt-1">Manage and track software license keys and expirations</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" /> {isExporting ? 'Exporting...' : 'Export to Excel'}
          </Button>
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => { setSelectedRecord(null); setIsModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Add License
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by software name, vendor or license key..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            </div>
            <select 
              className="flex h-9 w-[150px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0">
        <DataTable columns={columns} data={filteredLicenses} isLoading={isLoading} />
      </Card>

      <LicenseModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); refreshData(); }} 
        recordId={selectedRecord?.id}
      />

      <LicenseImportModal
        isOpen={isImportModalOpen}
        onClose={() => { setIsImportModalOpen(false); refreshData(); }}
      />
    </div>
  );
}
