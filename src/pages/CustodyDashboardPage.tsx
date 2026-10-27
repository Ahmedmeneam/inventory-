import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Building,
  Boxes,
  ArrowRightLeft,
  Clock,
  ShieldCheck,
  Warehouse,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';

interface CustodyDashboardPageProps {
  onNavigate: (tab: string) => void;
}

export const CustodyDashboardPage: React.FC<CustodyDashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'supervisor';

  return (
    <div className="space-y-6">
      {/* Custody Welcome Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
              {isSupervisor ? 'مكتب رئيس القسم الرقابي' : 'مكتب أمين العهدة الميداني'}
            </span>
            {user?.custody_code && (
              <span className="font-mono text-xs text-slate-500">
                [{user.custody_code}]
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {user?.custody_name || 'العهدة غير مسكنة بعد'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isSupervisor
              ? 'متابعة واعتماد طلبات الخصم، مراقبة التفويض، واعتماد محاضر الجرد والتسويات'
              : 'تسجيل الوارد الخارجي بالمخزن الرئيسي، تنفيذ التحويلات الداخلية، والخصم المباشر أو رفع الطلبات'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('movements')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>العمليات المخزنية</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">المخزن الرئيسي</span>
            <Warehouse className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white truncate">
            المخزن الرئيسي للعهدة
          </div>
          <p className="text-[11px] text-slate-400">حصر استقبال الوارد الخارجي</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">الأصناف المسندة</span>
            <Boxes className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            0
          </div>
          <p className="text-[11px] text-slate-400">أصناف معتمدة في العهدة</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">الطلبات المعلقة</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            0
          </div>
          <p className="text-[11px] text-slate-400">بانتظار قرار رئيس القسم</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">سقوف التفويض اليومية</span>
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white">
            محسوبة لحظياً
          </div>
          <p className="text-[11px] text-slate-400">من حركات اليوم الفعلي</p>
        </div>
      </div>

      {/* Guidance Callout */}
      <div className="p-5 rounded-2xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-1">
          <h4 className="font-bold text-sky-900 dark:text-sky-300">
            توجيهات العمل المعتمدة في الإصدار 6.7:
          </h4>
          <p>
            1. <strong>الوارد الخارجي (الإضافة):</strong> يسجل حصرياً في المخزن الرئيسي للعهدة، ويتم توزيعه للمخازن الفرعية عبر التحويل الداخلي.
          </p>
          <p>
            2. <strong>الخصم المفوض:</strong> يتم تنفيذه فوراً إذا كان الصنف مفوضاً وضمن حد وسقف اليوم المحسوب ديناميكياً.
          </p>
          <p>
            3. <strong>الطلبات المعلقة:</strong> أي كمية تتجاوز السقف يتم حجز رصيدها فوراً في حقل الرصيد المحجوز لحين اعتماد رئيس القسم.
          </p>
        </div>
      </div>
    </div>
  );
};
