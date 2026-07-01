'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'ยืนยันการดำเนินการ',
  description = 'คุณแน่ใจหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const iconColors = {
    danger: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    info: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
  };

  const buttonColors = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center text-center py-4 space-y-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${iconColors[variant]}`}>
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
          </div>
          <div className="flex gap-3 pt-2 w-full justify-center">
            <Button variant="outline" onClick={onClose} disabled={isLoading} className="min-w-[100px]">
              {cancelLabel}
            </Button>
            <Button onClick={onConfirm} disabled={isLoading} className={`min-w-[100px] ${buttonColors[variant]}`}>
              {isLoading ? 'กำลังดำเนินการ...' : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
