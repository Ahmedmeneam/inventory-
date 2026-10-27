import React, { useState, useEffect } from 'react';
import { Item, Category, Unit } from '../types/items.ts';
import { Custody } from '../types/custody.ts';
import {
  Boxes,
  PlusCircle,
  Search,
  Building,
  User as UserIcon,
  Warehouse,
  CheckCircle2,
  Filter,
  ArrowLeft,
  X,
  Link as LinkIcon,
  Tag,
  FolderPlus,
  AlertCircle,
  Eye,
  Check,
} from 'lucide-react';

export const ItemsPage: React.FC = () => {
  const [custodiesList, setCustodiesList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [unitsList, setUnitsList] = useState<Unit[]>([]);
  const [allItemsList, setAllItemsList] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Search custodies
  const [custodySearch, setCustodySearch] = useState('');

  // Selected Custody Details Modal / View
  const [selectedCustody, setSelectedCustody] = useState<any | null>(null);
  const [custodyItems, setCustodyItems] = useState<any[]>([]);
  const [custodyItemsLoading, setCustodyItemsLoading] = useState(false);

  // Search and Category filter inside selected custody
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Modal: Create New Item for Selected Custody
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemUnitId, setItemUnitId] = useState('');
  const [itemMinLimit, setItemMinLimit] = useState('0');
  const [itemCustomCode, setItemCustomCode] = useState('');
  const [itemError, setItemError] = useState('');
  const [isCreatingItem, setIsCreatingItem] = useState(false);

  // Modal: Link Existing Central Items to Selected Custody
  const [showLinkExistingModal, setShowLinkExistingModal] = useState(false);
  const [selectedExistingIds, setSelectedExistingIds] = useState<number[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Modal: Inline Add Category
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatPrefix, setNewCatPrefix] = useState('');
  const [catError, setCatError] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  const fetchMainData = async () => {
    try {
      const [custRes, catRes, unitsRes, itemsRes] = await Promise.all([
        fetch('/api/custodies'),
        fetch('/api/categories'),
        fetch('/api/units'),
        fetch('/api/items'),
      ]);

      if (custRes.ok) {
        const cData = await custRes.json();
        setCustodiesList(cData.custodies || []);
      }
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategoriesList(catData.categories || []);
      }
      if (unitsRes.ok) {
        const uData = await unitsRes.json();
        setUnitsList(uData.units || []);
      }
      if (itemsRes.ok) {
        const iData = await itemsRes.json();
        setAllItemsList(iData.items || []);
      }
    } catch (err) {
      console.error('Error fetching items management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMainData();
  }, []);

  // Fetch items for a specific custody
  const fetchCustodyItems = async (cId: number) => {
    setCustodyItemsLoading(true);
    try {
      const res = await fetch(`/api/custodies/${cId}/items`);
      if (res.ok) {
        const data = await res.json();
        setCustodyItems(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching items for custody:', err);
    } finally {
      setCustodyItemsLoading(false);
    }
  };

  const handleOpenCustody = (custody: any) => {
    setSelectedCustody(custody);
    setItemSearchQuery('');
    setSelectedCategoryFilter('all');
    fetchCustodyItems(custody.id);
  };

  // Create new item directly for selected custody
  const handleCreateCustodyItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustody || !itemName.trim() || !itemCategoryId || !itemUnitId) return;

    setItemError('');
    setIsCreatingItem(true);

    try {
      const res = await fetch(`/api/custodies/${selectedCustody.id}/items/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemName.trim(),
          categoryId: Number(itemCategoryId),
          unitId: Number(itemUnitId),
          minLimit: Number(itemMinLimit) || 0,
          customCode: itemCustomCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إنشاء الصنف للعهدة');
      }

      setShowCreateItemModal(false);
      setItemName('');
      setItemCategoryId('');
      setItemUnitId('');
      setItemMinLimit('0');
      setItemCustomCode('');
      fetchCustodyItems(selectedCustody.id);
      fetchMainData();
    } catch (err: any) {
      setItemError(err.message || 'حدث خطأ');
    } finally {
      setIsCreatingItem(false);
    }
  };

  // Link existing central items to selected custody
  const handleLinkExistingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustody || selectedExistingIds.length === 0) return;

    setLinkError('');
    setIsLinking(true);

    try {
      const res = await fetch(`/api/custodies/${selectedCustody.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedExistingIds }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل ربط الأصناف بالعهدة');
      }

      setShowLinkExistingModal(false);
      setSelectedExistingIds([]);
      fetchCustodyItems(selectedCustody.id);
      fetchMainData();
    } catch (err: any) {
      setLinkError(err.message || 'حدث خطأ');
    } finally {
      setIsLinking(false);
    }
  };

  // Inline Add Category
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
      setItemCategoryId(String(createdCat.id));
      setShowAddCategoryModal(false);
      setNewCatName('');
      setNewCatPrefix('');
    } catch (err: any) {
      setCatError(err.message || 'حدث خطأ أثناء إضافة التصنيف');
    } finally {
      setIsAddingCat(false);
    }
  };

  // Filter custodies in main grid
  const filteredCustodies = custodiesList.filter((c) =>
    c.name.toLowerCase().includes(custodySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(custodySearch.toLowerCase()) ||
    (c.supervisor_name && c.supervisor_name.toLowerCase().includes(custodySearch.toLowerCase())) ||
    (c.storekeeper_name && c.storekeeper_name.toLowerCase().includes(custodySearch.toLowerCase()))
  );

  // Filter items inside selected custody view
  const filteredCustodyItems = custodyItems.filter((it) => {
    const matchesSearch =
      it.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
      it.item_code.toLowerCase().includes(itemSearchQuery.toLowerCase());
    const matchesCategory =
      selectedCategoryFilter === 'all' || String(it.category_id) === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Items not yet linked to the selected custody
  const unlinkedItems = allItemsList.filter(
    (allIt) => !custodyItems.some((cIt) => cIt.item_id === allIt.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-indigo-600" />
            <span>إدارة الأصناف</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            استعراض الأصناف مفصولة ومبوبة بحسب كل عهدة منشأة، وإنشاء وإسناد الأصناف مباشرة
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setShowAddCategoryModal(true);
              setCatError('');
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <span>إضافة تصنيف</span>
          </button>
        </div>
      </div>

      {/* Custodies Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="بحث في العهد بالاسم، الكود، رئيس القسم، أو أمين العهدة..."
          value={custodySearch}
          onChange={(e) => setCustodySearch(e.target.value)}
          className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
        />
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
      </div>

      {/* Custodies Grid (Instead of dumped mixed items table) */}
      {loading ? (
        <div className="text-center py-12 text-xs text-slate-400">جارٍ تحميل العهد...</div>
      ) : filteredCustodies.length === 0 ? (
        <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 space-y-3">
          <Building className="w-10 h-10 mx-auto opacity-40 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {custodiesList.length === 0
              ? 'لم يتم إنشاء أي عهدة حتى الآن (حالة نظيفة فارغة).'
              : 'لا توجد عهدة مطابقة لبحثك.'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {custodiesList.length === 0
              ? 'قم بإنشاء أول عهدة من تبويب «إدارة العهد والمخازن»، ليتم تلقائياً تأسيس قسمها ومخزنها الرئيسي وتهيئتها لاستقبال الأصناف.'
              : 'جرب البحث بكلمات أخرى.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCustodies.map((custody) => (
            <div
              key={custody.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all shadow-xs flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center font-bold">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                        {custody.name}
                      </h3>
                      <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {custody.code}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                    نشطة
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">رئيس القسم:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {custody.supervisor_name || '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">أمين العهدة:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {custody.storekeeper_name || '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">المخزن الرئيسي:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                      {custody.main_warehouse_name || 'المخزن الرئيسي'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleOpenCustody(custody)}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Boxes className="w-4 h-4" />
                  <span>عرض وإدارة أصناف العهدة</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dedicated Modal / Window for Specific Custody Items */}
      {selectedCustody && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      أصناف عهدة: {selectedCustody.name}
                    </h2>
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      {selectedCustody.code}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    الأصناف المدرجة هنا تظهر فوراً لرئيس القسم ({selectedCustody.supervisor_name || 'المراقب'}) وأمين العهدة ({selectedCustody.storekeeper_name || 'الميداني'})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustody(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Smart Search & Category Filter Inside Custody View */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="بحث ذكي باسم الصنف أو الكود..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  <option value="all">جميع التصنيفات</option>
                  {categoriesList.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name} ({c.prefix})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                {/* Create New Item for this Custody */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateItemModal(true);
                    setItemError('');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إنشاء صنف جديد</span>
                </button>

                {/* Link Existing Item to this Custody */}
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkExistingModal(true);
                    setSelectedExistingIds([]);
                    setLinkError('');
                  }}
                  disabled={unlinkedItems.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0 ${
                    unlinkedItems.length === 0
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-100 cursor-pointer'
                  }`}
                  title="إسناد صنف معرف مسبقاً في كتالوج الشركة"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>إسناد صنف موجود ({unlinkedItems.length})</span>
                </button>
              </div>
            </div>

            {/* Custody Items Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              {custodyItemsLoading ? (
                <div className="text-center py-12 text-xs text-slate-400">جارٍ جلب أصناف العهدة...</div>
              ) : filteredCustodyItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Boxes className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-xs">
                    {custodyItems.length === 0
                      ? 'لا توجد أي أصناف مسندة لهذه العهدة بعد. اضغط على «إنشاء صنف جديد» لإضافة الصنف الأول فوراً.'
                      : 'لا توجد نتائج بحث مطابقة داخل هذه العهدة.'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">كود الصنف</th>
                      <th className="py-2.5 px-3">اسم الصنف</th>
                      <th className="py-2.5 px-3">التصنيف</th>
                      <th className="py-2.5 px-3">الوحدة</th>
                      <th className="py-2.5 px-3 text-center">حد الأمان</th>
                      <th className="py-2.5 px-3 text-center">الرصيد الفعلي</th>
                      <th className="py-2.5 px-3 text-center">المحجوز</th>
                      <th className="py-2.5 px-3 text-center">المتاح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCustodyItems.map((item) => (
                      <tr key={item.item_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {item.item_code}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {item.category_name}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {item.unit_name} ({item.unit_symbol})
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                          {item.min_limit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                          {item.reserved_qty}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {item.available_qty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
              <span>إجمالي أصناف هذه العهدة: {custodyItems.length} صنف</span>
              <button
                type="button"
                onClick={() => setSelectedCustody(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Item for Custody */}
      {showCreateItemModal && selectedCustody && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إنشاء صنف جديد لعهدة ({selectedCustody.name})
              </h3>
            </div>

            {itemError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {itemError}
              </div>
            )}

            <form onSubmit={handleCreateCustodyItemSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الصنف *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: لوح خشب زان 20 مم"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
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
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
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
                    value={itemUnitId}
                    onChange={(e) => setItemUnitId(e.target.value)}
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
                    value={itemMinLimit}
                    onChange={(e) => setItemMinLimit(e.target.value)}
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
                    value={itemCustomCode}
                    onChange={(e) => setItemCustomCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-left dir-ltr"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isCreatingItem}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isCreatingItem ? 'جارٍ الإنشاء...' : 'إنشاء وربط بالعهدة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateItemModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Link Existing Central Items */}
      {showLinkExistingModal && selectedCustody && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <LinkIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إسناد أصناف معرفة إلى عهدة ({selectedCustody.name})
              </h3>
            </div>

            {linkError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {linkError}
              </div>
            )}

            <form onSubmit={handleLinkExistingSubmit} className="space-y-3 text-xs flex-1 flex flex-col overflow-hidden">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                اختر الأصناف المراد إسنادها ({selectedExistingIds.length} صنف محدد):
              </span>

              <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 p-2 max-h-56">
                {unlinkedItems.map((it) => {
                  const isSelected = selectedExistingIds.includes(it.id);
                  return (
                    <div
                      key={it.id}
                      onClick={() => {
                        setSelectedExistingIds((prev) =>
                          prev.includes(it.id) ? prev.filter((i) => i !== it.id) : [...prev, it.id]
                        );
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded text-indigo-600"
                        />
                        <span className="font-semibold">{it.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">({it.item_code})</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{it.unit_name}</span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isLinking || selectedExistingIds.length === 0}
                  className={`flex-1 py-2 rounded-xl font-bold transition-colors cursor-pointer ${
                    selectedExistingIds.length > 0 && !isLinking
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isLinking ? 'جارٍ الإسناد...' : `إسناد (${selectedExistingIds.length}) صنف`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkExistingModal(false)}
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
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
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
    </div>
  );
};
