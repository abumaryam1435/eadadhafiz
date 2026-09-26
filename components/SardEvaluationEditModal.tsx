import React, { useState, useContext, useMemo } from 'react';
import Modal from './Modal';
import { SardEvaluation, Student, SardHalaqa, SardPageRange } from '../types';
import { calculateSardTotalErrors, calculateSardGrade, getSardGradeBadgeClass } from '../utils/sardUtils';
import { AppContext } from '../App';
import { getMemorizedPagesData, getCompletedJuzs, countQuranPages } from '../utils/pageUtils';
import { surahNames, surahPagesMap, juzPagesMap } from '../utils/quranData';
import { toArabicDigits } from '../utils/exportWord';
import { parseSafeNumber, safeInputNumber, safeNumberVal } from '../utils/juzUtils';
import { isSmartMatch } from '../utils/searchUtils';
import { StudentProgressInfo } from './StudentProgressInfo';
import { MushafReaderModal } from './MushafReaderModal';
import { preloadMushafPages } from '../utils/mushafPreload';

interface SardEvaluationEditModalProps {
  evaluation: SardEvaluation;
  student: Student;
  sardHalaqa?: SardHalaqa;
  onClose: () => void;
  onSave: (updated: SardEvaluation) => void;
  onDelete: (id: number) => void;
}

export const SardEvaluationEditModal: React.FC<SardEvaluationEditModalProps> = ({
  evaluation,
  student,
  sardHalaqa,
  onClose,
  onSave,
  onDelete,
}) => {
  const context = useContext(AppContext);
  const [date, setDate] = useState(evaluation.date || new Date().toISOString().split('T')[0]);
  const [isMushafModalOpen, setIsMushafModalOpen] = useState(false);
  
  // Initial mode determination
  const initialMode = useMemo<'juz' | 'surahs' | 'pages'>(() => {
    if (evaluation.surahs && evaluation.surahs.length > 0) return 'surahs';
    if (evaluation.pageRanges && evaluation.pageRanges.length > 0) return 'pages';
    if (evaluation.juzList && evaluation.juzList.length > 0) return 'juz';
    return 'juz';
  }, [evaluation]);

  const [selectionMode, setSelectionMode] = useState<'juz' | 'surahs' | 'pages'>(initialMode);
  const [selectedJuzList, setSelectedJuzList] = useState<number[]>(evaluation.juzList || []);
  
  // Surahs
  const [selectedSurahNames, setSelectedSurahNames] = useState<string[]>(evaluation.surahs || []);
  const [surahSearch, setSurahSearch] = useState('');

  // Page ranges
  const initialRanges = evaluation.pageRanges && evaluation.pageRanges.length > 0
    ? evaluation.pageRanges.map(r => ({ fromPage: r.fromPage as number | '', toPage: r.toPage as number | '' }))
    : [{ fromPage: '' as number | '', toPage: '' as number | '' }];
  const [pageRanges, setPageRanges] = useState<{ fromPage: number | ''; toPage: number | '' }[]>(initialRanges);

  const addPageRange = () => {
    setPageRanges(prev => [...prev, { fromPage: '', toPage: '' }]);
  };

  const removePageRange = (index: number) => {
    setPageRanges(prev => {
      if (prev.length <= 1) return [{ fromPage: '', toPage: '' }];
      return prev.filter((_, i) => i !== index);
    });
  };

  const updatePageRange = (index: number, field: 'fromPage' | 'toPage', value: number | '') => {
    setPageRanges(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Errors
  const [hesitationErrors, setHesitationErrors] = useState(Number(evaluation.hesitationErrors) || 0);
  const [fathErrors, setFathErrors] = useState(Number(evaluation.fathErrors) || 0);
  const [tajweedErrors, setTajweedErrors] = useState(Number(evaluation.tajweedErrors) || 0);
  const [notes, setNotes] = useState(evaluation.notes || '');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Student memorization data
  const studentPagesData = useMemo(() => {
    return getMemorizedPagesData(student, context?.evaluations || []);
  }, [student, context?.evaluations]);

  const studentCompletedJuzs = useMemo(() => {
    if (!studentPagesData) return [];
    return getCompletedJuzs(studentPagesData.totalSet);
  }, [studentPagesData]);

  const studentCompletedSurahs = useMemo(() => {
    if (!studentPagesData) return [];
    const list: { id: number; name: string; pagesCount: number }[] = [];
    for (let sId = 1; sId <= 114; sId++) {
      const pList = surahPagesMap[sId] || [];
      if (pList.length > 0 && pList.every(p => studentPagesData.totalSet.has(p))) {
        list.push({
          id: sId,
          name: surahNames[sId],
          pagesCount: pList.length,
        });
      }
    }
    return list;
  }, [studentPagesData]);

  const filteredSurahs = useMemo(() => {
    if (!surahSearch) return studentCompletedSurahs;
    return studentCompletedSurahs.filter(s => isSmartMatch(s.name, surahSearch));
  }, [studentCompletedSurahs, surahSearch]);

  const multiRangeAnalysis = useMemo(() => {
    if (!pageRanges || pageRanges.length === 0) {
      return {
        isValid: false,
        totalCount: 0,
        hasEmptyRanges: true,
        hasPartialRanges: false,
        allUnmemorizedPages: [] as number[],
        rangeAnalyses: [] as { isValid: boolean; isEmpty: boolean; isPartial: boolean; count: number; unmemorized: number[]; message: string }[],
        summaryMessage: 'يرجى إدخال نطاق صفحات واحد على الأقل',
        allUniquePages: [] as number[],
      };
    }

    const allUnmemorizedSet = new Set<number>();
    const allUniquePagesSet = new Set<number>();
    let hasPartial = false;
    let hasEmpty = false;
    let allRangesValid = true;

    const rangeAnalyses = pageRanges.map((range) => {
      const { fromPage, toPage } = range;
      if (fromPage === '' && toPage === '') {
        hasEmpty = true;
        allRangesValid = false;
        return {
          isValid: false,
          isEmpty: true,
          isPartial: false,
          count: 0,
          unmemorized: [] as number[],
          message: 'نطاق فارغ',
        };
      }
      if (fromPage === '' || toPage === '') {
        hasPartial = true;
        allRangesValid = false;
        return {
          isValid: false,
          isEmpty: false,
          isPartial: true,
          count: 0,
          unmemorized: [] as number[],
          message: 'يرجى إكمال رقمي البداية والنهاية',
        };
      }

      const start = Number(fromPage);
      const end = Number(toPage);

      if (isNaN(start) || isNaN(end) || start < 1 || end > 604) {
        allRangesValid = false;
        return {
          isValid: false,
          isEmpty: false,
          isPartial: false,
          count: 0,
          unmemorized: [] as number[],
          message: 'أرقام الصفحات يجب أن تكون بين 1 و 604',
        };
      }

      if (start > end) {
        allRangesValid = false;
        return {
          isValid: false,
          isEmpty: false,
          isPartial: false,
          count: 0,
          unmemorized: [] as number[],
          message: 'صفحة البداية أكبر من صفحة النهاية',
        };
      }

      const unmemorized: number[] = [];
      for (let p = start; p <= end; p++) {
        allUniquePagesSet.add(p);
        if (!studentPagesData?.totalSet.has(p)) {
          unmemorized.push(p);
          allUnmemorizedSet.add(p);
        }
      }

      if (unmemorized.length > 0) {
        allRangesValid = false;
        return {
          isValid: false,
          isEmpty: false,
          isPartial: false,
          count: end - start + 1,
          unmemorized,
          message: `يحتوي على (${unmemorized.length}) صفحة غير محفوظة: ${unmemorized.slice(0, 5).map(toArabicDigits).join('، ')}${unmemorized.length > 5 ? '...' : ''}`,
        };
      }

      return {
        isValid: true,
        isEmpty: false,
        isPartial: false,
        count: end - start + 1,
        unmemorized: [] as number[],
        message: `محفوظ بالكامل (${end - start + 1} صفحة)`,
      };
    });

    const allUnmemorizedList = Array.from(allUnmemorizedSet).sort((a, b) => a - b);
    const hasAtLeastOneFilledRange = pageRanges.some(r => r.fromPage !== '' && r.toPage !== '');
    const isValid = allRangesValid && !hasPartial && hasAtLeastOneFilledRange;

    const countedPages = countQuranPages(allUniquePagesSet);
    let summaryMessage = '';
    if (allUnmemorizedList.length > 0) {
      summaryMessage = `⚠️ تنبيه: توجد صفحات ضمن النطاقات المحددة ليست ضمن محفوظ الطالب (القديم أو الجديد): ${allUnmemorizedList.slice(0, 8).map(toArabicDigits).join('، ')}${allUnmemorizedList.length > 8 ? '...' : ''} (لا يمكن سرد صفحات غير محفوظة)`;
    } else if (hasPartial) {
      summaryMessage = '⚠️ يرجى إكمال إدخال بداية ونهاية كل نطاق محدد';
    } else if (!hasAtLeastOneFilledRange) {
      summaryMessage = 'يرجى إدخال أرقام صفحات البداية والنهاية';
    } else if (!isValid) {
      summaryMessage = '⚠️ يرجى تصحيح أرقام النطاقات للمتابعة';
    } else {
      summaryMessage = `✅ جميع النطاقات محفوظة بالكامل (${toArabicDigits(countedPages)} صفحة)`;
    }

    return {
      isValid,
      totalCount: countedPages,
      hasEmptyRanges: hasEmpty,
      hasPartialRanges: hasPartial,
      allUnmemorizedPages: allUnmemorizedList,
      rangeAnalyses,
      summaryMessage,
      allUniquePages: Array.from(allUniquePagesSet).sort((a, b) => a - b),
    };
  }, [pageRanges, studentPagesData]);

  // حساب كافة الصفحات المحددة للسرد لتصفحها في المصحف
  const activePages = useMemo(() => {
    const pageSet = new Set<number>();
    if (selectionMode === 'juz') {
      selectedJuzList.forEach(j => {
        (juzPagesMap[j] || []).forEach(p => pageSet.add(p));
      });
    } else if (selectionMode === 'surahs') {
      selectedSurahNames.forEach(name => {
        const sEntry = Object.entries(surahNames).find(([_, n]) => n === name);
        if (sEntry) {
          const sId = Number(sEntry[0]);
          (surahPagesMap[sId] || []).forEach(p => pageSet.add(p));
        }
      });
    } else if (selectionMode === 'pages') {
      pageRanges.forEach(range => {
        if (range.fromPage !== '' && range.toPage !== '') {
          const start = Math.min(Number(range.fromPage), Number(range.toPage));
          const end = Math.max(Number(range.fromPage), Number(range.toPage));
          for (let p = start; p <= end; p++) {
            pageSet.add(p);
          }
        }
      });
    }
    return Array.from(pageSet).sort((a, b) => a - b);
  }, [selectionMode, selectedJuzList, selectedSurahNames, pageRanges]);

  // التحميل المسبق لصفحات السرد في الخلفية
  React.useEffect(() => {
    if (activePages && activePages.length > 0) {
      preloadMushafPages(activePages);
    }
  }, [activePages]);

  // Auto total errors based on approved weights: Fath (1), Tashkeel (1), Tajweed (0.5)
  const totalErrors = useMemo(() => {
    return calculateSardTotalErrors(fathErrors, hesitationErrors, tajweedErrors);
  }, [fathErrors, hesitationErrors, tajweedErrors]);

  // Auto calculate pages count based on mode
  const calculatedPages = useMemo(() => {
    if (selectionMode === 'juz') {
      return selectedJuzList.reduce((acc, j) => acc + (j === 1 ? 21 : 20), 0);
    }
    if (selectionMode === 'surahs') {
      const pageSet = new Set<number>();
      selectedSurahNames.forEach(name => {
        const sEntry = Object.entries(surahNames).find(([_, n]) => n === name);
        if (sEntry) {
          const sId = Number(sEntry[0]);
          (surahPagesMap[sId] || []).forEach(p => pageSet.add(p));
        }
      });
      return countQuranPages(pageSet);
    }
    if (selectionMode === 'pages') {
      return multiRangeAnalysis.isValid ? multiRangeAnalysis.totalCount : 0;
    }
    return 0;
  }, [selectionMode, selectedJuzList, selectedSurahNames, multiRangeAnalysis]);

  // Auto deduce grade based on error thresholds
  const deducedGrade = useMemo(() => {
    return calculateSardGrade(totalErrors);
  }, [totalErrors]);

  const toggleJuz = (juz: number) => {
    setSelectedJuzList(prev => 
      prev.includes(juz) ? prev.filter(j => j !== juz) : [...prev, juz].sort((a, b) => a - b)
    );
  };

  const toggleSurah = (name: string) => {
    setSelectedSurahNames(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleSave = () => {
    if (selectionMode === 'pages') {
      if (pageRanges.every(r => r.fromPage === '' && r.toPage === '')) {
        alert('يرجى إدخال نطاق صفحات واحد على الأقل');
        return;
      }
      if (!multiRangeAnalysis.isValid) {
        alert(multiRangeAnalysis.summaryMessage || 'النطاق المحدد يحتوي على صفحات غير محفوظة');
        return;
      }
    } else {
      if (calculatedPages <= 0) {
        alert('يرجى تحديد الأجزاء أو السور المسردة');
        return;
      }
    }

    const validPageRanges: SardPageRange[] = selectionMode === 'pages'
      ? pageRanges
          .filter(r => r.fromPage !== '' && r.toPage !== '')
          .map(r => ({ fromPage: Number(r.fromPage), toPage: Number(r.toPage) }))
      : [];

    const updated: SardEvaluation = {
      ...evaluation,
      date,
      juzList: selectionMode === 'juz' ? selectedJuzList : [],
      surahs: selectionMode === 'surahs' ? selectedSurahNames : [],
      pageRanges: validPageRanges,
      pagesCount: calculatedPages,
      hesitationErrors,
      fathErrors,
      tajweedErrors,
      totalErrors,
      grade: deducedGrade,
      notes: notes.trim() || undefined,
      updatedAt: Date.now(),
    };

    onSave(updated);
  };

  return (
    <>
      <Modal 
        title={
          <div className="flex flex-col">
            <span>{`تعديل تقييم السرد: ${student.name}`}</span>
            {student.isAlAmeen && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal leading-tight mt-0.5">
                (من طلاب الأمين)
              </span>
            )}
          </div>
        } 
        onClose={onClose} 
        hideDefaultCloseButton
      >
        <div className="space-y-5 max-h-[80vh] overflow-y-auto px-1">
          {/* رأس المعلومات وبيانات محفوظ الطالب */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-wrap justify-between items-center gap-2">
            <div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">اسم الطالب</p>
              <div className="flex flex-col">
                <h4 className="text-lg font-black text-emerald-950 dark:text-emerald-100">{student.name}</h4>
                {student.isAlAmeen && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold leading-tight mt-0.5">
                    (من طلاب الأمين)
                  </span>
                )}
              </div>
            </div>
            {sardHalaqa && (
              <div className="text-left">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">حلقة السرد</p>
                <span className="text-sm font-bold bg-white dark:bg-slate-800 px-3 py-1 rounded-xl shadow-xs inline-block text-emerald-900 dark:text-emerald-200">
                  {sardHalaqa.name}
                </span>
              </div>
            )}
          </div>

          {/* شريط مصحف السرد وزر تصفح صفحات التقييم المحددة */}
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-3 rounded-2xl shadow-sm border border-emerald-700/60">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📖</span>
              <div>
                <span className="text-xs sm:text-sm font-black block">مصحف السرد</span>
                <span className="text-[10px] sm:text-[11px] text-emerald-100/90 font-bold block">
                  عرض صفحات المصحف المحددة أثناء تقييم السرد
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMushafModalOpen(true)}
              disabled={activePages.length === 0}
              className="px-3.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-black rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="فتح صفحات المصحف للسرد"
            >
              <span>فتح المصحف</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {toArabicDigits(activePages.length)} ص
              </span>
            </button>
          </div>

          <StudentProgressInfo student={student} />

          {/* التاريخ ونمط التحديد */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">تاريخ السرد:</label>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                className="input-style w-full font-bold"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">طريقة تحديد المحتوى:</label>
              <div className="flex gap-1.5 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectionMode('juz')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                    selectionMode === 'juz' ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  بالأجزاء ({studentCompletedJuzs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode('surahs')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                    selectionMode === 'surahs' ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  بالسور ({studentCompletedSurahs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode('pages')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                    selectionMode === 'pages' ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  بالصفحات
                </button>
              </div>
            </div>
          </div>

          {/* اختيار الأجزاء أو السور أو الصفحات */}
          {selectionMode === 'juz' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-700 dark:text-gray-300">
                  الأجزاء المحفوظة للطالب:
                </span>
                {studentCompletedJuzs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedJuzList(selectedJuzList.length === studentCompletedJuzs.length ? [] : [...studentCompletedJuzs])}
                    className="font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                  >
                    {selectedJuzList.length === studentCompletedJuzs.length ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                )}
              </div>
              {studentCompletedJuzs.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  {studentCompletedJuzs.map(juz => {
                    const isSelected = selectedJuzList.includes(juz);
                    return (
                      <button
                        key={juz}
                        type="button"
                        onClick={() => toggleJuz(juz)}
                        className={`p-2 rounded-lg font-black text-xs transition-all ${
                          isSelected 
                            ? 'bg-emerald-700 text-white shadow-sm scale-105' 
                            : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        جـ {toArabicDigits(juz)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold text-center">
                  لم يكتمل جزء كامل في محفوظ الطالب بعد.
                </div>
              )}
            </div>
          )}

          {selectionMode === 'surahs' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="relative flex items-center w-44">
                  <input
                    type="text"
                    placeholder="🔍 ابحث عن سورة..."
                    value={surahSearch}
                    onChange={e => setSurahSearch(e.target.value)}
                    className="input-style py-1 pl-6 pr-2.5 text-xs w-full font-bold"
                  />
                  {surahSearch && (
                    <button
                      type="button"
                      onClick={() => setSurahSearch('')}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200 flex items-center justify-center text-[9px] font-bold transition-colors cursor-pointer"
                      title="مسح البحث"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {studentCompletedSurahs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSurahNames(selectedSurahNames.length === studentCompletedSurahs.length ? [] : studentCompletedSurahs.map(s => s.name))}
                    className="font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                  >
                    {selectedSurahNames.length === studentCompletedSurahs.length ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                )}
              </div>
              {studentCompletedSurahs.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                  {filteredSurahs.map(s => {
                    const isSelected = selectedSurahNames.includes(s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSurah(s.name)}
                        className={`p-2 rounded-lg font-bold text-xs transition-all flex justify-between items-center ${
                          isSelected 
                            ? 'bg-emerald-700 text-white shadow-sm' 
                            : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate">{s.name}</span>
                        <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                          {toArabicDigits(s.pagesCount)} ص
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold text-center">
                  لم تكتمل سورة كاملة في محفوظ الطالب بعد.
                </div>
              )}
            </div>
          )}

          {selectionMode === 'pages' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-black text-gray-700 dark:text-gray-300">
                  نطاقات صفحات السرد:
                </span>
                <button
                  type="button"
                  onClick={addPageRange}
                  className="text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>➕ إضافة نطاق إضافي</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {pageRanges.map((range, idx) => {
                  const itemAnalysis = multiRangeAnalysis.rangeAnalyses[idx];
                  return (
                    <div 
                      key={idx} 
                      className="p-3 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                          النطاق ({toArabicDigits(idx + 1)})
                        </span>
                        {pageRanges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePageRange(idx)}
                            className="text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                            title="حذف هذا النطاق"
                          >
                            <span>🗑️ حذف النطاق</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                            من صفحة (البداية):
                          </label>
                          <input 
                            type="number" 
                            min="1" 
                            max="604"
                            value={safeNumberVal(range.fromPage, '')} 
                            onChange={(e) => updatePageRange(idx, 'fromPage', e.target.value === '' ? '' : (parseSafeNumber(e.target.value, 0) || ''))} 
                            className="input-style w-full font-bold text-center text-base py-1.5"
                            placeholder="1"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                            إلى صفحة (النهاية):
                          </label>
                          <input 
                            type="number" 
                            min="1" 
                            max="604"
                            value={safeNumberVal(range.toPage, '')} 
                            onChange={(e) => updatePageRange(idx, 'toPage', e.target.value === '' ? '' : (parseSafeNumber(e.target.value, 0) || ''))} 
                            className="input-style w-full font-bold text-center text-base py-1.5"
                            placeholder="20"
                          />
                        </div>
                      </div>

                      {range.fromPage !== '' && range.toPage !== '' && itemAnalysis && (
                        <div className={`p-2 rounded-xl text-[11px] font-bold ${
                          itemAnalysis.isValid
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-300'
                            : 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200 border border-rose-300'
                        }`}>
                          {itemAnalysis.isValid ? '✅ ' : '⚠️ '}
                          {itemAnalysis.message}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {pageRanges.some(r => r.fromPage !== '' || r.toPage !== '') && (
                <div className={`p-3 rounded-2xl text-xs font-bold leading-relaxed ${
                  multiRangeAnalysis.isValid
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
                }`}>
                  {multiRangeAnalysis.isValid ? '✅ ' : '⚠️ '}
                  {multiRangeAnalysis.summaryMessage}
                </div>
              )}

              <button
                type="button"
                onClick={addPageRange}
                className="w-full py-2 border-2 border-dashed border-emerald-400 dark:border-emerald-600 rounded-xl text-xs font-black text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all flex items-center justify-center gap-1.5"
              >
                <span>➕ إضافة نطاق آخر</span>
              </button>
            </div>
          )}

          <div className="text-center text-xs font-black text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800">
            إجمالي صفحات السرد: ({toArabicDigits(calculatedPages)}) صفحة
          </div>

          {/* خانات الأخطاء */}
          <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-0.5">
                <h5 className="font-bold text-amber-900 dark:text-amber-200 text-sm flex items-center gap-2">
                  <span>⚠️</span>
                  <span>رصد الأخطاء والتنبيهات:</span>
                </h5>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  الأوزان: الفتح (1) | التشكيل (1) | التجويد (0.5)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFathErrors(0);
                  setHesitationErrors(0);
                  setTajweedErrors(0);
                }}
                className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline px-2.5 py-1 bg-amber-100 dark:bg-amber-900/40 rounded-lg transition-colors"
              >
                تصفير الأخطاء
              </button>
            </div>

            <div className="flex flex-col gap-3 w-full">
              {/* أخطاء الفتح (+1) */}
              <div 
                onClick={() => setFathErrors(prev => prev + 1)}
                className="flex items-stretch bg-gradient-to-r from-rose-50/90 to-red-50/70 dark:from-rose-950/40 dark:to-red-950/30 rounded-2xl border-2 border-rose-200 dark:border-rose-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-rose-400 dark:hover:border-rose-600 active:scale-[0.99] transition-all h-14 sm:h-16"
              >
                <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black bg-rose-600 text-white px-2 py-0.5 rounded-lg shadow-xs">+1</span>
                    <span className="text-[11px] text-rose-600/80 dark:text-rose-400 font-bold hidden sm:inline">الفتح</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base sm:text-lg text-rose-950 dark:text-rose-100 group-hover:text-rose-700 select-none text-right">أخطاء الفتح</span>
                  </div>
                </div>
                <div className="px-2.5 sm:px-4 flex items-center justify-center">
                  <div className="w-14 sm:w-16 h-11 sm:h-12 rounded-full bg-white dark:bg-gray-900 border-2 border-rose-400 dark:border-rose-500 shadow-sm flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()} 
                      type="number" 
                      min="0" 
                      value={safeInputNumber(fathErrors)} 
                      placeholder="0" 
                      onChange={e => setFathErrors(Math.max(0, parseSafeNumber(e.target.value)))} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-rose-600 dark:text-rose-400 focus:text-rose-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-200 dark:placeholder:text-rose-900/40 z-10" 
                    />
                  </div>
                </div>
              </div>

              {/* أخطاء التشكيل (+1) */}
              <div 
                onClick={() => setHesitationErrors(prev => (prev || 0) + 1)}
                className="flex items-stretch bg-gradient-to-r from-amber-50/90 to-orange-50/70 dark:from-amber-950/40 dark:to-orange-950/30 rounded-2xl border-2 border-amber-200 dark:border-amber-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 active:scale-[0.99] transition-all h-14 sm:h-16"
              >
                <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black bg-amber-500 text-white px-2 py-0.5 rounded-lg shadow-xs">+1</span>
                    <span className="text-[11px] text-amber-600/80 dark:text-amber-400 font-bold hidden sm:inline">التشكيل</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base sm:text-lg text-amber-950 dark:text-amber-100 group-hover:text-amber-700 select-none text-right">أخطاء التشكيل</span>
                  </div>
                </div>
                <div className="px-2.5 sm:px-4 flex items-center justify-center">
                  <div className="w-14 sm:w-16 h-11 sm:h-12 rounded-full bg-white dark:bg-gray-900 border-2 border-amber-400 dark:border-amber-500 shadow-sm flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()} 
                      type="number" 
                      min="0" 
                      value={safeInputNumber(hesitationErrors)} 
                      placeholder="0" 
                      onChange={e => setHesitationErrors(Math.max(0, parseSafeNumber(e.target.value)))} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-amber-600 dark:text-amber-400 focus:text-amber-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-amber-200 dark:placeholder:text-amber-900/40 z-10" 
                    />
                  </div>
                </div>
              </div>

              {/* أخطاء التجويد (+0.5) */}
              <div 
                onClick={() => setTajweedErrors(prev => (prev || 0) + 1)}
                className="flex items-stretch bg-gradient-to-r from-blue-50/90 to-cyan-50/70 dark:from-blue-950/40 dark:to-cyan-950/30 rounded-2xl border-2 border-blue-200 dark:border-blue-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 active:scale-[0.99] transition-all h-14 sm:h-16"
              >
                <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-black bg-blue-500 text-white px-2 py-0.5 rounded-lg shadow-xs">+0.5</span>
                    <span className="text-[11px] text-blue-600/80 dark:text-blue-400 font-bold hidden sm:inline">التجويد</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base sm:text-lg text-blue-950 dark:text-blue-100 group-hover:text-blue-700 select-none text-right">أخطاء التجويد</span>
                  </div>
                </div>
                <div className="px-2.5 sm:px-4 flex items-center justify-center">
                  <div className="w-14 sm:w-16 h-11 sm:h-12 rounded-full bg-white dark:bg-gray-900 border-2 border-blue-400 dark:border-blue-500 shadow-sm flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()} 
                      type="number" 
                      min="0" 
                      value={safeInputNumber(tajweedErrors)} 
                      placeholder="0" 
                      onChange={e => setTajweedErrors(Math.max(0, parseSafeNumber(e.target.value)))} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-blue-600 dark:text-blue-400 focus:text-blue-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-blue-200 dark:placeholder:text-blue-900/40 z-10" 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* نتيجة الإجمالي والتقدير */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 gap-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>مجموع الأخطاء:</span>
                <span className="text-base px-2.5 py-0.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-black">
                  {toArabicDigits(totalErrors)} {totalErrors === 1 ? 'خطأ' : 'أخطاء'}
                </span>
              </div>
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>التقدير المستحق:</span>
                <span className={`text-base px-3 py-1 rounded-xl font-black shadow-xs ${getSardGradeBadgeClass(deducedGrade)}`}>
                  {deducedGrade}
                </span>
              </div>
            </div>

            {/* دليل التقدير */}
            <div className="p-2.5 bg-amber-100/50 dark:bg-slate-900/50 rounded-xl text-[11px] font-bold text-gray-700 dark:text-gray-300 flex flex-wrap items-center justify-around gap-2">
              <span>🌟 ممتاز مع الشرف: (0)</span>
              <span>🟢 ممتاز: (&lt; 10)</span>
              <span>🔵 جيد جداً: (&lt; 20)</span>
              <span>🔴 ضعيف: (20 فأكثر)</span>
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">ملاحظات المعلم:</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب أي ملاحظات أو توجيهات للطالب..."
              className="input-style w-full text-sm"
              rows={2}
            />
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="py-3 px-4 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 rounded-xl font-bold transition-all text-sm"
            >
              حذف التقييم
            </button>
            <div className="flex-1 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-xl font-bold transition-all text-sm"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-3 bg-emerald-700 text-white hover:bg-emerald-800 rounded-xl font-bold shadow-lg transition-all text-sm"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* تأكيد الحذف */}
      {showDeleteConfirm && (
        <Modal title="تأكيد حذف التقييم" onClose={() => setShowDeleteConfirm(false)} hideDefaultCloseButton>
          <div className="space-y-4 text-center">
            <p className="text-base font-bold text-gray-700 dark:text-gray-200 py-4">
              هل أنت متأكد من رغبتك في حذف تقييم السرد لهذا الطالب بشكل نهائي؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onDelete(evaluation.id);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black shadow-md hover:bg-red-700"
              >
                نعم، احذف
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-xl font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* قارئ المصحف لتقييم السرد */}
      <MushafReaderModal
        isOpen={isMushafModalOpen}
        onClose={() => setIsMushafModalOpen(false)}
        newPages={activePages}
        previousWeekPages={new Set<number>()}
        studentName={student.name}
        evalFath={Number(fathErrors) || 0}
        setEvalFath={setFathErrors}
        evalTashkeel={Number(hesitationErrors) || 0}
        setEvalTashkeel={setHesitationErrors}
        evalTajweed={Number(tajweedErrors) || 0}
        setEvalTajweed={setTajweedErrors}
        isSardMode={true}
      />
    </>
  );
};
