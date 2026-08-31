'use client';
import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, FileSpreadsheet, MoreHorizontal, Edit, Trash2, CheckCircle2, AlertCircle, Clock, Ban, Download, Printer, CheckSquare, Bookmark, BookmarkPlus, MoveRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import ReportExportModal from '@/components/ReportExportModal';
import { EmptyState } from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { logAudit, formatAuditDetails } from '@/lib/auditLog';
import BulkTransferModal from '@/components/BulkTransferModal';
import BulkPrintQRModal from '@/components/BulkPrintQRModal';
import ImportAssetModal from '@/components/ImportAssetModal';
import { MultiSelectPopover } from '@/components/MultiSelectPopover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as Tabs from '@radix-ui/react-tabs';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';

const statusConfig: Record<string, { icon: any; className: string }> = {
  'ใช้งาน': { icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50 border-emerald-200/50' },
  'ส่งซ่อม': { icon: AlertCircle, className: 'text-red-600 bg-red-50 border-red-200/50' },
  'สำรอง': { icon: Clock, className: 'text-amber-600 bg-amber-50 border-amber-200/50' },
  'ส่งคืน': { icon: Clock, className: 'text-blue-500 bg-blue-50 border-blue-200/50' },
  'ชำรุด': { icon: Ban, className: 'text-orange-500 bg-orange-50 border-orange-200/50' },
  'จำหน่าย': { icon: Ban, className: 'text-gray-500 bg-gray-50 border-gray-200/50' },
};

function HighlightHandler({
  onHighlight,
  onFilterStatus,
  onFilterCategory,
  onFilterDepartment
}: {
  onHighlight: (id: string) => void,
  onFilterStatus: (status: string) => void,
  onFilterCategory: (category: string[]) => void,
  onFilterDepartment: (department: string[]) => void
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const highlightId = searchParams.get('highlight');
  const statusFilter = searchParams.get('status');
  const categoryFilter = searchParams.get('category');
  const departmentFilter = searchParams.get('department');

  useEffect(() => {
    let shouldReplace = false;
    if (highlightId) {
      router.push(`/assets/${highlightId}`);
      shouldReplace = true;
    }
    if (statusFilter) {
      onFilterStatus(statusFilter);
      shouldReplace = true;
    }
    if (categoryFilter) {
      onFilterCategory([categoryFilter]);
      shouldReplace = true;
    }
    if (departmentFilter) {
      onFilterDepartment([departmentFilter]);
      shouldReplace = true;
    }
    if (shouldReplace) {
      router.replace(pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, statusFilter, categoryFilter, departmentFilter, pathname, router]);

  return null;
}

export default function AssetsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<{ name: string, dept: string[], cat: string[] }[]>([]);
  useEffect(() => {
    const views = localStorage.getItem('asset_saved_views');
    if (views) setSavedViews(JSON.parse(views));
  }, []);
  const handleSaveView = () => {
    const viewName = prompt('Enter a name for this view:');
    if (!viewName) return;
    const newViews = [...savedViews, { name: viewName, dept: filterDepartment, cat: filterCategory }];
    setSavedViews(newViews);
    localStorage.setItem('asset_saved_views', JSON.stringify(newViews));
    toast.success('View saved successfully!');
  };
  const [sortBy, setSortBy] = useState('newest');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isBulkTransferOpen, setIsBulkTransferOpen] = useState(false);
  const [isBulkPrintOpen, setIsBulkPrintOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select(`id, name, asset_code, status, location, assigned_user, serial_number, thumbnail_url, category_id, department_id, created_at, updated_at, departments(name), categories(name)`)
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
    onSuccess: (_data, deletedId) => {
      const deletedAsset = assets.find(a => a.id === deletedId);
      logAudit({
        asset_id: deletedId,
        action: 'delete',
        details: formatAuditDetails('delete', deletedAsset?.name || 'Unknown'),
      });
      toast.success('Asset deleted');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => toast.error('Error: ' + err.message)
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('assets').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (deletedIds) => {
      toast.success(`Deleted ${deletedIds.length} assets`);
      setSelectedRows([]);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => toast.error('Error: ' + err.message)
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[], status: string }) => {
      const { error } = await supabase.from('assets').update({ status }).in('id', ids);
      if (error) throw error;
      return { ids, status };
    },
    onSuccess: ({ ids, status }) => {
      toast.success(`Updated status to ${status} for ${ids.length} assets`);
      setSelectedRows([]);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => toast.error('Error: ' + err.message)
  });

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const filteredAssets = useMemo(() => assets.filter(a => {
    const lowerSearch = searchTerm.toLowerCase();
    const matchSearch = a.name?.toLowerCase().includes(lowerSearch) ||
      a.asset_code?.toLowerCase().includes(lowerSearch) ||
      a.location?.toLowerCase().includes(lowerSearch) ||
      a.departments?.name?.toLowerCase().includes(lowerSearch) ||
      a.categories?.name?.toLowerCase().includes(lowerSearch) ||
      a.serial_number?.toLowerCase().includes(lowerSearch) ||
      a.assigned_user?.toLowerCase().includes(lowerSearch);

    let matchTab = true;
    if (filterTab !== 'all') matchTab = a.status === filterTab;

    let matchDept = true;
    const safeDept = Array.isArray(filterDepartment) ? filterDepartment : (filterDepartment ? [String(filterDepartment)] : []);
    if (safeDept.length > 0 && !safeDept.includes('all')) matchDept = safeDept.includes(a.departments?.name);

    let matchCat = true;
    const safeCat = Array.isArray(filterCategory) ? filterCategory : (filterCategory ? [String(filterCategory)] : []);
    if (safeCat.length > 0 && !safeCat.includes('all')) matchCat = safeCat.includes(a.categories?.name);

    return matchSearch && matchTab && matchDept && matchCat;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    }
    if (sortBy === 'recently_edited') {
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      return bTime - aTime;
    }
    return 0;
  }), [assets, searchTerm, filterTab, filterDepartment, filterCategory, sortBy]);

  const countByStatus = (s: string) => assets.filter(a => a.status === s).length;
  const uniqueDepartments = Array.from(new Set(assets.map(a => a.departments?.name).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set(assets.map(a => a.categories?.name).filter(Boolean))) as string[];

  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'ทรัพย์สิน',
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
      header: 'หมวดหมู่',
      cell: ({ row }) => <span className="bg-muted text-foreground/80 px-2 py-0.5 rounded-full text-xs">{row.original.categories?.name || '-'}</span>
    },
    {
      accessorKey: 'departments.name',
      header: 'แผนก',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.departments?.name || '-'}</span>
    },
    {
      accessorKey: 'location',
      header: 'สถานที่',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.location || '-'}</span>
    },
    {
      accessorKey: 'assigned_user',
      header: 'ผู้รับผิดชอบ',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.assigned_user || '-'}</span>
    },
    {
      accessorKey: 'status',
      header: 'สถานะ',
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
            <DropdownMenuTrigger className="inline-flex h-8 w-8 p-0 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/assets/${asset.id}?mode=edit`); }}>
                <Edit className="mr-2 h-4 w-4" /> แก้ไข
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> ลบข้อมูล
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    }
  ], [assets, deleteMutation, handleDelete, router]);

  return (
    <div className="space-y-6 print:space-y-0 print:m-0 print:p-0 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2 print:hidden mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">IT Asset Inventory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage and track all IT assets in your system efficiently.</p>
        </div>
      </div>

      <Card className="shadow-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 transition-colors duration-300 print:hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/50 flex flex-col gap-5">
          <Tabs.Root value={filterTab} onValueChange={setFilterTab} className="w-full overflow-x-auto hide-scrollbar">
            <Tabs.List className="flex gap-1.5 inline-flex w-max bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
              {[
                { value: 'all', label: 'ทั้งหมด', count: assets.length },
                { value: 'ใช้งาน', label: 'ใช้งาน', count: countByStatus('ใช้งาน') },
                { value: 'ส่งซ่อม', label: 'ส่งซ่อม', count: countByStatus('ส่งซ่อม') },
                { value: 'สำรอง', label: 'สำรอง', count: countByStatus('สำรอง') },
                { value: 'ส่งคืน', label: 'ส่งคืน', count: countByStatus('ส่งคืน') },
                { value: 'ชำรุด', label: 'ชำรุด', count: countByStatus('ชำรุด') },
                { value: 'จำหน่าย', label: 'จำหน่าย', count: countByStatus('จำหน่าย') },
              ].map(tab => (
                <Tabs.Trigger key={tab.value} value={tab.value} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-lg transition-all flex items-center gap-2 outline-none">
                  {tab.label} <span className="bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md text-[10px] font-bold">{tab.count}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>

          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 w-full">
            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="ค้นหาชื่อ, รหัส, S/N, สถานที่..." className="pl-10 h-10 bg-white/60 dark:bg-slate-900/60 border-slate-200/60 shadow-sm focus:ring-2 focus:ring-blue-500/20 text-sm w-full rounded-xl transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
              <MultiSelectPopover
                title="ทุกแผนก"
                options={uniqueDepartments.map(d => ({ label: d, value: d }))}
                selected={filterDepartment || []}
                onChange={setFilterDepartment}
              />
              <MultiSelectPopover
                title="ทุกประเภท"
                options={uniqueCategories.map(c => ({ label: c, value: c }))}
                selected={filterCategory || []}
                onChange={setFilterCategory}
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-10 w-10 p-0 items-center justify-center rounded-xl border border-slate-200/60 bg-white hover:bg-slate-50 shadow-sm shrink-0 transition-all outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20"
                >
                  <Bookmark className="w-4 h-4 text-slate-500" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleSaveView}>
                    <BookmarkPlus className="w-4 h-4 mr-2" /> Save Current View
                  </DropdownMenuItem>
                  {savedViews.length > 0 && <DropdownMenuSeparator />}
                  {savedViews.map((view, i) => (
                    <DropdownMenuItem key={i} onClick={() => {
                      setFilterDepartment(view.dept);
                      setFilterCategory(view.cat);
                    }}>
                      {view.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="col-span-2 sm:col-span-1 w-full sm:w-[140px] shrink-0">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="!h-10 px-4 bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60 shadow-sm text-sm w-full flex justify-between rounded-xl transition-all">
                    <span className="truncate">
                      {sortBy === 'newest' && 'เพิ่มใหม่ล่าสุด'}
                      {sortBy === 'recently_edited' && 'แก้ไขล่าสุด'}
                      {sortBy === 'oldest' && 'เพิ่มเก่าสุด'}
                      {!sortBy && 'เรียงตาม'}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="newest">เพิ่มใหม่ล่าสุด</SelectItem>
                    <SelectItem value="recently_edited">แก้ไขล่าสุด</SelectItem>
                    <SelectItem value="oldest">เพิ่มเก่าสุด</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 sm:col-span-1 flex items-center gap-2 shrink-0 justify-end w-full sm:w-auto mt-2 sm:mt-0">
                <Button variant="outline" className="h-10 px-4 rounded-xl border-slate-200 hover:bg-slate-50 transition-all hidden sm:flex text-sm" onClick={() => setIsImportModalOpen(true)}>
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-slate-500" /> นำเข้า
                </Button>
                <Button variant="outline" className="h-10 px-4 rounded-xl border-slate-200 hover:bg-slate-50 transition-all text-sm" onClick={() => setIsExportModalOpen(true)}>
                  <Download className="w-4 h-4 mr-1.5 text-slate-500" /> ส่งออก
                </Button>
                <Button variant="outline" className="h-10 px-4 rounded-xl border-slate-200 hover:bg-slate-50 transition-all hidden sm:flex text-sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1.5 text-slate-500" /> พิมพ์
                </Button>
                <Button className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20 transition-all text-sm" onClick={() => { router.push('/assets/new'); }}>
                  <Plus className="w-4 h-4 mr-1.5" /> เพิ่มทรัพย์สิน
                </Button>
              </div>
            </div>
          </div>
        </div>

        {selectedRows.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/30 px-5 py-3 flex flex-wrap items-center justify-between gap-4 transition-all duration-300 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-900 dark:text-blue-300 text-sm">{selectedRows.length} items selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Select onValueChange={(val) => {
                if (val) {
                  bulkUpdateStatusMutation.mutate({ ids: selectedRows.map(r => r.id), status: val });
                }
              }}>
                <SelectTrigger className="h-9 w-[160px] bg-white dark:bg-slate-800 text-sm border-blue-200 dark:border-blue-700">
                  <SelectValue placeholder="Update Status..." />
                </SelectTrigger>
                <SelectContent>
                  {['ใช้งาน', 'ส่งซ่อม', 'สำรอง', 'ส่งคืน', 'ชำรุด', 'จำหน่าย'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" className="h-9 border-blue-200 hover:bg-blue-100 text-blue-700 transition-colors" onClick={() => setIsBulkTransferOpen(true)}>
                <MoveRight className="w-4 h-4 mr-2" /> Transfer
              </Button>
              <Button variant="outline" size="sm" className="h-9 border-blue-200 hover:bg-blue-100 text-blue-700 transition-colors" onClick={() => setIsBulkPrintOpen(true)}>
                <Printer className="w-4 h-4 mr-2" /> Print QR
              </Button>
              <Button variant="destructive" size="sm" className="h-9" onClick={() => setBulkDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </div>
          </div>
        )}

        <div className="p-1 bg-slate-50/50 dark:bg-slate-900/50">
          <DataTable
            columns={columns}
            data={filteredAssets}
            isLoading={isLoading}
            enableRowSelection={true}
            onRowSelectionChange={setSelectedRows}
            onRowClick={(row) => {
              router.push(`/assets/${row.id}`);
            }}
            emptyState={
              <EmptyState
                title="ไม่พบข้อมูลทรัพย์สิน"
                description="ยังไม่มีรายการทรัพย์สินที่ตรงกับเงื่อนไขการค้นหาของคุณ หรือยังไม่ได้เพิ่มข้อมูลเข้าสู่ระบบ"
                actionLabel="เพิ่มทรัพย์สินใหม่"
                onAction={() => { router.push('/assets/new'); }}
              />
            }
          />
        </div>
      </Card>

      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDelete}
        title="ลบทรัพย์สิน"
        description="คุณแน่ใจหรือไม่ว่าต้องการลบทรัพย์สินนี้? ข้อมูลที่เกี่ยวข้องทั้งหมดจะถูกลบถาวรและไม่สามารถย้อนกลับได้"
        confirmLabel="ลบทรัพย์สิน"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={() => {
          bulkDeleteMutation.mutate(selectedRows.map(r => r.id));
          setBulkDeleteConfirm(false);
        }}
        title={`ลบทรัพย์สิน ${selectedRows.length} รายการ`}
        description={`คุณแน่ใจหรือไม่ว่าต้องการลบทรัพย์สินทั้ง ${selectedRows.length} รายการนี้? ข้อมูลที่เกี่ยวข้องทั้งหมดจะถูกลบถาวรและไม่สามารถย้อนกลับได้`}
        confirmLabel="ลบทรัพย์สินที่เลือก"
        variant="danger"
      />

      <ImportAssetModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        departments={uniqueDepartments.map(d => ({ id: d, name: d }))}
        categories={uniqueCategories.map(c => ({ id: c, name: c }))}
      />

      <BulkTransferModal
        isOpen={isBulkTransferOpen}
        onClose={() => setIsBulkTransferOpen(false)}
        selectedAssets={selectedRows}
        onSuccess={() => setSelectedRows([])}
      />

      <BulkPrintQRModal
        isOpen={isBulkPrintOpen}
        onClose={() => setIsBulkPrintOpen(false)}
        selectedAssets={selectedRows}
      />

      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        initialDataTypes={['assets']}
      />

      <div className="hidden print:block print:w-full print:bg-white print:text-black">
        <h2 className="text-2xl font-bold mb-6 text-center">Asset QR Labels</h2>
        <div className="grid grid-cols-4 gap-6 place-items-center">
          {(selectedRows.length > 0 ? selectedRows : filteredAssets).map((asset: any) => (
            <div key={asset.id} className="border-2 border-black p-4 rounded-lg flex flex-col items-center justify-center text-center w-full max-w-[200px] break-inside-avoid">
              <QRCodeSVG value={`${window.location.origin}/scan?code=${asset.asset_code}`} size={120} />
              <p className="font-bold mt-3 text-sm">{asset.asset_code || 'N/A'}</p>
              <p className="text-xs truncate w-full px-2">{asset.name}</p>
            </div>
          ))}
        </div>
      </div>

      <Suspense fallback={null}>
        <HighlightHandler
          onHighlight={() => {}}
          onFilterStatus={(status) => {
            setFilterTab(prev => prev === status ? prev : status);
          }}
          onFilterCategory={(category) => {
            setFilterCategory(prev => JSON.stringify(prev) === JSON.stringify(category) ? prev : category);
          }}
          onFilterDepartment={(department) => {
            setFilterDepartment(prev => JSON.stringify(prev) === JSON.stringify(department) ? prev : department);
          }}
        />
      </Suspense>
    </div>
  );
}
