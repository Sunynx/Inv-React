'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface LabelTemplateConfig {
  id: string;
  name: string;
  category: 'thermal' | 'a4' | 'custom';
  widthMm: number;
  heightMm: number;
  description: string;
  recommendedFor?: string;
}

export interface LabelFieldOptions {
  showLogo: boolean;
  showCompanyName: boolean;
  companyName: string;
  showAssetCode: boolean;
  showAssetName: boolean;
  showDepartment: boolean;
  showSerial: boolean;
  showLocation: boolean;
  showBorder: boolean;
  qrType: 'url' | 'text';
  qrSizePercent: number; // percentage of label height
}

export const STANDARD_LABEL_TEMPLATES: LabelTemplateConfig[] = [
  {
    id: '50x25',
    name: '50 x 25 mm',
    category: 'thermal',
    widthMm: 50,
    heightMm: 25,
    description: 'ขนาดยอดนิยมสูงสุดสำหรับเครื่องพิมพ์ความร้อนแบบม้วน (Standard Asset Tag)',
    recommendedFor: 'โน้ตบุ๊ก, คอมพิวเตอร์, ปริ้นเตอร์, จอภาพ'
  },
  {
    id: '40x30',
    name: '40 x 30 mm',
    category: 'thermal',
    widthMm: 40,
    heightMm: 30,
    description: 'ขนาดสี่เหลี่ยมกะทัดรัด สำหรับอุปกรณ์ขนาดเล็ก',
    recommendedFor: 'เมาส์, คีย์บอร์ด, อะแดปเตอร์, อุปกรณ์พกพา'
  },
  {
    id: '50x30',
    name: '50 x 30 mm',
    category: 'thermal',
    widthMm: 50,
    heightMm: 30,
    description: 'ขนาดกลาง พื้นที่พอเหมาะ มีพื้นที่ใส่ชื่อและแผนกชัดเจน',
    recommendedFor: 'อุปกรณ์สำนักงานทั่วไป'
  },
  {
    id: '60x40',
    name: '60 x 40 mm',
    category: 'thermal',
    widthMm: 60,
    heightMm: 40,
    description: 'ขนาดใหญ่ อ่านง่าย เห็นชัดเจนจากระยะไกล',
    recommendedFor: 'Server, Switch Rack, เคส PC, เครื่องจักร'
  },
  {
    id: '70x50',
    name: '70 x 50 mm',
    category: 'thermal',
    widthMm: 70,
    heightMm: 50,
    description: 'ขนาดใหญ่พิเศษ สำหรับใส่สเปกและข้อมูลละเอียด',
    recommendedFor: 'ตู้ Rack, ทรัพย์สินขนาดใหญ่'
  },
  {
    id: 'a4_3x8',
    name: 'A4 (3 x 8 = 24 ป้าย)',
    category: 'a4',
    widthMm: 70,
    heightMm: 37,
    description: 'สติกเกอร์แผ่นสำเร็จรูป A4 (24 ดวงต่อแผ่น ตราช้าง A4-24)',
    recommendedFor: 'พิมพ์ด้วย Laser / Inkjet ทั่วไป'
  },
  {
    id: 'a4_2x7',
    name: 'A4 (2 x 7 = 14 ป้าย)',
    category: 'a4',
    widthMm: 99.1,
    heightMm: 38.1,
    description: 'สติกเกอร์แผ่นสำเร็จรูป A4 ขนาดกลาง (14 ดวงต่อแผ่น)',
    recommendedFor: 'พิมพ์ด้วย Laser / Inkjet ทั่วไป'
  },
  {
    id: 'custom',
    name: 'กำหนดขนาดเอง (Custom Size)',
    category: 'custom',
    widthMm: 50,
    heightMm: 25,
    description: 'ระบุความกว้างและความสูงเป็นมิลลิเมตรตามม้วนสติกเกอร์ที่มี'
  }
];

export const DEFAULT_LABEL_OPTIONS: LabelFieldOptions = {
  showLogo: true,
  showCompanyName: true,
  companyName: 'ROYAL PHUKET MARINA',
  showAssetCode: true,
  showAssetName: true,
  showDepartment: true,
  showSerial: true,
  showLocation: false,
  showBorder: true,
  qrType: 'url',
  qrSizePercent: 82
};

interface AssetLabelStickerProps {
  asset: {
    id?: string;
    asset_code?: string;
    name?: string;
    serial_number?: string;
    location?: string;
    departments?: { name?: string } | null;
    department_name?: string;
  };
  template: LabelTemplateConfig;
  options: LabelFieldOptions;
  scale?: number; // Visual preview scaling factor (e.g. 1.0, 1.5, 2.0)
  className?: string;
}

export default function AssetLabelSticker({
  asset,
  template,
  options,
  scale = 1,
  className = ''
}: AssetLabelStickerProps) {
  const assetCode = asset.asset_code || 'RPM-XXXX-000';
  const assetName = asset.name || 'Unknown Asset';
  const deptName = asset.departments?.name || asset.department_name || '';
  const serialNo = asset.serial_number || '';
  const location = asset.location || '';

  const qrValue = options.qrType === 'url' && typeof window !== 'undefined'
    ? `${window.location.origin}/scan?code=${encodeURIComponent(assetCode)}`
    : assetCode;

  // Approximate pixel conversion: 1mm ~ 3.78px at 96 DPI screen
  // When printing, CSS millimeters (mm) are exact
  const widthPx = template.widthMm * 3.78 * scale;
  const heightPx = template.heightMm * 3.78 * scale;

  // Calculate layout proportion based on aspect ratio
  const isCompact = template.widthMm <= 40 || template.heightMm <= 25;
  const isLarge = template.widthMm >= 60 && template.heightMm >= 40;
  
  // Calculate QR size
  const qrBoxSizePx = Math.min(heightPx * (options.qrSizePercent / 100), widthPx * 0.45);

  return (
    <div
      className={`label-sticker-item bg-white text-black relative flex select-none box-border overflow-hidden ${
        options.showBorder ? 'border border-dashed border-neutral-300' : 'border-0'
      } ${className}`}
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        padding: `${Math.max(2 * scale, 3)}px ${Math.max(4 * scale, 4)}px`,
      }}
    >
      <div className="w-full h-full flex flex-row items-center gap-2">
        {/* Left Side: High Contrast QR Code */}
        <div 
          className="shrink-0 flex items-center justify-center bg-white p-0.5 rounded"
          style={{ width: `${qrBoxSizePx}px`, height: `${qrBoxSizePx}px` }}
        >
          <QRCodeSVG
            value={qrValue}
            size={qrBoxSizePx}
            level="M"
            includeMargin={false}
            imageSettings={options.showLogo ? {
              src: "/logorpm.png",
              height: qrBoxSizePx * 0.22,
              width: qrBoxSizePx * 0.22,
              excavate: true,
            } : undefined}
          />
        </div>

        {/* Right Side: Text Information */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
          {/* Header: Company Name / Logo */}
          {options.showCompanyName && (
            <div 
              className="font-bold tracking-wider text-neutral-600 truncate uppercase flex items-center gap-1"
              style={{ fontSize: `${Math.max(6 * scale, 7)}px`, lineHeight: 1.1 }}
            >
              <span>{options.companyName}</span>
            </div>
          )}

          {/* Primary: Asset Code */}
          {options.showAssetCode && (
            <div 
              className="font-mono font-extrabold text-black tracking-tight leading-none break-all line-clamp-1"
              style={{ fontSize: `${Math.max(isCompact ? 9 * scale : 12 * scale, 9)}px` }}
            >
              {assetCode}
            </div>
          )}

          {/* Asset Name */}
          {options.showAssetName && (
            <div 
              className="font-medium text-neutral-800 line-clamp-2 leading-tight"
              style={{ fontSize: `${Math.max(isCompact ? 6.5 * scale : 8 * scale, 7)}px` }}
            >
              {assetName}
            </div>
          )}

          {/* Metadata Footer: Dept / Serial / Location */}
          <div 
            className="flex flex-wrap gap-x-2 gap-y-0.5 text-neutral-600 font-medium"
            style={{ fontSize: `${Math.max(5.5 * scale, 6.5)}px`, lineHeight: 1.1 }}
          >
            {options.showDepartment && deptName && (
              <span className="truncate">แผนก: {deptName}</span>
            )}
            {options.showSerial && serialNo && (
              <span className="truncate">S/N: {serialNo}</span>
            )}
            {options.showLocation && location && (
              <span className="truncate">ที่ตั้ง: {location}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
