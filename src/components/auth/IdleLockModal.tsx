import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Lock, Shield, Eye, EyeOff, Loader2, LogOut, AlertCircle } from 'lucide-react';

interface IdleLockModalProps {
  isOpen: boolean;
  onUnlock: () => void;
  reason?: 'idle' | 'manual';
}

export const IdleLockModal: React.FC<IdleLockModalProps> = ({
  isOpen,
  onUnlock,
  reason = 'idle',
}) => {
  const { user, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('يرجى إدخال كلمة المرور لفك القفل');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'كلمة المرور غير صحيحة');
      }

      setPassword('');
      setError(null);
      onUnlock();
    } catch (err: any) {
      setError(err.message || 'فشل فك قفل الشاشة');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6 text-center animate-in fade-in zoom-in duration-200">
        {/* Lock Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>

        {/* Title & Info */}
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {reason === 'idle' ? 'تم قفل الشاشة لعدم النشاط' : 'شاشة القفل الأمني'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {reason === 'idle'
              ? 'مضى 30 دقيقة من انعدام النشاط. حفاظاً على سرية البيانات المخزنية، يرجى إعادة إدخال كلمة المرور للعودة لجلستك.'
              : 'تم قفل الشاشة مؤقتاً لحماية مساحة العمل. أدخل كلمة المرور لاستئناف العمل.'}
          </p>
        </div>

        {/* User Card */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-right">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
              {user.user_code.split('-')[0]}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{user.full_name}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono" dir="ltr">
                {user.user_code}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
            {user.role === 'admin'
              ? 'مسؤول النظام'
              : user.role === 'supervisor'
              ? 'رئيس قسم'
              : 'أمين عهدة'}
          </span>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="space-y-4 text-right">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              كلمة المرور الحالية
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الخاصة بك..."
                autoFocus
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right pr-3.5 pl-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isVerifying || !password}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ التحقق...</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>فك قفل الشاشة والمتابعة</span>
              </>
            )}
          </button>
        </form>

        {/* Quick logout button */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-center">
          <button
            type="button"
            onClick={() => {
              logout();
            }}
            className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج والتبديل لحساب آخر</span>
          </button>
        </div>
      </div>
    </div>
  );
};
