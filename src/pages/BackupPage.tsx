import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Database,
  Shield,
  Download,
  Upload,
  RefreshCw,
  HardDrive,
  FileCheck2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  KeyRound,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const BackupPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'audit'>('backup');

  // Stats & Health
  const [stats, setStats] = useState<any>(null);
  const [localBackups, setLocalBackups] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Local snapshot modal
  const [showLocalModal, setShowLocalModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isCreatingLocal, setIsCreatingLocal] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  // Encrypted export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [exportAdminPassword, setExportAdminPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showMasterPwd, setShowMasterPwd] = useState(false);

  // Restore states
  const [restoreSource, setRestoreSource] = useState<'upload' | 'local'>('upload');
  const [selectedLocalFile, setSelectedLocalFile] = useState('');
  const [restoreAdminPassword, setRestoreAdminPassword] = useState('');
  const [restoreMasterPassword, setRestoreMasterPassword] = useState('');
  const [uploadedEncContent, setUploadedEncContent] = useState('');
  const [uploadedFilename, setUploadedFilename] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState('');

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState('');

  // Fetch stats and local backups
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const [resStats, resList] = await Promise.all([
        fetch('/api/backup/stats'),
        fetch('/api/backup/local-list'),
      ]);

      if (resStats.ok) {
        const data = await resStats.json();
        setStats(data.stats);
      }
      if (resList.ok) {
        const data = await resList.json();
        setLocalBackups(data.backups || []);
      }
    } catch (err) {
      console.error('Failed to load backup stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = async (action = '') => {
    try {
      setLoadingAudit(true);
      const url = action
        ? `/api/backup/audit-logs?action=${encodeURIComponent(action)}`
        : '/api/backup/audit-logs';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs(auditFilter);
    }
  }, [activeTab, auditFilter]);

  // Handle local backup creation
  const handleCreateLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) {
      setLocalError('يرجى إدخال كلمة مرور مسؤول النظام للتأكيد');
      return;
    }

    setIsCreatingLocal(true);
    setLocalError('');
    setLocalSuccess('');

    try {
      const res = await fetch('/api/backup/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword,
          adminUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إنشاء النسخة الاحتياطية');
      }

      setLocalSuccess(`تم بنجاح حفظ النسخة المحلية: ${data.backup.filename}`);
      setAdminPassword('');
      setTimeout(() => {
        setShowLocalModal(false);
        setLocalSuccess('');
        fetchStats();
      }, 2000);
    } catch (err: any) {
      setLocalError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsCreatingLocal(false);
    }
  };

  // Handle encrypted export
  const handleExportEncrypted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportAdminPassword) {
      setExportError('يرجى إدخال كلمة مرور مسؤول النظام للتأكيد');
      return;
    }
    if (!masterPassword || masterPassword.length < 8) {
      setExportError('كلمة المرور الرئيسية للتشفير يجب ألا تقل عن 8 خانات');
      return;
    }
    if (masterPassword !== confirmMasterPassword) {
      setExportError('كلمتا المرور للتشفير غير متطابقتين');
      return;
    }

    setIsExporting(true);
    setExportError('');

    try {
      const res = await fetch('/api/backup/export-encrypted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: exportAdminPassword,
          masterPassword,
          adminUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تصدير النسخة المشفرة');
      }

      // Download file to client
      const blob = new Blob([data.content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowExportModal(false);
      setExportAdminPassword('');
      setMasterPassword('');
      setConfirmMasterPassword('');
      fetchStats();
    } catch (err: any) {
      setExportError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle file select for restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFilename(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setUploadedEncContent(text);
    };
    reader.readAsText(file);
  };

  // Handle restore execution
  const handleRestoreExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreAdminPassword) {
      setRestoreError('يرجى إدخال كلمة مرور مسؤول النظام للتأكيد الأمني');
      return;
    }

    if (restoreSource === 'upload' && !uploadedEncContent) {
      setRestoreError('يرجى اختيار ملف النسخة الاحتياطية المشفرة (.enc) أولاً');
      return;
    }

    if (restoreSource === 'local' && !selectedLocalFile) {
      setRestoreError('يرجى اختيار ملف النسخة المحلية من القائمة');
      return;
    }

    const isEncrypted = restoreSource === 'upload' || selectedLocalFile.endsWith('.enc');
    if (isEncrypted && !restoreMasterPassword) {
      setRestoreError('يرجى إدخال كلمة المرور الرئيسية لفك التشفير');
      return;
    }

    const confirmMsg =
      'تحذير أمني حرج: استعادة النسخة الاحتياطية ستستبدل قاعدة البيانات الحالية بالكامل بالبيانات المستعادة! هل أنت متأكد تماماً من المتابعة؟';
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsRestoring(true);
    setRestoreError('');
    setRestoreSuccess('');

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: restoreAdminPassword,
          masterPassword: restoreMasterPassword || undefined,
          encryptedContent: restoreSource === 'upload' ? uploadedEncContent : undefined,
          localFilename: restoreSource === 'local' ? selectedLocalFile : undefined,
          adminUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشلت عملية الاستعادة');
      }

      setRestoreSuccess('تمت استعادة قاعدة البيانات والتحقق من سلامتها بنجاح! يرجى إعادة تحميل الصفحة.');
      setRestoreAdminPassword('');
      setRestoreMasterPassword('');
      setUploadedEncContent('');
      setUploadedFilename('');
      fetchStats();
    } catch (err: any) {
      setRestoreError(err.message || 'حدث خطأ أثناء الاستعادة');
    } finally {
      setIsRestoring(false);
    }
  };

  // Export audit log to Excel
  const handleExportAuditExcel = () => {
    if (!auditLogs.length) return;

    const rows = auditLogs.map((log) => ({
      'المعرف': log.id,
      'التاريخ والوقت': new Date(log.createdAt).toLocaleString('ar-EG'),
      'كود المستخدم': log.userCode || 'غير محدد',
      'نوع الإجراء': log.action,
      'عنوان IP': log.ipAddress || '127.0.0.1',
      'التفاصيل': log.details,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit_Trail');
    XLSX.writeFile(wb, `Audit_Trail_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 بايت';
    const k = 1024;
    const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              النسخ الاحتياطي المشفر والاستعادة والرقابة
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            إدارة النسخ الاحتياطية المحلية المشفرة، حماية مسار البيانات، والاستعادة المشروطة وفق الإصدار 6.7.
          </p>
        </div>

        {/* Tabs switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>النسخ الاحتياطي والتصدير</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('restore')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              activeTab === 'restore'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>الاستعادة المشروطة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>سجل الرقابة (Audit Trail)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BACKUP & ENCRYPTED EXPORT */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* System Health Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>حجم قاعدة البيانات</span>
                <Database className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats ? formatBytes(stats.dbSizeBytes) : '...'}
              </div>
              <div className="text-[11px] text-slate-400">
                ملف WAL: {stats ? formatBytes(stats.walSizeBytes) : '...'}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>نمط التشغيل والأمان</span>
                <Shield className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>WAL Mode + Foreign Keys ON</span>
              </div>
              <div className="text-[11px] text-slate-400">
                مهلة الانتظار: 5000ms • حماية المعاملات
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>إجمالي السجلات المؤكدة</span>
                <Layers className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                {stats
                  ? stats.records.items +
                    stats.records.custodies +
                    stats.records.movements +
                    stats.records.users
                  : '...'}
              </div>
              <div className="text-[11px] text-slate-400">
                {stats?.records.movements || 0} حركة • {stats?.records.items || 0} صنف
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>آخر نسخة احتياطية</span>
                <Clock className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={stats?.lastBackup?.name}>
                {stats?.lastBackup ? stats.lastBackup.name : 'لا توجد نسخ سابقة'}
              </div>
              <div className="text-[11px] text-slate-400">
                {stats?.lastBackup
                  ? new Date(stats.lastBackup.date).toLocaleString('ar-EG')
                  : 'جاهز لأول نسخة'}
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Action 1: Local Backup */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    إنشاء نسخة احتياطية محلية (Local Snapshot)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    أخذ لقطة ذرية لقاعدة البيانات الحالية وحفظها في مسار التخزين الداخلي بالخادم.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>تعتمد واجهة SQLite Online Backup API لضمان اتساق المعاملات.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>لا تتطلب إيقاف الخادم أو قطع الاتصال عن المستخدمين.</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLocalError('');
                  setLocalSuccess('');
                  setShowLocalModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm hover:shadow-indigo-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Database className="w-4 h-4" />
                <span>بدء إنشاء نسخة محلية جديدة</span>
              </button>
            </div>

            {/* Action 2: Encrypted USB Export */}
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    تصدير نسخة مشفرة للـ USB والوسائط الخارجية
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    توليد ملف حزمة مشفرة عسكرية AES-256-GCM بكلمة مرور رئيسية لحفظها خارجياً.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>تشفير AES-256-GCM + اشتقاق المفتاح بخوارزمية Scrypt و Salt عشوائي.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>بصمة تحقق SHA-256 Checksum مدمجة لمنع أي تلاعب أو تلف.</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setExportError('');
                  setShowExportModal(true);
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm hover:shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>تشفير وتنزيل ملف النسخة (.enc)</span>
              </button>
            </div>
          </div>

          {/* Local Backups Repository Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  أرشيف النسخ الاحتياطية المتوفرة على الخادم
                </h3>
              </div>
              <button
                type="button"
                onClick={fetchStats}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="تحديث القائمة"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {localBackups.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                لا توجد نسخ احتياطية محفوظة حالياً في مسار الخادم. يمكنك إنشاء نسخة محلية الآن عبر الزر أعلاه.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">اسم الملف</th>
                      <th className="py-3 px-4">النوع والتشفير</th>
                      <th className="py-3 px-4">الحجم</th>
                      <th className="py-3 px-4">تاريخ الإنشاء</th>
                      <th className="py-3 px-4 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {localBackups.map((bk, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                          {bk.filename}
                        </td>
                        <td className="py-3 px-4">
                          {bk.isEncrypted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-medium text-[11px]">
                              <Lock className="w-3 h-3" />
                              <span>حزمة مشفرة (AES-256)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-medium text-[11px]">
                              <Database className="w-3 h-3" />
                              <span>قاعدة بيانات SQLite مباشرة</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {formatBytes(bk.sizeBytes)}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(bk.createdAt).toLocaleString('ar-EG')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLocalFile(bk.filename);
                              setRestoreSource('local');
                              setActiveTab('restore');
                            }}
                            className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-700 dark:text-slate-300 font-semibold transition-colors cursor-pointer"
                          >
                            اختيار للاستعادة
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

      {/* TAB 2: CONDITIONAL RESTORE */}
      {activeTab === 'restore' && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Critical Security Warning Callout */}
          <div className="p-5 bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-300 dark:border-rose-900/60 rounded-3xl space-y-3">
            <div className="flex items-center gap-3 text-rose-700 dark:text-rose-400 font-bold text-sm">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <span>تحذير أمني واستعادة مشروطة حازمة (Disaster Recovery Protocol)</span>
            </div>
            <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
              عملية الاستعادة هي إجراء استثنائي يؤدي إلى <strong>استبدال قاعدة البيانات الحالية بالكامل</strong> بمحتويات النسخة المستعادة.
              يتم إجراء اختبار سلامة SQLite وفحص التشفير وبصمة SHA-256 قبل الكتابة. تتطلب العملية إدخال كلمة مرور مسؤول النظام الحالية لتأكيد الصلاحية.
            </p>
          </div>

          <form
            onSubmit={handleRestoreExecute}
            className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-rose-500" />
              <span>بيانات ومعاملات الاستعادة</span>
            </h3>

            {restoreError && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}

            {restoreSuccess && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{restoreSuccess}</span>
              </div>
            )}

            {/* Restore Source Toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                مصدر ملف النسخة الاحتياطية
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRestoreSource('upload')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    restoreSource === 'upload'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  رفع ملف خارجي (.enc)
                </button>
                <button
                  type="button"
                  onClick={() => setRestoreSource('local')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    restoreSource === 'local'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  اختيار من النسخ المحلية بالخادم
                </button>
              </div>
            </div>

            {/* Source 1: File Upload */}
            {restoreSource === 'upload' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ملف النسخة الاحتياطية المشفرة
                </label>
                <div className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <input
                    type="file"
                    accept=".enc,.db,.json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="backupFileInput"
                  />
                  <label htmlFor="backupFileInput" className="cursor-pointer block space-y-1.5">
                    <Upload className="w-8 h-8 mx-auto text-indigo-500" />
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {uploadedFilename ? uploadedFilename : 'انقر لاختيار ملف النسخة (.enc)'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      يدعم الحزم المشفرة بتنسيق نظام الإصدار 6.7
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Source 2: Select Local */}
            {restoreSource === 'local' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  اختر النسخة المحلية المحفوظة
                </label>
                <select
                  value={selectedLocalFile}
                  onChange={(e) => setSelectedLocalFile(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- حدد ملف النسخة المحلية --</option>
                  {localBackups.map((bk, i) => (
                    <option key={i} value={bk.filename}>
                      {bk.filename} ({formatBytes(bk.sizeBytes)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Master decryption password */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                كلمة المرور الرئيسية لفك التشفير (Master Key)
              </label>
              <input
                type="password"
                value={restoreMasterPassword}
                onChange={(e) => setRestoreMasterPassword(e.target.value)}
                placeholder="أدخل كلمة المرور التي تم استخدامها أثناء تصدير النسخة..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400">
                مطلوبة لفك تشفير حزمة AES-256 والتحقق من بصمة التشفير.
              </p>
            </div>

            {/* Admin Password confirmation */}
            <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-rose-700 dark:text-rose-400">
                تأكيد كلمة مرور مسؤول النظام الحالي (Admin) الإلزامية
              </label>
              <input
                type="password"
                value={restoreAdminPassword}
                onChange={(e) => setRestoreAdminPassword(e.target.value)}
                placeholder="أدخل كلمة مرور حسابك الحالية للتفويض بالاستعادة..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 text-slate-900 dark:text-white placeholder-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <button
              type="submit"
              disabled={isRestoring}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md hover:shadow-rose-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isRestoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ التحقق وفك التشفير واستعادة قاعدة البيانات...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>تنفيذ الاستعادة المشروطة واستبدال البيانات</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  سجل العمليات والرقابة غير القابل للتعديل (Audit Trail)
                </h3>
                <p className="text-[11px] text-slate-500">
                  توثيق شامل للهوية الزمنية وتفاصيل الإجراءات وفق توقيت الخادم المحلي.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="">جميع العمليات</option>
                <option value="USER_LOGIN">تسجيل الدخول</option>
                <option value="USER_CREATED">إنشاء مستخدم</option>
                <option value="USER_DELETED">حذف مستخدم</option>
                <option value="BACKUP_LOCAL_CREATED">نسخ محلي</option>
                <option value="BACKUP_ENCRYPTED_EXPORTED">تصدير مشفر</option>
                <option value="DATABASE_RESTORED">استعادة قاعدة بيانات</option>
              </select>

              <button
                type="button"
                onClick={handleExportAuditExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>تصدير Excel</span>
              </button>
            </div>
          </div>

          {loadingAudit ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span>جارٍ تحميل سجلات التدقيق والرقابة...</span>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              لا توجد سجلات تدقيق مطابقة للشروط المحددة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">التاريخ والوقت</th>
                    <th className="py-3 px-4">المستخدم</th>
                    <th className="py-3 px-4">نوع الإجراء</th>
                    <th className="py-3 px-4">عنوان IP</th>
                    <th className="py-3 px-4">تفاصيل العملية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('ar-EG')}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {log.userCode || 'System'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: LOCAL SNAPSHOT */}
      {showLocalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تأكيد إنشاء نسخة احتياطية محلية
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              سيقوم النظام بأخذ لقطة ذرية فورية لقاعدة البيانات وحفظها في مجلد النسخ الاحتياطية المحلي مع تحديث سجل الرقابة.
            </p>

            {localError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-400">
                {localError}
              </div>
            )}

            {localSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-400">
                {localSuccess}
              </div>
            )}

            <form onSubmit={handleCreateLocal} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  كلمة مرور مسؤول النظام الحالية للتأكيد
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور الأدمن..."
                  autoFocus
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isCreatingLocal}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isCreatingLocal ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                  <span>تأكيد الإنشاء</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocalModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENCRYPTED USB EXPORT */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تصدير نسخة مشفرة بكلمة مرور رئيسية
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              سيتم تشفير كامل قاعدة البيانات بخوارزمية AES-256-GCM. احفظ كلمة المرور الرئيسية في مكان آمن؛ فلن يمكن استعادة الملف بدونها!
            </p>

            {exportError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-400">
                {exportError}
              </div>
            )}

            <form onSubmit={handleExportEncrypted} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  كلمة المرور الرئيسية لتشفير الملف (Master Key)
                </label>
                <div className="relative">
                  <input
                    type={showMasterPwd ? 'text' : 'password'}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="8 خانات على الأقل..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-3.5 pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPwd(!showMasterPwd)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showMasterPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  تأكيد كلمة المرور الرئيسية
                </label>
                <input
                  type={showMasterPwd ? 'text' : 'password'}
                  value={confirmMasterPassword}
                  onChange={(e) => setConfirmMasterPassword(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور للتأكيد..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  تأكيد كلمة مرور مسؤول النظام الحالية (Admin)
                </label>
                <input
                  type="password"
                  value={exportAdminPassword}
                  onChange={(e) => setExportAdminPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور الأدمن الحالية..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isExporting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>تشفير وتنزيل الملف</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold transition-colors cursor-pointer"
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
