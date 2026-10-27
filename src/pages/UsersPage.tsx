import React, { useState, useEffect } from 'react';
import { TemporaryCredentialModal } from '../components/auth/TemporaryCredentialModal.tsx';
import { TemporaryCredentials } from '../types/auth.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Users,
  PlusCircle,
  RotateCcw,
  Search,
  Filter,
  ShieldCheck,
  Building,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [custodiesList, setCustodiesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal for new user creation
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'supervisor' | 'storekeeper'>('storekeeper');
  const [custodyId, setCustodyId] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal for re-issuing password
  const [reissueTarget, setReissueTarget] = useState<any | null>(null);
  const [reissueAdminPassword, setReissueAdminPassword] = useState('');
  const [reissueError, setReissueError] = useState('');
  const [isReissuing, setIsReissuing] = useState(false);

  // Active transient credentials modal (120s timer)
  const [activeCredentials, setActiveCredentials] = useState<TemporaryCredentials | null>(null);

  const fetchUsersData = async () => {
    try {
      const [usersRes, custodiesRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/custodies'),
      ]);
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsersList(usersData.users || []);
      }
      if (custodiesRes.ok) {
        const cData = await custodiesRes.json();
        setCustodiesList(cData.custodies || []);
      }
    } catch (err) {
      console.error('Error fetching users data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !adminPassword) return;

    setCreateError('');
    setIsCreating(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          role,
          custodyId: custodyId ? Number(custodyId) : undefined,
          adminPassword,
          adminUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل إنشاء المستخدم');
      }

      setShowCreateUserModal(false);
      setFullName('');
      setAdminPassword('');
      setCustodyId('');
      setActiveCredentials(data.credentials);
      fetchUsersData();
    } catch (err: any) {
      setCreateError(err.message || 'حدث خطأ');
    } finally {
      setIsCreating(false);
    }
  };

  const handleReissueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reissueTarget || !reissueAdminPassword) return;

    setReissueError('');
    setIsReissuing(true);

    try {
      const res = await fetch(`/api/users/${reissueTarget.id}/reissue-temp-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: reissueAdminPassword,
          adminUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشلت إعادة الإصدار');
      }

      setReissueTarget(null);
      setReissueAdminPassword('');
      setActiveCredentials(data.credentials);
      fetchUsersData();
    } catch (err: any) {
      setReissueError(err.message || 'حدث خطأ');
    } finally {
      setIsReissuing(false);
    }
  };

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget || !deleteAdminPassword) return;

    setDeleteError('');
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: deleteAdminPassword,
          adminUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل حذف المستخدم');
      }

      setDeleteTarget(null);
      setDeleteAdminPassword('');
      fetchUsersData();
    } catch (err: any) {
      setDeleteError(err.message || 'حدث خطأ');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.user_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.custody_name && u.custody_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>إدارة الحسابات والأمان</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إنشاء حسابات أمناء العهد ورؤساء الأقسام، تسليم بطاقات الاعتماد المؤقتة، وإعادة الإصدار
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreateUserModal(true);
            setCreateError('');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>إنشاء حساب موظف / مراقب</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="بحث بالاسم، كود المستخدم، أو العهدة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
          >
            <option value="all">جميع الأدوار</option>
            <option value="admin">مسؤول النظام</option>
            <option value="supervisor">رئيس قسم / مراقب</option>
            <option value="storekeeper">أمين عهدة</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">جارٍ تحميل الحسابات...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">
              {usersList.length === 0
                ? 'لا يوجد موظفون مسجلون حالياً (حالة نظيفة فارغة).'
                : 'لا توجد نتائج تطابق معايير البحث.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">كود المستخدم</th>
                  <th className="py-2.5 px-3">الاسم الثلاثي</th>
                  <th className="py-2.5 px-3">الدور الوظيفي</th>
                  <th className="py-2.5 px-3">العهدة المسكن عليها</th>
                  <th className="py-2.5 px-3">رقم الهاتف</th>
                  <th className="py-2.5 px-3">حالة الحساب</th>
                  <th className="py-2.5 px-3 text-center">إجراءات الأمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {u.user_code}
                    </td>
                    <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-medium">
                      {u.full_name}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          u.role === 'admin'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800'
                            : u.role === 'supervisor'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800'
                        }`}
                      >
                        {u.role === 'admin'
                          ? 'مسؤول النظام'
                          : u.role === 'supervisor'
                          ? 'رئيس قسم'
                          : 'أمين عهدة'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {u.custody_name ? (
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.custody_name}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {u.phone || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          u.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {u.status === 'active' ? 'نشط مكتمل' : 'بانتظار أول دخول'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {u.role !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReissueTarget(u);
                              setReissueAdminPassword('');
                              setReissueError('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 hover:bg-amber-100 text-[11px] font-medium cursor-pointer transition-colors"
                            title="إعادة إصدار كلمة مرور مؤقتة وتحديث الهاش"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>إعادة إصدار مؤقتة</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(u);
                            setDeleteAdminPassword('');
                            setDeleteError('');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 text-[11px] font-medium cursor-pointer transition-colors"
                          title="حذف حساب المستخدم"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Employee / Supervisor */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إنشاء حساب موظف جديد
              </h3>
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الاسم ثلاثياً المعتمد *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: محمود علي إبراهيم"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الدور الوظيفي *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="storekeeper">أمين عهدة (مسؤول المخزن الرئيسي والحركات الميدانية)</option>
                  <option value="supervisor">رئيس قسم (مسؤول رقابي واعتماد الطلبات والقواعد)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  العهدة المسكن عليها (اختياري)
                </label>
                <select
                  value={custodyId}
                  onChange={(e) => setCustodyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">بدون تسكين حالياً</option>
                  {custodiesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  تأكيد كلمة مرور الأدمن الحالية (مطلوبة أمنياً للإصدار) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="كلمة مرور الأدمن لتأكيد العملية"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isCreating ? 'جارٍ الإنشاء...' : 'إنشاء وتوليد كلمة المرور'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Re-issue Temporary Password */}
      {reissueTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                إعادة إصدار كلمة مرور مؤقتة
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              سيتم توليد كلمة مرور مؤقتة جديدة للمستخدم <strong>{reissueTarget.full_name} ({reissueTarget.user_code})</strong> وتحديث الهاش، ثم فتح نافذة الـ 120 ثانية لتسليمها.
            </p>

            {reissueError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
                {reissueError}
              </div>
            )}

            <form onSubmit={handleReissueSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تأكيد كلمة مرور الأدمن *
                </label>
                <input
                  type="password"
                  required
                  placeholder="كلمة مرور مسؤول النظام"
                  value={reissueAdminPassword}
                  onChange={(e) => setReissueAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isReissuing}
                  className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors cursor-pointer"
                >
                  {isReissuing ? 'جارٍ إعادة الإصدار...' : 'تأكيد وإعادة الإصدار'}
                </button>
                <button
                  type="button"
                  onClick={() => setReissueTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete User Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                تأكيد حذف حساب المستخدم
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              هل أنت متأكد من حذف الحساب <strong>{deleteTarget.full_name} ({deleteTarget.user_code})</strong>؟
              {deleteTarget.role === 'admin' && (
                <span className="block mt-1 font-bold text-rose-600">
                  تنبيه أمني: يُحظر تماماً حذف آخر حساب مسؤول نظام نشط في النظام!
                </span>
              )}
            </p>

            {deleteError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تأكيد كلمة مرور الأدمن الحالية *
                </label>
                <input
                  type="password"
                  required
                  placeholder="أدخل كلمة مرور الأدمن لتأكيد الحذف..."
                  value={deleteAdminPassword}
                  onChange={(e) => setDeleteAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? 'جارٍ الحذف...' : 'تأكيد الحذف النهائي'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 120-Second Temporary Credential Modal */}
      <TemporaryCredentialModal
        credentials={activeCredentials}
        onClose={() => setActiveCredentials(null)}
      />
    </div>
  );
};
