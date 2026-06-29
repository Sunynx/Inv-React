'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, AlertTriangle, MoreHorizontal, Download } from 'lucide-react';
import ReportExportModal from '@/components/ReportExportModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as Tabs from '@radix-ui/react-tabs';

import StockItemSheet from '@/components/StockItemSheet';
import StockTxModal from '@/components/StockTxModal';
import { DataTable } from '@/components/DataTable';
import { ColumnDef } from '@tanstack/react-table';

export default function StockPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('all');

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(undefined);
  
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'receive'|'distribute'>('receive');
  const [selectedTxItem, setSelectedTxItem] = useState<any | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_items')
        .select(`*, categories(name)`)
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  const handleTxOpen = (item: any, type: 'receive'|'distribute') => {
    setSelectedTxItem(item);
    setTxType(type);
    setIsTxModalOpen(true);
  };

  const filteredItems = items.filter(i => {
    const matchSearch = i.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        i.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const isLowStock = i.quantity <= (i.minimum_quantity || 0);
    let matchTab = true;
    if (filterTab === 'low') matchTab = isLowStock;
    if (filterTab === 'active') matchTab = i.status === 'Active';
    if (filterTab === 'inactive') matchTab = i.status === 'Inactive';
    return matchSearch && matchTab;
  });

  const countLow = items.filter(i => i.quantity <= (i.min_stock || 0)).length;
  const countActive = items.filter(i => i.status === 'Active').length;

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['stock_items'] });
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'name',
      header: 'Item Name',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            <div className="font-medium text-sm text-foreground">{item.name}</div>
            {item.sku && <div className="text-[11px] text-muted-foreground font-normal mt-0.5">{item.sku}</div>}
          </div>
        );
      }
    },
    {
      accessorKey: 'categories.name',
      header: 'Category',
      cell: ({ row }) => <span className="bg-muted text-foreground/80 px-2.5 py-1 rounded-full text-xs">{row.original.categories?.name || '-'}</span>
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const item = row.original;
        const isLowStock = item.quantity <= (item.minimum_quantity || 0);
        return isLowStock ? (
          <div className="inline-flex items-center text-red-600 text-[13px] font-medium bg-red-50 border border-red-200/50 px-2.5 py-1 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Low Stock
          </div>
        ) : (
          <div className="inline-flex items-center text-emerald-600 text-[13px] font-medium bg-emerald-50 border border-emerald-200/50 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Good
          </div>
        );
      }
    },
    {
      accessorKey: 'quantity',
      header: 'In Stock',
      cell: ({ row }) => <div className="text-sm font-semibold text-foreground">{row.original.quantity} <span className="font-normal text-muted-foreground text-xs">{row.original.unit}</span></div>
    },
    {
      accessorKey: 'min_stock',
      header: 'Min. Level',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.min_stock || 0}</span>
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="text-right pr-4" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" />}>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => handleTxOpen(item, 'receive')} className="text-emerald-600">
                  <ArrowDownToLine className="mr-2 h-4 w-4" /> Receive (In)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTxOpen(item, 'distribute')} className="text-blue-600">
                  <ArrowUpFromLine className="mr-2 h-4 w-4" /> Distribute (Out)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedItemId(item.id); setIsItemModalOpen(true); }}>
                  Edit Details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Spare Parts & Stock</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage IT consumables and spare parts</p>
        </div>
      </div>

      <Card className="shadow-sm border-border/60 rounded-xl overflow-hidden bg-card border-0 transition-colors duration-300">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <Tabs.Root value={filterTab} onValueChange={setFilterTab} className="w-full md:w-auto">
            <Tabs.List className="flex gap-1">
              {[
                { value: 'all', label: 'All Items', count: items.length, color: 'bg-gray-200 text-gray-600' },
                { value: 'low', label: 'Low Stock', count: countLow, color: 'bg-red-100 text-red-600' },
                { value: 'active', label: 'Active', count: countActive, color: 'bg-gray-200 text-gray-600' },
              ].map(tab => (
                <Tabs.Trigger key={tab.value} value={tab.value} className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 data-[state=active]:text-gray-900 data-[state=active]:bg-gray-100 rounded-md transition-colors flex items-center gap-2">
                  {tab.label} <span className={`${tab.color} px-1.5 py-0.5 rounded-full text-[10px] font-semibold`}>{tab.count}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto mt-3 md:mt-0">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search..." className="pl-9 h-9 bg-gray-50 border-gray-200 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setIsExportModalOpen(true)}>
              <Download className="w-4 h-4 mr-1.5" /> Export
            </Button>
            <Button size="sm" className="h-9 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { setSelectedItemId(undefined); setIsItemModalOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Item
            </Button>
          </div>
        </div>

        <div className="p-4 bg-gray-50/30">
          <DataTable columns={columns} data={filteredItems} isLoading={isLoading} />
        </div>
      </Card>

      <StockItemSheet isOpen={isItemModalOpen} onClose={() => { setIsItemModalOpen(false); refreshData(); }} itemId={selectedItemId} />
      {selectedTxItem && (
        <StockTxModal isOpen={isTxModalOpen} onClose={() => { setIsTxModalOpen(false); refreshData(); }} itemId={selectedTxItem.id} itemName={selectedTxItem.name} currentQty={selectedTxItem.quantity} type={txType} />
      )}
      <ReportExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        initialDataTypes={['stock']}
      />
    </div>
  );
}
