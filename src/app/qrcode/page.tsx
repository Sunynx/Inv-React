'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Printer, 
  Search, 
  CheckSquare, 
  Square, 
  Sliders, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Tag,
  Check,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import AssetLabelSticker, { 
  STANDARD_LABEL_TEMPLATES, 
  DEFAULT_LABEL_OPTIONS, 
  LabelTemplateConfig, 
  LabelFieldOptions 
} from '@/components/AssetLabelSticker';

export default function QRCodePage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedAssets, setSelectedAssets] = useState<any[]>([]);
  const [previewAssetIndex, setPreviewAssetIndex] = useState(0);

  // Template & Customization
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('50x25');
  const [customWidth, setCustomWidth] = useState(50);
  const [customHeight, setCustomHeight] = useState(25);
  const [options, setOptions] = useState<LabelFieldOptions>(DEFAULT_LABEL_OPTIONS);
  const [previewScale, setPreviewScale] = useState(2.0); // 2x for clear preview

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      setLoading(true);
      const [assetsRes, deptsRes] = await Promise.all([
        supabase
          .from('assets')
          .select('id, name, asset_code, serial_number, location, department_id, departments(name)')
          .order('created_at', { ascending: false }),
        supabase.from('departments').select('id, name').order('name')
      ]);

      if (assetsRes.error) throw assetsRes.error;
      const loadedAssets = assetsRes.data || [];
      setAssets(loadedAssets);
      setDepartments(deptsRes.data || []);

      // Default select first 5 assets for quick preview
      if (loadedAssets.length > 0) {
        setSelectedAssets(loadedAssets.slice(0, 4));
      }
    } catch (err: any) {
      toast.error('ไม่สามารถโหลดข้อมูลอุปกรณ์ได้: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Active Template
  const activeTemplate = useMemo<LabelTemplateConfig>(() => {
    const found = STANDARD_LABEL_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (found && found.id !== 'custom') return found;
    return {
      id: 'custom',
      name: `Custom (${customWidth} x ${customHeight} mm)`,
      category: 'custom',
      widthMm: customWidth,
      heightMm: customHeight,
      description: 'ขนาดสติกเกอร์ที่กำหนดเอง'
    };
  }, [selectedTemplateId, customWidth, customHeight]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchSearch = 
        !searchTerm ||
        a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.asset_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchDept = selectedDeptId === 'all' || a.department_id === selectedDeptId;

      return matchSearch && matchDept;
    });
  }, [assets, searchTerm, selectedDeptId]);

  const toggleSelect = (asset: any) => {
    if (selectedAssets.find(a => a.id === asset.id)) {
      setSelectedAssets(selectedAssets.filter(a => a.id !== asset.id));
    } else {
      setSelectedAssets([...selectedAssets, asset]);
    }
  };

  const selectAll = () => {
    if (selectedAssets.length === filteredAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets([...filteredAssets]);
    }
  };

  // Printing execution
  const handlePrint = () => {
    if (selectedAssets.length === 0) {
      toast.error('กรุณาเลือกอุปกรณ์ที่ต้องการพิมพ์สติกเกอร์อย่างน้อย 1 ชิ้น');
      return;
    }
    window.print();
  };

  const currentPreviewAsset = selectedAssets[previewAssetIndex] || selectedAssets[0] || assets[0] || {
    asset_code: 'RPM-IT-001',
    name: 'Dell Latitude 5540',
    departments: { name: 'IT Department' },
    serial_number: 'SN-987654321',
    location: 'Server Room'
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      
      {/* Dynamic Print Styles for exact millimeter output */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Hide all application elements */
          body * {
            visibility: hidden;
          }
          /* Show only the print area */
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
          }

          ${activeTemplate.category === 'thermal' || activeTemplate.category === 'custom' ? `
            @page {
              size: ${activeTemplate.widthMm}mm ${activeTemplate.heightMm}mm;
              margin: 0mm;
            }
            .print-thermal-container {
              display: block;
            }
            .print-label-item {
              width: ${activeTemplate.widthMm}mm !important;
              height: ${activeTemplate.heightMm}mm !important;
              page-break-after: always;
              break-after: page;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              overflow: hidden;
            }
          ` : `
            @page {
              size: A4 portrait;
              margin: 8mm 6mm;
            }
            .print-a4-grid {
              display: grid !important;
              grid-template-columns: ${activeTemplate.id === 'a4_3x8' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'} !important;
              gap: 2mm 3mm !important;
              page-break-after: always;
            }
            .print-label-item {
              width: ${activeTemplate.widthMm}mm !important;
              height: ${activeTemplate.heightMm}mm !important;
              page-break-inside: avoid;
              break-inside: avoid;
              margin: 0 !important;
              box-shadow: none !important;
            }
          `}
        }
      `}} />

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">สตูดิโอพิมพ์สติกเกอร์ทรัพย์สิน (Label Studio)</h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              Thermal &amp; A4 Ready
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            ออกแบบและพิมพ์สติกเกอร์ติดอุปกรณ์ตามขนาดจริง รองรับเครื่องพิมพ์ความร้อน (Brother, Zebra, Xprinter) และกระดาษสติกเกอร์ A4
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handlePrint} 
            disabled={selectedAssets.length === 0}
            size="lg"
            className="gap-2 shadow-md bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer"
          >
            <Printer className="h-5 w-5" />
            สั่งพิมพ์สติกเกอร์ ({selectedAssets.length} ดวง)
          </Button>
        </div>
      </div>

      {/* Main 3-Column Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        
        {/* Left Column: Asset Selection (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-sm border-border flex flex-col h-[750px]">
            <CardHeader className="p-4 pb-3 border-b bg-muted/20 space-y-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  เลือกอุปกรณ์ที่จะพิมพ์
                </CardTitle>
                <Badge variant="secondary" className="font-mono">
                  {selectedAssets.length} / {filteredAssets.length}
                </Badge>
              </div>

              {/* Search & Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="ค้นหาชื่อ, รหัส, Serial No..." 
                    className="pl-9 h-9 text-xs bg-background"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <select
                    className="text-xs h-8 rounded-md border border-input bg-background px-2 py-1 text-foreground flex-1"
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                  >
                    <option value="all">ทุกแผนก ({departments.length})</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={selectAll} 
                    className="h-8 text-xs text-primary px-2 cursor-pointer"
                  >
                    {selectedAssets.length === filteredAssets.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Asset List */}
            <CardContent className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground text-xs">กำลังโหลดรายการอุปกรณ์...</div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไข</div>
              ) : (
                filteredAssets.map(asset => {
                  const isSelected = selectedAssets.some(a => a.id === asset.id);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => toggleSelect(asset)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                        isSelected 
                          ? 'bg-primary/5 border-primary/40 shadow-xs' 
                          : 'hover:bg-muted/50 border-border/70'
                      }`}
                    >
                      <div className="pt-0.5 shrink-0">
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-mono font-bold text-foreground truncate">{asset.asset_code}</span>
                          {asset.departments?.name && (
                            <span className="text-[10px] text-muted-foreground truncate">{asset.departments.name}</span>
                          )}
                        </div>
                        <div className="text-muted-foreground truncate mt-0.5">{asset.name}</div>
                        {asset.serial_number && (
                          <div className="text-[10px] text-muted-foreground/80 font-mono truncate">S/N: {asset.serial_number}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center & Right Column: Template & Live Preview (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Live Preview Card */}
          <Card className="shadow-sm border-border bg-card overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  ตัวอย่างสติกเกอร์ขนาดจริง (Live Preview)
                </CardTitle>
                <CardDescription className="text-xs">
                  ขนาดแม่แบบ: <span className="font-bold text-foreground">{activeTemplate.name}</span> ({activeTemplate.widthMm} x {activeTemplate.heightMm} mm)
                </CardDescription>
              </div>

              {/* Navigation across preview assets */}
              {selectedAssets.length > 1 && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => setPreviewAssetIndex(prev => (prev > 0 ? prev - 1 : selectedAssets.length - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs font-mono font-medium text-muted-foreground">
                    {previewAssetIndex + 1} / {selectedAssets.length}
                  </span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => setPreviewAssetIndex(prev => (prev < selectedAssets.length - 1 ? prev + 1 : 0))}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-8 flex flex-col items-center justify-center bg-slate-100/70 dark:bg-slate-900/40 min-h-[220px]">
              {/* Scaled Sticker Preview */}
              <div className="p-4 bg-white rounded-xl shadow-lg border border-slate-300 flex items-center justify-center">
                <AssetLabelSticker 
                  asset={currentPreviewAsset}
                  template={activeTemplate}
                  options={options}
                  scale={previewScale}
                />
              </div>

              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-medium">ซูมดูตัวอย่าง:</span>
                <div className="flex gap-1.5">
                  {[1.0, 1.5, 2.0, 2.5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPreviewScale(s)}
                      className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                        previewScale === s 
                          ? 'bg-primary text-primary-foreground font-bold' 
                          : 'bg-muted hover:bg-muted/80 text-foreground'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Template Configuration & Size Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Template Presets */}
            <Card className="shadow-sm border-border">
              <CardHeader className="p-4 pb-2 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  1. เลือกขนาดสติกเกอร์ (Label Size Presets)
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-2.5">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">เครื่องพิมพ์ความร้อนแบบม้วน (Thermal Rolls):</p>
                  <div className="grid grid-cols-2 gap-2">
                    {STANDARD_LABEL_TEMPLATES.filter(t => t.category === 'thermal').map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(tmpl.id)}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                          selectedTemplateId === tmpl.id
                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 shadow-xs'
                            : 'hover:bg-muted/40 border-border'
                        }`}
                      >
                        <div className="font-bold text-foreground flex justify-between items-center">
                          <span>{tmpl.name}</span>
                          {selectedTemplateId === tmpl.id && <Check className="h-3.5 w-3.5 text-blue-600" />}
                        </div>
                        <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{tmpl.recommendedFor}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground">สติกเกอร์สำเร็จรูปแผ่น A4 (Sheet Labels):</p>
                  <div className="grid grid-cols-2 gap-2">
                    {STANDARD_LABEL_TEMPLATES.filter(t => t.category === 'a4').map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(tmpl.id)}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                          selectedTemplateId === tmpl.id
                            ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 shadow-xs'
                            : 'hover:bg-muted/40 border-border'
                        }`}
                      >
                        <div className="font-bold text-foreground flex justify-between items-center">
                          <span>{tmpl.name}</span>
                          {selectedTemplateId === tmpl.id && <Check className="h-3.5 w-3.5 text-blue-600" />}
                        </div>
                        <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{tmpl.widthMm} x {tmpl.heightMm} mm</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateId('custom')}
                      className={`text-xs font-semibold cursor-pointer ${selectedTemplateId === 'custom' ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      + กำหนดขนาดเอง (Custom Dimension)
                    </button>
                  </div>
                  {selectedTemplateId === 'custom' && (
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                      <div className="flex-1">
                        <Label className="text-[11px]">กว้าง (Width mm)</Label>
                        <Input 
                          type="number" 
                          value={customWidth} 
                          onChange={(e) => setCustomWidth(Math.max(20, Number(e.target.value)))}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                      <span className="text-muted-foreground text-sm mt-5">x</span>
                      <div className="flex-1">
                        <Label className="text-[11px]">สูง (Height mm)</Label>
                        <Input 
                          type="number" 
                          value={customHeight} 
                          onChange={(e) => setCustomHeight(Math.max(15, Number(e.target.value)))}
                          className="h-8 text-xs mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Field Toggles & Appearance */}
            <Card className="shadow-sm border-border">
              <CardHeader className="p-4 pb-2 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  2. เลือกข้อมูลที่จะแสดงบนสติกเกอร์
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={options.showLogo} 
                      onChange={(e) => setOptions(prev => ({ ...prev, showLogo: e.target.checked }))} 
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>โลโก้ RPM ใน QR</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={options.showCompanyName} 
                      onChange={(e) => setOptions(prev => ({ ...prev, showCompanyName: e.target.checked }))} 
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>ชื่อหัวบริษัท</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={options.showAssetCode} 
                      onChange={(e) => setOptions(prev => ({ ...prev, showAssetCode: e.target.checked }))} 
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>รหัสทรัพย์สิน (Code)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={options.showAssetName} 
                      onChange={(e) => setOptions(prev => ({ ...prev, showAssetName: e.target.checked }))} 
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>ชื่ออุปกรณ์ (Name)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={options.showDepartment} 
                      onChange={(e) => setOptions(prev => ({ ...prev, showDepartment: e.target.checked }))} 
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>ชื่อแผนก (Department)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={options.showSerial} 
                      onChange={(e) => setOptions(prev => ({ ...prev, showSerial: e.target.checked }))} 
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>Serial Number (S/N)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={options.showLocation} 
                      onChange={(e) => setOptions(prev => ({ ...prev, showLocation: e.target.checked }))} 
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>สถานที่ / ห้อง</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={options.showBorder} 
                      onChange={(e) => setOptions(prev => ({ ...prev, showBorder: e.target.checked }))} 
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span>เส้นประขอบตัด</span>
                  </label>
                </div>

                <div className="space-y-1.5 pt-3 border-t text-xs">
                  <Label className="text-xs">ชื่อบริษัทหัวสติกเกอร์ (Header Text)</Label>
                  <Input 
                    value={options.companyName}
                    onChange={(e) => setOptions(prev => ({ ...prev, companyName: e.target.value }))}
                    className="h-8 text-xs uppercase"
                    placeholder="ROYAL PHUKET MARINA"
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t text-xs">
                  <Label className="text-xs">ปลายทางของ QR Code (QR Target)</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="qrType" 
                        checked={options.qrType === 'url'} 
                        onChange={() => setOptions(prev => ({ ...prev, qrType: 'url' }))}
                      />
                      <span>URL เปิดหน้าสแกน (/scan?code=...)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="qrType" 
                        checked={options.qrType === 'text'} 
                        onChange={() => setOptions(prev => ({ ...prev, qrType: 'text' }))}
                      />
                      <span>เฉพาะรหัส Text</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Tips for Thermal & A4 Printing */}
          <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-900 dark:text-blue-300 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">เคล็ดลับการตั้งค่าหน้าพิมพ์ (Print Dialog Settings):</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-800 dark:text-blue-400">
                <li><b>เครื่องพิมพ์ความร้อน (Thermal Roll):</b> เลือกกระดาษตามขนาดที่ตั้งไว้ และตั้งค่า Margins เป็น <b>"None" (ไม่มีระยะขอบ)</b> เพื่อให้พิมพ์ตรงเป๊ะ 1 ป้ายต่อ 1 ดวง</li>
                <li><b>เครื่องพิมพ์ธรรมดา (A4 Sheet):</b> ตั้งค่า Margins เป็น <b>"None" หรือ "Minimum"</b> และเปิดตัวเลือก "Background graphics"</li>
              </ul>
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* Hidden Print Container: Only rendered by browser when window.print() runs */}
      {/* ========================================================================= */}
      <div id="print-area" className="hidden print:block">
        {activeTemplate.category === 'thermal' || activeTemplate.category === 'custom' ? (
          <div className="print-thermal-container">
            {selectedAssets.map((asset) => (
              <div key={asset.id} className="print-label-item">
                <AssetLabelSticker 
                  asset={asset}
                  template={activeTemplate}
                  options={{ ...options, showBorder: false }} // no border when actually printing thermal
                  scale={1.0}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="print-a4-grid">
            {selectedAssets.map((asset) => (
              <div key={asset.id} className="print-label-item">
                <AssetLabelSticker 
                  asset={asset}
                  template={activeTemplate}
                  options={options}
                  scale={1.0}
                />
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
