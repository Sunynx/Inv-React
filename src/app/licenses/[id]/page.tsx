'use client';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { use } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

export default function LicenseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const licenseId = resolvedParams.id;

  const { data: master, isLoading: isLoadingMaster } = useQuery({
    queryKey: ['license_master', licenseId],
    queryFn: async () => {
      const { data, error } = await supabase.from('license_master').select('*').eq('id', licenseId).single();
      if (error) throw error;
      return data;
    }
  });

  const { data: seats = [], isLoading: isLoadingSeats } = useQuery({
    queryKey: ['license_seats', licenseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licenses')
        .select('*, employees(name, email), assets(name)')
        .eq('license_master_id', licenseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'seat_no',
      header: 'Seat No.',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.seat_no || '-'}</span>
    },
    {
      accessorKey: 'license_key',
      header: 'License Key',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.license_key || '-'}</span>
    },
    {
      accessorKey: 'assigned_to',
      header: 'Assigned To',
      cell: ({ row }) => {
        const empName = row.original.employees?.name;
        const empEmail = row.original.employees?.email;
        if (empName || empEmail) {
           return (
             <div className="flex flex-col">
               <span className="font-medium">{empName || '-'}</span>
               <span className="text-xs text-muted-foreground">{empEmail || ''}</span>
             </div>
           );
        }
        return <span className="text-muted-foreground">Unassigned</span>;
      }
    },
    {
      accessorKey: 'asset',
      header: 'Device',
      cell: ({ row }) => {
        const assetName = row.original.assets?.name;
        return <span className="font-medium">{assetName || '-'}</span>;
      }
    },
    {
      accessorKey: 'assignment_status',
      header: 'Assignment Status',
      cell: ({ row }) => {
        const status = row.original.assignment_status || 'Unassigned';
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            status.toLowerCase() === 'assigned' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {status}
          </span>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'License Status',
      cell: ({ row }) => {
        const status = row.original.status || 'active';
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {status}
          </span>
        );
      }
    }
  ];

  if (isLoadingMaster) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading License Data...</div>;
  if (!master) return <div className="p-8 text-center text-destructive">License not found</div>;

  const assignedCount = seats.filter((s: any) => s.assignment_status?.toLowerCase() === 'assigned').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <a href="/licenses">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </a>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{master.name}</h1>
          <p className="text-muted-foreground mt-1">License Master Details & Seat Assignments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground font-medium">Total Seats</p>
            <p className="text-3xl font-bold mt-2">{master.total_seats}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground font-medium">Assigned Seats</p>
            <p className="text-3xl font-bold mt-2 text-blue-600">{assignedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground font-medium">Available Seats</p>
            <p className="text-3xl font-bold mt-2 text-green-600">{master.total_seats - assignedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground font-medium">Annual Cost</p>
            <p className="text-3xl font-bold mt-2">{master.annual_cost ? `${Number(master.annual_cost).toLocaleString()} THB` : '-'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seat Assignments ({seats.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={seats} isLoading={isLoadingSeats} />
        </CardContent>
      </Card>
    </div>
  );
}
