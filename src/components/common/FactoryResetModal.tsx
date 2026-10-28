import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, RotateCcw, X, Check, Lock } from 'lucide-react';

interface FactoryResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetSuccess: () => void;
  companyName?: string;
  showAdminPasswordOption?: boolean;
}

export const FactoryResetModal: React.FC<FactoryResetModalProps> = ({
  isOpen,
  onClose,
  onResetSuccess,
  companyName,
  showAdminPasswordOption = true,
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const REQUIRED_PHRASE = 'إعادة ضبط المصنع';
  const isPhraseValid = confirmationInput.trim() === REQUIRED_PHRASE;
  const canSubmit = isPhraseValid || (showAdminPasswordOption && adminPassword.length >= 6);

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
          confirmationPhrase: isPhraseValid ? REQUIRED_PHRASE : undefined,
          adminPassword: adminPassword.trim() || undefined,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-150 font-sans dir-rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 max-w-lg w-full overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-600/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
                إعادة ضبط المصنع وبدء شركة جديدة
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={isResetting}
                className="p-1 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 leading-relaxed">
              تصفير شامل وإعادة النظام للحالة النظيفة الأصلية 100% (Clean Slate)
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

          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs space-y-1.5 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تنبيه أمني وإداري حاسم:</span>
            </div>
            <p>
              سيتم حذف كافة البيانات المسجلة حالياً
              {companyName ? ` لشركة (${companyName})` : ''} بشكل دائم ولا يمكن التراجع عنه (الحسابات، العهد، المخازن، الأصناف، سجل الحركات، وقواعد التفويض).
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
              بعد اكتمال الإجراء، سيتم فتح «معالج التهيئة الأولي» فوراً لتسجيل بيانات الشركة الجديدة وتعيين كلمة مرور جديدة للأدمن.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                لتأكيد الإجراء، اكتب العبارة التالية بالضبط:
              </label>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold font-mono text-xs select-all border border-rose-200 dark:border-rose-900/80">
                  {REQUIRED_PHRASE}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmationInput(REQUIRED_PHRASE)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  نسخ تلقائي للحقل
                </button>
              </div>
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="اكتب: إعادة ضبط المصنع"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                autoFocus
              />
            </div>

            {showAdminPasswordOption && (
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  <span>أو إدخال كلمة مرور مسؤول النظام الحالية:</span>
                  <span className="text-[10px] text-slate-400">(اختياري كبديل للعبارة)</span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="كلمة مرور الأدمن الحالي"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isResetting}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isResetting}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
                canSubmit && !isResetting
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{isResetting ? 'جارٍ مسح وتصفير النظام...' : 'تأكيد تصفير النظام وبدء شركة جديدة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
