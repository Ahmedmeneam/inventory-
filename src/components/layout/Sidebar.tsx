import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  LayoutDashboard,
  Building,
  Users,
  Boxes,
  Ruler,
  ArrowRightLeft,
  ClipboardCheck,
  FileSpreadsheet,
  Database,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const adminNav = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'custodies', label: 'الهيكل التنظيمي والعهد والمخازن', icon: Building },
    { id: 'users', label: 'إدارة الحسابات والأمان', icon: Users },
    { id: 'items', label: 'كتالوج الأصناف المركزي', icon: Boxes },
    { id: 'settings', label: 'إعدادات الحساب والنظام', icon: Shield },
    { id: 'inventory', label: 'الجرد الدوري والإقفال السنوي', icon: Layers },
    { id: 'ledger', label: 'السجل العام وكشوف الحساب', icon: FileSpreadsheet },
    { id: 'backup', label: 'النسخ الاحتياطي والاستعادة', icon: Database },
  ];

  const custodyNav = [
    { id: 'dashboard', label: 'لوحة متابعة العهدة', icon: LayoutDashboard },
    { id: 'items', label: 'أصناف العهدة والمقترحات', icon: Boxes },
    { id: 'movements', label: 'العمليات المخزنية', icon: ArrowRightLeft },
    { id: 'pending', label: 'الطلبات المعلقة والمراجعة', icon: ClipboardCheck },
    { id: 'delegation', label: 'قواعد ومراجعة التفويض', icon: Shield },
    { id: 'settings', label: 'إعدادات الحساب', icon: Users },
    { id: 'inventory', label: 'الجرد الدوري والتسويات', icon: Layers },
    { id: 'ledger', label: 'كشوف الحساب والإقفال', icon: FileSpreadsheet },
  ];

  const navItems = isAdmin ? adminNav : custodyNav;

  const content = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Sidebar Header / Brand */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">
                {isAdmin ? 'بوابة مسؤول النظام' : 'مساحة عمل العهدة'}
              </div>
              <div className="text-[10px] text-slate-400">
                {user?.custody_name || 'إدارة مركزية'}
              </div>
            </div>
          </div>
        )}

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="إغلاق القائمة"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title={isCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
          aria-label={isCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
        >
          {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800 text-[10px] text-slate-500 text-center">
          إصدار المواصفات 6.7 • وضع الشبكة المغلقة
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <aside
        className={`hidden md:block transition-all duration-200 border-l border-slate-800 shrink-0 select-none ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">{content}</div>
      </aside>

      {/* Mobile Off-canvas Drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
