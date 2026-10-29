import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  LayoutDashboard,
  Building,
  Users,
  Boxes,
  ArrowRightLeft,
  ClipboardCheck,
  FileSpreadsheet,
  Database,
  X,
  Shield,
  Layers,
  Sliders,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isDesktopOpen: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isDesktopOpen,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';

  const adminNav = [
    { id: 'dashboard', label: 'لوحة التحكم المركزية', icon: LayoutDashboard },
    { id: 'custodies', label: 'الهيكل التنظيمي والعهد والمخازن', icon: Building },
    { id: 'users', label: 'إدارة الحسابات والأمان', icon: Users },
    { id: 'items', label: 'كتالوج الأصناف المركزي', icon: Boxes },
    { id: 'ledger', label: 'السجل العام وكشوف الحساب', icon: FileSpreadsheet },
    { id: 'backup', label: 'النسخ الاحتياطي والاستعادة', icon: Database },
    { id: 'settings', label: 'إعدادات الحساب والنظام', icon: Sliders },
  ];

  const supervisorNav = [
    { id: 'dashboard', label: 'لوحة متابعة ورقابة العهدة', icon: LayoutDashboard },
    { id: 'pending', label: 'الطلبات المعلقة والاعتمادات', icon: ClipboardCheck },
    { id: 'items', label: 'أصناف العهدة واعتماد المقترحات', icon: Boxes },
    { id: 'movements', label: 'العمليات المخزنية والرقابة', icon: ArrowRightLeft },
    { id: 'delegation', label: 'ضبط قواعد وسقوف التفويض', icon: Shield },
    { id: 'inventory', label: 'الجرد الدوري والتسويات', icon: Layers },
    { id: 'ledger', label: 'كشوف الحساب وسجل حركات العهدة', icon: FileSpreadsheet },
    { id: 'settings', label: 'إعدادات الحساب', icon: Sliders },
  ];

  const storekeeperNav = [
    { id: 'dashboard', label: 'لوحة متابعة العهدة الميدانية', icon: LayoutDashboard },
    { id: 'movements', label: 'تسجيل العمليات (إضافة / خصم / تحويل)', icon: ArrowRightLeft },
    { id: 'pending', label: 'طلباتي المعلقة وحالة الاعتماد', icon: ClipboardCheck },
    { id: 'items', label: 'أصناف العهدة واقتراح صنف جديد', icon: Boxes },
    { id: 'inventory', label: 'إدخال العد الفعلي للجرد', icon: Layers },
    { id: 'settings', label: 'إعدادات الحساب الشخصي', icon: Sliders },
  ];

  const navItems = isAdmin ? adminNav : isSupervisor ? supervisorNav : storekeeperNav;

  const content = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors select-none">
      {/* Sidebar Header / Brand - Fixed & Always Visible */}
      <div className="pt-5 px-4 pb-3 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/20">
            <Shield className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {isAdmin ? 'بوابة مسؤول النظام' : 'مساحة عمل العهدة'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
              {user?.custody_name || 'الإدارة المركزية'}
            </div>
          </div>
        </div>

        {/* Mobile close button only */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="إغلاق القائمة"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation List - Always Expanded */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white font-medium'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 text-[10px] text-slate-400 dark:text-slate-500 text-center">
        إصدار المواصفات 6.7 • وضع الشبكة المغلقة
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Stationary Sidebar with Smooth Toggle */}
      <aside
        className={`hidden md:block shrink-0 select-none border-l border-slate-200/90 dark:border-slate-800/90 transition-all duration-300 ease-in-out ${
          isDesktopOpen
            ? 'w-64 opacity-100'
            : 'w-0 opacity-0 overflow-hidden border-l-0 pointer-events-none'
        }`}
      >
        <div className="w-64 h-full">{content}</div>
      </aside>

      {/* Mobile Off-canvas Drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
