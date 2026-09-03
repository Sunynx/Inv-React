'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import { supabase } from '@/lib/supabase';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const DEFAULT_DATA_TYPES = ['assets', 'tickets', 'stock', 'audit', 'maintenance'];

export default function ReportExportModal({ 
  isOpen, 
  onClose,
  initialDataTypes = DEFAULT_DATA_TYPES
}: { 
  isOpen: boolean; 
  onClose: () => void;
  initialDataTypes?: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [formatType, setFormatType] = useState<'excel' | 'pdf'>('excel');
  const [dataTypes, setDataTypes] = useState<string[]>(initialDataTypes);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeSummary, setIncludeSummary] = useState(true);

  // New states for category filter
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Reset state when modal opens
  const initialDataTypesStr = initialDataTypes?.join(',') || '';
  
  useEffect(() => {
    if (isOpen) {
      setDataTypes(initialDataTypes || DEFAULT_DATA_TYPES);
      setFormatType('excel');
      setStartDate('');
      setEndDate('');
      setIncludeSummary(true);
      setSelectedCategories([]);
      
      // Fetch categories for the filter
      supabase.from('categories').select('id, name').order('name').then(({ data }) => {
        if (data) setCategories(data);
      });
    }
  }, [isOpen, initialDataTypesStr]);

  const toggleDataType = (type: string) => {
    if (dataTypes.includes(type)) {
      setDataTypes(dataTypes.filter(t => t !== type));
    } else {
      setDataTypes([...dataTypes, type]);
    }
  };

  const handleExport = async () => {
    if (dataTypes.length === 0) {
      toast.error('Please select at least one data type to export.');
      return;
    }

    setLoading(true);
    try {
      const exportData: any = {};
      const start = startDate ? new Date(startDate).toISOString() : null;
      const end = endDate ? new Date(endDate) : null;
      if (end) end.setHours(23, 59, 59, 999);
      const endISO = end ? end.toISOString() : null;

      const promises = [];

      // Fetch Assets
      if (dataTypes.includes('assets')) {
        let q = supabase.from('assets').select('*, categories(name), departments(name)');
        // Usually assets are a current snapshot, but if they want to filter by created_at
        if (start) q = q.gte('created_at', start);
        if (endISO) q = q.lte('created_at', endISO);
        if (selectedCategories.length > 0) {
          q = q.in('category_id', selectedCategories);
        }
        promises.push(
          q.then(({ data, error }) => {
            if (error) throw error;
            exportData.assets = data;
          })
        );
      }

      // Fetch Tickets
      if (dataTypes.includes('tickets')) {
        let q = supabase.from('repair_tickets').select('*, assets(asset_code, name)');
        if (start) q = q.gte('created_at', start);
        if (endISO) q = q.lte('created_at', endISO);
        promises.push(
          q.then(({ data, error }) => {
            if (error) throw error;
            exportData.tickets = data;
          })
        );
      }

      // Fetch Stock
      if (dataTypes.includes('stock')) {
        let q = supabase.from('stock_transactions').select('*, stock_items(name)');
        if (start) q = q.gte('created_at', start);
        if (endISO) q = q.lte('created_at', endISO);
        promises.push(
          q.then(({ data, error }) => {
            if (error) throw error;
            exportData.stock = data;
          })
        );
      }

      // Fetch Audit Logs
      if (dataTypes.includes('audit')) {
        let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false });
        if (start) q = q.gte('created_at', start);
        if (endISO) q = q.lte('created_at', endISO);
        promises.push(
          q.then(({ data, error }) => {
            if (error) throw error;
            exportData.audit = data;
          })
        );
      }

      // Fetch Maintenance
      if (dataTypes.includes('maintenance')) {
        let q = supabase.from('maintenance_schedules').select('*, assets(asset_code, name)');
        if (start) q = q.gte('created_at', start);
        if (endISO) q = q.lte('created_at', endISO);
        promises.push(
          q.then(({ data, error }) => {
            if (error) throw error;
            exportData.maintenance = data;
          })
        );
      }

      await Promise.all(promises);

      const filename = `RPM_Report_${format(new Date(), 'yyyyMMdd_HHmm')}`;
      
      if (formatType === 'excel') {
        await exportToExcel(exportData, { filename, includeSummary });
      } else {
        exportToPDF(exportData, { filename, includeSummary });
      }

      toast.success('Report generated successfully!');
      onClose();
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Generate Custom Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Export Format</Label>
            <div className="flex gap-4">
              <div 
                className={`flex items-center space-x-2 border p-3 rounded-md flex-1 cursor-pointer transition-colors ${formatType === 'excel' ? 'border-primary bg-primary/5' : 'bg-white'}`} 
                onClick={() => setFormatType('excel')}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formatType === 'excel' ? 'border-primary' : 'border-gray-300'}`}>
                  {formatType === 'excel' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <Label className="cursor-pointer flex-1">Excel (.xlsx)</Label>
              </div>
              <div 
                className={`flex items-center space-x-2 border p-3 rounded-md flex-1 cursor-pointer transition-colors ${formatType === 'pdf' ? 'border-primary bg-primary/5' : 'bg-white'}`} 
                onClick={() => setFormatType('pdf')}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formatType === 'pdf' ? 'border-primary' : 'border-gray-300'}`}>
                  {formatType === 'pdf' && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <Label className="cursor-pointer flex-1">PDF Document</Label>
              </div>
            </div>
          </div>

          {/* Data Types */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Data to Include</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'assets', label: 'Asset Inventory' },
                { id: 'tickets', label: 'Repair Tickets' },
                { id: 'stock', label: 'Stock Movements' },
                { id: 'audit', label: 'Audit Logs' },
                { id: 'maintenance', label: 'Maintenance (PM)' }
              ].map(dt => (
                <div key={dt.id} className="flex items-center space-x-2 bg-muted/30 p-2.5 rounded-md border border-border/50">
                  <Checkbox 
                    id={dt.id} 
                    checked={dataTypes.includes(dt.id)} 
                    onCheckedChange={() => toggleDataType(dt.id)} 
                  />
                  <Label htmlFor={dt.id} className="text-sm font-medium cursor-pointer flex-1">{dt.label}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          {dataTypes.includes('assets') && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold">Asset Categories <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setSelectedCategories(categories.map(c => c.id))} className="text-xs font-medium text-blue-600 hover:underline">Select All</button>
                  <button type="button" onClick={() => setSelectedCategories([])} className="text-xs font-medium text-destructive hover:underline">Clear</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-border/50 rounded-md bg-muted/10">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center space-x-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors">
                    <Checkbox 
                      id={`cat-${c.id}`} 
                      checked={selectedCategories.includes(c.id)} 
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCategories([...selectedCategories, c.id]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(id => id !== c.id));
                        }
                      }} 
                    />
                    <Label htmlFor={`cat-${c.id}`} className="text-sm cursor-pointer flex-1 break-words">{c.name}</Label>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground italic">If none are selected, all categories will be exported.</p>
            </div>
          )}

          {/* Date Range */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Date Range <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground italic">If left blank, all historical data will be exported.</p>
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2 pt-2 border-t border-border">
            <Checkbox id="summary" checked={includeSummary} onCheckedChange={(c) => setIncludeSummary(!!c)} />
            <Label htmlFor="summary" className="text-sm">Include Summary Sheet / Cover Page</Label>
          </div>

        </div>

        <div className="flex justify-end gap-3 pt-6 mt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} disabled={loading || dataTypes.length === 0} className="min-w-[120px]">
            {loading ? 'Generating...' : 'Download Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
