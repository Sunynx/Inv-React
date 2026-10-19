'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Database, Sliders, ShieldCheck, HardDrive, Smartphone, Download, Share, PlusSquare, Monitor, CheckCircle2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import BackupManager from '@/components/BackupManager';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'backup' | 'lookups' | 'pwa'>('backup');
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

        <button
          type="button"
          onClick={() => setActiveTab('pwa')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'pwa'
              ? 'bg-background text-foreground shadow-sm font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Smartphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span>ติดตั้งแอปมือถือ (PWA App)</span>
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

      {/* Tab 3: PWA Mobile App */}
      {activeTab === 'pwa' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          
          {/* Hero App Card */}
          <Card className="border-border/60 bg-gradient-to-r from-blue-900/10 via-background to-purple-900/10 shadow-sm overflow-hidden">
            <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-[#1b365d] p-3 shadow-xl shrink-0 border border-white/10 flex items-center justify-center">
                  <img src="/icons/icon-192x192.png" alt="RPM IT App Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">RPM IT Inventory Mobile App</h2>
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs">PWA Ready</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                    ติดตั้งเว็บนี้เป็นแอปพลิเคชันลงในมือถือ iPhone, iPad หรือ Android ได้ทันทีโดยไม่ต้องผ่าน App Store หรือ Play Store
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <Button 
                  onClick={() => {
                    const evt = new CustomEvent('pwa-prompt-install');
                    window.dispatchEvent(evt);
                    toast('หากใช้เบราว์เซอร์ Chrome/Edge หรือมือถือ จะมีปุ่มขึ้นให้กดยืนยันติดตั้งครับ');
                  }}
                  className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md cursor-pointer h-10 px-5"
                >
                  <Download className="h-4 w-4" />
                  ติดตั้งแอปพลิเคชัน
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Installation Instructions by Platform */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* iOS */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3 bg-muted/20 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  iPhone &amp; iPad (iOS)
                </CardTitle>
                <CardDescription className="text-xs">ติดตั้งผ่าน Safari ใน 2 สเต็ป</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg shrink-0">
                    <Share className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">1. แตะปุ่มแชร์ (Share):</span>
                    <p className="text-muted-foreground mt-0.5">เปิดหน้านี้ใน Safari แล้วกดที่ไอคอนปุ่มสี่เหลี่ยมลูกศรชี้ขึ้นที่แถบเมนูด้านล่าง</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg shrink-0">
                    <PlusSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">2. เพิ่มไปยังหน้าจอโฮม:</span>
                    <p className="text-muted-foreground mt-0.5">เลื่อนลงมาแล้วกดเลือก <b>"Add to Home Screen (เพิ่มไปยังหน้าจอโฮม)"</b></p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Android */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3 bg-muted/20 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  Android (Chrome / Samsung)
                </CardTitle>
                <CardDescription className="text-xs">ติดตั้งเป็น WebAPK ใน 1 คลิก</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg shrink-0">
                    <Download className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">1. แถบแจ้งเตือนด้านล่าง:</span>
                    <p className="text-muted-foreground mt-0.5">แตะที่ปุ่ม <b>"ติดตั้งแอป RPM IT"</b> ที่เด้งขึ้นมาด้านล่างหน้าจอ</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">2. หรือผ่านเมนู 3 จุด (⋮):</span>
                    <p className="text-muted-foreground mt-0.5">กดเมนูมุมบนขวาใน Chrome แล้วเลือก <b>"Install App (ติดตั้งแอป)"</b></p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Windows / Mac */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3 bg-muted/20 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-indigo-600" />
                  PC (Windows &amp; Mac)
                </CardTitle>
                <CardDescription className="text-xs">ติดตั้งบน Desktop เหมือนโปรแกรมจริง</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-lg shrink-0">
                    <Download className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">1. ไอคอนที่แถบ URL:</span>
                    <p className="text-muted-foreground mt-0.5">สังเกตไอคอนรูปคอมพิวเตอร์ <code className="bg-muted px-1 rounded">⤓</code> ที่มุมขวาของแถบพิมพ์ URL ใน Chrome หรือ Edge</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-lg shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">2. เปิดแยกหน้าต่างอิสระ:</span>
                    <p className="text-muted-foreground mt-0.5">เมื่อติดตั้งแล้วจะมีไอคอนลัดบน Desktop และ Taskbar เปิดใช้งานได้เต็มหน้าจอ</p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Features Benefit */}
          <Card className="border-border/60 bg-muted/10 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">ข้อดีเมื่อติดตั้งเป็นแอป (App Experience):</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-card rounded-xl border border-border/60 space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span>เปิดไวทันใจ</span>
                  </div>
                  <p className="text-muted-foreground">มี Service Worker แคชไฟล์ระบบและไอคอนล่วงหน้า เปิดหน้าจอได้เร็วทันที</p>
                </div>

                <div className="p-3 bg-card rounded-xl border border-border/60 space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-blue-500" />
                    <span>เต็มหน้าจอ ไม่มีแถบกวนใจ</span>
                  </div>
                  <p className="text-muted-foreground">แสดงผลแบบ Standalone เต็มจอ ไม่มี Address bar หรือแถบของเบราว์เซอร์</p>
                </div>

                <div className="p-3 bg-card rounded-xl border border-border/60 space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>สแกนกล้องลื่นไหล</span>
                  </div>
                  <p className="text-muted-foreground">เข้าถึงฮาร์ดแวร์กล้องมือถือได้โดยตรง เปิดสแกน QR Code ตรวจสต็อกได้รวดเร็ว</p>
                </div>

                <div className="p-3 bg-card rounded-xl border border-border/60 space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <PlusSquare className="h-4 w-4 text-purple-500" />
                    <span>เมนูลัด (Shortcuts)</span>
                  </div>
                  <p className="text-muted-foreground">กดค้างที่ไอคอนแอปบนหน้าจอมือถือเพื่อเข้าสู่เมนู "สแกน QR" หรือ "แจ้งซ่อม" ได้ทันที</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
