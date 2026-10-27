import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Layers,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Printer,
  PlusCircle,
  Search,
  Building,
  Warehouse,
  Boxes,
  RotateCcw,
  ShieldCheck,
  FileText,
  Save,
  Check,
  X,
  Calendar,
  AlertCircle,
  Eye,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const userCustodyId = user?.custody_id;

  const [activeTab, setActiveTab] = useState<'sessions' | 'closing'>('sessions');

  // Sessions list state
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [custodiesList, setCustodiesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active session details state
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeSessionData, setActiveSessionData] = useState<any | null>(null);
  const [countedRows, setCountedRows] = useState<any[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Modal: Start New Session
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedCustodyId, setSelectedCustodyId] = useState<string>(
    !isAdmin && userCustodyId ? String(userCustodyId) : ''
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [startError, setStartError] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  // Modal: Complete/Approve Session
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeNotes, setCompleteNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');

  // Modal: Cancel Session
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Annual Closing state
  const [closingStatus, setClosingStatus] = useState<any | null>(null);
  const [loadingClosing, setLoadingClosing] = useState(false);
  const [adminPasswordForClosing, setAdminPasswordForClosing] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closingError, setClosingError] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [closingSuccess, setClosingSuccess] = useState<string | null>(null);

  // Fetch sessions list & custodies
  const fetchSessionsData = async () => {
    try {
      setLoading(true);
      const custParam = !isAdmin && userCustodyId ? `?custodyId=${userCustodyId}` : '';
      const [sessRes, custRes] = await Promise.all([
        fetch(`/api/inventory/sessions${custParam}`),
        fetch('/api/custodies/organization'),
      ]);

      if (sessRes.ok) {
        const sData = await sessRes.json();
        setSessionsList(sData.sessions || []);
      }
      if (custRes.ok) {
        const cData = await custRes.json();
        setCustodiesList(cData.custodies || []);
      }
    } catch (err) {
      console.error('Error fetching inventory sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionsData();
  }, []);

  // Fetch active session details
  const fetchSessionDetails = async (id: number) => {
    try {
      setLoadingSession(true);
      const res = await fetch(`/api/inventory/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveSessionData(data.session);
        setCountedRows(data.counts || []);
      }
    } catch (err) {
      console.error('Error fetching session details:', err);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    if (activeSessionId) {
      fetchSessionDetails(activeSessionId);
    }
  }, [activeSessionId]);

  // Fetch Annual Closing status
  const fetchClosingStatus = async () => {
    try {
      setLoadingClosing(true);
      const res = await fetch('/api/inventory/annual-closing/status');
      if (res.ok) {
        const data = await res.json();
        setClosingStatus(data);
      }
    } catch (err) {
      console.error('Error fetching closing status:', err);
    } finally {
      setLoadingClosing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'closing') {
      fetchClosingStatus();
    }
  }, [activeTab]);

  // Handle Start Session
  const handleStartSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustodyId || !selectedWarehouseId) return;

    setIsStarting(true);
    setStartError('');

    try {
      const res = await fetch('/api/inventory/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custodyId: Number(selectedCustodyId),
          warehouseId: Number(selectedWarehouseId),
          notes: sessionNotes.trim() || undefined,
          userId: user?.id,
          userRole: user?.role,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل بدء جلسة الجرد');
      }

      setShowStartModal(false);
      setSelectedWarehouseId('');
      setSessionNotes('');
      fetchSessionsData();
      setActiveSessionId(data.session.id);
    } catch (err: any) {
      setStartError(err.message || 'حدث خطأ أثناء بدء الجلسة');
    } finally {
      setIsStarting(false);
    }
  };

  // Handle updating single row count in memory
  const handleCountChange = (rowId: number, val: string) => {
    setCountedRows((prev) =>
      prev.map((r) => {
        if (r.id === rowId) {
          const num = parseFloat(val) || 0;
          return {
            ...r,
            actual_quantity: num,
            difference: num - r.book_quantity,
          };
        }
        return r;
      })
    );
  };

  // Auto match all rows to book quantity
  const handleMatchAllToBook = () => {
    setCountedRows((prev) =>
      prev.map((r) => ({
        ...r,
        actual_quantity: r.book_quantity,
        difference: 0,
      }))
    );
  };

  // Zero all rows
  const handleZeroAll = () => {
    setCountedRows((prev) =>
      prev.map((r) => ({
        ...r,
        actual_quantity: 0,
        difference: -r.book_quantity,
      }))
    );
  };

  // Save draft counts
  const handleSaveDraftCounts = async () => {
    if (!activeSessionId) return;
    setIsSavingDraft(true);
    setSaveSuccessMsg(null);

    try {
      const payload = countedRows.map((r) => ({
        id: r.id,
        actual_quantity: r.actual_quantity,
        notes: r.notes,
      }));

      const res = await fetch(`/api/inventory/sessions/${activeSessionId}/counts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts: payload }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل حفظ أرقام العد');
      }

      setSaveSuccessMsg('تم حفظ أرقام العد الفعلي واحتساب الفروقات بنجاح');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Complete & Approve Session
  const handleCompleteSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId) return;

    setIsCompleting(true);
    setCompleteError('');

    try {
      // First save current counts
      await handleSaveDraftCounts();

      const res = await fetch(`/api/inventory/sessions/${activeSessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          userRole: user?.role,
          notes: completeNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل اعتماد محضر الجرد');
      }

      setShowCompleteModal(false);
      setCompleteNotes('');
      fetchSessionDetails(activeSessionId);
      fetchSessionsData();
      alert(data.message || 'تم اعتماد محضر الجرد بنجاح');
    } catch (err: any) {
      setCompleteError(err.message || 'حدث خطأ أثناء الاعتماد');
    } finally {
      setIsCompleting(false);
    }
  };

  // Cancel Session
  const handleCancelSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId || !cancelReason.trim()) return;

    setIsCancelling(true);
    setCancelError('');

    try {
      const res = await fetch(`/api/inventory/sessions/${activeSessionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason.trim(),
          userId: user?.id,
          userRole: user?.role,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إلغاء جلسة الجرد');
      }

      setShowCancelModal(false);
      setCancelReason('');
      fetchSessionDetails(activeSessionId);
      fetchSessionsData();
    } catch (err: any) {
      setCancelError(err.message || 'حدث خطأ أثناء إلغاء الجلسة');
    } finally {
      setIsCancelling(false);
    }
  };

  // Execute Annual Fiscal Closing
  const handleExecuteClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordForClosing.trim()) return;

    setIsClosing(true);
    setClosingError('');

    try {
      const res = await fetch('/api/inventory/annual-closing/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: adminPasswordForClosing,
          adminUserId: user?.id,
          notes: closingNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل تنفيذ الإقفال السنوي');
      }

      setClosingSuccess(data.message || 'تم إقفال السنة المالية بنجاح وتجميد أرصدتها');
      setAdminPasswordForClosing('');
      setClosingNotes('');
      fetchClosingStatus();
    } catch (err: any) {
      setClosingError(err.message || 'حدث خطأ أثناء الإقفال');
    } finally {
      setIsClosing(false);
    }
  };

  // Find warehouses for selected custody in start modal
  const selectedCustodyObj = custodiesList.find((c) => c.id === Number(selectedCustodyId));
  const availableWarehouses = selectedCustodyObj?.warehouses || [];

  // Differences metrics in active session
  const surplusCount = countedRows.filter((r) => r.difference > 0).length;
  const deficitCount = countedRows.filter((r) => r.difference < 0).length;
  const matchedCount = countedRows.filter((r) => r.difference === 0).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>الجرد الدوري والتسويات والإقفال السنوي (المرحلة 5)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            بدء جلسات الجرد الدوري، والتجميد التلقائي للمخازن، واحتساب الفروقات، والتسويات، ودورة الإقفال السنوي
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap no-print">
          {(isSupervisor || isAdmin) && activeTab === 'sessions' && !activeSessionId && (
            <button
              type="button"
              onClick={() => {
                setShowStartModal(true);
                setStartError('');
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>بدء جلسة جرد جديدة وتجميد المخزن</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>طباعة المحضر الرسمي A4</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 no-print">
        <button
          type="button"
          onClick={() => {
            setActiveTab('sessions');
            setActiveSessionId(null);
          }}
          className={`py-3 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>جلسات الجرد الدوري للمخازن ({sessionsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('closing');
            setActiveSessionId(null);
          }}
          className={`py-3 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'closing'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>دورة الإقفال السنوي والتجميد</span>
        </button>
      </div>

      {/* =================== TAB 1: INVENTORY SESSIONS =================== */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {/* Active Session Detail Workspace (If user clicked on a session) */}
          {activeSessionId && activeSessionData ? (
            <div className="space-y-4">
              {/* Back to list bar */}
              <div className="flex items-center justify-between no-print">
                <button
                  type="button"
                  onClick={() => setActiveSessionId(null)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>العودة لقائمة جلسات الجرد</span>
                </button>

                <div className="flex items-center gap-2">
                  {activeSessionData.status === 'in_progress' && (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveDraftCounts}
                        disabled={isSavingDraft}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isSavingDraft ? 'جارٍ الحفظ...' : 'حفظ مسودة العد'}</span>
                      </button>

                      {(isSupervisor || isAdmin) && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCompleteModal(true);
                              setCompleteError('');
                            }}
                            className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>اعتماد المحضر وتطبيق التسويات وفك التجميد</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowCancelModal(true);
                              setCancelError('');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-semibold cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>إلغاء الجلسة وفك التجميد</span>
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Toast for draft save */}
              {saveSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{saveSuccessMsg}</span>
                  </div>
                </div>
              )}

              {/* Session Overview Card */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        activeSessionData.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : activeSessionData.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {activeSessionData.status === 'in_progress' ? (
                        <Lock className="w-5 h-5 text-amber-600" />
                      ) : activeSessionData.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          محضر جرد #{activeSessionData.id} • مخزن: {activeSessionData.warehouse_name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            activeSessionData.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : activeSessionData.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {activeSessionData.status === 'in_progress'
                            ? 'جلسة جارية (المخزن مجمد 🔒)'
                            : activeSessionData.status === 'completed'
                            ? 'معتمد ومسوى (فك التجميد 🔓)'
                            : 'جلسة ملغاة (فك التجميد 🔓)'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        العهدة: {activeSessionData.custody_name} ({activeSessionData.custody_code}) • البدء:{' '}
                        {new Date(activeSessionData.started_at).toLocaleString('ar-EG')} بواسطة{' '}
                        {activeSessionData.starter_name}
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block">إجمالي الأصناف</span>
                      <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                        {countedRows.length}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-center border border-emerald-200 dark:border-emerald-800">
                      <span className="text-[10px] text-emerald-600 block">مطابق</span>
                      <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300">
                        {matchedCount}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-center border border-sky-200 dark:border-sky-800">
                      <span className="text-[10px] text-sky-600 block">زيادة (+)</span>
                      <span className="font-bold font-mono text-sky-700 dark:text-sky-300">
                        {surplusCount}
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-center border border-rose-200 dark:border-rose-800">
                      <span className="text-[10px] text-rose-600 block">عجز (-)</span>
                      <span className="font-bold font-mono text-rose-700 dark:text-rose-300">
                        {deficitCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Helpers */}
                {activeSessionData.status === 'in_progress' && (
                  <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 no-print">
                    <span className="text-slate-500 text-[11px]">
                      * أدخل أرقام العد الفعلي؛ يحسب النظام الفارق تلقائياً (العد الفعلي - الرصيد الدفتري).
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleMatchAllToBook}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer text-[11px]"
                      >
                        مطابقة الكل بالرصيد الدفتري
                      </button>
                      <button
                        type="button"
                        onClick={handleZeroAll}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer text-[11px]"
                      >
                        تصفير الكل
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Counted Items Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">كود الصنف</th>
                        <th className="py-2.5 px-3">اسم الصنف والتصنيف</th>
                        <th className="py-2.5 px-3">الوحدة</th>
                        <th className="py-2.5 px-3 text-center">الرصيد الدفتري</th>
                        <th className="py-2.5 px-3 text-center">العد الفعلي الفعلي</th>
                        <th className="py-2.5 px-3 text-center">الفارق (زيادة / عجز)</th>
                        <th className="py-2.5 px-3">حالة التطابق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {countedRows.map((r) => {
                        const isSurplus = r.difference > 0;
                        const isDeficit = r.difference < 0;

                        return (
                          <tr
                            key={r.id}
                            className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                              isDeficit
                                ? 'bg-rose-50/30 dark:bg-rose-950/20'
                                : isSurplus
                                ? 'bg-sky-50/30 dark:bg-sky-950/20'
                                : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                              {r.item_code}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className="font-semibold text-slate-900 dark:text-white block">
                                {r.item_name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {r.category_name}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-500">
                              {r.unit_name} ({r.unit_symbol})
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                              {r.book_quantity}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {activeSessionData.status === 'in_progress' ? (
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={r.actual_quantity}
                                  onChange={(e) => handleCountChange(r.id, e.target.value)}
                                  className="w-24 px-2 py-1 text-center font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                />
                              ) : (
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {r.actual_quantity}
                                </span>
                              )}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-center font-bold text-sm ${
                                isSurplus
                                  ? 'text-sky-600 dark:text-sky-400'
                                  : isDeficit
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {r.difference === 0 ? '0' : r.difference > 0 ? `+${r.difference}` : r.difference}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              {r.difference === 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  مطابق
                                </span>
                              ) : isSurplus ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                  زيادة جردية
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                  عجز جردي
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Sessions List Grid */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-semibold">إجمالي جلسات الجرد</span>
                    <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                      {sessionsList.length}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-amber-500 block font-semibold">جلسات جارية (مخازن مجمدة 🔒)</span>
                    <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                      {sessionsList.filter((s) => s.status === 'in_progress').length}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                    <Lock className="w-5 h-5" />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-emerald-500 block font-semibold">محاضر معتمدة ومسواة ✅</span>
                    <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {sessionsList.filter((s) => s.status === 'completed').length}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Sessions Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                {sessionsList.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 flex items-center justify-center mx-auto">
                      <Layers className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      لا توجد أي جلسات جرد مسجلة بعد
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      يمكن لرئيس القسم أو الأدمن بدء جلسة جرد دورية على أي مخزن، وسيقوم النظام فوراً بتجميد المخزن تلقائياً لمنع أي حركات عليه لحين اعتماد التسويات أو الإلغاء.
                    </p>
                    {(isSupervisor || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => setShowStartModal(true)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        بدء أول جلسة جرد الآن
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-3">رقم الجلسة</th>
                          <th className="py-3 px-3">العهدة</th>
                          <th className="py-3 px-3">المخزن الخاضع للجرد</th>
                          <th className="py-3 px-3">بدأت بواسطة</th>
                          <th className="py-3 px-3">تاريخ البدء</th>
                          <th className="py-3 px-3">الحالة</th>
                          <th className="py-3 px-3 text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sessionsList.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              #{s.id}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                              {s.custody_name}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {s.warehouse_name}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {s.is_main ? 'المخزن الرئيسي' : 'مخزن فرعي'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                              {s.starter_name}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                              {new Date(s.started_at).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  s.status === 'in_progress'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : s.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}
                              >
                                {s.status === 'in_progress'
                                  ? 'جارية 🔒 مجمد'
                                  : s.status === 'completed'
                                  ? 'معتمدة ومسواة ✅'
                                  : 'ملغاة ❌'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setActiveSessionId(s.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{s.status === 'in_progress' ? 'متابعة العد والاعتماد' : 'استعراض المحضر'}</span>
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
        </div>
      )}

      {/* =================== TAB 2: ANNUAL FISCAL CLOSING =================== */}
      {activeTab === 'closing' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-6 rounded-2xl bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold">
                دورة الإقفال السنوي والتجميد الكمي (السنة المالية {closingStatus?.currentFiscalYear || '—'})
              </h2>
            </div>
            <p className="text-xs text-indigo-200/80 leading-relaxed max-w-3xl">
              وفقاً للمواصفات الفنية المعتمدة لنظام إدارة العهد، تبدأ السنة المالية في 1 يوليو وتنتهي في 30 يونيو.
              النظام كمي بحت؛ الإقفال السنوي يجمد الأرصدة الدفترية والكميات دون أي تقييمات مالية أو أسعار، وينقل الأرصدة الختامية لتصبح افتتاحية للسنة الجديدة مع إصدار محضر رسمي للتوقيع الثلاثي.
            </p>
          </div>

          {closingSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{closingSuccess}</span>
            </div>
          )}

          {/* 4 Closing Conditions Status */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>مصفوفة شروط الإقفال السنوي الإلزامية الأربعة:</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Condition 1 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    1. حسم وإقفال كافة طلبات الخصم المعلقة
                  </span>
                  {closingStatus?.conditions?.hasNoPendingMovements ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>مستوفى (0 معلق)</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span>غير مستوفى ({closingStatus?.conditions?.pendingMovementsCount} معلق)</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  يجب اعتماد أو رفض جميع طلبات الخصم المعلقة وفك حجوزات الأرصدة بالكامل.
                </p>
              </div>

              {/* Condition 2 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    2. إنهاء واعتماد كافة جلسات الجرد المفتوحة
                  </span>
                  {closingStatus?.conditions?.hasNoOpenSessions ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>مستوفى (0 مفتوح)</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span>غير مستوفى ({closingStatus?.conditions?.openSessionsCount} جلسة جارية)</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  يجب اعتماد أو إلغاء أي جلسة جرد نشطة وفك تجميد جميع المخازن قبل الإقفال.
                </p>
              </div>

              {/* Condition 3 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    3. تجميد السنة المالية وأخذ اللقطة الكمية
                  </span>
                  {closingStatus?.conditions?.isAlreadyClosed ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                      <Lock className="w-4 h-4" />
                      <span>تم الإقفال مسبقاً</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-sky-600">
                      <Unlock className="w-4 h-4" />
                      <span>جاهز للتجميد</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  يتم حفظ لقطة (Snapshot) مجمدة لكافة أرصدة المخازن والعهد ونقلها كافتتاحية.
                </p>
              </div>

              {/* Condition 4 */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    4. طباعة محضر الإقفال للتوقيع الثلاثي
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    <Printer className="w-4 h-4 text-slate-500" />
                    <span>متاح للطباعة A4</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  يتضمن توقيعات أمين العهدة، ورئيس القسم، ومسؤول النظام المعتمدين.
                </p>
              </div>
            </div>

            {/* Execute Form (Admin only) */}
            {isAdmin && !closingStatus?.conditions?.isAlreadyClosed && (
              <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-4">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>تأكيد تنفيذ الإقفال السنوي للسنة المالية {closingStatus?.currentFiscalYear}:</span>
                </div>

                {closingError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold">
                    {closingError}
                  </div>
                )}

                <form onSubmit={handleExecuteClosing} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        أدخل كلمة مرور مسؤول النظام للتأكيد:
                      </label>
                      <input
                        type="password"
                        required
                        value={adminPasswordForClosing}
                        onChange={(e) => setAdminPasswordForClosing(e.target.value)}
                        placeholder="كلمة مرور الأدمن"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        ملاحظات محضر الإقفال:
                      </label>
                      <input
                        type="text"
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        placeholder="مثال: تم الإقفال السنوي بعد مطابقة كافة العهد"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!closingStatus?.isEligible || isClosing}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                      closingStatus?.isEligible && !isClosing
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isClosing ? 'جارٍ تنفيذ الإقفال والتجميد...' : 'تنفيذ الإقفال السنوي الرسمي'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Past Closings Archive */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>أرشيف محاضر الإقفال السنوية المقفلة ({closingStatus?.history?.length || 0}):</span>
            </h3>

            {(!closingStatus?.history || closingStatus.history.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                لا توجد سنوات مقفلة مسبقاً بعد.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">السنة المالية</th>
                      <th className="py-2.5 px-3">تاريخ الإقفال</th>
                      <th className="py-2.5 px-3">عدد الأصناف المجمدة</th>
                      <th className="py-2.5 px-3">إجمالي الكميات الدفترية</th>
                      <th className="py-2.5 px-3">الحالة</th>
                      <th className="py-2.5 px-3 text-center">المحضر الورقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {closingStatus.history.map((h: any) => (
                      <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400 font-sans">
                          السنة المالية {h.fiscalYear}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-sans text-[11px]">
                          {new Date(h.closedAt).toLocaleString('ar-EG')}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                          {h.totalItemsCount} صنف
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                          {(h.totalQuantityMilli / 1000).toFixed(3)}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            مقفل ومجمد
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>طباعة المحضر</span>
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

      {/* Modal: Start New Session */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                بدء جلسة جرد دورية جديدة وتجميد المخزن
              </h3>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>تنبيه تجميد المخزن التلقائي:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                وفقاً للمواصفات الفنية، سيتم فوراً تجميد المخزن المختار ومنع أي حركات إضافة أو صرف أو تحويل عليه حتى اعتماد محضر التسويات أو إلغاء الجلسة.
              </p>
            </div>

            {startError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {startError}
              </div>
            )}

            <form onSubmit={handleStartSessionSubmit} className="space-y-4 text-xs">
              {isAdmin && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    العهدة المحاسبية:
                  </label>
                  <select
                    required
                    value={selectedCustodyId}
                    onChange={(e) => {
                      setSelectedCustodyId(e.target.value);
                      setSelectedWarehouseId('');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">اختر العهدة</option>
                    {custodiesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  المخزن المراد جرده وتجميده:
                </label>
                <select
                  required
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">اختر المخزن</option>
                  {availableWarehouses.map((w: any) => (
                    <option key={w.id} value={w.id} disabled={w.status === 'frozen'}>
                      {w.name} {w.is_main ? '(المخزن الرئيسي)' : '(مخزن فرعي)'} {w.status === 'frozen' ? '🔒 مجمد حالياً' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  ملاحظات أو مبررات الجلسة:
                </label>
                <textarea
                  rows={2}
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="مثال: جرد دوري ربع سنوي..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isStarting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isStarting ? 'جارٍ التجميد والبدء...' : 'تأكيد بدء الجرد وتجميد المخزن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Complete / Approve Session */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-emerald-100 dark:border-emerald-950 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold">
                اعتماد محضر الجرد وتطبيق التسويات المخزنية
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              وفقاً لقواعد المرحلة 5، يقوم هذا الإجراء بتوليد حركات تسوية مخزنية آلية (بأرقام TRX موحدة) لكافة الأصناف التي بها فارق لتطابق الأرصدة الدفترية مع العد الفعلي، وفك تجميد المخزن وإعادته للحالة النشطة.
            </p>

            {completeError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {completeError}
              </div>
            )}

            <form onSubmit={handleCompleteSession} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  ملاحظات قرار الاعتماد:
                </label>
                <textarea
                  rows={2}
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  placeholder="بيان توصيات محضر الجرد..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCompleting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isCompleting ? 'جارٍ الاعتماد والتسوية...' : 'تأكيد الاعتماد وفك التجميد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cancel Session */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-rose-100 dark:border-rose-950 text-rose-600">
              <XCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold">
                إلغاء جلسة الجرد وفك تجميد المخزن
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              سيتم فك تجميد المخزن فوراً دون أي مساس بالأرصدة الدفترية أو إنشاء أي حركات تسوية.
            </p>

            {cancelError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {cancelError}
              </div>
            )}

            <form onSubmit={handleCancelSession} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  سبب الإلغاء كتابياً (إلزامي):
                </label>
                <textarea
                  rows={2}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="بيان سبب إلغاء محضر الجرد..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isCancelling ? 'جارٍ الإلغاء...' : 'تأكيد الإلغاء وفك التجميد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
