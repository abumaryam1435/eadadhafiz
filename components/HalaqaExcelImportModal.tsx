import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import { Halaqa, SardHalaqa, Student, User, UserRole } from '../types';

export interface HalaqaImportPreviewItem {
  id: string;
  halaqaName: string;
  teacherName: string;
  teacherIdStr?: string;
  studentName: string;
  studentIdStr?: string;
  status: 'valid' | 'conflict' | 'warning' | 'new';
  warningMessage?: string;
  existingTeacherName?: string;
  existingHalaqaName?: string;
}

interface HalaqaExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'main' | 'sard';
  users: User[];
  halaqas: Halaqa[];
  sardHalaqas: SardHalaqa[];
  students: Student[];
  onConfirmImport: (payload: {
    items: { halaqaName: string; teacherName: string; teacherIdStr?: string; studentName: string; studentIdStr?: string; }[];
    resolveConflictMode: 'overwrite' | 'preserve';
  }) => void;
}

export const HalaqaExcelImportModal: React.FC<HalaqaExcelImportModalProps> = ({
  isOpen,
  onClose,
  type,
  users,
  halaqas,
  sardHalaqas,
  students,
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<HalaqaImportPreviewItem[]>([]);
  const [conflictMode, setConflictMode] = useState<'overwrite' | 'preserve'>('overwrite');
  const [filterStatus, setFilterStatus] = useState<'all' | 'conflicts' | 'valid'>('all');
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isSard = type === 'sard';
  const halaqasKey = isSard ? 'حلقات السرد' : 'الحلقات الرئيسة';

  const teachers = users.filter(u => u.role === UserRole.TEACHER);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];

        if (!rawData || rawData.length === 0) {
          setParseError('الملف المختار فارغ ولا يحتوي على بيانات.');
          return;
        }

        // تحليل الصفوف والكشف عن التعارضات
        const previewItems: HalaqaImportPreviewItem[] = [];

        // خريطة لتتبع تعيينات المعلمين داخل الملف نفسه للكشف عن التناقضات
        const fileHalaqaTeacherMap = new Map<string, string>();

        rawData.forEach((row, idx) => {
          // محاولة قراءة أسماء الأعمدة بمختلف الصيغ الممكنة
          const rawHalaqa = String(
            row['اسم الحلقة'] ||
            row['الحلقة'] ||
            row['اسم حلقة السرد'] ||
            row['حلقة السرد'] ||
            row['اسم الحلقه'] ||
            ''
          ).trim();

          const rawTeacher = String(
            row['اسم المعلم'] ||
            row['المعلم'] ||
            row['معلم السرد'] ||
            row['اسم معلم السرد'] ||
            row['الشيخ'] ||
            ''
          ).trim();

          const rawStudent = String(
            row['اسم الطالب'] ||
            row['الطالب'] ||
            row['اسم طالب السرد'] ||
            row['الطلاب'] ||
            ''
          ).trim();
          const rawTeacherId = String(row['رقم المعلم (ID)'] || row['رقم المعلم'] || row['id المعلم'] || '').trim();
          const rawStudentId = String(row['رقم الطالب (ID)'] || row['رقم الطالب'] || row['id الطالب'] || '').trim();

          if (!rawHalaqa && !rawStudent) {
            // تخطي الصفوف الفارغة بالكامل
            return;
          }

          let status: 'valid' | 'conflict' | 'warning' | 'new' = 'valid';
          const warnings: string[] = [];
          let existingTeacherName: string | undefined;
          let existingHalaqaName: string | undefined;

          // 1. فحص اسم الحلقة
          if (!rawHalaqa) {
            status = 'warning';
            warnings.push('⚠️ اسم الحلقة مفقود');
          } else {
            // التحقق من الحلقة في النظام
            const existingHalaqa = isSard
              ? sardHalaqas.find(h => h.name.trim().toLowerCase() === rawHalaqa.toLowerCase())
              : halaqas.find(h => h.name.trim().toLowerCase() === rawHalaqa.toLowerCase());

            if (existingHalaqa) {
              const currentTeacher = users.find(u => u.id === existingHalaqa.teacherId);
              if (currentTeacher) {
                existingTeacherName = currentTeacher.name;
                if (rawTeacher && currentTeacher.name.trim().toLowerCase() !== rawTeacher.toLowerCase()) {
                  status = 'conflict';
                  warnings.push(`⚠️ تعارض: الحلقة مسندة حالياً للمعلم (${currentTeacher.name}) والملف يحدد (${rawTeacher})`);
                }
              }
            } else {
              // حلقة جديدة
              status = 'new';
            }

            // فحص تناقض المعلم للحلقة نفسها داخل الملف
            if (rawTeacher) {
              const prevTeacherInFile = fileHalaqaTeacherMap.get(rawHalaqa);
              if (prevTeacherInFile && prevTeacherInFile.toLowerCase() !== rawTeacher.toLowerCase()) {
                status = 'conflict';
                warnings.push(`⚠️ تناقض بالملف: تم تعيين معلمين مختلفين (${prevTeacherInFile}) و (${rawTeacher}) لنفس الحلقة`);
              } else {
                fileHalaqaTeacherMap.set(rawHalaqa, rawTeacher);
              }
            }
          }

          // 2. فحص الطالب
          if (rawStudent) {
            const existingStudent = students.find(s => s.name.trim().toLowerCase() === rawStudent.toLowerCase());
            if (existingStudent) {
              if (isSard) {
                if (existingStudent.sardHalaqaId) {
                  const currSardH = sardHalaqas.find(h => h.id === existingStudent.sardHalaqaId);
                  if (currSardH && rawHalaqa && currSardH.name.trim().toLowerCase() !== rawHalaqa.toLowerCase()) {
                    existingHalaqaName = currSardH.name;
                    if (status !== 'conflict') status = 'warning';
                    warnings.push(`ℹ️ الطالب مسجل حالياً في حلقة سرد أخرى (${currSardH.name})`);
                  }
                }
              } else {
                if (existingStudent.halaqaId) {
                  const currMainH = halaqas.find(h => h.id === existingStudent.halaqaId);
                  if (currMainH && rawHalaqa && currMainH.name.trim().toLowerCase() !== rawHalaqa.toLowerCase()) {
                    existingHalaqaName = currMainH.name;
                    if (status !== 'conflict') status = 'warning';
                    warnings.push(`ℹ️ الطالب مسجل حالياً في حلقة رئيسة أخرى (${currMainH.name})`);
                  }
                }
              }
            }
          }

          previewItems.push({
            id: `row-${idx}-${Date.now()}`,
            halaqaName: rawHalaqa,
            teacherName: rawTeacher,
            studentName: rawStudent,
            status,
            warningMessage: warnings.join(' | '),
            existingTeacherName,
            existingHalaqaName,
          });
        });

        if (previewItems.length === 0) {
          setParseError('لم يتم العثور على أي بيانات مطابقة للأعمدة (اسم الحلقة، اسم المعلم، الطالب).');
          return;
        }

        setParsedRows(previewItems);
      } catch (err: any) {
        console.error('Error parsing excel:', err);
        setParseError('حدث خطأ أثناء قراءة ملف الإكسل. يرجى التأكد من سلامة الملف.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const resetModal = () => {
    setFileName('');
    setParsedRows([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleApply = () => {
    if (parsedRows.length === 0) return;

    const validRows = parsedRows
      .filter(r => r.halaqaName || r.studentName)
      .map(r => ({
        halaqaName: r.halaqaName,
        teacherName: r.teacherName,
        studentName: r.studentName,
      }));

    onConfirmImport({
      items: validRows,
      resolveConflictMode: conflictMode,
    });

    resetModal();
    onClose();
  };

  const totalCount = parsedRows.length;
  const conflictCount = parsedRows.filter(r => r.status === 'conflict').length;
  const warningCount = parsedRows.filter(r => r.status === 'warning').length;
  const newCount = parsedRows.filter(r => r.status === 'new').length;

  const filteredPreview = parsedRows.filter(r => {
    if (filterStatus === 'conflicts') return r.status === 'conflict' || r.status === 'warning';
    if (filterStatus === 'valid') return r.status === 'valid' || r.status === 'new';
    return true;
  });

  return (
    <Modal
      title={`استيراد ملف Excel لـ (${halaqasKey})`}
      onClose={() => {
        resetModal();
        onClose();
      }}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6 text-right">
        {/* تعليمات وتنبيهات الأعمدة المطلوبة */}
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
          <div className="flex items-center gap-2 font-black text-emerald-900 dark:text-emerald-200 text-sm mb-1">
            <span>📋</span>
            <span>الأعمدة المطلوبة في ملف الإكسل:</span>
          </div>
          <div className="flex gap-2 flex-wrap text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <span className="bg-white dark:bg-emerald-900/80 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700">1. اسم الحلقة</span>
            <span className="bg-white dark:bg-emerald-900/80 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700">2. اسم المعلم</span>
            <span className="bg-white dark:bg-emerald-900/80 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700">3. اسم الطالب</span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2 font-medium">
            💡 يتم ربط الطالب والمعلم والحلقة تلقائياً مع كافة شاشات ولوحات التقييم والتقارير في التطبيق بكل مرونة وأمان.
          </p>
        </div>

        {/* خطوة اختيار الملف */}
        {parsedRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-3xl bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
              id="halaqa-excel-file-input"
            />
            <label
              htmlFor="halaqa-excel-file-input"
              className="cursor-pointer flex flex-col items-center text-center space-y-3"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 flex items-center justify-center text-3xl shadow-sm">
                📊
              </div>
              <div>
                <p className="text-base font-black text-gray-800 dark:text-gray-200">
                  اضغط هنا لاختيار ملف Excel أو سحبه وإفلاته
                </p>
                <p className="text-xs text-gray-500 font-bold mt-1">
                  يدعم ملفات .xlsx و .xls
                </p>
              </div>
              <span className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md transition-transform active:scale-95">
                تصفح الملفات
              </span>
            </label>

            {parseError && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-200 text-red-800 dark:text-red-200 rounded-xl text-xs font-bold w-full text-center">
                {parseError}
              </div>
            )}
          </div>
        ) : (
          /* شاشة المعاينة والكشف عن التعارضات */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <div>
                  <h4 className="text-sm font-black text-gray-800 dark:text-gray-200">{fileName}</h4>
                  <p className="text-xs text-gray-500 font-bold">
                    إجمالي السجلات: {totalCount} {conflictCount > 0 && `| تعارضات: ${conflictCount}`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetModal}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 rounded-xl text-xs font-bold transition-all"
                >
                  🔄 تغيير الملف
                </button>
              </div>
            </div>

            {/* ملخص الحالة والأزرار السريعة */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`p-2.5 rounded-xl border transition-all ${
                  filterStatus === 'all'
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-transparent'
                }`}
              >
                الكل ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('conflicts')}
                className={`p-2.5 rounded-xl border transition-all ${
                  filterStatus === 'conflicts'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                التعارضات والتنبيهات ({conflictCount + warningCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('valid')}
                className={`p-2.5 rounded-xl border transition-all ${
                  filterStatus === 'valid'
                    ? 'bg-green-700 text-white border-green-800 shadow-sm'
                    : 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
                }`}
              >
                السليمة والجديدة ({totalCount - conflictCount - warningCount})
              </button>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
                جديدة: {newCount}
              </div>
            </div>

            {/* خيارات حل التعارضات */}
            {conflictCount > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-900 dark:text-amber-200">
                  <span>⚙️</span>
                  <span>طريقة معالجة التعارضات عند الاستيراد:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                  <label className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    conflictMode === 'overwrite'
                      ? 'bg-amber-100/80 dark:bg-amber-900/50 border-amber-400 text-amber-950 dark:text-amber-100'
                      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="conflictMode"
                      checked={conflictMode === 'overwrite'}
                      onChange={() => setConflictMode('overwrite')}
                      className="text-amber-600"
                    />
                    <span>اعتماد بيانات الملف وتحديث تعيين المعلم للحلقة</span>
                  </label>
                  <label className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    conflictMode === 'preserve'
                      ? 'bg-amber-100/80 dark:bg-amber-900/50 border-amber-400 text-amber-950 dark:text-amber-100'
                      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="conflictMode"
                      checked={conflictMode === 'preserve'}
                      onChange={() => setConflictMode('preserve')}
                      className="text-amber-600"
                    />
                    <span>الإبقاء على المعلم الحالي للحلقة وتجاهل تغيير المعلم</span>
                  </label>
                </div>
              </div>
            )}

            {/* جدول معاينة السجلات */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-gray-100 dark:bg-gray-700 font-black text-gray-700 dark:text-gray-200 sticky top-0">
                  <tr>
                    <th className="p-2.5">م</th>
                    <th className="p-2.5">اسم الحلقة</th>
                    <th className="p-2.5">اسم المعلم</th>
                    <th className="p-2.5">اسم الطالب</th>
                    <th className="p-2.5">الحالة والتنبيهات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                  {filteredPreview.map((row, i) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 ${
                        row.status === 'conflict'
                          ? 'bg-amber-50/70 dark:bg-amber-950/20'
                          : row.status === 'warning'
                          ? 'bg-yellow-50/50 dark:bg-yellow-950/10'
                          : ''
                      }`}
                    >
                      <td className="p-2.5 font-bold text-gray-400">{i + 1}</td>
                      <td className="p-2.5 font-black text-gray-900 dark:text-gray-100">
                        {row.halaqaName || <span className="text-red-500">غير محدد</span>}
                      </td>
                      <td className="p-2.5 text-gray-700 dark:text-gray-300">
                        {row.teacherName || <span className="text-gray-400">بدون معلم</span>}
                      </td>
                      <td className="p-2.5 text-gray-800 dark:text-gray-200 font-bold">
                        {row.studentName || <span className="text-gray-400">بدون طالب</span>}
                      </td>
                      <td className="p-2.5">
                        {row.warningMessage ? (
                          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            {row.warningMessage}
                          </span>
                        ) : row.status === 'new' ? (
                          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                            ✨ حلقة جديدة
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-green-600 dark:text-green-400">
                            ✓ سليم
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black shadow-lg transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2"
              >
                <span>💾</span>
                <span>تأكيد الاستيراد وربط البيانات ({parsedRows.length} سجل)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  resetModal();
                  onClose();
                }}
                className="px-6 py-3.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 rounded-xl font-bold transition-all text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
