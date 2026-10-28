import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { validatePasswordStrength } from '../utils/rules.ts';
import {
  User as UserIcon,
  Shield,
  KeyRound,
  Sliders,
  Building,
  Check,
  AlertCircle,
  Sun,
  Moon,
  Sparkles,
  Phone,
  Lock,
  Database,
  Calendar,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { FactoryResetModal } from '../components/common/FactoryResetModal.tsx';

interface SettingsPageProps {
  companyName?: string;
  onNavigate?: (tab: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ companyName = 'إدارة العهد والمخازن', onNavigate }) => {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'system'>('profile');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Profile Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Preferences State
  const [guideEnabled, setGuideEnabled] = useState(() => {
    return localStorage.getItem('hide_getting_started_guide') !== 'true';
  });

  const handleToggleGuide = () => {
    const nextState = !guideEnabled;
    setGuideEnabled(nextState);
    if (nextState) {
      localStorage.removeItem('hide_getting_started_guide');
    } else {
      localStorage.setItem('hide_getting_started_guide', 'true');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setProfileSuccessMsg('');
    setProfileErrorMsg('');
    setIsSavingProfile(true);

    try {
      const res = await fetch(`/api/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل تحديث البيانات الشخصية');
      }

      setProfileSuccessMsg('تم حفظ البيانات الشخصية بنجاح');
      // Update local auth context
      login({
        ...user,
        full_name: fullName.trim(),
        phone: phone.trim() ? phone.trim() : null,
      });
      setTimeout(() => setProfileSuccessMsg(''), 3000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setPasswordSuccessMsg('');
    setPasswordErrorMsg('');

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('كلمة المرور الجديدة غير متطابقة مع التأكيد');
      return;
    }

    const check = validatePasswordStrength(newPassword);
    if (!check.valid) {
      setPasswordErrorMsg(check.message || 'كلمة المرور غير مطابقة للمواصفات');
      return;
    }

    setIsSavingPassword(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          newPassword,
          fullName: user.full_name,
          phone: user.phone,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل تغيير كلمة المرور');
      }

      setPasswordSuccessMsg('تم تغيير كلمة المرور بنجاح وحفظها مشفرة.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccessMsg(''), 4000);
    } catch (err: any) {
      setPasswordErrorMsg(err.message || 'حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const pwdValidation = validatePasswordStrength(newPassword);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            <span>إعدادات الحساب والنظام</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إدارة بيانات الملف الشخصي، أمان كلمة المرور، وتفضيلات واجهة الاستخدام
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
            {user?.user_code}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            {user?.role === 'admin' ? 'مسؤول النظام' : user?.role === 'supervisor' ? 'رئيس قسم' : 'أمين عهدة'}
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold gap-2 sm:gap-6 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all shrink-0 ${
            activeTab === 'profile'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>الملف الشخصي</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all shrink-0 ${
            activeTab === 'security'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>الأمان وكلمة المرور</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all shrink-0 ${
            activeTab === 'preferences'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>تفضيلات العرض</span>
        </button>

        {user?.role === 'admin' && (
          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all shrink-0 ${
              activeTab === 'system'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>معلومات النظام</span>
          </button>
        )}
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              بيانات الملف الشخصي
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              يمكنك تحديث اسمك المعتمد ورقم الهاتف للتواصل الداخلي
            </p>
          </div>

          {profileSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
              <Check className="w-4 h-4" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          {profileErrorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-200 dark:border-rose-800">
              <AlertCircle className="w-4 h-4" />
              <span>{profileErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الاسم ثلاثياً المعتمد *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  رقم الهاتف (للتواصل الداخلي)
                </label>
                <input
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-left dir-ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[11px] text-slate-400">كود المستخدم</span>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {user?.user_code}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[11px] text-slate-400">الدور الوظيفي</span>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  {user?.role === 'admin' ? 'مسؤول النظام' : user?.role === 'supervisor' ? 'رئيس قسم' : 'أمين عهدة'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[11px] text-slate-400">العهدة المخصصة</span>
                <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                  {user?.custody_name || 'إدارة مركزية للشركة'}
                </div>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
              >
                {isSavingProfile ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              تغيير كلمة المرور
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              يتم تشفير كلمات المرور باستخدام معيار bcrypt (12 جولة salt) ولا يمكن كشفها
            </p>
          </div>

          {passwordSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
              <Check className="w-4 h-4" />
              <span>{passwordSuccessMsg}</span>
            </div>
          )}

          {passwordErrorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 border border-rose-200 dark:border-rose-800">
              <AlertCircle className="w-4 h-4" />
              <span>{passwordErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSavePassword} className="space-y-4 text-xs">
            <div className="max-w-md space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور الجديدة *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8 خانات، تشمل حروف كبيرة وصغيرة وأرقام ورموز"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تأكيد كلمة المرور الجديدة *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور للتأكيد"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Strength Indicators */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px]">
                <div className="font-semibold text-slate-700 dark:text-slate-300">
                  متطلبات كلمة المرور المعتمدة:
                </div>
                <div className="grid grid-cols-2 gap-1 text-slate-500 dark:text-slate-400">
                  <div className={`flex items-center gap-1 ${newPassword.length >= 8 ? 'text-emerald-600 font-bold' : ''}`}>
                    <span>• 8 خانات على الأقل</span>
                  </div>
                  <div className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-emerald-600 font-bold' : ''}`}>
                    <span>• حرف إنجليزي كبير (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-emerald-600 font-bold' : ''}`}>
                    <span>• حرف إنجليزي صغير (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-emerald-600 font-bold' : ''}`}>
                    <span>• رقم واحد على الأقل (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-emerald-600 font-bold' : ''}`}>
                    <span>• رمز خاص واحد (@#$%)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingPassword || !pwdValidation.valid || newPassword !== confirmPassword}
                className={`px-5 py-2.5 rounded-xl font-bold transition-colors cursor-pointer ${
                  pwdValidation.valid && newPassword === confirmPassword && !isSavingPassword
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSavingPassword ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Preferences */}
      {activeTab === 'preferences' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              تفضيلات واجهة الاستخدام
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تخصيص المظهر وتوجيهات الشاشة بحسب رغبتك
            </p>
          </div>

          <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {/* Guide Toggle */}
            <div className="pt-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  دليل البدء التوجيهي لتأسيس النظام
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  عرض الويدجت الإرشادي بالخطوات التأسيسية الثلاث في لوحة التحكم
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleGuide}
                className={`px-3 py-1.5 rounded-xl font-semibold border cursor-pointer transition-colors ${
                  guideEnabled
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                }`}
              >
                {guideEnabled ? 'مفعل (ظاهر)' : 'معطل (مخفي)'}
              </button>
            </div>

            {/* Theme Toggle */}
            <div className="pt-4 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  المظهر العام (الوضع الليلي / النهاري)
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  الوضع الحالي: {theme === 'dark' ? 'الوضع الداكن (Dark Theme)' : 'الوضع الفاتح (Light Theme)'}
                </div>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer border border-slate-200 dark:border-slate-700 transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                <span>تبديل المظهر</span>
              </button>
            </div>

            {/* Font & Language */}
            <div className="pt-4 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  لغة النظام والخط المعتمد
                </div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  العربية • خط IBM Plex Sans Arabic المحزوم محلياً
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                AR / woff2
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: System (Admin Only) */}
      {user?.role === 'admin' && activeTab === 'system' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              معلومات المنظومة وقواعد التشغيل
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              مواصفات البيئة المغلقة وفق الإصدار 6.7 المعتمد
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-600">
                <Building className="w-4 h-4" />
                <span className="font-bold">اسم الشركة المعتمد</span>
              </div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold text-sm">
                {companyName}
              </div>
              <div className="text-[11px] text-slate-400">تم التأسيس عبر معالج التهيئة الأولي</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-600">
                <Calendar className="w-4 h-4" />
                <span className="font-bold">السنة المالية المعتمدة</span>
              </div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold text-sm">
                1 يوليو إلى 30 يونيو
              </div>
              <div className="text-[11px] text-slate-400">الترقيم المالي: TRX-[السنة]-[000001]</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-600">
                <Database className="w-4 h-4" />
                <span className="font-bold">محرك قاعدة البيانات والتخزين</span>
              </div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold text-sm">
                SQLite 3 (نمط WAL + مهلة 5000ms)
              </div>
              <div className="text-[11px] text-slate-400">شبكة معزولة LAN / لا استدعاءات خارجية</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2 text-sky-600">
                <Shield className="w-4 h-4" />
                <span className="font-bold">نظام كمي بحت (Quantity-Only)</span>
              </div>
              <div className="text-slate-800 dark:text-slate-200 font-semibold text-sm">
                دقة 3 أرقام عشرية (الوحدات المصغرة x1000)
              </div>
              <div className="text-[11px] text-slate-400">حظر تام لأي حقول تكلفة أو تقييمات مالية</div>
            </div>
          </div>

          {/* Danger Zone: Factory Reset for New Company */}
          <div className="mt-6 pt-5 border-t border-rose-200 dark:border-rose-900/40 p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>إعادة ضبط المصنع وتصفير النظام لشركة جديدة</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                مسح كافة بيانات المنشأة الحالية وسجلاتها نهائياً لإعادة تهيئة النظام لشركة جديدة عبر معالج التهيئة الأولي (Clean Slate).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm shadow-rose-600/20 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط المصنع</span>
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
};
