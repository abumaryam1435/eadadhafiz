import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { Student } from '../types';
import { getMemorizedPagesData, calculateStudentLevel, getCompletedJuzs, normalizeStudentLevel } from '../utils/pageUtils';
import { formatAndCountJuzs, toEnglishDigits, formatRtlRange, toArabicDigits } from '../utils/juzUtils';
import Modal from './Modal';

interface StudentProgressInfoProps {
  student: Student;
  subject?: string;
}

interface PageRangeInput {
  start: string;
  end: string;
}

export const StudentProgressInfo: React.FC<StudentProgressInfoProps> = ({ student, subject }) => {
  const context = useContext(AppContext);
  const { 
    evaluations = [], 
    matns = [], 
    allowTeacherEditOldMemorized = false, 
    updateStudent, 
    showToast 
  } = context || {};

  const pagesData = useMemo(() => getMemorizedPagesData(student, evaluations), [student, evaluations]);
  const studentLevel = normalizeStudentLevel(student.manualStudentLevel || student.manualLevel) || calculateStudentLevel(pagesData.totalCount);
  
  // State for range editing
  const [isEditingRanges, setIsEditingRanges] = useState<boolean>(false);
  const [ranges, setRanges] = useState<PageRangeInput[]>([{ start: '', end: '' }]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [calculatedRangesString, setCalculatedRangesString] = useState<string>('');
  const [calculatedPagesCount, setCalculatedPagesCount] = useState<number>(0);

  // Parse existing student.oldMemorizedPages when student changes or edit mode opens
  const parseCurrentStudentRanges = () => {
    if (!student.oldMemorizedPages) {
      setRanges([{ start: '', end: '' }]);
      return;
    }
    const cleaned = toEnglishDigits(student.oldMemorizedPages.replace(/[\u200E\u200F\u202A-\u202E]/g, ''));
    const parts = cleaned.split(/[,،]/).map(p => p.trim()).filter(Boolean);
    const parsed: PageRangeInput[] = [];

    for (const part of parts) {
      const match = part.split(/[-–—]/).map(x => x.trim());
      if (match.length === 2 && match[0] && match[1]) {
        parsed.push({ start: match[0], end: match[1] });
      } else if (match.length === 1 && match[0]) {
        parsed.push({ start: match[0], end: match[0] });
      }
    }

    setRanges(parsed.length > 0 ? parsed : [{ start: '', end: '' }]);
  };

  useEffect(() => {
    parseCurrentStudentRanges();
    setIsEditingRanges(false);
  }, [student.id, student.oldMemorizedPages]);

  // Handle digit sanitizer (converts Arabic/Hindi digits to standard English 0-9)
  const sanitizeDigitInput = (value: string): string => {
    const englishDigits = toEnglishDigits(value);
    const numbersOnly = englishDigits.replace(/[^\d]/g, '');
    if (!numbersOnly) return '';
    const num = parseInt(numbersOnly, 10);
    if (isNaN(num)) return '';
    // Cap at Quran max page 604
    if (num > 604) return '604';
    return String(num);
  };

  const handleRangeChange = (index: number, field: 'start' | 'end', value: string) => {
    const cleanVal = sanitizeDigitInput(value);
    setRanges(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: cleanVal };
      return next;
    });
  };

  const handleAddRange = () => {
    setRanges(prev => [...prev, { start: '', end: '' }]);
  };

  const handleRemoveRange = (index: number) => {
    setRanges(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ start: '', end: '' }];
    });
  };

  // Build the unified string representation
  const generateCleanStringAndCount = () => {
    const validRanges = ranges
      .filter(r => r.start.trim() !== '' || r.end.trim() !== '')
      .map(r => {
        let s = parseInt(r.start.trim() || r.end.trim(), 10);
        let e = parseInt(r.end.trim() || r.start.trim(), 10);
        if (isNaN(s)) s = e;
        if (isNaN(e)) e = s;
        const start = Math.min(s, e);
        const end = Math.max(s, e);
        return { start, end };
      })
      .filter(r => !isNaN(r.start) && !isNaN(r.end) && r.start >= 1 && r.end <= 604);

    // Merge overlapping or adjacent page ranges
    const pageSet = new Set<number>();
    validRanges.forEach(r => {
      for (let p = r.start; p <= r.end; p++) {
        pageSet.add(p);
      }
    });

    const sortedPages = Array.from(pageSet).sort((a, b) => a - b);
    if (sortedPages.length === 0) {
      return { formattedString: '', totalPages: 0 };
    }

    const segments: string[] = [];
    let curStart = sortedPages[0];
    let curEnd = sortedPages[0];

    for (let i = 1; i < sortedPages.length; i++) {
      if (sortedPages[i] === curEnd + 1) {
        curEnd = sortedPages[i];
      } else {
        segments.push(curStart === curEnd ? `${curStart}` : `${curStart}-${curEnd}`);
        curStart = sortedPages[i];
        curEnd = sortedPages[i];
      }
    }
    segments.push(curStart === curEnd ? `${curStart}` : `${curStart}-${curEnd}`);

    return {
      formattedString: segments.join(', '),
      totalPages: sortedPages.length
    };
  };

  const handleOpenConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { formattedString, totalPages } = generateCleanStringAndCount();
    setCalculatedRangesString(formattedString);
    setCalculatedPagesCount(totalPages);
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!updateStudent) return;
    setIsSaving(true);
    try {
      await updateStudent({
        ...student,
        oldMemorizedPages: calculatedRangesString || undefined,
        updatedAt: Date.now()
      });
      setShowConfirmModal(false);
      setIsEditingRanges(false);
      if (showToast) {
        showToast(`✅ تم تعديل وحفظ المحفوظ القديم للطالب "${student.name}" بنجاح`, 'success');
      }
    } catch (err) {
      console.error("Failed to update student old memorized pages:", err);
      if (showToast) {
        showToast('❌ حدث خطأ أثناء حفظ التعديل', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const mutoonProgress = useMemo(() => {
     if (subject !== 'mutoon') return null;
     const counts: Record<string, number> = {};
     evaluations.forEach(e => {
         if (e.studentId === student.id && e.subject === 'mutoon' && e.evaluationType === 'memorization') {
             if (e.surahs && e.surahs.length > 0 && e.pages) {
                 e.surahs.forEach(matnName => {
                     counts[matnName] = (counts[matnName] || 0) + e.pages!;
                 });
             }
         }
     });
     return counts;
  }, [student.id, evaluations, subject]);

  if (subject === 'mutoon' && mutoonProgress) {
      const mutoonKeys = Object.keys(mutoonProgress);
  
      return (
        <div className="flex flex-col gap-2 mt-2 mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
            <h4 className="font-bold text-xs text-gray-500 dark:text-gray-400 mb-1">معلومات تقدم الطالب في المتون</h4>
            <div className="w-full mt-1 space-y-1.5">
                <div className="bg-blue-100 text-blue-800 p-2.5 rounded-md font-bold dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-xs leading-relaxed break-words whitespace-normal space-y-1.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-blue-200/70 dark:border-blue-800/70">
                        <span className="font-extrabold text-blue-950 dark:text-blue-100">✨ الأبيات المحفوظة</span>
                    </div>
                    {mutoonKeys.length > 0 ? (
                        <ul className="space-y-1 mt-1">
                            {mutoonKeys.map(matnName => {
                                const matn = matns?.find(m => m.name === matnName);
                                const total = matn ? matn.linesCount : '?';
                                return (
                                    <li key={matnName}>
                                        <span className="text-blue-900 dark:text-blue-100 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-4 ml-1">{matnName}:</span>
                                        {mutoonProgress[matnName]} أبيات (من مجموع {total} أبيات)
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div>لا يوجد حفظ متون مسجل حتى الآن.</div>
                    )}
                </div>
            </div>
        </div>
      );
  }

  const oldCompletedJuzs = getCompletedJuzs(pagesData.oldSet);
  const newCompletedJuzs = getCompletedJuzs(pagesData.newSet);
  const oldJuzsFormatted = formatAndCountJuzs(oldCompletedJuzs.map(String));
  const newJuzsFormatted = formatAndCountJuzs(newCompletedJuzs.map(String));

  if (!context) return null;

  return (
    <>
      {/* Confirmation Modal */}
      {showConfirmModal && (
        <Modal
          isOpen={showConfirmModal}
          title="تأكيد تعديل المحفوظ السابق"
          onClose={() => !isSaving && setShowConfirmModal(false)}
          maxWidth="max-w-md"
        >
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800">
              <span className="text-3xl">📖</span>
              <div>
                <h4 className="font-black text-sm sm:text-base text-emerald-950 dark:text-emerald-100">
                  تعديل المحفوظ السابق للطالب: <span className="text-emerald-700 dark:text-emerald-400">{student.name}</span>
                </h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                  يرجى مراجعة وتأكيد النطاقات الجديدة المسجلة
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-slate-700">
                <span className="font-bold text-gray-500 dark:text-gray-400">النطاقات الجديدة:</span>
                <span className="font-black text-emerald-800 dark:text-emerald-300 dir-ltr text-left">
                  {calculatedRangesString ? formatRtlRange(calculatedRangesString) : 'لا يوجد (تفريغ المحفوظ)'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-500 dark:text-gray-400">إجمالي الصفحات:</span>
                <span className="font-black bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-2.5 py-1 rounded-lg">
                  {calculatedPagesCount} صفحة
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-900 dark:text-amber-200 text-xs font-semibold leading-relaxed">
              ⚠️ تنبيه: سيتم تحديث بيانات المحفوظ السابق للطالب فوراً وإعادة احتساب المستوى والأجزاء المكتملة بناءً عليه.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSaving}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-bold rounded-xl transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg hover:shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? 'جاري الحفظ...' : '✅ تأكيد وتعديل'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex flex-col gap-2 mt-2 mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-bold text-xs text-gray-500 dark:text-gray-400">معلومات تقدم الطالب</h4>
            {allowTeacherEditOldMemorized && (
              <button
                type="button"
                onClick={() => {
                  if (!isEditingRanges) {
                    parseCurrentStudentRanges();
                  }
                  setIsEditingRanges(!isEditingRanges);
                }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  isEditingRanges 
                    ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200' 
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 hover:bg-emerald-200 border border-emerald-300 dark:border-emerald-700'
                }`}
              >
                <span>{isEditingRanges ? '✖ إخفاء التعديل' : '✏️ تعديل المحفوظ القديم'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-md font-bold dark:bg-indigo-900/50 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                  المستوى: {studentLevel}
              </span>
              <div className="w-full mt-1 space-y-1.5">
                  {/* صندوق المحفوظ القديم */}
                  <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-md font-bold dark:bg-emerald-900/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs leading-relaxed break-words whitespace-normal space-y-1.5">
                      <div className="flex items-center justify-between pb-1 border-b border-emerald-200/70 dark:border-emerald-800/70">
                          <span className="font-extrabold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
                            <span>📖</span>
                            <span>الحفظ القديم</span>
                          </span>
                          {allowTeacherEditOldMemorized && !isEditingRanges && (
                            <button
                              type="button"
                              onClick={() => {
                                parseCurrentStudentRanges();
                                setIsEditingRanges(true);
                              }}
                              className="text-[10px] bg-emerald-200/70 hover:bg-emerald-200 dark:bg-emerald-800/50 dark:hover:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-2 py-0.5 rounded font-bold transition-all"
                            >
                              تعديل النطاقات
                            </button>
                          )}
                      </div>

                      {/* عرض الصفحات الحالية */}
                      <div>
                          <span className="text-emerald-900 dark:text-emerald-100 underline decoration-emerald-300 dark:decoration-emerald-700 underline-offset-4 ml-1">الصفحات:</span>
                          <span className="font-extrabold">{pagesData.oldStr}</span>
                      </div>
                      {oldCompletedJuzs.length > 0 && (
                          <div>
                              <span className="text-emerald-900 dark:text-emerald-100 underline decoration-emerald-300 dark:decoration-emerald-700 underline-offset-4 ml-1">الأجزاء المكتملة:</span>
                              {oldJuzsFormatted.formatted} (العدد: {oldJuzsFormatted.count})
                          </div>
                      )}

                      {/* محرر النطاقات عند تفعيله من المشرف وفتحه */}
                      {allowTeacherEditOldMemorized && isEditingRanges && (
                        <div className="mt-3 pt-2.5 border-t-2 border-emerald-300/80 dark:border-emerald-700/80 bg-emerald-50/70 dark:bg-emerald-950/40 p-3 rounded-xl space-y-2.5 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs text-emerald-950 dark:text-emerald-100 flex items-center gap-1">
                              <span>🔢</span>
                              <span>كتابة نطاقات المحفوظ السابق (أرقام الصفحات 1 - 604):</span>
                            </span>
                          </div>

                          {/* قائمة النطاقات */}
                          <div className="space-y-2">
                            {ranges.map((range, index) => (
                              <div key={index} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-emerald-200 dark:border-emerald-700 shadow-sm">
                                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 min-w-[55px]">
                                  النطاق {index + 1}:
                                </span>
                                
                                <div className="flex-1 flex items-center gap-1.5">
                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={range.start}
                                      onChange={(e) => handleRangeChange(index, 'start', e.target.value)}
                                      placeholder="بداية (من)"
                                      className="w-full text-center px-2 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                                    />
                                  </div>
                                  <span className="text-gray-400 font-bold text-xs">إلى</span>
                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={range.end}
                                      onChange={(e) => handleRangeChange(index, 'end', e.target.value)}
                                      placeholder="نهاية (إلى)"
                                      className="w-full text-center px-2 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                                    />
                                  </div>
                                </div>

                                {ranges.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRange(index)}
                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                    title="حذف هذا النطاق"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* زر إضافة نطاق آخر وأزرار الحفظ والإلغاء */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleAddRange}
                              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                            >
                              <span>➕</span>
                              <span>إضافة نطاق آخر</span>
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  parseCurrentStudentRanges();
                                  setIsEditingRanges(false);
                                }}
                                className="px-3 py-1.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 rounded-lg text-xs font-bold transition-all"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                onClick={handleOpenConfirm}
                                className="flex-1 sm:flex-none px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
                              >
                                <span>💾</span>
                                <span>حفظ التعديل</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>

                  {/* صندوق الحفظ الجديد */}
                  <div className="bg-blue-100 text-blue-800 p-2.5 rounded-md font-bold dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-xs leading-relaxed break-words whitespace-normal space-y-1.5">
                      <div className="flex items-center gap-1.5 pb-1 border-b border-blue-200/70 dark:border-blue-800/70">
                          <span className="font-extrabold text-blue-950 dark:text-blue-100">✨ الحفظ الجديد</span>
                      </div>
                      <div>
                          <span className="text-blue-900 dark:text-blue-100 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-4 ml-1">الصفحات:</span>
                          {pagesData.newStr}
                      </div>
                      {newCompletedJuzs.length > 0 && (
                          <div>
                              <span className="text-blue-900 dark:text-blue-100 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-4 ml-1">الأجزاء المكتملة:</span>
                              {newJuzsFormatted.formatted} (العدد: {newJuzsFormatted.count})
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
    </>
  );
};
