'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Papa from 'papaparse';
import { UploadCloud, AlertCircle } from 'lucide-react';

export default function LicenseImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // Assuming DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return null;
  };

  const parseNumber = (numStr: string) => {
    if (!numStr) return null;
    return parseFloat(numStr.replace(/,/g, ''));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError(null);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('Error parsing CSV file');
          return;
        }

        try {
          const mappedData = results.data.map((row: any) => {
            return {
              name: row['Product / Service'],
              vendor: row['Vendor'],
              category: row['Category'],
              license_type: row['License Type'],
              license_key: row['License Key / Contract Ref'],
              seat_no: parseInt(row['Seat No.']) || null,
              assigned_to: row['User Name'],
              account_email: row['Account / Email'],
              device_hostname: row['Device / Hostname'],
              start_date: parseDate(row['Assigned Date']),
              expiry_date: parseDate(row['Expiry Date']),
              assignment_status: row['Assignment Status'],
              total_seats: parseInt(row['Total Seats']) || 1,
              assigned_seats: parseInt(row['Assigned Seats']) || 1,
              available_seats: parseInt(row['Available Seats']) || 0,
              renewal_type: row['Renewal Type'],
              billing_cycle: row['Billing Cycle'],
              unit_cost: parseNumber(row['Unit Cost']),
              annual_cost: parseNumber(row['Annual Cost']),
              owner: row['Owner'],
              status: row['License Status'] || 'Active',
              notes: row['License Notes'],
              assignment_notes: row['Assignment Notes'],
              source_sheet: row['Source Sheet']
            };
          });

          // Filter out rows without a name (likely empty trailing rows)
          const validData = mappedData.filter(d => d.name);
          setPreview(validData);
        } catch (err: any) {
          setError('Failed to map CSV columns. Please ensure you are using the correct template.');
        }
      }
    });
  };

  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      // Supabase has a limit on bulk inserts, so we do it in chunks if large, but 100-200 is fine in one go.
      const { error } = await supabase.from('licenses').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Successfully imported ${preview.length} licenses`);
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      handleClose();
    },
    onError: (err: any) => toast.error('Error importing data: ' + err.message)
  });

  const handleImport = () => {
    if (preview.length === 0) return;
    importMutation.mutate(preview);
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Import Software Licenses</DialogTitle>
          <DialogDescription>
            Upload the RPM_Software_License_Register template CSV file to bulk import licenses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!file ? (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 flex flex-col items-center justify-center text-center bg-muted/10 hover:bg-muted/20 transition-colors">
              <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-medium text-sm text-foreground mb-1">Click to upload CSV file</p>
              <p className="text-xs text-muted-foreground mb-4">Must match the standard template format</p>
              <Input 
                type="file" 
                accept=".csv" 
                className="max-w-[250px]"
                onChange={handleFileUpload}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md border">
                <span className="font-medium text-sm truncate">{file.name}</span>
                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPreview([]); setError(null); }}>Remove</Button>
              </div>

              {error ? (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-md text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              ) : (
                <div className="bg-primary/5 p-4 rounded-md border border-primary/20">
                  <h4 className="font-semibold text-primary mb-2">Ready to Import</h4>
                  <p className="text-sm text-muted-foreground">
                    Found <strong>{preview.length}</strong> valid license records in the file.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={handleImport} 
            disabled={preview.length === 0 || importMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {importMutation.isPending ? 'Importing...' : 'Import Data'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
