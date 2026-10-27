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
  GitFork,
  Network,
  LayoutGrid,
  Edit2,
  Check,
  Shield,
  Layers,
  Building2,
  ChevronDown,
  ChevronRight,
  Boxes,
} from 'lucide-react';

export const CustodiesPage: React.FC = () => {
  const { user } = useAuth();
  const [custodiesList, setCustodiesList] = useState<any[]>([]);
  const [generalWarehouses, setGeneralWarehouses] = useState<any[]>([]);
  const [companyInfo, setCompanyInfo] = useState<any>({ company_name: 'الشركة' });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'tree'>('cards');

  // Edit Company Name
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [isUpdatingCompany, setIsUpdatingCompany] = useState(false);

  // Modal: Create New Custody (Only requires Arabic name!)
  const [showCreateCustody, setShowCreateCustody] = useState(false);
  const [custodyName, setCustodyName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal: Add Sub Warehouse to Custody
  const [selectedCustodyForWarehouse, setSelectedCustodyForWarehouse] = useState<any | null>(null);
  const [subWarehouseName, setSubWarehouseName] = useState('');
  const [warehouseError, setWarehouseError] = useState('');
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);

  // Modal: Add General Warehouse to Company
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

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/custodies/organization');
      if (res.ok) {
        const data = await res.json();
        setCompanyInfo(data.company || { company_name: 'الشركة' });
        setGeneralWarehouses(data.general_warehouses || []);
        setCustodiesList(data.custodies || []);
      } else {
        // Fallback
        const cRes = await fetch('/api/custodies');
        if (cRes.ok) {
          const cData = await cRes.json();
          setCustodiesList(cData.custodies || []);
        }
      }
    } catch (err) {
      console.error('Error fetching organization structure:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setIsUpdatingCompany(true);
    try {
      const res = await fetch('/api/custodies/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: newCompanyName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCompanyInfo((prev: any) => ({ ...prev, company_name: data.companyName }));
        setShowEditCompany(false);
      }
    } catch (err) {
      console.error('Failed to update company name:', err);
    } finally {
      setIsUpdatingCompany(false);
    }
  };

  const handleCreateCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custodyName.trim()) return;

    setCreateError('');
    setIsCreating(true);

    try {
      const res = await fetch('/api/custodies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: custodyName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إنشاء العهدة');
      }

      setShowCreateCustody(false);
      setCustodyName('');
      fetchOrganizationData();
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
      fetchOrganizationData();
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
      fetchOrganizationData();
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
      fetchOrganizationData();
    } catch (err: any) {
      setArchiveError(err.message || 'حدث خطأ');
    } finally {
      setIsArchiving(false);
    }
  };

  const totalCustodiesWarehouses = custodiesList.reduce(
    (acc, c) => acc + (c.warehouses?.length || 0),
    0
  );
  const totalWarehousesCount = generalWarehouses.length + totalCustodiesWarehouses;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>الهيكل التنظيمي للشركة والعهد والمخازن</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            بناء الكيان المؤسسي، والمخازن العامة للشركة، والعهد المحاسبية ومخازنها التابعة
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>عرض البطاقات</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>الشجرة الهيكلية</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowGeneralWarehouseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <WarehouseIcon className="w-4 h-4 text-emerald-600" />
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

      {/* Organizational Header: Company Entity Card */}
      <div className="p-6 rounded-2xl bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-wide">
                  {companyInfo.company_name || 'اسم الشركة'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setNewCompanyName(companyInfo.company_name || '');
                    setShowEditCompany(true);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="تعديل اسم الشركة"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-indigo-200/70 mt-0.5">
                الكيان المؤسسي المالك للمخازن والعهد المحاسبية
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 text-center sm:text-right">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[11px] text-indigo-200/70 block">المخازن العامة</span>
              <span className="text-lg font-bold text-emerald-400">{generalWarehouses.length}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[11px] text-indigo-200/70 block">العهد المحاسبية</span>
              <span className="text-lg font-bold text-sky-400">{custodiesList.length}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[11px] text-indigo-200/70 block">إجمالي المخازن</span>
              <span className="text-lg font-bold text-indigo-300">{totalWarehousesCount}</span>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'tree' ? (
        /* =================== TREE HIERARCHICAL VIEW =================== */
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <GitFork className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                خريطة التدرج الهيكلي (شجرة الشركة والمخازن)
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              رسم تخطيطي حي للمخازن والعهد التابعة
            </span>
          </div>

          <div className="space-y-4 pr-2 font-mono text-xs">
            {/* Tree Root: Company */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>[الشركة]: {companyInfo.company_name}</span>
            </div>

            {/* Tree Branch: General Warehouses */}
            <div className="pr-6 space-y-2 border-r-2 border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-semibold">
                <span className="flex items-center gap-2">
                  <WarehouseIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>المخازن العامة للشركة المباشرة ({generalWarehouses.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowGeneralWarehouseModal(true)}
                  className="text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                >
                  + إضافة مخزن عام
                </button>
              </div>

              {generalWarehouses.length === 0 ? (
                <div className="pr-4 py-1.5 text-slate-400 text-[11px]">
                  └─ لا توجد مخازن عامة مضافة بعد.
                </div>
              ) : (
                generalWarehouses.map((gw) => (
                  <div
                    key={gw.id}
                    className="pr-4 py-1.5 flex items-center justify-between text-slate-700 dark:text-slate-300"
                  >
                    <span>└─ 🏢 {gw.name} (مخزن عام مستقل)</span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                      نشط
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Tree Branch: Custodies */}
            <div className="pr-6 space-y-4 border-r-2 border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-300 font-semibold">
                <span className="flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-sky-600" />
                  <span>العهد المحاسبية وأقسامها الرقابية ({custodiesList.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateCustody(true)}
                  className="text-[11px] text-sky-700 dark:text-sky-300 hover:underline cursor-pointer"
                >
                  + إنشاء عهدة
                </button>
              </div>

              {custodiesList.length === 0 ? (
                <div className="pr-4 py-1.5 text-slate-400 text-[11px]">
                  └─ لا توجد عهد مضافة بعد.
                </div>
              ) : (
                custodiesList.map((c) => (
                  <div
                    key={c.id}
                    className="pr-4 space-y-2 border-r-2 border-indigo-200 dark:border-indigo-800/50"
                  >
                    <div className="flex items-center justify-between py-1 text-slate-800 dark:text-slate-200 font-bold">
                      <span>├─ 📦 عهدة: {c.name} ({c.code})</span>
                      <span className="text-[10px] text-slate-400">
                        {c.users_count} موظفين مسكنين
                      </span>
                    </div>

                    {/* Warehouses under this custody */}
                    <div className="pr-6 space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                      {c.warehouses?.map((w: Warehouse) => (
                        <div key={w.id} className="flex items-center justify-between">
                          <span>
                            {w.is_main
                              ? `└─ ⭐ ${w.name} [المخزن الرئيسي لاستقبال الوارد]`
                              : `└─ 🏬 ${w.name} [مخزن فرعي]`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* =================== CARDS VIEW =================== */
        <div className="space-y-8">
          {/* SECTION 1: General Company Warehouses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WarehouseIcon className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  المخازن العامة للشركة مباشرة ({generalWarehouses.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGeneralWarehouseModal(true)}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                + إضافة مخزن عام
              </button>
            </div>

            {generalWarehouses.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-xs text-slate-400">
                لا توجد مخازن عامة مسجلة تابعة للشركة مباشرة حتى الآن. المخازن العامة تُستخدم للاحتفاظ بالأصناف المركزية.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {generalWarehouses.map((gw) => (
                  <div
                    key={gw.id}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                          <WarehouseIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {gw.name}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            مخزن عام للشركة
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        مباشر
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: Custodies and Assigned Warehouses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  العهد المحاسبية والمخازن التابعة ({custodiesList.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateCustody(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
              >
                + إنشاء عهدة جديدة
              </button>
            </div>

            {custodiesList.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <Building className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  لا توجد أي عهد محاسبية مسجلة بعد
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  قم بإنشاء العهدة وسيقوم النظام تلقائياً بتأسيس مخزنها الرئيسي الحصري لاستقبال الوارد وتوليد كودها دون الحاجة لإدخال كود بالإنجليزية.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateCustody(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  إنشاء أول عهدة الآن
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

                      {/* Main Warehouse Callout */}
                      <div className="p-3 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-100 dark:border-sky-900/50 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between font-semibold text-sky-900 dark:text-sky-300">
                          <span className="flex items-center gap-1.5">
                            <WarehouseIcon className="w-3.5 h-3.5 text-sky-600" />
                            <span>{c.main_warehouse_name || c.main_warehouse?.name || 'المخزن الرئيسي للعهدة'}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">
                            المخزن الرئيسي الحصري للوارد
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                          * يستقبل كافة إضافات الوارد الخارجي للعهدة، ويوزع للمخازن الفرعية عبر التحويل الداخلي.
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
                                {w.is_main ? 'رئيسي (تلقائي)' : 'فرعي'}
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
                          {c.isInitialImportLocked ? '🔒 التأسيس مقفل' : '🔓 متاح للاستيراد التأسيسي'}
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
          </div>
        </div>
      )}

      {/* Modal: Edit Company Name */}
      {showEditCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>تعديل اسم الشركة</span>
            </h3>

            <form onSubmit={handleUpdateCompany} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  اسم الشركة / المؤسسة:
                </label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="مثال: شركة النماء للإنشاءات"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditCompany(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingCompany}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 cursor-pointer"
                >
                  {isUpdatingCompany ? 'جارٍ الحفظ...' : 'حفظ التعديل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Custody (Only asks for Arabic name!) */}
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

            <form onSubmit={handleCreateCustody} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  اسم العهدة المحاسبية (بالعربية):
                </label>
                <input
                  type="text"
                  required
                  value={custodyName}
                  onChange={(e) => setCustodyName(e.target.value)}
                  placeholder="مثال: عهدة الكهرباء، عهدة التبريد، عهدة الصيانة العامة"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * سيقوم النظام بتوليد كود تسلسلي فريد للعهدة تلقائياً، وإنشاء مخزنها الرئيسي الحصري لاستقبال الوارد فوراً.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateCustody(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isCreating ? 'جارٍ الإنشاء والتأسيس...' : 'تأكيد إنشاء العهدة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add General Warehouse to Company */}
      {showGeneralWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <WarehouseIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إضافة مخزن عام للشركة
              </h3>
            </div>

            {generalWarehouseError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {generalWarehouseError}
              </div>
            )}

            <form onSubmit={handleAddGeneralWarehouse} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  اسم المخزن العام:
                </label>
                <input
                  type="text"
                  required
                  value={generalWarehouseName}
                  onChange={(e) => setGeneralWarehouseName(e.target.value)}
                  placeholder="مثال: المخزن المركزي العام، مخزن الهناجر 3"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * يتبع هذا المخزن الشركة مباشرة، ويمكن تخزين أصناف مركزية أو تابعة لعهد متعددة به.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGeneralWarehouseModal(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingGeneral}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isAddingGeneral ? 'جارٍ الإنشاء...' : 'إنشاء المخزن العام'}
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

            <form onSubmit={handleAddSubWarehouse} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  اسم المخزن الفرعي:
                </label>
                <input
                  type="text"
                  required
                  value={subWarehouseName}
                  onChange={(e) => setSubWarehouseName(e.target.value)}
                  placeholder="مثال: مخزن الموقع الشمالي، مخزن الورشة الفرعية"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  * يتم تغذية المخازن الفرعية بالأصناف حصراً عبر «التحويل الداخلي» من المخزن الرئيسي للعهدة.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedCustodyForWarehouse(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingWarehouse}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isAddingWarehouse ? 'جارٍ الإضافة...' : 'إضافة المخزن الفرعي'}
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
            <div className="flex items-center gap-2 pb-3 border-b border-rose-100 dark:border-rose-950/40 text-rose-600">
              <Archive className="w-5 h-5" />
              <h3 className="text-sm font-bold">
                أرشفة وإغلاق العهدة: {archiveTarget.name}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              وفقاً لقواعد النظام، لا يمكن أرشفة العهدة إلا بعد تصفير كافة أرصدتها في المخزن الرئيسي وجميع المخازن عبر حركات معتمدة وحسم أي طلبات معلقة.
            </p>

            {archiveError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
                {archiveError}
              </div>
            )}

            <form onSubmit={handleArchiveCustody} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  أدخل كلمة مرور مسؤول النظام للتأكيد:
                </label>
                <input
                  type="password"
                  required
                  value={archiveAdminPassword}
                  onChange={(e) => setArchiveAdminPassword(e.target.value)}
                  placeholder="كلمة مرور الأدمن"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setArchiveTarget(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isArchiving}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isArchiving ? 'جارٍ التحقق والأرشفة...' : 'تأكيد الأرشفة والإغلاق'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Foundational Import */}
      {importTarget && (
        <FoundationalImportModal
          custody={importTarget}
          onClose={() => setImportTarget(null)}
          onSuccess={() => {
            setImportTarget(null);
            fetchOrganizationData();
          }}
        />
      )}
    </div>
  );
};
