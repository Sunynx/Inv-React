'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, History, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/SortableTableHead';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      toast.error('Failed to load audit logs: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(l => {
    const matchSearch = l.table_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        l.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        JSON.stringify(l.details || {}).toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = filterAction === 'all' || l.action === filterAction;
    
    return matchSearch && matchAction;
  });

  const { sortedData, requestSort, sortConfig } = useTableSort(filteredLogs);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Audit Log</h1>
          <p className="text-muted-foreground mt-1">System activity and change history</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by table, user, or details..."
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
              value={filterAction} onChange={e => setFilterAction(e.target.value)}
            >
              <option value="all">All Actions</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto shadow-sm border-border/60">
        <Table>
          <TableHeader className="bg-muted/50 border-b border-border/60">
            <TableRow>
              <SortableTableHead label="Timestamp" sortKey="created_at" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onRequestSort={requestSort} />
              <SortableTableHead label="Action" sortKey="action" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onRequestSort={requestSort} />
              <SortableTableHead label="Target" sortKey="table_name" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onRequestSort={requestSort} />
              <SortableTableHead label="User" sortKey="user_id" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onRequestSort={requestSort} />
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Loading logs...</TableCell></TableRow>
            ) : sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No logs found.</TableCell></TableRow>
            ) : (
              sortedData.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(log.created_at), 'dd MMM yyyy HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      log.action === 'INSERT' ? 'bg-emerald-100 text-emerald-700' :
                      log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                      log.action === 'DELETE' ? 'bg-destructive/10 text-destructive' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{log.table_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{log.record_id?.substring(0,8)}...</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{log.user_id || 'System'}</TableCell>
                  <TableCell className="max-w-md truncate text-xs text-muted-foreground font-mono">
                    {JSON.stringify(log.details)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
