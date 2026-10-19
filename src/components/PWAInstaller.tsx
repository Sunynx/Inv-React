'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle, Share, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('PWA Service Worker registered successfully:', reg.scope);
          })
          .catch((err) => {
            console.log('Service Worker registration failed:', err);
          });
      });
    }

    // 2. Check if already installed / running as standalone PWA
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    setIsStandalone(isStandaloneMode);

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 4. Capture 'beforeinstallprompt' for Android/Chrome/Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);

      // Check if user dismissed banner previously
      const dismissed = sessionStorage.getItem('rpm_pwa_banner_dismissed');
      if (!dismissed && !isStandaloneMode) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Track when successfully installed
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setShowBanner(false);
      setDeferredPrompt(null);
      toast.success('ติดตั้งแอป RPM IT ลงในเครื่องสำเร็จแล้ว!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) {
      toast('หากใช้เบราว์เซอร์บนคอมพิวเตอร์ สามารถติดตั้งผ่านไอคอนรูปคอมพิวเตอร์ที่แถบ URL หรือเมนูของเบราว์เซอร์ได้ครับ');
      return;
    }

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        toast.success('กำลังติดตั้งแอปพลิเคชัน...');
      }
      setDeferredPrompt(null);
      setShowBanner(false);
    } catch (e) {
      console.error('PWA install error:', e);
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    sessionStorage.setItem('rpm_pwa_banner_dismissed', 'true');
  };

  // If already running standalone, no need to show install banner
  if (isStandalone) return null;

  return (
    <>
      {/* Floating Install Notification Banner (Mobile / Desktop) */}
      {showBanner && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in slide-in-from-bottom-5 duration-300 print:hidden">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 flex items-start gap-3.5 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-[#1b365d] p-1.5 flex items-center justify-center shrink-0 border border-white/10 shadow-sm">
              <img src="/icons/icon-192x192.png" alt="RPM IT" className="w-full h-full object-contain" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-sm text-white">ติดตั้งแอป RPM IT</h4>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 font-semibold">PWA</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                ติดตั้งบนหน้าจอมือถือ เปิดใช้งานได้รวดเร็วเต็มหน้าจอ และสแกน QR Code ได้ทันที
              </p>

              <div className="flex items-center gap-2 mt-3">
                <Button 
                  size="sm" 
                  onClick={handleInstallClick} 
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-3 shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  ติดตั้งทันที
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleDismissBanner} 
                  className="h-8 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  ไว้ทีหลัง
                </Button>
              </div>
            </div>

            <button 
              onClick={handleDismissBanner}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
              title="ปิด"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-[#1b365d] p-2 mx-auto flex items-center justify-center shadow-md">
                <img src="/icons/icon-192x192.png" alt="RPM IT" className="w-full h-full object-contain" />
              </div>
              <h3 className="font-bold text-base mt-2">วิธีติดตั้งบน iPhone / iPad</h3>
              <p className="text-xs text-muted-foreground">ติดตั้งผ่านเบราว์เซอร์ Safari ได้ง่ายๆ ใน 2 ขั้นตอน:</p>
            </div>

            <div className="space-y-3 bg-muted/40 p-4 rounded-xl border border-border/50 text-xs">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg shrink-0 mt-0.5">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-foreground">ขั้นตอนที่ 1:</span>
                  <p className="text-muted-foreground mt-0.5">แตะที่ปุ่ม <span className="font-semibold text-foreground">"แชร์" (Share)</span> ที่แถบเมนูด้านล่างของ Safari</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pt-2 border-t border-border/40">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg shrink-0 mt-0.5">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-foreground">ขั้นตอนที่ 2:</span>
                  <p className="text-muted-foreground mt-0.5">เลื่อนลงมาแล้วเลือก <span className="font-semibold text-foreground">"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</span></p>
                </div>
              </div>
            </div>

            <Button onClick={() => setShowIOSModal(false)} className="w-full text-xs font-semibold">
              เข้าใจแล้ว
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
