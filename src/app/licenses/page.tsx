'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Filter, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import LicenseModal from '@/components/LicenseModal';
import { format } from 'date-fns';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

export default function LicensesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licenses')
        .select(`*, assets ( name, asset_code )`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('licenses').delete().eq('id', id);
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
    const matchSearch = l.software_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        l.license_key?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        l.assets?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['licenses'] });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'software_name',
      header: 'Software',
      cell: ({ row }) => <span className="font-medium text-primary">{row.original.software_name}</span>
    },
    {
      accessorKey: 'license_key',
      header: 'License Key',
      cell: ({ row }) => {
        const key = row.original.license_key;
        return key ? <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground">{key}</span> : '-';
      }
    },
    {
      accessorKey: 'assets.name',
      header: 'Assigned Asset',
      cell: ({ row }) => {
        const record = row.original;
        if (record.asset_id) {
          return (
            <div>
              <div className="font-medium">{record.assets?.name}</div>
              <div className="text-xs text-muted-foreground">{record.assets?.asset_code}</div>
            </div>
          );
        }
        return <span className="text-muted-foreground italic">Unassigned</span>;
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            status === 'ใช้งานอยู่' ? 'bg-green-100 text-green-700' :
            status === 'ว่าง' ? 'bg-blue-100 text-blue-700' :
            status === 'หมดอายุ' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {status || 'Unknown'}
          </span>
        );
      }
    },
    {
      accessorKey: 'expiration_date',
      header: 'Expires',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.expiration_date ? format(new Date(row.original.expiration_date), 'dd MMM yyyy') : 'No Expiry'}
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
            <Button variant="ghost" size="icon" onClick={() => { setSelectedRecord(record); setIsModalOpen(true); }}>
              <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </Button>
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Software Licenses</h1>
          <p className="text-muted-foreground mt-1">Manage and track software license keys and expirations</p>
        </div>
        <Button onClick={() => { setSelectedRecord(null); setIsModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> Add License
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by software name or license key..."
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
              <option value="Active">Active (ใช้งาน)</option>
              <option value="Expired">Expired (หมดอายุ)</option>
              <option value="Inactive">Inactive (ยกเลิก)</option>
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
    </div>
  );
}
