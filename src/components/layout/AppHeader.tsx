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
  LayoutDashboard,
  Lock,
  CheckCircle2,
  Bell,
  Clock,
} from 'lucide-react';

interface AppHeaderProps {
  onToggleSidebar?: () => void;
  companyName?: string;
  onNavigate?: (tab: string) => void;
  onLockScreen?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onToggleSidebar,
  companyName = 'إدارة العهد والمخازن',
  onNavigate,
  onLockScreen,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // In-app notifications state
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/notifications?role=${user.role}&custodyId=${user.custody_id || ''}&userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotificationsList(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: any) => {
    try {
      await fetch(`/api/notifications/${notif.id}/read`, { method: 'POST' });
      setNotificationsList((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }

    setIsNotifOpen(false);
    if (notif.link_tab && onNavigate) {
      onNavigate(notif.link_tab);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custodyId: user?.custody_id, role: user?.role }),
      });
      setNotificationsList((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

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
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                {companyName}
              </h1>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                نظام إدارة العهد والمخازن v6.7
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right: Identity Badge, Menu & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Notifications Popover */}
          {user && (
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen((prev) => !prev)}
                className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
                  isNotifOpen
                    ? 'bg-indigo-50/80 dark:bg-slate-800 border-indigo-300 dark:border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="الإشعارات والطلبات المعلقة"
                aria-label="الإشعارات"
              >
                <Bell className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        الإشعارات والطلبات
                      </span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold text-[10px]">
                          {unreadCount} جديد
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                      >
                        تحديد الكل كمقروء
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notificationsList.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        لا توجد إشعارات جديدة حالياً
                      </div>
                    ) : (
                      notificationsList.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 text-right hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                            !n.isRead ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(n.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                            {n.message}
                          </p>
                          {n.linkTab && (
                            <div className="mt-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                              <span>اضغط للمراجعة واتخاذ القرار</span>
                              <span>←</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Screen Lock Button */}
          {user && onLockScreen && (
            <button
              type="button"
              onClick={onLockScreen}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="قفل الشاشة فورياً لحماية الجلسة"
              aria-label="قفل الشاشة"
            >
              <Lock className="w-4 h-4 text-indigo-500" />
            </button>
          )}

          {/* Theme Quick Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'التحويل للوضع النهاري (فاتح)' : 'التحويل للوضع الليلي (داكن)'}
            aria-label="تبديل المظهر"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* Quick Immediate Logout Button */}
          {user && (
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors text-xs font-semibold cursor-pointer"
              title="تسجيل الخروج السريع"
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
