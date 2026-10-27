import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ShieldCheck,
  PlusCircle,
  Clock,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Warehouse,
  Boxes,
  HelpCircle,
  Calendar,
  Layers,
} from 'lucide-react';

export const DelegationSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const custodyId = user?.custody_id;

  const [activeTab, setActiveTab] = useState<'rules' | 'review'>('rules');
  const [rulesList, setRulesList] = useState<any[]>([]);
  const [delegatedMovements, setDelegatedMovements] = useState<any[]>([]);
  const [custodyWarehouses, setCustodyWarehouses] = useState<any[]>([]);
  const [custodyItems, setCustodyItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal: Add Rule
  const [showAddRule, setShowAddRule] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [maxQtyPerOp, setMaxQtyPerOp] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [ruleError, setRuleError] = useState('');
  const [isSavingRule, setIsSavingRule] = useState(false);

  const fetchData = async () => {
    if (!custodyId) return;

    try {
      const [rulesRes, movRes, whRes, itRes] = await Promise.all([
        fetch(`/api/custodies/${custodyId}/delegation-rules`),
        fetch(`/api/custodies/${custodyId}/movements?status=executed_delegated`),
        fetch(`/api/custodies/${custodyId}/warehouses`),
        fetch(`/api/custodies/${custodyId}/items`),
      ]);

      if (rulesRes.ok) {
        const rData = await rulesRes.json();
        setRulesList(rData.rules || []);
      }
      if (movRes.ok) {
        const mData = await movRes.json();
        setDelegatedMovements(mData.movements || []);
      }
      if (whRes.ok) {
        const wData = await whRes.json();
        setCustodyWarehouses(wData.warehouses || []);
      }
      if (itRes.ok) {
        const iData = await itRes.json();
        setCustodyItems(iData.items || []);
      }
    } catch (err) {
      console.error('Error fetching delegation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [custodyId]);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId || !selectedItemId || !maxQtyPerOp || !dailyLimit) return;

    if (Number(maxQtyPerOp) > Number(dailyLimit)) {
      setRuleError('حد العملية الواحدة لا يمكن أن يتجاوز السقف اليومي');
      return;
    }

    setRuleError('');
    setIsSavingRule(true);

    try {
      const res = await fetch(`/api/custodies/${custodyId}/delegation-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: Number(selectedWarehouseId),
          itemId: Number(selectedItemId),
          maxQtyPerOp: Number(maxQtyPerOp),
          dailyLimit: Number(dailyLimit),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل حفظ قاعدة التفويض');
      }

      setShowAddRule(false);
      setSelectedWarehouseId('');
      setSelectedItemId('');
      setMaxQtyPerOp('');
      setDailyLimit('');
      fetchData();
    } catch (err: any) {
      setRuleError(err.message || 'حدث خطأ');
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('هل أنت متأكد من رغبتك في إلغاء قاعدة التفويض لهذا الصنف؟')) return;

    try {
      const res = await fetch(`/api/custodies/${custodyId}/delegation-rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      }
    } catch {
      alert('فشل حذف القاعدة');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>محرك ومراجعة تفويض الخصم الفوري</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            صلاحية رئيس القسم: ضبط سقوف الخصم المباشر لأمين العهدة ومراجعة الحركات الفورية المنفذة
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'rules' && (
            <button
              type="button"
              onClick={() => setShowAddRule(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة قاعدة تفويض لصنف</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
            activeTab === 'rules'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>قواعد وسقوف التفويض النشطة ({rulesList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('review')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
            activeTab === 'review'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>مراجعة الخصم المفوض المنفذ ({delegatedMovements.length})</span>
        </button>
      </div>

      {/* Tab 1: Delegation Rules */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/50 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
              <h4 className="font-bold">الحساب الديناميكي لسقف اليوم (Rule 6):</h4>
              <p className="mt-0.5">
                يُحسب استهلاك اليوم تلقائياً من حركات تاريخ اليوم الفعلي في الخادم، ويُعاد احتساب المتبقي لحظياً بدون عدادات ميكانيكية أو مهام مجدولة.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            {rulesList.length === 0 ? (
              <div className="p-10 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <ShieldCheck className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs">لا توجد قواعد تفويض مسجلة بعد. عند عدم وجود تفويض، تتطلب جميع حركات الخصم موافقة مسبقة من رئيس القسم.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">الصنف المفوض</th>
                      <th className="py-2.5 px-3">المخزن</th>
                      <th className="py-2.5 px-3 text-center">حد العملية الواحدة</th>
                      <th className="py-2.5 px-3 text-center">السقف التراكمي اليومي</th>
                      <th className="py-2.5 px-3 text-center">المستهلك اليوم</th>
                      <th className="py-2.5 px-3 text-center">المتبقي اليوم</th>
                      <th className="py-2.5 px-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rulesList.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                          {r.item_name} <span className="text-[10px] text-slate-400 font-mono">({r.item_code})</span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">{r.warehouse_name}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                          {r.max_qty_per_op} {r.unit_symbol}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {r.daily_limit} {r.unit_symbol}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                          {r.today_consumed} {r.unit_symbol}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {r.remaining_today} {r.unit_symbol}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(r.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف قاعدة التفويض"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Review Delegated Issues */}
      {activeTab === 'review' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          {delegatedMovements.length === 0 ? (
            <div className="p-10 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-xs">لم تسجل أي عمليات خصم فوري مفوض بعد.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">رقم المعاملة TRX</th>
                    <th className="py-2.5 px-3">الصنف</th>
                    <th className="py-2.5 px-3">المخزن المخصوم منه</th>
                    <th className="py-2.5 px-3 text-center">الكمية المصروفة</th>
                    <th className="py-2.5 px-3">أمين العهدة المنفذ</th>
                    <th className="py-2.5 px-3">التوقيت</th>
                    <th className="py-2.5 px-3">البيان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {delegatedMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {m.trx_number}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {m.item_name} <span className="text-[10px] text-slate-400 font-mono">({m.item_code})</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{m.source_warehouse_name}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {m.quantity} {m.unit_symbol}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {m.creator_name} ({m.creator_code})
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-400">
                        {new Date(m.created_at).toLocaleString('ar-EG')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                        {m.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Delegation Rule */}
      {showAddRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                ضبط قاعدة تفويض خصم لصنف
              </h3>
            </div>

            {ruleError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {ruleError}
              </div>
            )}

            <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اختر الصنف *
                </label>
                <select
                  required
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">حدد الصنف</option>
                  {custodyItems.map((it) => (
                    <option key={it.item_id} value={it.item_id}>
                      {it.name} ({it.item_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  المخزن المصرح بالخصم المفوض منه *
                </label>
                <select
                  required
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">حدد المخزن</option>
                  {custodyWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.is_main || w.isMain ? '(المخزن الرئيسي)' : '(فرعي)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    حد العملية الواحدة *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    placeholder="مثال: 5"
                    value={maxQtyPerOp}
                    onChange={(e) => setMaxQtyPerOp(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-left dir-ltr"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    السقف التراكمي اليومي *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    placeholder="مثال: 25"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-left dir-ltr"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSavingRule}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isSavingRule ? 'جارٍ الحفظ...' : 'تفعيل قاعدة التفويض'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddRule(false)}
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
