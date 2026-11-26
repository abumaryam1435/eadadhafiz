import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { clsx } from 'clsx';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  Info,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  User,
  Volume2,
  X,
} from 'lucide-react';
import { ProgressLog, SevenCastlesPlan, Task, TaskType, VerseRange } from './types';
import {
  DAILY_AMOUNT_LABELS,
  getSevenCastlesDurationWeeks,
  getSevenCastlesTasksForDate,
  parsePlanDate,
} from './sevenCastlesGenerator';
import { decodeSevenCastlesPlanToken } from './sevenCastlesLink';
import {
  SevenCastlesPdfStyle,
  downloadSevenCastlesPdf,
} from './sevenCastlesPdfExporter';
import { getHijriDate } from './utils/dateHelpers';
import { cleanTaskGroupLabel } from './utils/taskLabelHelpers';

export interface StudentTasksAudioState {
  isPlaying: boolean;
  isLoading: boolean;
  surahName?: string;
  surahId?: number;
  ayahNumber?: number;
  page?: number;
  currentIndex: number;
  totalAyahs: number;
  playedSeconds: number;
  totalSeconds: number;
  progressPct: number;
  qariId: string;
  qariOptions: { id: string; label: string }[];
  speed: string;
  onTogglePlay: () => void;
  onPrevAyah: () => void;
  onNextAyah: () => void;
  onRestart: () => void;
  onStop: () => void;
  onChangeQari: (qariId: string) => void;
  onChangeSpeed: (speed: string) => void;
}

export interface StudentSevenCastlesTasksPageProps {
  /** خطة الطالب (اختياري: إذا لم تُمرَّر تُقرأ تلقائياً من رابط ?plan=... في المتصفح) */
  plan?: SevenCastlesPlan | null;
  /** سجلات الإنجاز المحفوظة من قاعدة بيانات التطبيق (اختياري: يتوفر حفظ محلي تلقائي عبر localStorage) */
  initialLogs?: ProgressLog[];
  /** استدعاء لحفظ إنجاز الطالب في قاعدة بيانات التطبيق */
  onSaveProgress?: (log: ProgressLog) => Promise<void> | void;
  /** استدعاء عند تأجيل مهام اليوم وتحديث تاريخ البدء */
  onPlanStartDateChange?: (newStartDate: string, plan: SevenCastlesPlan) => Promise<void> | void;
  /**
   * ربط عارض صفحات المصحف الموجود في تطبيقك:
   * يُستدعى عند الضغط على أيقونة المصحف أو زر الاستماع في أي مهمة يومية.
   */
  onOpenMushafPages?: (pages: number[], title: string, verseRanges?: VerseRange[]) => void;
  /** مزامنة حالة الاستماع والآية المتلوة حالياً مع عارض المصحف للتتبع آية بآية */
  onAudioStateChange?: (audioState: StudentTasksAudioState | null) => void;
  /** رابط شعار التطبيق (اختياري) */
  logoUrl?: string;
  /** اسم التطبيق (اختياري) */
  appName?: string;
}

interface AyahAudioItem {
  numberInSurah: number;
  surahNumber: number;
  surahName: string;
  text: string;
  page: number;
}

const QARI_OPTIONS = [
  { id: 'Minshawy_Murattal_128kbps', label: 'المنشاوي', secPerWord: 1.6 },
  { id: 'Husary_128kbps', label: 'الحصري', secPerWord: 1.8 },
  { id: 'Abdul_Basit_Murattal_64kbps', label: 'عبد الباسط', secPerWord: 1.7 },
  { id: 'Ayman_Sowaid_64kbps', label: 'أيمن سويد', secPerWord: 1.9 },
  { id: 'Muhammad_Ayyoub_128kbps', label: 'محمد أيوب', secPerWord: 1.45 },
  { id: 'Ghamadi_40kbps', label: 'الغامدي', secPerWord: 1.3 },
  { id: 'MaherAlMuaiqly128kbps', label: 'المعيقلي', secPerWord: 1.15 },
];

const pageAyahCache = new Map<number, AyahAudioItem[]>();

function normalizeArabicSurah(name: string): string {
  return String(name || '')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/^سورة\s*/i, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '')
    .trim();
}

async function fetchAyahsForTask(task: Task): Promise<AyahAudioItem[]> {
  const pages = task.pages || [];
  if (pages.length === 0) return [];

  const allAyahs: AyahAudioItem[] = [];
  for (const p of pages) {
    let cached = pageAyahCache.get(p);
    if (!cached) {
      const res = await fetch(
        `https://api.alquran.cloud/v1/page/${p}/quran-uthmani`
      );
      if (!res.ok) throw new Error(`Failed to fetch page ${p}`);
      const json = await res.json();
      const rawAyahs = json?.data?.ayahs || [];
      cached = rawAyahs.map((a: any) => ({
        numberInSurah: Number(a.numberInSurah),
        surahNumber: Number(a.surah?.number || 1),
        surahName: String(a.surah?.name || ''),
        text: String(a.text || ''),
        page: p,
      }));
      pageAyahCache.set(p, cached);
    }
    allAyahs.push(...cached);
  }

  if (task.verseRanges && task.verseRanges.length > 0) {
    const filtered = allAyahs.filter((ayah) => {
      const normAyahSurah = normalizeArabicSurah(ayah.surahName);
      return task.verseRanges!.some((vr) => {
        const normRangeSurah = normalizeArabicSurah(vr.surah);
        const matchesSurah =
          normAyahSurah === normRangeSurah ||
          normAyahSurah.includes(normRangeSurah) ||
          normRangeSurah.includes(normAyahSurah);
        return (
          matchesSurah &&
          ayah.numberInSurah >= vr.start &&
          ayah.numberInSurah <= vr.end
        );
      });
    });
    if (filtered.length > 0) return filtered;
  }

  return allAyahs;
}

function getAyahAudioUrl(ayah: AyahAudioItem, qariId: string): string {
  const s = String(ayah.surahNumber).padStart(3, '0');
  const a = String(ayah.numberInSurah).padStart(3, '0');
  return `https://everyayah.com/data/${qariId}/${s}${a}.mp3`;
}

function getTaskColorType(task: Task): string {
  if (task.type === TaskType.MEMORIZATION) return 'memorization';
  if (task.type === TaskType.FIXATION) return 'fixation';
  if (task.type === TaskType.LISTENING) return 'listening';
  if (task.id.startsWith('old-rev') || task.title.includes('القديم')) {
    return 'old_review';
  }
  if (task.id.startsWith('sc-castle-rev') || task.title.includes('القلعة')) {
    return 'castle_review';
  }
  if (
    task.id.startsWith('sc-rev-week') ||
    task.id.startsWith('sc-rec-week') ||
    task.title.includes('مراجعة')
  ) {
    return 'castle_other_review';
  }
  return 'default';
}

function getTaskBorderStyles(task: Task, completed: boolean): string {
  const colorType = getTaskColorType(task);
  if (completed) {
    switch (colorType) {
      case 'memorization':
        return 'bg-emerald-500/5 dark:bg-emerald-500/5 border-emerald-500/25 text-emerald-600 dark:text-emerald-400/80 hover:bg-emerald-500/10';
      case 'fixation':
        return 'bg-amber-500/5 dark:bg-amber-500/5 border-amber-500/25 text-amber-600 dark:text-amber-400/80 hover:bg-amber-500/10';
      case 'old_review':
        return 'bg-amber-900/5 dark:bg-amber-900/10 border-amber-800/25 text-amber-900 dark:text-amber-300/80 hover:bg-amber-900/10';
      case 'castle_review':
        return 'bg-rose-500/5 dark:bg-rose-500/5 border-rose-500/25 text-rose-600 dark:text-rose-400/80 hover:bg-rose-500/10';
      case 'castle_other_review':
        return 'bg-indigo-500/5 dark:bg-indigo-500/5 border-indigo-500/25 text-indigo-600 dark:text-indigo-400/80 hover:bg-indigo-500/10';
      case 'listening':
        return 'bg-yellow-500/5 dark:bg-yellow-500/5 border-yellow-500/25 text-yellow-600 dark:text-yellow-400/80 hover:bg-yellow-500/10';
      default:
        return 'bg-amber-900/5 dark:bg-amber-900/10 border-amber-800/25 text-amber-900 dark:text-amber-300/80 hover:bg-amber-900/10';
    }
  }
  switch (colorType) {
    case 'memorization':
      return 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-[0_3px_10px_-3px_rgba(16,185,129,0.3)] hover:bg-emerald-500/10 active:scale-95';
    case 'fixation':
      return 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-300 shadow-[0_3px_10px_-3px_rgba(245,158,11,0.3)] hover:bg-amber-500/10 active:scale-95';
    case 'old_review':
      return 'bg-amber-900/5 dark:bg-amber-900/10 border-amber-800 text-amber-950 dark:text-amber-200 shadow-[0_3px_10px_-3px_rgba(146,64,14,0.3)] hover:bg-amber-900/10 active:scale-95';
    case 'castle_review':
      return 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500 text-rose-900 dark:text-rose-300 shadow-[0_3px_10px_-3px_rgba(244,63,94,0.3)] hover:bg-rose-500/10 active:scale-95';
    case 'castle_other_review':
      return 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500 text-indigo-900 dark:text-indigo-300 shadow-[0_3px_10px_-3px_rgba(99,102,241,0.3)] hover:bg-indigo-500/10 active:scale-95';
    case 'listening':
      return 'bg-yellow-500/5 dark:bg-yellow-500/10 border-yellow-500 text-yellow-800 dark:text-yellow-300 shadow-[0_3px_10px_-3px_rgba(234,179,8,0.3)] hover:bg-yellow-500/10 active:scale-95';
    default:
      return 'bg-amber-900/5 dark:bg-amber-900/10 border-amber-800 text-amber-950 dark:text-amber-200 shadow-[0_3px_10px_-3px_rgba(146,64,14,0.3)] hover:bg-amber-900/10 active:scale-95';
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function estimateAyahDuration(
  ayah: AyahAudioItem,
  qariId: string,
  speedStr: string
): number {
  const words = ayah.text ? ayah.text.trim().split(/\s+/).length : 6;
  const qari = QARI_OPTIONS.find((q) => q.id === qariId);
  const secPerWord = qari ? qari.secPerWord : 1.6;
  const speed = parseFloat(speedStr) || 1.0;
  return Math.max(2.5, (words * secPerWord) / speed);
}

function getLocalStorageKey(planId: string | number): string {
  return `seven_castles_student_logs_${planId}`;
}

function loadLocalLogs(planId: string | number): Record<string, ProgressLog> {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(planId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalLogs(
  planId: string | number,
  logsMap: Record<string, ProgressLog>
) {
  try {
    localStorage.setItem(getLocalStorageKey(planId), JSON.stringify(logsMap));
  } catch {
    // ignore quota errors
  }
}

/**
 * صفحة المهام اليومية الخاصة بالطالب (مطابقة لصفحة المهام في التطبيق الأصلي لنظام القلاع السبع):
 * - تدعم فتح الرابط المباشر المرسل عبر الواتساب (?plan=...) أو تمرير الخطة من قاعدة البيانات
 * - تحتوي على جميع مهام القلاع السبع: استماع (بمشغل صوتي مدمج)، حفظ، تثبيت بعداد التكرار، مراجعة، تسميع، مراجعة القلاع، ومراجعة المحفوظ القديم
 * - تتكامل مباشرة مع عارض صفحات المصحف الموجود في تطبيقك عبر خاصية onOpenMushafPages
 */
export const StudentSevenCastlesTasksPage: React.FC<
  StudentSevenCastlesTasksPageProps
> = ({
  plan: propPlan,
  initialLogs,
  onSaveProgress,
  onPlanStartDateChange,
  onOpenMushafPages,
  onAudioStateChange,
  logoUrl,
  appName,
}) => {
  // Resolve plan either from prop or from ?plan=<token> in URL
  const initialResolvedPlan = useMemo<SevenCastlesPlan | null>(() => {
    if (propPlan) return propPlan;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('plan');
      if (token) return decodeSevenCastlesPlanToken(token);
    }
    return null;
  }, [propPlan]);

  const [activePlan, setActivePlan] = useState<SevenCastlesPlan | null>(
    initialResolvedPlan
  );

  useEffect(() => {
    setActivePlan(initialResolvedPlan);
  }, [initialResolvedPlan]);

  const planId = activePlan?.id || activePlan?.studentId || 'shared-plan';

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [logsByDate, setLogsByDate] = useState<Record<string, ProgressLog>>(() => {
    const map: Record<string, ProgressLog> = loadLocalLogs(planId);
    if (initialLogs && initialLogs.length > 0) {
      initialLogs.forEach((log) => {
        map[log.date] = log;
      });
    }
    return map;
  });

  useEffect(() => {
    const map: Record<string, ProgressLog> = loadLocalLogs(planId);
    if (initialLogs && initialLogs.length > 0) {
      initialLogs.forEach((log) => {
        map[log.date] = log;
      });
    }
    setLogsByDate(map);
  }, [planId, initialLogs]);

  // Calendar & Postpone modal state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'weeks'>(
    'month'
  );
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponeSuccessMsg, setPostponeSuccessMsg] = useState<string | null>(
    null
  );

  // Student PDF export state
  const [pdfExportState, setPdfExportState] = useState<{
    style: SevenCastlesPdfStyle;
    message: string;
    step: number;
    total: number;
  } | null>(null);
  const [pdfExportFeedback, setPdfExportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleExportPlanPdf = async (style: SevenCastlesPdfStyle) => {
    if (!activePlan || pdfExportState) return;
    setPdfExportFeedback(null);
    setPdfExportState({
      style,
      message:
        style === 'castle_towers'
          ? 'جاري تجهيز ملف الأبراج (PDF)...'
          : 'جاري تجهيز الجدول العادي (PDF)...',
      step: 0,
      total: 1,
    });

    try {
      const resolvedLogo =
        logoUrl && logoUrl.startsWith('/') && typeof window !== 'undefined'
          ? `${window.location.origin}${logoUrl}`
          : logoUrl;

      await downloadSevenCastlesPdf(activePlan, {
        style,
        logoUrl: resolvedLogo,
        appName,
        onProgress: (message, currentStep, totalSteps) => {
          setPdfExportState({
            style,
            message,
            step: currentStep,
            total: totalSteps,
          });
        },
      });
      setPdfExportFeedback({
        type: 'success',
        message:
          style === 'castle_towers'
            ? 'تم تحميل خطة الأبراج (PDF) بنجاح'
            : 'تم تحميل الجدول العادي للخطة (PDF) بنجاح',
      });
      setTimeout(() => setPdfExportFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to export student Seven Castles PDF:', err);
      setPdfExportFeedback({
        type: 'error',
        message: 'حدث خطأ أثناء تصدير ملف الـ PDF، يرجى المحاولة مجدداً',
      });
      setTimeout(() => setPdfExportFeedback(null), 4500);
    } finally {
      setPdfExportState(null);
    }
  };

  // Built-in Quran audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingTaskId, setPlayingTaskId] = useState<string | null>(null);
  const [activeAyahs, setActiveAyahs] = useState<AyahAudioItem[]>([]);
  const [playingAyahIndex, setPlayingAyahIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [showAudioControls, setShowAudioControls] = useState(true);
  const [currentQari, setCurrentQari] = useState<string>(() => {
    try {
      return localStorage.getItem('quran_qari') || 'Minshawy_Murattal_128kbps';
    } catch {
      return 'Minshawy_Murattal_128kbps';
    }
  });
  const [currentSpeed, setCurrentSpeed] = useState<string>(() => {
    try {
      return localStorage.getItem('quran_speed') || '1.0';
    } catch {
      return '1.0';
    }
  });

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const playAyahAtIndex = (
    ayahs: AyahAudioItem[],
    index: number,
    qari: string,
    speed: string
  ) => {
    if (!ayahs[index]) {
      setIsPlaying(false);
      setPlayingTaskId(null);
      setAudioProgress(0);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.pause();
    audio.src = getAyahAudioUrl(ayahs[index], qari);
    audio.playbackRate = parseFloat(speed) || 1.0;

    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    audio.onended = () => {
      if (index + 1 < ayahs.length) {
        setPlayingAyahIndex(index + 1);
        setAudioProgress(0);
        playAyahAtIndex(ayahs, index + 1, qari, speed);
      } else {
        setIsPlaying(false);
        setAudioProgress(100);
      }
    };
    audio.onerror = () => {
      setIsPlaying(false);
    };

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const handlePlayListeningTask = async (task: Task, displayTitle?: string) => {
    const taskPages = task.pages || [];
    const openMushafForListening = () => {
      if (onOpenMushafPages && taskPages.length > 0) {
        onOpenMushafPages(taskPages, displayTitle || task.title, task.verseRanges);
      }
    };

    if (playingTaskId === task.id) {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          openMushafForListening();
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }
      return;
    }

    // افتح صفحة المصحف تلقائياً لمتابعة الآيات المتلوة آية بآية
    openMushafForListening();

    setPlayingTaskId(task.id);
    setIsLoadingAudio(true);
    setAudioProgress(0);
    try {
      const ayahs = await fetchAyahsForTask(task);
      setActiveAyahs(ayahs);
      setPlayingAyahIndex(0);
      setIsLoadingAudio(false);
      if (ayahs.length > 0) {
        playAyahAtIndex(ayahs, 0, currentQari, currentSpeed);
      }
    } catch (err) {
      console.error('Failed to load ayahs audio:', err);
      setIsLoadingAudio(false);
      setPlayingTaskId(null);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setIsPlaying(false);
    setPlayingTaskId(null);
    setActiveAyahs([]);
    setPlayingAyahIndex(0);
    setAudioProgress(0);
  };

  const handleChangeQari = (newQari: string) => {
    setCurrentQari(newQari);
    try {
      localStorage.setItem('quran_qari', newQari);
    } catch {}
    if (playingTaskId && activeAyahs.length > 0) {
      playAyahAtIndex(activeAyahs, playingAyahIndex, newQari, currentSpeed);
    }
  };

  const handleChangeSpeed = (newSpeed: string) => {
    setCurrentSpeed(newSpeed);
    try {
      localStorage.setItem('quran_speed', newSpeed);
    } catch {}
    if (audioRef.current) {
      audioRef.current.playbackRate = parseFloat(newSpeed) || 1.0;
    }
  };

  const safeAyahIndex = Math.min(
    playingAyahIndex,
    Math.max(0, activeAyahs.length - 1)
  );
  const currentAyahObj = activeAyahs[safeAyahIndex];

  const { playedSeconds, totalSeconds } = useMemo(() => {
    let total = 0;
    let played = 0;
    activeAyahs.forEach((ayah, idx) => {
      const dur = estimateAyahDuration(ayah, currentQari, currentSpeed);
      total += dur;
      if (idx < playingAyahIndex) played += dur;
      else if (idx === playingAyahIndex) played += (audioProgress / 100) * dur;
    });
    return { playedSeconds: played, totalSeconds: total };
  }, [activeAyahs, playingAyahIndex, audioProgress, currentQari, currentSpeed]);

  const overallAudioPct =
    totalSeconds > 0 ? Math.min(100, (playedSeconds / totalSeconds) * 100) : 0;

  // مزامنة حالة التلاوة الحية مع عارض المصحف لتظليل الآية المتلوة حالياً
  useEffect(() => {
    if (!onAudioStateChange) return;
    if (!playingTaskId) {
      onAudioStateChange(null);
      return;
    }
    onAudioStateChange({
      isPlaying,
      isLoading: isLoadingAudio,
      surahName: currentAyahObj?.surahName,
      surahId: currentAyahObj?.surahNumber,
      ayahNumber: currentAyahObj?.numberInSurah,
      page: currentAyahObj?.page,
      currentIndex: safeAyahIndex,
      totalAyahs: activeAyahs.length,
      playedSeconds,
      totalSeconds,
      progressPct: overallAudioPct,
      qariId: currentQari,
      qariOptions: QARI_OPTIONS.map((q) => ({ id: q.id, label: q.label })),
      speed: currentSpeed,
      onTogglePlay: () => {
        if (!audioRef.current) return;
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      },
      onPrevAyah: () => {
        if (playingAyahIndex > 0) {
          const prev = playingAyahIndex - 1;
          setPlayingAyahIndex(prev);
          playAyahAtIndex(activeAyahs, prev, currentQari, currentSpeed);
        }
      },
      onNextAyah: () => {
        if (playingAyahIndex < activeAyahs.length - 1) {
          const next = playingAyahIndex + 1;
          setPlayingAyahIndex(next);
          playAyahAtIndex(activeAyahs, next, currentQari, currentSpeed);
        }
      },
      onRestart: () => {
        if (activeAyahs.length > 0) {
          setPlayingAyahIndex(0);
          playAyahAtIndex(activeAyahs, 0, currentQari, currentSpeed);
        }
      },
      onStop: stopAudio,
      onChangeQari: handleChangeQari,
      onChangeSpeed: handleChangeSpeed,
    });
  }, [
    onAudioStateChange,
    playingTaskId,
    isPlaying,
    isLoadingAudio,
    currentAyahObj?.surahName,
    currentAyahObj?.surahNumber,
    currentAyahObj?.numberInSurah,
    currentAyahObj?.page,
    safeAyahIndex,
    activeAyahs,
    playedSeconds,
    totalSeconds,
    overallAudioPct,
    currentQari,
    currentSpeed,
    playingAyahIndex,
  ]);

  useEffect(() => {
    return () => {
      onAudioStateChange?.(null);
    };
  }, [onAudioStateChange]);

  // All plan dates for the calendar view
  const planDates = useMemo(() => {
    if (!activePlan) return [];
    const totalDays = getSevenCastlesDurationWeeks(activePlan) * 7;
    const start = parsePlanDate(activePlan.startDate);
    const dates: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      dates.push(addDays(start, i));
    }
    return dates;
  }, [activePlan]);

  const planWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < planDates.length; i += 7) {
      weeks.push(planDates.slice(i, i + 7));
    }
    return weeks;
  }, [planDates]);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const todayStart = startOfDay(new Date());
  const selectedStart = startOfDay(selectedDate);
  const isTodaySelected = isSameDay(selectedStart, todayStart);
  const isYesterday = isSameDay(selectedStart, subDays(todayStart, 1));
  const isEditable = isTodaySelected || isYesterday;

  const existingLogForDay = logsByDate[selectedDateStr];
  const isPostponedDay = existingLogForDay?.note === 'postponed';

  const currentTasks = useMemo<Task[]>(() => {
    if (!activePlan) return [];
    if (isPostponedDay) return [];
    const generated = getSevenCastlesTasksForDate(selectedDate, activePlan);
    if (!existingLogForDay || !existingLogForDay.tasks) return generated;
    return generated.map((gTask) => {
      const saved = existingLogForDay.tasks.find((s) => s.id === gTask.id);
      if (!saved) return gTask;
      return {
        ...gTask,
        completed: saved.completed,
        currentCount: saved.currentCount,
      };
    });
  }, [activePlan, selectedDate, existingLogForDay, isPostponedDay]);

  const persistDayLog = (updatedTasks: Task[], note?: string) => {
    const newLog: ProgressLog = {
      planId,
      date: selectedDateStr,
      tasks: updatedTasks,
      ...(note !== undefined ? { note } : {}),
    };
    const nextMap = { ...logsByDate, [selectedDateStr]: newLog };
    setLogsByDate(nextMap);
    saveLocalLogs(planId, nextMap);
    Promise.resolve(onSaveProgress?.(newLog)).catch((err) =>
      console.error('onSaveProgress error:', err)
    );
  };

  const toggleTask = (taskId: string) => {
    if (!isEditable) return;
    const updated = currentTasks.map((t) => {
      if (t.id !== taskId) return t;
      if (t.completed) return t;
      const nextCount =
        t.currentCount < t.targetCount ? t.currentCount + 1 : t.currentCount;
      return {
        ...t,
        currentCount: nextCount,
        completed: nextCount >= t.targetCount,
      };
    });
    persistDayLog(updated);
  };

  const forceToggleCompletion = (taskId: string) => {
    if (!isEditable) return;
    const updated = currentTasks.map((t) => {
      if (t.id !== taskId) return t;
      const nextCompleted = !t.completed;
      return {
        ...t,
        completed: nextCompleted,
        currentCount: nextCompleted ? t.targetCount : 0,
      };
    });
    persistDayLog(updated);
  };

  const handlePostponeToday = () => {
    if (!activePlan) return;
    const nextStartStr = format(
      addDays(parsePlanDate(activePlan.startDate), 1),
      'yyyy-MM-dd'
    );
    const updatedPlan: SevenCastlesPlan = {
      ...activePlan,
      startDate: nextStartStr,
      updatedAt: new Date().toISOString(),
    };
    persistDayLog([], 'postponed');
    setActivePlan(updatedPlan);
    setShowPostponeModal(false);
    Promise.resolve(onPlanStartDateChange?.(nextStartStr, updatedPlan)).catch(
      () => {}
    );
    setPostponeSuccessMsg('تم تأجيل مهام هذا اليوم وزحزحة الجدول يوماً واحداً بنجاح.');
    setTimeout(() => setPostponeSuccessMsg(null), 4000);
  };

  const handleUndoPostpone = () => {
    if (!activePlan) return;
    const prevStartStr = format(
      subDays(parsePlanDate(activePlan.startDate), 1),
      'yyyy-MM-dd'
    );
    const updatedPlan: SevenCastlesPlan = {
      ...activePlan,
      startDate: prevStartStr,
      updatedAt: new Date().toISOString(),
    };
    const nextMap = { ...logsByDate };
    delete nextMap[selectedDateStr];
    setLogsByDate(nextMap);
    saveLocalLogs(planId, nextMap);
    setActivePlan(updatedPlan);
    Promise.resolve(onPlanStartDateChange?.(prevStartStr, updatedPlan)).catch(
      () => {}
    );
    setPostponeSuccessMsg('تم إلغاء التأجيل وإعادة الجدول الأصلي.');
    setTimeout(() => setPostponeSuccessMsg(null), 4000);
  };

  if (!activePlan) {
    return (
      <div
        dir="rtl"
        className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8"
      >
        <div className="bg-gray-100 dark:bg-white/5 p-6 rounded-3xl mb-4">
          <Calendar className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold mb-2 dark:text-white">
          لم يتم العثور على خطة القلاع السبع
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
          تأكد من فتح الرابط الصحيح المرسل من المشرف لعرض مهامك اليومية.
        </p>
      </div>
    );
  }

  const completedCount = currentTasks.filter((t) => t.completed).length;
  const completionRate =
    currentTasks.length > 0 ? (completedCount / currentTasks.length) * 100 : 0;

  // Group tasks sharing the same pages & cleaned verse portion
  const groupedTasks: {
    key: string;
    label: string;
    pages: number[] | undefined;
    tasks: Task[];
  }[] = [];

  currentTasks.forEach((task) => {
    const partMatch = task.id.match(/-part\d+/);
    const partSuffix = partMatch ? partMatch[0] : '';
    const initialLabel = cleanTaskGroupLabel(task.title);
    const key =
      task.pages && task.pages.length > 0
        ? 'group-' + task.pages.join(',') + '-' + initialLabel + partSuffix
        : `task-${task.id}`;

    let group = groupedTasks.find((g) => g.key === key);
    if (!group) {
      group = { key, label: initialLabel, pages: task.pages, tasks: [] };
      groupedTasks.push(group);
    }
    group.tasks.push(task);
  });

  const currentQariLabel =
    QARI_OPTIONS.find((q) => q.id === currentQari)?.label || 'القارئ';

  const renderAudioPanel = () => (
    <div className="w-full mt-2.5 select-none">
      {showAudioControls ? (
        <div className="flex flex-col gap-2.5 bg-amber-50/90 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-200/70 dark:border-amber-900/30 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-start gap-1.5 min-w-0 flex-1">
              <Volume2 className="w-4 h-4 text-amber-600 animate-pulse shrink-0 mt-0.5" />
              <div className="min-w-0 leading-snug">
                <span className="break-words">
                  {currentAyahObj
                    ? `${currentAyahObj.surahName}: الآية ${currentAyahObj.numberInSurah} (${safeAyahIndex + 1} من ${activeAyahs.length})`
                    : 'جاري تحميل التلاوة...'}
                </span>
                <span className="block sm:inline sm:mr-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                  ({currentQariLabel} • {currentSpeed}x)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAudioControls(false);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 cursor-pointer"
                title="تصغير لوحة الصوت"
              >
                <EyeOff className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stopAudio();
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 cursor-pointer"
                title="إغلاق الصوت"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {activeAyahs.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-teal-600 font-mono">
                {formatDuration(playedSeconds)}
              </span>
              <div className="flex-1 h-2 bg-teal-100 dark:bg-teal-950/40 rounded-full overflow-hidden relative">
                <div
                  className="absolute top-0 bottom-0 right-0 bg-teal-600 rounded-full transition-all duration-150"
                  style={{ width: `${overallAudioPct}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-500 font-mono">
                {formatDuration(totalSeconds)}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-amber-200/40 pt-2">
            <div className="flex items-center justify-center sm:justify-start gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (playingAyahIndex > 0) {
                    const prev = playingAyahIndex - 1;
                    setPlayingAyahIndex(prev);
                    playAyahAtIndex(activeAyahs, prev, currentQari, currentSpeed);
                  }
                }}
                disabled={playingAyahIndex === 0}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl bg-amber-100/80 dark:bg-amber-900/25 text-amber-700 disabled:opacity-40 cursor-pointer"
                title="الآية السابقة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!audioRef.current) return;
                  if (isPlaying) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  } else {
                    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                  }
                }}
                className="min-w-[40px] min-h-[36px] flex items-center justify-center rounded-xl bg-amber-200/80 dark:bg-amber-900/45 text-amber-900 dark:text-amber-100 cursor-pointer"
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stopAudio();
                }}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-amber-200 text-amber-700 cursor-pointer"
                title="إيقاف"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPlayingAyahIndex(0);
                  playAyahAtIndex(activeAyahs, 0, currentQari, currentSpeed);
                }}
                className="min-h-[36px] px-2.5 py-1 rounded-xl bg-amber-100/80 dark:bg-amber-900/25 text-amber-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                title="إعادة من البداية"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (playingAyahIndex < activeAyahs.length - 1) {
                    const next = playingAyahIndex + 1;
                    setPlayingAyahIndex(next);
                    playAyahAtIndex(activeAyahs, next, currentQari, currentSpeed);
                  }
                }}
                disabled={playingAyahIndex >= activeAyahs.length - 1}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl bg-amber-100/80 dark:bg-amber-900/25 text-amber-700 disabled:opacity-40 cursor-pointer"
                title="الآية التالية"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none inline-flex items-center">
                <select
                  aria-label="اختيار القارئ"
                  value={currentQari}
                  onChange={(e) => handleChangeQari(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="appearance-none bg-none w-full min-h-[34px] text-[11px] sm:text-xs leading-tight font-bold bg-white dark:bg-[#151515] border border-amber-200/70 dark:border-amber-900/30 rounded-xl py-1 pr-2.5 pl-6 outline-none text-gray-800 dark:text-gray-200 cursor-pointer"
                >
                  {QARI_OPTIONS.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 pointer-events-none absolute left-2" />
              </div>
              <div className="relative inline-flex items-center shrink-0">
                <select
                  aria-label="سرعة التلاوة"
                  value={currentSpeed}
                  onChange={(e) => handleChangeSpeed(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="appearance-none bg-none min-w-[64px] min-h-[34px] text-[11px] sm:text-xs leading-tight font-bold bg-white dark:bg-[#151515] border border-amber-200/70 dark:border-amber-900/30 rounded-xl py-1 pr-2.5 pl-6 outline-none text-gray-800 dark:text-gray-200 cursor-pointer"
                >
                  {['1.0', '1.2', '1.4', '1.5', '1.6', '1.8', '2.0'].map((s) => (
                    <option key={s} value={s}>
                      {s}x
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 pointer-events-none absolute left-2" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 bg-amber-50/80 dark:bg-amber-950/15 px-3 py-2 rounded-xl border border-amber-100 dark:border-amber-900/20">
          <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping shrink-0" />
            <span className="truncate">
              الآية {currentAyahObj?.numberInSurah} ({safeAyahIndex + 1}/
              {activeAyahs.length}) • {currentQariLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAudioControls(true);
            }}
            className="w-8 h-8 flex items-center justify-center text-teal-600 hover:bg-amber-100 rounded-lg shrink-0 cursor-pointer"
            title="إظهار لوحة التحكم"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div dir="rtl" className="w-full max-w-2xl mx-auto px-2.5 sm:px-4 pt-3 pb-8 sm:py-5 space-y-3.5 sm:space-y-4 overflow-x-hidden box-border">
      {/* Student Header Card */}
      <div className="bg-gradient-to-l from-[#1A2E1A] to-emerald-900 text-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-md space-y-3">
        <div className="flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={appName || 'شعار التطبيق'}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white p-1 object-contain shrink-0"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-[#F7E7A9]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] sm:text-[11px] text-[#F7E7A9] font-bold truncate">
                خطة القلاع السبع {appName ? `• ${appName}` : ''}
              </div>
              <h1 className="text-sm sm:text-lg font-extrabold leading-snug line-clamp-2">
                الطالب: {activePlan.studentName}
              </h1>
              <div className="text-[11px] text-emerald-100/85 truncate">
                المقدار اليومي: {DAILY_AMOUNT_LABELS[activePlan.dailyAmount]}
              </div>
            </div>
          </div>
          <div className="text-center shrink-0 bg-white/10 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl border border-white/15">
            <div className="text-[9px] sm:text-[10px] text-emerald-100 whitespace-nowrap">إنجاز اليوم</div>
            <div className="text-sm sm:text-base font-extrabold text-[#F7E7A9]">
              {Math.round(completionRate)}%
            </div>
          </div>
        </div>

        {/* Export Plan PDF Actions (Standard & Castle Towers) */}
        <div className="pt-2.5 border-t border-white/15 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!!pdfExportState}
            onClick={() => handleExportPlanPdf('standard')}
            className="min-h-[40px] px-2 sm:px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-50 border border-white/20 text-white text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            {pdfExportState?.style === 'standard' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F7E7A9] shrink-0" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-[#F7E7A9] shrink-0" />
            )}
            <span className="leading-tight text-center">تصدير PDF (العادي)</span>
          </button>

          <button
            type="button"
            disabled={!!pdfExportState}
            onClick={() => handleExportPlanPdf('castle_towers')}
            className="min-h-[40px] px-2 sm:px-3 py-2 rounded-xl bg-[#D4AF37] hover:bg-amber-400 disabled:opacity-50 text-[#1A2E1A] text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            {pdfExportState?.style === 'castle_towers' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Download className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="leading-tight text-center">تصدير PDF (الأبراج)</span>
          </button>
        </div>

        {/* Live PDF Export Progress */}
        {pdfExportState && (
          <div className="bg-black/25 rounded-xl p-2.5 space-y-1.5 border border-white/10">
            <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-[#F7E7A9]">
              <span className="truncate">{pdfExportState.message}</span>
              {pdfExportState.total > 1 && (
                <span className="shrink-0 font-mono">
                  {pdfExportState.step}/{pdfExportState.total}
                </span>
              )}
            </div>
            <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#D4AF37] rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((pdfExportState.step / Math.max(1, pdfExportState.total)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {pdfExportFeedback && (
          <div
            className={`rounded-xl px-3 py-2 text-[11px] font-extrabold text-center ${
              pdfExportFeedback.type === 'success'
                ? 'bg-emerald-500/25 border border-emerald-300/40 text-emerald-100'
                : 'bg-rose-500/25 border border-rose-300/40 text-rose-100'
            }`}
          >
            {pdfExportFeedback.message}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {currentTasks.length > 0 && (
        <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600 rounded-full transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      )}

      {/* Date Navigation */}
      <div className="flex items-center justify-between gap-1 bg-white dark:bg-[#1A1A1A] px-1.5 sm:px-2 py-2 rounded-2xl border border-[#1A2E1A]/5 dark:border-white/5 shadow-sm">
        <button
          type="button"
          onClick={() => setSelectedDate(subDays(selectedDate, 1))}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors active:scale-95 shrink-0 cursor-pointer"
          title="اليوم السابق"
        >
          <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        <div className="flex-1 min-w-0 flex flex-col items-center">
          <button
            type="button"
            onClick={() => {
              setCalendarMonth(selectedDate);
              setIsCalendarOpen(true);
            }}
            className="w-full max-w-[260px] text-center cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/20 px-2.5 sm:px-5 py-1.5 rounded-xl transition-all flex flex-col items-center gap-0.5"
            title="عرض تقويم الخطة"
          >
            <div className="text-sm font-bold text-[#1A2E1A] dark:text-white flex items-center justify-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <span>{format(selectedDate, 'EEEE', { locale: ar })}</span>
            </div>
            <div className="text-[11px] text-amber-600 dark:text-[#D4AF37] font-bold">
              {getHijriDate(selectedDate)}
            </div>
            <div className="text-[10px] text-gray-400 font-medium">
              {format(selectedDate, 'd MMMM yyyy', { locale: ar })}
            </div>
          </button>
          {!isTodaySelected && (
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className="mt-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold border border-emerald-200/70 dark:border-emerald-800/50 cursor-pointer"
            >
              العودة لليوم
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors active:scale-95 shrink-0 cursor-pointer"
          title="اليوم التالي"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Postpone Toast */}
      {postponeSuccessMsg && (
        <div className="bg-emerald-600 text-white p-3 rounded-2xl text-xs font-bold shadow flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{postponeSuccessMsg}</span>
        </div>
      )}

      {/* Postponed Day Banner */}
      {isPostponedDay && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-4 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>تم تأجيل مهام هذا اليوم إلى الغد</span>
          </div>
          <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
            تمت زحزحة جدول جميع الأيام القادمة يوماً واحداً إلى الأمام بنجاح.
          </p>
          <button
            type="button"
            onClick={handleUndoPostpone}
            className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إلغاء التأجيل (استرجاع جدول اليوم الأصلي)</span>
          </button>
        </div>
      )}

      {/* Yesterday / Read-only Banners */}
      {isYesterday && !isPostponedDay && (
        <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/25 p-3 rounded-2xl flex items-center justify-center gap-2">
          <Info className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
            يوم تعويض: يمكنك تسجيل وتعديل مهام الأمس الفائتة لتعويضها.
          </span>
        </div>
      )}
      {!isEditable && !isPostponedDay && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-3 rounded-2xl flex items-center justify-center gap-2">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            عرض للاطلاع فقط (يمكن تسجيل الإنجاز لمهام اليوم وأمس فقط)
          </span>
        </div>
      )}

      {/* Tasks Header & Postpone Button */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h3 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400">
            المهام اليومية ({completedCount}/{currentTasks.length})
          </h3>
          {isEditable && !isPostponedDay && currentTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPostponeModal(true)}
              className="flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-xl border border-amber-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>تأجيل مهام اليوم</span>
            </button>
          )}
        </div>

        {/* Grouped & Single Tasks */}
        {groupedTasks.length > 0 ? (
          groupedTasks.map((group) => {
            const isSingleTask = group.tasks.length === 1;
            const listeningTask = group.tasks.find(
              (t) => t.type === TaskType.LISTENING
            );
            const isGroupPlaying = group.tasks.some(
              (t) => playingTaskId === t.id
            );
            const groupVerseRanges = group.tasks.find(
              (t) => t.verseRanges && t.verseRanges.length > 0
            )?.verseRanges;

            if (isSingleTask) {
              const task = group.tasks[0];
              const isTaskPlaying = playingTaskId === task.id;
              return (
                <div key={group.key} className="flex flex-col gap-1.5">
                  <div
                    onClick={() => {
                      if (isEditable) toggleTask(task.id);
                    }}
                    className={clsx(
                      'flex items-center gap-2.5 sm:gap-3 px-3 py-3 rounded-2xl border-2 transition-all duration-200 select-none',
                      isEditable
                        ? 'cursor-pointer active:scale-[0.99]'
                        : 'cursor-default opacity-60',
                      getTaskBorderStyles(task, task.completed)
                    )}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isEditable) forceToggleCompletion(task.id);
                      }}
                      className="shrink-0 flex items-center justify-center cursor-pointer w-8 h-8 -mr-1 rounded-full hover:bg-black/5"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-current" />
                      ) : (
                        <div className="relative flex items-center justify-center w-5 h-5">
                          <Circle className="w-5 h-5 text-current opacity-60" />
                          {task.targetCount > 1 && (
                            <span className="absolute text-[8px] font-bold">
                              {task.currentCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4
                        className={clsx(
                          'text-xs sm:text-sm font-bold dark:text-white leading-relaxed break-words whitespace-pre-wrap',
                          task.completed && 'line-through text-gray-400'
                        )}
                      >
                        {task.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.targetCount > 1 && (
                        <span
                          className={clsx(
                            'text-[10px] font-mono font-bold px-2 py-1 rounded-lg',
                            task.completed
                              ? 'text-emerald-700 bg-emerald-100/80'
                              : 'text-amber-700 bg-amber-100/80'
                          )}
                        >
                          {task.currentCount}/{task.targetCount}
                        </span>
                      )}

                      {task.type === TaskType.LISTENING &&
                        group.pages &&
                        group.pages.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayListeningTask(task);
                            }}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/25 text-amber-600 border border-amber-200/70 dark:border-amber-800/40 hover:bg-amber-100 transition-colors active:scale-95 cursor-pointer"
                            title="الاستماع للآيات"
                          >
                            {isTaskPlaying && isLoadingAudio ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isTaskPlaying && isPlaying ? (
                              <Pause className="w-4 h-4 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 fill-current" />
                            )}
                          </button>
                        )}

                      {onOpenMushafPages &&
                        group.pages &&
                        group.pages.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenMushafPages(group.pages!, task.title, task.verseRanges);
                            }}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/40 hover:bg-emerald-100 transition-colors active:scale-95 cursor-pointer"
                            title="عرض الصفحات من المصحف"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                        )}
                    </div>
                  </div>
                  {isTaskPlaying && renderAudioPanel()}
                </div>
              );
            }

            // Multi-task group card (e.g., استماع + حفظ + تثبيت for the same portion)
            const sortedGroupTasks = [...group.tasks].sort((a, b) => {
              const order = (type: TaskType) => {
                if (type === TaskType.LISTENING) return 1;
                if (type === TaskType.MEMORIZATION) return 2;
                if (type === TaskType.FIXATION) return 3;
                if (type === TaskType.REVIEW) return 4;
                if (type === TaskType.RECITATION) return 5;
                return 6;
              };
              return order(a.type) - order(b.type);
            });

            const gridColsClass =
              sortedGroupTasks.length === 2
                ? 'grid-cols-2'
                : sortedGroupTasks.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-4';

            return (
              <div
                key={group.key}
                className={clsx(
                  'bg-white dark:bg-[#1A1A1A] p-3 sm:p-3.5 rounded-2xl sm:rounded-3xl border border-[#1A2E1A]/10 dark:border-white/10 shadow-sm transition-colors',
                  group.tasks.every((t) => t.completed) &&
                    'opacity-70 bg-[#1A2E1A]/5 dark:bg-[#D4AF37]/5 border-transparent'
                )}
              >
                <div className="flex items-start justify-between gap-2 px-0.5 mb-2.5">
                  <h4
                    className={clsx(
                      'text-xs sm:text-sm font-bold dark:text-white leading-relaxed break-words min-w-0 flex-1',
                      group.tasks.every((t) => t.completed) &&
                        'line-through text-gray-400'
                    )}
                  >
                    {group.label}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {listeningTask &&
                      group.pages &&
                      group.pages.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayListeningTask(listeningTask, group.label);
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/25 text-amber-600 border border-amber-200/70 dark:border-amber-800/40 hover:bg-amber-100 transition-colors active:scale-95 cursor-pointer"
                          title="الاستماع للآيات"
                        >
                          {playingTaskId === listeningTask.id &&
                          isLoadingAudio ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : playingTaskId === listeningTask.id &&
                            isPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                        </button>
                      )}
                    {onOpenMushafPages &&
                      group.pages &&
                      group.pages.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenMushafPages(group.pages!, group.label, groupVerseRanges);
                          }}
                          className="h-9 px-2.5 flex items-center justify-center gap-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/40 hover:bg-emerald-100 transition-colors active:scale-95 cursor-pointer text-[11px] font-extrabold"
                          title="عرض الصفحات من المصحف"
                        >
                          <BookOpen className="w-4 h-4 shrink-0" />
                          <span className="hidden xs:inline sm:inline">المصحف</span>
                        </button>
                      )}
                  </div>
                </div>

                <div className={`grid ${gridColsClass} gap-2`}>
                  {sortedGroupTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => {
                        if (isEditable) toggleTask(task.id);
                      }}
                      className={clsx(
                        'relative flex flex-col items-center justify-center gap-1 min-h-[66px] py-2 px-1.5 sm:px-2 rounded-xl border-2 transition-all duration-200 select-none',
                        isEditable
                          ? 'cursor-pointer active:scale-95'
                          : 'cursor-default opacity-60',
                        getTaskBorderStyles(task, task.completed)
                      )}
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isEditable) forceToggleCompletion(task.id);
                        }}
                        className="relative flex items-center justify-center cursor-pointer p-1 -m-1 rounded-full hover:bg-black/5"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-current shrink-0" />
                        ) : (
                          <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                            <Circle className="w-5 h-5 text-current opacity-60" />
                            {task.targetCount > 1 && (
                              <span className="absolute text-[7px] font-bold">
                                {task.currentCount}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span
                        className={clsx(
                          'text-[11px] font-bold text-center whitespace-nowrap',
                          task.completed && 'opacity-70 line-through'
                        )}
                      >
                        {task.type === TaskType.MEMORIZATION
                          ? 'حفظ'
                          : task.type === TaskType.FIXATION
                            ? 'تثبيت'
                            : task.type === TaskType.REVIEW
                              ? 'مراجعة'
                              : task.type === TaskType.LISTENING
                                ? 'استماع'
                                : 'تسميع'}
                      </span>
                      {task.targetCount > 1 && (
                        <span className="text-[10px] font-mono font-extrabold bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-md">
                          {task.currentCount}/{task.targetCount}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {isGroupPlaying && renderAudioPanel()}
              </div>
            );
          })
        ) : !isPostponedDay ? (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center border border-gray-100 dark:border-white/5">
            <div className="text-2xl mb-2">🌸</div>
            <div className="text-sm font-bold text-gray-700 dark:text-gray-200">
              لا توجد مهام مجدولة في هذا اليوم
            </div>
            <p className="text-xs text-gray-400 mt-1">
              اضغط على التاريخ بالأعلى لعرض جدول الخطة الكامل والتنقل بين أيامها.
            </p>
          </div>
        ) : null}
      </div>

      {/* Postpone Modal */}
      {showPostponeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-xl border border-gray-100 dark:border-white/10">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-extrabold text-sm">
              <Clock className="w-5 h-5" />
              <span>تأجيل مهام اليوم</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              هل تريد تأجيل مهام هذا اليوم إلى الغد؟ ستتم زحزحة جدول الأيام القادمة
              يوماً واحداً تلقائياً، ويمكنك التراجع لاحقاً في أي وقت.
            </p>
            <div className="flex items-center gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowPostponeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handlePostponeToday}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700"
              >
                تأكيد التأجيل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {isCalendarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4"
          onClick={() => setIsCalendarOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-3.5 sm:p-5 max-w-md w-full max-h-[88dvh] overflow-y-auto space-y-3.5 shadow-xl border border-gray-100 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#1A2E1A] dark:text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#D4AF37]" />
                <span>تقويم خطة القلاع السبع</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCalendarOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setCalendarViewMode('month')}
                className={`flex-1 min-h-[36px] py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  calendarViewMode === 'month'
                    ? 'bg-[#1A2E1A] dark:bg-[#D4AF37] text-white dark:text-[#1A1A1A]'
                    : 'text-gray-500'
                }`}
              >
                عرض شهري
              </button>
              <button
                type="button"
                onClick={() => setCalendarViewMode('weeks')}
                className={`flex-1 min-h-[36px] py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  calendarViewMode === 'weeks'
                    ? 'bg-[#1A2E1A] dark:bg-[#D4AF37] text-white dark:text-[#1A1A1A]'
                    : 'text-gray-500'
                }`}
              >
                أسابيع الخطة ({planWeeks.length})
              </button>
            </div>

            {calendarViewMode === 'month' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs sm:text-sm font-extrabold dark:text-white">
                    {format(calendarMonth, 'MMMM yyyy', { locale: ar })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400">
                  {['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map(
                    (d) => (
                      <div key={d} className="truncate">{d}</div>
                    )
                  )}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const monthStart = startOfMonth(calendarMonth);
                    const monthEnd = endOfMonth(calendarMonth);
                    const padStart = monthStart.getDay();
                    const days = eachDayOfInterval({
                      start: monthStart,
                      end: monthEnd,
                    });
                    const cells: (Date | null)[] = [
                      ...Array(padStart).fill(null),
                      ...days,
                    ];
                    return cells.map((day, idx) => {
                      if (!day) return <div key={`pad-${idx}`} />;
                      const dStr = format(day, 'yyyy-MM-dd');
                      const log = logsByDate[dStr];
                      const allDone =
                        log &&
                        log.tasks.length > 0 &&
                        log.tasks.every((t) => t.completed);
                      const inPlan = planDates.some((pd) => isSameDay(pd, day));
                      const selected = isSameDay(day, selectedDate);
                      return (
                        <button
                          type="button"
                          key={dStr}
                          onClick={() => {
                            setSelectedDate(day);
                            setIsCalendarOpen(false);
                          }}
                          className={clsx(
                            'min-h-[40px] rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer',
                            selected
                              ? 'bg-[#1A2E1A] dark:bg-[#D4AF37] text-white dark:text-[#1A1A1A]'
                              : allDone
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : inPlan
                                  ? 'bg-amber-50/70 dark:bg-white/5 text-gray-800 dark:text-gray-200'
                                  : 'text-gray-400',
                            isToday(day) && !selected && 'ring-2 ring-emerald-500',
                            !isSameMonth(day, calendarMonth) && 'opacity-30'
                          )}
                        >
                          <span>{format(day, 'd')}</span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[55dvh] overflow-y-auto pr-0.5">
                {planWeeks.map((week, wIdx) => (
                  <div
                    key={wIdx}
                    className="p-2 sm:p-2.5 rounded-2xl bg-gray-50 dark:bg-white/5 space-y-1.5"
                  >
                    <div className="text-[11px] font-extrabold text-[#1A2E1A] dark:text-[#D4AF37]">
                      الأسبوع {wIdx + 1}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {week.map((day) => {
                        const dStr = format(day, 'yyyy-MM-dd');
                        const log = logsByDate[dStr];
                        const allDone =
                          log &&
                          log.tasks.length > 0 &&
                          log.tasks.every((t) => t.completed);
                        const selected = isSameDay(day, selectedDate);
                        return (
                          <button
                            type="button"
                            key={dStr}
                            onClick={() => {
                              setSelectedDate(day);
                              setIsCalendarOpen(false);
                            }}
                            className={clsx(
                              'min-h-[40px] py-1 px-0.5 rounded-lg text-[10px] font-bold flex flex-col items-center justify-center cursor-pointer',
                              selected
                                ? 'bg-[#1A2E1A] dark:bg-[#D4AF37] text-white dark:text-[#1A1A1A]'
                                : allDone
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-white dark:bg-black/20 text-gray-700 dark:text-gray-300'
                            )}
                          >
                            <span>{format(day, 'd')}</span>
                            <span className="text-[8px] opacity-75 truncate max-w-full">
                              {format(day, 'EEE', { locale: ar })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
