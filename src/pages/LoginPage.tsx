import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { validatePasswordStrength } from '../utils/rules.ts';
import {
  Building2,
  Lock,
  User as UserIcon,
  LogIn,
  AlertCircle,
  Sun,
  Moon,
  KeyRound,
  ShieldAlert,
  Phone,
  Check,
  RotateCcw,
} from 'lucide-react';
import { FactoryResetModal } from '../components/common/FactoryResetModal.tsx';

interface LoginPageProps {
  companyName?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ companyName = 'إدارة العهد والمخازن' }) => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Login form state
  const [userCode, setUserCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Mandatory first login password change modal
  const [pendingUser, setPendingUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [updatedFullName, setUpdatedFullName] = useState('');
  const [updatedPhone, setUpdatedPhone] = useState('');
  const [changeError, setChangeError] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCode.trim() || !password) return;

    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userCode: userCode.trim().toUpperCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل تسجيل الدخول');
      }

      // Check if user must change password
      if (data.user.must_change_password) {
        setPendingUser(data.user);
        setUpdatedFullName(data.user.full_name || '');
        setUpdatedPhone(data.user.phone || '');
        setIsLoading(false);
        return;
      }

      login(data.user);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;

    const pwdCheck = validatePasswordStrength(newPassword);
    if (!pwdCheck.valid) {
      setChangeError(pwdCheck.message || 'كلمة المرور لا تستوفي الشروط');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setChangeError('كلمتا المرور غير متطابقتين');
      return;
    }

    if (!updatedFullName || updatedFullName.trim().length < 3) {
      setChangeError('يرجى إدخال الاسم ثلاثياً');
      return;
    }

    setChangeError('');
    setIsChanging(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingUser.id,
          newPassword,
          fullName: updatedFullName.trim(),
          phone: updatedPhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل حفظ كلمة المرور الجديدة');
      }

      login(data.user);
    } catch (err: any) {
      setChangeError(err.message || 'حدث خطأ أثناء تحديث الحساب');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center p-4 relative font-sans transition-colors">
      {/* Top Bar with Brand & Theme Toggle */}
      <div className="absolute top-4 left-4 right-4 max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20">
            <Building2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {companyName}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
          title={theme === 'dark' ? 'التحويل للوضع النهاري (فاتح)' : 'التحويل للوضع الليلي (داكن)'}
          aria-label="تبديل المظهر"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
        </button>
      </div>

      {/* Login Card */}
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
            <LogIn className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            تسجيل الدخول للنظام
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            أدخل كود المستخدم وكلمة المرور الخاصة بك
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              كود المستخدم
            </label>
            <div className="relative">
              <input
                type="text"
                required
                tabIndex={1}
                placeholder="ADM-001 أو EMP-001"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-left dir-ltr"
                autoFocus
              />
              <UserIcon className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 px-1">
              <span>أدمن: ADM-</span>
              <span>رئيس قسم: MGR-</span>
              <span>أمين عهدة: EMP-</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type="password"
                required
                tabIndex={2}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            tabIndex={3}
            disabled={isLoading || !userCode || !password}
            className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !isLoading && userCode && password
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 active:scale-[0.99]'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <span>جارٍ التحقق...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>دخول النظام</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            * يدعم التنقل السريع بلوحة المفاتيح عبر زر Tab للتبديل و Enter للتنفيذ.
          </p>

          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold transition-colors cursor-pointer pt-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تهيئة النظام لشركة جديدة أو إعادة ضبط المصنع</span>
          </button>
        </div>
      </div>

      {/* Factory Reset Modal */}
      <FactoryResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onResetSuccess={() => {
          setIsResetModalOpen(false);
          window.location.reload();
        }}
        companyName={companyName}
        showAdminPasswordOption={true}
      />

      {/* Mandatory First-Time Password Change Modal */}
      {pendingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 sm:p-7 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  تفعيل الحساب وتعيين كلمة المرور
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  كود المستخدم: <strong>{pendingUser.user_code}</strong>
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                تم الدخول بكلمة مرور مؤقتة. يجب عليك الآن تعيين كلمة مرور شخصية قوية وإكمال بياناتك الشخصية لتفعيل الحساب نهائياً.
              </p>
            </div>

            {changeError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 text-xs">
                {changeError}
              </div>
            )}

            <form onSubmit={handleFirstPasswordChange} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الاسم ثلاثياً المعتمد *
                </label>
                <input
                  type="text"
                  required
                  value={updatedFullName}
                  onChange={(e) => setUpdatedFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  رقم الهاتف الشخصي
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={updatedPhone}
                    onChange={(e) => setUpdatedPhone(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white dir-ltr text-left"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور الشخصية الجديدة *
                </label>
                <input
                  type="password"
                  required
                  placeholder="8 خانات على الأقل تشمل حرفاً ورقماً ورمزاً"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تأكيد كلمة المرور الجديدة *
                </label>
                <input
                  type="password"
                  required
                  placeholder="إعادة إدخال كلمة المرور"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isChanging}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {isChanging ? 'جارٍ التفعيل...' : 'حفظ وتفعيل الحساب'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingUser(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
