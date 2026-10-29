import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, RotateCcw, X, Lock, KeyRound } from 'lucide-react';

interface FactoryResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetSuccess: () => void;
  companyName?: string;
}

export const FactoryResetModal: React.FC<FactoryResetModalProps> = ({
  isOpen,
  onClose,
  onResetSuccess,
  companyName,
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [error, setError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const REQUIRED_PHRASE = 'أوافق على الحذف النهائي وتصفير النظام بالكامل';
  const isPhraseValid = confirmationInput.trim() === REQUIRED_PHRASE;
  const isPasswordEntered = adminPassword.trim().length >= 6;
  const canSubmit = isPhraseValid && isPasswordEntered && hasAcknowledged && !isResetting;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError('');
    setIsResetting(true);

    try {
      const res = await fetch('/api/setup/factory-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationPhrase: REQUIRED_PHRASE,
          adminPassword: adminPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشلت عملية إعادة ضبط المصنع');
      }

      onResetSuccess();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تصفير النظام');
    } finally {
      setIsResetting(false);
    }
  };

  const handleModalClose = () => {
    if (isResetting) return;
    setConfirmationInput('');
    setAdminPassword('');
    setHasAcknowledged(false);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 font-sans dir-rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-300 dark:border-rose-900/80 max-w-lg w-full overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-600/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
                إعادة ضبط المصنع الآمنة (مسؤول النظام فقط)
              </h3>
              <button
                type="button"
                onClick={handleModalClose}
                disabled={isResetting}
                className="p-1 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer"
                aria-label="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 leading-relaxed">
              تصفير شامل وإعادة النظام للحالة النظيفة الأصلية 100% (Clean Slate) لشركة جديدة
            </p>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleReset} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Critical Security Warning */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs space-y-1.5 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تحذير أمني مؤكد ومحمي:</span>
            </div>
            <p>
              سيتم حذف كافة السجلات والبيانات المسجلة لشركة {companyName ? `(${companyName})` : ''} بشكل دائم ولا يمكن التراجع عنه (المستخدمين، العهد، المخازن، الأصناف، سجل الحركات، وقواعد التفويض).
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
              لحماية المنشأة من الأخطاء العرضية، لا يمكن تفعيل هذا الإجراء إلا بعد مطابقة كلمة مرور الأدمن الحالية وكتابة عبارة التأكيد يدوياً.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            {/* Step 1: Admin Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                1. أدخل كلمة مرور مسؤول النظام الحالية (ADM-001) للتأكيد الأمني *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="كلمة مرور حساب مسؤول النظام الحالي"
                  className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  autoFocus
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            {/* Step 2: Confirmation Phrase */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                2. اكتب عبارة التأكيد الأمنية التالية بالحرف لتأكيد الرغبة *
              </label>
              <div className="p-2 rounded-lg bg-rose-100/70 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-xs font-bold text-rose-900 dark:text-rose-200 mb-2 select-none text-center">
                {REQUIRED_PHRASE}
              </div>
              <input
                type="text"
                required
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="اكتب العبارة كاملة يدوياً هنا"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-center"
              />
            </div>

            {/* Step 3: Checkbox Acknowledgement */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasAcknowledged}
                onChange={(e) => setHasAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-600"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                أقر بمسؤوليتي الإدارية الكاملة كمسؤول للنظام عن حذف كافة بيانات المنشأة وقواعد البيانات والعمليات، وأعلم أنه لا يمكن استرجاعها بعد هذا الإجراء.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleModalClose}
              disabled={isResetting}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء الأمر
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
                canSubmit
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
              }`}
            >
              <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{isResetting ? 'جارٍ مسح وتصفير النظام...' : 'تنفيذ إعادة ضبط المصنع ومسح النظام'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
