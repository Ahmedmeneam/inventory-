import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { validatePasswordStrength } from '../utils/rules.ts';
import { ShieldCheck, Building2, User, Mail, Lock, Check, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';

interface SetupWizardPageProps {
  onSetupSuccess: (companyName: string) => void;
}

export const SetupWizardPage: React.FC<SetupWizardPageProps> = ({ onSetupSuccess }) => {
  const { login } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live password validation criteria
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const passwordsMatch = password && password === confirmPassword;
  const isFormValid =
    companyName.trim().length >= 2 &&
    adminName.trim().length >= 3 &&
    hasMinLength &&
    hasUpper &&
    hasLower &&
    hasDigit &&
    hasSpecial &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim() || undefined,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشلت عملية تهيئة النظام');
      }

      // Log in as the first Admin
      login(data.user);
      onSetupSuccess(companyName.trim());
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 dir-rtl font-sans selection:bg-indigo-500 selection:text-white">
      {/* Container */}
      <div className="max-w-xl w-full bg-white dark:bg-slate-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Wizard Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 mb-3">
              <Sparkles className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              معالج التهيئة الأولي لنظام العهد والمخازن
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-md">
              الإصدار 6.7 المعتمد • البدء النظيف وقفل المعالج لمرة واحدة حصرية
            </p>
          </div>
        </div>

        {/* Wizard Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Company Details Section */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. بيانات المنشأة التأسيسية
            </h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                اسم المنشأة أو الشركة المعتمد *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="مثال: شركة الصناعات الهندسية المتطورة"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <Building2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>
          </div>

          {/* Admin Account Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                2. حساب مسؤول النظام الأول (الأدمن)
              </h2>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                الكود المخصص: ADM-001
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المسؤول ثلاثياً *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد عبد الرحمن حسن"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  البريد الإلكتروني (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="admin@company.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dir-ltr text-left"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور القوية *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تأكيد كلمة المرور *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>
            </div>

            {/* Password Criteria Checklist */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px]">
              <span className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                شروط كلمة المرور المؤسسية:
              </span>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-500 dark:text-slate-400">
                <div className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}`}>
                  <Check className={`w-3.5 h-3.5 ${hasMinLength ? 'opacity-100' : 'opacity-30'}`} />
                  <span>8 خانات على الأقل</span>
                </div>
                <div className={`flex items-center gap-1 ${hasUpper ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}`}>
                  <Check className={`w-3.5 h-3.5 ${hasUpper ? 'opacity-100' : 'opacity-30'}`} />
                  <span>حرف كبير (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1 ${hasLower ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}`}>
                  <Check className={`w-3.5 h-3.5 ${hasLower ? 'opacity-100' : 'opacity-30'}`} />
                  <span>حرف صغير (a-z)</span>
                </div>
                <div className={`flex items-center gap-1 ${hasDigit ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}`}>
                  <Check className={`w-3.5 h-3.5 ${hasDigit ? 'opacity-100' : 'opacity-30'}`} />
                  <span>رقم (0-9)</span>
                </div>
                <div className={`flex items-center gap-1 col-span-2 ${hasSpecial ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}`}>
                  <Check className={`w-3.5 h-3.5 ${hasSpecial ? 'opacity-100' : 'opacity-30'}`} />
                  <span>رمز خاص (!@#$%^&*...)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isFormValid && !isSubmitting
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25 active:scale-[0.99]'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <span>جارٍ تهيئة وتأمين النظام...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>إتمام التهيئة وبدء تشغيل النظام</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              * يُقفل هذا المعالج نهائياً بعد الحفظ لضمان سلامة وأمان النظام
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
