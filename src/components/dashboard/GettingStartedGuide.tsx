import React from 'react';
import { CheckCircle2, Circle, ArrowLeft, Building, Users, Boxes, Sparkles } from 'lucide-react';

interface StepStatusInfo {
  step1Custody: 'completed' | 'ready' | 'incomplete';
  step2Users: 'completed' | 'ready' | 'incomplete';
  step3Items: 'completed' | 'ready' | 'incomplete';
}

interface GettingStartedGuideProps {
  stepsStatus: StepStatusInfo;
  onNavigate: (tab: string) => void;
  onDismiss?: () => void;
}

export const GettingStartedGuide: React.FC<GettingStartedGuideProps> = ({
  stepsStatus,
  onNavigate,
  onDismiss,
}) => {
  const getBadge = (status: 'completed' | 'ready' | 'incomplete') => {
    switch (status) {
      case 'completed':
        return {
          text: 'مكتملة',
          className: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        };
      case 'ready':
        return {
          text: 'جاهزة للبدء',
          className: 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800',
          icon: <Circle className="w-4 h-4 text-sky-600 dark:text-sky-400 fill-sky-600/30" />,
        };
      case 'incomplete':
      default:
        return {
          text: 'غير مكتملة (بانتظار سابقتها)',
          className: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700',
          icon: <Circle className="w-4 h-4 text-slate-400" />,
        };
    }
  };

  const steps = [
    {
      num: 1,
      title: 'الخطوة 1: إنشاء العهدة وتأسيس المخزن الرئيسي',
      description: 'إنشاء أول عهدة محاسبية للشركة، حيث ينشئ النظام تلقائياً قسمها الرقابي ومخزنها الرئيسي الحصري لاستقبال الوارد.',
      tab: 'custodies',
      icon: <Building className="w-5 h-5 text-indigo-500" />,
      status: stepsStatus.step1Custody,
      actionText: 'إنشاء عهدة جديدة',
    },
    {
      num: 2,
      title: 'الخطوة 2: إنشاء حسابات الموظفين وتسكينهم',
      description: 'تسكين أمين العهدة الميداني ورئيس القسم الرقابي، مع توليد بيانات الدخول المؤقتة بمؤقت الـ 120 ثانية.',
      tab: 'users',
      icon: <Users className="w-5 h-5 text-emerald-500" />,
      status: stepsStatus.step2Users,
      actionText: 'إدارة وتسكين الحسابات',
    },
    {
      num: 3,
      title: 'الخطوة 3: تعريف وحدات القياس والأصناف المركزية',
      description: 'إدخال دليل الوحدات وتوصيف الأصناف المركزية في كتالوج الشركة، ثم ربط الأصناف بالعهدة لتفعيل الحركات.',
      tab: 'items',
      icon: <Boxes className="w-5 h-5 text-amber-500" />,
      status: stepsStatus.step3Items,
      actionText: 'إدارة وتعريف الأصناف',
    },
  ];

  const allCompleted =
    stepsStatus.step1Custody === 'completed' &&
    stepsStatus.step2Users === 'completed' &&
    stepsStatus.step3Items === 'completed';

  return (
    <div className="relative bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 dark:from-slate-900/80 dark:via-slate-900/40 dark:to-slate-800/60 rounded-2xl border-2 border-indigo-200/80 dark:border-indigo-900/50 p-6 shadow-sm space-y-6">
      {/* Title & Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              دليل البدء التوجيهي لتأسيس النظام
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              النظام يبدأ نظيفاً وخالياً تماماً (Clean Slate). اتبع التسلسل الإلزامي لتشغيل أول عهدة:
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {allCompleted && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>اكتملت الخطوات التأسيسية!</span>
            </div>
          )}

          {/* Dismiss button (X) */}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="إغلاق وإخفاء دليل البدء التوجيهي"
              aria-label="إغلاق دليل البدء التوجيهي"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 3 Step Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step) => {
          const badge = getBadge(step.status);
          const isClickable = step.status !== 'incomplete';

          return (
            <div
              key={step.num}
              className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                step.status === 'completed'
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/40'
                  : step.status === 'ready'
                  ? 'bg-white dark:bg-slate-800/80 border-indigo-300 dark:border-indigo-700/60 shadow-md ring-2 ring-indigo-500/10'
                  : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70'
              }`}
            >
              <div className="space-y-3">
                {/* Header with icon and badge */}
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.className}`}
                  >
                    {badge.icon}
                    <span>{badge.text}</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-2">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => onNavigate(step.tab)}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    step.status === 'ready'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20'
                      : step.status === 'completed'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      : 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <span>{step.actionText}</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
