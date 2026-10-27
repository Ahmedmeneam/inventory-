import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Search,
  Filter,
  RotateCcw,
  Printer,
  Download,
  Building,
  Warehouse,
  Boxes,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  Calendar,
  Layers,
  ChevronLeft,
  X,
  FileText,
} from 'lucide-react';

export const GeneralLedgerPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const userCustodyId = user?.custody_id;

  const [activeTab, setActiveTab] = useState<'ledger' | 'statement'>('ledger');

  // Ledger state
  const [movementsList, setMovementsList] = useState<any[]>([]);
  const [custodiesList, setCustodiesList] = useState<any[]>([]);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustody, setSelectedCustody] = useState<string>(
    !isAdmin && userCustodyId ? String(userCustodyId) : 'all'
  );
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Item Statement state
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [itemStatementData, setItemStatementData] = useState<any | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  // Reversal Modal
  const [reversalTarget, setReversalTarget] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalError, setReversalError] = useState('');
  const [isReversing, setIsReversing] = useState(false);
  const [reversalSuccess, setReversalSuccess] = useState<string | null>(null);

  // Fetch initial ledger and master data
  const fetchLedgerData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCustody && selectedCustody !== 'all') params.append('custodyId', selectedCustody);
      if (selectedType && selectedType !== 'all') params.append('movementType', selectedType);
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (searchQuery) params.append('search', searchQuery);

      const [ledgerRes, custRes, itemsRes] = await Promise.all([
        fetch(`/api/ledger?${params.toString()}`),
        fetch('/api/custodies'),
        fetch('/api/items'),
      ]);

      if (ledgerRes.ok) {
        const lData = await ledgerRes.json();
        setMovementsList(lData.movements || []);
      }
      if (custRes.ok) {
        const cData = await custRes.json();
        setCustodiesList(cData.custodies || []);
      }
      if (itemsRes.ok) {
        const iData = await itemsRes.json();
        setItemsList(iData.items || []);
        if (!selectedItemId && iData.items && iData.items.length > 0) {
          setSelectedItemId(String(iData.items[0].id));
        }
      }
    } catch (err) {
      console.error('Error fetching ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgerData();
  }, [selectedCustody, selectedType, selectedStatus, fromDate, toDate]);

  // Fetch item statement when selected item changes
  const fetchItemStatement = async (id: string) => {
    if (!id) return;
    try {
      setLoadingStatement(true);
      const custParam = !isAdmin && userCustodyId ? `?custodyId=${userCustodyId}` : '';
      const res = await fetch(`/api/ledger/item-statement/${id}${custParam}`);
      if (res.ok) {
        const data = await res.json();
        setItemStatementData(data);
      }
    } catch (err) {
      console.error('Error fetching item statement:', err);
    } finally {
      setLoadingStatement(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'statement' && selectedItemId) {
      fetchItemStatement(selectedItemId);
    }
  }, [activeTab, selectedItemId]);

  // Handle Search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLedgerData();
  };

  // Handle Movement Reversal
  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget || !reversalReason.trim()) return;

    setIsReversing(true);
    setReversalError('');

    try {
      const res = await fetch(`/api/movements/${reversalTarget.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reversalReason.trim(),
          userId: user?.id,
          userRole: user?.role,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إجراء الحركة العكسية');
      }

      setReversalSuccess(
        `تم عكس الحركة بنجاح وإصدار القيد العكسي برقم ${data.reversal?.trxNumber || 'جديد'}`
      );
      setReversalTarget(null);
      setReversalReason('');
      fetchLedgerData();
      if (selectedItemId) fetchItemStatement(selectedItemId);
    } catch (err: any) {
      setReversalError(err.message || 'حدث خطأ أثناء عكس الحركة');
    } finally {
      setIsReversing(false);
    }
  };

  // Export 3-Sheet Excel Workbook
  const handleExport3SheetExcel = async () => {
    try {
      // 1. Fetch all movements for Sheet 1
      const mRes = await fetch('/api/ledger');
      const mData = await mRes.json();
      const sheet1Data = (mData.movements || []).map((m: any, idx: number) => ({
        'م': idx + 1,
        'رقم الحركة (TRX)': m.trx_number,
        'التاريخ': new Date(m.created_at).toLocaleString('ar-EG'),
        'العهدة': m.custody_name,
        'رمز العهدة': m.custody_code,
        'نوع العملية':
          m.movement_type === 'addition'
            ? 'إضافة (وارد خارجي)'
            : m.movement_type === 'issue'
            ? 'خصم (صرف)'
            : m.movement_type === 'internal_transfer'
            ? 'تحويل داخلي'
            : m.movement_type === 'disposal'
            ? 'خروج نهائي (إتلاف)'
            : m.movement_type === 'reversal'
            ? 'حركة عكسية'
            : 'تسوية جرد',
        'الحالة':
          m.status === 'executed' || m.status === 'executed_delegated' || m.status === 'approved'
            ? 'معتمدة / منفذة'
            : m.status === 'reversed'
            ? 'معكوسة'
            : m.status === 'pending_approval'
            ? 'معلقة'
            : 'مرفوضة',
        'كود الصنف': m.item_code,
        'اسم الصنف': m.item_name,
        'التصنيف': m.category_name,
        'الكمية': m.quantity,
        'وحدة القياس': m.unit_name,
        'المخزن المصدر': m.source_warehouse_name,
        'المخزن الهدف': m.target_warehouse_name,
        'المنفذ': m.creator_name,
        'المعتمد': m.approver_name,
        'الحركة المعكوسة': m.reversal_of_trx || '—',
        'ملاحظات / سبب العكس': m.notes || m.rejection_reason || '—',
      }));

      // 2. Fetch all central items and balances for Sheet 2
      const iRes = await fetch('/api/items');
      const iData = await iRes.json();
      const sheet2Data = (iData.items || []).map((it: any, idx: number) => ({
        'م': idx + 1,
        'كود الصنف': it.item_code,
        'اسم الصنف': it.name,
        'التصنيف': it.category_name,
        'وحدة القياس': it.unit_name,
        'حد الأمان': it.min_limit,
      }));

      // 3. Fetch all stock balances for Sheet 3
      const sheet3Rows: any[] = [];
      const orgRes = await fetch('/api/custodies/organization');
      const orgData = await orgRes.json();
      const custodies = orgData.custodies || [];

      let rowIdx = 1;
      for (const c of custodies) {
        for (const w of c.warehouses || []) {
          sheet3Rows.push({
            'م': rowIdx++,
            'العهدة': c.name,
            'رمز العهدة': c.code,
            'المخزن': w.name,
            'نوع المخزن': w.is_main ? 'رئيسي (تلقائي)' : 'فرعي',
            'الحالة': w.status === 'active' ? 'نشط' : 'غير نشط',
          });
        }
      }

      // Create workbook and append sheets
      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
      XLSX.utils.book_append_sheet(wb, ws1, 'السجل العام للحركات');

      const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
      XLSX.utils.book_append_sheet(wb, ws2, 'أرصدة أصناف الشركة');

      const ws3 = XLSX.utils.json_to_sheet(sheet3Rows);
      XLSX.utils.book_append_sheet(wb, ws3, 'التوزيع المخزني للأرصدة');

      // Export file
      const fileName = `كشف_العمليات_الشامل_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('Error generating Excel export:', err);
      alert('حدث خطأ أثناء تصدير ملف الإكسل');
    }
  };

  // Helper badge for movement status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'executed':
      case 'approved':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
            معتمدة
          </span>
        );
      case 'executed_delegated':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300">
            خصم مفوض فورياً
          </span>
        );
      case 'reversed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
            حركة معكوسة
          </span>
        );
      case 'pending_approval':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
            معلقة بانتظار الاعتماد
          </span>
        );
      case 'rejected':
      case 'cancelled':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            مرفوضة / ملغاة
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  // Helper badge for movement type
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'addition':
        return (
          <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>إضافة وارد</span>
          </span>
        );
      case 'issue':
        return (
          <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>خصم</span>
          </span>
        );
      case 'internal_transfer':
        return (
          <span className="flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>تحويل داخلي</span>
          </span>
        );
      case 'disposal':
        return (
          <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>خروج نهائي</span>
          </span>
        );
      case 'reversal':
        return (
          <span className="flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>حركة عكسية</span>
          </span>
        );
      case 'adjustment':
        return (
          <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>تسوية جرد</span>
          </span>
        );
      default:
        return <span>{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <span>السجل العام للعمليات وكشوف الحساب (المرحلة 4)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            سجل العمليات التراكمي غير القابل للتعديل، وكشف حساب صنف الشركة وتوزيعه المخزني، والحركات العكسية
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap no-print">
          <button
            type="button"
            onClick={handleExport3SheetExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير كشف Excel الشامل (3 أوراق عمل)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>طباعة المستند الرسمي (A4)</span>
          </button>
        </div>
      </div>

      {/* Reversal Notification Toast */}
      {reversalSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reversalSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setReversalSuccess(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 no-print">
        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`py-3 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'ledger'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>السجل العام للعمليات (Append-Only Ledger)</span>
          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {movementsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('statement')}
          className={`py-3 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'statement'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>كشف حساب الصنف والتوزيع المخزني</span>
        </button>
      </div>

      {/* TAB 1: General Append-Only Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 no-print">
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Search text */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث برقم الحركة (TRX)، اسم الصنف، الكود، اسم العهدة، المنفذ..."
                  className="w-full pr-9 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Custody Filter (Admin) */}
              {isAdmin && (
                <div className="min-w-[160px]">
                  <select
                    value={selectedCustody}
                    onChange={(e) => setSelectedCustody(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="all">كافة العهد المحاسبية</option>
                    {custodiesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Movement Type Filter */}
              <div className="min-w-[140px]">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="all">كافة أنواع العمليات</option>
                  <option value="addition">إضافة (وارد خارجي)</option>
                  <option value="issue">خصم</option>
                  <option value="internal_transfer">تحويل داخلي</option>
                  <option value="disposal">خروج نهائي</option>
                  <option value="reversal">حركة عكسية</option>
                  <option value="adjustment">تسوية جرد</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="min-w-[130px]">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="executed">معتمدة / منفذة</option>
                  <option value="executed_delegated">خصم مفوض</option>
                  <option value="reversed">معكوسة</option>
                  <option value="pending_approval">معلقة</option>
                  <option value="rejected">مرفوضة</option>
                </select>
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  title="من تاريخ"
                />
                <span className="text-slate-400">إلى</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  title="إلى تاريخ"
                />
              </div>

              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
              >
                تطبيق
              </button>
            </form>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            {movementsList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <FileSpreadsheet className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  لا توجد حركات مسجلة مطابقة للبحث أو الفلتر
                </h4>
                <p className="text-xs">
                  السجل العام يسجل كافة الحركات التشغيلية الحقيقية بشكل تراكمي غير قابل للتعديل.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-3">رقم الحركة (TRX)</th>
                      <th className="py-3 px-3">التاريخ والوقت</th>
                      <th className="py-3 px-3">العهدة</th>
                      <th className="py-3 px-3">نوع الحركة</th>
                      <th className="py-3 px-3">الصنف</th>
                      <th className="py-3 px-3 text-center">الكمية</th>
                      <th className="py-3 px-3">المخزن المصدر / الهدف</th>
                      <th className="py-3 px-3">المنفذ / المعتمد</th>
                      <th className="py-3 px-3">الحالة</th>
                      {(isSupervisor || isAdmin) && (
                        <th className="py-3 px-3 text-center no-print">إجراءات</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {movementsList.map((m) => {
                      const canReverse =
                        (isSupervisor || isAdmin) &&
                        (m.status === 'executed' ||
                          m.status === 'executed_delegated' ||
                          m.status === 'approved') &&
                        m.movement_type !== 'reversal';

                      return (
                        <tr
                          key={m.id}
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                            m.status === 'reversed' ? 'opacity-70 bg-slate-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            <div>{m.trx_number}</div>
                            {m.reversal_of_trx && (
                              <div className="text-[10px] text-purple-600 font-mono">
                                قيد عكسي لـ: {m.reversal_of_trx}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                            {new Date(m.created_at).toLocaleString('ar-EG', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {m.custody_name}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {m.custody_code}
                            </span>
                          </td>
                          <td className="py-3 px-3">{getTypeBadge(m.movement_type)}</td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {m.item_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {m.item_code} • {m.category_name}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                            {m.quantity} {m.unit_symbol}
                          </td>
                          <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-400">
                            {m.movement_type === 'addition' && (
                              <span>إلى: {m.target_warehouse_name}</span>
                            )}
                            {m.movement_type === 'issue' && (
                              <span>من: {m.source_warehouse_name}</span>
                            )}
                            {m.movement_type === 'internal_transfer' && (
                              <div>
                                <div>من: {m.source_warehouse_name}</div>
                                <div>إلى: {m.target_warehouse_name}</div>
                              </div>
                            )}
                            {m.movement_type === 'disposal' && (
                              <span>من: {m.source_warehouse_name}</span>
                            )}
                            {m.movement_type === 'reversal' && (
                              <div>
                                {m.source_warehouse_name !== '-' && <div>من: {m.source_warehouse_name}</div>}
                                {m.target_warehouse_name !== '-' && <div>إلى: {m.target_warehouse_name}</div>}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[11px] text-slate-500">
                            <div>المنفذ: {m.creator_name}</div>
                            {m.approved_by && <div>المعتمد: {m.approver_name}</div>}
                          </td>
                          <td className="py-3 px-3">{getStatusBadge(m.status)}</td>

                          {(isSupervisor || isAdmin) && (
                            <td className="py-3 px-3 text-center no-print">
                              {canReverse ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReversalTarget(m);
                                    setReversalReason('');
                                    setReversalError('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-semibold text-[11px] transition-colors cursor-pointer"
                                  title="عكس هذه الحركة بقيد عكسي رسمي"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>عكس الحركة</span>
                                </button>
                              ) : m.status === 'reversed' ? (
                                <span className="text-[10px] text-slate-400">تم عكسها</span>
                              ) : (
                                <span className="text-[10px] text-slate-400">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Item Statement & Multi-Warehouse Breakdown */}
      {activeTab === 'statement' && (
        <div className="space-y-6">
          {/* Item Selector */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                اختر الصنف المطلوب:
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              >
                {itemsList.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.item_code} - {it.name} ({it.unit_name})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-400">
              * رصيد الشركة الكلي = رصيد المخزن الرئيسي + مجموع أرصدة المخازن الفرعية والعامة
            </span>
          </div>

          {loadingStatement ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              جارٍ تحميل كشف الحساب والتوزيع المخزني...
            </div>
          ) : !itemStatementData ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              اختر صنفاً لعرض كشف حسابه.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Item Card with Totals */}
              <div className="p-6 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-mono font-bold text-sm">
                      {itemStatementData.item.item_code}
                    </div>
                    <div>
                      <h3 className="text-base font-bold">
                        {itemStatementData.item.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        التصنيف: {itemStatementData.item.category_name} • وحدة القياس: {itemStatementData.item.unit_name} ({itemStatementData.item.unit_symbol})
                      </p>
                    </div>
                  </div>

                  {/* Summary Totals */}
                  <div className="grid grid-cols-3 gap-3 text-center sm:text-right">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-[11px] text-slate-400 block">رصيد الشركة الكلي</span>
                      <span className="text-lg font-bold font-mono text-white">
                        {itemStatementData.item.total_quantity}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-[11px] text-amber-300 block">المحجوز للطلبات</span>
                      <span className="text-lg font-bold font-mono text-amber-400">
                        {itemStatementData.item.total_reserved}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-[11px] text-emerald-300 block">الرصيد الحر المتاح</span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {itemStatementData.item.total_available}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warehouse Breakdown */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    التوزيع المخزني لأرصدة الصنف (أين تتواجد الكميات؟)
                  </h4>
                </div>

                {itemStatementData.warehouse_breakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">
                    لا توجد أرصدة مخزنية لهذا الصنف في أي مخزن حالياً.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">العهدة</th>
                          <th className="py-2.5 px-3">اسم المخزن</th>
                          <th className="py-2.5 px-3">صفة المخزن</th>
                          <th className="py-2.5 px-3 text-center">الرصيد الدفتري الفعلي</th>
                          <th className="py-2.5 px-3 text-center">المحجوز</th>
                          <th className="py-2.5 px-3 text-center">الرصيد الحر المتاح</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {itemStatementData.warehouse_breakdown.map((wb: any) => (
                          <tr key={wb.warehouse_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-800 dark:text-slate-200">
                              {wb.custody_name}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-900 dark:text-white font-bold">
                              {wb.warehouse_name}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-[11px] text-slate-500">
                              {wb.warehouse_type}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                              {wb.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-600 dark:text-amber-400">
                              {wb.reserved_qty}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                              {wb.available_qty}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Item Movements Statement (Running Balance) */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      كشف حركات الصنف التراكمي (مع الرصيد بعد كل حركة)
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {itemStatementData.statement_history.length} حركات مسجلة
                  </span>
                </div>

                {itemStatementData.statement_history.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    لم تسجل أي حركات تشغيلية على هذا الصنف حتى الآن.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">رقم الحركة (TRX)</th>
                          <th className="py-2.5 px-3">التاريخ</th>
                          <th className="py-2.5 px-3">نوع الحركة</th>
                          <th className="py-2.5 px-3">المخازن</th>
                          <th className="py-2.5 px-3 text-center">الوارد (+)</th>
                          <th className="py-2.5 px-3 text-center">المنصرف (-)</th>
                          <th className="py-2.5 px-3 text-center">الرصيد بعد الحركة</th>
                          <th className="py-2.5 px-3">المنفذ</th>
                          <th className="py-2.5 px-3">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {itemStatementData.statement_history.map((sh: any) => (
                          <tr
                            key={sh.id}
                            className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${
                              sh.status === 'reversed' ? 'opacity-60 bg-slate-50/40 line-through' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                              {sh.trx_number}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500 font-sans">
                              {new Date(sh.date).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              {getTypeBadge(sh.movement_type)}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-[11px] text-slate-600 dark:text-slate-400">
                              {sh.source_warehouse !== '-' && <span>من: {sh.source_warehouse} </span>}
                              {sh.target_warehouse !== '-' && <span>إلى: {sh.target_warehouse}</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                              {sh.impact_type === 'in' ? `+${sh.quantity}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-rose-600 dark:text-rose-400">
                              {sh.impact_type === 'out' ? `-${sh.quantity}` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/50">
                              {sh.running_balance}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-500 text-[11px]">
                              {sh.creator_name}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              {getStatusBadge(sh.status)}
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

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-rose-100 dark:border-rose-950/50 text-rose-600">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-sm font-bold">
                إجراء حركة عكسية للحركة [{reversalTarget.trx_number}]
              </h3>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">نوع الحركة الأصلية:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {reversalTarget.movement_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الصنف:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {reversalTarget.item_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الكمية:</span>
                <span className="font-bold font-mono text-indigo-600">
                  {reversalTarget.quantity} {reversalTarget.unit_symbol}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              وفقاً لقواعد النظام في المرحلة 4، تقوم الحركة العكسية بإلغاء الأثر الرياضي للحركة الأصلية بالكامل بشرط كفاية الرصيد الحر في المخزن، ويتم إصدار قيد عكسي جديد برقم مالي موحد ولا يمكن التراجع عن العكس.
            </p>

            {reversalError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs">
                {reversalError}
              </div>
            )}

            <form onSubmit={handleExecuteReversal} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  سبب الإلغاء والعكس كتابياً (إلزامي):
                </label>
                <textarea
                  rows={2}
                  required
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="بيان سبب إلغاء الحركة وعكسها..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReversalTarget(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isReversing}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isReversing ? 'جارٍ التحقق والعكس...' : 'تأكيد العكس وإصدار القيد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
