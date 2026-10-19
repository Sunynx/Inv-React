'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Database, Sliders, ShieldCheck, HardDrive } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import BackupManager from '@/components/BackupManager';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'backup' | 'lookups'>('backup');
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
    if (!newCat.trim()) return;
    try {
      const { error } = await supabase.from('categories').insert([{ name: newCat.trim() }]);
      if (error) throw error;
      toast.success('เพิ่มประเภทอุปกรณ์สำเร็จ');
      setNewCat('');
      fetchLookups();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.trim()) return;
    try {
      const { error } = await supabase.from('departments').insert([{ name: newDept.trim() }]);
      if (error) throw error;
      toast.success('เพิ่มแผนกสำเร็จ');
      setNewDept('');
      fetchLookups();
    } catch (err: any) {
      toast.error('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const deleteItem = async (table: string, id: string, name: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "${name}"?`)) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('ลบข้อมูลสำเร็จ');
      fetchLookups();
    } catch (err: any) {
      toast.error('ไม่สามารถลบได้ (อาจมีข้อมูลอ้างอิงอยู่): ' + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">การตั้งค่าระบบ (System Settings)</h1>
          <p className="text-muted-foreground mt-1">จัดการตัวเลือก dropdown ในระบบ และสำรองข้อมูลป้องกันข้อมูลสูญหาย</p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-xl w-fit border border-border/50">
        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'backup'
              ? 'bg-background text-foreground shadow-sm font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Database className="h-4 w-4 text-primary" />
          <span>สำรองและกู้คืนข้อมูล (Backup &amp; Recovery)</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lookups')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'lookups'
              ? 'bg-background text-foreground shadow-sm font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="h-4 w-4 text-muted-foreground" />
          <span>หมวดหมู่และแผนก (Lookups)</span>
        </button>
      </div>

      {/* Tab 1: Backup & Recovery */}
      {activeTab === 'backup' && (
        <div className="animate-in fade-in-50 duration-200">
          <BackupManager />
        </div>
      )}

      {/* Tab 2: Lookups Management */}
      {activeTab === 'lookups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-50 duration-200">
          
          {/* Categories */}
          <Card className="shadow-sm border-border/60">
            <CardHeader>
              <CardTitle>ประเภททรัพย์สิน (Asset Categories)</CardTitle>
              <CardDescription>จัดการประเภทอุปกรณ์สำหรับเลือกในฟอร์มและตัวกรอง</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                <Input 
                  placeholder="ชื่อประเภทอุปกรณ์ใหม่..." 
                  value={newCat} 
                  onChange={(e) => setNewCat(e.target.value)} 
                  required 
                />
                <Button type="submit" className="shrink-0 cursor-pointer">
                  <Plus className="h-4 w-4 mr-1.5" /> เพิ่ม
                </Button>
              </form>
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar border rounded-lg p-2 bg-muted/10">
                {categories.length === 0 ? (
                  <p className="text-center py-6 text-xs text-muted-foreground">ยังไม่มีรายการ</p>
                ) : (
                  categories.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-2.5 hover:bg-muted/50 rounded-md group transition-colors">
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteItem('categories', c.id, c.name)} 
                        className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-opacity"
                        title="ลบประเภท"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Departments */}
          <Card className="shadow-sm border-border/60">
            <CardHeader>
              <CardTitle>แผนกและสังกัด (Departments)</CardTitle>
              <CardDescription>จัดการรายชื่อแผนกและสถานที่ภายในบริษัท</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddDept} className="flex gap-2 mb-4">
                <Input 
                  placeholder="ชื่อแผนกใหม่..." 
                  value={newDept} 
                  onChange={(e) => setNewDept(e.target.value)} 
                  required 
                />
                <Button type="submit" className="shrink-0 cursor-pointer">
                  <Plus className="h-4 w-4 mr-1.5" /> เพิ่ม
                </Button>
              </form>
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar border rounded-lg p-2 bg-muted/10">
                {departments.length === 0 ? (
                  <p className="text-center py-6 text-xs text-muted-foreground">ยังไม่มีรายการ</p>
                ) : (
                  departments.map(d => (
                    <div key={d.id} className="flex justify-between items-center p-2.5 hover:bg-muted/50 rounded-md group transition-colors">
                      <span className="text-sm font-medium text-foreground">{d.name}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteItem('departments', d.id, d.name)} 
                        className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-opacity"
                        title="ลบแผนก"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
