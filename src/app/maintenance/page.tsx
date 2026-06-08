'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Filter, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import MaintenanceModal from '@/components/MaintenanceModal';
import { format } from 'date-fns';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

export default function MaintenancePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['maintenance_schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`*, assets ( name, asset_code )`)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Record deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['maintenance_schedules'] });
    },
    onError: (err: any) => toast.error('Error deleting record: ' + err.message)
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchSearch = r.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.assets?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.assets?.asset_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchType = filterType === 'all' || r.maintenance_type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['maintenance_schedules'] });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'assets.name',
      header: 'Asset',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div>
            <div className="font-medium">{record.assets?.name || 'Unknown Asset'}</div>
            <div className="text-xs text-muted-foreground">{record.assets?.asset_code || '-'}</div>
          </div>
        );
      }
    },
    {
      accessorKey: 'maintenance_type',
      header: 'Type',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.maintenance_type}</span>
    },
    {
      accessorKey: 'scheduled_date',
      header: 'Scheduled Date',
      cell: ({ row }) => (
        <span>
          {row.original.scheduled_date ? format(new Date(row.original.scheduled_date), 'dd MMM yyyy') : '-'}
        </span>
      )
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            status === 'เสร็จสิ้น' ? 'bg-green-100 text-green-700' :
            status === 'กำลังดำเนินการ' ? 'bg-blue-100 text-blue-700' :
            status === 'ยกเลิก' ? 'bg-gray-100 text-gray-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {status || 'Unknown'}
          </span>
        );
      }
    },
    {
      accessorKey: 'performed_by',
      header: 'Performed By',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.performed_by || '-'}</span>
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
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Maintenance (PM)</h1>
          <p className="text-muted-foreground mt-1">Schedule and track preventive maintenance</p>
        </div>
        <Button onClick={() => { setSelectedRecord(null); setIsModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" /> Schedule PM
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by asset code or notes..."
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
              <option value="รอรับการบำรุงรักษา">รอรับการบำรุงรักษา (Pending)</option>
              <option value="เสร็จสิ้น">เสร็จสิ้น (Completed)</option>
              <option value="เลยกำหนด">เลยกำหนด (Overdue)</option>
              <option value="ยกเลิก">ยกเลิก (Cancelled)</option>
            </select>

            <select 
              className="flex h-9 w-[150px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={filterType} onChange={e => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="ทำความสะอาด (Cleaning)">ทำความสะอาด (Cleaning)</option>
              <option value="อัพเดทซอฟต์แวร์ (Software Update)">อัพเดทซอฟต์แวร์ (Software Update)</option>
              <option value="ตรวจเช็คสภาพ (Inspection)">ตรวจเช็คสภาพ (Inspection)</option>
              <option value="เปลี่ยนอะไหล่ตามรอบ (Parts Replacement)">เปลี่ยนอะไหล่ตามรอบ (Parts Replacement)</option>
              <option value="อื่นๆ (Other)">อื่นๆ (Other)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0">
        <DataTable columns={columns} data={filteredRecords} isLoading={isLoading} />
      </Card>

      <MaintenanceModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); refreshData(); }} 
        recordId={selectedRecord?.id}
      />
    </div>
  );
}
