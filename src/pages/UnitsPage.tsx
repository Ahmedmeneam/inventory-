import React, { useState, useEffect } from 'react';
import { Unit, Category } from '../types/items.ts';
import { Ruler, Tags, PlusCircle, Check, AlertCircle } from 'lucide-react';

export const UnitsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'units' | 'categories'>('units');
  const [unitsList, setUnitsList] = useState<Unit[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal: Add Unit
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitSymbol, setUnitSymbol] = useState('');
  const [unitError, setUnitError] = useState('');
  const [isAddingUnit, setIsAddingUnit] = useState(false);

  // Modal: Add Category
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryPrefix, setCategoryPrefix] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const fetchData = async () => {
    try {
      const [unitsRes, catRes] = await Promise.all([
        fetch('/api/units'),
        fetch('/api/categories'),
      ]);
      if (unitsRes.ok) {
        const uData = await unitsRes.json();
        setUnitsList(uData.units || []);
      }
      if (catRes.ok) {
        const cData = await catRes.json();
        setCategoriesList(cData.categories || []);
      }
    } catch (err) {
      console.error('Error fetching units/categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName.trim() || !unitSymbol.trim()) return;

    setUnitError('');
    setIsAddingUnit(true);

    try {
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: unitName.trim(), symbol: unitSymbol.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إضافة وحدة القياس');
      }

      setShowAddUnit(false);
      setUnitName('');
      setUnitSymbol('');
      fetchData();
    } catch (err: any) {
      setUnitError(err.message || 'حدث خطأ');
    } finally {
      setIsAddingUnit(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim() || !categoryPrefix.trim()) return;

    setCategoryError('');
    setIsAddingCategory(true);

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: categoryName.trim(),
          prefix: categoryPrefix.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إضافة التصنيف');
      }

      setShowAddCategory(false);
      setCategoryName('');
      setCategoryPrefix('');
      fetchData();
    } catch (err: any) {
      setCategoryError(err.message || 'حدث خطأ');
    } finally {
      setIsAddingCategory(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Ruler className="w-5 h-5 text-indigo-600" />
            <span>دليل وحدات القياس والتصنيفات</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تعريف وحدات القياس المعيارية وبادئات تصنيف كتالوج الأصناف الموحد
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'units' ? (
            <button
              type="button"
              onClick={() => setShowAddUnit(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة وحدة قياس</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddCategory(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة تصنيف أصناف</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('units')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
            activeTab === 'units'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Ruler className="w-4 h-4" />
          <span>وحدات القياس ({unitsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`pb-3 flex items-center gap-1.5 cursor-pointer border-b-2 transition-all ${
            activeTab === 'categories'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Tags className="w-4 h-4" />
          <span>تصنيفات الأصناف ({categoriesList.length})</span>
        </button>
      </div>

      {/* Tab 1: Units */}
      {activeTab === 'units' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          {unitsList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <Ruler className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">دليل وحدات القياس فارغ حالياً. أضف أول وحدة قياس (مثل: قطعة، متر، كجم، لتر، صندوق).</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">اسم وحدة القياس</th>
                    <th className="py-2.5 px-3">رمز الوحدة (الرمز المختصر)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {unitsList.map((u, i) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{u.name}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{u.symbol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Categories */}
      {activeTab === 'categories' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          {categoriesList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <Tags className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">دليل التصنيفات فارغ حالياً. أضف أول تصنيف وبادئته (مثل: أخشاب / WOD، كهرباء / ELEC، عدد / TOOL).</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">اسم التصنيف</th>
                    <th className="py-2.5 px-3">بادئة كود الصنف التلقائي</th>
                    <th className="py-2.5 px-3">نمط الكود المولد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categoriesList.map((c, i) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-600 dark:text-amber-400">{c.prefix}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{c.prefix}-0001</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Unit */}
      {showAddUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Ruler className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">إضافة وحدة قياس جديدة</h3>
            </div>

            {unitError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {unitError}
              </div>
            )}

            <form onSubmit={handleAddUnit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم وحدة القياس *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: قطعة، متر، كجم، صندوق"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  رمز الوحدة المختصر *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ق، م، كجم، ص"
                  value={unitSymbol}
                  onChange={(e) => setUnitSymbol(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isAddingUnit}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isAddingUnit ? 'جارٍ الحفظ...' : 'حفظ وحدة القياس'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUnit(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Category */}
      {showAddCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Tags className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">إضافة تصنيف أصناف جديد</h3>
            </div>

            {categoryError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {categoryError}
              </div>
            )}

            <form onSubmit={handleAddCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم التصنيف *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أخشاب، كهرباء، سباكة، عدد"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  بادئة الكود الإنجليزي (PREFIX) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: WOD أو ELEC أو PLUMB"
                  value={categoryPrefix}
                  onChange={(e) => setCategoryPrefix(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono dir-ltr text-left"
                />
                <p className="text-[10px] text-slate-400 mt-1">تستخدم لتوليد أكواد الأصناف التلقائية بنمط [PREFIX]-0001</p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isAddingCategory}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isAddingCategory ? 'جارٍ الحفظ...' : 'حفظ التصنيف'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
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
