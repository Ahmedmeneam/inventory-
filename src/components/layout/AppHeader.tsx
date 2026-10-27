import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import {
  LogOut,
  Sun,
  Moon,
  Menu,
  User as UserIcon,
  Building2,
  ChevronDown,
  Sliders,
  Users,
  Shield,
  Building,
  Phone,
  CheckCircle2,
  LayoutDashboard,
} from 'lucide-react';

interface AppHeaderProps {
  onToggleSidebar?: () => void;
  companyName?: string;
  onNavigate?: (tab: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onToggleSidebar,
  companyName = 'إدارة العهد والمخازن',
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return { label: 'مسؤول النظام', bg: 'bg-indigo-600/15 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' };
      case 'supervisor':
        return { label: 'رئيس قسم / مراقب', bg: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' };
      case 'storekeeper':
        return { label: 'أمين عهدة', bg: 'bg-sky-600/15 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800' };
      default:
        return { label: 'مستخدم', bg: 'bg-slate-200 text-slate-700' };
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  const handleMenuAction = (tabName: string) => {
    setIsUserMenuOpen(false);
    if (onNavigate) {
      onNavigate(tabName);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left / Start: Mobile Menu Toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="تبديل القائمة الجانبية"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {companyName}
              </h1>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                نظام إدارة العهد والمخازن v6.7
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right: Identity Badge, Menu & Actions */}
        <div className="flex items-center gap-2.5">
          {/* User Profile Dropdown Button */}
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none ${
                  isUserMenuOpen
                    ? 'bg-indigo-50/80 dark:bg-slate-800 border-indigo-300 dark:border-indigo-600 ring-2 ring-indigo-500/10'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="اضغط لفتح قائمة الحساب والإعدادات"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <UserIcon className="w-4 h-4" />
                </div>

                <div className="text-right hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {user.full_name}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {user.user_code}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className={`px-1.5 py-0.2 rounded-full border text-[10px] font-medium ${roleInfo.bg}`}>
                      {roleInfo.label}
                    </span>
                    {user.custody_name && (
                      <span className="truncate max-w-[110px]">
                        • {user.custody_name}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* User Account Popover Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* User Profile Header Card */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        {user.full_name ? user.full_name.charAt(0) : 'U'}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {user.full_name}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                            {user.user_code}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded-full border text-[10px] font-medium ${roleInfo.bg}`}>
                            {roleInfo.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>العهدة:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {user.custody_name || 'إدارة مركزية للشركة'}
                        </span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center justify-between">
                          <span>الهاتف:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">{user.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>حالة الحساب:</span>
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>نشط ومؤكد</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dropdown Menu Items */}
                  <div className="py-1 space-y-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => handleMenuAction('settings')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-right cursor-pointer"
                    >
                      <Sliders className="w-4 h-4 text-indigo-500" />
                      <div className="flex-1">
                        <div className="font-semibold">حسابي / إعدادات الحساب</div>
                        <div className="text-[10px] text-slate-400">البيانات الشخصية وكلمة المرور</div>
                      </div>
                    </button>

                    {user.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleMenuAction('users')}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-right cursor-pointer"
                      >
                        <Users className="w-4 h-4 text-emerald-500" />
                        <div className="flex-1">
                          <div className="font-semibold">إدارة الحسابات والأمان</div>
                          <div className="text-[10px] text-slate-400">إنشاء الموظفين وبطاقات الدخول</div>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        toggleTheme();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-right cursor-pointer"
                    >
                      {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
                      <div className="flex-1">
                        <div className="font-semibold">المظهر العام</div>
                        <div className="text-[10px] text-slate-400">
                          {theme === 'dark' ? 'التحويل للوضع الفاتح' : 'التحويل للوضع الداكن'}
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors text-right cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج من الحساب</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Theme Quick Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'التحويل للوضع النهاري' : 'التحويل للوضع الليلي'}
            aria-label="تبديل المظهر"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Quick Immediate Logout Button for Single-User Role Testing */}
          {user && (
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors text-xs font-medium cursor-pointer"
              title="خروج فوري للتبديل بين الحسابات"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">خروج سريع</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
