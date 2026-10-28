import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Warehouse,
  Boxes,
  Lock,
} from 'lucide-react';

export const PendingMovementsPage: React.FC = () => {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'supervisor';
  const custodyId = user?.custody_id;

  const [pendingMovements, setPendingMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Rejection Modal
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Approval Loading
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const fetchPending = async () => {
    if (!custodyId) return;

    try {
      const res = await fetch(`/api/custodies/${custodyId}/movements?status=pending_approval`);
      if (res.ok) {
        const data = await res.json();
        setPendingMovements(data.movements || []);
      }
    } catch (err) {
      console.error('Error fetching pending movements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, [custodyId]);

  const handleApprove = async (movementId: number) => {
    setApprovingId(movementId);
    try {
      const res = await fetch(`/api/movements/${movementId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorUserId: user?.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'فشل اعتماد الطلب');
        return;
      }

      fetchPending();
    } catch {
      alert('حدث خطأ أثناء الاعتماد');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetId || !rejectionReason.trim()) return;

    setRejectError('');
    setIsRejecting(true);

    try {
      const res = await fetch(`/api/movements/${rejectTargetId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectionReason.trim(),
          supervisorUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل رفض الطلب');
      }

      setRejectTargetId(null);
      setRejectionReason('');
      fetchPending();
    } catch (err: any) {
      setRejectError(err.message || 'حدث خطأ');
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-500" />
            <span>الطلبات المعلقة والمحجوزة</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            طلبات الخصم والخروج النهائي التي تجاوزت سقف التفويض أو تطلب موافقة رئيس القسم مع حجز رصيدها
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 text-xs font-bold">
            {pendingMovements.length} طلبات معلقة
          </span>
        </div>
      </div>

      {/* Guidance Callout */}
      <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
        <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed">
          <h4 className="font-bold">آلية الأمان والحجز الآمن للأرصدة:</h4>
          <p className="mt-0.5">
            الكميات المعروضة هنا محجوزة في حقل <code>reserved_qty</code> لمنع سحبها أو تحويلها لأي حركة أخرى.
            <strong> اعتماد الطلب:</strong> يخصم الكمية من الرصيد الفعلي ويفك الحجز.
            <strong> رفض الطلب:</strong> يفك الحجز فوراً ويعيد الكمية للرصيد الحر المتاح دون أي مساس بالرصيد الدفتري الفعلي.
          </p>
        </div>
      </div>

      {/* Pending Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        {pendingMovements.length === 0 ? (
          <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-80" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">لا توجد طلبات معلقة حالياً</h3>
            <p className="text-xs">كافة الأرصدة مستقرة ولا توجد كميات محجوزة بانتظار الاعتماد.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">رقم الطلب TRX</th>
                  <th className="py-2.5 px-3">نوع الطلب</th>
                  <th className="py-2.5 px-3">الصنف</th>
                  <th className="py-2.5 px-3">المخزن المحجوز منه</th>
                  <th className="py-2.5 px-3 text-center">الكمية المحجوزة</th>
                  <th className="py-2.5 px-3">الملاحظات والسبب</th>
                  <th className="py-2.5 px-3">مقدم الطلب</th>
                  {isSupervisor && <th className="py-2.5 px-3 text-center">قرار رئيس القسم</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {m.trx_number}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                        m.movement_type === 'addition'
                          ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                          : m.movement_type === 'internal_transfer'
                          ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300'
                          : m.movement_type === 'issue'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                      }`}>
                        {m.movement_type === 'addition'
                          ? 'طلب وارد خارجي'
                          : m.movement_type === 'internal_transfer'
                          ? 'طلب تحويل داخلي'
                          : m.movement_type === 'issue'
                          ? 'طلب صرف/خصم'
                          : 'طلب خروج نهائي'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                      {m.item_name} <span className="text-[10px] text-slate-400 font-mono">({m.item_code})</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-xs">
                      {m.movement_type === 'addition'
                        ? `${m.target_warehouse_name || 'المخزن الرئيسي'} (وجهة الوارد)`
                        : m.movement_type === 'internal_transfer'
                        ? `من [${m.source_warehouse_name}] إلى [${m.target_warehouse_name}]`
                        : m.source_warehouse_name}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                      {m.quantity} {m.unit_symbol}
                    </td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                      {m.notes || '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {m.creator_name} ({m.creator_code})
                    </td>

                    {isSupervisor ? (
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={approvingId === m.id}
                            onClick={() => handleApprove(m.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            {approvingId === m.id ? 'جارٍ الاعتماد...' : 'اعتماد الطلب'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectTargetId(m.id);
                              setRejectionReason('');
                              setRejectError('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 hover:bg-rose-100 font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            رفض وفك الحجز
                          </button>
                        </div>
                      </td>
                    ) : (
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>بانتظار موافقة رئيس القسم</span>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <XCircle className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                رفض طلب الصرف وفك حجز الكمية
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              عند تأكيد الرفض، سيتم إلغاء حجز الكمية فوراً وإعادتها للرصيد المتاح للتشغيل دون إنقاص الرصيد الفعلي.
            </p>

            {rejectError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {rejectError}
              </div>
            )}

            <form onSubmit={handleRejectSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  سبب الرفض الإلزامي *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="اكتب مبررات الرفض التي ستسجل في سجل التدقيق..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isRejecting ? 'جارٍ الرفض...' : 'تأكيد الرفض وفك الحجز'}
                </button>
                <button
                  type="button"
                  onClick={() => setRejectTargetId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
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
