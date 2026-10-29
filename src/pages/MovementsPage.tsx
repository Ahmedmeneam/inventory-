import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ArrowRightLeft,
  Warehouse as WarehouseIcon,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Info,
  Calendar,
  FileText,
  User,
  Building,
  RotateCcw,
  Sparkles,
  Layers,
} from 'lucide-react';

export const MovementsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStorekeeper = user?.role === 'storekeeper';

  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Master Data
  const [custodiesList, setCustodiesList] = useState<any[]>([]);
  const [selectedCustodyId, setSelectedCustodyId] = useState<string>(
    user?.custody_id ? String(user?.custody_id) : ''
  );
  const [allWarehouses, setAllWarehouses] = useState<any[]>([]);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [movementsList, setMovementsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Fields (Requested by user)
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [itemCodeInput, setItemCodeInput] = useState<string>('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>('');
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [trxNumber, setTrxNumber] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');

  // Optional Fields (أماكن لباقي البيانات اختياري المستخدم يملاها أو يسيبها فاضية)
  const [docRef, setDocRef] = useState<string>('');
  const [partyName, setPartyName] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [trxDate, setTrxDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isDisposal, setIsDisposal] = useState<boolean>(false);

  // Status & Feedback
  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Live Delegation Preview (when issuing)
  const [delegationCheck, setDelegationCheck] = useState<{
    isDelegated: boolean;
    badge: 'green' | 'amber';
    badgeText: string;
    remainingToday?: number;
    reason?: string;
  } | null>(null);

  // Fetch initial master data
  const fetchMasterData = async () => {
    try {
      setLoading(true);
      const [whRes, custRes, itRes, trxRes] = await Promise.all([
        fetch('/api/warehouses'),
        fetch('/api/custodies'),
        fetch('/api/items'),
        fetch('/api/movements/next-trx-number'),
      ]);

      if (whRes.ok) {
        const whData = await whRes.json();
        setAllWarehouses(whData.warehouses || []);
      }
      if (custRes.ok) {
        const cData = await custRes.json();
        setCustodiesList(cData.custodies || []);
        if (!selectedCustodyId && cData.custodies?.length > 0) {
          setSelectedCustodyId(String(cData.custodies[0].id));
        }
      }
      if (itRes.ok) {
        const itData = await itRes.json();
        setItemsList(itData.items || []);
      }
      if (trxRes.ok) {
        const numberData = await trxRes.json();
        setTrxNumber((current) => current || numberData.nextTrxNumber || '');
      }
    } catch (err) {
      console.error('Error fetching movement master data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async (cId: string) => {
    try {
      const url = cId ? `/api/custodies/${cId}/movements` : '/api/ledger';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMovementsList(data.movements || []);
      }
    } catch (err) {
      console.error('Error fetching movements:', err);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (selectedCustodyId) {
      fetchMovements(selectedCustodyId);
    }
  }, [selectedCustodyId]);

  // Two-way synchronization: When Item dropdown changes -> Auto-populate Item Code
  const handleItemSelectChange = (itemId: string) => {
    setSelectedItemId(itemId);
    setFormError('');
    if (!itemId) {
      setItemCodeInput('');
      return;
    }
    const found = itemsList.find((it) => String(it.id) === itemId);
    if (found) {
      setItemCodeInput(found.item_code || '');
    }
  };

  // Two-way synchronization: When Item Code input changes -> Auto-select Item in dropdown
  const handleItemCodeInputChange = (code: string) => {
    setItemCodeInput(code);
    setFormError('');
    const clean = code.trim().toLowerCase();
    if (!clean) {
      setSelectedItemId('');
      return;
    }
    const found = itemsList.find(
      (it) => it.item_code?.toLowerCase() === clean
    );
    if (found) {
      setSelectedItemId(String(found.id));
    }
  };

  // Determine available warehouses for source & target
  // Filter by selected custody if specified, but always include general company warehouses
  const availableWarehouses = allWarehouses.filter((w) => {
    if (!selectedCustodyId) return true;
    return w.is_general || String(w.custody_id) === selectedCustodyId;
  });

  // Smart Movement Type Detection based on chosen warehouses
  let detectedType: 'addition' | 'issue' | 'transfer' | 'none' = 'none';
  if (!sourceWarehouseId && targetWarehouseId) {
    detectedType = 'addition';
  } else if (sourceWarehouseId && !targetWarehouseId) {
    detectedType = 'issue';
  } else if (sourceWarehouseId && targetWarehouseId) {
    detectedType = 'transfer';
  }

  // Selected item object and balances
  const selectedItem = itemsList.find((it) => String(it.id) === selectedItemId);

  // Live delegation check when issuing
  useEffect(() => {
    if (
      detectedType !== 'issue' ||
      !selectedCustodyId ||
      !selectedItemId ||
      !sourceWarehouseId ||
      !quantity ||
      Number(quantity) <= 0
    ) {
      setDelegationCheck(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/custodies/${selectedCustodyId}/delegation-check`, {
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
        console.error('Error running delegation check:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [detectedType, selectedCustodyId, selectedItemId, sourceWarehouseId, quantity]);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!selectedItemId) {
      setFormError('يرجى تحديد الصنف أو كتابة كود الصنف بشكل صحيح');
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setFormError('يرجى إدخال كمية صحيحة أكبر من صفر');
      return;
    }

    if (detectedType === 'none') {
      setFormError('يرجى اختيار المخزن المخصوم منه (للصرف) أو المخزن المضاف إليه (للوارد) أو كلاهما (للتحويل)');
      return;
    }

    if (detectedType === 'transfer' && sourceWarehouseId === targetWarehouseId) {
      setFormError('لا يمكن التحويل لنفس المخزن، يرجى اختيار مخزن مستقبل مختلف عن المخزن المخصوم منه');
      return;
    }

    // Determine target custodyId
    let targetCustody = selectedCustodyId;
    if (!targetCustody) {
      if (sourceWarehouseId) {
        const sw = allWarehouses.find((w) => String(w.id) === sourceWarehouseId);
        targetCustody = sw?.custody_id ? String(sw.custody_id) : '1';
      } else if (targetWarehouseId) {
        const tw = allWarehouses.find((w) => String(w.id) === targetWarehouseId);
        targetCustody = tw?.custody_id ? String(tw.custody_id) : '1';
      }
    }

    // Combine notes with optional fields
    const optionalDetails = [
      notes.trim(),
      docRef.trim() ? `[رقم المستند/الفاتورة: ${docRef.trim()}]` : null,
      partyName.trim() ? `[الجهة/المستلم/المورد: ${partyName.trim()}]` : null,
      department.trim() ? `[القسم/مركز التكلفة: ${department.trim()}]` : null,
      receiverPhone.trim() ? `[هاتف المستلم: ${receiverPhone.trim()}]` : null,
      trxDate ? `[تاريخ المعاملة: ${trxDate}]` : null,
    ].filter(Boolean).join(' • ');

    setIsSubmitting(true);

    try {
      let endpoint = '';
      let payload: any = {
        itemId: Number(selectedItemId),
        quantity: Number(quantity),
        notes: optionalDetails || undefined,
        userId: user?.id,
        trxNumber: trxNumber.trim() || undefined,
      };

      if (detectedType === 'addition') {
        endpoint = `/api/custodies/${targetCustody}/movements/add`;
        payload.targetWarehouseId = Number(targetWarehouseId);
      } else if (detectedType === 'issue') {
        if (isDisposal) {
          endpoint = `/api/custodies/${targetCustody}/movements/disposal`;
        } else {
          endpoint = `/api/custodies/${targetCustody}/movements/issue`;
        }
        payload.sourceWarehouseId = Number(sourceWarehouseId);
      } else if (detectedType === 'transfer') {
        endpoint = `/api/custodies/${targetCustody}/movements/transfer`;
        payload.sourceWarehouseId = Number(sourceWarehouseId);
        payload.targetWarehouseId = Number(targetWarehouseId);
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
      // Reset form
      setSelectedItemId('');
      setItemCodeInput('');
      setQuantity('');
      setSourceWarehouseId('');
      setTargetWarehouseId('');
      setDocRef('');
      setPartyName('');
      setDepartment('');
      setNotes('');
      setReceiverPhone('');
      setTrxNumber('');
      setIsDisposal(false);
      setDelegationCheck(null);

      // Refresh master & movements data
      fetchMasterData();
      if (selectedCustodyId) fetchMovements(selectedCustodyId);
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء تنفيذ الحركة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            <span>تسجيل العمليات المخزنية الموحدة</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تسجيل فوري وذكي للوارد والصرف والتحويل الداخلي مع التحديد التلقائي لكود الصنف وحركات المخازن
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Admin Custody Selector if multi-custody */}
          {isAdmin && custodiesList.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">العهدة:</span>
              <select
                value={selectedCustodyId}
                onChange={(e) => setSelectedCustodyId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              >
                {custodiesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              تسجيل عملية
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
              سجل العمليات ({movementsList.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'create' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
          {/* Notice for Storekeeper */}
          {isStorekeeper && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">ملاحظة الحوكمة (أمين العهدة): </span>
                العمليات غير المفوضة فورياً تُسجل معلقة وتُرسل إشعاراً لرئيس القسم لاعتمادها أو رفضها مع حجز الكميات فورياً.
              </div>
            </div>
          )}

          {/* Alert Messages */}
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

          <form onSubmit={handleSubmit} className="space-y-6 text-xs">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">رقم العملية (تلقائي ويمكن تعديله)</label>
                <input type="text" value={trxNumber} onChange={(e) => setTrxNumber(e.target.value)} placeholder="يُقترح رقم تلقائي" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono" />
                <p className="text-[11px] text-slate-500 mt-1">يُرفض الرقم إذا كان مستخدماً من قبل.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">رقم هاتف المستلم (اختياري)</label>
                <input type="tel" value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="رقم الهاتف" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              </div>
            </div>
            {/* 1. Item Selection & Code with Two-Way Synchronization */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>بيانات الصنف (تحديد تلقائي متبادل بين الصنف والكود)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Item Dropdown */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    اختر الصنف *
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => handleItemSelectChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">حدد الصنف من قائمة الأصناف</option>
                    {itemsList.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} — {it.item_code} ({it.unit_name || 'وحدة'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Item Code Input */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    كود الصنف (اكتب الكود وسيتم اختيار الصنف تلقائياً) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="مثال: ITEM-0001 أو امسح الباركود..."
                      value={itemCodeInput}
                      onChange={(e) => handleItemCodeInputChange(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono uppercase"
                    />
                    {selectedItem && (
                      <span className="absolute left-3 top-2.5 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        صنف مطابق
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedItem && (
                <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 text-[11px] flex flex-wrap gap-4 font-medium border border-indigo-100 dark:border-indigo-900/40">
                  <span>اسم الصنف: <strong>{selectedItem.name}</strong></span>
                  <span>الكود: <strong className="font-mono">{selectedItem.item_code}</strong></span>
                  <span>وحدة القياس: <strong>{selectedItem.unit_name || 'وحدة'}</strong></span>
                  <span>حد الأمان: <strong>{selectedItem.min_limit || 0}</strong></span>
                </div>
              )}
            </div>

            {/* 2. Warehouses Selection (المخصوم منه والمضاف إليه) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <WarehouseIcon className="w-4 h-4 text-indigo-600" />
                <span>تحديد المخازن (المخصوم منه والمضاف إليه)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Source Warehouse (المخصوم منه) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    المخزن المخصوم منه (اتركه فارغاً إذا كانت العملية إضافة/وارد جديد)
                  </label>
                  <select
                    value={sourceWarehouseId}
                    onChange={(e) => {
                      setSourceWarehouseId(e.target.value);
                      setFormError('');
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 font-medium ${
                      sourceWarehouseId
                        ? 'border-rose-400 dark:border-rose-700 text-rose-950 dark:text-rose-100'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <option value="">— بدون مخزن مصدر (حركة وارد خارجي أو إضافة جديدة) —</option>
                    {availableWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.is_main ? '(المخزن الرئيسي)' : w.is_general ? '(مخزن عام)' : '(فرعي)'} {w.custody_name ? `• عهدة ${w.custody_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Warehouse (المضاف إليه) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    المخزن المضاف إليه (اتركه فارغاً إذا كانت العملية خصم/صرف مخزني)
                  </label>
                  <select
                    value={targetWarehouseId}
                    onChange={(e) => {
                      setTargetWarehouseId(e.target.value);
                      setFormError('');
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl border bg-white dark:bg-slate-900 font-medium ${
                      targetWarehouseId
                        ? 'border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <option value="">— بدون مخزن هدف (حركة صرف / خروج من المخزن) —</option>
                    {availableWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.is_main ? '(المخزن الرئيسي)' : w.is_general ? '(مخزن عام)' : '(فرعي)'} {w.custody_name ? `• عهدة ${w.custody_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Movement Nature Indicator */}
              <div className="p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-500">نوع الحركة المكتشف تلقائياً:</span>
                  {detectedType === 'addition' && (
                    <span className="px-2.5 py-1 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      وارد مخزني (إضافة إلى المخزن المضاف إليه)
                    </span>
                  )}
                  {detectedType === 'issue' && (
                    <span className="px-2.5 py-1 rounded-full font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                      {isDisposal ? 'خروج نهائي / تكهين' : 'صرف مخزني (خصم من المخزن المخصوم منه)'}
                    </span>
                  )}
                  {detectedType === 'transfer' && (
                    <span className="px-2.5 py-1 rounded-full font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                      تحويل داخلي بين المخازن
                    </span>
                  )}
                  {detectedType === 'none' && (
                    <span className="text-amber-600 font-medium">
                      يرجى اختيار المخزن المخصوم منه أو المضاف إليه لتحديد طبيعة العملية تلقائياً
                    </span>
                  )}
                </div>

                {/* Optional Disposal Toggle when issuing */}
                {detectedType === 'issue' && (
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-semibold">
                    <input
                      type="checkbox"
                      checked={isDisposal}
                      onChange={(e) => setIsDisposal(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>هل العملية إتلاف أو خروج نهائي / تكهين؟</span>
                  </label>
                )}
              </div>
            </div>

            {/* 3. Quantity & Delegation Check */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الكمية بالوحدة الأساسية ({selectedItem?.unit_name || 'وحدة'}) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="مثال: 10 أو 2.500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                />
              </div>

              {/* Delegation Banner for Issue */}
              {detectedType === 'issue' && delegationCheck && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 ${
                    delegationCheck.badge === 'green'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  <div className="leading-tight">
                    <p className="font-bold">{delegationCheck.badgeText}</p>
                    {delegationCheck.badge === 'green' ? (
                      <p className="text-[11px] opacity-80">سيتم الخصم فورياً بالصلاحية المفوضة.</p>
                    ) : (
                      <p className="text-[11px] opacity-80">سيتطلب اعتماد رئيس القسم وتُحجز الكمية.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Optional Fields (أماكن لباقي البيانات اختياري المستخدم يملاها أو يسيبها فاضية) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  بيانات إضافية توثيقية (اختيارية - يمكنك ملؤها أو تركها فارغة)
                </span>
                <span className="text-[11px] text-slate-400 font-normal">اختياري</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Document Reference */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">
                    رقم الإذن / الفاتورة / أمر الشغل
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: فاتورة 1024 أو إذن 88"
                    value={docRef}
                    onChange={(e) => setDocRef(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                  />
                </div>

                {/* Recipient / Vendor */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">
                    اسم المورد / المستلم / المستفيد
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: شركة النور أو م. أحمد"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">
                    مركز التكلفة / القسم الطالب
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: قسم الصيانة أو خط الإنتاج 2"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                  />
                </div>

                {/* Transaction Date */}
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">
                    تاريخ المعاملة
                  </label>
                  <input
                    type="date"
                    value={trxDate}
                    onChange={(e) => setTrxDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  البيان والملاحظات العامة
                </label>
                <input
                  type="text"
                  placeholder="ملاحظات توضيحية حول العملية أو بنود الصرف..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !selectedItemId || !quantity || detectedType === 'none'}
                className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-xs transition-colors cursor-pointer ${
                  !isSubmitting && selectedItemId && quantity && detectedType !== 'none'
                    ? detectedType === 'addition'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : detectedType === 'issue'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-sky-600 hover:bg-sky-700 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting
                  ? 'جارٍ تسجيل العملية...'
                  : isStorekeeper
                  ? detectedType === 'addition'
                    ? 'رفع طلب إذن إضافة وارد (بانتظار موافقة رئيس القسم)'
                    : detectedType === 'issue'
                    ? delegationCheck?.badge === 'green'
                      ? 'تنفيذ إذن الصرف اللحظي (مفوض)'
                      : 'رفع طلب إذن الصرف (بانتظار موافقة رئيس القسم)'
                    : detectedType === 'transfer'
                    ? 'رفع طلب تحويل داخلي (بانتظار موافقة رئيس القسم)'
                    : 'تأكيد وحفظ العملية المخزنية'
                  : detectedType === 'addition'
                  ? 'تأكيد إضافة الوارد للمخزن'
                  : detectedType === 'issue'
                  ? 'تأكيد تسجيل الخصم المخزني'
                  : detectedType === 'transfer'
                  ? 'تأكيد التحويل المخزني الفوري'
                  : 'تأكيد وحفظ العملية المخزنية'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          {movementsList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <ArrowRightLeft className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-xs">لا توجد حركات مخزنية مسجلة بعد. استخدم نموذج التسجيل بالأعلى لإدخال أول حركة.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">رقم TRX</th>
                    <th className="py-2.5 px-3">نوع العملية</th>
                    <th className="py-2.5 px-3">الصنف</th>
                    <th className="py-2.5 px-3">المخزن المخصوم منه</th>
                    <th className="py-2.5 px-3">المخزن المضاف إليه</th>
                    <th className="py-2.5 px-3 text-center">الكمية</th>
                    <th className="py-2.5 px-3">الحالة</th>
                    <th className="py-2.5 px-3">التاريخ والمنفذ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {movementsList.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {m.trx_number}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.movement_type === 'addition'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : m.movement_type === 'issue'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : m.movement_type === 'internal_transfer'
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {m.movement_type === 'addition'
                            ? 'وارد خارجي'
                            : m.movement_type === 'issue'
                            ? 'خصم مخزني'
                            : m.movement_type === 'internal_transfer'
                            ? 'تحويل داخلي'
                            : m.movement_type === 'disposal'
                            ? 'خروج نهائي'
                            : m.movement_type}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{m.item_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{m.item_code}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {m.source_warehouse_name || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {m.target_warehouse_name || '—'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        {m.quantity} {m.unit_symbol || ''}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.status === 'executed' || m.status === 'approved' || m.status === 'executed_delegated'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : m.status === 'pending_approval'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {m.status === 'executed' || m.status === 'approved'
                            ? 'معتمدة ومنفذة'
                            : m.status === 'executed_delegated'
                            ? 'خصم مفوض فورياً'
                            : m.status === 'pending_approval'
                            ? 'معلقة للموافقة'
                            : 'مرفوضة'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-500">
                        <div>{new Date(m.created_at).toLocaleDateString('ar-EG')}</div>
                        <div className="text-[10px] text-slate-400">{m.creator_name || m.creator_code}</div>
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
