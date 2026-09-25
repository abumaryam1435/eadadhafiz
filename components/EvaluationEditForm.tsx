
import React, { useState, useContext, useMemo, useEffect, useRef } from 'react';
import Modal from './Modal';
import { AppContext } from '../App';
import { QURAN_SURAHS } from '../constants';
import { AttendanceStatus, AbsenceReason, EvaluationType, PerformanceLevel, PeriodicReviewStatus, Evaluation, Student, Halaqa } from '../types';
import { translationMap, toArabicDigits, formatRtlRange } from '../utils/exportWord';
import { toEnglishDigits, parseSafeNumber, safeInputNumber } from '../utils/juzUtils';
import MushafReaderModal from './MushafReaderModal';
import { MatnVersesModal } from './MatnVersesModal';
import { 
  surahNames, 
  quranPageMap, 
  surahAyahCounts, 
  surahPagesMap, 
  pageSurahsMap, 
  juzPagesMap, 
  juzSurahsMap, 
  juzShortSurahsMap, 
  surahJuzMap,
  calculateSurahsAndAyahs, 
  computeSelectionState,
  analyzeStudentQuranHistory 
} from '../utils/quranData';
import { isSmartMatch } from '../utils/searchUtils';
import { StudentProgressInfo } from './StudentProgressInfo';
import { getCompletedJuzs } from '../utils/pageUtils';
import { preloadMushafPages } from '../utils/mushafPreload';

interface EvaluationEditFormProps {
  initialEvaluation: Evaluation;
  student: Student;
  halaqa?: Halaqa;
  onClose: () => void;
  onSave: (updatedEvaluation: Evaluation) => void;
  onDelete: (evaluationId: number) => void;
}

const mapOldPerformanceToNew = (oldPerf?: string): PerformanceLevel | undefined => {
  if (!oldPerf) return undefined;
  const valid = Object.values(PerformanceLevel).includes(oldPerf as PerformanceLevel);
  if (valid) return oldPerf as PerformanceLevel;
  if (oldPerf === 'very_good') return PerformanceLevel.ONE_ERROR;
  if (oldPerf === 'good') return PerformanceLevel.THREE_ERRORS;
  if (oldPerf === 'did_not_memorize') return PerformanceLevel.MORE_THAN_FIVE_ERRORS;
  return undefined;
};

const EvaluationEditForm: React.FC<EvaluationEditFormProps> = ({
  initialEvaluation,
  student,
  halaqa,
  onClose,
  onSave,
  onDelete,
}) => {
  const context = useContext(AppContext);

  const studentQuranHistory = useMemo(() => {
    return analyzeStudentQuranHistory(
      student,
      context?.evaluations,
      initialEvaluation.weekNumber,
      initialEvaluation.id
    );
  }, [student, context?.evaluations, initialEvaluation.weekNumber, initialEvaluation.id]);

  const completedJuzsSet = studentQuranHistory.allFullJuzs;
  const previousWeekPages = studentQuranHistory.prevWeekFullPages;
  const previouslyMemorizedPages = studentQuranHistory.priorFullPages;

  const [attendance, setAttendance] = useState<AttendanceStatus>(initialEvaluation.attendance);
  const [absenceReason, setAbsenceReason] = useState<AbsenceReason | undefined>(initialEvaluation.absenceReason);
  const [evaluationType, setEvaluationType] = useState<EvaluationType | undefined>(initialEvaluation.evaluationType);
  const [pages, setPages] = useState<number | 'not_ready' | 'review' | ''>(initialEvaluation.subject === 'mutoon' ? (initialEvaluation.evaluationType === EvaluationType.REVIEW ? 'review' : (initialEvaluation.pages === 0 ? 'not_ready' : (initialEvaluation.pages ?? ''))) : (initialEvaluation.pages ?? ''));
  const [newMemorizedPages, setNewMemorizedPages] = useState<number[]>(initialEvaluation.newMemorizedPages || []);
  const [selectedJuzForPages, setSelectedJuzForPages] = useState<number | null>(null);
  const [selectedSurahIds, setSelectedSurahIds] = useState<number[]>(() => {
    if (initialEvaluation.surahs && initialEvaluation.subject !== 'mutoon') {
      return initialEvaluation.surahs.map(name => surahNames.indexOf(name)).filter(idx => idx > 0);
    }
    return [];
  });
  const [quranSelectionTab, setQuranSelectionTab] = useState<'pages' | 'surahs'>('pages');
  const [viewingVersesModal, setViewingVersesModal] = useState<{
    isOpen: boolean;
    matnName: string;
    fromVerse: number | string;
    toVerse: number | string;
    prevFromVerse?: number;
    prevToVerse?: number;
  } | null>(null);

  const selectionState = useMemo(() => {
    return computeSelectionState(newMemorizedPages, selectedSurahIds, studentQuranHistory);
  }, [newMemorizedPages, selectedSurahIds, studentQuranHistory]);

  const getSurahHistory = (sId: number) => {
    if (studentQuranHistory.prevWeekFullSurahs.has(sId)) return 'PREV_WEEK_FULL';
    if (studentQuranHistory.priorFullSurahs.has(sId)) return 'PRIOR_FULL';
    return 'NONE';
  };

  const getPageHistory = (page: number) => {
    if (studentQuranHistory.prevWeekFullPages.has(page)) return 'PREV_WEEK_FULL';
    if (studentQuranHistory.priorFullPages.has(page)) return 'PRIOR_FULL';
    if (studentQuranHistory.prevWeekPartialPages.has(page)) return 'PREV_WEEK_PARTIAL';
    if (studentQuranHistory.priorPartialPages.has(page)) return 'PRIOR_PARTIAL';
    return 'NONE';
  };

  const [isMushafModalOpen, setIsMushafModalOpen] = useState(false);
  const [ayahRange, setAyahRange] = useState<string>(() => {
    if (initialEvaluation.fromAyah && initialEvaluation.toAyah) {
      return initialEvaluation.fromAyah === initialEvaluation.toAyah ? initialEvaluation.fromAyah.toString() : `${initialEvaluation.fromAyah}-${initialEvaluation.toAyah}`;
    }
    return initialEvaluation.fromAyah ? initialEvaluation.fromAyah.toString() : '';
  });
  const [selectedSurahs, setSelectedSurahs] = useState<string[]>(initialEvaluation.surahs ?? []);
  const [performance, setPerformance] = useState<PerformanceLevel | undefined>(mapOldPerformanceToNew(initialEvaluation.performance as string));
  const [periodicReview, setPeriodicReview] = useState<PeriodicReviewStatus | undefined>(initialEvaluation.periodicReview);
  const [notes, setNotes] = useState(initialEvaluation.notes ?? '');
  
  const [surahSearchTerm, setSurahSearchTerm] = useState('');
  const [isSurahOpen, setIsSurahOpen] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [step, setStep] = useState<'edit' | 'summary'>('edit');
  const [draftEvaluation, setDraftEvaluation] = useState<Evaluation | null>(null);

  const [testFath, setTestFath] = useState<number>(initialEvaluation.testFathErrors || 0);
  const [testTashkeel, setTestTashkeel] = useState<number>(initialEvaluation.testTashkeelErrors || 0);
  const [testTajweed, setTestTajweed] = useState<number>(initialEvaluation.testTajweedErrors || 0);
  const [evalFath, setEvalFath] = useState<number>(initialEvaluation.evalFathErrors || 0);
  const [evalTashkeel, setEvalTashkeel] = useState<number>(initialEvaluation.evalTashkeelErrors || 0);
  const [evalTajweed, setEvalTajweed] = useState<number>(initialEvaluation.evalTajweedErrors || 0);
  const matns = context?.matns || [];

  const MATN_CARD_THEMES = useMemo(() => [
    {
      bg: 'bg-emerald-50/70 dark:bg-emerald-950/25',
      evaluatedBg: 'bg-emerald-100/70 dark:bg-emerald-900/35 border-emerald-400 dark:border-emerald-600 shadow-sm',
      border: 'border-emerald-200 dark:border-emerald-800/80',
      numberBadge: 'bg-emerald-700 text-white',
      numberBadgeInactive: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200',
      title: 'text-emerald-950 dark:text-emerald-100',
      statBadge: 'bg-white/80 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
      rangeBadge: 'bg-white dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-100 border-emerald-300 dark:border-emerald-700',
    },
    {
      bg: 'bg-sky-50/70 dark:bg-sky-950/25',
      evaluatedBg: 'bg-sky-100/70 dark:bg-sky-900/35 border-sky-400 dark:border-sky-600 shadow-sm',
      border: 'border-sky-200 dark:border-sky-800/80',
      numberBadge: 'bg-sky-700 text-white',
      numberBadgeInactive: 'bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200',
      title: 'text-sky-950 dark:text-sky-100',
      statBadge: 'bg-white/80 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border-sky-200 dark:border-sky-800',
      rangeBadge: 'bg-white dark:bg-sky-950/80 text-sky-900 dark:text-sky-100 border-sky-300 dark:border-sky-700',
    },
    {
      bg: 'bg-amber-50/70 dark:bg-amber-950/25',
      evaluatedBg: 'bg-amber-100/70 dark:bg-amber-900/35 border-amber-400 dark:border-amber-600 shadow-sm',
      border: 'border-amber-200 dark:border-amber-800/80',
      numberBadge: 'bg-amber-700 text-white',
      numberBadgeInactive: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200',
      title: 'text-amber-950 dark:text-amber-100',
      statBadge: 'bg-white/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800',
      rangeBadge: 'bg-white dark:bg-amber-950/80 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700',
    },
    {
      bg: 'bg-purple-50/70 dark:bg-purple-950/25',
      evaluatedBg: 'bg-purple-100/70 dark:bg-purple-900/35 border-purple-400 dark:border-purple-600 shadow-sm',
      border: 'border-purple-200 dark:border-purple-800/80',
      numberBadge: 'bg-purple-700 text-white',
      numberBadgeInactive: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200',
      title: 'text-purple-950 dark:text-purple-100',
      statBadge: 'bg-white/80 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800',
      rangeBadge: 'bg-white dark:bg-purple-950/80 text-purple-900 dark:text-purple-100 border-purple-300 dark:border-purple-700',
    },
    {
      bg: 'bg-indigo-50/70 dark:bg-indigo-950/25',
      evaluatedBg: 'bg-indigo-100/70 dark:bg-indigo-900/35 border-indigo-400 dark:border-indigo-600 shadow-sm',
      border: 'border-indigo-200 dark:border-indigo-800/80',
      numberBadge: 'bg-indigo-700 text-white',
      numberBadgeInactive: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200',
      title: 'text-indigo-950 dark:text-indigo-100',
      statBadge: 'bg-white/80 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800',
      rangeBadge: 'bg-white dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-100 border-indigo-300 dark:border-indigo-700',
    },
    {
      bg: 'bg-rose-50/70 dark:bg-rose-950/25',
      evaluatedBg: 'bg-rose-100/70 dark:bg-rose-900/35 border-rose-400 dark:border-rose-600 shadow-sm',
      border: 'border-rose-200 dark:border-rose-800/80',
      numberBadge: 'bg-rose-700 text-white',
      numberBadgeInactive: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200',
      title: 'text-rose-950 dark:text-rose-100',
      statBadge: 'bg-white/80 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800',
      rangeBadge: 'bg-white dark:bg-rose-950/80 text-rose-900 dark:text-rose-100 border-rose-300 dark:border-rose-700',
    },
    {
      bg: 'bg-teal-50/70 dark:bg-teal-950/25',
      evaluatedBg: 'bg-teal-100/70 dark:bg-teal-900/35 border-teal-400 dark:border-teal-600 shadow-sm',
      border: 'border-teal-200 dark:border-teal-800/80',
      numberBadge: 'bg-teal-700 text-white',
      numberBadgeInactive: 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200',
      title: 'text-teal-950 dark:text-teal-100',
      statBadge: 'bg-white/80 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-800',
      rangeBadge: 'bg-white dark:bg-teal-950/80 text-teal-900 dark:text-teal-100 border-teal-300 dark:border-teal-700',
    },
    {
      bg: 'bg-orange-50/70 dark:bg-orange-950/25',
      evaluatedBg: 'bg-orange-100/70 dark:bg-orange-900/35 border-orange-400 dark:border-orange-600 shadow-sm',
      border: 'border-orange-200 dark:border-orange-800/80',
      numberBadge: 'bg-orange-700 text-white',
      numberBadgeInactive: 'bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200',
      title: 'text-orange-950 dark:text-orange-100',
      statBadge: 'bg-white/80 dark:bg-orange-950/60 text-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800',
      rangeBadge: 'bg-white dark:bg-orange-950/80 text-orange-900 dark:text-orange-100 border-orange-300 dark:border-orange-700',
    }
  ], []);

  const activeMatns = useMemo(() => {
    const list = (matns || []).filter(m => m.isActive !== false || selectedSurahs.includes(m.name));
    if (selectedSurahs.length > 0 && !list.some(m => selectedSurahs.includes(m.name))) {
      return [...(matns || []), ...selectedSurahs.filter(s => !(matns || []).some(m => m.name === s)).map((s, idx) => ({
        id: -(idx + 1),
        name: s,
        linesCount: 100,
        isActive: true,
      }))];
    }
    return list;
  }, [matns, selectedSurahs]);
  
  const surahSearchInputRef = useRef<HTMLInputElement>(null); 
  const [error, setError] = useState<string | null>(null);
  const [pendingMatnsAlert, setPendingMatnsAlert] = useState<string[] | null>(null);

  // التحميل المسبق لصفحات المصحف في الخلفية
  useEffect(() => {
    const pagesToPreload: number[] = [];
    if (selectionState.allActivePages && selectionState.allActivePages.length > 0) {
      pagesToPreload.push(...selectionState.allActivePages);
    }
    if (previousWeekPages && previousWeekPages.size > 0) {
      previousWeekPages.forEach(p => pagesToPreload.push(p));
    }
    if (pagesToPreload.length > 0) {
      preloadMushafPages(pagesToPreload);
    }
  }, [selectionState.allActivePages, previousWeekPages]);

  const toggleSurah = (surahId: number) => {
    const hist = getSurahHistory(surahId);
    if (evaluationType !== EvaluationType.REVIEW && (hist === 'PREV_WEEK_FULL' || hist === 'PRIOR_FULL')) return;

    const isRemoving = selectedSurahIds.includes(surahId);
    const nextSurahIds = isRemoving
      ? selectedSurahIds.filter(id => id !== surahId)
      : [...selectedSurahIds, surahId];
    
    setSelectedSurahIds(nextSurahIds);
    
    const calc = calculateSurahsAndAyahs(newMemorizedPages, nextSurahIds, evaluationType === EvaluationType.REVIEW ? undefined : studentQuranHistory);
    setSelectedSurahs(calc.surahs);
    setAyahRange(calc.ayahRange);
  };

  const toggleNewPage = (pageNumber: number) => {
    const hist = getPageHistory(pageNumber);
    if (evaluationType !== EvaluationType.REVIEW && (hist === 'PREV_WEEK_FULL' || hist === 'PRIOR_FULL')) return;

    const isRemoving = newMemorizedPages.includes(pageNumber);
    const nextPages = isRemoving
      ? newMemorizedPages.filter(p => p !== pageNumber)
      : [...newMemorizedPages, pageNumber];
    
    setNewMemorizedPages(nextPages);
    
    const calc = calculateSurahsAndAyahs(nextPages, selectedSurahIds, evaluationType === EvaluationType.REVIEW ? undefined : studentQuranHistory);
    setSelectedSurahs(calc.surahs);
    setAyahRange(calc.ayahRange);
  };

  const toggleFullJuz = (juz: number) => {
    const pagesInJuz = juzPagesMap[juz] || [];
    const allSelected = pagesInJuz.every(p => newMemorizedPages.includes(p));
    let nextPages: number[];
    if (allSelected) {
      nextPages = newMemorizedPages.filter(p => !pagesInJuz.includes(p));
    } else {
      nextPages = Array.from(new Set([...newMemorizedPages, ...pagesInJuz])).sort((a, b) => a - b);
    }
    setNewMemorizedPages(nextPages);
    const calc = calculateSurahsAndAyahs(nextPages, selectedSurahIds, evaluationType === EvaluationType.REVIEW ? undefined : studentQuranHistory);
    setSelectedSurahs(calc.surahs);
    setAyahRange(calc.ayahRange);
  };

  const toggleSurahsInJuz = (juz: number) => {
    const surahsInJuz = juzSurahsMap[juz] || [];
    const allSelected = surahsInJuz.every(s => selectedSurahIds.includes(s));
    let nextSurahIds: number[];
    if (allSelected) {
      nextSurahIds = selectedSurahIds.filter(s => !surahsInJuz.includes(s));
    } else {
      nextSurahIds = Array.from(new Set([...selectedSurahIds, ...surahsInJuz])).sort((a, b) => a - b);
    }
    setSelectedSurahIds(nextSurahIds);
    const calc = calculateSurahsAndAyahs(newMemorizedPages, nextSurahIds, evaluationType === EvaluationType.REVIEW ? undefined : studentQuranHistory);
    setSelectedSurahs(calc.surahs);
    setAyahRange(calc.ayahRange);
  };

  useEffect(() => {
    if (isSurahOpen && surahSearchInputRef.current && window.innerWidth >= 768) {
        setTimeout(() => surahSearchInputRef.current?.focus(), 100);
    }
  }, [isSurahOpen]);

  useEffect(() => {
    if (!initialEvaluation.isTest && attendance !== AttendanceStatus.ABSENT && evaluationType === EvaluationType.MEMORIZATION) {
      let deducedPerf = PerformanceLevel.EXCELLENT;
      if (initialEvaluation.subject === "mutoon") {
        if (pages === "not_ready") deducedPerf = PerformanceLevel.MORE_THAN_FIVE_ERRORS;
        else if (evalFath > 6) deducedPerf = PerformanceLevel.MORE_THAN_FIVE_ERRORS;
        else if (evalFath >= 3) deducedPerf = PerformanceLevel.ONE_ERROR;
      } else {
        const rawTotal = evalFath + evalTashkeel + (evalTajweed * 0.5);
        const totalErrors = Math.floor(rawTotal);
        if (totalErrors === 0) deducedPerf = PerformanceLevel.EXCELLENT;
        else if (totalErrors === 1) deducedPerf = PerformanceLevel.ONE_ERROR;
        else if (totalErrors === 2) deducedPerf = PerformanceLevel.TWO_ERRORS;
        else if (totalErrors === 3) deducedPerf = PerformanceLevel.THREE_ERRORS;
        else if (totalErrors === 4) deducedPerf = PerformanceLevel.FOUR_ERRORS;
        else if (totalErrors === 5) deducedPerf = PerformanceLevel.FIVE_ERRORS;
        else deducedPerf = PerformanceLevel.MORE_THAN_FIVE_ERRORS;
      }
      setPerformance(deducedPerf);
    }
  }, [evalFath, evalTashkeel, evalTajweed, attendance, evaluationType, initialEvaluation.isTest, initialEvaluation.subject, pages]);


  const handlePreview = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    
    if (!attendance) return setError('الرجاء تحديد حالة الحضور.');
    if (attendance === AttendanceStatus.ABSENT && !absenceReason) return setError('الرجاء تحديد سبب الغياب.');
    if (attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) {
        if (!evaluationType && initialEvaluation.subject !== 'mutoon') return setError('الرجاء تحديد نوع التقييم.');
        if (initialEvaluation.subject === 'mutoon') {
            if (pages === '') return setError('الرجاء إدخال عدد الأبيات.');
            if (selectedSurahs.length === 0) return setError('الرجاء اختيار متن واحد على الأقل.');
            const pendingMatns = matns.filter(m => {
                const p = (context?.evaluations || []).filter(e => e.studentId === student.id && e.subject === 'mutoon' && e.evaluationType === 'memorization' && e.surahs?.includes(m.name) && e.id !== initialEvaluation.id).reduce((sum, e) => sum + (e.pages || 0), 0);
                if (p >= m.linesCount) return false;
                
                const evaluatedThisWeek = (context?.evaluations || []).some(e => e.studentId === student.id && e.subject === 'mutoon' && e.weekNumber === initialEvaluation.weekNumber && e.surahs?.includes(m.name) && e.id !== initialEvaluation.id);
                if (evaluatedThisWeek) return false;
                
                if (m.name === selectedSurahs[0]) return false;
                
                return true;
            });
            if (pendingMatns.length > 0) {
               setPendingMatnsAlert(pendingMatns.map(m => m.name));
               return;
            }
        } else {
            if (evaluationType === EvaluationType.MEMORIZATION) {
                if (selectionState.allActivePages.length === 0) return setError('الرجاء تحديد الصفحات المحفوظة.');
                if (!performance) return setError('الرجاء تحديد مستوى الأداء.');
            } else if (evaluationType === EvaluationType.REVIEW) {
                if (selectionState.allActivePages.length === 0 && selectedSurahs.length === 0) {
                    return setError('الرجاء تحديد الأجزاء أو الصفحات أو السور المراجعة.');
                }
            }
        }
    }

    let finalEvalType = evaluationType;
    let finalPages: number | null = null;
    let finalPerformance = performance;
    
    if (initialEvaluation.subject === 'mutoon' && !initialEvaluation.isTest && (attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE)) {
        if (pages === 'review') {
            finalEvalType = EvaluationType.REVIEW;
            finalPages = 0;
        } else if (pages === 'not_ready') {
            finalEvalType = EvaluationType.MEMORIZATION;
            finalPages = 0;
        } else {
            finalEvalType = EvaluationType.MEMORIZATION;
            finalPages = Number(pages);
        }

        if (pages === 'not_ready') {
            finalPerformance = PerformanceLevel.MORE_THAN_FIVE_ERRORS;
        } else if (evalFath > 6) {
            finalPerformance = PerformanceLevel.MORE_THAN_FIVE_ERRORS;
        } else if (evalFath >= 3) {
            finalPerformance = PerformanceLevel.ONE_ERROR;
        } else {
            finalPerformance = PerformanceLevel.EXCELLENT;
        }
    } else {
        finalPages = ((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && evaluationType === EvaluationType.MEMORIZATION) ? (selectionState.allActivePages.length > 0 ? selectionState.newPagesCount : null) : null;
    }

    const range = ayahRange.split('-').map(n => n.trim());
    let finalFromAyah: any = range[0] || null;
    let finalToAyah: any = range[1] || range[0] || null;

    if (initialEvaluation.subject === 'mutoon' && (attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE)) {
        if (pages !== 'review' && pages !== 'not_ready' && pages !== '') {
            const p = (context?.evaluations || []).filter(ev => ev.studentId === student.id && ev.subject === 'mutoon' && ev.evaluationType === 'memorization' && ev.id !== initialEvaluation.id && ev.surahs?.includes(selectedSurahs[0])).reduce((sum, ev) => sum + (ev.pages || 0), 0);
            finalFromAyah = p + 1;
            finalToAyah = p + Number(pages);
        } else {
            finalFromAyah = null;
            finalToAyah = null;
        }
    }

    const isReview = (attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && (evaluationType === EvaluationType.REVIEW || finalEvalType === EvaluationType.REVIEW);
    const reviewScore = isReview ? Math.max(0, 100 - (evalFath * 1 + evalTashkeel * 1 + evalTajweed * 0.5)) : undefined;

    const updated: any = {
      ...initialEvaluation,
      attendance,
      absenceReason: attendance === AttendanceStatus.ABSENT ? absenceReason : null,
      evaluationType: (attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && !initialEvaluation.isTest ? finalEvalType : null,
      pages: isReview ? (selectionState.allActivePages.length || null) : finalPages,
      newMemorizedPages: ((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && (evaluationType === EvaluationType.MEMORIZATION || isReview) && initialEvaluation.subject !== 'mutoon') ? selectionState.allActivePages : undefined,
      fromAyah: finalFromAyah,
      toAyah: finalToAyah,
      surahs: ((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && (evaluationType === EvaluationType.MEMORIZATION || isReview)) ? selectedSurahs : initialEvaluation.surahs,
      performance: isReview ? null : (((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && evaluationType === EvaluationType.MEMORIZATION) ? finalPerformance : null),
      periodicReview: isReview ? null : (((attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && evaluationType === EvaluationType.MEMORIZATION) ? (periodicReview || null) : null),
      notes: notes || null,
      updatedAt: Date.now(),
      evalFathErrors: !initialEvaluation.isTest ? evalFath : undefined,
      evalTashkeelErrors: !initialEvaluation.isTest ? evalTashkeel : undefined,
      evalTajweedErrors: !initialEvaluation.isTest ? evalTajweed : undefined,
      testFathErrors: initialEvaluation.isTest ? testFath : undefined,
      testTashkeelErrors: initialEvaluation.isTest ? testTashkeel : undefined,
      testTajweedErrors: initialEvaluation.isTest ? testTajweed : undefined,
      testTotalScore: initialEvaluation.isTest ? Math.max(0, (initialEvaluation.testMaxScore || 0) - (testFath + testTashkeel + testTajweed * 0.5)) : (isReview ? reviewScore : undefined),
      testMaxScore: initialEvaluation.isTest ? initialEvaluation.testMaxScore : (isReview ? 100 : undefined),
    };
    
    setDraftEvaluation(updated);
    setStep('summary');
  };

  const handleConfirmSave = () => {
    if (draftEvaluation) {
      setSurahSearchTerm('');
      onSave(draftEvaluation);
    }
  };

  const FooterActions = step === 'edit' ? (
    <div className="flex flex-col gap-2">
        <button onClick={() => handlePreview()} className="w-full py-3 bg-green-700 text-white rounded-xl font-black shadow-lg hover:bg-green-800 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm sm:text-base">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
            تحديث التقييم
        </button>
        <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setSurahSearchTerm(''); onClose(); }} className="py-2 bg-gray-200 text-gray-700 rounded-lg font-bold dark:bg-gray-700 dark:text-gray-200 active:scale-95 transition-all text-[11px]">إلغاء</button>
            <button type="button" onClick={() => setShowConfirmDelete(true)} className="py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 dark:bg-red-900/20 active:scale-95 transition-all text-[11px]">حذف السجل</button>
        </div>
    </div>
  ) : (
    <div className="flex flex-col gap-2">
        <button onClick={handleConfirmSave} className="w-full py-3 bg-green-700 text-white rounded-xl font-black shadow-lg hover:bg-green-800 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm sm:text-base">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
            حفظ التعديلات
        </button>
        <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setStep('edit')} className="py-2 bg-amber-100 text-amber-700 rounded-lg font-bold dark:bg-amber-900/30 dark:text-amber-200 active:scale-95 transition-all text-[11px]">الرجوع للتعديل</button>
            <button type="button" onClick={() => { setSurahSearchTerm(''); onClose(); }} className="py-2 bg-gray-200 text-gray-700 rounded-lg font-bold dark:bg-gray-700 dark:text-gray-200 active:scale-95 transition-all text-[11px]">إلغاء التعديل</button>
        </div>
    </div>
  );

  if (showConfirmDelete) {
    return (
        <Modal title="تأكيد الحذف" onClose={() => setShowConfirmDelete(false)} hideDefaultCloseButton={true}>
            <div className="text-center py-2">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <p className="text-base font-black dark:text-white mb-5">هل أنت متأكد من الحذف؟</p>
                <div className="flex flex-col gap-2">
                    <button onClick={() => { setSurahSearchTerm(''); onDelete(initialEvaluation.id); }} className="w-full py-3 bg-red-600 text-white rounded-xl font-black shadow-lg active:scale-95">نعم، احذف السجل</button>
                    <button onClick={() => setShowConfirmDelete(false)} className="w-full py-2.5 bg-gray-100 rounded-xl font-bold">تراجع</button>
                </div>
            </div>
        </Modal>
    );
  }

  return (
    <Modal 
      title={
        <div className="flex flex-col">
          <span>{`تعديل: ${student.name}`}</span>
          {student.isAlAmeen && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal leading-tight mt-0.5">
              (من طلاب الأمين)
            </span>
          )}
        </div>
      } 
      onClose={() => { setSurahSearchTerm(''); onClose(); }} 
      hideDefaultCloseButton={true} 
      footer={FooterActions}
    >
      {step === 'edit' ? (
      <form onSubmit={handlePreview} className="flex flex-col gap-3.5 animate-in slide-in-from-bottom-2 duration-500">
        <StudentProgressInfo student={student} subject={initialEvaluation.subject} />
        {error && <div className="bg-red-50 text-red-700 p-2.5 rounded-lg border border-red-200 text-[10px] font-black animate-pulse flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            {error}
        </div>}

        {!initialEvaluation.isTest && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 flex items-center gap-1.5 uppercase">الحضور</label>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button type="button" onClick={() => setAttendance(AttendanceStatus.PRESENT)} className={`py-1.5 rounded-xl font-black border transition-all flex items-center justify-center gap-1.5 ${attendance === AttendanceStatus.PRESENT ? 'bg-green-50 border-green-600 text-green-900 shadow-sm ring-1 ring-green-500/20' : 'bg-white dark:bg-gray-800 dark:text-gray-400 border-gray-200'}`}>
              <span className="text-[10px]">حاضر</span>
            </button>
            <button type="button" onClick={() => setAttendance(AttendanceStatus.LATE)} className={`py-1.5 rounded-xl font-black border transition-all flex items-center justify-center gap-1.5 ${attendance === AttendanceStatus.LATE ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm ring-1 ring-blue-500/20' : 'bg-white dark:bg-gray-800 dark:text-gray-400 border-gray-200'}`}>
              <span className="text-[10px]">متأخر</span>
            </button>
            <button type="button" onClick={() => {
                setAttendance(AttendanceStatus.ABSENT);
                setEvaluationType(undefined);
                setPages('');
                setAyahRange('');
                setSelectedSurahs([]);
                setPerformance(undefined);
                setPeriodicReview(undefined);
            }} className={`py-1.5 rounded-xl font-black border transition-all flex items-center justify-center gap-1.5 ${attendance === AttendanceStatus.ABSENT ? 'bg-red-50 border-red-600 text-red-900 shadow-sm ring-1 ring-red-500/20' : 'bg-white dark:bg-gray-800 dark:text-gray-400 border-gray-200'}`}>
              <span className="text-[10px]">غائب</span>
            </button>
          </div>
        </div>
        )}

        {!initialEvaluation.isTest && attendance === AttendanceStatus.ABSENT ? (
          <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-300">
            <label className="text-[10px] font-black text-gray-500 flex items-center gap-1.5 uppercase">السبب</label>
            <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAbsenceReason(AbsenceReason.WITH_EXCUSE)} className={`py-2 rounded-lg text-[10px] font-black border transition-all ${absenceReason === AbsenceReason.WITH_EXCUSE ? 'bg-amber-50 border-amber-500 text-amber-900' : 'bg-gray-50 border-transparent dark:bg-gray-800'}`}>بعذر</button>
                <button type="button" onClick={() => setAbsenceReason(AbsenceReason.WITHOUT_EXCUSE)} className={`py-2 rounded-lg text-[10px] font-black border transition-all ${absenceReason === AbsenceReason.WITHOUT_EXCUSE ? 'bg-gray-100 border-gray-400 text-gray-900' : 'bg-gray-50 border-transparent dark:bg-gray-800'}`}>بدون عذر</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
            {initialEvaluation.isTest ? (
                <div className="space-y-3 bg-indigo-50/40 dark:bg-indigo-900/10 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                    <label className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 uppercase border-b border-indigo-100 dark:border-indigo-800 pb-2">سجل درجات وأخطاء الاختبار</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* الفتح */}
                        <div className="rounded-xl border-2 border-rose-200 dark:border-rose-800/70 bg-gradient-to-r from-rose-50/90 to-red-50/70 dark:from-rose-950/40 dark:to-red-950/30 overflow-hidden flex items-stretch h-12">
                            <div className="flex-1 flex items-center justify-between px-2.5">
                                <span className="text-[10px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded shadow-xs">-1</span>
                                <span className="text-[11px] font-black text-rose-950 dark:text-rose-100">أخطاء الفتح</span>
                            </div>
                            <div className="px-2 flex items-center justify-center">
                                <div className="w-12 h-8 rounded-full bg-white dark:bg-gray-900 border-2 border-rose-400 dark:border-rose-500 shadow-xs flex items-center justify-center overflow-hidden">
                                    <input type="number" min="0" value={safeInputNumber(testFath)} onChange={e => setTestFath(Math.max(0, parseSafeNumber(e.target.value)))} onFocus={e => e.target.select()} className="w-full h-full text-center text-sm font-black bg-transparent text-rose-600 dark:text-rose-400 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                </div>
                            </div>
                        </div>

                        {/* التشكيل */}
                        <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800/70 bg-gradient-to-r from-amber-50/90 to-orange-50/70 dark:from-amber-950/40 dark:to-orange-950/30 overflow-hidden flex items-stretch h-12">
                            <div className="flex-1 flex items-center justify-between px-2.5">
                                <span className="text-[10px] font-black bg-amber-600 text-white px-1.5 py-0.5 rounded shadow-xs">-1</span>
                                <span className="text-[11px] font-black text-amber-950 dark:text-amber-100">أخطاء التشكيل</span>
                            </div>
                            <div className="px-2 flex items-center justify-center">
                                <div className="w-12 h-8 rounded-full bg-white dark:bg-gray-900 border-2 border-amber-400 dark:border-amber-500 shadow-xs flex items-center justify-center overflow-hidden">
                                    <input type="number" min="0" value={safeInputNumber(testTashkeel)} onChange={e => setTestTashkeel(Math.max(0, parseSafeNumber(e.target.value)))} onFocus={e => e.target.select()} className="w-full h-full text-center text-sm font-black bg-transparent text-amber-600 dark:text-amber-400 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                </div>
                            </div>
                        </div>

                        {/* التجويد */}
                        <div className="rounded-xl border-2 border-teal-200 dark:border-teal-800/70 bg-gradient-to-r from-teal-50/90 to-emerald-50/70 dark:from-teal-950/40 dark:to-emerald-950/30 overflow-hidden flex items-stretch h-12">
                            <div className="flex-1 flex items-center justify-between px-2.5">
                                <span className="text-[10px] font-black bg-teal-600 text-white px-1.5 py-0.5 rounded shadow-xs">-0.5</span>
                                <span className="text-[11px] font-black text-teal-950 dark:text-teal-100">أخطاء التجويد</span>
                            </div>
                            <div className="px-2 flex items-center justify-center">
                                <div className="w-12 h-8 rounded-full bg-white dark:bg-gray-900 border-2 border-teal-400 dark:border-teal-500 shadow-xs flex items-center justify-center overflow-hidden">
                                    <input type="number" min="0" value={safeInputNumber(testTajweed)} onChange={e => setTestTajweed(Math.max(0, parseSafeNumber(e.target.value)))} onFocus={e => e.target.select()} className="w-full h-full text-center text-sm font-black bg-transparent text-teal-600 dark:text-teal-400 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
             <>
            {initialEvaluation.subject !== "mutoon" && (
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 flex items-center gap-1.5 uppercase">نوع الإنجاز</label>
                <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setEvaluationType(EvaluationType.MEMORIZATION)} className={`py-2 rounded-lg text-[10px] font-black border transition-all ${evaluationType === EvaluationType.MEMORIZATION ? "bg-green-50 border-green-600 text-green-900" : "bg-gray-50 border-transparent dark:bg-gray-800"}`}>حفظ جديد</button>
                    <button type="button" onClick={() => {
                        setEvaluationType(EvaluationType.REVIEW);
                        setPerformance(undefined);
                        setPeriodicReview(undefined);
                    }} className={`py-2 rounded-lg text-[10px] font-black border transition-all ${evaluationType === EvaluationType.REVIEW ? "bg-blue-50 border-blue-600 text-blue-900" : "bg-gray-50 border-transparent dark:bg-gray-800"}`}>مراجعة</button>
                    <button type="button" onClick={() => {
                        setEvaluationType(EvaluationType.DID_NOT_MEMORIZE);
                        setPages("");
                        setAyahRange("");
                        setSelectedSurahs([]);
                        setPerformance(undefined);
                        setPeriodicReview(undefined);
                    }} className={`py-2 rounded-lg text-[10px] font-black border transition-all ${evaluationType === EvaluationType.DID_NOT_MEMORIZE ? "bg-gray-200 border-gray-600 text-gray-900" : "bg-gray-50 border-transparent dark:bg-gray-800"}`}>غير مستعد</button>
                </div>
            </div>
            )}

            {(evaluationType === EvaluationType.MEMORIZATION || evaluationType === EvaluationType.REVIEW || initialEvaluation.subject === "mutoon") && (
                <div className="space-y-2.5 p-3 bg-gray-50/50 dark:bg-slate-800/30 rounded-2xl border border-gray-100 dark:border-slate-800 animate-in slide-in-from-top-1 duration-500">
                    {initialEvaluation.subject === 'mutoon' ? (
                        <div className="space-y-4">
                            {activeMatns.map((m, index) => {
                                const theme = MATN_CARD_THEMES[index % MATN_CARD_THEMES.length];
                                const prevMemorized = (context?.evaluations || [])
                                    .filter(ev => 
                                        ev.studentId === student.id && 
                                        ev.subject === 'mutoon' && 
                                        ev.evaluationType === EvaluationType.MEMORIZATION && 
                                        ev.id !== initialEvaluation.id && 
                                        ev.surahs?.includes(m.name)
                                    )
                                    .reduce((sum, ev) => sum + (ev.pages || 0), 0);

                                const isCompleted = prevMemorized >= m.linesCount;
                                const remaining = Math.max(0, m.linesCount - prevMemorized);
                                const isSelectedMatn = selectedSurahs[0] === m.name;
                                const mPages = isSelectedMatn ? pages : '';
                                const isEvaluated = isSelectedMatn && mPages !== '';

                                const options: number[] = [];
                                if (remaining > 0) {
                                    let curr = 5;
                                    while (curr < remaining) {
                                        options.push(curr);
                                        curr += 5;
                                    }
                                    options.push(remaining);
                                }
                                const uniqueOptions = [...new Set(options)].sort((a, b) => a - b);

                                const from = (isSelectedMatn && typeof mPages === 'number' && mPages > 0) ? (prevMemorized + 1) : '';
                                const to = (isSelectedMatn && typeof mPages === 'number' && mPages > 0) ? (prevMemorized + Number(mPages)) : '';

                                return (
                                    <div
                                        id={`mutoon-edit-card-${index}`}
                                        key={m.id}
                                        className={`p-4 sm:p-5 rounded-2xl border-2 transition-all space-y-4 ${
                                            isEvaluated
                                                ? `${theme.evaluatedBg}`
                                                : `${theme.bg} ${theme.border} shadow-2xs`
                                        }`}
                                    >
                                        {/* رأس بطاقة المتن */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 dark:border-white/10 pb-3">
                                            <div className="flex items-center gap-2.5">
                                                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shadow-2xs ${
                                                    isEvaluated ? theme.numberBadge : theme.numberBadgeInactive
                                                }`}>
                                                    {toArabicDigits(index + 1)}
                                                </span>
                                                <div>
                                                    <h4 className={`font-black text-base sm:text-lg ${theme.title}`}>
                                                        {m.name}
                                                    </h4>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border shadow-2xs ${theme.statBadge}`}>
                                                    المحفوظ: {toArabicDigits(prevMemorized)} / {toArabicDigits(m.linesCount)} بيت
                                                </span>
                                                {isCompleted && (
                                                    <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700">
                                                        ✓ أتم الحفظ
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* اختيار عدد الأبيات */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                            {isCompleted ? (
                                                <div className="sm:col-span-2">
                                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                                                        حالة التقييم لهذا المتن (أتم الحفظ سابقاً):
                                                    </label>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (isSelectedMatn && mPages === 'review') {
                                                                    setPages('');
                                                                    setEvalFath(0);
                                                                } else {
                                                                    setSelectedSurahs([m.name]);
                                                                    setPages('review');
                                                                    setEvalFath(0);
                                                                }
                                                            }}
                                                            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all border ${
                                                                isSelectedMatn && mPages === 'review'
                                                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                                                    : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600'
                                                            }`}
                                                        >
                                                            {isSelectedMatn && mPages === 'review' ? '✓ تم تحديد: مراجعة المتن' : 'تحديد مراجعة المتن لهذا الأسبوع'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (isSelectedMatn && mPages === 'not_ready') {
                                                                    setPages('');
                                                                    setEvalFath(0);
                                                                } else {
                                                                    setSelectedSurahs([m.name]);
                                                                    setPages('not_ready');
                                                                    setEvalFath(0);
                                                                }
                                                            }}
                                                            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all border ${
                                                                isSelectedMatn && mPages === 'not_ready'
                                                                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                                                    : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600'
                                                            }`}
                                                        >
                                                            {isSelectedMatn && mPages === 'not_ready' ? '✓ غير مستعد' : 'غير مستعد'}
                                                        </button>
                                                        {isEvaluated && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPages('');
                                                                    setEvalFath(0);
                                                                }}
                                                                className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-rose-600 transition-colors"
                                                            >
                                                                إلغاء التحديد
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                                                        عدد الأبيات المحفوظة:
                                                    </label>
                                                    <select
                                                        value={isSelectedMatn && mPages !== '' && mPages !== null && mPages !== undefined && !Number.isNaN(mPages) ? mPages : ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setSelectedSurahs([m.name]);
                                                            if (val === 'not_ready') {
                                                                setPages('not_ready');
                                                                setEvalFath(0);
                                                            } else if (val === '') {
                                                                setPages('');
                                                                setEvalFath(0);
                                                            } else {
                                                                setPages(Number(val));
                                                            }
                                                        }}
                                                        className="w-full text-sm font-black bg-white dark:bg-slate-800 rounded-xl border border-gray-300 dark:border-gray-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all p-2.5 shadow-2xs"
                                                    >
                                                        <option value="">اختر عدد الأبيات...</option>
                                                        <option value="not_ready" className="text-red-600 font-bold">غير مستعد (ضعيف)</option>
                                                        {uniqueOptions.map((opt) => (
                                                            <option key={opt} value={opt}>
                                                                {toArabicDigits(opt)} {opt === 1 ? 'بيت' : opt === 2 ? 'بيتان' : opt <= 10 ? 'أبيات' : 'بيتاً'}
                                                                {opt === remaining ? ' (المتبقي بالكامل)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* عرض نطاق الأبيات وزر المعاينة */}
                                            {isSelectedMatn && typeof mPages === 'number' && mPages > 0 && (
                                                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border shadow-2xs bg-white/70 dark:bg-slate-800/70 border-emerald-200 dark:border-emerald-800">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold">
                                                        <span className="text-gray-600 dark:text-gray-300">أرقام الأبيات:</span>
                                                        <span className={`px-2 py-0.5 rounded-md font-black border text-xs shadow-2xs ${theme.rangeBadge}`} dir="rtl">
                                                            {formatRtlRange(`${from} - ${to}`)}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const pastEvals = (context?.evaluations || [])
                                                                .filter(ev => 
                                                                    ev.studentId === student.id && 
                                                                    ev.subject === 'mutoon' && 
                                                                    ev.evaluationType === EvaluationType.MEMORIZATION && 
                                                                    ev.id !== initialEvaluation.id && 
                                                                    ev.weekNumber < initialEvaluation.weekNumber &&
                                                                    ev.surahs?.includes(m.name)
                                                                )
                                                                .sort((a, b) => a.weekNumber - b.weekNumber);

                                                            const priorTotal = pastEvals.reduce((sum, ev) => sum + (ev.pages || 0), 0);
                                                            let prevFrom: number | undefined;
                                                            let prevTo: number | undefined;
                                                            if (pastEvals.length > 0) {
                                                                const lastPrior = pastEvals[pastEvals.length - 1];
                                                                if (lastPrior.pages && lastPrior.pages > 0) {
                                                                    prevTo = priorTotal;
                                                                    prevFrom = priorTotal - lastPrior.pages + 1;
                                                                }
                                                            }

                                                            setViewingVersesModal({
                                                                isOpen: true,
                                                                matnName: m.name,
                                                                fromVerse: Number(from),
                                                                toVerse: Number(to),
                                                                prevFromVerse: prevFrom,
                                                                prevToVerse: prevTo,
                                                            });
                                                        }}
                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                        </svg>
                                                        <span>إظهار الأبيات</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* قسم رصد الأخطاء الخاص بالمتن المحدد */}
                                        {isSelectedMatn && ((typeof mPages === 'number' && mPages > 0) || mPages === 'review') && (
                                            <div className="pt-3 border-t border-black/10 dark:border-white/10">
                                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                                    <div 
                                                        onClick={() => setEvalFath(prev => prev + 1)}
                                                        className="flex-1 flex items-stretch bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/50 dark:to-red-950/40 rounded-2xl border-2 border-rose-300 dark:border-rose-700/80 shadow-xs overflow-hidden group cursor-pointer hover:border-rose-500 dark:hover:border-rose-500 active:scale-[0.99] transition-all h-16 sm:h-20"
                                                    >
                                                        <div className="flex-1 flex items-center justify-between px-4 sm:px-5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm sm:text-base font-black bg-rose-600 text-white px-3 py-1 rounded-xl shadow-xs">+1</span>
                                                                <span className="text-xs sm:text-sm text-rose-700 dark:text-rose-400 font-black">خطأ</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-base sm:text-lg text-rose-950 dark:text-rose-100 group-hover:text-rose-700 select-none">
                                                                    أخطاء متن «{m.name}»
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="px-3 sm:px-4 flex items-center justify-center">
                                                            <div className="w-16 sm:w-20 h-12 sm:h-14 rounded-2xl bg-white dark:bg-gray-900 border-2 border-rose-400 dark:border-rose-500 shadow-2xs flex items-center justify-center overflow-hidden">
                                                                <input 
                                                                    onClick={(e) => e.stopPropagation()} 
                                                                    type="number" 
                                                                    min="0" 
                                                                    value={safeInputNumber(evalFath)} 
                                                                    placeholder="0" 
                                                                    onChange={e => {
                                                                        setEvalFath(Math.max(0, parseSafeNumber(e.target.value)));
                                                                    }} 
                                                                    onFocus={e => e.target.select()} 
                                                                    className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-rose-600 dark:text-rose-400 focus:text-rose-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-2xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-200 dark:placeholder:text-rose-900/40 z-10" 
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-center">
                                                        {(() => {
                                                            let gradeStr = 'ممتاز';
                                                            let gradeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
                                                            if (evalFath === 0) { gradeStr = 'ممتاز (بدون أخطاء)'; gradeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'; }
                                                            else if (evalFath <= 2) { gradeStr = 'ممتاز'; gradeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'; }
                                                            else if (evalFath <= 6) { gradeStr = 'جيد جدا'; gradeClass = 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'; }
                                                            else { gradeStr = 'ضعيف'; gradeClass = 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'; }
                                                            return (
                                                                <span className={`px-5 py-3 rounded-xl text-base font-black border-2 shadow-2xs ${gradeClass}`}>
                                                                    التقييم: {gradeStr}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3 mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700">
                            {selectedSurahs.length > 0 && (
                              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-800 text-xs space-y-1">
                                <p className="font-bold text-indigo-900 dark:text-indigo-200 flex justify-between">
                                  <span>السور:</span>
                                  <span className="font-black text-left">{selectedSurahs.join('، ')}</span>
                                </p>
                                <p className="font-bold text-indigo-900 dark:text-indigo-200 flex justify-between">
                                  <span>الآيات:</span>
                                  <span className="text-green-700 dark:text-green-400">{ayahRange || 'كاملة'}</span>
                                </p>
                              </div>
                            )}

                            <label className="text-xs font-black text-gray-700 dark:text-gray-300 block text-center mb-1">
                              {evaluationType === EvaluationType.REVIEW ? 'تحديد نطاق المراجعة بالأجزاء أو الصفحات أو السور' : 'تحديد الحفظ الجديد بالصفحات أو السور'}
                            </label>

                            <div>
                              <label className="text-[11px] font-black text-gray-700 dark:text-gray-300 block text-center mb-2">
                                  {evaluationType === EvaluationType.REVIEW ? 'اختر الجزء لتحديده بالكامل أو عرض وتحديد صفحاته وسوره للمراجعة:' : 'اختر الجزء لعرض وتحديد صفحاته أو سوره:'}
                                </label>
                                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-1.5 p-2 bg-gray-50/90 dark:bg-gray-800/60 rounded-2xl border border-gray-200/80 dark:border-gray-700">
                              {Array.from({ length: 30 }, (_, i) => i + 1).map(juz => {
                                const isCompleted = completedJuzsSet.has(juz);
                                const isSelected = selectedJuzForPages === juz;
                                const isReviewMode = evaluationType === EvaluationType.REVIEW;
                                const isOldJuz = studentQuranHistory.oldFullJuzs?.has(juz);
                                const isNewJuz = studentQuranHistory.newEvalsFullJuzs?.has(juz);
                                const pagesInJuz = juzPagesMap[juz] || [];
                                const allJuzPagesSelected = pagesInJuz.length > 0 && pagesInJuz.every(p => newMemorizedPages.includes(p));

                                let juzBtnClass = 'bg-white text-indigo-700 border border-indigo-200/80 hover:bg-indigo-50/80 dark:bg-gray-700/80 dark:text-indigo-200 dark:border-gray-600 shadow-2xs';
                                if (isReviewMode) {
                                  if (allJuzPagesSelected) {
                                    juzBtnClass = 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300 dark:ring-emerald-600 font-black';
                                  } else if (isNewJuz) {
                                    juzBtnClass = 'bg-amber-100/90 text-amber-950 border-2 border-[#8B4513]/70 hover:bg-amber-200 font-bold dark:bg-amber-950/60 dark:text-amber-200';
                                  } else if (isOldJuz) {
                                    juzBtnClass = 'bg-emerald-100/90 text-emerald-950 border-2 border-emerald-700/70 hover:bg-emerald-200 font-bold dark:bg-emerald-950/60 dark:text-emerald-200';
                                  } else if (isSelected) {
                                    juzBtnClass = 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-500 font-bold';
                                  }
                                } else {
                                  if (isCompleted) {
                                    juzBtnClass = 'bg-green-800 text-white/90 border border-green-900 cursor-not-allowed opacity-80 dark:bg-green-950 dark:text-green-300 dark:border-green-800 shadow-none';
                                  } else if (isSelected) {
                                    juzBtnClass = 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-500 font-bold';
                                  }
                                }

                                return (
                                  <button
                                    key={juz} 
                                    type="button"
                                    disabled={!isReviewMode && isCompleted}
                                    onClick={() => {
                                      setSelectedJuzForPages(isSelected ? null : juz);
                                    }}
                                    title={isReviewMode ? (isNewJuz ? `جزء ${juz} (حفظ جديد بجميع الأسابيع)` : isOldJuz ? `جزء ${juz} (حفظ قديم)` : `جزء ${juz}`) : (isCompleted ? `جزء ${juz} (مكتمل الحفظ بالكامل مسبقاً)` : `جزء ${juz}`)}
                                    className={`p-1.5 sm:p-2 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center min-h-[46px] sm:min-h-[50px] active:scale-95 cursor-pointer ${juzBtnClass}`}
                                  >
                                    <span className={`text-[11px] sm:text-xs font-black leading-tight ${!isReviewMode && isCompleted ? 'line-through decoration-white/70' : ''}`}>جزء {juz}</span>
                                    {isReviewMode ? (
                                      allJuzPagesSelected ? (
                                        <span className="text-[8px] sm:text-[9px] font-bold bg-white/20 px-1 rounded leading-tight">محدد ✓</span>
                                      ) : isNewJuz ? (
                                        <span className="text-[8px] sm:text-[9px] font-bold opacity-95 leading-tight">جديد 🟤</span>
                                      ) : isOldJuz ? (
                                        <span className="text-[8px] sm:text-[9px] font-bold opacity-95 leading-tight">قديم 🟢</span>
                                      ) : null
                                    ) : (
                                      isCompleted && (
                                        <span className="text-[8px] sm:text-[9px] font-bold opacity-95 no-underline leading-tight">مكتمل ✓</span>
                                      )
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            {selectedJuzForPages && (
                              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-xl border-2 border-indigo-100 dark:border-gray-700 space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2">
                                  <p className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">محتوى الجزء {selectedJuzForPages}</p>
                                  <div className="flex items-center gap-2">
                                    {evaluationType === EvaluationType.REVIEW && (
                                      <button
                                        type="button"
                                        onClick={() => toggleFullJuz(selectedJuzForPages)}
                                        className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                      >
                                        {(juzPagesMap[selectedJuzForPages] || []).every(p => newMemorizedPages.includes(p)) ? 'إلغاء تحديد الجزء' : 'تحديد كل صفحات الجزء'}
                                      </button>
                                    )}
                                    <div className="flex bg-gray-100 dark:bg-gray-900/90 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-inner gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setQuranSelectionTab('pages')}
                                        className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer ${
                                          quranSelectionTab === 'pages'
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md ring-2 ring-emerald-300 dark:ring-emerald-700'
                                            : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800'
                                        }`}
                                      >
                                        <span className="text-xs">📄</span>
                                        <span>الصفحات</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setQuranSelectionTab('surahs')}
                                        className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer ${
                                          quranSelectionTab === 'surahs'
                                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-700'
                                            : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800'
                                        }`}
                                      >
                                        <span className="text-xs">📜</span>
                                        <span>السور</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {quranSelectionTab === 'pages' && (
                                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                    {juzPagesMap[selectedJuzForPages]?.map(page => {
                                      const isReviewMode = evaluationType === EvaluationType.REVIEW;
                                      const hist = getPageHistory(page);
                                      const isPrevWeekFull = hist === 'PREV_WEEK_FULL';
                                      const isPrevWeekPartial = hist === 'PREV_WEEK_PARTIAL';
                                      const isPriorFull = hist === 'PRIOR_FULL';
                                      const isPriorPartial = hist === 'PRIOR_PARTIAL';
                                      
                                      const isOldPage = studentQuranHistory.oldFullPages?.has(page) || isPriorFull;
                                      const isNewPage = studentQuranHistory.newEvalsFullPages?.has(page) || isPrevWeekFull;
                                      const isDirectPage = selectionState.directPages.has(page);
                                      const isDerivedPage = selectionState.derivedPages.has(page);

                                      let btnStyle = 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300';
                                      let title = undefined;

                                      if (isReviewMode) {
                                        if (isDirectPage) {
                                          btnStyle = 'bg-green-500 text-white shadow-sm scale-105 font-bold ring-2 ring-green-300';
                                          title = 'محددة للمراجعة';
                                        } else if (isDerivedPage) {
                                          btnStyle = 'bg-green-100 text-green-900 border-2 border-dashed border-green-600 font-bold dark:bg-green-950/40 dark:text-green-200 dark:border-green-500';
                                          title = 'محددة عبر اختيار السورة';
                                        } else if (isNewPage) {
                                          btnStyle = 'bg-[#8B4513] text-white shadow-sm hover:opacity-90 border border-[#5c2e0b]';
                                          title = 'حفظ جديد (جميع الأسابيع)';
                                        } else if (isOldPage) {
                                          btnStyle = 'bg-green-800 text-white opacity-90 hover:opacity-100 dark:bg-green-900 dark:text-green-100 border border-green-900';
                                          title = 'حفظ قديم';
                                        }
                                      } else {
                                        if (isPrevWeekFull) {
                                          btnStyle = 'bg-[#8B4513] text-white shadow-sm cursor-not-allowed border border-[#5c2e0b]';
                                          title = 'تم حفظها بالكامل في الأسبوع السابق';
                                        } else if (isPriorFull) {
                                          btnStyle = 'bg-green-800 text-white opacity-90 cursor-not-allowed dark:bg-green-900 dark:text-green-100 border border-green-900';
                                          title = 'تم حفظها بالكامل في الأسابيع السابقة';
                                        } else if (isDirectPage) {
                                          btnStyle = 'bg-green-500 text-white shadow-sm scale-105 font-bold ring-2 ring-green-300';
                                          title = 'محددة مباشرة برقم الصفحة';
                                        } else if (isDerivedPage) {
                                          btnStyle = 'bg-green-100 text-green-900 border-2 border-dashed border-green-600 font-bold dark:bg-green-950/40 dark:text-green-200 dark:border-green-500';
                                          title = 'محددة عبر اختيار السورة في تبويب السور';
                                        } else if (isPrevWeekPartial) {
                                          btnStyle = 'bg-amber-50 text-[#8B4513] border-2 border-dashed border-[#8B4513] font-bold hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300';
                                          title = 'صفحة غير مكتملة من الأسبوع السابق (منقطة الإطار - قابلة للتحديد)';
                                        } else if (isPriorPartial) {
                                          btnStyle = 'bg-emerald-50 text-emerald-900 border-2 border-dashed border-green-800 font-bold hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200';
                                          title = 'صفحة غير مكتملة من الأسابيع السابقة (منقطة الإطار - قابلة للتحديد)';
                                        }
                                      }

                                      return (
                                        <button
                                          key={page}
                                          type="button"
                                          onClick={() => toggleNewPage(page)}
                                          disabled={!isReviewMode && (isPrevWeekFull || isPriorFull)}
                                          title={title}
                                          className={`p-1.5 rounded-lg font-bold text-[10px] flex items-center justify-center transition-all ${btnStyle}`}
                                        >
                                          {page}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {quranSelectionTab === 'surahs' && (
                                  <div>
                                    {(!juzSurahsMap[selectedJuzForPages] || juzSurahsMap[selectedJuzForPages].length === 0) ? (
                                      <p className="text-center text-[10px] text-gray-500 py-3">لا توجد سور في هذا الجزء</p>
                                    ) : (
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {juzSurahsMap[selectedJuzForPages].map(sId => {
                                          const isReviewMode = evaluationType === EvaluationType.REVIEW;
                                          const hist = getSurahHistory(sId);
                                          const isPrevWeekFull = hist === 'PREV_WEEK_FULL';
                                          const isPriorFull = hist === 'PRIOR_FULL';

                                          const isOldSurah = studentQuranHistory.oldFullSurahs?.has(sId) || isPriorFull;
                                          const isNewSurah = studentQuranHistory.newEvalsFullSurahs?.has(sId) || isPrevWeekFull;
                                          const isDirectSurah = selectionState.directSurahs.has(sId);
                                          const isDerivedSurah = selectionState.derivedSurahs.has(sId);

                                          let btnStyle = 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300';
                                          let title = undefined;

                                          if (isReviewMode) {
                                            if (isDirectSurah) {
                                              btnStyle = 'bg-green-500 text-white shadow-sm scale-105 font-bold ring-2 ring-green-300';
                                              title = 'محددة للمراجعة';
                                            } else if (isDerivedSurah) {
                                              btnStyle = 'bg-green-100 text-green-900 border-2 border-dashed border-green-600 font-bold dark:bg-green-950/40 dark:text-green-200 dark:border-green-500';
                                              title = 'محددة جزئياً أو كلياً عبر الصفحات';
                                            } else if (isNewSurah) {
                                              btnStyle = 'bg-[#8B4513] text-white shadow-sm hover:opacity-90 border border-[#5c2e0b]';
                                              title = 'حفظ جديد (جميع الأسابيع)';
                                            } else if (isOldSurah) {
                                              btnStyle = 'bg-green-800 text-white opacity-90 hover:opacity-100 dark:bg-green-900 dark:text-green-100 border border-green-900';
                                              title = 'حفظ قديم';
                                            }
                                          } else {
                                            if (isPrevWeekFull) {
                                              btnStyle = 'bg-[#8B4513] text-white shadow-sm cursor-not-allowed border border-[#5c2e0b]';
                                              title = 'تم حفظ السورة بالكامل في الأسبوع السابق';
                                            } else if (isPriorFull) {
                                              btnStyle = 'bg-green-800 text-white opacity-90 cursor-not-allowed dark:bg-green-900 dark:text-green-100 border border-green-900';
                                              title = 'تم حفظ السورة بالكامل في الأسابيع السابقة';
                                            } else if (isDirectSurah) {
                                              btnStyle = 'bg-green-500 text-white shadow-sm scale-105 font-bold ring-2 ring-green-300';
                                              title = 'محددة كـ سورة كاملة';
                                            } else if (isDerivedSurah) {
                                              btnStyle = 'bg-green-100 text-green-900 border-2 border-dashed border-green-600 font-bold dark:bg-green-950/40 dark:text-green-200 dark:border-green-500';
                                              title = 'محددة جزئياً أو كلياً عبر اختيار رقم الصفحة في تبويب الصفحات';
                                            }
                                          }

                                          return (
                                            <button
                                              key={sId}
                                              type="button"
                                              onClick={() => toggleSurah(sId)}
                                              disabled={!isReviewMode && (isPrevWeekFull || isPriorFull)}
                                              title={title}
                                              className={`p-1.5 rounded-lg font-bold text-[10px] flex items-center justify-center transition-all ${btnStyle}`}
                                            >
                                              {surahNames[sId]}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            </div>

                            <div className="text-center text-[10px] font-bold mt-1 text-green-700 dark:text-green-400">
                              {evaluationType === EvaluationType.REVIEW ? (
                                selectionState.allActivePages.length > 0 ? (
                                  <>
                                    تم تحديد ({selectionState.allActivePages.length}) صفحة للمراجعة
                                  </>
                                ) : (selectedSurahs.length > 0 ? `تم تحديد (${selectedSurahs.length}) سور للمراجعة` : 'لم يتم تحديد صفحات أو سور للمراجعة بعد')
                              ) : (
                                selectionState.allActivePages.length > 0 ? (
                                  <>
                                    تم تحديد ({selectionState.newPagesCount}) صفحة جديدة
                                    {selectionState.recompletedPagesCount > 0 && (
                                      <span className="text-[9px] text-amber-700 dark:text-amber-300 mr-1 font-normal">
                                        (تم استثناء {selectionState.recompletedPagesCount} صفحة محسوبة مسبقاً)
                                      </span>
                                    )}
                                  </>
                                ) : (selectedSurahs.length > 0 ? `تم تحديد (${selectedSurahs.length}) سور` : 'لم يتم تحديد صفحات أو سور بعد')
                              )}
                            </div>
                        </div>
                    )}
                    
                    {initialEvaluation.subject !== 'mutoon' && (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between gap-2 shadow-xs">
                        <div className="flex items-center gap-2 text-right">
                          <span className="text-base">📖</span>
                          <span className="text-[11px] font-black text-emerald-950 dark:text-emerald-200">
                            مصحف التسميع (طبعة 1405هـ)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMushafModalOpen(true)}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-[11px] font-black rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <span>فتح المصحف</span>
                          <span className="bg-emerald-900/60 text-emerald-200 text-[9px] px-1.5 py-0.5 rounded-full border border-emerald-500/40">
                            {selectionState.allActivePages.length + Array.from(previousWeekPages).filter(p => !selectionState.allActivePages.includes(p)).length} ص
                          </span>
                        </button>
                      </div>
                    )}

                    {initialEvaluation.subject !== 'mutoon' && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-800 pb-1">
                            {evaluationType === EvaluationType.REVIEW ? 'أخطاء المراجعة والدرجة' : 'سجل الأخطاء'}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {/* الفتح */}
                            <div 
                                onClick={() => setEvalFath(prev => prev + 1)}
                                className="flex items-stretch bg-gradient-to-r from-rose-50/90 to-red-50/70 dark:from-rose-950/40 dark:to-red-950/30 rounded-xl border-2 border-rose-200 dark:border-rose-800/70 overflow-hidden group cursor-pointer hover:border-rose-400 active:scale-[0.99] transition-all h-14 sm:h-16"
                            >
                                <div className="flex-1 flex items-center justify-between px-3">
                                    <span className="text-xs font-black bg-rose-600 text-white px-2 py-0.5 rounded-lg shadow-xs">{evaluationType === EvaluationType.REVIEW ? '-1' : '+1'}</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs font-black text-rose-950 dark:text-rose-100">أخطاء الفتح</span>
                                    </div>
                                </div>
                                <div className="px-2.5 flex items-center justify-center">
                                    <div className="w-14 h-9 rounded-xl bg-white dark:bg-gray-900 border-2 border-rose-400 dark:border-rose-500 shadow-xs flex items-center justify-center overflow-hidden">
                                        <input 
                                            onClick={(e) => e.stopPropagation()} 
                                            type="number" 
                                            min="0" 
                                            value={safeInputNumber(evalFath)} 
                                            placeholder="0" 
                                            onChange={e => setEvalFath(Math.max(0, parseSafeNumber(e.target.value)))} 
                                            onFocus={e => e.target.select()} 
                                            className="w-full h-full text-center text-base font-black bg-transparent text-rose-600 dark:text-rose-400 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-200 z-10" 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* التشكيل */}
                            <div 
                                onClick={() => setEvalTashkeel(prev => (prev || 0) + 1)}
                                className="flex items-stretch bg-gradient-to-r from-amber-50/90 to-orange-50/70 dark:from-amber-950/40 dark:to-orange-950/30 rounded-xl border-2 border-amber-200 dark:border-amber-800/70 overflow-hidden group cursor-pointer hover:border-amber-400 active:scale-[0.99] transition-all h-14 sm:h-16"
                            >
                                <div className="flex-1 flex items-center justify-between px-3">
                                    <span className="text-xs font-black bg-amber-600 text-white px-2 py-0.5 rounded-lg shadow-xs">{evaluationType === EvaluationType.REVIEW ? '-1' : '+1'}</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs font-black text-amber-950 dark:text-amber-100">أخطاء التشكيل</span>
                                    </div>
                                </div>
                                <div className="px-2.5 flex items-center justify-center">
                                    <div className="w-14 h-9 rounded-xl bg-white dark:bg-gray-900 border-2 border-amber-400 dark:border-amber-500 shadow-xs flex items-center justify-center overflow-hidden">
                                        <input 
                                            onClick={(e) => e.stopPropagation()} 
                                            type="number" 
                                            min="0" 
                                            value={safeInputNumber(evalTashkeel)} 
                                            placeholder="0" 
                                            onChange={e => setEvalTashkeel(Math.max(0, parseSafeNumber(e.target.value)))} 
                                            onFocus={e => e.target.select()} 
                                            className="w-full h-full text-center text-base font-black bg-transparent text-amber-600 dark:text-amber-400 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-amber-200 z-10" 
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* التجويد */}
                            <div 
                                onClick={() => setEvalTajweed(prev => (prev || 0) + 1)}
                                className="flex items-stretch bg-gradient-to-r from-teal-50/90 to-emerald-50/70 dark:from-teal-950/40 dark:to-emerald-950/30 rounded-xl border-2 border-teal-200 dark:border-teal-800/70 overflow-hidden group cursor-pointer hover:border-teal-400 active:scale-[0.99] transition-all h-14 sm:h-16"
                            >
                                <div className="flex-1 flex items-center justify-between px-3">
                                    <span className="text-xs font-black bg-teal-600 text-white px-2 py-0.5 rounded-lg shadow-xs">{evaluationType === EvaluationType.REVIEW ? '-0.5' : '+0.5'}</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs font-black text-teal-950 dark:text-teal-100">أخطاء التجويد</span>
                                    </div>
                                </div>
                                <div className="px-2.5 flex items-center justify-center">
                                    <div className="w-14 h-9 rounded-xl bg-white dark:bg-gray-900 border-2 border-teal-400 dark:border-teal-500 shadow-xs flex items-center justify-center overflow-hidden">
                                        <input 
                                            onClick={(e) => e.stopPropagation()} 
                                            type="number" 
                                            min="0" 
                                            value={safeInputNumber(evalTajweed)} 
                                            placeholder="0" 
                                            onChange={e => setEvalTajweed(Math.max(0, parseSafeNumber(e.target.value)))} 
                                            onFocus={e => e.target.select()} 
                                            className="w-full h-full text-center text-base font-black bg-transparent text-teal-600 dark:text-teal-400 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-teal-200 z-10" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    )}
                    
                    {evaluationType === EvaluationType.REVIEW ? (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-1">
                        <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 font-bold px-1">
                          <span>إجمالي الخصم: <strong className="text-rose-600 dark:text-rose-400 text-sm">-{(evalFath * 1) + (evalTashkeel * 1) + (evalTajweed * 0.5)}</strong> درجة</span>
                          <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-md font-black">الدرجة من 100</span>
                        </div>
                        <div className="flex justify-between items-center font-black text-indigo-900 dark:text-indigo-200 text-sm sm:text-base pt-1">
                          <span>الدرجة النهائية للمراجعة:</span>
                          <span className="bg-white dark:bg-gray-900 px-3 py-1 rounded-xl border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-base font-black shadow-xs">
                            {Math.max(0, 100 - ((evalFath * 1) + (evalTashkeel * 1) + (evalTajweed * 0.5)))} / 100
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-gray-500 uppercase mr-1">مستوى الأداء (مُحسَب تلقائياً):</label>
                            <div className="py-2 px-4 rounded-lg font-black border bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm text-xs text-center dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300">
                                {performance ? translationMap[performance] : '—'}
                            </div>
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-gray-500 uppercase mr-1">المراجعة الدورية:</label>
                            <div className="grid grid-cols-3 gap-1">
                                {Object.values(PeriodicReviewStatus).map(s => (
                                    <button key={s} type="button" onClick={() => setPeriodicReview(s)} className={`py-1 rounded-md text-[8px] font-black border transition-all ${periodicReview === s ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white dark:bg-slate-800 border-transparent text-gray-500'}`}>{translationMap[s]}</button>
                                ))}
                            </div>
                        </div>
                      </>
                    )}
                </div>
            )}
             </>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 flex items-center gap-1.5 uppercase">ملاحظات</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full h-12 text-[9px] p-2 leading-tight bg-gray-50/50 dark:bg-slate-800/30 rounded-lg border border-gray-100 dark:border-slate-800 focus:border-green-500 outline-none transition-all resize-none" placeholder="اكتب ملاحظاتك..." />
        </div>
      </form>
      ) : (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
          <div className="bg-gray-50 p-4 rounded-2xl space-y-3 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 shadow-inner text-sm">
            <p className="flex justify-between items-center">
              <strong>الطالب:</strong> 
              <span className="text-green-800 dark:text-green-300 font-bold flex flex-col items-end">
                <span>{student.name}</span>
                {student.isAlAmeen && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal leading-tight mt-0.5">
                    (من طلاب الأمين)
                  </span>
                )}
              </span>
            </p>
            <p className="flex justify-between"><strong>{draftEvaluation?.isTest ? 'الاختبار:' : 'الأسبوع:'}</strong> <span>{draftEvaluation?.isTest ? (draftEvaluation?.testName || 'الاختبار') : draftEvaluation?.weekNumber}</span></p>
            {!draftEvaluation?.isTest && (
                <>
                    <p className="flex justify-between"><strong>الحالة:</strong> <span>{draftEvaluation?.attendance === AttendanceStatus.PRESENT ? '✅ حاضر' : draftEvaluation?.attendance === AttendanceStatus.LATE ? '🕒 متأخر' : draftEvaluation?.attendance === AttendanceStatus.UNPREPARED ? '⚠️ غير حافظ' : '🚫 غائب'}</span></p>
                    {draftEvaluation?.attendance === AttendanceStatus.ABSENT && draftEvaluation.absenceReason && (
                        <p className="flex justify-between"><strong>سبب الغياب:</strong> <span>{translationMap[draftEvaluation.absenceReason]}</span></p>
                    )}
                </>
            )}
            {(draftEvaluation?.attendance === AttendanceStatus.PRESENT || draftEvaluation?.attendance === AttendanceStatus.LATE) && !draftEvaluation?.isTest && (
              <>
                <p className="flex justify-between"><strong>نوع الإنجاز:</strong> <span>{translationMap[draftEvaluation.evaluationType!]}</span></p>
                {draftEvaluation.evaluationType === EvaluationType.MEMORIZATION && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                    <p className="flex justify-between"><strong>{draftEvaluation.subject === 'mutoon' ? 'عدد الأبيات:' : 'عدد الصفحات:'}</strong> <span>{draftEvaluation.subject === 'mutoon' ? (draftEvaluation.pages ?? '—') : (draftEvaluation.pages !== null && draftEvaluation.pages !== undefined ? draftEvaluation.pages : (draftEvaluation.newMemorizedPages?.length ?? '—'))}</span></p>
                    {draftEvaluation.subject !== 'mutoon' && (
                      <>
                        {draftEvaluation.newMemorizedPages && draftEvaluation.newMemorizedPages.length > 0 && (
                          <p className="flex justify-between">
                            <strong>أرقام الصفحات:</strong> 
                            <span className="font-bold text-emerald-800 dark:text-emerald-300">
                              {draftEvaluation.newMemorizedPages.map(toArabicDigits).join('، ')}
                            </span>
                          </p>
                        )}
                        <p className="flex justify-between items-center">
                          <strong>السور:</strong> 
                          <span className="text-left flex-1 mr-4 font-bold text-gray-800 dark:text-gray-200 break-words">{draftEvaluation.surahs?.join('، ') || '—'}</span>
                        </p>
                        <p className="flex justify-between items-center">
                          <strong>الآيات:</strong> 
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{draftEvaluation.fromAyah && draftEvaluation.toAyah ? (draftEvaluation.fromAyah === draftEvaluation.toAyah ? draftEvaluation.fromAyah : `${draftEvaluation.fromAyah}-${draftEvaluation.toAyah}`) : (draftEvaluation.surahs?.length ? 'كاملة' : '—')}</span>
                        </p>
                        {((draftEvaluation.evalFathErrors || 0) > 0 || (draftEvaluation.evalTashkeelErrors || 0) > 0 || (draftEvaluation.evalTajweedErrors || 0) > 0) && (
                          <p className="flex justify-between">
                            <strong>أخطاء التسميع:</strong>
                            <span className="text-gray-700 dark:text-gray-300">
                              الفتح: {toArabicDigits(draftEvaluation.evalFathErrors || 0)} | التشكيل: {toArabicDigits(draftEvaluation.evalTashkeelErrors || 0)} | التجويد: {toArabicDigits(draftEvaluation.evalTajweedErrors || 0)} (المجموع: {toArabicDigits((draftEvaluation.evalFathErrors || 0) + (draftEvaluation.evalTashkeelErrors || 0) + (draftEvaluation.evalTajweedErrors || 0))})
                            </span>
                          </p>
                        )}
                      </>
                    )}
                    {draftEvaluation.subject === 'mutoon' && <p className="flex justify-between"><strong>الأبيات:</strong> <span>{draftEvaluation.fromAyah && draftEvaluation.toAyah ? (draftEvaluation.fromAyah === draftEvaluation.toAyah ? draftEvaluation.fromAyah : `${draftEvaluation.fromAyah}-${draftEvaluation.toAyah}`) : (draftEvaluation.fromAyah || '—')}</span></p>}
                    {draftEvaluation.subject === 'mutoon' && <p className="flex justify-between"><strong>المتون:</strong> <span className="text-left flex-1 mr-4 break-words">{draftEvaluation.surahs?.join(', ') || '—'}</span></p>}
                    <p className="flex justify-between"><strong>الأداء:</strong> <span>{draftEvaluation.performance ? translationMap[draftEvaluation.performance] : '—'}</span></p>
                    <p className="flex justify-between"><strong>المراجعة الدورية:</strong> <span>{draftEvaluation.periodicReview ? translationMap[draftEvaluation.periodicReview] : '—'}</span></p>
                  </div>
                )}
                {draftEvaluation.evaluationType === EvaluationType.REVIEW && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                    <p className="flex justify-between font-bold text-indigo-700 dark:text-indigo-400 text-base">
                      <strong>درجة المراجعة:</strong> 
                      <span>{draftEvaluation.testTotalScore ?? 100} / 100</span>
                    </p>
                    {draftEvaluation.newMemorizedPages && draftEvaluation.newMemorizedPages.length > 0 && (
                      <p className="flex justify-between">
                        <strong>صفحات المراجعة:</strong> 
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">
                          {draftEvaluation.newMemorizedPages.map(toArabicDigits).join('، ')} ({draftEvaluation.newMemorizedPages.length} صفحة)
                        </span>
                      </p>
                    )}
                    {draftEvaluation.surahs && draftEvaluation.surahs.length > 0 && (
                      <p className="flex justify-between items-center">
                        <strong>السور المراجعة:</strong> 
                        <span className="text-left flex-1 mr-4 font-bold text-gray-800 dark:text-gray-200 break-words">{draftEvaluation.surahs.join('، ')}</span>
                      </p>
                    )}
                    <p className="flex justify-between text-gray-600 dark:text-gray-400"><strong>أخطاء الفتح (-1):</strong> <span>{draftEvaluation.evalFathErrors || 0}</span></p>
                    <p className="flex justify-between text-gray-600 dark:text-gray-400"><strong>أخطاء التشكيل (-1):</strong> <span>{draftEvaluation.evalTashkeelErrors || 0}</span></p>
                    <p className="flex justify-between text-gray-600 dark:text-gray-400"><strong>أخطاء التجويد (-0.5):</strong> <span>{draftEvaluation.evalTajweedErrors || 0}</span></p>
                  </div>
                )}
              </>
            )}
            {draftEvaluation?.isTest && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2 text-sm">
                    <p className="flex justify-between font-bold text-indigo-700 dark:text-indigo-400 text-base"><strong>نتيجة الاختبار:</strong> <span>{draftEvaluation.testTotalScore} / {draftEvaluation.testMaxScore}</span></p>
                    <p className="flex justify-between text-gray-600 dark:text-gray-400"><strong>أخطاء الفتح:</strong> <span>{draftEvaluation.testFathErrors}</span></p>
                    <p className="flex justify-between text-gray-600 dark:text-gray-400"><strong>أخطاء التشكيل:</strong> <span>{draftEvaluation.testTashkeelErrors}</span></p>
                    <p className="flex justify-between text-gray-600 dark:text-gray-400"><strong>أخطاء التجويد:</strong> <span>{draftEvaluation.testTajweedErrors}</span></p>
                </div>
            )}
            {draftEvaluation?.notes && <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600"><p><strong>ملاحظات:</strong></p><p className="text-xs italic text-gray-600 dark:text-gray-400 mt-1">{draftEvaluation.notes}</p></div>}
          </div>
        </div>
      )}

      <MushafReaderModal
        isOpen={isMushafModalOpen}
        onClose={() => setIsMushafModalOpen(false)}
        newPages={selectionState.allActivePages}
        previousWeekPages={previousWeekPages}
        studentName={student?.name}
        evalFath={initialEvaluation.isTest ? testFath : evalFath}
        setEvalFath={initialEvaluation.isTest ? setTestFath : setEvalFath}
        evalTashkeel={initialEvaluation.isTest ? testTashkeel : evalTashkeel}
        setEvalTashkeel={initialEvaluation.isTest ? setTestTashkeel : setEvalTashkeel}
        evalTajweed={initialEvaluation.isTest ? testTajweed : evalTajweed}
        setEvalTajweed={initialEvaluation.isTest ? setTestTajweed : setEvalTajweed}
      />
      {pendingMatnsAlert && (
          <Modal title="تنبيه: استكمال المتون" onClose={() => setPendingMatnsAlert(null)} hideDefaultCloseButton={true}>
             <div className="text-center py-2 space-y-4">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">تعديل غير مكتمل</h3>
                <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                    لا يمكن حفظ التعديل. سيؤدي هذا إلى ترك المتون التالية غير مقيمة لهذا الأسبوع:
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {pendingMatnsAlert.map(m => (
                        <span key={m} className="bg-amber-50 text-amber-700 border border-amber-200 px-4 py-1.5 rounded-lg text-sm font-black dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300">
                            {m}
                        </span>
                    ))}
                </div>
                <button onClick={() => setPendingMatnsAlert(null)} className="mt-6 w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black shadow-lg active:scale-95 transition-all">
                    تراجع
                </button>
             </div>
          </Modal>
      )}

      {viewingVersesModal && (
        <MatnVersesModal
          isOpen={viewingVersesModal.isOpen}
          onClose={() => setViewingVersesModal(null)}
          matnName={viewingVersesModal.matnName}
          fromVerse={viewingVersesModal.fromVerse}
          toVerse={viewingVersesModal.toVerse}
          matns={matns}
          prevFromVerse={viewingVersesModal.prevFromVerse}
          prevToVerse={viewingVersesModal.prevToVerse}
        />
      )}
    </Modal>
  );
};

export default EvaluationEditForm;
