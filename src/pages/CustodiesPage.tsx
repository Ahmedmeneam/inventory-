import React, { useState, useEffect } from 'react';
import { Custody, Warehouse } from '../types/custody.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { FoundationalImportModal } from '../components/custody/FoundationalImportModal.tsx';
import {
  Building,
  PlusCircle,
  Warehouse as WarehouseIcon,
  Users,
  FileSpreadsheet,
  Archive,
  CheckCircle2,
  Lock,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export const CustodiesPage: React.FC = () => {
  const { user } = useAuth();
  const [custodiesList, setCustodiesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal: Create New Custody
  const [showCreateCustody, setShowCreateCustody] = useState(false);
  const [custodyCode, setCustodyCode] = useState('');
  const [custodyName, setCustodyName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal: Add Sub Warehouse
  const [selectedCustodyForWarehouse, setSelectedCustodyForWarehouse] = useState<any | null>(null);
  const [subWarehouseName, setSubWarehouseName] = useState('');
  const [warehouseError, setWarehouseError] = useState('');
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);

  // Modal: Add General Warehouse
  const [showGeneralWarehouseModal, setShowGeneralWarehouseModal] = useState(false);
  const [generalWarehouseName, setGeneralWarehouseName] = useState('');
  const [generalWarehouseError, setGeneralWarehouseError] = useState('');
  const [isAddingGeneral, setIsAddingGeneral] = useState(false);

  // Modal: Archive Custody
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null);
  const [archiveAdminPassword, setArchiveAdminPassword] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);

  // Modal: Foundational Import
  const [importTarget, setImportTarget] = useState<Custody | null>(null);

  const fetchCustodies = async () => {
    try {
      const res = await fetch('/api/custodies');
      if (res.ok) {
        const data = await res.json();
        setCustodiesList(data.custodies || []);
      }
    } catch (err) {
      console.error('Error fetching custodies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustodies();
  }, []);

  const handleCreateCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custodyCode.trim() || !custodyName.trim()) return;

    setCreateError('');
    setIsCreating(true);

    try {
      const res = await fetch('/api/custodies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: custodyCode.trim().toUpperCase(),
          name: custodyName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إنشاء العهدة');
      }

      setShowCreateCustody(false);
      setCustodyCode('');
      setCustodyName('');
      fetchCustodies();
    } catch (err: any) {
      setCreateError(err.message || 'حدث خطأ');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddSubWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustodyForWarehouse || !subWarehouseName.trim()) return;

    setWarehouseError('');
    setIsAddingWarehouse(true);

    try {
      const res = await fetch(`/api/custodies/${selectedCustodyForWarehouse.id}/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: subWarehouseName.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إضافة المخزن الفرعي');
      }

      setSelectedCustodyForWarehouse(null);
      setSubWarehouseName('');
      fetchCustodies();
    } catch (err: any) {
      setWarehouseError(err.message || 'حدث خطأ');
    } finally {
      setIsAddingWarehouse(false);
    }
  };

  const handleAddGeneralWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalWarehouseName.trim()) return;

    setGeneralWarehouseError('');
    setIsAddingGeneral(true);

    try {
      const res = await fetch('/api/custodies/general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: generalWarehouseName.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إنشاء المخزن العام');
      }

      setShowGeneralWarehouseModal(false);
      setGeneralWarehouseName('');
      fetchCustodies();
    } catch (err: any) {
      setGeneralWarehouseError(err.message || 'حدث خطأ');
    } finally {
      setIsAddingGeneral(false);
    }
  };

  const handleArchiveCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveTarget || !archiveAdminPassword) return;

    setArchiveError('');
    setIsArchiving(true);

    try {
      const res = await fetch(`/api/custodies/${archiveTarget.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: archiveAdminPassword,
          adminUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشلت أرشفة العهدة');
      }

      setArchiveTarget(null);
      setArchiveAdminPassword('');
      fetchCustodies();
    } catch (err: any) {
      setArchiveError(err.message || 'حدث خطأ');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-600" />
            <span>إدارة العهد والمخازن</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إنشاء العهد المحاسبية، وتأسيس المخازن الرئيسية والفرعية، وإجراءات الاستيراد التأسيسي
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowGeneralWarehouseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <WarehouseIcon className="w-4 h-4" />
            <span>إضافة مخزن عام للشركة</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateCustody(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إنشاء عهدة جديدة</span>
          </button>
        </div>
      </div>

      {/* Custodies List */}
      {custodiesList.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Building className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              لا توجد أي عهد محاسبية مسجلة بعد (حالة نظيفة فارغة 100%)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              تطبيقاً لبروتوكول البدء النظيف، ابدأ بإنشاء أول عهدة وسيقوم النظام تلقائياً بتأسيس قسمها الرقابي ومخزنها الرئيسي الحصري لاستقبال الوارد.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateCustody(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إنشاء أول عهدة الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {custodiesList.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header with Code and Status */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs font-mono">
                      {c.code}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {c.name}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono">
                        رمز العهدة: {c.code}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {c.status === 'active' ? 'نشطة' : 'مؤرشفة'}
                  </span>
                </div>

                {/* Main Warehouse Information */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <WarehouseIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      <span>{c.main_warehouse_name || 'المخزن الرئيسي للعهدة'}</span>
                    </span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-800">
                      المخزن الرئيسي الإلزامي
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    * الحركات الواردة الخارجية تُسجل حصرياً في هذا المخزن وتوزع بالتحويل الداخلي.
                  </p>
                </div>

                {/* Warehouses list */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    <span>مخازن العهدة ({c.warehouses?.length || 0}):</span>
                    {c.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustodyForWarehouse(c);
                          setSubWarehouseName('');
                          setWarehouseError('');
                        }}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                      >
                        + إضافة مخزن فرعي
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {c.warehouses?.map((w: Warehouse) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/40 text-[11px]"
                      >
                        <span className="text-slate-800 dark:text-slate-200">{w.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {w.is_main ? 'رئيسي' : 'فرعي'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Staff Info */}
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>الموظفون المسكنون: <strong>{c.users_count || 0}</strong></span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {c.isInitialImportLocked ? '🔒 الاستيراد التأسيسي مقفل' : '🔓 متاح للاستيراد التأسيسي'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setImportTarget(c)}
                  disabled={c.isInitialImportLocked}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    c.isInitialImportLocked
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-100'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{c.isInitialImportLocked ? 'التأسيس مقفل' : 'استيراد Excel تأسيسي'}</span>
                </button>

                {c.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => {
                      setArchiveTarget(c);
                      setArchiveAdminPassword('');
                      setArchiveError('');
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="أرشفة وإغلاق العهدة (يشترط تصفير الرصيد)"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Custody */}
      {showCreateCustody && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Building className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إنشاء عهدة محاسبية جديدة
              </h3>
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCustody} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم العهدة باللغة العربية *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عهدة النجارة والأخشاب"
                  value={custodyName}
                  onChange={(e) => setCustodyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  رمز العهدة الإنجليزي (2-8 أحرف فريدة) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: WOOD أو ELEC أو MECH"
                  value={custodyCode}
                  onChange={(e) => setCustodyCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono dir-ltr text-left"
                />
              </div>

              <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/50 text-[11px] text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 inline ml-1" />
                <strong>تأسيس تلقائي:</strong> سيقوم النظام تلقائياً بإنشاء القسم الرقابي للعهدة ومخزنها الرئيسي الحصري لورود البضائع (`is_main = true`).
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isCreating ? 'جارٍ الإنشاء...' : 'حفظ وتأسيس العهدة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateCustody(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Sub Warehouse */}
      {selectedCustodyForWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <WarehouseIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إضافة مخزن فرعي لعهدة: {selectedCustodyForWarehouse.name}
              </h3>
            </div>

            {warehouseError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {warehouseError}
              </div>
            )}

            <form onSubmit={handleAddSubWarehouse} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المخزن الفرعي *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مخزن صالة التشغيل 2"
                  value={subWarehouseName}
                  onChange={(e) => setSubWarehouseName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isAddingWarehouse}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isAddingWarehouse ? 'جارٍ الإضافة...' : 'إضافة المخزن الفرعي'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustodyForWarehouse(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add General Warehouse */}
      {showGeneralWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <WarehouseIcon className="w-5 h-5 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إضافة مخزن عام تابع للشركة
              </h3>
            </div>

            {generalWarehouseError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {generalWarehouseError}
              </div>
            )}

            <form onSubmit={handleAddGeneralWarehouse} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المخزن العام *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: المخزن المركزي العام - المنطقة الصناعية"
                  value={generalWarehouseName}
                  onChange={(e) => setGeneralWarehouseName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isAddingGeneral}
                  className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isAddingGeneral ? 'جارٍ الحفظ...' : 'إنشاء المخزن العام'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGeneralWarehouseModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Archive Custody */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Archive className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                تأكيد أرشفة وإغلاق العهدة: {archiveTarget.name}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              * يشترط النظام تصفير جميع الأرصدة وحسم كافة الطلبات المعلقة قبل الأرشفة. تتطلب هذه العملية إدخال كلمة مرور مسؤول النظام للتأكيد الأمني.
            </p>

            {archiveError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {archiveError}
              </div>
            )}

            <form onSubmit={handleArchiveCustody} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة مرور مسؤول النظام *
                </label>
                <input
                  type="password"
                  required
                  placeholder="كلمة مرور الأدمن"
                  value={archiveAdminPassword}
                  onChange={(e) => setArchiveAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isArchiving}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isArchiving ? 'جارٍ التحقق والأرشفة...' : 'تأكيد أرشفة العهدة'}
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Foundational Excel Import Modal */}
      {importTarget && (
        <FoundationalImportModal
          custody={importTarget}
          onClose={() => setImportTarget(null)}
          onSuccess={() => {
            setImportTarget(null);
            fetchCustodies();
          }}
        />
      )}
    </div>
  );
};
