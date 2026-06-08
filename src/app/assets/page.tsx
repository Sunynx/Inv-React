'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, MoreHorizontal, Edit, Trash2, CheckCircle2, AlertCircle, Clock, Ban, Download, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import AssetSheet from '@/components/AssetSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as Tabs from '@radix-ui/react-tabs';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

const statusConfig: Record<string, { icon: any; className: string }> = {
  'ใช้งาน': { icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50 border-emerald-200/50' },
  'ส่งซ่อม': { icon: AlertCircle, className: 'text-red-600 bg-red-50 border-red-200/50' },
  'สำรอง': { icon: Clock, className: 'text-amber-600 bg-amber-50 border-amber-200/50' },
  'แทงจำหน่าย': { icon: Ban, className: 'text-gray-500 bg-gray-50 border-gray-200/50' },
  'สูญหาย': { icon: Ban, className: 'text-gray-500 bg-gray-50 border-gray-200/50' },
};

export default function AssetsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'view'|'edit'>('view');
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select(`id, name, asset_code, status, location, assigned_user, thumbnail_url, category_id, department_id, departments(name), categories(name)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Asset deleted');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => toast.error('Error: ' + err.message)
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this asset?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredAssets = assets.filter(a => {
    const matchSearch = a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.asset_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.location?.toLowerCase().includes(searchTerm.toLowerCase());
    let matchTab = true;
    if (filterTab !== 'all') matchTab = a.status === filterTab;
    return matchSearch && matchTab;
  });

  const countByStatus = (s: string) => assets.filter(a => a.status === s).length;

  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Assets');

    worksheet.columns = [
      { header: 'Asset Name', key: 'name', width: 30 },
      { header: 'Asset Code', key: 'asset_code', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Department', key: 'department', width: 25 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Assignee', key: 'assignee', width: 20 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    filteredAssets.forEach(a => {
      worksheet.addRow({
        name: a.name,
        asset_code: a.asset_code,
        category: a.categories?.name || '-',
        department: a.departments?.name || '-',
        location: a.location || '-',
        assignee: a.assigned_user || '-',
        status: a.status
      });
    });

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });
    });

    worksheet.autoFilter = 'A1:G1';

    const buffer = await workbook.xlsx.writeBuffer();
    const data = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, 'IT_Assets_Export.xlsx');
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'name',
      header: 'Asset',
      cell: ({ row }) => {
        const asset = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-muted border border-border overflow-hidden shrink-0">
              {asset.thumbnail_url ? (
                <img src={asset.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground text-[9px] font-medium">N/A</div>
              )}
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">{asset.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{asset.asset_code}</p>
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'categories.name',
      header: 'Category',
      cell: ({ row }) => <span className="bg-muted text-foreground/80 px-2 py-0.5 rounded-full text-xs">{row.original.categories?.name || '-'}</span>
    },
    {
      accessorKey: 'departments.name',
      header: 'Department',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.departments?.name || '-'}</span>
    },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.location || '-'}</span>
    },
    {
      accessorKey: 'assigned_user',
      header: 'Assignee',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.assigned_user || '-'}</span>
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const config = statusConfig[row.original.status] || { icon: AlertCircle, className: 'text-muted-foreground bg-muted border-border/50' };
        const Icon = config.icon;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}>
            <Icon size={12} />
            {row.original.status}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const asset = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedAssetId(asset.id); setSheetMode('edit'); setIsSheetOpen(true); }}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 print:space-y-0 print:m-0 print:p-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">IT Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track all inventory items</p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60 rounded-xl overflow-hidden bg-card border-0 transition-colors duration-300 print:hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <Tabs.Root value={filterTab} onValueChange={setFilterTab} className="w-full md:w-auto">
            <Tabs.List className="flex gap-1 flex-wrap">
              {[
                { value: 'all', label: 'All', count: assets.length },
                { value: 'ใช้งาน', label: 'ใช้งาน', count: countByStatus('ใช้งาน') },
                { value: 'ส่งซ่อม', label: 'ส่งซ่อม', count: countByStatus('ส่งซ่อม') },
                { value: 'สำรอง', label: 'สำรอง', count: countByStatus('สำรอง') },
              ].map(tab => (
                <Tabs.Trigger key={tab.value} value={tab.value} className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 data-[state=active]:text-gray-900 data-[state=active]:bg-gray-100 rounded-md transition-colors flex items-center gap-2">
                  {tab.label} <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">{tab.count}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-3 md:mt-0">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search name, code, location..." className="pl-9 h-9 bg-gray-50 border-gray-200 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1.5" /> Export
            </Button>
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" /> Print QR Labels
            </Button>
            <Button size="sm" className="h-9 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { setSelectedAssetId(undefined); setSheetMode('edit'); setIsSheetOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Asset
            </Button>
          </div>
        </div>

        <div className="p-4 bg-gray-50/30">
          <DataTable 
            columns={columns} 
            data={filteredAssets} 
            isLoading={isLoading} 
            onRowClick={(row) => {
              setSelectedAssetId(row.id);
              setSheetMode('view');
              setIsSheetOpen(true);
            }}
          />
        </div>
      </Card>

      <AssetSheet 
        isOpen={isSheetOpen} 
        onClose={() => {
          setIsSheetOpen(false);
          setSelectedAssetId(null);
        }} 
        assetId={selectedAssetId || undefined} 
        mode={sheetMode}
        onEdit={() => setSheetMode('edit')}
      />

      {/* Printable QR Code Labels */}
      <div className="hidden print:block print:w-full print:bg-white print:text-black">
        <h2 className="text-2xl font-bold mb-6 text-center">Asset QR Labels</h2>
        <div className="grid grid-cols-4 gap-6 place-items-center">
          {filteredAssets.map((asset: any) => (
            <div key={asset.id} className="border-2 border-black p-4 rounded-lg flex flex-col items-center justify-center text-center w-full max-w-[200px] break-inside-avoid">
              <QRCodeSVG value={`${window.location.origin}/scan?code=${asset.asset_code}`} size={120} />
              <p className="font-bold mt-3 text-sm">{asset.asset_code || 'N/A'}</p>
              <p className="text-xs truncate w-full px-2">{asset.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
