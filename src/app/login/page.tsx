'use client';
import { useState } from 'react';
import { Playfair_Display } from 'next/font/google';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['600', '700'] });

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulating login since Supabase Auth isn't fully configured yet
    setTimeout(() => {
      setIsLoading(false);
      toast.success('Welcome back!');
      router.push('/');
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/40 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-100/50 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-indigo-100/50 blur-[100px]" />
      </div>

      <div className="w-full max-w-md p-8 z-10">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-border/50 overflow-hidden relative">
          {/* Header */}
          <div className="bg-[#1b365d] p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2" />
            <div className={cn("text-5xl tracking-tighter text-white mb-2 relative z-10", playfair.className)}>
              rpm
            </div>
            <div className="flex justify-center gap-1 leading-tight tracking-[0.2em] text-[10px] font-medium text-white/80 uppercase relative z-10">
              <span>Royal</span>
              <span>•</span>
              <span>Phuket</span>
              <span>•</span>
              <span>Marina</span>
            </div>
            <p className="text-white/60 text-sm mt-6 relative z-10 font-medium">IT Asset Management System</p>
          </div>

          {/* Form */}
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
              <p className="text-slate-500 text-sm mt-1">Please sign in to your account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="admin@rpm.com" 
                    className="pl-10 h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-600 transition-shadow"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Password</Label>
                  <a href="#" className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">Forgot password?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-11 bg-slate-50 border-slate-200 focus-visible:ring-blue-600 transition-shadow"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-[#1b365d] hover:bg-[#1b365d]/90 text-white rounded-lg shadow-md shadow-blue-900/20 transition-all active:scale-[0.98] mt-2 group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-6 font-medium">
          © {new Date().getFullYear()} Royal Phuket Marina. All rights reserved.
        </p>
      </div>
    </div>
  );
}
