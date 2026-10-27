import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Movement, Warehouse, Item } from '../types/index.ts';
import {
  ArrowRightLeft,
  PlusCircle,
  MinusCircle,
  Repeat,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Info,
  Warehouse as WarehouseIcon,
  Search,
} from 'lucide-react';

export const MovementsPage: React.FC = () => {
  const { user } = useAuth();
  const custodyId = user?.custody_id;

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [movementMode, setMovementMode] = useState<'addition' | 'issue' | 'transfer' | 'disposal'>('addition');

  // Master Data
  const [custodyWarehouses, setCustodyWarehouses] = useState<any[]>([]);
  const [custodyItems, setCustodyItems] = useState<any[]>([]);
  const [movementsList, setMovementsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>('');
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Live Delegation Preview State (for Issue mode)
  const [delegationCheck, setDelegationCheck] = useState<{
    isDelegated: boolean;
    badge: 'green' | 'amber';
    badgeText: string;
    remainingToday?: number;
    reason?: string;
  } | null>(null);
  const [isCheckingDelegation, setIsCheckingDelegation] = useState(false);

  // Find Main Warehouse
  const mainWarehouse = custodyWarehouses.find((w) => w.is_main || w.isMain);

  const fetchMasterData = async () => {
    if (!custodyId) return;

    try {
      const [whRes, itRes, movRes] = await Promise.all([
        fetch(`/api/custodies/${custodyId}/warehouses`),
        fetch(`/api/custodies/${custodyId}/items`),
        fetch(`/api/custodies/${custodyId}/movements`),
      ]);

      if (whRes.ok) {
        const whData = await whRes.json();
        setCustodyWarehouses(whData.warehouses || []);
      }
      if (itRes.ok) {
        const itData = await itRes.json();
        setCustodyItems(itData.items || []);
      }
      if (movRes.ok) {
        const mData = await movRes.json();
        setMovementsList(mData.movements || []);
      }
    } catch (err) {
      console.error('Error fetching movement data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, [custodyId]);

  // Set default target warehouse for addition mode to Main Warehouse
  useEffect(() => {
    if (movementMode === 'addition' && mainWarehouse) {
      setTargetWarehouseId(String(mainWarehouse.id));
    }
  }, [movementMode, mainWarehouse]);

  // Live Delegation Check when in Issue mode
  useEffect(() => {
    if (movementMode !== 'issue' || !selectedItemId || !sourceWarehouseId || !quantity || Number(quantity) <= 0) {
      setDelegationCheck(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingDelegation(true);
      try {
        const res = await fetch(`/api/custodies/${custodyId}/delegation-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: Number(selectedItemId),
            warehouseId: Number(sourceWarehouseId),
            quantity: Number(quantity),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setDelegationCheck(data);
        }
      } catch (err) {
        console.error('Error in live delegation check:', err);
      } finally {
        setIsCheckingDelegation(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [movementMode, selectedItemId, sourceWarehouseId, quantity, custodyId]);

  // Reset form messages when switching modes
  const handleModeSwitch = (mode: 'addition' | 'issue' | 'transfer' | 'disposal') => {
    setMovementMode(mode);
    setFormError('');
    setFormSuccess('');
    setSelectedItemId('');
    setQuantity('');
    setNotes('');
    setDelegationCheck(null);

    if (mode === 'addition' && mainWarehouse) {
      setTargetWarehouseId(String(mainWarehouse.id));
      setSourceWarehouseId('');
    } else if (mode === 'issue' || mode === 'disposal') {
      setSourceWarehouseId(mainWarehouse ? String(mainWarehouse.id) : '');
      setTargetWarehouseId('');
    } else if (mode === 'transfer') {
      setSourceWarehouseId(mainWarehouse ? String(mainWarehouse.id) : '');
      const secondary = custodyWarehouses.find((w) => !w.is_main && !w.isMain);
      setTargetWarehouseId(secondary ? String(secondary.id) : '');
    }
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!selectedItemId || !quantity || Number(quantity) <= 0) {
      setFormError('يرجى تحديد الصنف وإدخال كمية صالحة');
      return;
    }

    setIsSubmitting(true);

    try {
      let endpoint = '';
      let payload: any = {
        itemId: Number(selectedItemId),
        quantity: Number(quantity),
        notes: notes.trim() || undefined,
        userId: user?.id,
      };

      if (movementMode === 'addition') {
        endpoint = `/api/custodies/${custodyId}/movements/add`;
        payload.targetWarehouseId = Number(targetWarehouseId);
      } else if (movementMode === 'issue') {
        endpoint = `/api/custodies/${custodyId}/movements/issue`;
        payload.sourceWarehouseId = Number(sourceWarehouseId);
      } else if (movementMode === 'transfer') {
        endpoint = `/api/custodies/${custodyId}/movements/transfer`;
        payload.sourceWarehouseId = Number(sourceWarehouseId);
        payload.targetWarehouseId = Number(targetWarehouseId);
      } else if (movementMode === 'disposal') {
        endpoint = `/api/custodies/${custodyId}/movements/disposal`;
        payload.sourceWarehouseId = Number(sourceWarehouseId);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشلت العملية');
      }

      setFormSuccess(data.message || 'تمت العملية بنجاح');
      setSelectedItemId('');
      setQuantity('');
      setNotes('');
      setDelegationCheck(null);
      fetchMasterData();
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء تنفيذ الحركة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItemData = custodyItems.find((i) => i.item_id === Number(selectedItemId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            <span>العمليات والحركات المخزنية</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            العهدة: <strong>{user?.custody_name || 'غير مسكنة'}</strong> • الترقيم المالي الموحد TRX
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            تسجيل حركة جديدة
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            سجل العمليات الحديثة ({movementsList.length})
          </button>
        </div>
      </div>

      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Operation Type Switcher */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => handleModeSwitch('addition')}
              className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
                movementMode === 'addition'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <PlusCircle className={`w-5 h-5 ${movementMode === 'addition' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  المخزن الرئيسي فقط
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">إضافة (وارد خارجي)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">توريد أو شراء خارجي</p>
            </button>

            <button
              type="button"
              onClick={() => handleModeSwitch('issue')}
              className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
                movementMode === 'issue'
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <MinusCircle className={`w-5 h-5 ${movementMode === 'issue' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  تفويض ذكي لحظي
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">خصم مخزني</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">صرف مفوض أو طلب معلق</p>
            </button>

            <button
              type="button"
              onClick={() => handleModeSwitch('transfer')}
              className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
                movementMode === 'transfer'
                  ? 'bg-sky-50/70 dark:bg-sky-950/40 border-sky-500 ring-2 ring-sky-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Repeat className={`w-5 h-5 ${movementMode === 'transfer' ? 'text-sky-600' : 'text-slate-400'}`} />
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                  فوري وذري
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">تحويل داخلي</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">نقل بين مخازن نفس العهدة</p>
            </button>

            <button
              type="button"
              onClick={() => handleModeSwitch('disposal')}
              className={`p-4 rounded-xl border text-right transition-all cursor-pointer ${
                movementMode === 'disposal'
                  ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Trash2 className={`w-5 h-5 ${movementMode === 'disposal' ? 'text-rose-600' : 'text-slate-400'}`} />
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                  اعتماد رئيس القسم
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">خروج نهائي</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">إتلاف أو تكهين رسمي</p>
            </button>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
            {/* Strict Main Warehouse Guidance Callout (Rule 3) */}
            {movementMode === 'addition' && (
              <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/60 flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                  <h4 className="font-bold">القاعدة الحاكمة للوارد الخارجي (Rule 3):</h4>
                  <p className="mt-0.5">
                    الوارد الخارجي يُسجل حصرياً في <strong>المخزن الرئيسي للعهدة</strong>، ويتم توزيعه للمخازن الفرعية عبر <strong>التحويل الداخلي</strong>. تم تعطيل اختيار المخازن الفرعية التزاماً بالمواصفات الفنية المعتمدة.
                  </p>
                </div>
              </div>
            )}

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleMovementSubmit} className="space-y-4 text-xs">
              {/* Item Selection */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اختر الصنف المطلوب *
                </label>
                <select
                  required
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">حدد الصنف من قائمة أصناف العهدة</option>
                  {custodyItems.map((it) => (
                    <option key={it.item_id} value={it.item_id}>
                      {it.name} ({it.item_code}) — الرصيد المتاح: {it.available_qty} {it.unit_symbol}
                    </option>
                  ))}
                </select>
                {selectedItemData && (
                  <div className="flex gap-4 text-[11px] text-slate-500 mt-1.5 px-1">
                    <span>الرصيد الفعلي الإجمالي: <strong>{selectedItemData.quantity}</strong></span>
                    <span>الرصيد المحجوز: <strong className="text-amber-600">{selectedItemData.reserved_qty}</strong></span>
                    <span>الرصيد الحر المتاح: <strong className="text-emerald-600">{selectedItemData.available_qty}</strong></span>
                  </div>
                )}
              </div>

              {/* Warehouses Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Source Warehouse (Issue, Transfer, Disposal) */}
                {movementMode !== 'addition' && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      المخزن المصدر (المخصوم منه) *
                    </label>
                    <select
                      required
                      value={sourceWarehouseId}
                      onChange={(e) => setSourceWarehouseId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="">اختر المخزن المصدر</option>
                      {custodyWarehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.is_main || w.isMain ? '(المخزن الرئيسي)' : '(فرعي)'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Target Warehouse (Addition or Transfer) */}
                {(movementMode === 'addition' || movementMode === 'transfer') && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      المخزن الهدف (المستقبل) *
                    </label>
                    {movementMode === 'addition' ? (
                      <input
                        type="text"
                        disabled
                        value={mainWarehouse?.name || 'المخزن الرئيسي للعهدة (إلزامي)'}
                        className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200 font-bold cursor-not-allowed"
                      />
                    ) : (
                      <select
                        required
                        value={targetWarehouseId}
                        onChange={(e) => setTargetWarehouseId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="">اختر المخزن الهدف للتحويل</option>
                        {custodyWarehouses
                          .filter((w) => String(w.id) !== sourceWarehouseId)
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} {w.is_main || w.isMain ? '(المخزن الرئيسي)' : '(فرعي)'}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الكمية بالوحدة الأساسية ({selectedItemData?.unit_name || 'وحدة'}) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="مثال: 15 أو 2.500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-base font-bold text-left dir-ltr"
                />
              </div>

              {/* Delegation Badge for Issue Mode (Rule 4) */}
              {movementMode === 'issue' && delegationCheck && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 transition-all ${
                    delegationCheck.badge === 'green'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  {delegationCheck.badge === 'green' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-relaxed">
                    <p className="font-bold">{delegationCheck.badgeText}</p>
                    {delegationCheck.badge === 'green' ? (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                        سيتم تنفيذ الخصم فورياً وإنقاص الرصيد دون انتظار رئيس القسم.
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                        سيتم حجز الكمية فورياً في حقل (الرصيد المحجوز) لحين مراجعة واعتماد رئيس القسم.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  البيان والملاحظات
                </label>
                <input
                  type="text"
                  placeholder="مثال: إذن إضافة توريد فاتورة رقم 1024 أو أمر صرف ورشة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedItemId || !quantity}
                  className={`w-full py-3 rounded-xl font-bold text-sm shadow-xs transition-colors cursor-pointer ${
                    !isSubmitting && selectedItemId && quantity
                      ? movementMode === 'addition'
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : movementMode === 'issue'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : movementMode === 'transfer'
                        ? 'bg-sky-600 hover:bg-sky-700 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting
                    ? 'جارٍ تنفيذ وتسجيل الحركة...'
                    : movementMode === 'addition'
                    ? 'تأكيد إضافة الوارد للمخزن الرئيسي'
                    : movementMode === 'issue'
                    ? 'تأكيد تسجيل الخصم'
                    : movementMode === 'transfer'
                    ? 'تأكيد التحويل الداخلي الفوري'
                    : 'رفع طلب الخروج النهائي'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          {movementsList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <ArrowRightLeft className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-xs">لا توجد أي حركات مخزنية مسجلة بعد (Zero Records). ابدأ بتسجيل أول حركة تشغيلية بيدك.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">رقم المعاملة TRX</th>
                    <th className="py-2.5 px-3">النوع</th>
                    <th className="py-2.5 px-3">الصنف</th>
                    <th className="py-2.5 px-3">المخزن المصدر</th>
                    <th className="py-2.5 px-3">المخزن الهدف</th>
                    <th className="py-2.5 px-3 text-center">الكمية</th>
                    <th className="py-2.5 px-3">الحالة</th>
                    <th className="py-2.5 px-3">المنفذ / التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {movementsList.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {m.trx_number}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold">
                          {m.movement_type === 'addition'
                            ? 'إضافة'
                            : m.movement_type === 'issue'
                            ? 'خصم'
                            : m.movement_type === 'internal_transfer'
                            ? 'تحويل داخلي'
                            : m.movement_type === 'disposal'
                            ? 'خروج نهائي'
                            : m.movement_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {m.item_name} <span className="text-[10px] text-slate-400 font-mono">({m.item_code})</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{m.source_warehouse_name || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-500">{m.target_warehouse_name || '—'}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {m.quantity} {m.unit_symbol}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            m.status === 'executed' || m.status === 'executed_delegated'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : m.status === 'pending_approval'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {m.status === 'executed_delegated'
                            ? 'خصم مفوض فوري'
                            : m.status === 'executed'
                            ? 'منفذ ومعتمد'
                            : m.status === 'pending_approval'
                            ? 'معلق (محجوز)'
                            : m.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500">
                        {m.creator_name} ({new Date(m.created_at).toLocaleDateString('ar-EG')})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
