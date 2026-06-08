'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Shield, Filter, AlertTriangle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { format, differenceInDays } from 'date-fns';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/SortableTableHead';

export default function WarrantyPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDept, setFilterDept] = useState('all');

  useEffect(() => {
    fetchWarrantyAssets();
    fetchDepartments();
  }, []);

  async function fetchDepartments() {
    const { data } = await supabase.from('departments').select('id, name').order('name');
    if (data) setDepartments(data);
  }

  async function fetchWarrantyAssets() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('assets')
        .select(`
          id, name, asset_code, supplier, purchase_date, warranty_expiry,
          departments ( name )
        `)
        .not('warranty_expiry', 'is', null)
        .order('warranty_expiry', { ascending: true });

      if (error) throw error;
      setAssets(data || []);
    } catch (err: any) {
      toast.error('Failed to load warranty data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredAssets = assets.filter(a => {
    const matchSearch = a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.asset_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        a.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchStatus = true;
    if (filterStatus !== 'all') {
      const isExpired = new Date(a.warranty_expiry) < new Date();
      const daysLeft = differenceInDays(new Date(a.warranty_expiry), new Date());
      const isExpiringSoon = !isExpired && daysLeft <= 30;

      if (filterStatus === 'active') matchStatus = !isExpired && !isExpiringSoon;
      if (filterStatus === 'soon') matchStatus = isExpiringSoon;
      if (filterStatus === 'expired') matchStatus = isExpired;
    }

    const matchDept = filterDept === 'all' || a.department_id === filterDept;

    return matchSearch && matchStatus && matchDept;
  });

  const { sortedData, requestSort, sortConfig } = useTableSort(filteredAssets);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Warranty Tracker</h1>
          <p className="text-muted-foreground mt-1">Track asset warranties and expiration dates</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by asset name, code, or supplier..."
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
              <option value="active">Active (ยังไม่หมดอายุ)</option>
              <option value="soon">Expiring Soon (ใกล้หมดอายุ)</option>
              <option value="expired">Expired (หมดอายุแล้ว)</option>
            </select>

            <select 
              className="flex h-9 w-[150px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={filterDept} onChange={e => setFilterDept(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <SortableTableHead label="Asset" sortKey="name" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onRequestSort={requestSort} />
              <SortableTableHead label="Department" sortKey="departments.name" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onRequestSort={requestSort} />
              <SortableTableHead label="Supplier" sortKey="supplier" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onRequestSort={requestSort} />
              <SortableTableHead label="Purchase Date" sortKey="purchase_date" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onRequestSort={requestSort} />
              <SortableTableHead label="Warranty Expiry" sortKey="warranty_expiry" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onRequestSort={requestSort} />
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading warranties...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">No warranty data found.</TableCell></TableRow>
            ) : (
              sortedData.map((asset) => {
                const isExpired = new Date(asset.warranty_expiry) < new Date();
                const daysLeft = differenceInDays(new Date(asset.warranty_expiry), new Date());
                const isExpiringSoon = !isExpired && daysLeft <= 30;

                return (
                  <TableRow key={asset.id} className="group cursor-default">
                    <TableCell>
                      <div className="font-medium text-foreground">{asset.name}</div>
                      <div className="text-xs text-muted-foreground">{asset.asset_code}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{asset.departments?.name || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.supplier || '-'}</TableCell>
                    <TableCell>
                      {asset.purchase_date ? format(new Date(asset.purchase_date), 'dd MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell className={isExpired ? 'text-destructive font-medium' : isExpiringSoon ? 'text-amber-600 font-medium' : ''}>
                      {format(new Date(asset.warranty_expiry), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      {isExpired ? (
                        <div className="flex items-center text-destructive text-xs font-semibold bg-destructive/10 px-2 py-1 rounded-full w-fit">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Expired
                        </div>
                      ) : isExpiringSoon ? (
                        <div className="flex items-center text-amber-700 text-xs font-semibold bg-amber-100 px-2 py-1 rounded-full w-fit">
                          <AlertTriangle className="w-3 h-3 mr-1" /> {daysLeft} Days Left
                        </div>
                      ) : (
                        <div className="flex items-center text-green-700 text-xs font-semibold bg-green-100 px-2 py-1 rounded-full w-fit">
                          <ShieldCheck className="w-3 h-3 mr-1" /> Active
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
