
import React, { useState, useContext, useMemo, useEffect, useRef, useCallback } from 'react';
import { AppContext } from '../App';
import { QURAN_SURAHS } from '../constants';
import { Student, AttendanceStatus, AbsenceReason, EvaluationType, PerformanceLevel, PeriodicReviewStatus, Evaluation, SardEvaluation, SardHalaqa, SardPageRange } from '../types';
import { BookOpen, ScrollText, Sparkles } from "lucide-react";
import Modal from './Modal';
import { translationMap, toArabicDigits, formatRtlRange } from '../utils/exportWord';
import { toEnglishDigits, parseSafeNumber, safeInputNumber, safeNumberVal } from '../utils/juzUtils';
import EvaluationSummaryModal from './EvaluationSummaryModal';
import EvaluationEditForm from './EvaluationEditForm';
import MushafReaderModal from './MushafReaderModal';
import { MatnVersesModal } from './MatnVersesModal';
import { SardEvaluationEditModal } from './SardEvaluationEditModal';
import { calculateSardTotalErrors, calculateSardGrade, getSardGradeBadgeClass } from '../utils/sardUtils';
import { isSmartMatch } from '../utils/searchUtils';
import { registerBackHandler } from '../utils/navigationHistory';
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
  analyzeStudentQuranHistory,
  StudentQuranHistory
} from '../utils/quranData';
import { StudentProgressInfo } from './StudentProgressInfo';
import { getMemorizedPagesData, getCompletedJuzs, countQuranPages } from '../utils/pageUtils';
import { preloadMushafPages } from '../utils/mushafPreload';

interface EvaluationFormProps {
  teacherId: number;
  onFormSubmit: (action: 'add' | 'update' | 'delete') => void;
  onBackToMenu?: () => void;
  onStepChange?: (step: FormStep) => void;
}

const mapOldPerformanceToNew = (oldPerf?: string): PerformanceLevel | undefined => {
  if (!oldPerf) return undefined;
  if (oldPerf === 'excellent') return PerformanceLevel.EXCELLENT;
  if (oldPerf === 'very_good') return PerformanceLevel.ONE_ERROR;
  if (oldPerf === 'good') return PerformanceLevel.THREE_ERRORS;
  if (oldPerf === 'did_not_memorize') return PerformanceLevel.MORE_THAN_FIVE_ERRORS;
  return oldPerf as PerformanceLevel;
};

const SURAH_JUZ_MAPPING: Record<string, number[]> = {
  "الفاتحة": [1], "البقرة": [1, 2, 3], "آل عمران": [3, 4], "النساء": [4, 5, 6],
  "المائدة": [6, 7], "الأنعام": [7, 8], "الأعراف": [8, 9], "الأنفال": [9, 10], "التوبة": [10, 11],
  "يونس": [11], "هود": [11, 12], "يوسف": [12, 13], "الرعد": [13], "إبراهيم": [13],
  "الحجر": [14], "النحل": [14], "الإسراء": [15], "الكهف": [15, 16], "مريم": [16], "طه": [16],
  "الأنبياء": [17], "الحج": [17], "المؤمنون": [18], "النور": [18], "الفرقان": [18, 19],
  "الشعراء": [19], "النمل": [19, 20], "القصص": [20], "العنكبوت": [20, 21], "الروم": [21],
  "لقمان": [21], "السجدة": [21], "الأحزاب": [21, 22], "سبأ": [22], "فاطر": [22], "يس": [22, 23],
  "الصافات": [23], "ص": [23], "الزمر": [23, 24], "غافر": [24], "فصلت": [24, 25], "الشورى": [25],
  "الزخرف": [25], "الدخان": [25], "الجاثية": [25], "الأحقاف": [26], "محمد": [26], "الفتح": [26],
  "الحجرات": [26], "ق": [26], "الذاريات": [26, 27], "الطور": [27], "النجم": [27], "القمر": [27],
  "الرحمن": [27], "الواقعة": [27], "الحديد": [27], "المجادلة": [28], "الحشر": [28], "الممتحنة": [28],
  "الصف": [28], "الجمعة": [28], "المنافقون": [28], "التغابن": [28], "الطلاق": [28], "التحريم": [28],
  "الملك": [29], "القلم": [29], "الحاقة": [29], "المعارج": [29], "نوح": [29], "الجن": [29],
  "المزمل": [29], "المدثر": [29], "القيامة": [29], "الإنسان": [29], "المرسلات": [29], "النبأ": [30],
  "النازعات": [30], "عبس": [30], "التكوير": [30], "الإنفطار": [30], "المطففين": [30], "الإنشقاق": [30],
  "البروج": [30], "الطارق": [30], "الأعلى": [30], "الغاشية": [30], "الفجر": [30], "البلد": [30],
  "الشمس": [30], "الليل": [30], "الضحى": [30], "الشرح": [30], "التين": [30], "العلق": [30],
  "القدر": [30], "البينة": [30], "الزلزلة": [30], "العاديات": [30], "القارعة": [30], "التكاثر": [30],
  "العصر": [30], "الهمزة": [30], "الفيل": [30], "قريش": [30], "الماعون": [30], "الكوثر": [30],
  "الكافرون": [30], "النصر": [30], "المسد": [30], "الإخلاص": [30], "الفلق": [30], "الناس": [30]
};

type FormStep = 'selectHalaqa' | 'selectWeek' | 'selectSubject' | 'selectStudent' | 'testStep' | 'selectAttendance' | 'selectAbsenceReason' | 'selectEvaluationType' | 'memorizationDetails' | 'selectPerformanceLevel' | 'periodicReviewStatus' | 'sardContentSelection' | 'sardErrorsStep' | 'sardEvaluationDetails' | 'notesStep' | 'summaryAndConfirm' | 'mutoonEvaluation';

interface NavProps {
  back?: () => void;
  next?: () => void;
  sub?: string;
  onEdit?: () => void;
  isSticky?: boolean;
}

const FormNav: React.FC<NavProps> = ({ back, next, sub, onEdit, isSticky = true }) => (
  <div className={`flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center border-t pt-4 mt-6 ${isSticky ? 'sticky bottom-0 z-10' : ''} bg-white dark:bg-gray-800 py-4 gap-3`}>
    {back && <button type="button" onClick={back} className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-xl dark:bg-gray-700 dark:text-gray-200 font-bold shadow-sm active:scale-95 text-center w-full sm:w-auto">رجوع</button>}
    <div className="flex flex-col sm:flex-row gap-2 flex-grow sm:flex-grow-0">
      {onEdit && <button type="button" onClick={onEdit} className="px-6 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors shadow-sm active:scale-95 text-center w-full sm:w-auto">تعديل البيانات</button>}
      {next && <button type="button" onClick={next} className="px-6 py-2.5 bg-green-700 text-white rounded-xl font-bold hover:bg-green-800 transition-colors shadow-sm active:scale-95 text-center w-full sm:w-auto">التالي</button>}
      {sub && <button type="submit" className="px-8 py-2.5 bg-green-700 text-white rounded-xl font-bold hover:bg-green-800 transition-all shadow-lg active:scale-95 text-center w-full sm:w-auto">{sub}</button>}
    </div>
  </div>
);

export const EvaluationForm: React.FC<EvaluationFormProps> = ({ teacherId, onFormSubmit, onBackToMenu, onStepChange }) => {
  const context = useContext(AppContext);

  const students = context?.students || [];
  const halaqas = context?.halaqas || [];
  const evaluations = context?.evaluations || [];
  const sardHalaqas = context?.sardHalaqas || [];
  const sardEvaluations = context?.sardEvaluations || [];
  const matns = context?.matns || [];
  const addEvaluation = context?.addEvaluation;
  const updateEvaluation = context?.updateEvaluation;
  const deleteEvaluation = context?.deleteEvaluation;
  const addSardEvaluation = context?.addSardEvaluation;
  const updateSardEvaluation = context?.updateSardEvaluation;
  const deleteSardEvaluation = context?.deleteSardEvaluation;
  const setLastUsedWeek = context?.setLastUsedWeek;
  const isTestActive = context?.isTestActive;
  const testScore = context?.testScore;
  const testDeductions = context?.testDeductions;

  const [error, setError] = useState<string | null>(null);
  const [pendingMatnsAlert, setPendingMatnsAlert] = useState<string[] | null>(null);
  const [viewingVersesModal, setViewingVersesModal] = useState<{
    isOpen: boolean;
    matnName: string;
    fromVerse: number | string;
    toVerse: number | string;
    prevFromVerse?: number;
    prevToVerse?: number;
  } | null>(null);
  const teacherHalaqas = useMemo(() => halaqas.filter(h => h.teacherId === teacherId).sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true })), [halaqas, teacherId]);
  const isFloating = teacherHalaqas.length === 0;

  // حلقات السرد الخاصة بالمعلم
  const teacherSardHalaqas = useMemo(() => (sardHalaqas || []).filter(sh => sh.teacherId === teacherId).sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true })), [sardHalaqas, teacherId]);

  const [currentStep, setCurrentStep] = useState<FormStep>('selectHalaqa');

  useEffect(() => {
    if (onStepChange) {
      onStepChange(currentStep);
    }
  }, [currentStep, onStepChange]);
  const [uiMode, setUiMode] = useState<'new' | 'summary' | 'edit'>('new');
  const [selectedHalaqa, setSelectedHalaqa] = useState<number | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [subject, setSubject] = useState<'quran' | 'mutoon' | 'sard'>('quran');
  
  const [sardEvalMode, setSardEvalMode] = useState<'individual' | 'group'>('group');
  const [selectedSardGroupIds, setSelectedSardGroupIds] = useState<number[]>([]);
  const [sardGroupErrors, setSardGroupErrors] = useState<Record<number, { fath: number, tashkeel: number, tajweed: number }>>({});
  const [sardGroupNotes, setSardGroupNotes] = useState<Record<number, string>>({});
  const [isCrossHalaqaModalOpen, setIsCrossHalaqaModalOpen] = useState(false);
  
  // حالة السرد المخصصة
  const [sardSelectionMode, setSardSelectionMode] = useState<'juz' | 'surahs' | 'pages'>('juz');
  const [showAllQuranJuzs, setShowAllQuranJuzs] = useState<boolean>(false);
  const [selectedSardJuzList, setSelectedSardJuzList] = useState<number[]>([]);
  const [selectedSardSurahIds, setSelectedSardSurahIds] = useState<number[]>([]);
  const [sardSurahSearch, setSardSurahSearch] = useState('');
  const [sardPageRanges, setSardPageRanges] = useState<{ fromPage: number | ''; toPage: number | '' }[]>([
    { fromPage: '', toPage: '' }
  ]);
  const [sardFathErrors, setSardFathErrors] = useState<number>(0);
  const [sardTashkeelErrors, setSardTashkeelErrors] = useState<number>(0);
  const [sardTajweedErrors, setSardTajweedErrors] = useState<number>(0);
  const [selectedSardHalaqaFilter, setSelectedSardHalaqaFilter] = useState<number | null>(null);
  const [currentSardEval, setCurrentSardEval] = useState<SardEvaluation | null>(null);
  const [isSardEditModalOpen, setIsSardEditModalOpen] = useState(false);
  const [sardSearch, setSardSearch] = useState('');

  const addSardPageRange = () => {
    setSardPageRanges(prev => [...prev, { fromPage: '', toPage: '' }]);
  };

  const removeSardPageRange = (index: number) => {
    setSardPageRanges(prev => {
      if (prev.length <= 1) return [{ fromPage: '', toPage: '' }];
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateSardPageRange = (index: number, field: 'fromPage' | 'toPage', value: number | '') => {
    setSardPageRanges(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const [currentEval, setCurrentEval] = useState<Evaluation | null>(null);
  const student = useMemo(() => students.find(s => s.id === selectedStudent), [students, selectedStudent]);

  const studentQuranHistory = useMemo(() => {
    return analyzeStudentQuranHistory(student, context?.evaluations || [], selectedWeek, currentEval?.id);
  }, [student, context?.evaluations, selectedWeek, currentEval?.id]);

  const previousWeekPages = useMemo(() => {
    return studentQuranHistory.prevWeekFullPages;
  }, [studentQuranHistory]);

  const previouslyMemorizedPages = useMemo(() => {
    return studentQuranHistory.priorFullPages;
  }, [studentQuranHistory]);

  const completedJuzsSet = useMemo(() => {
    return studentQuranHistory.allFullJuzs;
  }, [studentQuranHistory]);

  const [isGuest, setIsGuest] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [primarySearch, setPrimarySearch] = useState('');

  // Fields
  const [attendance, setAttendance] = useState<AttendanceStatus | undefined>();
  const [absenceReason, setAbsenceReason] = useState<AbsenceReason | undefined>();
  const [evalType, setEvalType] = useState<EvaluationType | undefined>();
  const [pages, setPages] = useState<number | ''>('');
  const [mutoonEvaluations, setMutoonEvaluations] = useState<Array<{matnName: string, lines: number | 'not_ready' | 'review' | '', fromAyah?: number | '', toAyah?: number | '', errors: number}>>([]);

  const activeMatns = useMemo(() => (matns || []).filter(m => m.isActive !== false), [matns]);

  useEffect(() => {
    if (activeMatns.length === 0 && subject === 'mutoon') {
      setSubject('quran');
    }
  }, [activeMatns.length, subject]);

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

  const getMatnEval = useCallback((matnName: string) => {
    return mutoonEvaluations.find(me => me.matnName === matnName) || {
      matnName,
      lines: '' as const,
      fromAyah: '' as const,
      toAyah: '' as const,
      errors: 0
    };
  }, [mutoonEvaluations]);

  const updateMatnEval = useCallback((matnName: string, updates: Partial<{ lines: number | 'not_ready' | 'review' | '', fromAyah?: number | '', toAyah?: number | '', errors: number }>) => {
    setMutoonEvaluations(prev => {
      const idx = prev.findIndex(me => me.matnName === matnName);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...updates };
        return next;
      } else {
        return [...prev, { matnName, lines: '', fromAyah: '', toAyah: '', errors: 0, ...updates }];
      }
    });
  }, []);

  const calculateMatnAyahRange = useCallback((studentId: number | null | undefined, matnName: string, linesCount: number, evalIndex: number = 0) => {
    if (!studentId || !matnName || !linesCount || linesCount <= 0) {
      return { fromAyah: '' as const, toAyah: '' as const };
    }
    const prevDBLines = evaluations
      .filter(ev => ev.studentId === studentId && ev.subject === 'mutoon' && ev.evaluationType === EvaluationType.MEMORIZATION && ev.surahs?.includes(matnName))
      .reduce((sum, ev) => sum + (ev.pages || 0), 0);

    const from = prevDBLines + 1;
    const to = prevDBLines + linesCount;
    return { fromAyah: from, toAyah: to };
  }, [evaluations]);
  const [ayahRange, setAyahRange] = useState('');
  const [surahs, setSurahs] = useState<string[]>([]);
  const [newMemorizedPages, setNewMemorizedPages] = useState<number[]>([]);
  const [selectedJuzForPages, setSelectedJuzForPages] = useState<number | null>(null);
  const [selectedSurahIds, setSelectedSurahIds] = useState<number[]>([]);
  const [quranSelectionTab, setQuranSelectionTab] = useState<'pages' | 'surahs'>('pages');
  const [isMushafModalOpen, setIsMushafModalOpen] = useState(false);
  const [evalFath, setEvalFath] = useState<number>(0);
  const [evalTashkeel, setEvalTashkeel] = useState<number>(0);
  const [evalTajweed, setEvalTajweed] = useState<number>(0);
  const [perf, setPerf] = useState<PerformanceLevel | undefined>();
  const [pReview, setPReview] = useState<PeriodicReviewStatus | undefined>();
  const [notes, setNotes] = useState('');
  const [surahSearch, setSurahSearch] = useState('');

  const selectionState = useMemo(() => {
    return computeSelectionState(newMemorizedPages, selectedSurahIds, studentQuranHistory);
  }, [newMemorizedPages, selectedSurahIds, studentQuranHistory]);

  const getSurahHistory = useCallback((sId: number) => {
    if (studentQuranHistory.prevWeekFullSurahs.has(sId)) return 'PREV_WEEK_FULL';
    if (studentQuranHistory.priorFullSurahs.has(sId)) return 'PRIOR_FULL';
    return 'NONE';
  }, [studentQuranHistory]);

  const getPageHistory = useCallback((page: number) => {
    if (studentQuranHistory.prevWeekFullPages.has(page)) return 'PREV_WEEK_FULL';
    if (studentQuranHistory.priorFullPages.has(page)) return 'PRIOR_FULL';
    if (studentQuranHistory.prevWeekPartialPages.has(page)) return 'PREV_WEEK_PARTIAL';
    if (studentQuranHistory.priorPartialPages.has(page)) return 'PRIOR_PARTIAL';
    return 'NONE';
  }, [studentQuranHistory]);

  const toggleSurah = (surahId: number) => {
    if (evalType !== EvaluationType.REVIEW) {
      const hist = getSurahHistory(surahId);
      if (hist === 'PREV_WEEK_FULL' || hist === 'PRIOR_FULL') return;
    }

    const isRemoving = selectedSurahIds.includes(surahId);
    const nextSurahIds = isRemoving
      ? selectedSurahIds.filter(id => id !== surahId)
      : [...selectedSurahIds, surahId];
    
    setSelectedSurahIds(nextSurahIds);
    
    const calc = calculateSurahsAndAyahs(newMemorizedPages, nextSurahIds, evalType === EvaluationType.REVIEW ? undefined : studentQuranHistory);
    setSurahs(calc.surahs);
    setAyahRange(calc.ayahRange);
  };

  const toggleNewPage = (pageNumber: number) => {
    if (evalType !== EvaluationType.REVIEW) {
      const hist = getPageHistory(pageNumber);
      if (hist === 'PREV_WEEK_FULL' || hist === 'PRIOR_FULL') return;
    }

    const isRemoving = newMemorizedPages.includes(pageNumber);
    const nextPages = isRemoving
      ? newMemorizedPages.filter(p => p !== pageNumber)
      : [...newMemorizedPages, pageNumber];
    
    setNewMemorizedPages(nextPages);
    
    const calc = calculateSurahsAndAyahs(nextPages, selectedSurahIds, evalType === EvaluationType.REVIEW ? undefined : studentQuranHistory);
    setSurahs(calc.surahs);
    setAyahRange(calc.ayahRange);
  };

  const toggleFullJuz = (juzNumber: number) => {
    const pList = juzPagesMap[juzNumber] || [];
    const allSelected = pList.every(p => newMemorizedPages.includes(p) || selectionState.derivedPages.has(p));
    let nextPages: number[];
    if (allSelected) {
      nextPages = newMemorizedPages.filter(p => !pList.includes(p));
      const surahsInJuz = juzSurahsMap[juzNumber] || [];
      const nextSurahs = selectedSurahIds.filter(s => !surahsInJuz.includes(s));
      setSelectedSurahIds(nextSurahs);
    } else {
      nextPages = Array.from(new Set([...newMemorizedPages, ...pList])).sort((a, b) => a - b);
    }
    setNewMemorizedPages(nextPages);
    const calc = calculateSurahsAndAyahs(nextPages, selectedSurahIds, evalType === EvaluationType.REVIEW ? undefined : studentQuranHistory);
    setSurahs(calc.surahs);
    setAyahRange(calc.ayahRange);
  };

  const toggleSurahsInJuz = (juzNumber: number) => {
    const sList = juzSurahsMap[juzNumber] || [];
    const allSelected = sList.every(s => selectedSurahIds.includes(s));
    let nextSurahs: number[];
    if (allSelected) {
      nextSurahs = selectedSurahIds.filter(s => !sList.includes(s));
    } else {
      nextSurahs = Array.from(new Set([...selectedSurahIds, ...sList])).sort((a, b) => a - b);
    }
    setSelectedSurahIds(nextSurahs);
    const calc = calculateSurahsAndAyahs(newMemorizedPages, nextSurahs, evalType === EvaluationType.REVIEW ? undefined : studentQuranHistory);
    setSurahs(calc.surahs);
    setAyahRange(calc.ayahRange);
  };

  const completedJuzsFromSelection = useMemo(() => {
    const list: number[] = [];
    for (let j = 1; j <= 30; j++) {
      if (studentQuranHistory.allFullJuzs.has(j)) continue;
      const jPages = juzPagesMap[j] || [];
      const isNowComplete = jPages.every(p => 
        studentQuranHistory.fullPages.has(p) || selectionState.allActivePages.includes(p)
      );
      if (isNowComplete) {
        list.push(j);
      }
    }
    return list;
  }, [studentQuranHistory, selectionState.allActivePages]);

  // Auto-calculate performance when errors change
  useEffect(() => {
     if (currentStep === 'selectPerformanceLevel') {
        const rawTotal = evalFath + evalTashkeel + (evalTajweed * 0.5);
        const totalErrors = Math.floor(rawTotal);
        let deducedPerf = PerformanceLevel.EXCELLENT;
        if (totalErrors === 0) deducedPerf = PerformanceLevel.EXCELLENT;
        else if (totalErrors === 1) deducedPerf = PerformanceLevel.ONE_ERROR;
        else if (totalErrors === 2) deducedPerf = PerformanceLevel.TWO_ERRORS;
        else if (totalErrors === 3) deducedPerf = PerformanceLevel.THREE_ERRORS;
        else if (totalErrors === 4) deducedPerf = PerformanceLevel.FOUR_ERRORS;
        else if (totalErrors === 5) deducedPerf = PerformanceLevel.FIVE_ERRORS;
        else deducedPerf = PerformanceLevel.MORE_THAN_FIVE_ERRORS;
        
        setPerf(deducedPerf);
     }
  }, [evalFath, evalTashkeel, evalTajweed, currentStep]);
  const [isSurahOpen, setIsSurahOpen] = useState(false);

  const [testFath, setTestFath] = useState<number>(0);
  const [testTashkeel, setTestTashkeel] = useState<number>(0);
  const [testTajweed, setTestTajweed] = useState<number>(0);
  
  const surahSearchInputRef = useRef<HTMLInputElement>(null); 
  const formRef = useRef<HTMLFormElement>(null);

  const [highlightPagesInput, setHighlightPagesInput] = useState(false);
  const [highlightWeekInput, setHighlightWeekInput] = useState(false);
  const [highlightSurahInput, setHighlightSurahInput] = useState(false);
  const [highlightSelectionError, setHighlightSelectionError] = useState(false);
  const [highlightSardSelectionError, setHighlightSardSelectionError] = useState(false);

  useEffect(() => {
    if (currentStep === 'summaryAndConfirm' && formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentStep]);

  // مرجع لتتبع آخر طالب وأسبوع تم فحصهم لمنع الارتداد العشوائي
  const lastCheckedRef = useRef<string>("");

  const activeStudent = useMemo(() => 
    students.find(s => s.id === selectedStudent), 
    [students, selectedStudent]
  );

  useEffect(() => {
    if (isSurahOpen && surahSearchInputRef.current && window.innerWidth < 768) {
        // Removed auto-focus logic as per user request
    }
  }, [isSurahOpen]);

  useEffect(() => {
    setLastUsedWeek(selectedWeek);
  }, [selectedWeek, setLastUsedWeek]);

  // حسابات محفوظ الطالب للسرد (القديم والجديد)
  const studentPagesData = useMemo(() => {
    if (!activeStudent) return null;
    return getMemorizedPagesData(activeStudent, context?.evaluations || []);
  }, [activeStudent, context?.evaluations]);

  // حساب التقاطع للصفحات المحفوظة في السرد الجماعي
  const groupPagesData = useMemo(() => {
    if (sardEvalMode !== 'group' || selectedSardGroupIds.length === 0) return null;
    const allTotalSets = selectedSardGroupIds.map(id => {
      const s = students.find(x => x.id === id);
      if (!s) return new Set<number>();
      return getMemorizedPagesData(s, context?.evaluations || []).totalSet;
    });
    const intersection = new Set<number>();
    if (allTotalSets.length > 0) {
      for (const page of allTotalSets[0]) {
        let inAll = true;
        for (let i = 1; i < allTotalSets.length; i++) {
          if (!allTotalSets[i].has(page)) {
             inAll = false;
             break;
          }
        }
        if (inAll) intersection.add(page);
      }
    }
    return { totalSet: intersection };
  }, [sardEvalMode, selectedSardGroupIds, students, context?.evaluations]);

  // حساب الطالب الأقل حفظاً في السرد الجماعي
  const leastMemorizedStudentInfo = useMemo(() => {
    if (sardEvalMode !== 'group' || selectedSardGroupIds.length === 0) return null;
    const groupStudents = selectedSardGroupIds
      .map(id => students.find(x => x.id === id))
      .filter((s): s is Student => Boolean(s));
    
    if (groupStudents.length === 0) return null;

    const listWithMem = groupStudents.map(s => {
      const memData = getMemorizedPagesData(s, context?.evaluations || []);
      const completedJuzs = getCompletedJuzs(memData.totalSet);
      return {
        student: s,
        memData,
        pagesCount: memData.totalCount,
        completedJuzs,
      };
    });

    // الترتيب حسب عدد الصفحات المحفوظة تصاعدياً، ثم عدد الأجزاء المكتملة
    return [...listWithMem].sort((a, b) => {
      if (a.pagesCount !== b.pagesCount) return a.pagesCount - b.pagesCount;
      return a.completedJuzs.length - b.completedJuzs.length;
    })[0];
  }, [sardEvalMode, selectedSardGroupIds, students, context?.evaluations]);

  // الأجزاء المكتملة في محفوظ الطالب (أو الطالب الأقل حفظاً في السرد الجماعي)
  const studentCompletedJuzs = useMemo(() => {
    if (sardEvalMode === 'group') {
      if (leastMemorizedStudentInfo) {
        return leastMemorizedStudentInfo.completedJuzs;
      }
      if (!groupPagesData) return [];
      return getCompletedJuzs(groupPagesData.totalSet);
    }
    if (!studentPagesData) return [];
    return getCompletedJuzs(studentPagesData.totalSet);
  }, [studentPagesData, groupPagesData, sardEvalMode, leastMemorizedStudentInfo]);

  // السور المكتملة في محفوظ الطالب (أو المشتركة في السرد الجماعي)
  const studentCompletedSurahs = useMemo(() => {
    const dataSet = sardEvalMode === 'group' ? groupPagesData?.totalSet : studentPagesData?.totalSet;
    if (!dataSet) return [];

    const list: { id: number; name: string; pagesCount: number; pages: number[] }[] = [];
    for (let sId = 1; sId <= 114; sId++) {
      const pList = surahPagesMap[sId] || [];
      if (pList.length > 0 && pList.every(p => dataSet.has(p))) {
        list.push({
          id: sId,
          name: surahNames[sId],
          pagesCount: pList.length,
          pages: pList,
        });
      }
    }
    return list;
  }, [studentPagesData, groupPagesData, sardEvalMode]);

  // تصفية السور المحفوظة حسب البحث
  const filteredSardSurahs = useMemo(() => {
    if (!sardSurahSearch) return studentCompletedSurahs;
    return studentCompletedSurahs.filter(s => isSmartMatch(s.name, sardSurahSearch));
  }, [studentCompletedSurahs, sardSurahSearch]);

  // فحص صحة نطاقات الصفحات مقابل محفوظ الطالب
  const sardMultiRangeAnalysis = useMemo(() => {
    if (!sardPageRanges || sardPageRanges.length === 0) {
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

    const rangeAnalyses = sardPageRanges.map((range) => {
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
      const dataSet = sardEvalMode === 'group' ? groupPagesData?.totalSet : studentPagesData?.totalSet;
      for (let p = start; p <= end; p++) {
        allUniquePagesSet.add(p);
        if (!dataSet || !dataSet.has(p)) {
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
    const hasAtLeastOneFilledRange = sardPageRanges.some(r => r.fromPage !== '' && r.toPage !== '');
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
  }, [sardPageRanges, studentPagesData, groupPagesData, sardEvalMode]);

  // حساب كافة الصفحات المحددة للسرد لتصفحها في المصحف
  const sardActivePages = useMemo(() => {
    const pageSet = new Set<number>();
    if (sardSelectionMode === 'juz') {
      selectedSardJuzList.forEach(j => {
        (juzPagesMap[j] || []).forEach(p => pageSet.add(p));
      });
    } else if (sardSelectionMode === 'surahs') {
      selectedSardSurahIds.forEach(sId => {
        (surahPagesMap[sId] || []).forEach(p => pageSet.add(p));
      });
    } else if (sardSelectionMode === 'pages') {
      sardPageRanges.forEach(range => {
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
  }, [sardSelectionMode, selectedSardJuzList, selectedSardSurahIds, sardPageRanges]);

  // حسابات السرد المساعدة
  const totalSardErrors = useMemo(() => {
    return calculateSardTotalErrors(sardFathErrors, sardTashkeelErrors, sardTajweedErrors);
  }, [sardFathErrors, sardTashkeelErrors, sardTajweedErrors]);

  const calculatedSardPages = useMemo(() => {
    if (sardSelectionMode === 'juz') {
      return selectedSardJuzList.reduce((acc, j) => acc + (j === 1 ? 21 : 20), 0);
    }
    if (sardSelectionMode === 'surahs') {
      const pageSet = new Set<number>();
      selectedSardSurahIds.forEach(sId => {
        (surahPagesMap[sId] || []).forEach(p => pageSet.add(p));
      });
      return countQuranPages(pageSet);
    }
    if (sardSelectionMode === 'pages') {
      return sardMultiRangeAnalysis.isValid ? sardMultiRangeAnalysis.totalCount : 0;
    }
    return 0;
  }, [sardSelectionMode, selectedSardJuzList, selectedSardSurahIds, sardMultiRangeAnalysis]);

  const deducedSardGrade = useMemo(() => {
    return calculateSardGrade(totalSardErrors);
  }, [totalSardErrors]);

  const toggleSardJuz = (juz: number) => {
    setSelectedSardJuzList(prev => 
      prev.includes(juz) ? prev.filter(j => j !== juz) : [...prev, juz].sort((a, b) => a - b)
    );
  };

  const selectAllSardJuzs = () => {
    setSelectedSardJuzList([...studentCompletedJuzs]);
  };

  const selectAllQuranJuzs = () => {
    setSelectedSardJuzList(Array.from({ length: 30 }, (_, i) => i + 1));
  };

  const clearAllSardJuzs = () => {
    setSelectedSardJuzList([]);
  };

  const toggleSardSurah = (surahId: number) => {
    setSelectedSardSurahIds(prev => 
      prev.includes(surahId) ? prev.filter(id => id !== surahId) : [...prev, surahId].sort((a, b) => a - b)
    );
  };

  const selectAllSardSurahs = () => {
    setSelectedSardSurahIds(studentCompletedSurahs.map(s => s.id));
  };

  const clearAllSardSurahs = () => {
    setSelectedSardSurahIds([]);
  };

  const activeSardHalaqaId = useMemo(() => {
    if (selectedSardHalaqaFilter) return selectedSardHalaqaFilter;
    if (teacherSardHalaqas.length > 0 && !isGuest) return teacherSardHalaqas[0].id;
    return null;
  }, [selectedSardHalaqaFilter, teacherSardHalaqas, isGuest]);

  const resetFormFields = useCallback(() => {
    setAttendance(undefined);
    setAbsenceReason(undefined);
    setEvalType(undefined);
    setPages('');
    setMutoonEvaluations([]);
    setAyahRange('');
    setSurahs([]);
    setNewMemorizedPages([]);
    setSelectedSurahIds([]);
    setSelectedJuzForPages(null);
    setQuranSelectionTab('pages');
    setSardSelectionMode('juz');
    setPerf(undefined);
    setPReview(undefined);
    setNotes('');
    setEvalFath(0);
    setEvalTashkeel(0);
    setEvalTajweed(0);
    setTestFath(0);
    setTestTashkeel(0);
    setTestTajweed(0);
    setSurahSearch(''); // مسح نص البحث عن السور عند البدء من جديد
    setError(null);
    setSelectedSardJuzList([]);
    setShowAllQuranJuzs(false);
    setSelectedSardSurahIds([]);
    setSardSurahSearch('');
    setSardPageRanges([{ fromPage: '', toPage: '' }]);
    setSardSelectionMode('juz');
    setSardFathErrors(0);
    setSardTashkeelErrors(0);
    setSardTajweedErrors(0);
    setCurrentSardEval(null);
    setSelectedSardGroupIds([]);
    setSardGroupErrors({});
    setSardGroupNotes({});
  }, []);

  // منطق البحث عن تقييم سابق: يعمل فقط عند تغيير الطالب أو الأسبوع
  useEffect(() => {
    if (!selectedStudent || !selectedWeek) return;

    const checkKey = `${selectedStudent}-${selectedWeek}-${subject}`;
    // إذا لم يتغير الطالب أو الأسبوع الحقيقي، لا تلمس النموذج (يمنع الارتداد عند تحديث السور)
    if (lastCheckedRef.current === checkKey) return;

    if (subject === 'sard') {
      const foundSard = (sardEvaluations || []).find(se => 
        se.studentId === selectedStudent && se.weekNumber === selectedWeek
      );
      lastCheckedRef.current = checkKey;
      if (foundSard) {
        setCurrentSardEval(foundSard);
        setIsSardEditModalOpen(true);
      } else {
        setCurrentSardEval(null);
        setUiMode('new');
        setCurrentStep('selectAttendance');
        resetFormFields();
      }
      return;
    }

    const found = evaluations.find(e => 
      e.studentId === selectedStudent && 
      e.weekNumber === selectedWeek && (subject === 'mutoon' ? e.subject === 'mutoon' : e.subject !== 'mutoon') && !e.isTest
    );
    
    lastCheckedRef.current = checkKey;

    if (found) {
        setCurrentEval(found);
        setUiMode('summary');
                setAttendance(found.attendance);
        setAbsenceReason(found.absenceReason);
        setEvalType(found.evaluationType);
        setPages(found.pages ?? '');
        const rangeStr = (found.fromAyah && found.toAyah) 
            ? (found.fromAyah === found.toAyah ? found.fromAyah.toString() : `${found.fromAyah}-${found.toAyah}`) 
            : (found.fromAyah ? found.fromAyah.toString() : '');
        setAyahRange(rangeStr);
        setSurahs(found.surahs ?? []);
        setPerf(mapOldPerformanceToNew(found.performance as string));
        setPReview(found.periodicReview);
        setNotes(found.notes ?? '');
        setEvalFath(found.evalFathErrors ?? 0);
        setEvalTashkeel(found.evalTashkeelErrors ?? 0);
        setEvalTajweed(found.evalTajweedErrors ?? 0);
        setTestFath(found.testFathErrors ?? 0);
        setTestTashkeel(found.testTashkeelErrors ?? 0);
        setTestTajweed(found.testTajweedErrors ?? 0);
    } else {
        setCurrentEval(null);
        setUiMode('new');
        setCurrentStep('selectAttendance');
        resetFormFields(); 
    }
  }, [selectedStudent, selectedWeek, subject, evaluations, sardEvaluations, resetFormFields]);

  // تعيين الحلقة الافتراضية
  useEffect(() => {
    if (currentStep !== 'selectHalaqa') return;
    if (context?.isLoading) return; // Prevent fallback before data loads
    if (isFloating) { setSelectedHalaqa(0); setIsGuest(true); setCurrentStep('selectWeek'); }
    else if (teacherHalaqas.length === 1) { setSelectedHalaqa(teacherHalaqas[0].id); setCurrentStep('selectWeek'); }
  }, [teacherHalaqas.length, isFloating, currentStep, context?.isLoading]);

  // التحميل المسبق التلقائي لصفحات المصحف في الخلفية فور تحديد الطالب والصفحات
  useEffect(() => {
    const pagesToPreload: number[] = [];
    if (subject === 'sard') {
      if (sardActivePages && sardActivePages.length > 0) {
        pagesToPreload.push(...sardActivePages);
      }
    } else {
      if (selectionState.allActivePages && selectionState.allActivePages.length > 0) {
        pagesToPreload.push(...selectionState.allActivePages);
      }
      if (previousWeekPages && previousWeekPages.size > 0) {
        previousWeekPages.forEach(p => pagesToPreload.push(p));
      }
    }
    if (pagesToPreload.length > 0) {
      preloadMushafPages(pagesToPreload);
    }
  }, [subject, sardActivePages, selectionState.allActivePages, previousWeekPages]);

  // معالج الرجوع الآمن لمنع الخروج المفاجئ وفقدان بيانات تقييم الطالب
  const evalNavStateRef = useRef({
    currentStep,
    selectedStudent,
    selectedWeek,
    subject,
    pages,
    surahs,
    evalFath,
    evalTashkeel,
    evalTajweed,
    notes,
    viewingVersesModal,
    isSardEditModalOpen,
    isCrossHalaqaModalOpen,
    isMushafModalOpen,
    isSurahOpen,
    uiMode,
    onBackToMenu,
  });

  useEffect(() => {
    evalNavStateRef.current = {
      currentStep,
      selectedStudent,
      selectedWeek,
      subject,
      pages,
      surahs,
      evalFath,
      evalTashkeel,
      evalTajweed,
      notes,
      viewingVersesModal,
      isSardEditModalOpen,
      isCrossHalaqaModalOpen,
      isMushafModalOpen,
      isSurahOpen,
      uiMode,
      onBackToMenu,
    };
  });

  useEffect(() => {
    return registerBackHandler(() => {
      const state = evalNavStateRef.current;

      // 1. إغلاق النوافذ المنبثقة أولاً إن كانت مفتوحة
      if (state.isMushafModalOpen) {
        setIsMushafModalOpen(false);
        return true;
      }
      if (state.isSurahOpen) {
        setIsSurahOpen(false);
        return true;
      }
      if (state.viewingVersesModal?.isOpen) {
        setViewingVersesModal(null);
        return true;
      }
      if (state.isSardEditModalOpen) {
        setIsSardEditModalOpen(false);
        return true;
      }
      if (state.isCrossHalaqaModalOpen) {
        setIsCrossHalaqaModalOpen(false);
        return true;
      }
      if (state.uiMode === 'summary') {
        setUiMode('new');
        return true;
      }

      // 2. إذا كان المعلم داخل تقييم طالب معين وكتب بيانات
      if (state.selectedStudent && state.currentStep !== 'selectStudent' && state.currentStep !== 'selectHalaqa' && state.currentStep !== 'selectWeek') {
        const hasData = (state.pages !== '' && state.pages !== 0) ||
                        (state.surahs && state.surahs.length > 0) ||
                        state.evalFath > 0 || state.evalTashkeel > 0 || state.evalTajweed > 0 ||
                        (state.notes && state.notes.trim() !== '');

        if (hasData) {
          if (window.confirm('هل تريد الرجوع؟ سيتم فقدان بيانات التقييم غير المحفوظة لهذا الطالب.')) {
            setSelectedStudent(null);
            setCurrentStep('selectStudent');
            resetFormFields();
          }
        } else {
          setSelectedStudent(null);
          setCurrentStep('selectStudent');
          resetFormFields();
        }
        return true;
      }

      // 3. الرجوع من اختيار الطالب إلى اختيار الأسبوع
      if (state.currentStep === 'selectStudent' && state.selectedWeek) {
        setCurrentStep('selectWeek');
        return true;
      }

      // 4. الرجوع من اختيار الأسبوع إلى اختيار الحلقة (إن كان لديه أكثر من حلقة)
      if (state.currentStep === 'selectWeek' && teacherHalaqas.length > 1) {
        setCurrentStep('selectHalaqa');
        return true;
      }

      // 5. الرجوع للقائمة الرئيسية بأمان
      if (state.onBackToMenu) {
        state.onBackToMenu();
        return true;
      }

      return false;
    });
  }, [teacherHalaqas.length, resetFormFields]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const isGroupMode = subject === 'sard' && sardEvalMode === 'group';
    if ((!isGroupMode && !selectedStudent) || (isGroupMode && selectedSardGroupIds.length === 0) || !selectedWeek || !attendance) { 
        setError('الرجاء التأكد من إكمال البيانات الأساسية.');
        return; 
    }

    const today = new Date().toLocaleDateString('ar-EG');

    if (subject === 'sard') {
      const selectedSurahNames = sardSelectionMode === 'surahs' 
        ? selectedSardSurahIds.map(id => surahNames[id]) 
        : undefined;
      const pageRanges: SardPageRange[] = sardSelectionMode === 'pages'
        ? sardPageRanges
            .filter(r => r.fromPage !== '' && r.toPage !== '')
            .map(r => ({ fromPage: Number(r.fromPage), toPage: Number(r.toPage) }))
        : [];

      if (isGroupMode) {
        for (const studentId of selectedSardGroupIds) {
          const activeStud = students.find(s => s.id === studentId);
          const errs = sardGroupErrors[studentId] || { fath: 0, tashkeel: 0, tajweed: 0 };
          const tot = calculateSardTotalErrors(errs.fath, errs.tashkeel, errs.tajweed);
          const grade = calculateSardGrade(tot);
          const sardData: Omit<SardEvaluation, 'id' | 'updatedAt'> = {
            studentId: studentId,
            sardHalaqaId: activeStud?.sardHalaqaId || activeSardHalaqaId || undefined,
            teacherId,
            weekNumber: selectedWeek,
            date: new Date().toISOString().split('T')[0],
            attendance: attendance!,
            absenceReason: absenceReason || undefined,
            juzList: attendance === AttendanceStatus.ABSENT ? [] : (sardSelectionMode === 'juz' ? selectedSardJuzList : []),
            surahs: attendance === AttendanceStatus.ABSENT ? [] : selectedSurahNames,
            pageRanges: attendance === AttendanceStatus.ABSENT ? [] : pageRanges,
            pagesCount: attendance === AttendanceStatus.ABSENT ? 0 : calculatedSardPages,
            hesitationErrors: attendance === AttendanceStatus.ABSENT ? 0 : errs.tashkeel,
            fathErrors: attendance === AttendanceStatus.ABSENT ? 0 : errs.fath,
            tajweedErrors: attendance === AttendanceStatus.ABSENT ? 0 : errs.tajweed,
            totalErrors: attendance === AttendanceStatus.ABSENT ? 0 : tot,
            grade: attendance === AttendanceStatus.ABSENT ? 'غائب' : grade,
            notes: sardGroupNotes[studentId]?.trim() || undefined,
          };
          addSardEvaluation(sardData);
        }
      } else {
        const activeStud = students.find(s => s.id === selectedStudent);
        const sardData: Omit<SardEvaluation, 'id' | 'updatedAt'> = {
          studentId: selectedStudent!,
          sardHalaqaId: activeStud?.sardHalaqaId || activeSardHalaqaId || undefined,
          teacherId,
          weekNumber: selectedWeek,
          date: new Date().toISOString().split('T')[0],
          attendance: attendance!,
          absenceReason: absenceReason || undefined,
          juzList: attendance === AttendanceStatus.ABSENT ? [] : (sardSelectionMode === 'juz' ? selectedSardJuzList : []),
          surahs: attendance === AttendanceStatus.ABSENT ? [] : selectedSurahNames,
          pageRanges: attendance === AttendanceStatus.ABSENT ? [] : pageRanges,
          pagesCount: attendance === AttendanceStatus.ABSENT ? 0 : calculatedSardPages,
          hesitationErrors: attendance === AttendanceStatus.ABSENT ? 0 : sardTashkeelErrors,
          fathErrors: attendance === AttendanceStatus.ABSENT ? 0 : sardFathErrors,
          tajweedErrors: attendance === AttendanceStatus.ABSENT ? 0 : sardTajweedErrors,
          totalErrors: attendance === AttendanceStatus.ABSENT ? 0 : totalSardErrors,
          grade: attendance === AttendanceStatus.ABSENT ? 'غائب' : deducedSardGrade,
          notes: notes.trim() || undefined,
        };
        addSardEvaluation(sardData);
      }
      
      onFormSubmit('add');
      
      lastCheckedRef.current = ""; 
      setSelectedStudent(null);
      setPrimarySearch('');
      setGuestSearch('');
      setSardSearch('');
      setCurrentStep('selectStudent');
      resetFormFields();
      return;
    }

    if (subject === 'mutoon') {
      const evaluatedMutoon = mutoonEvaluations.filter(m => m.lines !== '');
      if (evaluatedMutoon.length === 0 && attendance !== AttendanceStatus.ABSENT) {
        setError('الرجاء تحديد عدد الأبيات لمتن واحد على الأقل قبل حفظ التقييم.');
        return;
      }

      if (attendance === AttendanceStatus.ABSENT) {
        addEvaluation({
          id: Date.now() + Math.random(),
          studentId: selectedStudent!,
          studentName: students.find(s => s.id === selectedStudent)?.name || '',
          subject: 'mutoon',
          weekNumber: selectedWeek,
          attendance: attendance!,
          absenceReason: absenceReason || null,
          evaluationType: EvaluationType.MEMORIZATION,
          pages: 0,
          fromAyah: undefined,
          toAyah: undefined,
          surahs: activeMatns.length > 0 ? [activeMatns[0].name] : ['المتون'],
          performance: PerformanceLevel.MORE_THAN_FIVE_ERRORS,
          evalFathErrors: 0,
          evalTashkeelErrors: 0,
          evalTajweedErrors: 0,
          notes: notes || undefined,
          evaluationDate: today
        } as unknown as Evaluation);
      } else {
        evaluatedMutoon.forEach((mEval, idx) => {
          let perfEnum = PerformanceLevel.EXCELLENT;
          if (mEval.lines === 'not_ready') {
            perfEnum = PerformanceLevel.MORE_THAN_FIVE_ERRORS;
          } else if (mEval.errors > 6) {
            perfEnum = PerformanceLevel.MORE_THAN_FIVE_ERRORS;
          } else if (mEval.errors >= 3) {
            perfEnum = PerformanceLevel.ONE_ERROR;
          }
          
          let fromAyahVal: number | undefined = undefined;
          let toAyahVal: number | undefined = undefined;
          if (mEval.lines !== 'not_ready' && mEval.lines !== 'review' && mEval.lines !== '') {
            if (mEval.fromAyah !== undefined && mEval.fromAyah !== '') {
              fromAyahVal = Number(mEval.fromAyah);
            }
            if (mEval.toAyah !== undefined && mEval.toAyah !== '') {
              toAyahVal = Number(mEval.toAyah);
            }
            if (!fromAyahVal || !toAyahVal) {
              const autoRange = calculateMatnAyahRange(selectedStudent, mEval.matnName, Number(mEval.lines), idx);
              if (!fromAyahVal && autoRange.fromAyah !== '') fromAyahVal = Number(autoRange.fromAyah);
              if (!toAyahVal && autoRange.toAyah !== '') toAyahVal = Number(autoRange.toAyah);
            }
          }

          addEvaluation({
            id: Date.now() + Math.random() + idx,
            studentId: selectedStudent!,
            studentName: students.find(s => s.id === selectedStudent)?.name || '',
            subject: 'mutoon',
            weekNumber: selectedWeek,
            attendance: attendance!,
            absenceReason: absenceReason || null,
            evaluationType: mEval.lines === 'review' ? EvaluationType.REVIEW : EvaluationType.MEMORIZATION,
            pages: (mEval.lines === 'not_ready' || mEval.lines === 'review') ? 0 : Number(mEval.lines),
            fromAyah: fromAyahVal,
            toAyah: toAyahVal,
            surahs: [mEval.matnName],
            performance: perfEnum,
            evalFathErrors: mEval.errors,
            evalTashkeelErrors: 0,
            evalTajweedErrors: 0,
            notes: notes || undefined,
            evaluationDate: today
          } as unknown as Evaluation);
        });
      }
      
      onFormSubmit('add');
      lastCheckedRef.current = ""; 
      setSelectedStudent(null);
      setPrimarySearch('');
      setGuestSearch('');
      setSurahSearch('');
      setCurrentStep('selectStudent');
      resetFormFields();
      return;
    }

    const range = (ayahRange || '').split('-').map(n => n.trim());

    const data: any = {
      studentId: selectedStudent, 
      halaqaId: selectedHalaqa, 
      teacherId, 
      subject: subject,
      weekNumber: selectedWeek, 
      attendance: attendance!, 
      absenceReason: absenceReason || null, 
      evaluationType: evalType || null, 
      pages: evalType === EvaluationType.REVIEW ? countQuranPages([...studentQuranHistory.oldFullPages, ...studentQuranHistory.newEvalsFullPages]) : (selectionState.allActivePages.length > 0 ? selectionState.newPagesCount : null),
      fromAyah: range[0] || null, 
      toAyah: range[1] || range[0] || null, 
      surahs: surahs || null, 
      performance: perf || null, 
      newMemorizedPages: evalType === EvaluationType.REVIEW ? Array.from(new Set([...studentQuranHistory.oldFullPages, ...studentQuranHistory.newEvalsFullPages])) : (selectionState.allActivePages.length > 0 ? selectionState.allActivePages : undefined),
      evalFathErrors: evalFath,
      evalTashkeelErrors: evalTashkeel,
      evalTajweedErrors: evalTajweed,
      testTotalScore: evalType === EvaluationType.REVIEW ? Math.max(0, 100 - ((evalFath * 1) + (evalTashkeel * 1) + (evalTajweed * 0.5))) : undefined,
      testMaxScore: evalType === EvaluationType.REVIEW ? 100 : undefined,
      periodicReview: pReview || null, 
      notes: notes || null,
      evaluationDate: today,
      };
    
    addEvaluation(data);
    onFormSubmit('add');
    
    // تصفير المرجع والنموذج للانتقال للطالب التالي
    lastCheckedRef.current = ""; 
    setSelectedStudent(null);
    setPrimarySearch('');
    setGuestSearch('');
    setSurahSearch(''); // مسح البحث عن السور تماماً عند الحفظ
    setCurrentStep('selectStudent');
    resetFormFields();
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (window.innerWidth < 768) {
        setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 250);
    }
  };

  const filteredSurahs = useMemo(() => {
    const list = subject === 'mutoon' ? matns.map(m => m.name) : QURAN_SURAHS;
    if (!surahSearch) return list;
    return list.filter(s => isSmartMatch(s, surahSearch));
  }, [subject, matns, surahSearch]);

  return (
    <>
      {uiMode === 'summary' && currentEval && activeStudent && (
        <EvaluationSummaryModal 
          evaluation={currentEval} 
          student={activeStudent} 
          halaqa={halaqas.find(h => h.id === currentEval.halaqaId)} 
          onClose={() => { 
            setSelectedStudent(null); 
            setUiMode('new'); 
            setCurrentStep('selectStudent');
            setPrimarySearch('');
            setGuestSearch('');
            setSurahSearch('');
            lastCheckedRef.current = "";
          }} 
          onEdit={() => setUiMode('edit')} 
          onDelete={() => { 
            if (subject === 'mutoon') {
               const allMutoonForWeek = evaluations.filter(e => e.studentId === activeStudent?.id && e.subject === 'mutoon' && e.weekNumber === selectedWeek);
               allMutoonForWeek.forEach(e => deleteEvaluation(e.id));
            } else {
               deleteEvaluation(currentEval.id); 
            }
            onFormSubmit('delete'); 
            setUiMode('new'); 
            setSelectedStudent(null); 
            lastCheckedRef.current = "";
            setSurahSearch('');
            setPrimarySearch('');
            setGuestSearch('');
          }} 
        />
      )}

      {uiMode === 'edit' && currentEval && activeStudent && (
        <EvaluationEditForm 
          initialEvaluation={currentEval} 
          student={activeStudent} 
          halaqa={halaqas.find(h => h.id === currentEval.halaqaId)} 
          onClose={() => setUiMode('summary')} 
          onSave={(v) => { 
            updateEvaluation(v); 
            onFormSubmit('update'); 
            setUiMode('new'); 
            setSelectedStudent(null);
            lastCheckedRef.current = "";
            setSurahSearch('');
            setPrimarySearch('');
            setGuestSearch('');
          }} 
          onDelete={() => { 
            if (subject === 'mutoon') {
               const allMutoonForWeek = evaluations.filter(e => e.studentId === activeStudent?.id && e.subject === 'mutoon' && e.weekNumber === selectedWeek);
               allMutoonForWeek.forEach(e => deleteEvaluation(e.id));
            } else {
               deleteEvaluation(currentEval.id); 
            }
            onFormSubmit('delete'); 
            setUiMode('new');
            setSelectedStudent(null); 
            lastCheckedRef.current = "";
            setSurahSearch('');
            setPrimarySearch('');
            setGuestSearch('');
          }} 
        />
      )}

      {isSardEditModalOpen && currentSardEval && activeStudent && (
        <SardEvaluationEditModal
          evaluation={currentSardEval}
          student={activeStudent}
          sardHalaqa={sardHalaqas.find(h => h.id === currentSardEval.sardHalaqaId)}
          onClose={() => {
            setIsSardEditModalOpen(false);
            setCurrentSardEval(null);
            setSelectedStudent(null);
            lastCheckedRef.current = "";
          }}
          onSave={(updated) => {
            updateSardEvaluation(updated);
            onFormSubmit('update');
            setIsSardEditModalOpen(false);
            setCurrentSardEval(null);
            setSelectedStudent(null);
            lastCheckedRef.current = "";
            setSardSearch('');
          }}
          onDelete={(id) => {
            deleteSardEvaluation(id);
            onFormSubmit('delete');
            setIsSardEditModalOpen(false);
            setCurrentSardEval(null);
            setSelectedStudent(null);
            lastCheckedRef.current = "";
            setSardSearch('');
          }}
        />
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="bg-white p-3.5 sm:p-8 rounded-xl shadow-lg dark:bg-gray-800 transition-all border border-gray-100 dark:border-gray-700 animate-fade-in relative">
        <h3 className="text-lg sm:text-2xl font-bold text-green-900 border-b pb-4 mb-6 dark:text-green-300 flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
          إدخال التقييم {selectedWeek ? `(الأسبوع ${selectedWeek})` : ''}
        </h3>
        
        {currentStep === 'selectHalaqa' && (
          <div className="space-y-4">
            <p className="font-bold text-lg">اختر الحلقة المعنية بالتقييم:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teacherHalaqas.map(h => (
                <button key={h.id} type="button" onClick={() => { setSelectedHalaqa(h.id); setCurrentStep('selectWeek'); }} className={`p-6 rounded-xl hover:bg-green-100 font-bold text-xl border-2 transition-all dark:bg-gray-700 dark:text-green-400 ${selectedHalaqa === h.id ? 'bg-green-100 border-green-600' : 'bg-green-50 border-transparent shadow-sm'}`}>{h.name}</button>
              ))}
            </div>
            {onBackToMenu && (
              <div className="border-t pt-4 mt-6">
                <button 
                  type="button" 
                  onClick={onBackToMenu}
                  className="px-6 py-2.5 bg-white text-gray-800 rounded-xl dark:bg-gray-800 dark:text-gray-100 font-bold border-2 border-emerald-600 dark:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-700 dark:hover:border-emerald-400 shadow-sm active:scale-95 transition-all flex items-center gap-2 justify-center w-full sm:w-auto cursor-pointer ring-1 ring-emerald-500/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 rtl:rotate-0 rotate-180 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span>العودة للقائمة الرئيسية</span>
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'selectWeek' && (
          <div className="space-y-4">
            <label className="text-xl font-bold">أدخل رقم الأسبوع:</label>
            <input 
              type="number" 
              min="1" 
              value={safeNumberVal(selectedWeek, '')} 
              onChange={e => { 
                const val = parseSafeNumber(e.target.value, NaN); 
                setSelectedWeek(isNaN(val) || val <= 0 ? null : val); 
                setHighlightWeekInput(false); 
              }} 
              className={`input-style text-center text-4xl font-bold h-24 ${highlightWeekInput ? 'ring-4 ring-red-400 animate-pulse' : ''}`} 
              placeholder="0" 
              onFocus={(e) => {
                e.target.select();
                handleInputFocus(e);
              }}
            />
            <div className={`flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center border-t pt-4 mt-6 bg-white dark:bg-gray-800 py-4 gap-3`}>
                <button 
                  type="button" 
                  onClick={() => {
                    if (onBackToMenu) {
                      onBackToMenu();
                    } else if (isFloating) {
                      setSelectedWeek(null);
                    } else {
                      setCurrentStep('selectHalaqa');
                    }
                  }} 
                  className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-xl dark:bg-gray-700 dark:text-gray-200 font-bold shadow-sm active:scale-95 text-center w-full sm:w-auto"
                >
                  رجوع
                </button>
                <div className="flex flex-col sm:flex-row gap-2 flex-grow sm:flex-grow-0">
                    <button type="button" onClick={() => {
                        if (!selectedWeek) {
                            setHighlightWeekInput(true);
                            setTimeout(() => setHighlightWeekInput(false), 1500);
                            return;
                        }
                                                setCurrentStep('selectStudent');
                    }} className="px-10 py-2.5 bg-green-700 text-white rounded-xl font-bold hover:bg-green-800 transition-colors shadow-sm active:scale-95 text-center w-full">التالي</button>
                </div>
            </div>
          </div>
        )}

        
        {currentStep === 'selectStudent' && (
          <div className="space-y-6">
            {/* التبويبات: القرآن الكريم، المتون، السرد */}
            <div className={`grid ${activeMatns.length > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-2 sm:gap-4`}>
              <button 
                type="button" 
                onClick={() => { setSubject('quran'); }} 
                className={`py-3 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-1.5 sm:gap-2 border-2 transition-all text-xs sm:text-base ${
                  subject === 'quran' 
                    ? 'bg-green-100 border-green-600 shadow-sm text-green-900 dark:bg-green-950/40 dark:text-green-300 dark:border-green-600' 
                    : 'bg-gray-50 border-transparent hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                }`}
              >
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>القرآن الكريم</span>
              </button>

              {activeMatns.length > 0 && (
                <button 
                  type="button" 
                  onClick={() => { setSubject('mutoon'); }} 
                  className={`py-3 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-1.5 sm:gap-2 border-2 transition-all text-xs sm:text-base ${
                    subject === 'mutoon' 
                      ? 'bg-blue-100 border-blue-600 shadow-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-600' 
                      : 'bg-gray-50 border-transparent hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <ScrollText className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>المتون</span>
                </button>
              )}

              <button 
                type="button" 
                onClick={() => { setSubject('sard'); }} 
                className={`py-3 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-1.5 sm:gap-2 border-2 transition-all text-xs sm:text-base ${
                  subject === 'sard' 
                    ? 'bg-emerald-100 border-emerald-600 shadow-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-600' 
                    : 'bg-gray-50 border-transparent hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                }`}
              >
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
                <span>السرد</span>
              </button>
            </div>
            
            {/* في حال اختيار السرد: يتم عرض قائمة طلاب حلقة السرد مع التصفية */}
            {subject === 'sard' ? (
              <div className="space-y-4">
                {/* إدارة وتصفية حلقات السرد */}
                <div className="bg-emerald-50/80 dark:bg-emerald-950/30 p-3.5 sm:p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-black text-emerald-950 dark:text-emerald-200 text-sm sm:text-base">
                        {teacherSardHalaqas.length > 0 && !isGuest
                          ? `حلقة السرد: ${teacherSardHalaqas.find(h => h.id === activeSardHalaqaId)?.name || 'حلقاتي'}`
                          : 'تصفية حلقات السرد'}
                      </span>
                    </div>

                    {teacherSardHalaqas.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsGuest(!isGuest);
                          setSelectedSardHalaqaFilter(null);
                        }} 
                        className="text-xs font-bold text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400"
                      >
                        {isGuest ? 'العودة لطلابي في السرد' : 'تقييم طالب من حلقة سرد أخرى'}
                      </button>
                    )}
                  </div>

                  {/* اختيار حلقة السرد إذا كان لدى المعلم أكثر من حلقة أو في نمط الضيف / المعلم بدون حلقة */}
                  {(isGuest || teacherSardHalaqas.length === 0) ? (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 shrink-0">اختر الحلقة:</label>
                      <select
                        value={selectedSardHalaqaFilter ?? 'ALL'}
                        onChange={e => setSelectedSardHalaqaFilter(e.target.value === 'ALL' ? null : Number(e.target.value))}
                        className="w-full text-xs font-bold p-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      >
                        <option value="ALL">جميع حلقات السرد ({sardHalaqas.length})</option>
                        {sardHalaqas.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : teacherSardHalaqas.length > 1 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {teacherSardHalaqas.map(h => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setSelectedSardHalaqaFilter(h.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                            activeSardHalaqaId === h.id
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white dark:bg-gray-800 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {h.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-lg">اختر الطلاب للسرد:</p>
                    {sardEvalMode === 'group' && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        تم تحديد {toArabicDigits(selectedSardGroupIds.length)} طالب
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    {sardEvalMode === 'group' && (() => {
                      const visibleStudentIds = students
                        .filter(s => {
                          if (!isSmartMatch(s.name, sardSearch)) return false;
                          if (selectedSardGroupIds.includes(s.id)) return true;
                          if (teacherSardHalaqas.length > 0 && !isGuest) {
                            return s.sardHalaqaId === activeSardHalaqaId;
                          }
                          if (selectedSardHalaqaFilter) {
                            return s.sardHalaqaId === selectedSardHalaqaFilter;
                          }
                          return !!s.sardHalaqaId;
                        })
                        .map(s => s.id);
                      
                      const allVisibleSelected = visibleStudentIds.length > 0 && visibleStudentIds.every(id => selectedSardGroupIds.includes(id));
                      
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (allVisibleSelected) {
                              // إلغاء تحديد المعروضين
                              setSelectedSardGroupIds(prev => prev.filter(id => !visibleStudentIds.includes(id)));
                            } else {
                              // تحديد جميع المعروضين
                              setSelectedSardGroupIds(prev => Array.from(new Set([...prev, ...visibleStudentIds])));
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shadow-xs ${
                            allVisibleSelected
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          <span>{allVisibleSelected ? 'إلغاء تحديد الكل' : 'تحديد جميع الطلاب'}</span>
                          <span className="text-[11px] opacity-75">({toArabicDigits(visibleStudentIds.length)})</span>
                        </button>
                      );
                    })()}

                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setSardEvalMode('individual')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                          sardEvalMode === 'individual'
                            ? 'bg-white text-emerald-700 shadow-sm dark:bg-gray-700 dark:text-emerald-400'
                            : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
                        }`}
                      >
                        فردي
                      </button>
                      <button
                        type="button"
                        onClick={() => setSardEvalMode('group')}
                        className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                          sardEvalMode === 'group'
                            ? 'bg-white text-emerald-700 shadow-sm dark:bg-gray-700 dark:text-emerald-400'
                            : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
                        }`}
                      >
                        جماعي
                      </button>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="بحث عن اسم الطالب في السرد..." 
                    value={sardSearch} 
                    onChange={e => setSardSearch(e.target.value)} 
                    className="input-style pr-10" 
                    onFocus={(e) => { e.target.select(); handleInputFocus(e); }}
                  />
                  {sardSearch && (
                    <button 
                      type="button" 
                      onClick={() => setSardSearch('')}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {students
                    .filter(s => {
                      if (!isSmartMatch(s.name, sardSearch)) return false;
                      if (sardEvalMode === 'group' && selectedSardGroupIds.includes(s.id)) return true;
                      if (teacherSardHalaqas.length > 0 && !isGuest) {
                        return s.sardHalaqaId === activeSardHalaqaId;
                      }
                      if (selectedSardHalaqaFilter) {
                        return s.sardHalaqaId === selectedSardHalaqaFilter;
                      }
                      return !!s.sardHalaqaId;
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }))
                    .map(s => {
                      const isEvaluated = (sardEvaluations || []).some(
                        e => e.studentId === s.id && e.weekNumber === selectedWeek
                      );
                      const isGroupSelected = selectedSardGroupIds.includes(s.id);
                      return (
                        <button 
                          key={s.id} 
                          type="button" 
                          onClick={() => {
                            if (sardEvalMode === 'individual') {
                              resetFormFields();
                              setSelectedStudent(s.id);
                            } else {
                              setSelectedSardGroupIds(prev => 
                                prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                              );
                            }
                          }} 
                          className={`p-4 rounded-xl text-right font-bold transition-all border-2 flex items-center justify-between ${
                            s.name.length > 35 ? 'text-[11px]' : 'text-sm'
                          } sm:text-base whitespace-nowrap overflow-hidden ${
                            (sardEvalMode === 'individual' ? selectedStudent === s.id : isGroupSelected)
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md' 
                              : isEvaluated 
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700' 
                              : 'bg-gray-50 text-gray-800 hover:bg-emerald-50 border-gray-100 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <div className="flex flex-col items-start min-w-0">
                            <span className="truncate">{s.name}</span>
                            {s.isAlAmeen && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-normal leading-tight mt-0.5">
                                (من طلاب الأمين)
                              </span>
                            )}
                          </div>
                          {sardEvalMode === 'group' && (
                            <div className={`w-5 h-5 rounded border flex items-center justify-center mr-2 ${isGroupSelected ? 'bg-white text-emerald-700' : 'border-gray-400 dark:border-gray-500'}`}>
                              {isGroupSelected && <span className="text-sm">✓</span>}
                            </div>
                          )}
                          {isEvaluated && sardEvalMode === 'individual' && (
                            <span className="text-[10px] bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100 px-2 py-0.5 rounded-full font-bold mr-2">
                              تم التقييم
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
                {sardEvalMode === 'group' && (
                  <div className="flex justify-center mt-2">
                    <button
                      type="button"
                      onClick={() => setIsCrossHalaqaModalOpen(true)}
                      className="text-sm font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-2"
                    >
                      <span>➕ إضافة طلاب من حلقات أخرى</span>
                    </button>
                  </div>
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-3 items-stretch sm:items-center">
                  <FormNav back={() => setCurrentStep('selectWeek')} />
                  {sardEvalMode === 'group' && selectedSardGroupIds.length > 0 && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setAttendance(AttendanceStatus.PRESENT);
                        setCurrentStep('sardContentSelection');
                      }} 
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <span>التالي ({selectedSardGroupIds.length} طلاب)</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rtl:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* في حال اختيار القرآن أو المتون: يتم عرض قائمة الطلاب التابعة لحلقة المعلم */
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-lg">اختر الطالب لتقييمه:</p>
                  {!isFloating && (
                    <button 
                      type="button" 
                      onClick={() => setIsGuest(!isGuest)} 
                      className="text-xs font-bold text-blue-600 underline hover:text-blue-800 dark:text-blue-400"
                    >
                      {isGuest ? 'العودة لطلابي' : 'تقييم طالب من حلقة أخرى'}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="بحث عن اسم الطالب..." 
                    value={isGuest ? guestSearch : primarySearch} 
                    onChange={e => isGuest ? setGuestSearch(e.target.value) : setPrimarySearch(e.target.value)} 
                    className="input-style pr-10" 
                    onFocus={(e) => { e.target.select(); handleInputFocus(e); }}
                  />
                  {(isGuest ? guestSearch : primarySearch) && (
                    <button 
                      type="button" 
                      onClick={() => isGuest ? setGuestSearch('') : setPrimarySearch('')}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {students
                    .filter(s => (isGuest || s.halaqaId === selectedHalaqa) && isSmartMatch(s.name, isGuest ? guestSearch : primarySearch) && (subject !== 'mutoon' || s.isAlAmeen))
                    .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }))
                    .map(s => {
                    const isEvaluated = evaluations.some(e => e.studentId === s.id && e.weekNumber === selectedWeek && (subject === 'mutoon' ? e.subject === 'mutoon' : e.subject !== 'mutoon') && !e.isTest);
                    return (
                      <button 
                        key={s.id} 
                        type="button" 
                        onClick={() => {
                          resetFormFields();
                          setSelectedStudent(s.id);
                        }} 
                        className={`p-4 rounded-xl text-right font-bold transition-all border-2 ${s.name.length > 35 ? 'text-[11px]' : 'text-sm'} sm:text-base whitespace-nowrap overflow-hidden ${selectedStudent === s.id ? 'bg-green-600 text-white border-green-700 shadow-md' : isEvaluated ? 'bg-green-100 text-green-900 border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700' : 'bg-gray-50 text-gray-800 hover:bg-green-50 border-gray-100 dark:bg-gray-700 dark:text-gray-200'}`}
                      >
                        <div className="flex flex-col justify-center items-start w-full">
                          <span className="truncate w-full">{s.name}</span>
                          {s.isAlAmeen && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-normal leading-tight mt-0.5">
                              (من طلاب الأمين)
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <FormNav back={() => setCurrentStep('selectWeek')} />
              </div>
            )}
          </div>
        )}

        {currentStep === 'selectAttendance' && activeStudent && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="font-bold text-xl">
                حالة الطالب {subject === 'sard' ? 'في السرد' : ''}: <span className="text-green-700 dark:text-green-300">{activeStudent.name}</span>
              </p>
              {activeStudent.isAlAmeen && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  (من طلاب الأمين)
                </p>
              )}
            </div>
            <StudentProgressInfo student={activeStudent} subject={subject} />
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button 
                type="button" 
                onClick={() => { 
                  setAttendance(AttendanceStatus.PRESENT); 
                  if (subject === 'sard') {
                    setCurrentStep('sardContentSelection');
                  } else {
                    setCurrentStep(subject === 'mutoon' ? 'mutoonEvaluation' : 'selectEvaluationType');
                  }
                }} 
                className={`py-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${attendance === AttendanceStatus.PRESENT ? 'bg-green-100 border-green-600 text-green-900 shadow-md scale-105' : 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-900/20'}`}
              >
                <span className="text-2xl">✅</span>
                <span className="text-lg font-bold">حاضر</span>
              </button>
              <button 
                type="button" 
                onClick={() => { 
                  setAttendance(AttendanceStatus.LATE); 
                  if (subject === 'sard') {
                    setCurrentStep('sardContentSelection');
                  } else {
                    setCurrentStep(subject === 'mutoon' ? 'mutoonEvaluation' : 'selectEvaluationType');
                  }
                }} 
                className={`py-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${attendance === AttendanceStatus.LATE ? 'bg-blue-100 border-blue-600 text-blue-900 shadow-md scale-105' : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20'}`}
              >
                <span className="text-2xl">🕒</span>
                <span className="text-lg font-bold">متأخر</span>
              </button>
              <button 
                type="button" 
                onClick={() => { 
                  setAttendance(AttendanceStatus.ABSENT); 
                  setEvalType(undefined);
                  setPages('');
                  setAyahRange('');
                  setSurahs([]);
                  setPerf(undefined);
                  setPReview(undefined);
                  setCurrentStep('selectAbsenceReason'); 
                }} 
                className={`col-span-2 py-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${attendance === AttendanceStatus.ABSENT ? 'bg-red-100 border-red-600 text-red-900 shadow-md scale-105' : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-900/20'}`}
              >
                <span className="text-2xl">🚫</span>
                <span className="text-lg font-bold">غائب</span>
              </button>
            </div>
            <FormNav back={() => {
              setSelectedStudent(null);
              lastCheckedRef.current = '';
              resetFormFields();
              setCurrentStep('selectStudent');
            }} />
          </div>
        )}

        {currentStep === 'selectAbsenceReason' && (
          <div className="space-y-4">
            <p className="font-bold text-lg">سبب الغياب:</p>
            <div className="flex gap-4">
              <button type="button" onClick={() => { setAbsenceReason(AbsenceReason.WITH_EXCUSE); setCurrentStep('notesStep'); }} className={`flex-1 py-6 rounded-xl font-bold border-2 transition-all ${absenceReason === AbsenceReason.WITH_EXCUSE ? 'bg-yellow-100 border-yellow-500 shadow-sm' : 'bg-yellow-50 border-transparent dark:bg-gray-700'}`}>بعذر</button>
              <button type="button" onClick={() => { setAbsenceReason(AbsenceReason.WITHOUT_EXCUSE); setCurrentStep('notesStep'); }} className={`flex-1 py-6 rounded-xl font-bold border-2 transition-all ${absenceReason === AbsenceReason.WITHOUT_EXCUSE ? 'bg-gray-200 border-gray-500 shadow-sm' : 'bg-gray-100 border-transparent dark:bg-gray-600'}`}>بدون عذر</button>
            </div>
            <FormNav back={() => setCurrentStep('selectAttendance')} />
          </div>
        )}

        {currentStep === 'mutoonEvaluation' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
              <div>
                <h3 className="font-black text-xl text-blue-900 dark:text-blue-200">تقييم المتون العلمية</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  حدد عدد الأبيات في كل متن وسيظهر زر رصد الأخطاء الخاص بكل متن مباشرة
                </p>
              </div>
              <span className="self-start sm:self-auto px-3 py-1 bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800">
                {toArabicDigits(activeMatns.length)} متون مفعّلة
              </span>
            </div>
            
            {activeMatns.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 space-y-2">
                <p className="font-bold text-gray-600 dark:text-gray-300">لا توجد متون مفعّلة في النظام حالياً.</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">يمكنك تفعيل المتون من قائمة إعدادات المشرف في شريط التنقل العلوي.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeMatns.map((m, index) => {
                  const mEval = getMatnEval(m.name);
                  const theme = MATN_CARD_THEMES[index % MATN_CARD_THEMES.length];
                  const prevMemorized = evaluations
                    .filter(e => e.studentId === activeStudent?.id && e.subject === 'mutoon' && e.evaluationType === EvaluationType.MEMORIZATION && e.surahs?.includes(m.name))
                    .reduce((sum, e) => sum + (e.pages || 0), 0);

                  const isCompleted = prevMemorized >= m.linesCount;
                  const remaining = Math.max(0, m.linesCount - prevMemorized);
                  const isEvaluated = mEval.lines !== '';

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

                  const autoRange = typeof mEval.lines === 'number' && mEval.lines > 0
                    ? calculateMatnAyahRange(activeStudent?.id, m.name, mEval.lines)
                    : { fromAyah: '', toAyah: '' };
                  const from = (mEval.fromAyah !== undefined && mEval.fromAyah !== '') ? mEval.fromAyah : autoRange.fromAyah;
                  const to = (mEval.toAyah !== undefined && mEval.toAyah !== '') ? mEval.toAyah : autoRange.toAyah;

                  return (
                    <div
                      id={`mutoon-eval-card-${index}`}
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
                                  updateMatnEval(m.name, {
                                    lines: mEval.lines === 'review' ? '' : 'review',
                                    fromAyah: '',
                                    toAyah: '',
                                    errors: mEval.lines === 'review' ? 0 : mEval.errors,
                                  });
                                }}
                                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all border ${
                                  mEval.lines === 'review'
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                    : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600'
                                }`}
                              >
                                {mEval.lines === 'review' ? '✓ تم تحديد: مراجعة المتن' : 'تحديد مراجعة المتن لهذا الأسبوع'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateMatnEval(m.name, {
                                    lines: mEval.lines === 'not_ready' ? '' : 'not_ready',
                                    fromAyah: '',
                                    toAyah: '',
                                    errors: 0,
                                  });
                                }}
                                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all border ${
                                  mEval.lines === 'not_ready'
                                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                    : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600'
                                }`}
                              >
                                {mEval.lines === 'not_ready' ? 'غير مستعد' : 'غير مستعد'}
                              </button>
                              {isEvaluated && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateMatnEval(m.name, { lines: '', fromAyah: '', toAyah: '', errors: 0 });
                                  }}
                                  className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-red-600 transition-all"
                                >
                                  إلغاء التحديد
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 block">
                                عدد الأبيات لهذا الأسبوع
                              </label>
                              <select
                                value={mEval.lines === '' || mEval.lines === undefined || mEval.lines === null || Number.isNaN(mEval.lines) ? '' : mEval.lines}
                                onChange={e => {
                                  const val = e.target.value;
                                  const parsedLines = val === 'not_ready' ? 'not_ready' : (val === '' ? '' : Number(val));
                                  if (typeof parsedLines === 'number' && parsedLines > 0) {
                                    const range = calculateMatnAyahRange(activeStudent?.id, m.name, parsedLines);
                                    updateMatnEval(m.name, {
                                      lines: parsedLines,
                                      fromAyah: range.fromAyah,
                                      toAyah: range.toAyah,
                                    });
                                  } else {
                                    updateMatnEval(m.name, {
                                      lines: parsedLines,
                                      fromAyah: '',
                                      toAyah: '',
                                      errors: 0,
                                    });
                                  }
                                }}
                                className="input-style text-sm w-full font-bold bg-white dark:bg-slate-700"
                              >
                                <option value="">اختر عدد الأبيات...</option>
                                <option value="not_ready" className="text-red-600 font-bold">غير مستعد (ضعيف)</option>
                                {uniqueOptions.map(opt => (
                                  <option key={opt} value={opt}>
                                    {opt === remaining ? `المتبقي كاملاً (${toArabicDigits(opt)} بيتاً)` : `${toArabicDigits(opt)} أبيات`}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {typeof mEval.lines === 'number' && mEval.lines > 0 && (
                              <div className="p-3 bg-white/95 dark:bg-gray-800/95 rounded-xl border border-blue-200 dark:border-blue-700/60 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">أرقام الأبيات:</span>
                                  <span className={`text-sm font-black px-3 py-1 rounded-lg border shadow-2xs ${theme.rangeBadge}`} dir="rtl">
                                    {(from && to) ? formatRtlRange(`${from} - ${to}`) : '—'}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const priorEvals = evaluations.filter(ev => 
                                      ev.studentId === activeStudent?.id && 
                                      ev.subject === 'mutoon' && 
                                      ev.evaluationType === EvaluationType.MEMORIZATION && 
                                      ev.surahs?.includes(m.name) &&
                                      (selectedWeek ? ev.weekNumber < selectedWeek : true)
                                    ).sort((a, b) => a.weekNumber - b.weekNumber);

                                    let prevFrom: number | undefined;
                                    let prevTo: number | undefined;

                                    if (priorEvals.length > 0) {
                                      const lastPrior = priorEvals[priorEvals.length - 1];
                                      const lastPages = lastPrior.pages || 0;
                                      if (lastPages > 0) {
                                        const totalPriorLines = priorEvals.reduce((sum, ev) => sum + (ev.pages || 0), 0);
                                        prevTo = totalPriorLines;
                                        prevFrom = totalPriorLines - lastPages + 1;
                                      }
                                    }

                                    setViewingVersesModal({
                                      isOpen: true,
                                      matnName: m.name,
                                      fromVerse: from,
                                      toVerse: to,
                                      prevFromVerse: prevFrom,
                                      prevToVerse: prevTo,
                                    });
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                                  title="عرض نصوص أبيات التقييم المحددة"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                                  <span>إظهار الأبيات</span>
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* رسالة غير مستعد */}
                      {mEval.lines === 'not_ready' && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-700 dark:text-rose-300">تم تسجيل الطالب غير مستعد في متن «{m.name}»</span>
                          <span className="px-3 py-1 bg-rose-600 text-white text-xs font-black rounded-lg">التقييم: ضعيف</span>
                        </div>
                      )}

                      {/* زر الأخطاء الخاص بالمتن: يظهر فقط بعد اختيار عدد الأبيات أو المراجعة */}
                      {((typeof mEval.lines === 'number' && mEval.lines > 0) || mEval.lines === 'review') && (
                        <div className="pt-3 border-t border-black/10 dark:border-white/10">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div 
                              onClick={() => {
                                updateMatnEval(m.name, { errors: (mEval.errors || 0) + 1 });
                              }}
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
                                    value={safeInputNumber(mEval.errors)} 
                                    placeholder="0" 
                                    onChange={e => {
                                      updateMatnEval(m.name, { errors: Math.max(0, parseSafeNumber(e.target.value)) });
                                    }} 
                                    onFocus={e => e.target.select()} 
                                    className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-rose-600 dark:text-rose-400 focus:text-rose-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-2xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-200 dark:placeholder:text-rose-900/40 z-10" 
                                  />
                                </div>
                              </div>
                            </div>

                            {/* شارة التقييم لهذا المتن */}
                            <div className="flex items-center justify-center">
                              {(() => {
                                let gradeStr = '';
                                let gradeClass = '';
                                if (mEval.errors <= 2) { gradeStr = 'ممتاز'; gradeClass = 'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800'; }
                                else if (mEval.errors <= 6) { gradeStr = 'جيد جدا'; gradeClass = 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'; }
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
            )}

            <FormNav
              back={() => setCurrentStep('selectAttendance')}
              next={() => {
                const evaluatedList = mutoonEvaluations.filter(m => m.lines !== '');
                if (evaluatedList.length === 0) {
                  setError('الرجاء تحديد عدد الأبيات لمتن واحد على الأقل قبل المتابعة.');
                  return;
                }
                setCurrentStep('notesStep');
              }}
            />
          </div>
        )}

        {currentStep === 'selectEvaluationType' && (
          <div className="space-y-4">
            <p className="font-bold text-lg">نوع الإنجاز:</p>
            <div className="flex gap-4">
              <button type="button" onClick={() => { setEvalType(EvaluationType.MEMORIZATION); setCurrentStep('memorizationDetails'); }} className={`flex-1 py-6 rounded-xl font-bold border-2 transition-all ${evalType === EvaluationType.MEMORIZATION ? 'bg-green-100 border-green-600 text-green-900 shadow-sm' : 'bg-green-50 text-green-800 border-transparent dark:bg-green-900/20'}`}>حفظ جديد</button>
              <button type="button" onClick={() => { 
                setEvalType(EvaluationType.REVIEW); 
                setCurrentStep('selectPerformanceLevel'); 
              }} className={`flex-1 py-6 rounded-xl font-bold border-2 transition-all ${evalType === EvaluationType.REVIEW ? 'bg-blue-100 border-blue-600 text-blue-900 shadow-sm' : 'bg-blue-50 text-blue-800 border-transparent dark:bg-blue-900/20'}`}>مراجعة</button>
              <button type="button" onClick={() => { 
                setEvalType(EvaluationType.DID_NOT_MEMORIZE); 
                setPerf(undefined);
                setPages('');
                setAyahRange('');
                setSurahs([]);
                setPReview(undefined);
                setCurrentStep('notesStep'); 
              }} className={`flex-1 py-6 rounded-xl font-bold border-2 transition-all ${evalType === EvaluationType.DID_NOT_MEMORIZE ? 'bg-gray-200 border-gray-600 text-gray-900 shadow-sm' : 'bg-gray-100 text-gray-800 border-transparent dark:bg-gray-700'}`}>غير مستعد</button>
            </div>
            <FormNav back={() => setCurrentStep('selectAttendance')} />
          </div>
        )}

        {currentStep === 'memorizationDetails' && (
          <div className="space-y-6">
            {subject === 'mutoon' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-bold mb-1 block">عدد الأبيات</label><input type="number" min="0" step="0.1" value={pages === '' || isNaN(Number(pages)) ? '' : pages} onChange={e => { const v = parseSafeNumber(e.target.value, NaN); setPages(isNaN(v) ? '' : v); setHighlightPagesInput(false); }} className={`input-style text-center font-bold ${highlightPagesInput ? 'ring-4 ring-red-400 animate-pulse' : ''}`} onFocus={handleInputFocus}/></div>
                  <div><label className="text-xs font-bold mb-1 block">اسم المتن والأبيات</label><input type="text" value={ayahRange} onChange={e => setAyahRange(e.target.value)} className="input-style text-center" onFocus={handleInputFocus}/></div>
                </div>
                <div className="relative space-y-1.5">
                  <label className="text-xs font-black text-gray-500 block mr-1 uppercase tracking-wider">تحديد المتون</label>
                  <button 
                    type="button" 
                    onClick={() => { setIsSurahOpen(!isSurahOpen); setHighlightSurahInput(false); }} 
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 ${isSurahOpen ? 'bg-green-50 border-green-600 shadow-inner' : 'bg-gray-50 border-gray-100 dark:bg-gray-700/50 hover:border-green-300'} ${highlightSurahInput ? 'ring-4 ring-red-400 animate-pulse' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSurahOpen ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                      </div>
                      <span className={`font-black text-sm ${isSurahOpen ? 'text-green-900' : 'text-gray-700 dark:text-gray-200'}`}>
                        {surahs.length > 0 ? `تم اختيار (${surahs.length}) متون` : 'اضغط لاختيار المتون...'}
                      </span>
                    </div>
                  </button>
                  {isSurahOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up">
                      <div className="p-3 border-b border-gray-100 dark:border-gray-700">
                        <input type="text" placeholder={subject === 'mutoon' ? 'ابحث عن اسم المتن...' : 'ابحث عن اسم السورة...'} value={surahSearch} onChange={e => setSurahSearch(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" onClick={e => e.stopPropagation()} />
                      </div>
                      <div className="max-h-60 overflow-y-auto p-2 grid grid-cols-2 gap-1.5" onClick={e => e.stopPropagation()}>
                        {filteredSurahs.map(s => {
                          const isSelected = surahs.includes(s);
                          return (
                            <button key={s} type="button" onClick={() => setSurahs(prev => isSelected ? prev.filter(x => x !== s) : [...prev, s])} className={`text-right px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${isSelected ? 'bg-green-100 text-green-800 shadow-sm' : 'hover:bg-gray-50 text-gray-700 dark:text-gray-200 dark:hover:bg-gray-700'}`}>
                              {s}
                            </button>
                          );
                        })}
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-100 dark:border-gray-600">
                        <button type="button" onClick={() => setIsSurahOpen(false)} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all">تم الاختيار ({surahs.length})</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {surahs.length > 0 && (
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800 text-sm space-y-1">
                    <p className="font-bold text-indigo-900 dark:text-indigo-200 flex justify-between">
                      <span>السور المحددة:</span>
                      <span className="font-black text-left">{surahs.join('، ')}</span>
                    </p>
                    <p className="font-bold text-indigo-900 dark:text-indigo-200 flex justify-between">
                      <span>الآيات:</span>
                      <span className="text-green-700 dark:text-green-400">{ayahRange || 'كاملة'}</span>
                    </p>
                  </div>
                )}

                {/* دليل الألوان لتوضيح المحفوظ والمحدد */}
                <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-[10px] font-bold">
                  <span className="text-gray-500 dark:text-gray-400">دليل الألوان:</span>
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200 px-2 py-0.5 rounded-md border border-emerald-400 dark:border-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                    {evalType === EvaluationType.REVIEW ? 'المحفوظ القديم 🟢' : 'محفوظ سابقاً'}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 dark:bg-amber-950/70 dark:text-amber-200 px-2 py-0.5 rounded-md border border-[#8B4513]/50">
                    <span className="w-2 h-2 rounded-full bg-[#8B4513] inline-block"></span>
                    {evalType === EvaluationType.REVIEW ? 'المحفوظ الجديد لجميع الأسابيع 🟤' : 'محفوظ حديثاً (الأسبوع الماضي)'}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-green-500 text-white px-2 py-0.5 rounded-md shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-white inline-block"></span>
                    {evalType === EvaluationType.REVIEW ? 'محدد للمراجعة ✓' : 'محدد للحفظ الجديد ✓'}
                  </span>
                </div>

                <div>
                  <p className="font-bold text-xs text-center text-gray-600 dark:text-gray-300 mb-2">اختر الجزء لعرض وتحديد صفحاته أو سوره:</p>
                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-1.5 sm:gap-2 p-2 sm:p-3 bg-gray-50/90 dark:bg-gray-800/60 rounded-2xl border border-gray-200/80 dark:border-gray-700">
                      {Array.from({length: 30}, (_, i) => i + 1).map(juz => {
                        const juzPages = juzPagesMap[juz] || [];
                        const selectedInJuz = juzPages.filter(p => selectionState.allActivePages.includes(p)).length;
                        const isFullySelected = juzPages.length > 0 && selectedInJuz === juzPages.length;
                        const isPartiallySelected = selectedInJuz > 0 && !isFullySelected;
                        const isCompleted = studentQuranHistory.allFullJuzs.has(juz);
                        const isNowCompleted = completedJuzsFromSelection.includes(juz);
                        const isSelected = selectedJuzForPages === juz;
                        const isNewEvalsJuz = studentQuranHistory.newEvalsFullJuzs.has(juz);
                        const isOldJuz = studentQuranHistory.oldFullJuzs.has(juz);

                        let juzStyle = 'bg-white text-indigo-700 border border-indigo-200/80 hover:bg-indigo-50/80 dark:bg-gray-700/80 dark:text-indigo-200 dark:border-gray-600 shadow-2xs';
                        let badgeText = null;

                        if (isFullySelected) {
                          juzStyle = 'bg-emerald-600 text-white border border-emerald-700 shadow-md ring-2 ring-emerald-300 dark:ring-emerald-600 font-bold';
                          badgeText = `كامل (${toArabicDigits(juzPages.length)}) ✓`;
                        } else if (isPartiallySelected) {
                          juzStyle = 'bg-indigo-100 text-indigo-950 border-2 border-dashed border-indigo-500 font-bold dark:bg-indigo-950 dark:text-indigo-200';
                          badgeText = `(${toArabicDigits(selectedInJuz)}/${toArabicDigits(juzPages.length)})`;
                        } else if (evalType === EvaluationType.REVIEW) {
                          if (isSelected) {
                            juzStyle = 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-500 font-bold';
                          } else if (isNewEvalsJuz) {
                            juzStyle = 'bg-amber-100/90 text-amber-950 border-2 border-[#8B4513]/70 hover:bg-amber-200 font-bold dark:bg-amber-950/60 dark:text-amber-200';
                            badgeText = 'جديد 🟤';
                          } else if (isOldJuz) {
                            juzStyle = 'bg-emerald-100/90 text-emerald-950 border-2 border-emerald-700/70 hover:bg-emerald-200 font-bold dark:bg-emerald-950/60 dark:text-emerald-200';
                            badgeText = 'قديم 🟢';
                          }
                        } else {
                          // وضع الحفظ
                          if (isCompleted) {
                            juzStyle = 'bg-green-800 text-white/90 border border-green-900 cursor-not-allowed opacity-80 dark:bg-green-950 dark:text-green-300 dark:border-green-800 shadow-none';
                            badgeText = 'مكتمل ✓';
                          } else if (isNowCompleted) {
                            juzStyle = 'bg-emerald-600 text-white border border-emerald-700 shadow-sm ring-2 ring-emerald-400 font-bold';
                            badgeText = 'مكتمل الآن ✓';
                          } else if (isSelected) {
                            juzStyle = 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-500 font-bold';
                          }
                        }

                        const isDisabled = evalType !== EvaluationType.REVIEW && isCompleted;

                        return (
                          <button 
                            key={juz} 
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              if (!isDisabled) {
                                setSelectedJuzForPages(isSelected ? null : juz);
                              }
                            }}
                            title={isDisabled ? `جزء ${juz} (مكتمل الحفظ بالكامل مسبقاً)` : `جزء ${juz}`}
                            className={`p-1.5 sm:p-2 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center min-h-[46px] sm:min-h-[50px] active:scale-95 cursor-pointer ${juzStyle}`}
                          >
                            <span className={`text-[11px] sm:text-xs font-black leading-tight ${isDisabled ? 'line-through decoration-white/70' : ''}`}>
                              جزء {toArabicDigits(juz)}
                            </span>
                            {badgeText && (
                              <span className="text-[8px] sm:text-[9px] font-bold opacity-95 no-underline leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                {badgeText}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedJuzForPages && (
                      <div className="mt-4 p-3.5 bg-white dark:bg-gray-800 rounded-2xl border-2 border-indigo-100 dark:border-gray-700 space-y-3.5 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3 gap-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base sm:text-lg">📖</span>
                            <p className="text-sm sm:text-base font-black text-indigo-950 dark:text-indigo-200">
                              محتوى الجزء {toArabicDigits(selectedJuzForPages)}
                            </p>
                          </div>
                          
                          {/* تبويب الصفحات والسور المميز والأكبر لشاشة الهاتف */}
                          <div className="flex w-full sm:w-auto bg-gray-100 dark:bg-gray-900/90 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-inner gap-1.5">
                            <button
                              type="button"
                              onClick={() => setQuranSelectionTab('pages')}
                              className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer ${
                                quranSelectionTab === 'pages'
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md ring-2 ring-emerald-300 dark:ring-emerald-700'
                                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800'
                              }`}
                            >
                              <span className="text-sm sm:text-base">📄</span>
                              <span>الصفحات</span>
                              <span className={`text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                                quranSelectionTab === 'pages'
                                  ? 'bg-white/20 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}>
                                {toArabicDigits((juzPagesMap[selectedJuzForPages] || []).length)}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuranSelectionTab('surahs')}
                              className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer ${
                                quranSelectionTab === 'surahs'
                                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-700'
                                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800'
                              }`}
                            >
                              <span className="text-sm sm:text-base">📜</span>
                              <span>السور</span>
                              <span className={`text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                                quranSelectionTab === 'surahs'
                                  ? 'bg-white/20 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}>
                                {toArabicDigits((juzSurahsMap[selectedJuzForPages] || []).length)}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* شريط الإجراءات السريعة للجزء */}
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 dark:bg-gray-700/50 p-2 rounded-xl border border-indigo-100 dark:border-gray-600">
                          <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                            إجراءات سريعة للجزء {toArabicDigits(selectedJuzForPages)}:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => toggleFullJuz(selectedJuzForPages)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[11px] font-black rounded-lg shadow-xs transition-all active:scale-95"
                            >
                              {(juzPagesMap[selectedJuzForPages] || []).every(p => selectionState.allActivePages.includes(p)) 
                                ? '✕ إلغاء تحديد الجزء' 
                                : `⚡ تحديد كامل الجزء (${(juzPagesMap[selectedJuzForPages] || []).length} ص)`}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSurahsInJuz(selectedJuzForPages)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-black rounded-lg shadow-xs transition-all active:scale-95"
                            >
                              {(juzSurahsMap[selectedJuzForPages] || []).every(s => selectedSurahIds.includes(s)) 
                                ? '✕ إلغاء سور الجزء' 
                                : '📜 تحديد كل سور الجزء'}
                            </button>
                          </div>
                        </div>

                        {quranSelectionTab === 'pages' && (
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                            {juzPagesMap[selectedJuzForPages]?.map(page => {
                              const hist = getPageHistory(page);
                              const isPrevWeekFull = hist === 'PREV_WEEK_FULL';
                              const isPrevWeekPartial = hist === 'PREV_WEEK_PARTIAL';
                              const isPriorFull = hist === 'PRIOR_FULL';
                              const isPriorPartial = hist === 'PRIOR_PARTIAL';
                              
                              const isDirectPage = selectionState.directPages.has(page);
                              const isDerivedPage = selectionState.derivedPages.has(page);

                              let btnStyle = 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300';
                              let title = undefined;

                              if (isDirectPage) {
                                btnStyle = 'bg-green-500 text-white shadow-sm scale-105 font-bold ring-2 ring-green-300';
                                title = 'محددة مباشرة برقم الصفحة';
                              } else if (isDerivedPage) {
                                btnStyle = 'bg-green-100 text-green-900 border-2 border-dashed border-green-600 font-bold dark:bg-green-950/40 dark:text-green-200 dark:border-green-500';
                                title = 'محددة عبر اختيار السورة في تبويب السور';
                              } else if (evalType === EvaluationType.REVIEW) {
                                if (studentQuranHistory.newEvalsFullPages.has(page)) {
                                  btnStyle = 'bg-amber-100 text-[#8B4513] border-2 border-[#8B4513]/70 hover:bg-amber-200 font-bold dark:bg-amber-950/50 dark:text-amber-200';
                                  title = 'صفحة محفوظ جديد لجميع الأسابيع 🟤 (انقر لتحديدها للمراجعة)';
                                } else if (studentQuranHistory.oldFullPages.has(page)) {
                                  btnStyle = 'bg-emerald-100 text-emerald-950 border-2 border-emerald-700/70 hover:bg-emerald-200 font-bold dark:bg-emerald-950/50 dark:text-emerald-200';
                                  title = 'صفحة محفوظ قديم 🟢 (انقر لتحديدها للمراجعة)';
                                } else if (isPrevWeekPartial || isPriorPartial) {
                                  btnStyle = 'bg-amber-50 text-[#8B4513] border-2 border-dashed border-[#8B4513] font-bold hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300';
                                  title = 'صفحة غير مكتملة';
                                }
                              } else {
                                if (isPrevWeekFull) {
                                  btnStyle = 'bg-[#8B4513] text-white shadow-sm cursor-not-allowed border border-[#5c2e0b]';
                                  title = 'تم حفظها بالكامل في الأسبوع السابق';
                                } else if (isPriorFull) {
                                  btnStyle = 'bg-green-800 text-white opacity-90 cursor-not-allowed dark:bg-green-900 dark:text-green-100 border border-green-900';
                                  title = 'تم حفظها بالكامل في الأسابيع السابقة';
                                } else if (isPrevWeekPartial) {
                                  btnStyle = 'bg-amber-50 text-[#8B4513] border-2 border-dashed border-[#8B4513] font-bold hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300';
                                  title = 'صفحة غير مكتملة من الأسبوع السابق (منقطة الإطار - قابلة للتحديد)';
                                } else if (isPriorPartial) {
                                  btnStyle = 'bg-emerald-50 text-emerald-900 border-2 border-dashed border-green-800 font-bold hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200';
                                  title = 'صفحة غير مكتملة من الأسابيع السابقة (منقطة الإطار - قابلة للتحديد)';
                                }
                              }

                              const isPageDisabled = evalType !== EvaluationType.REVIEW && (isPrevWeekFull || isPriorFull);

                              return (
                                <button
                                  key={page}
                                  type="button"
                                  onClick={() => toggleNewPage(page)}
                                  disabled={isPageDisabled}
                                  title={title}
                                  className={`p-2 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${btnStyle}`}
                                >
                                  {toArabicDigits(page)}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {quranSelectionTab === 'surahs' && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                            {juzSurahsMap[selectedJuzForPages]?.length > 0 ? (
                              juzSurahsMap[selectedJuzForPages].map(sId => {
                                const name = surahNames[sId];
                                const hist = getSurahHistory(sId);
                                const isPrevWeekFull = hist === 'PREV_WEEK_FULL';
                                const isPriorFull = hist === 'PRIOR_FULL';
                                
                                const isDirectSurah = selectionState.directSurahs.has(sId);
                                const isDerivedSurah = selectionState.derivedSurahs.has(sId);

                                let btnStyle = 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300';
                                let title = undefined;

                                if (isDirectSurah) {
                                  btnStyle = 'bg-green-500 text-white shadow-sm scale-105 font-bold ring-2 ring-green-300';
                                  title = 'محددة كـ سورة كاملة';
                                } else if (isDerivedSurah) {
                                  btnStyle = 'bg-green-100 text-green-900 border-2 border-dashed border-green-600 font-bold dark:bg-green-950/40 dark:text-green-200 dark:border-green-500';
                                  title = 'محددة جزئياً أو كلياً عبر اختيار رقم الصفحة في تبويب الصفحات';
                                } else if (evalType === EvaluationType.REVIEW) {
                                  if (studentQuranHistory.newEvalsFullSurahs.has(sId)) {
                                    btnStyle = 'bg-amber-100 text-amber-950 border-2 border-[#8B4513]/70 hover:bg-amber-200 font-bold dark:bg-amber-950/50 dark:text-amber-200';
                                    title = 'سورة محفوظ جديد لجميع الأسابيع 🟤 (انقر لتحديدها للمراجعة)';
                                  } else if (studentQuranHistory.oldFullSurahs.has(sId)) {
                                    btnStyle = 'bg-emerald-100 text-emerald-950 border-2 border-emerald-700/70 hover:bg-emerald-200 font-bold dark:bg-emerald-950/50 dark:text-emerald-200';
                                    title = 'سورة محفوظ قديم 🟢 (انقر لتحديدها للمراجعة)';
                                  }
                                } else {
                                  if (isPrevWeekFull) {
                                    btnStyle = 'bg-[#8B4513] text-white shadow-sm cursor-not-allowed border border-[#5c2e0b]';
                                    title = 'تم حفظ السورة بالكامل في الأسبوع السابق';
                                  } else if (isPriorFull) {
                                    btnStyle = 'bg-green-800 text-white opacity-90 cursor-not-allowed dark:bg-green-900 dark:text-green-100 border border-green-900';
                                    title = 'تم حفظ السورة بالكامل في الأسابيع السابقة';
                                  }
                                }

                                const isSurahDisabled = evalType !== EvaluationType.REVIEW && (isPrevWeekFull || isPriorFull);

                                return (
                                  <button
                                    key={sId}
                                    type="button"
                                    onClick={() => toggleSurah(sId)}
                                    disabled={isSurahDisabled}
                                    title={title}
                                    className={`p-2.5 rounded-lg font-bold text-xs flex items-center justify-between text-right transition-all ${btnStyle}`}
                                  >
                                    <span>{name}</span>
                                    <span className="text-[10px] opacity-75 font-normal">
                                      {surahPagesMap[sId]?.length === 1 ? 'صفحة' : `${toArabicDigits(surahPagesMap[sId]?.length || 1)} ص`}
                                    </span>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="col-span-full py-4 text-center text-xs text-gray-500">
                                لا توجد سور في هذا الجزء.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                {/* إشعار اكتمال أجزاء جديدة بناءً على التحديد في الحفظ الجديد */}
                {evalType !== EvaluationType.REVIEW && completedJuzsFromSelection.length > 0 && (
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded-xl text-center text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    ✨ يكتمل جزء ({completedJuzsFromSelection.map(toArabicDigits).join('، ')}) بهذا التحديد!
                  </div>
                )}

                {highlightSelectionError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/50 border-2 border-red-400 rounded-xl text-center text-xs sm:text-sm font-black text-red-700 dark:text-red-300 animate-pulse">
                    ⚠️ يرجى اختيار صفحة أو سورة واحدة على الأقل للمتابعة إلى التقييم
                  </div>
                )}

                <div className="text-center text-xs font-bold mt-2 text-green-700 dark:text-green-400">
                  {evalType === EvaluationType.REVIEW ? (
                    <span>تم تحديد ({toArabicDigits(selectionState.allActivePages.length)}) صفحة للمراجعة</span>
                  ) : (
                    <>
                      تم تحديد ({toArabicDigits(selectionState.newPagesCount)}) صفحة جديدة
                      {selectionState.recompletedPagesCount > 0 && (
                        <span className="text-[11px] text-amber-700 dark:text-amber-300 mr-1 font-normal">
                          (تم استثناء {toArabicDigits(selectionState.recompletedPagesCount)} صفحة محسوبة مسبقاً)
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            
            <FormNav back={() => setCurrentStep('selectEvaluationType')} next={() => {
                let hasError = false;
                if (subject === 'mutoon') {
                  if (!pages) {
                      setHighlightPagesInput(true);
                      setTimeout(() => setHighlightPagesInput(false), 1500);
                      hasError = true;
                  }
                  if (surahs.length === 0) {
                       setHighlightSurahInput(true);
                       setTimeout(() => setHighlightSurahInput(false), 1500);
                       hasError = true;
                  }
                } else {
                  if (selectionState.allActivePages.length === 0) {
                      setHighlightSelectionError(true);
                      setTimeout(() => setHighlightSelectionError(false), 2500);
                      hasError = true;
                  }
                }
                if (hasError) return;
                
                setCurrentStep('selectPerformanceLevel');
            }} />
          </div>
        )}

        {currentStep === 'sardContentSelection' && (
          <div className="space-y-5 animate-fade-in max-w-2xl mx-auto py-2">
            <p className="font-bold text-xl text-center">
              {sardEvalMode === 'group' ? (
                <>تحديد محتوى السرد لـ: <span className="text-emerald-700 dark:text-emerald-300">{selectedSardGroupIds.length} طلاب</span></>
              ) : (
                <>تحديد محتوى السرد: <span className="text-emerald-700 dark:text-emerald-300">{activeStudent?.name}</span></>
              )}
            </p>
              {/* شريط مصحف السرد وزر تصفح صفحات التقييم المحددة */}
              <div className="flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-3 sm:p-3.5 rounded-2xl shadow-sm border border-emerald-700/60">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">📖</span>
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
                  disabled={sardActivePages.length === 0}
                  className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-white hover:bg-emerald-50 text-emerald-900 text-xs sm:text-sm font-black rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  title="فتح صفحات المصحف للسرد"
                >
                  <span>فتح المصحف</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {toArabicDigits(sardActivePages.length)} ص
                  </span>
                </button>
              </div>

              {/* عرض بيانات محفوظ الطالب (القديم والجديد) */}
              {activeStudent && <StudentProgressInfo student={activeStudent} subject={subject} />}

              {/* اختيار المحتوى المسرد بالأجزاء أو السور أو الصفحات */}
              <div className="space-y-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black text-sm text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
                    <span>📖</span> تحديد المحتوى المسرد:
                  </span>
                  <div className="flex gap-1 bg-white/90 dark:bg-gray-800 p-1 rounded-xl border border-emerald-200 dark:border-emerald-900 text-xs">
                    <button
                      type="button"
                      onClick={() => setSardSelectionMode('juz')}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg font-black transition-all ${
                        sardSelectionMode === 'juz'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-300 hover:text-emerald-700'
                      }`}
                    >
                      بالأجزاء ({showAllQuranJuzs ? '30' : studentCompletedJuzs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSardSelectionMode('surahs')}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg font-black transition-all ${
                        sardSelectionMode === 'surahs'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-300 hover:text-emerald-700'
                      }`}
                    >
                      بالسور ({studentCompletedSurahs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSardSelectionMode('pages')}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg font-black transition-all ${
                        sardSelectionMode === 'pages'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-300 hover:text-emerald-700'
                      }`}
                    >
                      بالصفحات
                    </button>
                  </div>
                </div>

                {/* 1. التحديد بالأجزاء المحفوظة */}
                {sardSelectionMode === 'juz' && (
                  <div className="space-y-2.5">
                    {/* أزرار التحديد والمسح وخيار إظهار كامل المصحف */}
                    <div className="flex flex-wrap justify-between items-center text-xs px-1 gap-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setShowAllQuranJuzs(prev => !prev)}
                          className={`text-xs font-black px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs border ${
                            showAllQuranJuzs
                              ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {showAllQuranJuzs ? (
                            <>
                              <span>🎯</span>
                              <span>إظهار الأجزاء المحفوظة فقط</span>
                            </>
                          ) : (
                            <>
                              <span>📖</span>
                              <span>إظهار جميع أجزاء المصحف (30 جزء)</span>
                            </>
                          )}
                        </button>

                        {!showAllQuranJuzs ? (
                          studentCompletedJuzs.length > 0 && (
                            <button
                              type="button"
                              onClick={selectAllSardJuzs}
                              className="font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1"
                            >
                              <span>⚡</span>
                              <span>
                                {selectedSardJuzList.length === studentCompletedJuzs.length
                                  ? 'إلغاء تحديد الكل'
                                  : `تحديد كل الأجزاء المحفوظة (${toArabicDigits(studentCompletedJuzs.length)})`}
                              </span>
                            </button>
                          )
                        ) : (
                          <>
                            {studentCompletedJuzs.length > 0 && (
                              <button
                                type="button"
                                onClick={selectAllSardJuzs}
                                className="font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1"
                              >
                                <span>⭐</span>
                                <span>تحديد المحفوظ ({toArabicDigits(studentCompletedJuzs.length)})</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={selectAllQuranJuzs}
                              className="font-bold text-indigo-700 dark:text-indigo-300 hover:underline flex items-center gap-1"
                            >
                              <span>📖</span>
                              <span>تحديد كامل المصحف (30)</span>
                            </button>
                          </>
                        )}
                      </div>

                      {selectedSardJuzList.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAllSardJuzs}
                          className="font-bold text-red-600 dark:text-red-400 hover:underline"
                        >
                          مسح التحديد
                        </button>
                      )}
                    </div>

                    {/* شبكة عرض الأجزاء */}
                    {showAllQuranJuzs || studentCompletedJuzs.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1.5 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border border-gray-200/70 dark:border-gray-700/70">
                        {(showAllQuranJuzs ? Array.from({ length: 30 }, (_, i) => i + 1) : studentCompletedJuzs).map(juz => {
                          const isSelected = selectedSardJuzList.includes(juz);
                          const isMemorized = studentCompletedJuzs.includes(juz);
                          return (
                            <button
                              key={juz}
                              type="button"
                              onClick={() => toggleSardJuz(juz)}
                              className={`py-2 px-1 rounded-xl text-xs font-black transition-all text-center relative flex flex-col items-center justify-center min-h-[48px] select-none ${
                                isSelected
                                  ? 'bg-emerald-700 text-white shadow-md ring-2 ring-emerald-500 scale-[1.02]'
                                  : isMemorized && showAllQuranJuzs
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-2 border-emerald-400 dark:border-emerald-600 hover:border-emerald-500 shadow-2xs font-black'
                                    : isMemorized
                                      ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                                      : 'bg-white/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-gray-400 opacity-75 hover:opacity-100'
                              }`}
                            >
                              <span className="leading-none">جـ {toArabicDigits(juz)}</span>
                              {showAllQuranJuzs && (
                                <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 leading-none ${
                                  isSelected
                                    ? 'bg-emerald-900/80 text-emerald-100'
                                    : isMemorized
                                      ? 'bg-emerald-200/90 text-emerald-950 dark:bg-emerald-800 dark:text-emerald-100'
                                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                }`}>
                                  {isMemorized ? '⭐ محفوظ' : 'غير مكتمل'}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold text-center space-y-2.5">
                        <p>
                          {sardEvalMode === 'group' && leastMemorizedStudentInfo
                            ? `لم يكتمل جزء كامل في محفوظ الطالب الأقل حفظاً (${leastMemorizedStudentInfo.student.name}) حتى الآن.`
                            : 'لم يكتمل جزء كامل في محفوظ الطالب حتى الآن.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAllQuranJuzs(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs transition-all shadow-xs"
                        >
                          <span>📖 إظهار جميع أجزاء المصحف (30 جزء) للتحديد الحر</span>
                        </button>
                      </div>
                    )}
                    <div className="text-center text-xs font-black text-emerald-900 dark:text-emerald-200 bg-white dark:bg-gray-800/90 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-xs">
                      تم تحديد ({toArabicDigits(selectedSardJuzList.length)}) أجزاء = ({toArabicDigits(calculatedSardPages)}) صفحة
                    </div>
                  </div>
                )}

                {/* 2. التحديد بالسور المكتملة */}
                {sardSelectionMode === 'surahs' && (
                  <div className="space-y-2.5">
                    {studentCompletedSurahs.length > 0 ? (
                      <>
                        <div className="flex flex-col sm:flex-row gap-2 justify-between sm:items-center text-xs">
                          <input
                            type="text"
                            placeholder="🔍 ابحث عن سورة محفوظة..."
                            value={sardSurahSearch}
                            onChange={e => setSardSurahSearch(e.target.value)}
                            className="input-style py-1 px-2.5 text-xs w-full sm:w-48 font-bold"
                          />
                          <div className="flex gap-3 justify-end items-center px-1">
                            <button
                              type="button"
                              onClick={selectAllSardSurahs}
                              className="font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                            >
                              {selectedSardSurahIds.length === studentCompletedSurahs.length ? 'إلغاء تحديد الكل' : `تحديد كل السور (${studentCompletedSurahs.length})`}
                            </button>
                            {selectedSardSurahIds.length > 0 && (
                              <button
                                type="button"
                                onClick={clearAllSardSurahs}
                                className="font-bold text-red-600 dark:text-red-400 hover:underline"
                              >
                                مسح
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                          {filteredSardSurahs.map(s => {
                            const isSelected = selectedSardSurahIds.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => toggleSardSurah(s.id)}
                                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500 scale-[1.01]'
                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-emerald-400'
                                }`}
                              >
                                <span className="truncate">{s.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                  {toArabicDigits(s.pagesCount)} ص
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold text-center">
                        لم تكتمل سورة كاملة في محفوظ الطالب حتى الآن، يمكنك استخدام التحديد بنطاق الصفحات.
                      </div>
                    )}
                    <div className="text-center text-xs font-black text-emerald-900 dark:text-emerald-200 bg-white dark:bg-gray-800/90 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-xs">
                      تم تحديد ({toArabicDigits(selectedSardSurahIds.length)}) سورة = ({toArabicDigits(calculatedSardPages)}) صفحة
                    </div>
                  </div>
                )}

                {/* 3. التحديد بنطاق الصفحات (نطاق واحد أو أكثر مع التحقق والتنبيه) */}
                {sardSelectionMode === 'pages' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-black text-gray-700 dark:text-gray-300">
                        نطاقات صفحات السرد:
                      </span>
                      <button
                        type="button"
                        onClick={addSardPageRange}
                        className="text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <span>➕ إضافة نطاق إضافي</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {sardPageRanges.map((range, idx) => {
                        const itemAnalysis = sardMultiRangeAnalysis.rangeAnalyses[idx];
                        return (
                          <div 
                            key={idx} 
                            className="p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                                النطاق ({toArabicDigits(idx + 1)})
                              </span>
                              {sardPageRanges.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeSardPageRange(idx)}
                                  className="text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                                  title="حذف هذا النطاق"
                                >
                                  <span>🗑️ حذف النطاق</span>
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">
                                  من صفحة (البداية):
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="604"
                                  placeholder="مثلاً: 1"
                                  value={safeNumberVal(range.fromPage, '')}
                                  onChange={e => {
                                    const v = parseSafeNumber(e.target.value, NaN);
                                    updateSardPageRange(idx, 'fromPage', isNaN(v) ? '' : v);
                                  }}
                                  className="input-style text-center font-black text-base py-1.5"
                                  onFocus={handleInputFocus}
                                />
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 block mb-1">
                                  إلى صفحة (النهاية):
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="604"
                                  placeholder="مثلاً: 20"
                                  value={safeNumberVal(range.toPage, '')}
                                  onChange={e => {
                                    const v = parseSafeNumber(e.target.value, NaN);
                                    updateSardPageRange(idx, 'toPage', isNaN(v) ? '' : v);
                                  }}
                                  className="input-style text-center font-black text-base py-1.5"
                                  onFocus={handleInputFocus}
                                />
                              </div>
                            </div>

                            {/* حالة النطاق الفردي */}
                            {range.fromPage !== '' && range.toPage !== '' && itemAnalysis && (
                              <div className={`p-2 rounded-xl text-[11px] font-bold ${
                                itemAnalysis.isValid
                                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              }`}>
                                {itemAnalysis.isValid ? '✅ ' : '⚠️ '}
                                {itemAnalysis.message}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* رسالة التحقق الإجمالية والتنبيه على الصفحات غير المحفوظة */}
                    {sardPageRanges.some(r => r.fromPage !== '' || r.toPage !== '') && (
                      <div className={`p-3 rounded-2xl text-xs font-bold leading-relaxed ${
                        sardMultiRangeAnalysis.isValid
                          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                          : 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
                      }`}>
                        {sardMultiRangeAnalysis.isValid ? '✅ ' : '⚠️ '}
                        {sardMultiRangeAnalysis.summaryMessage}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={addSardPageRange}
                        className="flex-1 py-2 px-3 border-2 border-dashed border-emerald-400 dark:border-emerald-600 rounded-xl text-xs font-black text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>➕ إضافة نطاق آخر</span>
                      </button>
                    </div>

                    <div className="text-center text-xs font-black text-emerald-900 dark:text-emerald-200 bg-white dark:bg-gray-800/90 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-xs">
                      إجمالي صفحات السرد: ({toArabicDigits(calculatedSardPages)}) صفحة
                    </div>
                  </div>
                )}
              </div>

              {highlightSardSelectionError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border-2 border-red-400 rounded-xl text-center text-xs sm:text-sm font-black text-red-700 dark:text-red-300 animate-pulse mt-4">
                  ⚠️ يرجى تحديد محتوى السرد للمتابعة إلى التقييم
                </div>
              )}

              <FormNav 
                back={() => {
                  if (sardEvalMode === 'group' || !activeStudent) {
                    setCurrentStep('selectStudent');
                  } else {
                    setCurrentStep('selectAttendance');
                  }
                }} 
                next={() => {
                  if (sardSelectionMode === 'pages') {
                    if (sardPageRanges.every(r => r.fromPage === '' && r.toPage === '')) {
                      setHighlightSardSelectionError(true);
                      setTimeout(() => setHighlightSardSelectionError(false), 2500);
                      return;
                    }
                    if (!sardMultiRangeAnalysis.isValid) {
                      alert(sardMultiRangeAnalysis.summaryMessage || 'نطاقات الصفحات غير صالحة أو تحتوي على صفحات غير محفوظة');
                      return;
                    }
                  } else {
                    if (calculatedSardPages <= 0) {
                      setHighlightSardSelectionError(true);
                      setTimeout(() => setHighlightSardSelectionError(false), 2500);
                      return;
                    }
                  }
                  setCurrentStep('sardErrorsStep');
                }} 
              />
            </div>
        )}

        {currentStep === 'sardErrorsStep' && (
          <div className="space-y-5 animate-fade-in max-w-4xl mx-auto py-2">
            <p className="font-bold text-xl text-center">
              تسجيل أخطاء السرد والتقدير: <span className="text-emerald-700 dark:text-emerald-300">{activeStudent?.name}</span>
            </p>

            {/* شريط مصحف السرد وزر تصفح صفحات التقييم المحددة */}
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-3 sm:p-3.5 rounded-2xl shadow-sm border border-emerald-700/60">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📖</span>
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
                disabled={sardActivePages.length === 0}
                className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-white hover:bg-emerald-50 text-emerald-900 text-xs sm:text-sm font-black rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                title="فتح صفحات المصحف للسرد"
              >
                <span>فتح المصحف</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {toArabicDigits(sardActivePages.length)} ص
                </span>
              </button>
            </div>

            {/* ملخص المحتوى المحدد */}
            <div className="bg-emerald-50 dark:bg-emerald-950/50 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1 overflow-hidden">
                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <span>📖</span>
                  <span>المحتوى المحدد للسرد:</span>
                </div>
                <div className="text-sm sm:text-base font-black text-gray-800 dark:text-gray-100 truncate">
                  {sardSelectionMode === 'juz' && (selectedSardJuzList.length > 0 ? `الأجزاء (${selectedSardJuzList.slice().sort((a,b)=>a-b).join('، ')})` : 'لم يتم اختيار أجزاء')}
                  {sardSelectionMode === 'surahs' && (selectedSardSurahIds.length > 0 ? selectedSardSurahIds.map(id => surahNames[id] || `سورة ${id}`).join('، ') : 'لم يتم اختيار سور')}
                  {sardSelectionMode === 'pages' && (sardPageRanges.filter(r => r.fromPage !== '' && r.toPage !== '').map(r => `ص ${r.fromPage}-${r.toPage}`).join(' | ') || 'لم يتم تحديد صفحات')}
                </div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  إجمالي الصفحات: {toArabicDigits(calculatedSardPages)} صفحة
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep('sardContentSelection')}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-700 transition-all shrink-0"
              >
                تعديل المحتوى ✏️
              </button>
            </div>

            {sardEvalMode === 'group' ? (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="font-bold text-lg text-gray-800 dark:text-gray-200">أخطاء السرد للطلاب ({selectedSardGroupIds.length}):</p>
                </div>
                {selectedSardGroupIds
                  .map(id => students.find(x => x.id === id))
                  .filter((s): s is Student => Boolean(s))
                  .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }))
                  .map(s => {
                    const studentId = s.id;
                    const errs罕 = sardGroupErrors[studentId] || { fath: 0, tashkeel: 0, tajweed: 0 };
                    const errs = errs罕;
                    const setErrs = (field: 'fath' | 'tashkeel' | 'tajweed', val: number) => {
                      setSardGroupErrors(prev => ({
                        ...prev,
                        [studentId]: { ...errs, [field]: val }
                      }));
                    };
                    return (
                      <div key={studentId} className="p-3.5 sm:p-5 bg-white dark:bg-gray-800 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/50 shadow-sm space-y-3.5">
                        <div className="font-black text-emerald-800 dark:text-emerald-300 text-lg text-right">{s.name}</div>
                        
                        <div className="flex flex-col gap-2.5 w-full">
                          {/* أخطاء الفتح (+1) */}
                          <div 
                            onClick={() => setErrs('fath', errs.fath + 1)}
                            className="flex items-stretch bg-gradient-to-r from-rose-50/90 to-red-50/70 dark:from-rose-950/40 dark:to-red-950/30 rounded-xl sm:rounded-2xl border-2 border-rose-200 dark:border-rose-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-rose-400 dark:hover:border-rose-600 active:scale-[0.99] transition-all h-13 sm:h-14"
                          >
                            <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-black bg-rose-600 text-white px-2 py-0.5 rounded-lg shadow-xs">+1</span>
                                <span className="text-[11px] text-rose-600/80 dark:text-rose-400 font-bold hidden sm:inline">خطأ جلي</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm sm:text-base text-rose-950 dark:text-rose-100 group-hover:text-rose-700 select-none text-right">أخطاء الفتح</span>
                              </div>
                            </div>
                            <div className="px-2.5 sm:px-4 flex items-center justify-center">
                              <div className="w-14 sm:w-16 h-10 sm:h-11 rounded-full bg-white dark:bg-gray-900 border-2 border-rose-400 dark:border-rose-500 shadow-sm flex items-center justify-center overflow-hidden">
                                <input 
                                  onClick={(e) => e.stopPropagation()} 
                                  type="number" 
                                  min="0" 
                                  value={safeInputNumber(errs.fath)} 
                                  placeholder="0" 
                                  onChange={e => setErrs('fath', Math.max(0, parseSafeNumber(e.target.value)))} 
                                  onFocus={e => e.target.select()} 
                                  className="w-full h-full text-center text-lg sm:text-xl font-black bg-transparent text-rose-600 dark:text-rose-400 focus:text-rose-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-200 dark:placeholder:text-rose-900/40 z-10" 
                                />
                              </div>
                            </div>
                          </div>

                          {/* أخطاء التشكيل (+1) */}
                          <div 
                            onClick={() => setErrs('tashkeel', (errs.tashkeel || 0) + 1)}
                            className="flex items-stretch bg-gradient-to-r from-amber-50/90 to-orange-50/70 dark:from-amber-950/40 dark:to-orange-950/30 rounded-xl sm:rounded-2xl border-2 border-amber-200 dark:border-amber-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 active:scale-[0.99] transition-all h-13 sm:h-14"
                          >
                            <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-black bg-amber-600 text-white px-2 py-0.5 rounded-lg shadow-xs">+1</span>
                                <span className="text-[11px] text-amber-700/80 dark:text-amber-400 font-bold hidden sm:inline">حركة/حرف</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm sm:text-base text-amber-950 dark:text-amber-100 group-hover:text-amber-700 select-none text-right">أخطاء التشكيل</span>
                              </div>
                            </div>
                            <div className="px-2.5 sm:px-4 flex items-center justify-center">
                              <div className="w-14 sm:w-16 h-10 sm:h-11 rounded-full bg-white dark:bg-gray-900 border-2 border-amber-400 dark:border-amber-500 shadow-sm flex items-center justify-center overflow-hidden">
                                <input 
                                  onClick={(e) => e.stopPropagation()} 
                                  type="number" 
                                  min="0" 
                                  value={safeInputNumber(errs.tashkeel)} 
                                  placeholder="0" 
                                  onChange={e => setErrs('tashkeel', Math.max(0, parseSafeNumber(e.target.value)))} 
                                  onFocus={e => e.target.select()} 
                                  className="w-full h-full text-center text-lg sm:text-xl font-black bg-transparent text-amber-600 dark:text-amber-400 focus:text-amber-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-amber-200 dark:placeholder:text-amber-900/40 z-10" 
                                />
                              </div>
                            </div>
                          </div>

                          {/* أخطاء التجويد (+0.5) */}
                          <div 
                            onClick={() => setErrs('tajweed', (errs.tajweed || 0) + 1)}
                            className="flex items-stretch bg-gradient-to-r from-teal-50/90 to-emerald-50/70 dark:from-teal-950/40 dark:to-emerald-950/30 rounded-xl sm:rounded-2xl border-2 border-teal-200 dark:border-teal-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-teal-400 dark:hover:border-teal-600 active:scale-[0.99] transition-all h-13 sm:h-14"
                          >
                            <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-black bg-teal-600 text-white px-2 py-0.5 rounded-lg shadow-xs">+0.5</span>
                                <span className="text-[11px] text-teal-700/80 dark:text-teal-400 font-bold hidden sm:inline">أحكام تلاوة</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm sm:text-base text-teal-950 dark:text-teal-100 group-hover:text-teal-700 select-none text-right">أخطاء التجويد</span>
                              </div>
                            </div>
                            <div className="px-2.5 sm:px-4 flex items-center justify-center">
                              <div className="w-14 sm:w-16 h-10 sm:h-11 rounded-full bg-white dark:bg-gray-900 border-2 border-teal-400 dark:border-teal-500 shadow-sm flex items-center justify-center overflow-hidden">
                                <input 
                                  onClick={(e) => e.stopPropagation()} 
                                  type="number" 
                                  min="0" 
                                  value={safeInputNumber(errs.tajweed)} 
                                  placeholder="0" 
                                  onChange={e => setErrs('tajweed', Math.max(0, parseSafeNumber(e.target.value)))} 
                                  onFocus={e => e.target.select()} 
                                  className="w-full h-full text-center text-lg sm:text-xl font-black bg-transparent text-teal-600 dark:text-teal-400 focus:text-teal-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-teal-200 dark:placeholder:text-teal-900/40 z-10" 
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Performance Bar */}
                        {(() => {
                          const tot = calculateSardTotalErrors(errs.fath, errs.tashkeel, errs.tajweed);
                          const grade = calculateSardGrade(tot);
                          const gradeColor = getSardGradeBadgeClass(grade);
                          return (
                            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] sm:text-xs text-emerald-800 dark:text-emerald-300 font-bold">تقدير السرد:</span>
                                <span className="text-[11px] sm:text-xs font-black text-gray-700 dark:text-gray-300">
                                  الأخطاء: {tot}
                                </span>
                              </div>
                              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black shadow-xs ${gradeColor}`}>
                                {grade}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <>
                <div className="text-center">
                  <p className="font-bold text-lg text-gray-800 dark:text-gray-200">أخطاء السرد:</p>
                </div>
                <div className="flex flex-col gap-3 w-full">
                  {/* أخطاء الفتح (+1) */}
                <div 
                  onClick={() => setSardFathErrors(prev => prev + 1)}
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
                        value={safeInputNumber(sardFathErrors)} 
                        placeholder="0" 
                        onChange={e => setSardFathErrors(Math.max(0, parseSafeNumber(e.target.value)))} 
                        onFocus={e => e.target.select()} 
                        className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-rose-600 dark:text-rose-400 focus:text-rose-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-200 dark:placeholder:text-rose-900/40 z-10" 
                      />
                    </div>
                  </div>
                </div>

                {/* أخطاء التشكيل (+1) */}
                <div 
                  onClick={() => setSardTashkeelErrors(prev => (prev || 0) + 1)}
                  className="flex items-stretch bg-gradient-to-r from-amber-50/90 to-orange-50/70 dark:from-amber-950/40 dark:to-orange-950/30 rounded-2xl border-2 border-amber-200 dark:border-amber-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 active:scale-[0.99] transition-all h-14 sm:h-16"
                >
                  <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black bg-amber-600 text-white px-2 py-0.5 rounded-lg shadow-xs">+1</span>
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
                        value={safeInputNumber(sardTashkeelErrors)} 
                        placeholder="0" 
                        onChange={e => setSardTashkeelErrors(Math.max(0, parseSafeNumber(e.target.value)))} 
                        onFocus={e => e.target.select()} 
                        className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-amber-600 dark:text-amber-400 focus:text-amber-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-amber-200 dark:placeholder:text-amber-900/40 z-10" 
                      />
                    </div>
                  </div>
                </div>

                {/* أخطاء التجويد (+0.5) */}
                <div 
                  onClick={() => setSardTajweedErrors(prev => (prev || 0) + 1)}
                  className="flex items-stretch bg-gradient-to-r from-teal-50/90 to-emerald-50/70 dark:from-teal-950/40 dark:to-emerald-950/30 rounded-2xl border-2 border-teal-200 dark:border-teal-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-teal-400 dark:hover:border-teal-600 active:scale-[0.99] transition-all h-14 sm:h-16"
                >
                  <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-black bg-teal-600 text-white px-2 py-0.5 rounded-lg shadow-xs">+0.5</span>
                      <span className="text-[11px] text-teal-600/80 dark:text-teal-400 font-bold hidden sm:inline">التجويد</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base sm:text-lg text-teal-950 dark:text-teal-100 group-hover:text-teal-700 select-none text-right">أخطاء التجويد</span>
                    </div>
                  </div>
                  <div className="px-2.5 sm:px-4 flex items-center justify-center">
                    <div className="w-14 sm:w-16 h-11 sm:h-12 rounded-full bg-white dark:bg-gray-900 border-2 border-teal-400 dark:border-teal-500 shadow-sm flex items-center justify-center overflow-hidden">
                      <input 
                        onClick={(e) => e.stopPropagation()} 
                        type="number" 
                        min="0" 
                        value={safeInputNumber(sardTajweedErrors)} 
                        placeholder="0" 
                        onChange={e => setSardTajweedErrors(Math.max(0, parseSafeNumber(e.target.value)))} 
                        onFocus={e => e.target.select()} 
                        className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-teal-600 dark:text-teal-400 focus:text-teal-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-teal-200 dark:placeholder:text-teal-900/40 z-10" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* التقدير المحسوب في السرد */}
              <div className="mt-4 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 font-bold px-1">
                  <span>إجمالي الأخطاء الموزونة: <strong className="text-gray-900 dark:text-gray-100 text-sm">{totalSardErrors}</strong></span>
                  <span>معيار السرد</span>
                </div>
                <p className="font-bold text-sm text-center text-gray-700 dark:text-gray-300">التقدير (مُحسَب تلقائياً بناءً على الأخطاء):</p>
                <div className="flex justify-center items-center gap-2.5">
                  <div className={`py-2 px-6 rounded-2xl font-black text-base sm:text-lg text-center shadow-sm border-2 ${getSardGradeBadgeClass(deducedSardGrade)}`}>
                    {deducedSardGrade}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMushafModalOpen(true)}
                    disabled={sardActivePages.length === 0}
                    className="py-2 px-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-black rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 border border-emerald-600/80 shrink-0"
                    title="فتح صفحات المصحف للسرد"
                  >
                    <span>📖 المصحف</span>
                    <span className="bg-emerald-900/70 text-emerald-200 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {toArabicDigits(sardActivePages.length)} ص
                    </span>
                  </button>
                </div>
              </div>
            </>
            )}

            <FormNav 
                back={() => setCurrentStep('sardContentSelection')} 
                next={() => setCurrentStep('notesStep')} 
              />
            </div>
        )}

        {currentStep === 'selectPerformanceLevel' && (
          <div className="min-h-[55vh] sm:min-h-[60vh] flex flex-col justify-center max-w-md mx-auto space-y-4 py-2 animate-fade-in">
              <div className="text-center">
                <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
                  {evalType === EvaluationType.REVIEW ? 'أخطاء المراجعة والدرجة النهائية:' : 'أخطاء التسميع:'}
                </p>
                {evalType === EvaluationType.REVIEW && subject === 'quran' && (
                  <div className="mt-3 flex justify-center gap-4 text-sm font-bold bg-indigo-50 dark:bg-indigo-900/30 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-800/60 max-w-sm mx-auto">
                    <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      قديم: {countQuranPages(studentQuranHistory.oldFullPages)} ص
                    </span>
                    <span className="text-[#8B4513] dark:text-amber-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#8B4513]"></span>
                      جديد: {countQuranPages(studentQuranHistory.newEvalsFullPages)} ص
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-3 w-full">
                  {/* أخطاء الفتح */}
                  <div 
                      onClick={() => setEvalFath(prev => prev + 1)}
                      className="flex items-stretch bg-gradient-to-r from-rose-50/90 to-red-50/70 dark:from-rose-950/40 dark:to-red-950/30 rounded-2xl border-2 border-rose-200 dark:border-rose-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-rose-400 dark:hover:border-rose-600 active:scale-[0.99] transition-all h-14 sm:h-16"
                  >
                      <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                          <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-black bg-rose-600 text-white px-2 py-0.5 rounded-lg shadow-xs">
                                {evalType === EvaluationType.REVIEW ? '-1' : '+1'}
                              </span>
                              <span className="text-[11px] text-rose-600/80 dark:text-rose-400 font-bold hidden sm:inline">
                                {evalType === EvaluationType.REVIEW ? 'خصم درجة' : 'خطأ جلي'}
                              </span>
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
                                  value={safeInputNumber(evalFath)} 
                                  placeholder="0" 
                                  onChange={e => setEvalFath(Math.max(0, parseSafeNumber(e.target.value)))} 
                                  onFocus={e => e.target.select()} 
                                  className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-rose-600 dark:text-rose-400 focus:text-rose-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-200 dark:placeholder:text-rose-900/40 z-10" 
                              />
                          </div>
                      </div>
                  </div>

                  {/* أخطاء التشكيل */}
                  <div 
                      onClick={() => setEvalTashkeel(prev => (prev || 0) + 1)}
                      className="flex items-stretch bg-gradient-to-r from-amber-50/90 to-orange-50/70 dark:from-amber-950/40 dark:to-orange-950/30 rounded-2xl border-2 border-amber-200 dark:border-amber-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 active:scale-[0.99] transition-all h-14 sm:h-16"
                  >
                      <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                          <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-black bg-amber-600 text-white px-2 py-0.5 rounded-lg shadow-xs">
                                {evalType === EvaluationType.REVIEW ? '-1' : '+1'}
                              </span>
                              <span className="text-[11px] text-amber-700/80 dark:text-amber-400 font-bold hidden sm:inline">
                                {evalType === EvaluationType.REVIEW ? 'خصم درجة' : 'حركة/حرف'}
                              </span>
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
                                  value={safeInputNumber(evalTashkeel)} 
                                  placeholder="0" 
                                  onChange={e => setEvalTashkeel(Math.max(0, parseSafeNumber(e.target.value)))} 
                                  onFocus={e => e.target.select()} 
                                  className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-amber-600 dark:text-amber-400 focus:text-amber-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-amber-200 dark:placeholder:text-amber-900/40 z-10" 
                              />
                          </div>
                      </div>
                  </div>

                  {/* أخطاء التجويد */}
                  <div 
                      onClick={() => setEvalTajweed(prev => (prev || 0) + 1)}
                      className="flex items-stretch bg-gradient-to-r from-teal-50/90 to-emerald-50/70 dark:from-teal-950/40 dark:to-emerald-950/30 rounded-2xl border-2 border-teal-200 dark:border-teal-800/70 shadow-xs overflow-hidden group cursor-pointer hover:border-teal-400 dark:hover:border-teal-600 active:scale-[0.99] transition-all h-14 sm:h-16"
                  >
                      <div className="flex-1 flex items-center justify-between px-3.5 sm:px-4">
                          <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-black bg-teal-600 text-white px-2 py-0.5 rounded-lg shadow-xs">
                                {evalType === EvaluationType.REVIEW ? '-0.5' : '+0.5'}
                              </span>
                              <span className="text-[11px] text-teal-700/80 dark:text-teal-400 font-bold hidden sm:inline">
                                {evalType === EvaluationType.REVIEW ? 'خصم نصف درجة' : 'أحكام تلاوة'}
                              </span>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="font-black text-base sm:text-lg text-teal-950 dark:text-teal-100 group-hover:text-teal-700 select-none text-right">أخطاء التجويد</span>
                          </div>
                      </div>
                      <div className="px-2.5 sm:px-4 flex items-center justify-center">
                          <div className="w-14 sm:w-16 h-11 sm:h-12 rounded-full bg-white dark:bg-gray-900 border-2 border-teal-400 dark:border-teal-500 shadow-sm flex items-center justify-center overflow-hidden">
                              <input 
                                  onClick={(e) => e.stopPropagation()} 
                                  type="number" 
                                  min="0" 
                                  value={safeInputNumber(evalTajweed)} 
                                  placeholder="0" 
                                  onChange={e => setEvalTajweed(Math.max(0, parseSafeNumber(e.target.value)))} 
                                  onFocus={e => e.target.select()} 
                                  className="w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent text-teal-600 dark:text-teal-400 focus:text-teal-700 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-teal-200 dark:placeholder:text-teal-900/40 z-10" 
                              />
                          </div>
                      </div>
                  </div>
              </div>
              
              {evalType === EvaluationType.REVIEW ? (
                (() => {
                  const totalDeductions = (evalFath * 1) + (evalTashkeel * 1) + (evalTajweed * 0.5);
                  const reviewScore = Math.max(0, 100 - totalDeductions);
                  const totalQuranPages = selectionState.allActivePages.length;
                  return (
                    <div className="mt-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 font-bold px-1">
                        <span>إجمالي الخصم: <strong className="text-rose-600 dark:text-rose-400 text-sm">-{totalDeductions}</strong> درجة</span>
                        <span className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-md font-black">الدرجة من 100</span>
                      </div>
                      <p className="font-bold text-sm text-center text-gray-700 dark:text-gray-300">الدرجة النهائية للمراجعة:</p>
                      <div className="flex justify-center items-center gap-2.5">
                        <div className="py-2 px-6 rounded-2xl font-black border-2 bg-indigo-50 border-indigo-500 text-indigo-950 dark:bg-indigo-950/40 dark:border-indigo-600 dark:text-indigo-200 shadow-sm text-xl sm:text-2xl text-center flex items-center gap-1.5">
                          <span>{reviewScore}</span>
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">/ 100</span>
                        </div>
                        {subject === 'quran' && (
                          <button
                            type="button"
                            onClick={() => setIsMushafModalOpen(true)}
                            disabled={evalType === EvaluationType.REVIEW ? (countQuranPages([...studentQuranHistory.oldFullPages, ...studentQuranHistory.newEvalsFullPages]) === 0) : selectionState.allActivePages.length === 0}
                            className="py-2 px-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-black rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 border border-emerald-600/80 shrink-0"
                            title="فتح صفحات المصحف للمراجعة"
                          >
                            <span>📖 المصحف</span>
                            {(evalType === EvaluationType.REVIEW ? countQuranPages([...studentQuranHistory.oldFullPages, ...studentQuranHistory.newEvalsFullPages]) : totalQuranPages) > 0 && (
                              <span className="bg-emerald-900/70 text-emerald-200 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                {toArabicDigits(evalType === EvaluationType.REVIEW ? countQuranPages([...studentQuranHistory.oldFullPages, ...studentQuranHistory.newEvalsFullPages]) : totalQuranPages)} ص
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const totalErrors = evalFath + evalTashkeel + (evalTajweed * 0.5);
                  const totalQuranPages = selectionState.allActivePages.length + Array.from(previousWeekPages).filter(p => !selectionState.allActivePages.includes(p)).length;
                  return (
                      <div className="mt-4 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                          <p className="font-bold text-sm text-center text-gray-700 dark:text-gray-300">التقدير (مُحسَب تلقائياً بناءً على الأخطاء):</p>
                          <div className="flex justify-center items-center gap-2.5">
                              <div className="py-2 px-5 rounded-2xl font-black border-2 bg-indigo-100 border-indigo-600 text-indigo-900 shadow-sm text-base sm:text-lg text-center">
                                  {perf ? translationMap[perf] : '—'}
                              </div>
                              {subject === 'quran' && (
                                <button
                                  type="button"
                                  onClick={() => setIsMushafModalOpen(true)}
                                  className="py-2 px-3 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-black rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 border border-emerald-600/80 shrink-0"
                                  title="فتح صفحات المصحف للتسميع"
                                >
                                  <span>📖 المصحف</span>
                                  {totalQuranPages > 0 && (
                                    <span className="bg-emerald-900/70 text-emerald-200 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                      {toArabicDigits(totalQuranPages)} ص
                                    </span>
                                  )}
                                </button>
                              )}
                          </div>
                      </div>
                  );
                })()
              )}

              <FormNav back={() => setCurrentStep(subject === 'sard' ? 'sardContentSelection' : (evalType === EvaluationType.REVIEW ? 'selectEvaluationType' : 'memorizationDetails'))} next={() => {
                  if (evalType === EvaluationType.REVIEW) {
                    setCurrentStep('notesStep');
                  } else {
                    setCurrentStep('periodicReviewStatus');
                  }
              }} />
            </div>
        )}

        {currentStep === 'periodicReviewStatus' && (
          <div className="space-y-4">
            <p className="font-bold text-lg text-center">المراجعة الدورية:</p>
            <div className="flex gap-3">
              {Object.values(PeriodicReviewStatus).map(s => (
                <button key={s} type="button" onClick={() => { setPReview(s); setCurrentStep('notesStep'); }} className={`flex-1 py-4 rounded-xl font-bold border-2 transition-all text-xs ${pReview === s ? 'bg-green-100 border-green-600 shadow-sm' : 'bg-gray-50 border-transparent dark:bg-gray-700'}`}>{translationMap[s]}</button>
              ))}
            </div>
            <FormNav back={() => setCurrentStep('selectPerformanceLevel')} />
          </div>
        )}

        {currentStep === 'notesStep' && (
          <div className="space-y-4">
            {subject === 'sard' && sardEvalMode === 'group' ? (
              <>
                <p className="font-bold text-lg">ملاحظات إضافية للطلاب (اختياري):</p>
                <div className="space-y-4">
                  {selectedSardGroupIds
                    .map(id => students.find(x => x.id === id))
                    .filter((s): s is Student => Boolean(s))
                    .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }))
                    .map(s => {
                      const studentId = s.id;
                      return (
                        <div key={studentId} className="space-y-1">
                          <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{s.name}</label>
                          <textarea
                            value={sardGroupNotes[studentId] || ''}
                            onChange={e => setSardGroupNotes(prev => ({ ...prev, [studentId]: e.target.value }))}
                            className="input-style h-20"
                            placeholder={`ملاحظات لـ ${s.name}...`}
                            onFocus={handleInputFocus}
                          />
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <>
                <p className="font-bold text-lg">ملاحظات إضافية (اختياري):</p>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-style h-32" placeholder="اكتب أي ملاحظات هنا..." onFocus={handleInputFocus}/>
              </>
            )}
            <FormNav back={() => {
              if (attendance === AttendanceStatus.ABSENT) return setCurrentStep('selectAbsenceReason');
              if (attendance === AttendanceStatus.UNPREPARED) return setCurrentStep('selectAttendance');
              if (subject === 'mutoon') return setCurrentStep('mutoonEvaluation');
              if (subject === 'sard') return setCurrentStep('sardErrorsStep');
              if (evalType === EvaluationType.REVIEW) return setCurrentStep('selectPerformanceLevel');
              if (evalType === EvaluationType.DID_NOT_MEMORIZE) return setCurrentStep('selectEvaluationType');
              return setCurrentStep('periodicReviewStatus');
            }} next={() => setCurrentStep('summaryAndConfirm')} />
          </div>
        )}

        {currentStep === 'summaryAndConfirm' && (activeStudent || (subject === 'sard' && sardEvalMode === 'group')) && (
          <div className="space-y-4">
            <p className="font-bold text-xl mb-4 border-b pb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ملخص تقييم {subject === 'sard' ? (sardEvalMode === 'group' ? 'السرد الجماعي' : 'السرد') : subject === 'mutoon' ? 'المتون' : 'القرآن الكريم'}
            </p>
            <div className="bg-gray-50 p-6 rounded-2xl space-y-3 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 shadow-inner">
              {subject === 'sard' && sardEvalMode === 'group' ? (
                <>
                  <p className="flex justify-between"><strong>الأسبوع:</strong> <span>{selectedWeek}</span></p>
                  <p className="flex justify-between"><strong>عدد الطلاب:</strong> <span className="font-bold">{selectedSardGroupIds.length}</span></p>
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2.5 text-sm">
                    <p className="flex justify-between items-center">
                      <strong>المحتوى المسرد للجميع:</strong>
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 text-left max-w-[65%] break-words">
                        {sardSelectionMode === 'juz'
                          ? `الأجزاء (${selectedSardJuzList.map(toArabicDigits).join('، ') || '—'}) [${toArabicDigits(calculatedSardPages)} صفحة]`
                          : sardSelectionMode === 'surahs'
                          ? `السور (${selectedSardSurahIds.map(id => surahNames[id]).join('، ') || '—'}) [${toArabicDigits(calculatedSardPages)} صفحة]`
                          : `النطاقات (${sardPageRanges.filter(r => r.fromPage !== '' && r.toPage !== '').map(r => `ص ${toArabicDigits(r.fromPage)} إلى ص ${toArabicDigits(r.toPage)}`).join('، ') || '—'}) [${toArabicDigits(calculatedSardPages)} صفحة]`}
                      </span>
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2">
                    <p><strong>الطلاب والتقديرات:</strong></p>
                    {selectedSardGroupIds
                      .map(id => students.find(x => x.id === id))
                      .filter((s): s is Student => Boolean(s))
                      .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }))
                      .map(s => {
                        const id = s.id;
                        const errs = sardGroupErrors[id] || { fath: 0, tashkeel: 0, tajweed: 0 };
                        const tot = calculateSardTotalErrors(errs.fath, errs.tashkeel, errs.tajweed);
                        const grade = calculateSardGrade(tot);
                        return (
                          <div key={id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex flex-col min-w-0 max-w-[60%]">
                              <span className="text-sm font-bold truncate">{s.name}</span>
                              {s.isAlAmeen && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight">
                                  (من طلاب الأمين)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">أخطاء: {tot}</span>
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${getSardGradeBadgeClass(grade)}`}>
                                {grade}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <strong>الطالب:</strong>
                    <div className="text-right">
                      <span className="text-green-800 dark:text-green-300 font-bold">{activeStudent?.name}</span>
                      {activeStudent?.isAlAmeen && (
                        <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight">
                          (من طلاب الأمين)
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="flex justify-between"><strong>الأسبوع:</strong> <span>{selectedWeek}</span></p>
                  <p className="flex justify-between"><strong>الحالة:</strong> <span>{attendance === AttendanceStatus.PRESENT ? '✅ حاضر' : attendance === AttendanceStatus.LATE ? '🕒 متأخر' : attendance === AttendanceStatus.UNPREPARED ? '⚠️ غير حافظ' : '🚫 غائب'}</span></p>
                  {attendance === AttendanceStatus.ABSENT && absenceReason && (
                    <p className="flex justify-between"><strong>سبب الغياب:</strong> <span>{translationMap[absenceReason]}</span></p>
                  )}
                  {(attendance === AttendanceStatus.PRESENT || attendance === AttendanceStatus.LATE) && (
                    subject === 'mutoon' ? (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-4 text-sm">
                        <p className="font-bold mb-2">تفاصيل حفظ المتون:</p>
                        {mutoonEvaluations.filter(m => m.lines !== '').map((mEval, idx) => {
                          const autoRange = typeof mEval.lines === 'number' ? calculateMatnAyahRange(activeStudent?.id, mEval.matnName, mEval.lines) : { fromAyah: '', toAyah: '' };
                          const from = (mEval.fromAyah !== undefined && mEval.fromAyah !== '') ? mEval.fromAyah : autoRange.fromAyah;
                          const to = (mEval.toAyah !== undefined && mEval.toAyah !== '') ? mEval.toAyah : autoRange.toAyah;
                          const rangeDisplay = (from && to) ? (from === to ? toArabicDigits(from) : formatRtlRange(`${from} - ${to}`)) : (from ? toArabicDigits(from) : '—');

                          return (
                            <div key={idx} className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                               <p className="flex justify-between mb-1"><strong>المتن:</strong> <span className="font-bold text-blue-900 dark:text-blue-200">{mEval.matnName}</span></p>
                               <p className="flex justify-between mb-1"><strong>عدد الأبيات:</strong> <span>{mEval.lines === 'not_ready' ? 'غير مستعد' : (mEval.lines === 'review' ? 'مراجعة' : `${toArabicDigits(mEval.lines)} أبيات`)}</span></p>
                               {typeof mEval.lines === 'number' && mEval.lines > 0 && (
                                 <p className="flex justify-between mb-1"><strong>أرقام الأبيات:</strong> <span className="font-black text-emerald-700 dark:text-emerald-300">{rangeDisplay}</span></p>
                               )}
                               {mEval.lines !== 'not_ready' && (
                                 <p className="flex justify-between mb-1"><strong>الأخطاء:</strong> <span className="font-bold text-red-600">{toArabicDigits(mEval.errors)}</span></p>
                               )}
                            </div>
                          );
                        })}
                      </div>
                    ) : subject === 'sard' ? (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2.5 text-sm">
                        <p className="flex justify-between items-center">
                          <strong>المحتوى المسرد:</strong>
                          <span className="font-bold text-emerald-800 dark:text-emerald-300 text-left max-w-[65%] break-words">
                            {sardSelectionMode === 'juz'
                              ? `الأجزاء (${selectedSardJuzList.map(toArabicDigits).join('، ') || '—'}) [${toArabicDigits(calculatedSardPages)} صفحة]`
                              : sardSelectionMode === 'surahs'
                              ? `السور (${selectedSardSurahIds.map(id => surahNames[id]).join('، ') || '—'}) [${toArabicDigits(calculatedSardPages)} صفحة]`
                              : `النطاقات (${sardPageRanges.filter(r => r.fromPage !== '' && r.toPage !== '').map(r => `ص ${toArabicDigits(r.fromPage)} إلى ص ${toArabicDigits(r.toPage)}`).join('، ') || '—'}) [${toArabicDigits(calculatedSardPages)} صفحة]`}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <strong>تفصيل الأخطاء:</strong>
                          <span className="text-gray-700 dark:text-gray-300">
                            الفتح: {toArabicDigits(sardFathErrors)} | التشكيل: {toArabicDigits(sardTashkeelErrors)} | التجويد: {toArabicDigits(sardTajweedErrors)} (الإجمالي: {toArabicDigits(totalSardErrors)})
                          </span>
                        </p>
                        <p className="flex justify-between items-center">
                          <strong>التقدير المستحق:</strong>
                          <span className={`px-3 py-1 rounded-xl text-xs font-black ${getSardGradeBadgeClass(deducedSardGrade)}`}>
                            {deducedSardGrade}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="flex justify-between"><strong>نوع الإنجاز:</strong> <span>{translationMap[evalType!]}</span></p>
                        {(evalType === EvaluationType.MEMORIZATION || evalType === EvaluationType.REVIEW) && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2.5 text-sm">
                            <p className="flex justify-between"><strong>عدد الصفحات:</strong> <span>{evalType === EvaluationType.REVIEW ? toArabicDigits(countQuranPages([...studentQuranHistory.oldFullPages, ...studentQuranHistory.newEvalsFullPages])) : (selectionState.allActivePages.length > 0 ? toArabicDigits(selectionState.newPagesCount) : (pages !== '' && pages !== null && pages !== undefined ? toArabicDigits(pages) : '—'))}</span></p>
                            
                            <p className="flex justify-between">
                              <strong>أرقام الصفحات:</strong> 
                              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                                {evalType === EvaluationType.REVIEW 
                                  ? (studentQuranHistory.oldFullPages.size + studentQuranHistory.newEvalsFullPages.size > 0 
                                      ? Array.from(new Set([...studentQuranHistory.oldFullPages, ...studentQuranHistory.newEvalsFullPages])).map(toArabicDigits).join('، ')
                                      : '—')
                                  : (selectionState.newlyCountedPages.length > 0 
                                      ? selectionState.newlyCountedPages.map(toArabicDigits).join('، ')
                                      : '—')}
                              </span>
                            </p>
                            <p className="flex justify-between items-center">
                              <strong>السور:</strong> 
                              <span className="text-left flex-1 mr-4 font-bold text-gray-800 dark:text-gray-200 break-words" title={evalType === EvaluationType.REVIEW ? '—' : surahs.join('، ')}>
                                {evalType === EvaluationType.REVIEW ? 'محفوظات الطالب' : (surahs.length > 0 ? surahs.join('، ') : '—')}
                              </span>
                            </p>
                            <p className="flex justify-between items-center">
                              <strong>الآيات:</strong> 
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {evalType === EvaluationType.REVIEW ? 'محفوظات الطالب' : (ayahRange ? ayahRange : (surahs.length > 0 ? 'كاملة' : '—'))}
                              </span>
                            </p>
                            {(evalFath > 0 || evalTashkeel > 0 || evalTajweed > 0) && (
                              <p className="flex justify-between">
                                <strong>أخطاء التسميع:</strong>
                                <span className="text-gray-700 dark:text-gray-300">
                                  الفتح: {toArabicDigits(evalFath)} | التشكيل: {toArabicDigits(evalTashkeel)} | التجويد: {toArabicDigits(evalTajweed)} (المجموع: {toArabicDigits(evalFath + evalTashkeel + evalTajweed)})
                                </span>
                              </p>
                            )}

                            <p className="flex justify-between"><strong>الأداء:</strong> <span>{perf ? translationMap[perf] : '—'}</span></p>
                            <p className="flex justify-between"><strong>المراجعة الدورية:</strong> <span>{pReview ? translationMap[pReview] : '—'}</span></p>
                          </div>
                        )}
                        {evalType === EvaluationType.DID_NOT_MEMORIZE && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2 text-sm">
                             {/* Performance is not shown for DID_NOT_MEMORIZE */}
                          </div>
                        )}
                      </>
                    )
                  )}

                  {notes && <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600"><p><strong>ملاحظات:</strong></p><p className="text-sm italic text-gray-600 dark:text-gray-400 mt-1">{notes}</p></div>}
                </>
              )}
            </div>
            <FormNav 
              back={() => setCurrentStep('notesStep')} 
              sub="حفظ التقييم الآن" 
              onEdit={() => {
                if (subject === 'sard') {
                  if (sardEvalMode === 'group' || !activeStudent) {
                    setCurrentStep('sardContentSelection');
                  } else {
                    setCurrentStep('selectAttendance');
                  }
                } else {
                  setCurrentStep('selectAttendance');
                }
              }} 
              isSticky={false}
            />
          </div>
        )}
      </form>

      {isCrossHalaqaModalOpen && (
        <Modal title="إضافة طلاب من حلقات أخرى" onClose={() => setIsCrossHalaqaModalOpen(false)}>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="ابحث عن اسم طالب أو اسم حلقة..."
              value={guestSearch}
              onChange={e => setGuestSearch(e.target.value)}
              className="input-style font-bold text-sm"
              onFocus={handleInputFocus}
            />
            <div className="max-h-[50vh] overflow-y-auto space-y-4 custom-scrollbar pr-1">
              {sardHalaqas.filter(h => h.id !== activeSardHalaqaId).map(h => {
                const hStudents = students
                  .filter(s => s.sardHalaqaId === h.id && isSmartMatch(s.name, guestSearch) && !selectedSardGroupIds.includes(s.id))
                  .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
                if (hStudents.length === 0) return null;
                return (
                  <div key={h.id} className="space-y-2">
                    <h4 className="font-bold text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded-lg sticky top-0 z-10 border border-gray-100 dark:border-gray-700">
                      حلقة السرد: {h.name}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {hStudents.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSardGroupIds(prev => [...prev, s.id]);
                            setIsCrossHalaqaModalOpen(false);
                            setGuestSearch('');
                          }}
                          className="text-right p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-emerald-500 hover:shadow-sm transition-all"
                        >
                          <span className="font-bold text-sm">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      <MushafReaderModal
        isOpen={isMushafModalOpen}
        onClose={() => setIsMushafModalOpen(false)}
        newPages={subject === 'sard' ? sardActivePages : (evalType === EvaluationType.REVIEW ? Array.from(studentQuranHistory.newEvalsFullPages) : selectionState.allActivePages)}
        previousWeekPages={subject === 'sard' ? undefined : (evalType === EvaluationType.REVIEW ? studentQuranHistory.oldFullPages : previousWeekPages)}
        studentName={activeStudent?.name}
        evalFath={subject === 'sard' ? sardFathErrors : evalFath}
        setEvalFath={subject === 'sard' ? setSardFathErrors : setEvalFath}
        evalTashkeel={subject === 'sard' ? sardTashkeelErrors : evalTashkeel}
        setEvalTashkeel={subject === 'sard' ? setSardTashkeelErrors : setEvalTashkeel}
        evalTajweed={subject === 'sard' ? sardTajweedErrors : evalTajweed}
        setEvalTajweed={subject === 'sard' ? setSardTajweedErrors : setEvalTajweed}
        isSardMode={subject === 'sard'}
        sardGroupMode={sardEvalMode === 'group'}
        sardGroupStudents={students.filter(s => selectedSardGroupIds.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }))}
        sardGroupErrors={sardGroupErrors}
        setSardGroupErrors={setSardGroupErrors}
      />
      {pendingMatnsAlert && (
          <Modal title="تنبيه: استكمال المتون" onClose={() => setPendingMatnsAlert(null)} hideDefaultCloseButton={true}>
             <div className="text-center py-2 space-y-4">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">يجب تقييم جميع المتون</h3>
                <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                    لم يتم تقييم المتون التالية لهذا الأسبوع:
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {pendingMatnsAlert.map(m => (
                        <span key={m} className="bg-amber-50 text-amber-700 border border-amber-200 px-4 py-1.5 rounded-lg text-sm font-black dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300">
                            {m}
                        </span>
                    ))}
                </div>
                <button onClick={() => setPendingMatnsAlert(null)} className="mt-6 w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black shadow-lg active:scale-95 transition-all">
                    العودة لتقييم المتون
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
          prevFromVerse={viewingVersesModal.prevFromVerse}
          prevToVerse={viewingVersesModal.prevToVerse}
          matns={matns}
        />
      )}
    </>
  );
};
