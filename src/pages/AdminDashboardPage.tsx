import React, { useState, useEffect } from 'react';
import { GettingStartedGuide } from '../components/dashboard/GettingStartedGuide.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Building,
  Users,
  Boxes,
  Warehouse,
  ArrowRightLeft,
  ClipboardCheck,
  PlusCircle,
  Eye,
  ArrowLeft,
  Sparkles,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  RotateCcw,
} from 'lucide-react';

interface AdminDashboardPageProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    custodiesCount: 0,
    usersCount: 0,
    itemsCount: 0,
    warehousesCount: 0,
    pendingMovementsCount: 0,
    recentMovements: [] as any[],
    stepsStatus: {
      step1Custody: 'ready' as const,
      step2Users: 'incomplete' as const,
      step3Items: 'incomplete' as const,
    },
  });
  const [loading, setLoading] = useState(true);

  // Guide visibility state with persistence in localStorage
  const [showGuide, setShowGuide] = useState(() => {
    return localStorage.getItem('hide_getting_started_guide') !== 'true';
  });

  const handleDismissGuide = () => {
    setShowGuide(false);
    localStorage.setItem('hide_getting_started_guide', 'true');
  };

  const handleRestoreGuide = () => {
    setShowGuide(true);
    localStorage.removeItem('hide_getting_started_guide');
  };

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case 'addition':
        return { label: 'إضافة (وارد)', bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200' };
      case 'issue':
        return { label: 'خصم', bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200' };
      case 'internal_transfer':
        return { label: 'تحويل داخلي', bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200' };
      case 'disposal':
        return { label: 'خروج نهائي', bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200' };
      default:
        return { label: type, bg: 'bg-slate-100 text-slate-700' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'executed_delegated':
        return { label: 'منفذة', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' };
      case 'pending_approval':
        return { label: 'معلقة للاعتماد', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' };
      case 'rejected':
        return { label: 'مرفوضة', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' };
      default:
        return { label: status, bg: 'bg-slate-100 text-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            لوحة التحكم
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            مرحباً بك، {user?.full_name} • مركز المتابعة الرقابية والتشغيلية لنظام إدارة العهد والمخازن
          </p>
        </div>

        {!showGuide && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleRestoreGuide}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>إظهار دليل البدء التوجيهي</span>
            </button>
          </div>
        )}
      </div>

      {/* Dismissible Getting Started Guide */}
      {showGuide && (
        <GettingStartedGuide
          stepsStatus={stats.stepsStatus}
          onNavigate={onNavigate}
          onDismiss={handleDismissGuide}
        />
      )}

      {/* Quantitative Metric Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('custodies')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">العهد النشطة</span>
            <Building className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {stats.custodiesCount}
          </div>
          <p className="text-[11px] text-slate-400">انقر لاستعراض العهد</p>
        </div>

        <div
          onClick={() => onNavigate('users')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">الحسابات المسكنة</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {stats.usersCount}
          </div>
          <p className="text-[11px] text-slate-400">أمناء عهد ورؤساء أقسام</p>
        </div>

        <div
          onClick={() => onNavigate('items')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 hover:border-amber-300 dark:hover:border-amber-700 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">الأصناف المركزية</span>
            <Boxes className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {stats.itemsCount}
          </div>
          <p className="text-[11px] text-slate-400">في كتالوج الشركة الموحد</p>
        </div>

        <div
          onClick={() => onNavigate('custodies')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium">إجمالي المخازن</span>
            <Warehouse className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {stats.warehousesCount}
          </div>
          <p className="text-[11px] text-slate-400">رئيسية وفرعية وعامة</p>
        </div>
      </div>

      {/* Operational Fast Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate('custodies')}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition-all cursor-pointer flex items-center justify-between group shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                إدارة العهد والمخازن
              </h3>
              <p className="text-[11px] text-slate-400">إنشاء وتسكين المخازن الرئيسية</p>
            </div>
          </div>
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
        </div>

        <div
          onClick={() => onNavigate('users')}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all cursor-pointer flex items-center justify-between group shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                إدارة الحسابات والأمان
              </h3>
              <p className="text-[11px] text-slate-400">إنشاء الموظفين وبطاقات الـ 120 ثانية</p>
            </div>
          </div>
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </div>

        <div
          onClick={() => onNavigate('items')}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 transition-all cursor-pointer flex items-center justify-between group shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                إدارة الأصناف
              </h3>
              <p className="text-[11px] text-slate-400">استعراض أصناف العهد وإسنادها</p>
            </div>
          </div>
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
        </div>
      </div>

      {/* Recent Movements Activity Section */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              <span>أحدث الحركات المخزنية المسجلة</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              متابعة فورية للوارد، الخصم، والتحويل الداخلي عبر مختلف العهد
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('movements')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
          >
            <span>سجل الحركات الكامل</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {stats.recentMovements.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <ArrowRightLeft className="w-8 h-8 mx-auto opacity-50" />
            <p className="text-xs">لم تسجل أي حركة مخزنية بعد (نظام نظيف فارغ بالكامل).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">رقم الحركة</th>
                  <th className="py-2.5 px-3">نوع الحركة</th>
                  <th className="py-2.5 px-3">الصنف</th>
                  <th className="py-2.5 px-3">العهدة</th>
                  <th className="py-2.5 px-3 text-center">الكمية</th>
                  <th className="py-2.5 px-3">حالة العملية</th>
                  <th className="py-2.5 px-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.recentMovements.map((m) => {
                  const typeBadge = getMovementTypeBadge(m.movement_type);
                  const statusBadge = getStatusBadge(m.status);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {m.trx_number}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeBadge.bg}`}>
                          {typeBadge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {m.item_name} <span className="font-mono text-[10px] text-slate-400">({m.item_code})</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {m.custody_name}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {m.quantity}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadge.bg}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {new Date(m.created_at).toLocaleDateString('ar-EG')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
