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

  // Inline Category Creation Modal
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatPrefix, setNewCatPrefix] = useState('');
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
    if (!createName.trim() || !createCategoryId || !createUnitId || !custodyId) return;

    setCreateError('');
    setIsCreating(true);

    try {
      const res = await fetch(`/api/custodies/${custodyId}/items/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          categoryId: Number(createCategoryId),
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
    if (!suggestedName.trim() || !suggestedCategoryId || !suggestedUnitId || !custodyId) return;

    setProposeError('');
    setIsProposing(true);

    try {
      const res = await fetch(`/api/custodies/${custodyId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestedName: suggestedName.trim(),
          suggestedCategoryId: Number(suggestedCategoryId),
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

  // Handle Inline Category Creation
  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatPrefix.trim()) return;

    setCatError('');
    setIsAddingCat(true);

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName.trim(),
          prefix: newCatPrefix.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إنشاء التصنيف');
      }

      const createdCat = data.category;
      setCategoriesList((prev) => [...prev, createdCat]);

      // Preselect in current active modal
      if (showCreateModal) {
        setCreateCategoryId(String(createdCat.id));
      } else if (showProposeModal) {
        setSuggestedCategoryId(String(createdCat.id));
      }

      setShowAddCategoryModal(false);
      setNewCatName('');
      setNewCatPrefix('');
    } catch (err: any) {
      setCatError(err.message || 'حدث خطأ أثناء إضافة التصنيف');
    } finally {
      setIsAddingCat(false);
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

  const filteredItems = linkedItems.filter((it) => {
    const matchesSearch =
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.item_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === 'all' || String(it.category_id) === selectedCategoryFilter;
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
            <span>أصناف العهدة</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            العهدة الحالية: <strong>{user?.custody_name || 'غير مسكنة'}</strong> • {isSupervisor ? 'صلاحية رئيس القسم (إنشاء أصناف واعتماد المقترحات)' : 'صلاحية أمين العهدة (اقتراح أصناف ومتابعة الأرصدة)'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

          {/* Inline Add Category Button */}
          <button
            type="button"
            onClick={() => {
              setShowAddCategoryModal(true);
              setCatError('');
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="إضافة تصنيف جديد دون مغادرة الصفحة"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <span>إضافة تصنيف</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('linked')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
            activeTab === 'linked'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>الأصناف المسندة للعهدة ({linkedItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('proposals')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
            activeTab === 'proposals'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>مقترحات الأصناف ({proposals.length})</span>
          {pendingProposalsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
              {pendingProposalsCount} معلق
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Linked Items */}
      {activeTab === 'linked' && (
        <div className="space-y-4">
          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="بحث باسم الصنف أو الكود في العهدة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              >
                <option value="all">جميع التصنيفات ({categoriesList.length})</option>
                {categoriesList.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name} ({c.prefix})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <Boxes className="w-8 h-8 mx-auto opacity-50" />
                <p className="text-xs">
                  {linkedItems.length === 0
                    ? isSupervisor
                      ? 'لم يتم إضافة أو إسناد أي أصناف لهذه العهدة بعد. يمكنك الضغط على «إنشاء صنف جديد للعهدة» بالأعلى لإضافة أول صنف فوراً.'
                      : 'لم يتم إسناد أي أصناف لهذه العهدة بعد. يمكنك رفع مقترح صنف جديد لرئيس القسم.'
                    : 'لا توجد نتائج بحث مطابقة.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                    <tr>
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
                    {filteredItems.map((it) => (
                      <tr key={it.item_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {it.item_code}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {it.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {it.category_name}
                          </span>
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
                    ))}
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
                      <td className="py-2.5 px-3 text-slate-500">{p.category_name}</td>
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
                            : 'قيد المراجعة'}
                        </span>
                        {p.rejection_reason && (
                          <p className="text-[10px] text-rose-500 mt-0.5">سبب الرفض: {p.rejection_reason}</p>
                        )}
                      </td>

                      {isSupervisor && (
                        <td className="py-2.5 px-3 text-center">
                          {p.status === 'pending' ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApproveProposal(p.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                              >
                                اعتماد
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectTargetId(p.id);
                                  setRejectReason('');
                                  setRejectError('');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold cursor-pointer transition-colors"
                              >
                                رفض
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">مكتمل</span>
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

      {/* Modal: Direct Create Item (Supervisor / Head of Dept) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إنشاء صنف جديد للعهدة
              </h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              سيتم إنشاء الصنف وإدراجه مباشرة في عهدة <strong>{user?.custody_name}</strong> وسيظهر فوراً لأمين العهدة.
            </p>

            {createError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateItemSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الصنف *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مسامير صلب 5 سم"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      التصنيف *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCategoryModal(true)}
                      className="text-[10px] text-indigo-600 hover:underline cursor-pointer"
                    >
                      + تصنيف جديد
                    </button>
                  </div>
                  <select
                    required
                    value={createCategoryId}
                    onChange={(e) => setCreateCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">اختر التصنيف</option>
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.prefix})
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    حد الأمان (الحد الأدنى)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={createMinLimit}
                    onChange={(e) => setCreateMinLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-left dir-ltr"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    كود مخصص (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="تلقائي بنمط [PREFIX]-0001"
                    value={createCustomCode}
                    onChange={(e) => setCreateCustomCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-left dir-ltr"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isCreating ? 'جارٍ الإنشاء...' : 'إنشاء وإدراج بالعهدة'}
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
                  placeholder="مثال: غراء خشب مقاوم للرطوبة 5كجم"
                  value={suggestedName}
                  onChange={(e) => setSuggestedName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      التصنيف *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCategoryModal(true)}
                      className="text-[10px] text-indigo-600 hover:underline cursor-pointer"
                    >
                      + تصنيف جديد
                    </button>
                  </div>
                  <select
                    required
                    value={suggestedCategoryId}
                    onChange={(e) => setSuggestedCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">اختر التصنيف</option>
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.prefix})
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  مبررات وملاحظات الاقتراح
                </label>
                <textarea
                  rows={2}
                  placeholder="سبب طلب إدراج هذا الصنف بالعهدة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
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

      {/* Modal: Inline Add Category */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <FolderPlus className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إضافة تصنيف أصناف جديد
              </h3>
            </div>

            {catError && (
              <div className="p-2 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {catError}
              </div>
            )}

            <form onSubmit={handleAddCategorySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم التصنيف *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أخشاب، دهانات، أدوات"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  بادئة الكود الإنجليزية (Prefix) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  placeholder="مثال: WOD أو PNT"
                  value={newCatPrefix}
                  onChange={(e) => setNewCatPrefix(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-left dir-ltr"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isAddingCat}
                  className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isAddingCat ? 'جارٍ الحفظ...' : 'حفظ التصنيف'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reject Proposal (Supervisor) */}
      {rejectTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <XCircle className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                رفض مقترح الصنف
              </h3>
            </div>

            {rejectError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {rejectError}
              </div>
            )}

            <form onSubmit={handleRejectProposalSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  سبب الرفض الإلزامي *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="يرجى كتابة سبب عدم اعتماد هذا الصنف..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
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
                  {isRejecting ? 'جارٍ الحفظ...' : 'تأكيد الرفض'}
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
