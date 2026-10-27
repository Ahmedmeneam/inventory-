import React, { useState } from 'react';
import { Custody } from '../../types/custody.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  CheckCircle2,
  X,
  Lock,
  Download,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface ValidationError {
  rowNumber: number;
  field: string;
  message: string;
}

interface FoundationalImportModalProps {
  custody: Custody;
  onClose: () => void;
  onSuccess: () => void;
}

export const FoundationalImportModal: React.FC<FoundationalImportModalProps> = ({
  custody,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [fileData, setFileData] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');

  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [commitError, setCommitError] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  // Handle Excel or CSV file upload using xlsx library
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const json = XLSX.utils.sheet_to_json(ws);
        setFileData(json);
        setValidationResult(null);
      } catch (err) {
        alert('تعذر قراءة ملف Excel/CSV. تأكد من سلامة تنسيق الملف.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Parse pasted CSV/TSV text
  const handleParsePasted = () => {
    if (!pasteText.trim()) return;

    try {
      const wb = XLSX.read(pasteText, { type: 'string' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const json = XLSX.utils.sheet_to_json(ws);
      setFileData(json);
      setValidationResult(null);
    } catch {
      alert('تعذر تحليل النص المدخل');
    }
  };

  // Run All-or-Nothing Server Validation
  const handleValidate = async () => {
    if (fileData.length === 0) return;

    setIsValidating(true);
    setValidationResult(null);
    setCommitError('');

    try {
      const res = await fetch(`/api/custodies/${custody.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: fileData }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل فحص الملف');
      }

      setValidationResult(data);
    } catch (err: any) {
      setCommitError(err.message || 'حدث خطأ أثناء فحص البيانات');
    } finally {
      setIsValidating(false);
    }
  };

  // Commit Atomic Foundational Import
  const handleCommit = async () => {
    if (!validationResult?.canImport || !adminPassword) return;

    setIsCommitting(true);
    setCommitError('');

    try {
      const res = await fetch(`/api/custodies/${custody.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validationResult.previewRows || fileData,
          adminPassword,
          adminUserId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشلت عملية الاستيراد التأسيسي');
      }

      onSuccess();
    } catch (err: any) {
      setCommitError(err.message || 'فشل اعتماد الاستيراد التأسيسي');
    } finally {
      setIsCommitting(false);
    }
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const sample = [
      {
        'اسم الصنف': 'لوح خشب زان 2 بوصة',
        'التصنيف': 'أخشاب',
        'وحدة القياس': 'لوح',
        'الكمية الافتتاحية': 150,
        'حد الأمان': 20,
      },
      {
        'اسم الصنف': 'مفصلات أبواب ستانلس',
        'التصنيف': 'إكسسوارات',
        'وحدة القياس': 'طقم',
        'الكمية الافتتاحية': 500,
        'حد الأمان': 50,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب_الاستيراد');
    XLSX.writeFile(wb, `قالب_استيراد_عهدة_${custody.code}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                الاستيراد التأسيسي للعهدة عبر Excel/CSV
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                العهدة: <strong>{custody.name} ({custody.code})</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Rules Banner */}
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>مبدأ الكل أو لا شيء (All-or-Nothing):</strong> إذا احتوى صف واحد على خطأ سيتم رفض كامل الدفعة مع إظهار تقرير بالأخطاء لتصحيحها. تُسجل الكميات الافتتاحية حصرياً في <strong>المخزن الرئيسي للعهدة</strong>، ويُقفل الاستيراد التأسيسي نهائياً بعد إتمامه.
            </div>
          </div>

          {/* Action Tabs: Upload vs Paste */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  mode === 'upload'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                رفع ملف Excel / CSV
              </button>
              <button
                type="button"
                onClick={() => setMode('paste')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  mode === 'paste'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                لصق نص مباشر
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل قالب Excel النموذجي</span>
            </button>
          </div>

          {/* Mode Upload */}
          {mode === 'upload' ? (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center space-y-2 hover:border-indigo-500 transition-colors">
              <Upload className="w-8 h-8 mx-auto text-slate-400" />
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {fileName ? (
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{fileName} ({fileData.length} صف تم قراءته)</span>
                ) : (
                  <span>اختر ملف Excel (.xlsx, .xls) أو ملف CSV</span>
                )}
              </div>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                rows={5}
                placeholder="الصق بيانات الجدول هنا (نسخ من Excel)..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleParsePasted}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                تحليل النص الملصوق
              </button>
            </div>
          )}

          {/* Validate Button */}
          {fileData.length > 0 && !validationResult && (
            <button
              type="button"
              onClick={handleValidate}
              disabled={isValidating}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              {isValidating ? 'جارٍ تدقيق وفحص السطور بمبدأ الكل أو لا شيء...' : `فحص وتدقيق (${fileData.length}) صفاً`}
            </button>
          )}

          {/* Validation Results Report */}
          {validationResult && (
            <div className="space-y-3 pt-2">
              {validationResult.canImport ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>اجتازت جميع الصفوف ({validationResult.validCount} صفاً) الفحص بنجاح بدون أي أخطاء! الملف جاهز للاستيراد التأسيسي الذري.</span>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-300 dark:border-rose-800 space-y-2 text-xs text-rose-800 dark:text-rose-300">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                    <span>تم رفض الدفعة لوجود ({validationResult.errorCount}) أخطاء وفق مبدأ الكل أو لا شيء:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] max-h-36 overflow-y-auto pr-2">
                    {validationResult.errors.map((err: ValidationError, idx: number) => (
                      <li key={idx}>
                        الصف <strong>{err.rowNumber}</strong>: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Commit Section if valid */}
              {validationResult.canImport && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <label className="block text-xs font-bold text-amber-700 dark:text-amber-400">
                    تأكيد كلمة مرور الأدمن لقفل واعتماد الاستيراد التأسيسي *
                  </label>
                  <input
                    type="password"
                    placeholder="كلمة مرور مسؤول النظام"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  {commitError && (
                    <p className="text-xs text-rose-600 font-semibold">{commitError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleCommit}
                    disabled={isCommitting || !adminPassword}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isCommitting ? 'جارٍ الحفظ الذري وتثبيت الأرصدة...' : 'اعتماد الاستيراد وقفل التأسيس نهائياً للعهدة'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
