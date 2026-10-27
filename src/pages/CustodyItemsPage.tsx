import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Item, Category, Unit, ItemProposal } from '../types/items.ts';
import {
  Boxes,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  Search,
  Sparkles,
  Filter,
  FolderPlus,
  Tag,
  Warehouse,
  CheckSquare,
  Square,
  X,
  Layers,
} from 'lucide-react';

export const CustodyItemsPage: React.FC = () => {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'supervisor';
  const custodyId = user?.custody_id;

  const [activeTab, setActiveTab] = useState<'linked' | 'proposals'>('linked');
  const [linkedItems, setLinkedItems] = useState<any[]>([]);
  const [proposals, setProposals] = useState<ItemProposal[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [unitsList, setUnitsList] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Category Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Bulk Selection
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [isBulkCategorizing, setIsBulkCategorizing] = useState(false);
  const [bulkStatusMsg, setBulkStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal: Direct Create Item (Supervisor / Dept Head)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCategoryId, setCreateCategoryId] = useState('');
  const [createUnitId, setCreateUnitId] = useState('');
  const [createMinLimit, setCreateMinLimit] = useState('0');
  const [createCustomCode, setCreateCustomCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal: Propose Item (Storekeeper)
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [suggestedName, setSuggestedName] = useState('');
  const [suggestedCategoryId, setSuggestedCategoryId] = useState('');
  const [suggestedUnitId, setSuggestedUnitId] = useState('');
  const [minLimit, setMinLimit] = useState('0');
  const [notes, setNotes] = useState('');
  const [proposeError, setProposeError] = useState('');
  const [isProposing, setIsProposing] = useState(false);

  // Category Management Modal (Supervisor only, no English prefix required!)
  const [showCategoryManagementModal, setShowCategoryManagementModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catError, setCatError] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Reject Proposal Modal (Supervisor)
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchCustodyItemsData = async () => {
    if (!custodyId) return;

    try {
      const [linkedRes, propRes, catRes, unitsRes] = await Promise.all([
        fetch(`/api/custodies/${custodyId}/items`),
        fetch(`/api/custodies/${custodyId}/proposals`),
        fetch('/api/categories'),
        fetch('/api/units'),
      ]);

      if (linkedRes.ok) {
        const lData = await linkedRes.json();
        setLinkedItems(lData.items || []);
      }
      if (propRes.ok) {
        const pData = await propRes.json();
        setProposals(pData.proposals || []);
      }
      if (catRes.ok) {
        const cData = await catRes.json();
        setCategoriesList(cData.categories || []);
      }
      if (unitsRes.ok) {
        const uData = await unitsRes.json();
        setUnitsList(uData.units || []);
      }
    } catch (err) {
      console.error('Error fetching custody items data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustodyItemsData();
  }, [custodyId]);

  // Handle Supervisor Direct Item Creation
  const handleCreateItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createUnitId || !custodyId) return;

    setCreateError('');
    setIsCreating(true);

    try {
      const res = await fetch(`/api/custodies/${custodyId}/items/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          categoryId: createCategoryId ? Number(createCategoryId) : null,
          unitId: Number(createUnitId),
          minLimit: Number(createMinLimit) || 0,
          customCode: createCustomCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إنشاء الصنف للعهدة');
      }

      setShowCreateModal(false);
      setCreateName('');
      setCreateCategoryId('');
      setCreateUnitId('');
      setCreateMinLimit('0');
      setCreateCustomCode('');
      fetchCustodyItemsData();
    } catch (err: any) {
      setCreateError(err.message || 'حدث خطأ');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Storekeeper Item Proposal
  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestedName.trim() || !suggestedUnitId || !custodyId) return;

    setProposeError('');
    setIsProposing(true);

    try {
      const res = await fetch(`/api/custodies/${custodyId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestedName: suggestedName.trim(),
          suggestedCategoryId: suggestedCategoryId ? Number(suggestedCategoryId) : null,
          suggestedUnitId: Number(suggestedUnitId),
          minLimit: Number(minLimit) || 0,
          notes: notes.trim() || undefined,
          userId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إرسال المقترح');
      }

      setShowProposeModal(false);
      setSuggestedName('');
      setSuggestedCategoryId('');
      setSuggestedUnitId('');
      setMinLimit('0');
      setNotes('');
      fetchCustodyItemsData();
    } catch (err: any) {
      setProposeError(err.message || 'حدث خطأ');
    } finally {
      setIsProposing(false);
    }
  };

  // Handle Supervisor Category Creation (Arabic name only!)
  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setCatError('');
    setIsAddingCat(true);

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إنشاء التصنيف');
      }

      const createdCat = data.category;
      setCategoriesList((prev) => [...prev, createdCat]);
      setNewCatName('');

      if (showCreateModal) {
        setCreateCategoryId(String(createdCat.id));
      }
    } catch (err: any) {
      setCatError(err.message || 'حدث خطأ أثناء إضافة التصنيف');
    } finally {
      setIsAddingCat(false);
    }
  };

  // Bulk Categorization Execution
  const handleBulkCategorizeSubmit = async () => {
    if (selectedItemIds.length === 0 || !bulkCategoryId) return;

    setIsBulkCategorizing(true);
    setBulkStatusMsg(null);

    try {
      const res = await fetch('/api/items/bulk-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: selectedItemIds,
          categoryId: bulkCategoryId === 'none' ? null : Number(bulkCategoryId),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل التحديث الجماعي للتصنيف');
      }

      setBulkStatusMsg({
        type: 'success',
        text: `تم تصنيف ${selectedItemIds.length} صنف بنجاح`,
      });
      setSelectedItemIds([]);
      setBulkCategoryId('');
      fetchCustodyItemsData();
    } catch (err: any) {
      setBulkStatusMsg({
        type: 'error',
        text: err.message || 'حدث خطأ أثناء تعيين التصنيف',
      });
    } finally {
      setIsBulkCategorizing(false);
    }
  };

  // Toggle item selection
  const toggleSelectItem = (id: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Toggle select all filtered items
  const toggleSelectAll = () => {
    const visibleIds = filteredItems.map((it) => it.item_id);
    const allSelected = visibleIds.every((id) => selectedItemIds.includes(id));
    if (allSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedItemIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Handle Supervisor Approving Proposal
  const handleApproveProposal = async (proposalId: number) => {
    try {
      const res = await fetch(`/api/proposals/${proposalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorUserId: user?.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'فشل اعتماد المقترح');
        return;
      }

      fetchCustodyItemsData();
    } catch (err) {
      alert('حدث خطأ أثناء الاعتماد');
    }
  };

  // Handle Supervisor Rejecting Proposal
  const handleRejectProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetId || !rejectReason.trim()) return;

    setRejectError('');
    setIsRejecting(true);

    try {
      const res = await fetch(`/api/proposals/${rejectTargetId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason.trim(),
          supervisorUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل رفض المقترح');
      }

      setRejectTargetId(null);
      setRejectReason('');
      fetchCustodyItemsData();
    } catch (err: any) {
      setRejectError(err.message || 'حدث خطأ');
    } finally {
      setIsRejecting(false);
    }
  };

  const uncategorizedCount = linkedItems.filter((it) => !it.category_id).length;

  const filteredItems = linkedItems.filter((it) => {
    const matchesSearch =
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.item_code.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesCategory = true;
    if (selectedCategoryFilter === 'uncategorized') {
      matchesCategory = !it.category_id;
    } else if (selectedCategoryFilter !== 'all') {
      matchesCategory = String(it.category_id) === selectedCategoryFilter;
    }

    return matchesSearch && matchesCategory;
  });

  const pendingProposalsCount = proposals.filter((p) => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-indigo-600" />
            <span>أصناف العهدة وإدارة التصنيفات</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            العهدة الحالية: <strong>{user?.custody_name || 'غير مسكنة'}</strong> •{' '}
            {isSupervisor
              ? 'صلاحية رئيس القسم (إنشاء وتصنيف الأصناف واعتماد المقترحات)'
              : 'صلاحية أمين العهدة (اقتراح أصناف ومتابعة الأرصدة)'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Supervisor Only: Manage & Create Categories */}
          {isSupervisor && (
            <button
              type="button"
              onClick={() => {
                setShowCategoryManagementModal(true);
                setCatError('');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>إدارة وإنشاء التصنيفات</span>
            </button>
          )}

          {/* Button: Dept Head creates directly, Storekeeper proposes */}
          {isSupervisor ? (
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setCreateError('');
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إنشاء صنف جديد للعهدة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowProposeModal(true);
                setProposeError('');
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>اقتراح صنف جديد للعهدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('linked')}
          className={`py-3 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'linked'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>الأصناف المسندة للعهدة ({linkedItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('proposals')}
          className={`py-3 px-5 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'proposals'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>مقترحات الأصناف الجديدة</span>
          {pendingProposalsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono">
              {pendingProposalsCount}
            </span>
          )}
        </button>
      </div>

      {/* Status Toast */}
      {bulkStatusMsg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between animate-in fade-in ${
            bulkStatusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <span>{bulkStatusMsg.text}</span>
          <button
            type="button"
            onClick={() => setBulkStatusMsg(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tab 1: Linked Items */}
      {activeTab === 'linked' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بكود أو اسم الصنف..."
                className="w-full pr-9 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>التصنيف:</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                الكل ({linkedItems.length})
              </button>

              {/* Uncategorized filter pill */}
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('uncategorized')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  selectedCategoryFilter === 'uncategorized'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <span>بدون تصنيف</span>
                <span className="font-mono">({uncategorizedCount})</span>
              </button>

              {categoriesList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(String(c.id))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedCategoryFilter === String(c.id)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Supervisor Bulk Action Bar (When items are selected) */}
          {isSupervisor && selectedItemIds.length > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-900 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-300" />
                <span className="text-xs font-bold">
                  تم تحديد ({selectedItemIds.length}) صنف للإجراء الجماعي
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={bulkCategoryId}
                  onChange={(e) => setBulkCategoryId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-950 text-white border border-indigo-700 text-xs"
                >
                  <option value="">-- اختر التصنيف المراد تعيينه --</option>
                  <option value="none">بدون تصنيف (إلغاء التصنيف)</option>
                  {categoriesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.prefix})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleBulkCategorizeSubmit}
                  disabled={!bulkCategoryId || isBulkCategorizing}
                  className="px-4 py-1.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isBulkCategorizing ? 'جارٍ الحفظ...' : 'تطبيق التصنيف للأصناف المحددة'}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedItemIds([])}
                  className="px-3 py-1.5 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 text-xs cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            {filteredItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Boxes className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  لا توجد أصناف مطابقة للبحث أو الفلتر
                </h4>
                <p className="text-[11px]">
                  {selectedCategoryFilter === 'uncategorized'
                    ? 'ممتاز! لا توجد أصناف بدون تصنيف حالياً.'
                    : 'يمكنك إنشاء أصناف جديدة أو إسنادها للعهدة.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      {isSupervisor && (
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredItems.length > 0 &&
                              filteredItems.every((it) => selectedItemIds.includes(it.item_id))
                            }
                            onChange={toggleSelectAll}
                            className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                            title="تحديد الكل"
                          />
                        </th>
                      )}
                      <th className="py-2.5 px-3">كود الصنف</th>
                      <th className="py-2.5 px-3">اسم الصنف</th>
                      <th className="py-2.5 px-3">التصنيف</th>
                      <th className="py-2.5 px-3">الوحدة</th>
                      <th className="py-2.5 px-3 text-center">الرصيد الفعلي</th>
                      <th className="py-2.5 px-3 text-center">المحجوز</th>
                      <th className="py-2.5 px-3 text-center">الرصيد المتاح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredItems.map((it) => {
                      const isSelected = selectedItemIds.includes(it.item_id);
                      return (
                        <tr
                          key={it.item_id}
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                          }`}
                        >
                          {isSupervisor && (
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectItem(it.item_id)}
                                className="rounded border-slate-300 text-indigo-600 cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {it.item_code}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            {it.name}
                          </td>
                          <td className="py-2.5 px-3">
                            {it.category_name === 'بدون تصنيف' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                بدون تصنيف
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                                {it.category_name}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {it.unit_name} ({it.unit_symbol})
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                            {it.reserved_qty}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {it.available_qty}
                          </td>
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

      {/* Tab 2: Proposals */}
      {activeTab === 'proposals' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          {proposals.length === 0 ? (
            <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-xs">لا توجد أي مقترحات أصناف مسجلة لهذه العهدة حالياً.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">اسم الصنف المقترح</th>
                    <th className="py-2.5 px-3">التصنيف</th>
                    <th className="py-2.5 px-3">وحدة القياس</th>
                    <th className="py-2.5 px-3">حد الأمان</th>
                    <th className="py-2.5 px-3">ملاحظات</th>
                    <th className="py-2.5 px-3">الحالة</th>
                    {isSupervisor && <th className="py-2.5 px-3 text-center">إجراءات رئيس القسم</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {proposals.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {p.suggested_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{p.category_name || 'بدون تصنيف'}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.unit_name}</td>
                      <td className="py-2.5 px-3 font-mono">{p.min_limit}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{p.notes || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            p.status === 'approved'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : p.status === 'rejected'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {p.status === 'approved'
                            ? 'معتمد'
                            : p.status === 'rejected'
                            ? 'مرفوض'
                            : 'بانتظار الاعتماد'}
                        </span>
                      </td>
                      {isSupervisor && (
                        <td className="py-2.5 px-3 text-center">
                          {p.status === 'pending' ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveProposal(p.id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 cursor-pointer text-[10px]"
                              >
                                اعتماد وإسناد
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectTargetId(p.id);
                                  setRejectReason('');
                                  setRejectError('');
                                }}
                                className="px-2.5 py-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer text-[10px]"
                              >
                                رفض
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400">مكتمل</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Category Management (Supervisor only, no English prefix required!) */}
      {showCategoryManagementModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  إدارة وإنشاء التصنيفات (خاص برئيس القسم)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryManagementModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Create Category Form */}
            <form onSubmit={handleAddCategorySubmit} className="space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                + إنشاء تصنيف جديد:
              </span>

              {catError && (
                <div className="p-2 rounded bg-rose-50 text-rose-700 text-xs">
                  {catError}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="اسم التصنيف بالعربية (مثال: أخشاب، دهانات، مسامير)..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                />
                <button
                  type="submit"
                  disabled={isAddingCat}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  {isAddingCat ? '...' : 'إضافة'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                * يقوم النظام بتوليد بادئة الكود الإنجليزية تلقائياً بنمط تسلسلي، دون الحاجة لإدخالها يدوياً.
              </p>
            </form>

            {/* Existing Categories List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                التصنيفات الحالية في النظام ({categoriesList.length}):
              </span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {categoriesList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 text-center">لا توجد تصنيفات معرفة بعد.</p>
                ) : (
                  categoriesList.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {c.name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded">
                        الكود: {c.prefix}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Direct Create Item (Supervisor) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إنشاء صنف جديد وإسناده للعهدة مباشرة
              </h3>
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateItemSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الصنف بالعربية *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: خشب موسكي 2 بوصة، كابل نحاسي 4 ملم"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      التصنيف (اختياري)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCategoryManagementModal(true)}
                      className="text-[10px] text-amber-600 hover:underline cursor-pointer"
                    >
                      + إدارة
                    </button>
                  </div>
                  <select
                    value={createCategoryId}
                    onChange={(e) => setCreateCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">بدون تصنيف (يمكن تصنيفه لاحقاً)</option>
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    وحدة القياس *
                  </label>
                  <select
                    required
                    value={createUnitId}
                    onChange={(e) => setCreateUnitId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">اختر الوحدة</option>
                    {unitsList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الحد الأدنى للأمان (Reorder Limit)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={createMinLimit}
                  onChange={(e) => setCreateMinLimit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isCreating ? 'جارٍ الإنشاء...' : 'إنشاء وإسناد للعهدة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Propose Item (Storekeeper) */}
      {showProposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                اقتراح صنف جديد للعهدة
              </h3>
            </div>

            {proposeError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {proposeError}
              </div>
            )}

            <form onSubmit={handleProposeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الصنف المقترح *
                </label>
                <input
                  type="text"
                  required
                  placeholder="اسم الصنف التوصيفي..."
                  value={suggestedName}
                  onChange={(e) => setSuggestedName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    التصنيف (اختياري)
                  </label>
                  <select
                    value={suggestedCategoryId}
                    onChange={(e) => setSuggestedCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">بدون تصنيف</option>
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    وحدة القياس *
                  </label>
                  <select
                    required
                    value={suggestedUnitId}
                    onChange={(e) => setSuggestedUnitId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">اختر الوحدة</option>
                    {unitsList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  حد الأمان المقترح
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={minLimit}
                  onChange={(e) => setMinLimit(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات الاقتراح
                </label>
                <textarea
                  rows={2}
                  placeholder="سبب طلب إضافة هذا الصنف..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isProposing}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isProposing ? 'جارٍ الإرسال...' : 'رفع المقترح لرئيس القسم'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Proposal Modal */}
      {rejectTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-rose-600">
              رفض مقترح الصنف
            </h3>

            {rejectError && (
              <div className="p-2 rounded bg-rose-50 text-rose-700 text-xs">
                {rejectError}
              </div>
            )}

            <form onSubmit={handleRejectProposalSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  سبب الرفض:
                </label>
                <textarea
                  rows={2}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="بيان سبب عدم اعتماد الصنف..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectTargetId(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isRejecting}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
                >
                  {isRejecting ? 'جارٍ الرفض...' : 'تأكيد الرفض'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
