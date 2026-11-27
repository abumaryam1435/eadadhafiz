import React, { useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MessageCircle,
  RotateCcw,
  Settings2,
  Share2,
  Users,
  X,
} from 'lucide-react';
import { AppContext } from '../App';
import { Student } from '../types';
import { getMemorizedPagesData } from '../utils/pageUtils';
import { formatWhatsAppNumber } from '../utils/searchUtils';
import { getDb } from '../utils/firebase';
import { FilterItem } from './FilterItem';
import { DailyAmount, PageRange, SevenCastlesPlan } from '../seven-castles/types';
import {
  ARABIC_WEEKDAYS,
  DAILY_AMOUNT_LABELS,
  JUZ_PAGES,
  compressPagesToRanges,
  createStudentSevenCastlesPlan,
  expandOldMemorizationRanges,
  formatOldMemorizationSummary,
  getJuzForPage,
  parsePlanDate,
  suggestSmartDefaultPlanStart,
  suggestStartForStudent,
} from '../seven-castles/sevenCastlesGenerator';
import {
  SevenCastlesSharedSettings,
  SevenCastlesSharedSettingsBar,
  StudentSevenCastlesConfig,
  StudentSevenCastlesConfigForm,
  getNearestDateForWeekday,
} from '../seven-castles/SevenCastlesFormControls';
import {
  buildWhatsAppShareMessage,
  downloadSevenCastlesPdf,
  generateSevenCastlesPdf,
} from '../seven-castles/sevenCastlesPdfExporter';
import { buildStudentTasksShareUrl } from '../seven-castles/sevenCastlesLink';

const SHARED_SETTINGS_STORAGE_KEY = 'seven_castles_shared_settings_v3';
const STUDENT_CONFIGS_STORAGE_KEY = 'seven_castles_student_configs_v2';

const QUICK_DAILY_AMOUNT_OPTIONS: { id: DailyAmount; label: string; shortLabel: string }[] = [
  { id: DailyAmount.QUARTER_PAGE, label: 'ربع صفحة', shortLabel: 'ربع صفحة' },
  { id: DailyAmount.HALF_PAGE, label: 'نصف صفحة', shortLabel: 'نصف صفحة' },
  { id: DailyAmount.ONE_PAGE, label: 'صفحة واحدة', shortLabel: 'صفحة واحدة' },
  { id: DailyAmount.TWO_PAGES, label: 'صفحتان', shortLabel: 'صفحتان' },
  { id: DailyAmount.QUARTER_HIZB, label: 'ربع حزب', shortLabel: 'ربع حزب' },
  { id: DailyAmount.THREE_PAGES, label: '3 صفحات', shortLabel: '3 صفحات' },
  { id: DailyAmount.FOUR_PAGES, label: '4 صفحات', shortLabel: '4 صفحات' },
  { id: DailyAmount.FIVE_PAGES, label: '5 صفحات', shortLabel: '5 صفحات' },
  {
    id: DailyAmount.JUZ_PER_PLAN,
    label: 'جزء لكل خطة (الأجزاء ٢٨، ٢٩، ٣٠)',
    shortLabel: 'جزء لكل خطة',
  },
];

const STUDENT_CARD_ACCENTS = [
  {
    card: 'border-emerald-300/90 dark:border-emerald-700/60 border-r-4 border-r-emerald-600 dark:border-r-emerald-500 border-b-[3px] border-b-emerald-500/45 dark:border-b-emerald-500/45 shadow-[0_8px_18px_-6px_rgba(5,150,105,0.22)] dark:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.65)]',
    badge: 'bg-emerald-800 dark:bg-emerald-700 text-amber-300',
  },
  {
    card: 'border-amber-300/90 dark:border-amber-700/60 border-r-4 border-r-amber-500 dark:border-r-amber-400 border-b-[3px] border-b-amber-500/45 dark:border-b-amber-400/45 shadow-[0_8px_18px_-6px_rgba(217,119,6,0.22)] dark:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.65)]',
    badge: 'bg-amber-600 dark:bg-amber-600 text-white',
  },
  {
    card: 'border-sky-300/90 dark:border-sky-700/60 border-r-4 border-r-sky-600 dark:border-r-sky-500 border-b-[3px] border-b-sky-500/45 dark:border-b-sky-500/45 shadow-[0_8px_18px_-6px_rgba(2,132,199,0.22)] dark:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.65)]',
    badge: 'bg-sky-700 dark:bg-sky-700 text-white',
  },
  {
    card: 'border-teal-300/90 dark:border-teal-700/60 border-r-4 border-r-teal-600 dark:border-r-teal-500 border-b-[3px] border-b-teal-500/45 dark:border-b-teal-500/45 shadow-[0_8px_18px_-6px_rgba(13,148,136,0.22)] dark:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.65)]',
    badge: 'bg-teal-700 dark:bg-teal-700 text-amber-200',
  },
  {
    card: 'border-indigo-300/90 dark:border-indigo-700/60 border-r-4 border-r-indigo-600 dark:border-r-indigo-500 border-b-[3px] border-b-indigo-500/45 dark:border-b-indigo-500/45 shadow-[0_8px_18px_-6px_rgba(79,70,229,0.20)] dark:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.65)]',
    badge: 'bg-indigo-700 dark:bg-indigo-700 text-white',
  },
  {
    card: 'border-rose-300/90 dark:border-rose-700/60 border-r-4 border-r-rose-500 dark:border-r-rose-500 border-b-[3px] border-b-rose-500/40 dark:border-b-rose-500/45 shadow-[0_8px_18px_-6px_rgba(225,29,72,0.20)] dark:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.65)]',
    badge: 'bg-rose-700 dark:bg-rose-700 text-white',
  },
];

function sanitizeForFirebase(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj === undefined ? null : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirebase);
  }
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      out[key] = sanitizeForFirebase(val);
    }
  }
  return out;
}

function getDefaultSharedSettings(): SevenCastlesSharedSettings {
  const defaultWeekday = 5; // الجمعة
  return {
    startDate: getNearestDateForWeekday(defaultWeekday),
    firstDayOfWeek: defaultWeekday,
    dailyFixationRepetitions: 5,
    weeklyReviewRepetitions: 3,
    pdfStyle: 'standard',
  };
}

function loadSharedSettings(): SevenCastlesSharedSettings {
  const defaults = getDefaultSharedSettings();
  try {
    const raw = localStorage.getItem(SHARED_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      startDate: typeof parsed.startDate === 'string' && parsed.startDate ? parsed.startDate : defaults.startDate,
      firstDayOfWeek: typeof parsed.firstDayOfWeek === 'number' ? parsed.firstDayOfWeek : defaults.firstDayOfWeek,
      dailyFixationRepetitions:
        typeof parsed.dailyFixationRepetitions === 'number' && parsed.dailyFixationRepetitions >= 1
          ? parsed.dailyFixationRepetitions
          : 5,
      weeklyReviewRepetitions:
        typeof parsed.weeklyReviewRepetitions === 'number' && parsed.weeklyReviewRepetitions >= 1
          ? parsed.weeklyReviewRepetitions
          : 3,
      pdfStyle: parsed.pdfStyle === 'castle_towers' ? 'castle_towers' : 'standard',
    };
  } catch {
    return defaults;
  }
}

function loadSavedStudentConfigs(): Record<number, StudentSevenCastlesConfig> {
  try {
    const raw = localStorage.getItem(STUDENT_CONFIGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function buildDefaultStudentConfig(oldPages: number[]): StudentSevenCastlesConfig {
  return suggestSmartDefaultPlanStart(oldPages);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const SevenCastlesPlansTab: React.FC = () => {
  const context = useContext(AppContext);
  const students = context?.students || [];
  const halaqas = context?.halaqas || [];
  const users = context?.users || [];
  const evaluations = context?.evaluations || [];
  const customLogo = context?.customLogo || null;
  const appName = context?.appName || 'إعداد حافظ';
  const showToast = context?.showToast;

  const [sharedSettings, setSharedSettings] = useState<SevenCastlesSharedSettings>(() =>
    loadSharedSettings()
  );
  const [studentConfigs, setStudentConfigs] = useState<Record<number, StudentSevenCastlesConfig>>(
    () => loadSavedStudentConfigs()
  );

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedHalaqaIds, setSelectedHalaqaIds] = useState<string[]>([]);
  const [halaqaSearch, setHalaqaSearch] = useState('');
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null);
  const [configModalStudentId, setConfigModalStudentId] = useState<number | null>(null);
  const [openAmountMenuStudentId, setOpenAmountMenuStudentId] = useState<number | null>(null);
  const [openStartMenuStudentId, setOpenStartMenuStudentId] = useState<number | null>(null);
  const [copiedStudentId, setCopiedStudentId] = useState<number | null>(null);

  useEffect(() => {
    if (configModalStudentId === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfigModalStudentId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [configModalStudentId]);

  useEffect(() => {
    if (openAmountMenuStudentId === null && openStartMenuStudentId === null) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest('[data-amount-dropdown]') || target.closest('[data-start-dropdown]'))) {
        return;
      }
      setOpenAmountMenuStudentId(null);
      setOpenStartMenuStudentId(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openAmountMenuStudentId, openStartMenuStudentId]);
  const [busyState, setBusyState] = useState<{
    studentId: number;
    action: 'pdf' | 'whatsapp' | 'copy';
    message: string;
    step: number;
    total: number;
  } | null>(null);

  const [readyWhatsAppShare, setReadyWhatsAppShare] = useState<{
    studentName: string;
    whatsappUrl: string;
    fileName: string;
    file: File;
    message: string;
    canShareFile: boolean;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SHARED_SETTINGS_STORAGE_KEY, JSON.stringify(sharedSettings));
    } catch {
      // ignore quota errors
    }
  }, [sharedSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STUDENT_CONFIGS_STORAGE_KEY, JSON.stringify(studentConfigs));
    } catch {
      // ignore quota errors
    }
  }, [studentConfigs]);

  const resolvedLogoUrl = useMemo(() => {
    if (customLogo && customLogo.trim()) return customLogo;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/logo.png`;
    }
    return '/logo.png';
  }, [customLogo]);

  const halaqaMap = useMemo(() => {
    const map = new Map<number, { name: string; teacherName: string }>();
    const userMap = new Map<number, string>();
    users.forEach((u) => userMap.set(u.id, u.name));
    halaqas.forEach((h) => {
      map.set(h.id, {
        name: h.name,
        teacherName: userMap.get(h.teacherId) || '',
      });
    });
    return map;
  }, [halaqas, users]);

  // Compute each student's old memorization ranges & pages automatically from app records
  const studentMemMap = useMemo(() => {
    const map = new Map<
      number,
      {
        oldRanges: PageRange[];
        oldPages: number[];
        summary: string;
        defaultConfig: StudentSevenCastlesConfig;
      }
    >();
    students.forEach((st) => {
      const memData = getMemorizedPagesData(st, evaluations);
      const rawPages = Array.from(memData.totalSet).filter((p) => p >= 1 && p <= 604);
      const oldRanges = compressPagesToRanges(rawPages);
      const oldPages = expandOldMemorizationRanges(oldRanges);
      const summary = formatOldMemorizationSummary(oldRanges, oldPages);
      const defaultConfig = buildDefaultStudentConfig(oldPages);
      map.set(st.id, { oldRanges, oldPages, summary, defaultConfig });
    });
    return map;
  }, [students, evaluations]);

  const sortedHalaqas = useMemo(() => {
    return [...halaqas].sort((a, b) => {
      const catA = (a.category || 'ibri') === 'ibri' ? 0 : 1;
      const catB = (b.category || 'ibri') === 'ibri' ? 0 : 1;
      if (catA !== catB) return catA - catB;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ar', { numeric: true });
    });
  }, [halaqas]);

  const halaqaFilterOptions = useMemo(() => {
    return sortedHalaqas.map((h) => {
      const info = halaqaMap.get(h.id);
      return {
        id: h.id,
        name: info?.teacherName ? `${h.name} — ${info.teacherName}` : h.name,
      };
    });
  }, [sortedHalaqas, halaqaMap]);

  const sortedAllStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const numA = a.studentNumber ?? 999999;
      const numB = b.studentNumber ?? 999999;
      if (numA !== numB) return numA - numB;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    });
  }, [students]);

  const studentFilterOptions = useMemo(() => {
    const hasHalaqaFilter =
      selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes('ALL');
    const pool = hasHalaqaFilter
      ? sortedAllStudents.filter((s) => selectedHalaqaIds.includes(String(s.halaqaId)))
      : sortedAllStudents;
    return pool.map((s) => ({
      id: s.id,
      name: s.name,
      studentNumber: s.studentNumber,
    }));
  }, [sortedAllStudents, selectedHalaqaIds]);

  const filteredStudents = useMemo(() => {
    const hasHalaqaFilter =
      selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes('ALL');
    const hasStudentFilter =
      selectedStudentIds.length > 0 && !selectedStudentIds.includes('ALL');

    return sortedAllStudents.filter((st) => {
      if (hasHalaqaFilter && !selectedHalaqaIds.includes(String(st.halaqaId))) {
        return false;
      }
      if (hasStudentFilter && !selectedStudentIds.includes(String(st.id))) {
        return false;
      }
      return true;
    });
  }, [sortedAllStudents, selectedHalaqaIds, selectedStudentIds]);

  const hasActiveFilters =
    (selectedStudentIds.length > 0 && !selectedStudentIds.includes('ALL')) ||
    (selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes('ALL'));

  const getEffectiveConfig = (student: Student): StudentSevenCastlesConfig => {
    const saved = studentConfigs[student.id];
    if (saved) return saved;
    const mem = studentMemMap.get(student.id);
    return mem ? mem.defaultConfig : buildDefaultStudentConfig([]);
  };

  const updateStudentConfig = (studentId: number, next: StudentSevenCastlesConfig) => {
    setStudentConfigs((prev) => ({
      ...prev,
      [studentId]: next,
    }));
  };

  const resetStudentConfigToSuggested = (student: Student) => {
    setStudentConfigs((prev) => {
      const next = { ...prev };
      delete next[student.id];
      return next;
    });
    showToast?.(`تمت إعادة اقتراح البداية تلقائياً للطالب ${student.name}`, 'info');
  };

  const buildPlanForStudent = (student: Student): SevenCastlesPlan => {
    const mem = studentMemMap.get(student.id);
    const oldRanges = mem?.oldRanges || [];
    const oldPages = mem?.oldPages || [];
    const cfg = getEffectiveConfig(student);

    return createStudentSevenCastlesPlan({
      studentId: student.id,
      studentName: student.name,
      oldMemorizationRanges: oldRanges,
      oldMemorizedPages: oldPages,
      dailyAmount: cfg.dailyAmount,
      startDate: sharedSettings.startDate,
      firstDayOfWeek: sharedSettings.firstDayOfWeek,
      dailyFixationRepetitions: sharedSettings.dailyFixationRepetitions,
      weeklyReviewRepetitions: sharedSettings.weeklyReviewRepetitions,
      isSevenCastlesDescending: cfg.isSevenCastlesDescending,
      sevenCastlesStartMode: cfg.sevenCastlesStartMode,
      juzNumber: cfg.juzNumber,
      startPage: cfg.startPage,
    });
  };

  const savePlanToDatabase = async (plan: SevenCastlesPlan): Promise<string | undefined> => {
    const db = getDb();
    if (!db || !plan.id) return undefined;
    const safePlanId = String(plan.id).replace(/[.#$\[\]/]/g, '-');
    try {
      const payload = sanitizeForFirebase({
        ...plan,
        id: safePlanId,
        updatedAt: new Date().toISOString(),
      });
      await Promise.race([
        db.ref(`data/sevenCastlesPlans/${safePlanId}`).set(payload),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 4000)
        ),
      ]);
      return safePlanId;
    } catch (err) {
      console.warn('Could not save Seven Castles plan to Firebase, falling back to token URL:', err);
      return undefined;
    }
  };

  const isDateWeekdayMismatch = useMemo(() => {
    const parsed = parsePlanDate(sharedSettings.startDate);
    return parsed.getDay() !== sharedSettings.firstDayOfWeek;
  }, [sharedSettings.startDate, sharedSettings.firstDayOfWeek]);

  const expectedStartDayName = useMemo(() => {
    return (
      ARABIC_WEEKDAYS.find((d) => d.value === sharedSettings.firstDayOfWeek)?.label ||
      'الجمعة'
    );
  }, [sharedSettings.firstDayOfWeek]);

  const ensureStartDateValid = (): boolean => {
    if (!isDateWeekdayMismatch) return true;
    showToast?.(
      `تنبيه: يجب أن تبدأ الخطة في يوم (${expectedStartDayName}) — يرجى ضبط التاريخ أولاً`,
      'error'
    );
    return false;
  };

  const handleExportPdf = async (student: Student) => {
    if (busyState) return;
    if (!ensureStartDateValid()) return;
    const plan = buildPlanForStudent(student);
    setBusyState({
      studentId: student.id,
      action: 'pdf',
      message: `جاري تجهيز خطة الطالب ${student.name}...`,
      step: 0,
      total: 1,
    });

    try {
      await downloadSevenCastlesPdf(plan, {
        style: sharedSettings.pdfStyle,
        logoUrl: resolvedLogoUrl,
        appName,
        onProgress: (message, currentStep, totalSteps) => {
          setBusyState({
            studentId: student.id,
            action: 'pdf',
            message,
            step: currentStep,
            total: totalSteps,
          });
        },
      });
      showToast?.(`تم تصدير ملف PDF لخطة ${student.name} بنجاح`, 'success');
    } catch (err) {
      console.error('Failed to export Seven Castles PDF:', err);
      showToast?.('حدث خطأ أثناء تصدير ملف الـ PDF', 'error');
    } finally {
      setBusyState(null);
    }
  };

  const handleQuickDailyAmountChange = (student: Student, val: DailyAmount) => {
    const current = getEffectiveConfig(student);
    const nextJuz =
      val === DailyAmount.JUZ_PER_PLAN &&
      (current.juzNumber < 28 || current.juzNumber > 30)
        ? 29
        : current.juzNumber;
    const range = JUZ_PAGES[nextJuz];
    updateStudentConfig(student.id, {
      ...current,
      dailyAmount: val,
      sevenCastlesStartMode:
        val === DailyAmount.JUZ_PER_PLAN ? 'juz' : current.sevenCastlesStartMode,
      juzNumber: nextJuz,
      startPage:
        val === DailyAmount.JUZ_PER_PLAN && range
          ? current.isSevenCastlesDescending
            ? range.end
            : range.start
          : current.startPage,
    });
    setOpenAmountMenuStudentId(null);
  };

  const handleQuickDirectionChange = (student: Student, isDescending: boolean) => {
    const current = getEffectiveConfig(student);
    if (current.isSevenCastlesDescending === isDescending) return;
    const mem = studentMemMap.get(student.id);
    const oldPages = mem?.oldPages || [];

    if (current.dailyAmount === DailyAmount.JUZ_PER_PLAN) {
      const range = JUZ_PAGES[current.juzNumber];
      updateStudentConfig(student.id, {
        ...current,
        isSevenCastlesDescending: isDescending,
        startPage: range ? (isDescending ? range.end : range.start) : current.startPage,
      });
      return;
    }

    const prevSuggested = suggestStartForStudent(oldPages, current.isSevenCastlesDescending);
    const isUsingAutoStart =
      current.startPage === prevSuggested.startPage &&
      current.juzNumber === prevSuggested.juzNumber;

    if (isUsingAutoStart) {
      const nextSuggested = suggestStartForStudent(oldPages, isDescending);
      const nextRange = JUZ_PAGES[nextSuggested.juzNumber];
      const isLastThreeJuz =
        nextSuggested.juzNumber === 28 ||
        nextSuggested.juzNumber === 29 ||
        nextSuggested.juzNumber === 30;
      const shouldUseJuzPerPlan =
        isLastThreeJuz && current.dailyAmount === DailyAmount.QUARTER_PAGE;
      const startsAtBoundary =
        !!nextRange &&
        (isDescending
          ? nextSuggested.startPage === nextRange.end
          : nextSuggested.startPage === nextRange.start);
      updateStudentConfig(student.id, {
        ...current,
        dailyAmount: shouldUseJuzPerPlan ? DailyAmount.JUZ_PER_PLAN : current.dailyAmount,
        isSevenCastlesDescending: isDescending,
        juzNumber: nextSuggested.juzNumber,
        startPage:
          shouldUseJuzPerPlan && nextRange
            ? isDescending
              ? nextRange.end
              : nextRange.start
            : nextSuggested.startPage,
        sevenCastlesStartMode:
          shouldUseJuzPerPlan || startsAtBoundary ? 'juz' : 'page',
      });
      return;
    }

    let nextStartPage = current.startPage;
    if (current.sevenCastlesStartMode === 'juz') {
      const range = JUZ_PAGES[current.juzNumber];
      if (range) {
        nextStartPage = isDescending ? range.end : range.start;
      }
    }
    updateStudentConfig(student.id, {
      ...current,
      isSevenCastlesDescending: isDescending,
      startPage: nextStartPage,
    });
  };

  const handleQuickStartModeChange = (student: Student, mode: 'juz' | 'page') => {
    const current = getEffectiveConfig(student);
    if (mode === 'juz') {
      const range = JUZ_PAGES[current.juzNumber];
      updateStudentConfig(student.id, {
        ...current,
        sevenCastlesStartMode: 'juz',
        startPage: range
          ? current.isSevenCastlesDescending
            ? range.end
            : range.start
          : current.startPage,
      });
    } else {
      updateStudentConfig(student.id, {
        ...current,
        sevenCastlesStartMode: 'page',
      });
    }
  };

  const handleQuickJuzChange = (student: Student, juzNum: number) => {
    const current = getEffectiveConfig(student);
    const range = JUZ_PAGES[juzNum];
    const nextStartPage = range
      ? current.isSevenCastlesDescending
        ? range.end
        : range.start
      : current.startPage;
    updateStudentConfig(student.id, {
      ...current,
      sevenCastlesStartMode: 'juz',
      juzNumber: juzNum,
      startPage: nextStartPage,
    });
    setOpenStartMenuStudentId(null);
  };

  const handleQuickStartPageChange = (student: Student, rawPage: number) => {
    const current = getEffectiveConfig(student);
    const clampedPage = Math.min(604, Math.max(1, rawPage || 1));
    updateStudentConfig(student.id, {
      ...current,
      sevenCastlesStartMode: 'page',
      startPage: clampedPage,
      juzNumber: getJuzForPage(clampedPage),
    });
  };

  const handleQuickResetStart = (student: Student) => {
    setStudentConfigs((prev) => {
      const next = { ...prev };
      delete next[student.id];
      return next;
    });
    setOpenStartMenuStudentId(null);
  };

  const handleShareWhatsApp = async (student: Student) => {
    if (busyState) return;
    if (!ensureStartDateValid()) return;
    const formattedPhone = formatWhatsAppNumber(student.parentPhone);
    const cleanPhone = formattedPhone.replace(/[^\d]/g, '');
    if (!cleanPhone) {
      showToast?.('لا يتوفر رقم هاتف مسجل لهذا الطالب', 'error');
      return;
    }
    const plan = buildPlanForStudent(student);
    setReadyWhatsAppShare(null);
    setBusyState({
      studentId: student.id,
      action: 'whatsapp',
      message: `جاري تجهيز ملف الـ PDF ورسالة الواتساب للطالب ${student.name}...`,
      step: 0,
      total: 1,
    });

    try {
      const [savedPlanId, generated] = await Promise.all([
        savePlanToDatabase(plan),
        generateSevenCastlesPdf(plan, {
          style: sharedSettings.pdfStyle,
          logoUrl: resolvedLogoUrl,
          appName,
          onProgress: (message, currentStep, totalSteps) => {
            setBusyState({
              studentId: student.id,
              action: 'whatsapp',
              message,
              step: currentStep,
              total: totalSteps,
            });
          },
        }),
      ]);

      const tasksUrl = buildStudentTasksShareUrl(plan, {
        routePath: '/student-tasks',
        savedPlanId,
      });

      const message = buildWhatsAppShareMessage(plan, tasksUrl, appName);
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

      // 1) Download the generated PDF file immediately so it is ready to attach in the chat
      generated.pdf.save(generated.fileName);

      // 2) Keep quick-access banner ready (for mobile browsers that block post-async redirects or to share the PDF file directly)
      const nav = typeof navigator !== 'undefined' ? navigator : undefined;
      const canShareFile =
        !!nav &&
        typeof nav.share === 'function' &&
        typeof nav.canShare === 'function' &&
        nav.canShare({ files: [generated.file] });

      setReadyWhatsAppShare({
        studentName: student.name,
        whatsappUrl,
        fileName: generated.fileName,
        file: generated.file,
        message,
        canShareFile,
      });

      // 3) Open WhatsApp directly on the student's registered phone number with the message & link prefilled
      const link = document.createElement('a');
      link.href = whatsappUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast?.(
        `تم تحميل ملف الـ PDF وفتح واتساب مباشرة للطالب ${student.name} — أرفق الملف المحمّل في المحادثة`,
        'success'
      );
    } catch (err) {
      console.error('Failed to prepare WhatsApp & PDF for Seven Castles plan:', err);
      showToast?.('حدث خطأ أثناء تجهيز ملف الـ PDF وفتح واتساب للطالب', 'error');
    } finally {
      setBusyState(null);
    }
  };

  const handleNativeShareReadyFile = async () => {
    if (!readyWhatsAppShare || typeof navigator === 'undefined' || !navigator.share) return;
    try {
      await navigator.share({
        files: [readyWhatsAppShare.file],
        title: `خطة القلاع السبع — ${readyWhatsAppShare.studentName}`,
        text: readyWhatsAppShare.message,
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        showToast?.('تعذرت المشاركة المباشرة للملف على هذا المتصفح', 'error');
      }
    }
  };

  const handleCopyTasksLink = async (student: Student) => {
    if (busyState) return;
    if (!ensureStartDateValid()) return;
    const plan = buildPlanForStudent(student);
    setBusyState({
      studentId: student.id,
      action: 'copy',
      message: `جاري تجهيز الرسالة ورابط المهام...`,
      step: 1,
      total: 1,
    });

    try {
      const savedPlanId = await savePlanToDatabase(plan);
      const tasksUrl = buildStudentTasksShareUrl(plan, {
        routePath: '/student-tasks',
        savedPlanId,
      });
      const shareMessage = buildWhatsAppShareMessage(plan, tasksUrl, appName);
      const copied = await copyTextToClipboard(shareMessage);
      if (copied) {
        setCopiedStudentId(student.id);
        showToast?.(`تم نسخ الرسالة ورابط المهام اليومية للطالب ${student.name}`, 'success');
        setTimeout(() => {
          setCopiedStudentId((prev) => (prev === student.id ? null : prev));
        }, 2500);
      } else {
        showToast?.('تعذر نسخ الرسالة والرابط تلقائياً', 'error');
      }
    } catch (err) {
      console.error('Failed to copy tasks link:', err);
      showToast?.('حدث خطأ أثناء تجهيز الرسالة ورابط المهام', 'error');
    } finally {
      setBusyState(null);
    }
  };

  const configModalStudent = useMemo(
    () =>
      configModalStudentId !== null
        ? students.find((s) => s.id === configModalStudentId) || null
        : null,
    [configModalStudentId, students]
  );

  return (
    <div dir="rtl" className="space-y-5 max-w-6xl mx-auto">
      {/* Shared Settings Bar (Verbatim from seven-castles kit) */}
      <SevenCastlesSharedSettingsBar
        settings={sharedSettings}
        onChange={setSharedSettings}
      />

      {/* Global Export Progress Banner */}
      {busyState && (
        <div className="bg-emerald-900 dark:bg-emerald-950 text-white rounded-2xl p-3.5 shadow-lg border border-emerald-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-5 h-5 animate-spin text-amber-300 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{busyState.message}</span>
          </div>
          {busyState.total > 1 && (
            <div className="flex items-center gap-2 sm:w-56">
              <div className="flex-1 h-2 bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((busyState.step / busyState.total) * 100))}%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-black text-amber-300 shrink-0">
                {busyState.step}/{busyState.total}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Ready WhatsApp + PDF Quick Banner */}
      {readyWhatsAppShare && !busyState && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300/80 dark:border-emerald-700/50 rounded-2xl p-3 sm:p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-xs sm:text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
              تم تحميل ملف PDF لخطة الطالب: {readyWhatsAppShare.studentName}
            </div>
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300/85">
              أرفق الملف المحمّل ({readyWhatsAppShare.fileName}) داخل محادثة الواتساب مع الرسالة والرابط.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={readyWhatsAppShare.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              <span>فتح واتساب للرقم المسجل</span>
            </a>
            {readyWhatsAppShare.canShareFile && (
              <button
                type="button"
                onClick={handleNativeShareReadyFile}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>مشاركة ملف PDF مباشرة</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setReadyWhatsAppShare(null)}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/50 cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Multi-Select Filter Toolbar (Matching ReportsTable FilterItem style) */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-[#1A2E1A]/10 dark:border-white/10 rounded-3xl p-4 shadow-sm relative z-40">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <FilterItem
            id="seven-castles-student"
            title="الطالب"
            selectedValues={selectedStudentIds}
            options={studentFilterOptions}
            onSelect={setSelectedStudentIds}
            search={studentSearch}
            setSearch={setStudentSearch}
            openDropdown={openFilterDropdown}
            setOpenDropdown={setOpenFilterDropdown}
          />

          <FilterItem
            id="seven-castles-halaqa"
            title="حلقة الطالب"
            selectedValues={selectedHalaqaIds}
            options={halaqaFilterOptions}
            onSelect={setSelectedHalaqaIds}
            search={halaqaSearch}
            setSearch={setHalaqaSearch}
            openDropdown={openFilterDropdown}
            setOpenDropdown={setOpenFilterDropdown}
          />

          <div className="flex items-center justify-between sm:justify-end gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStudentIds([]);
                  setSelectedHalaqaIds([]);
                  setStudentSearch('');
                  setHalaqaSearch('');
                }}
                className="h-10 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/50 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>مسح التصفية</span>
              </button>
            )}

            <div className="h-10 flex items-center gap-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold shrink-0">
              <Users className="w-4 h-4" />
              <span>{filteredStudents.length} طالب</span>
            </div>
          </div>
        </div>
      </div>

      {/* Students List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white dark:bg-[#1A1A1A] border border-gray-200/70 dark:border-white/10 rounded-3xl p-10 text-center space-y-2">
          <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
            لا يوجد طلاب مطابقون لخيارات البحث أو الفلترة الحالية
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredStudents.map((student, studentIdx) => {
            const mem = studentMemMap.get(student.id);
            const oldRanges = mem?.oldRanges || [];
            const oldPages = mem?.oldPages || [];
            const oldSummary = mem?.summary || 'لا يوجد محفوظ قديم';
            const config = getEffectiveConfig(student);
            const isConfigModalOpen = configModalStudentId === student.id;
            const isAmountMenuOpen = openAmountMenuStudentId === student.id;
            const isStartMenuOpen = openStartMenuStudentId === student.id;
            const halaqaInfo = halaqaMap.get(student.halaqaId);
            const isThisBusy = busyState?.studentId === student.id;
            const isCopied = copiedStudentId === student.id;
            const hasPhone = Boolean(formatWhatsAppNumber(student.parentPhone));
            const selectedAmountOption = QUICK_DAILY_AMOUNT_OPTIONS.find(
              (o) => o.id === config.dailyAmount
            );
            const dailyShortLabel =
              selectedAmountOption?.shortLabel ||
              DAILY_AMOUNT_LABELS[config.dailyAmount] ||
              'ربع صفحة';
            const cardAccent =
              STUDENT_CARD_ACCENTS[studentIdx % STUDENT_CARD_ACCENTS.length];

            return (
              <div
                key={student.id}
                className={`bg-white dark:bg-[#1A1A1A] border rounded-3xl transition-all relative ${cardAccent.card} ${
                  isAmountMenuOpen || isStartMenuOpen ? 'z-30' : 'z-0'
                }`}
              >
                {/* Student Card Main Section */}
                <div className="p-3.5 sm:p-4 space-y-3">
                  {/* Top Row: Student Identity + Halaqa */}
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-xs mt-0.5 ${cardAccent.badge}`}
                    >
                      {student.studentNumber ?? '#'}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <h4 className="text-sm sm:text-base font-extrabold text-[#1A2E1A] dark:text-white leading-snug break-words">
                          {student.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {halaqaInfo?.name && (
                            <span className="text-[10.5px] sm:text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                              {halaqaInfo.name}
                              {halaqaInfo.teacherName ? ` • ${halaqaInfo.teacherName}` : ''}
                            </span>
                          )}
                          {!hasPhone && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200/70 dark:border-white/10">
                              بدون رقم هاتف
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 rounded-xl px-2.5 py-1.5 leading-relaxed">
                        <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                        <span className="break-words">المحفوظ القديم: {oldSummary}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Controls Strip: Daily Amount Dropdown + Direction Toggle + Start Info */}
                  <div className="bg-gray-50/90 dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/10 rounded-2xl p-2.5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5">
                    {/* Quick Daily Amount Dropdown Button */}
                    <div
                      className="relative flex-1 sm:flex-initial min-w-0"
                      data-amount-dropdown
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenStartMenuStudentId(null);
                          setOpenAmountMenuStudentId(isAmountMenuOpen ? null : student.id);
                        }}
                        className="w-full sm:w-auto min-w-[165px] px-3 py-2 rounded-xl bg-white dark:bg-[#141414] border border-amber-500/35 dark:border-amber-500/30 hover:border-amber-500 text-xs font-extrabold text-[#1A2E1A] dark:text-[#D4AF37] shadow-2xs flex items-center justify-between gap-2 transition-all cursor-pointer"
                      >
                        <span className="truncate">
                          <span className="text-gray-400 dark:text-gray-500 font-bold ml-1">
                            المقدار:
                          </span>
                          {dailyShortLabel}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-[#D4AF37] transition-transform ${
                            isAmountMenuOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isAmountMenuOpen && (
                        <div className="absolute right-0 mt-1.5 w-full sm:w-64 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/15 rounded-2xl shadow-xl py-1.5 z-50 max-h-72 overflow-y-auto">
                          {QUICK_DAILY_AMOUNT_OPTIONS.map((opt) => {
                            const isSelected = config.dailyAmount === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleQuickDailyAmountChange(student, opt.id)}
                                className={`w-full px-3 py-2 text-right text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-extrabold'
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                              >
                                <span className="truncate">{opt.label}</span>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Quick Ascending / Descending Toggle */}
                    <div className="flex items-center bg-white dark:bg-[#141414] p-1 rounded-xl border border-gray-200/80 dark:border-white/10 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleQuickDirectionChange(student, false)}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                          !config.isSevenCastlesDescending
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        تصاعدي
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDirectionChange(student, true)}
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                          config.isSevenCastlesDescending
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        تنازلي
                      </button>
                    </div>

                    {/* Quick Start Position Dropdown Button */}
                    <div
                      className="relative flex-1 sm:flex-initial min-w-0 sm:mr-auto"
                      data-start-dropdown
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenAmountMenuStudentId(null);
                          setOpenStartMenuStudentId(isStartMenuOpen ? null : student.id);
                        }}
                        className="w-full sm:w-auto min-w-[175px] px-3 py-2 rounded-xl bg-white dark:bg-[#141414] border border-emerald-500/35 dark:border-emerald-500/30 hover:border-emerald-500 text-xs font-extrabold text-[#1A2E1A] dark:text-emerald-300 shadow-2xs flex items-center justify-between gap-2 transition-all cursor-pointer"
                      >
                        <span className="truncate">
                          <span className="text-gray-400 dark:text-gray-500 font-bold ml-1">
                            البداية:
                          </span>
                          جزء {config.juzNumber} • ص {config.startPage}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 transition-transform ${
                            isStartMenuOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isStartMenuOpen && (
                        <div className="absolute right-0 sm:right-auto sm:left-0 mt-1.5 w-full sm:w-72 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/15 rounded-2xl shadow-xl p-3 z-50 space-y-3">
                          {config.dailyAmount === DailyAmount.JUZ_PER_PLAN ? (
                            <div className="space-y-2">
                              <span className="text-[11px] font-extrabold text-gray-600 dark:text-gray-300 block">
                                اختر الجزء (للأجزاء ٢٨ – ٣٠)
                              </span>
                              <div className="space-y-1.5">
                                {[
                                  { num: 28, title: 'الجزء ٢٨ (قد سمع)' },
                                  { num: 29, title: 'الجزء ٢٩ (تبارك)' },
                                  { num: 30, title: 'الجزء ٣٠ (عمّ)' },
                                ].map((item) => {
                                  const isSelected = config.juzNumber === item.num;
                                  return (
                                    <button
                                      key={item.num}
                                      type="button"
                                      onClick={() => handleQuickJuzChange(student, item.num)}
                                      className={`w-full px-3 py-2 rounded-xl text-right text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#1A2E1A] dark:bg-[#D4AF37] text-white dark:text-[#1A1A1A]'
                                          : 'bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                                      }`}
                                    >
                                      <span>{item.title}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Mode Switcher: Juz vs Page */}
                              <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                                <button
                                  type="button"
                                  onClick={() => handleQuickStartModeChange(student, 'juz')}
                                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                                    config.sevenCastlesStartMode === 'juz'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  بالأجزاء
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickStartModeChange(student, 'page')}
                                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                                    config.sevenCastlesStartMode === 'page'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  بالصفحات
                                </button>
                              </div>

                              {config.sevenCastlesStartMode === 'juz' ? (
                                <div className="grid grid-cols-6 gap-1.5">
                                  {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => {
                                    const isSelected = config.juzNumber === n;
                                    return (
                                      <button
                                        key={n}
                                        type="button"
                                        onClick={() => handleQuickJuzChange(student, n)}
                                        className={`py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                          isSelected
                                            ? 'bg-[#1A2E1A] dark:bg-[#D4AF37] text-white dark:text-[#1A1A1A] shadow-xs'
                                            : 'bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-white/10'
                                        }`}
                                      >
                                        {n}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block">
                                    رقم صفحة البداية (1 – 604)
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={1}
                                      max={604}
                                      value={config.startPage}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) =>
                                        handleQuickStartPageChange(
                                          student,
                                          parseInt(e.target.value, 10) || 1
                                        )
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          setOpenStartMenuStudentId(null);
                                        }
                                      }}
                                      className="flex-1 bg-gray-50 dark:bg-white/5 dark:text-white border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm font-extrabold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setOpenStartMenuStudentId(null)}
                                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer shrink-0"
                                    >
                                      تم
                                    </button>
                                  </div>
                                  <div className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400">
                                    يوافق الجزء {config.juzNumber}
                                  </div>
                                </div>
                              )}

                              <div className="pt-2 border-t border-gray-100 dark:border-white/10">
                                <button
                                  type="button"
                                  onClick={() => handleQuickResetStart(student)}
                                  className="w-full py-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>تلقائي (أول صفحة غير محفوظة)</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons: Clean 2x2 Grid on Mobile, Inline Row on Tablet/Desktop */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      disabled={!!busyState}
                      onClick={() => handleExportPdf(student)}
                      className="min-h-[38px] px-3 py-2 rounded-xl text-xs font-extrabold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isThisBusy && busyState?.action === 'pdf' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <Download className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>تصدير PDF</span>
                    </button>

                    <button
                      type="button"
                      disabled={!!busyState || !hasPhone}
                      onClick={() => handleShareWhatsApp(student)}
                      title={
                        hasPhone
                          ? 'تجهيز وتحميل ملف PDF وفتح واتساب مباشرة على الرقم المسجل مع الرسالة والرابط'
                          : 'لا يتوفر رقم هاتف مسجل لهذا الطالب'
                      }
                      className={`min-h-[38px] px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                        hasPhone
                          ? 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-xs active:scale-95 cursor-pointer'
                          : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 border border-gray-200/80 dark:border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {isThisBusy && busyState?.action === 'whatsapp' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>إرسال واتساب</span>
                    </button>

                    <button
                      type="button"
                      disabled={!!busyState}
                      onClick={() => handleCopyTasksLink(student)}
                      title="نسخ الرسالة النصية مع رابط المهام اليومية للطالب"
                      className="min-h-[38px] px-3 py-2 rounded-xl text-xs font-extrabold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/50 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 shrink-0" />
                          <span>نسخ الرابط</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfigModalStudentId(student.id)}
                      className={`min-h-[38px] px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 border cursor-pointer active:scale-95 sm:mr-auto ${
                        isConfigModalOpen
                          ? 'bg-[#1A2E1A] text-white border-[#1A2E1A] dark:bg-[#D4AF37] dark:text-[#1A1A1A] dark:border-[#D4AF37]'
                          : 'bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-white/10'
                      }`}
                    >
                      <Settings2 className="w-3.5 h-3.5 shrink-0" />
                      <span>إعداد الخطة</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile-Responsive Student Plan Config Modal */}
      {configModalStudent &&
        typeof document !== 'undefined' &&
        createPortal(
          (() => {
            const modalMem = studentMemMap.get(configModalStudent.id);
            const modalOldRanges = modalMem?.oldRanges || [];
            const modalOldPages = modalMem?.oldPages || [];
            const modalConfig = getEffectiveConfig(configModalStudent);
            const modalHalaqa = halaqaMap.get(configModalStudent.halaqaId);

            return (
              <div
                dir="rtl"
                className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
                onClick={() => setConfigModalStudentId(null)}
              >
                <div
                  className="bg-white dark:bg-[#171717] w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88dvh] rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-gray-200/80 dark:border-white/10 flex flex-col overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Mobile Drag Handle Indicator */}
                  <div className="sm:hidden flex justify-center pt-2 pb-1 bg-white dark:bg-[#171717] shrink-0">
                    <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
                  </div>

                  {/* Sticky Modal Header */}
                  <div className="px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-white/10 flex items-center justify-between gap-2.5 shrink-0 bg-white dark:bg-[#171717]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/50 flex items-center justify-center text-emerald-700 dark:text-[#D4AF37] shrink-0">
                          <Settings2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-extrabold text-[#1A2E1A] dark:text-white truncate">
                            إعداد خطة: {configModalStudent.name}
                          </h3>
                          {modalHalaqa?.name && (
                            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-400 truncate">
                              {modalHalaqa.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfigModalStudentId(null)}
                      aria-label="إغلاق نافذة الإعدادات"
                      className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Scrollable Modal Body */}
                  <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 sm:px-5 py-3.5 sm:py-4 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => resetStudentConfigToSuggested(configModalStudent)}
                        className="min-h-[38px] text-[11px] sm:text-xs font-bold px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span>استعادة البداية المقترحة تلقائياً</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!ensureStartDateValid()) return;
                          const plan = buildPlanForStudent(configModalStudent);
                          const savedPlanId = await savePlanToDatabase(plan);
                          const url = buildStudentTasksShareUrl(plan, {
                            routePath: '/student-tasks',
                            savedPlanId,
                          });
                          const link = document.createElement('a');
                          link.href = url;
                          link.target = '_blank';
                          link.rel = 'noopener noreferrer';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="min-h-[38px] text-[11px] sm:text-xs font-bold px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/40 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>معاينة صفحة مهام الطالب</span>
                      </button>
                    </div>

                    <StudentSevenCastlesConfigForm
                      studentName={configModalStudent.name}
                      oldMemorizationRanges={modalOldRanges}
                      oldMemorizedPages={modalOldPages}
                      config={modalConfig}
                      startDate={sharedSettings.startDate}
                      onChange={(next) => updateStudentConfig(configModalStudent.id, next)}
                    />
                  </div>

                  {/* Sticky Modal Footer */}
                  <div className="px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-black/25 flex items-center justify-between gap-2 shrink-0">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      تُحفظ التعديلات تلقائياً
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfigModalStudentId(null)}
                      className="min-h-[40px] px-6 py-2 rounded-xl bg-[#1A2E1A] hover:bg-emerald-900 dark:bg-[#D4AF37] dark:hover:bg-amber-400 text-white dark:text-[#1A1A1A] text-xs sm:text-sm font-extrabold shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      تم وإغلاق
                    </button>
                  </div>
                </div>
              </div>
            );
          })(),
          document.body
        )}
    </div>
  );
};

export default SevenCastlesPlansTab;
