'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SettingsPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  const [newCat, setNewCat] = useState('');
  const [newDept, setNewDept] = useState('');

  useEffect(() => {
    fetchLookups();
  }, []);

  async function fetchLookups() {
    const [c, d] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('departments').select('*').order('name')
    ]);
    if (c.data) setCategories(c.data);
    if (d.data) setDepartments(d.data);
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat) return;
    try {
      const { error } = await supabase.from('categories').insert([{ name: newCat }]);
      if (error) throw error;
      toast.success('Category added');
      setNewCat('');
      fetchLookups();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept) return;
    try {
      const { error } = await supabase.from('departments').insert([{ name: newDept }]);
      if (error) throw error;
      toast.success('Department added');
      setNewDept('');
      fetchLookups();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm(`Are you sure you want to delete this ${table}?`)) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted successfully');
      fetchLookups();
    } catch (err: any) {
      toast.error('Error deleting: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">System Settings</h1>
          <p className="text-muted-foreground mt-1">Manage system configurations and dropdowns</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Categories */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle>Asset Categories</CardTitle>
            <CardDescription>Manage asset categories used in dropdowns.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
              <Input placeholder="New Category Name..." value={newCat} onChange={(e) => setNewCat(e.target.value)} required />
              <Button type="submit"><Plus className="h-4 w-4 mr-2" /> Add</Button>
            </form>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar border rounded-md p-2 bg-muted/20">
              {categories.map(c => (
                <div key={c.id} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-md group">
                  <span>{c.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => deleteItem('categories', c.id)} className="opacity-0 group-hover:opacity-100 h-7 w-7 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Departments */}
        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>Manage company departments and locations.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddDept} className="flex gap-2 mb-4">
              <Input placeholder="New Department Name..." value={newDept} onChange={(e) => setNewDept(e.target.value)} required />
              <Button type="submit"><Plus className="h-4 w-4 mr-2" /> Add</Button>
            </form>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar border rounded-md p-2 bg-muted/20">
              {departments.map(d => (
                <div key={d.id} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-md group">
                  <span>{d.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => deleteItem('departments', d.id)} className="opacity-0 group-hover:opacity-100 h-7 w-7 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
