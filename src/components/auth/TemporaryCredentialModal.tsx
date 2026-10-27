import React, { useState, useEffect } from 'react';
import { TemporaryCredentials } from '../../types/auth.ts';
import { ShieldAlert, Copy, Check, Printer, Clock, X, Lock, KeyRound } from 'lucide-react';

interface TemporaryCredentialModalProps {
  credentials: TemporaryCredentials | null;
  onClose: () => void;
}

export const TemporaryCredentialModal: React.FC<TemporaryCredentialModalProps> = ({
  credentials,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(120);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  useEffect(() => {
    if (!credentials) return;
    setSecondsLeft(120);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose(); // Automatically erase when 120s timer expires
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [credentials, onClose]);

  if (!credentials) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(credentials.user_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPass = () => {
    navigator.clipboard.writeText(credentials.temp_password);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handlePrintSlip = () => {
    window.print();
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden">
        {/* Header with Countdown Timer */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-amber-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تسليم بيانات الاعتماد المؤقتة
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                بيانات سرية تُعرض لمرة واحدة حصرية في المتصفح
              </p>
            </div>
          </div>

          {/* Countdown Clock Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white font-mono font-bold text-sm shadow-sm animate-pulse">
            <Clock className="w-4 h-4" />
            <span>{timerFormatted}</span>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-700">
              <span>الموظف: <strong className="text-slate-900 dark:text-white">{credentials.employee_name}</strong></span>
              <span>الدور: <strong className="text-slate-900 dark:text-white">{credentials.role === 'supervisor' ? 'رئيس قسم' : 'أمين عهدة'}</strong></span>
            </div>

            {/* User Code Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                كود المستخدم (اسم الدخول)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={credentials.user_code}
                  className="w-full font-mono text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-left dir-ltr"
                />
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="نسخ الكود"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'تم' : 'نسخ'}</span>
                </button>
              </div>
            </div>

            {/* Temporary Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                كلمة المرور المؤقتة
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={credentials.temp_password}
                  className="w-full font-mono text-sm font-bold bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 rounded-lg px-3 py-2 text-amber-900 dark:text-amber-200 text-left dir-ltr select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyPass}
                  className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                  title="نسخ كلمة المرور"
                >
                  {copiedPass ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPass ? 'تم' : 'نسخ'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-600 dark:text-slate-300">
            <ShieldAlert className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              <strong>قاعدة الأمان:</strong> تُحفظ كلمة المرور كـ Hash مشفر فقط في الخادم، ولن يتم كشفها ثانية بعد إغلاق هذه النافذة أو انقضاء الـ 120 ثانية. عند انتهاء المهلة دون تسليمها، استخدم إجراء <strong>«إعادة إصدار كلمة مرور مؤقتة»</strong> من جدول المستخدمين.
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handlePrintSlip}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة بطاقة التسليم الرسمية</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            إنهاء وإغلاق فوري
          </button>
        </div>
      </div>

      {/* Printable Delivery Card (hidden on screen, visible only when printing) */}
      <div className="hidden print-only fixed inset-0 bg-white p-8 text-black">
        <div className="border-2 border-black p-6 rounded-lg max-w-xl mx-auto space-y-4">
          <div className="border-b-2 border-black pb-3 text-center">
            <h2 className="text-xl font-bold">بطاقة تسليم بيانات الدخول المؤقتة</h2>
            <p className="text-sm">نظام إدارة العهد والمخازن - الإصدار 6.7</p>
          </div>

          <div className="space-y-2 text-sm leading-relaxed">
            <p><strong>اسم الموظف:</strong> {credentials.employee_name}</p>
            <p><strong>الدور الوظيفي:</strong> {credentials.role === 'supervisor' ? 'رئيس قسم' : 'أمين عهدة'}</p>
            {credentials.custody_name && <p><strong>العهدة المسكن عليها:</strong> {credentials.custody_name}</p>}
            <div className="p-3 bg-gray-100 border border-gray-400 rounded my-3">
              <p className="text-base font-bold font-mono">كود المستخدم: {credentials.user_code}</p>
              <p className="text-base font-bold font-mono">كلمة المرور المؤقتة: {credentials.temp_password}</p>
            </div>
            <p className="text-xs text-gray-700">
              * تنبيه: كلمة المرور المؤقتة صالحة للاستخدام لمرة واحدة فقط. سيطالبك النظام فور تسجيل الدخول الأول بتعيين كلمة مرور شخصية قوية وإكمال بيانات الاتصال.
            </p>
          </div>

          <div className="pt-6 border-t border-gray-400 flex justify-between text-xs">
            <div>توقيع مسؤول النظام: __________________</div>
            <div>توقيع المستلم: __________________</div>
          </div>
        </div>
      </div>
    </div>
  );
};
