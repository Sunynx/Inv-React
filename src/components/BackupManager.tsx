'use client';

import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Archive, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  HardDrive, 
  Copy, 
  Check, 
  Loader2, 
  ShieldCheck, 
  RefreshCw,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';
import { 
  fetchDatabaseStats, 
  runFullBackup, 
  runDatabaseBackup, 
  getDdlSchemaSql, 
  BackupProgress 
} from '@/lib/backupUtils';

export default function BackupManager() {
  const [stats, setStats] = useState<{
    counts: Record<string, number>;
    totalRecords: number;
    totalImagesEstimated: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  useEffect(() => {
    loadStats();
    try {
      const savedTime = localStorage.getItem('rpm_last_backup_time');
      if (savedTime) setLastBackupTime(savedTime);
    } catch {}
  }, []);

  async function loadStats() {
    try {
      setLoadingStats(true);
      const data = await fetchDatabaseStats();
      setStats(data);
    } catch (e) {
      console.error('Error fetching backup stats:', e);
    } finally {
      setLoadingStats(false);
    }
  }

  const handleFullBackup = async () => {
    if (isBackingUp) return;
    try {
      setIsBackingUp(true);
      await runFullBackup((p) => {
        setProgress(p);
      });
      const now = new Date().toISOString();
      setLastBackupTime(now);
      toast.success('ดาวน์โหลด Full Backup สำเร็จ!');
    } catch (err: any) {
      toast.error('การสำรองข้อมูลล้มเหลว: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDatabaseBackup = async () => {
    if (isBackingUp) return;
    try {
      setIsBackingUp(true);
      await runDatabaseBackup((p) => {
        setProgress(p);
      });
      const now = new Date().toISOString();
      setLastBackupTime(now);
      toast.success('ดาวน์โหลด Database Backup สำเร็จ!');
    } catch (err: any) {
      toast.error('การสำรองข้อมูลล้มเหลว: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleCopySchema = () => {
    const schemaSql = getDdlSchemaSql();
    navigator.clipboard.writeText(schemaSql);
    setCopiedSchema(true);
    toast.success('คัดลอก SQL Schema เรียบร้อย');
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card shadow-sm border-border/60">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <HardDrive className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">อุปกรณ์ทั้งหมด (Assets)</p>
              <h3 className="text-2xl font-bold text-foreground">
                {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : (stats?.counts['assets'] || 0).toLocaleString()}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border/60">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">ข้อมูลทั้งหมด (ทุกตาราง)</p>
              <h3 className="text-2xl font-bold text-foreground">
                {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : (stats?.totalRecords || 0).toLocaleString()} รายการ
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border/60">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">รูปภาพ & ลายเซ็นในระบบ</p>
              <h3 className="text-2xl font-bold text-foreground">
                {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : `~${stats?.totalImagesEstimated || 0}`} ไฟล์
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border-border/60">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">สำรองข้อมูลล่าสุด</p>
              <h3 className="text-sm font-semibold text-foreground mt-1">
                {lastBackupTime ? formatDateTime(lastBackupTime) : 'ยังไม่มีประวัติการสำรอง'}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar (Visible when backing up or recently completed) */}
      {progress && (
        <Card className={`border shadow-sm transition-all ${
          progress.stage === 'error' 
            ? 'border-destructive/50 bg-destructive/5' 
            : progress.stage === 'done' 
            ? 'border-emerald-500/50 bg-emerald-500/5' 
            : 'border-blue-500/50 bg-blue-500/5'
        }`}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 font-medium">
                {progress.stage === 'done' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : progress.stage === 'error' ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                )}
                <span>{progress.message}</span>
              </div>
              <span className="font-mono font-semibold text-foreground">{progress.percent}%</span>
            </div>

            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 rounded-full ${
                  progress.stage === 'done' 
                    ? 'bg-emerald-600' 
                    : progress.stage === 'error' 
                    ? 'bg-destructive' 
                    : 'bg-blue-600'
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            {progress.stage === 'done' && (
              <div className="flex justify-between items-center pt-2">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  ไฟล์ถูกดาวน์โหลดลงเครื่องของคุณแล้ว แนะนำให้นำไฟล์นี้ไปเก็บใน Google Drive หรือฮาร์ดดิสก์สำรอง
                </p>
                <Button variant="ghost" size="sm" onClick={() => setProgress(null)} className="h-7 text-xs">
                  ปิดกล่องนี้
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Backup Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Full Backup */}
        <Card className="relative overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-all shadow-sm flex flex-col justify-between">
          <div className="absolute top-3 right-3">
            <Badge className="bg-primary hover:bg-primary text-primary-foreground font-semibold">
              แนะนำมากที่สุด
            </Badge>
          </div>

          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                <Archive className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Full System Backup</CardTitle>
                <CardDescription>สำรองทั้งฐานข้อมูล + รูปภาพและเอกสารทั้งหมด</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground flex-1">
            <p>
              รวบรวมข้อมูลทุกอย่างไว้ในไฟล์ <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-bold">.zip</code> เดียว ประกอบด้วย:
            </p>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><b>ข้อมูล 18 ตาราง</b>: ในรูปแบบ JSON อย่างละเอียดและไฟล์ <code className="font-mono">restore.sql</code></span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><b>รูปภาพทั้งหมด</b>: ภาพอุปกรณ์, แกลเลอรีรูปถ่าย, และภาพลายเซ็นผู้รับมอบ</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><b>เอกสารแนบ</b>: ใบรับประกัน, เอกสาร PO/PR และไฟล์แนบที่เกี่ยวข้อง</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><b>คู่มือการกู้คืน</b>: ไฟล์ <code className="font-mono">README_RESTORE.txt</code> แนะนำวิธีนำข้อมูลกลับมาใช้</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter className="pt-2 border-t bg-muted/10">
            <Button 
              onClick={handleFullBackup} 
              disabled={isBackingUp}
              className="w-full gap-2 cursor-pointer font-medium"
            >
              {isBackingUp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังดำเนินการสำรองข้อมูล...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  ดาวน์โหลด Full Backup (.zip)
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Database Only */}
        <Card className="border border-border/60 hover:border-border transition-all shadow-sm flex flex-col justify-between">
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="font-medium">
              เร็วมาก (~2 วินาที)
            </Badge>
          </div>

          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Database Only Backup</CardTitle>
                <CardDescription>สำรองเฉพาะฐานข้อมูล (JSON &amp; SQL Dump)</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground flex-1">
            <p>
              เหมาะสำหรับสำรองข้อมูลเป็นประจำทุกสัปดาห์ รวดเร็ว ไม่ต้องรอดาวน์โหลดไฟล์รูปภาพ:
            </p>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <span><b>JSON ครบทุกตาราง</b>: เก็บประวัติการย้าย, ซ่อม, ค่าเสื่อม, สต็อก, Licenses</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <span><b>ไฟล์ SQL Restore</b>: รันคำสั่ง SQL เดียวเพื่อนำข้อมูลทั้งหมดเข้า Database ใหม่ได้ทันที</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <span><b>DDL Schema</b>: สคริปต์สร้างตารางใหม่เอี่ยมตั้งแต่ศูนย์</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter className="pt-2 border-t bg-muted/10">
            <Button 
              variant="outline"
              onClick={handleDatabaseBackup} 
              disabled={isBackingUp}
              className="w-full gap-2 cursor-pointer font-medium"
            >
              {isBackingUp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  ดาวน์โหลด Database (.zip)
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

      </div>

      {/* Disaster Recovery Guide & SQL Schema Reference */}
      <Card className="border-border/60 bg-muted/20 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-lg">แผนรับมือกรณีฉุกเฉิน (Disaster Recovery Plan)</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSchemaModal(true)}
              className="gap-1.5 text-xs cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              ดู SQL Schema สำหรับสร้าง Database ใหม่
            </Button>
          </div>
          <CardDescription>
            หากในอนาคต Database ของ Supabase ล่ม หรือต้องการย้ายระบบไปยังเซิร์ฟเวอร์ใหม่ สามารถกู้คืนได้ตามขั้นตอนนี้
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-card rounded-xl border border-border/60 space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs">1</span>
                <span>สร้างฐานข้อมูลใหม่</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                สร้างโปรเจกต์ใหม่ใน Supabase หรือ PostgreSQL จากนั้นนำไฟล์ <code className="text-primary font-mono">database/schema.sql</code> ไปรันใน SQL Editor เพื่อสร้างตารางทั้งหมด
              </p>
            </div>

            <div className="p-4 bg-card rounded-xl border border-border/60 space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs">2</span>
                <span>กู้คืนข้อมูลเดิม (Restore Data)</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                นำไฟล์ <code className="text-primary font-mono">database/restore.sql</code> ไปรันใน SQL Editor ระบบจะใส่ข้อมูลทุกรายการกลับคืนมา 100%
              </p>
            </div>

            <div className="p-4 bg-card rounded-xl border border-border/60 space-y-2">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs">3</span>
                <span>รูปภาพและเอกสาร</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                รูปภาพอุปกรณ์ทั้งหมดถูกจัดเก็บแยกเป็นโฟลเดอร์ตามรหัสทรัพย์สินใน <code className="text-primary font-mono">images/assets/</code> สามารถเปิดดูได้ทันทีโดยไม่ต้องต่ออินเทอร์เน็ต
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SQL Schema Preview Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">PostgreSQL / Supabase DDL Schema</h3>
                <p className="text-xs text-muted-foreground">สคริปต์สำหรับสร้างตารางทั้ง 18 ตารางของระบบ RPM IT Inventory</p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCopySchema} 
                  className="gap-1.5 text-xs cursor-pointer"
                >
                  {copiedSchema ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedSchema ? 'คัดลอกแล้ว!' : 'คัดลอก SQL'}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setShowSchemaModal(false)}
                  className="cursor-pointer"
                >
                  ปิด
                </Button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs bg-muted/30 custom-scrollbar">
              <pre className="text-foreground/90 whitespace-pre-wrap">{getDdlSchemaSql()}</pre>
            </div>

            <div className="p-3 border-t bg-muted/10 flex justify-between items-center text-xs text-muted-foreground">
              <span>สามารถคัดลอกไปรันใน Supabase SQL Editor ได้ทันที</span>
              <Button size="sm" onClick={() => setShowSchemaModal(false)}>ปิดหน้าต่าง</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
