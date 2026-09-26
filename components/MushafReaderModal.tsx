import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { surahNames, pageSurahsMap, juzPagesMap } from '../utils/quranData';
import { calculateSardTotalErrors, calculateSardGrade, getSardGradeBadgeClass } from '../utils/sardUtils';
import { isPagePreloaded, preloadMushafPages, preloadSurroundingPages } from '../utils/mushafPreload';
import { SuggestedTestPassage } from '../utils/testPassageGenerator';
import { toArabicDigits, parseSafeNumber, safeInputNumber } from '../utils/juzUtils';
import { preloadVerseLinesForPages } from '../utils/mushafVerseHighlightService';
import { MushafImagePage } from './MushafImagePage';
import { Check, RotateCw } from 'lucide-react';

interface MushafReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  newPages: number[];
  previousWeekPages?: Set<number> | number[];
  studentName?: string;
  evalFath?: number;
  setEvalFath?: (val: number | ((prev: number) => number)) => void;
  evalTashkeel?: number;
  setEvalTashkeel?: (val: number | ((prev: number) => number)) => void;
  evalTajweed?: number;
  setEvalTajweed?: (val: number | ((prev: number) => number)) => void;
  evalPassageChanges?: number;
  setEvalPassageChanges?: (val: number | ((prev: number) => number)) => void;
  onReplaceActivePassageWithDeduction?: (passageNumber: number) => void;
  isTestMode?: boolean;
  testScore?: number;
  testDeductions?: { fath: number; tashkeel: number; tajweed: number; passageChange?: number };
  testPassagesText?: string;
  testPassagesCount?: number;
  testTierLabel?: string;
  completedPassages?: number[];
  onTogglePassage?: (num: number) => void;
  activePassage?: SuggestedTestPassage | null;
  allPassages?: SuggestedTestPassage[];
  onSelectPassage?: (passage: SuggestedTestPassage) => void;
  onClearActivePassage?: () => void;
  isSardMode?: boolean;
  sardGroupMode?: boolean;
  sardGroupStudents?: { id: number; name: string; isAlAmeen?: boolean }[];
  sardGroupErrors?: Record<number, { fath: number; tashkeel: number; tajweed: number }>;
  setSardGroupErrors?: React.Dispatch<React.SetStateAction<Record<number, { fath: number; tashkeel: number; tajweed: number }>>>;
}

export const MushafReaderModal: React.FC<MushafReaderModalProps> = ({
  isOpen,
  onClose,
  newPages,
  previousWeekPages = [],
  studentName,
  evalFath = 0,
  setEvalFath,
  evalTashkeel = 0,
  setEvalTashkeel,
  evalTajweed = 0,
  setEvalTajweed,
  evalPassageChanges = 0,
  setEvalPassageChanges,
  onReplaceActivePassageWithDeduction,
  isTestMode = false,
  testScore = 100,
  testDeductions = { fath: 1, tashkeel: 1, tajweed: 0.5, passageChange: 2 },
  testPassagesText,
  testPassagesCount,
  testTierLabel,
  completedPassages = [],
  onTogglePassage,
  activePassage = null,
  allPassages = [],
  onSelectPassage,
  onClearActivePassage,
  isSardMode = false,
  sardGroupMode = false,
  sardGroupStudents = [],
  sardGroupErrors = {},
  setSardGroupErrors,
}) => {
  // Stable key for pages to prevent unnecessary re-computations when array/Set references change
  const pagesKey = useMemo(() => {
    const n = (newPages || []).slice().sort((a, b) => a - b).join(',');
    const p = (previousWeekPages instanceof Set
      ? Array.from(previousWeekPages)
      : (previousWeekPages || [])
    ).slice().sort((a, b) => a - b).join(',');
    return `${n}|${p}`;
  }, [newPages, previousWeekPages]);

  // Convert previousWeekPages to Set for fast lookup
  const prevWeekSet = useMemo(() => {
    if (previousWeekPages instanceof Set) return previousWeekPages;
    return new Set<number>(previousWeekPages || []);
  }, [pagesKey, previousWeekPages]);

  const newPagesSet = useMemo(() => new Set<number>(newPages || []), [pagesKey, newPages]);

  // Combine and sort relevant pages only
  const targetPages = useMemo(() => {
    const combined = new Set<number>();
    (newPages || []).forEach(p => combined.add(p));
    if (previousWeekPages) {
      previousWeekPages.forEach(p => combined.add(p));
    }
    return Array.from(combined).sort((a, b) => a - b);
  }, [pagesKey, newPages, previousWeekPages]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPageDropdownOpen, setIsPageDropdownOpen] = useState(false);
  const [pageSearchTerm, setPageSearchTerm] = useState('');
  const [selectedGroupStudentId, setSelectedGroupStudentId] = useState<number | null>(null);
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const studentDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sardGroupMode && sardGroupStudents.length > 0 && selectedGroupStudentId === null) {
      setSelectedGroupStudentId(sardGroupStudents[0].id);
    }
  }, [sardGroupMode, sardGroupStudents, selectedGroupStudentId]);

  useEffect(() => {
    const handleClickOutsideStudent = (event: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target as Node)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideStudent);
    return () => document.removeEventListener('mousedown', handleClickOutsideStudent);
  }, []);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredSardStudents = useMemo(() => {
    if (!studentSearchTerm.trim()) return sardGroupStudents;
    const term = studentSearchTerm.trim().toLowerCase();
    return sardGroupStudents.filter(s => s.name.toLowerCase().includes(term));
  }, [sardGroupStudents, studentSearchTerm]);

  const filteredDropdownPages = useMemo(() => {
    if (!pageSearchTerm.trim()) return targetPages;
    const term = pageSearchTerm.trim().toLowerCase();
    return targetPages.filter(p => {
      if (p.toString().includes(term)) return true;
      const surahs = pageSurahsMap[p] || [];
      return surahs.some(sId => surahNames[sId]?.toLowerCase().includes(term));
    });
  }, [targetPages, pageSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPageDropdownOpen(false);
      }
    };
    if (isPageDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPageDropdownOpen]);

  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Orientation, UI Overlay Visibility, and Page Fit Mode State
  const [isLandscape, setIsLandscape] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fitMode, setFitMode] = useState<'width' | 'height'>('width');
  const lastTouchTapRef = useRef<number>(0);

  // Detect orientation changes and set initial state
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === 'undefined') return;
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
      if (landscape) {
        setFitMode('width');
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // When switching to landscape, default to hiding overlays for maximum page focus
  useEffect(() => {
    if (isLandscape) {
      setShowControls(false);
      setFitMode('width');
    } else {
      setShowControls(true);
    }
  }, [isLandscape]);

  const containerRef = useRef<HTMLDivElement>(null);
  const readerAreaRef = useRef<HTMLDivElement>(null);
  
  // Touch tracking references
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  const initialDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);
  const hasMovedSignificantlyRef = useRef<boolean>(false);
  
  const getDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const currentPage = targetPages[currentIndex] || 0;

  // Track previous isOpen state, active passage, and currently active page number to prevent unwanted resets
  const prevIsOpenRef = useRef(false);
  const prevActivePassageRef = useRef<SuggestedTestPassage | null>(null);
  const currentPageRef = useRef<number>(0);

  // Keep currentPageRef in sync with currentPage whenever it changes
  useEffect(() => {
    if (currentPage > 0) {
      currentPageRef.current = currentPage;
    }
  }, [currentPage]);

  // Preload all target pages as soon as modal opens or pages change
  useEffect(() => {
    if (isOpen && targetPages.length > 0) {
      preloadMushafPages(targetPages);
      preloadVerseLinesForPages(targetPages);
    }
  }, [isOpen, targetPages]);

  // Manage page index when modal opens, active passage changes, or pages update
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    const wasClosed = !prevIsOpenRef.current;
    prevIsOpenRef.current = true;

    // 1. If modal just opened (transitioned from closed to open)
    if (wasClosed) {
      setZoom(1);
      let targetIdx = 0;
      if (activePassage && activePassage.pages.length > 0) {
        const found = targetPages.indexOf(activePassage.pages[0]);
        if (found !== -1) targetIdx = found;
      }
      setCurrentIndex(targetIdx);
      const firstPage = targetPages[targetIdx] || 0;
      currentPageRef.current = firstPage;
      if (firstPage) {
        preloadSurroundingPages(firstPage, 3);
      }
      if (readerAreaRef.current) {
        readerAreaRef.current.scrollTop = 0;
      }
      prevActivePassageRef.current = activePassage;
      return;
    }

    // 2. If modal was already open, but activePassage changed (in test mode)
    if (activePassage !== prevActivePassageRef.current) {
      prevActivePassageRef.current = activePassage;
      if (activePassage && activePassage.pages.length > 0) {
        const found = targetPages.indexOf(activePassage.pages[0]);
        if (found !== -1) {
          setCurrentIndex(found);
          currentPageRef.current = targetPages[found] || 0;
          if (readerAreaRef.current) {
            readerAreaRef.current.scrollTop = 0;
          }
          return;
        }
      }
    }

    // 3. If modal was ALREADY open and targetPages updated (e.g. background data sync):
    // DO NOT reset to page 0! Preserve the user's currently viewed page!
    if (targetPages.length > 0) {
      const currentPg = currentPageRef.current || targetPages[currentIndex] || 0;
      const foundIdx = targetPages.indexOf(currentPg);
      if (foundIdx !== -1) {
        if (foundIdx !== currentIndex) {
          setCurrentIndex(foundIdx);
        }
      } else {
        // If current page is no longer in targetPages, safely clamp to valid range
        const clampedIdx = Math.min(currentIndex, targetPages.length - 1);
        if (clampedIdx !== currentIndex) {
          setCurrentIndex(Math.max(0, clampedIdx));
        }
      }
    }
  }, [isOpen, targetPages, activePassage]);

  useEffect(() => {
    if (currentPage) {
      preloadSurroundingPages(currentPage, 3);
    }
  }, [currentPage]);

  // Reset scroll to top whenever page changes so the page starts from top
  useEffect(() => {
    if (readerAreaRef.current) {
      readerAreaRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  // Determine Juz for current page
  const currentJuz = useMemo(() => {
    if (!currentPage) return 1;
    for (let j = 1; j <= 30; j++) {
      const pList = juzPagesMap[j];
      if (pList && pList.includes(currentPage)) {
        return j;
      }
    }
    if (currentPage === 1) return 1;
    if (currentPage >= 582) return 30;
    return Math.floor((currentPage - 2) / 20) + 1;
  }, [currentPage]);

  // Surahs on current page
  const currentSurahs = useMemo(() => {
    if (!currentPage) return [];
    const sIds = pageSurahsMap[currentPage] || [];
    return sIds.map(id => surahNames[id]).filter(Boolean);
  }, [currentPage]);

  // Page status: new memorization or previous week
  const isNew = newPagesSet.has(currentPage);
  const isPrevWeek = prevWeekSet.has(currentPage);

  const handleNext = useCallback(() => {
    if (currentIndex < targetPages.length - 1) {
      const nextIdx = currentIndex + 1;
      const nextPage = targetPages[nextIdx];
      setCurrentIndex(nextIdx);
      if (nextPage) {
        preloadSurroundingPages(nextPage, 3);
      }
    }
  }, [currentIndex, targetPages]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      const prevPage = targetPages[prevIdx];
      setCurrentIndex(prevIdx);
      if (prevPage) {
        preloadSurroundingPages(prevPage, 3);
      }
    }
  }, [currentIndex, targetPages]);

  const handleZoomIn = () => setZoom(z => Math.min(2.5, +(z + 0.2).toFixed(2)));
  const handleZoomOut = () => setZoom(z => Math.max(0.75, +(z - 0.2).toFixed(2)));
  const handleZoomReset = () => setZoom(1);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handleNext();
      } else if (e.key === 'ArrowRight') {
        handlePrev();
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Enhanced Touch Swipe & Tap handlers (تفعيل التمرير السلس والضغط للتبديل بالأصبع)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isSwipingRef.current = false;
      hasMovedSignificantlyRef.current = true;
    } else if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchStartTimeRef.current = Date.now();
      isSwipingRef.current = true;
      initialDistanceRef.current = null;
      hasMovedSignificantlyRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      return;
    }

    if (!isSwipingRef.current || touchStartXRef.current === null || touchStartYRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartXRef.current;
    const diffY = currentY - touchStartYRef.current;

    if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
      hasMovedSignificantlyRef.current = true;
    }

    // إذا كان السحب أفقياً واضحاً، نمنع السحب الرأسي الافتراضي لمنح تجربة تقليب صفحات طبيعية بالأصبع
    if (Math.abs(diffX) > Math.abs(diffY) * 1.2 && Math.abs(diffX) > 15) {
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    initialDistanceRef.current = null;
    if (!isSwipingRef.current || touchStartXRef.current === null || touchStartYRef.current === null) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      isSwipingRef.current = false;
      return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartXRef.current;
    const diffY = touchEndY - touchStartYRef.current;
    const timeTaken = Date.now() - touchStartTimeRef.current;

    // قياس السحب بالأصبع بمرونة عالية
    // سحب سريع أو سحب عادي واضح
    const isFastSwipe = timeTaken < 400 && Math.abs(diffX) > 20;
    const isNormalSwipe = Math.abs(diffX) > 30;

    // تقليب الصفحة بالأصبع حسب طلب المستخدم:
    // السحب لليمين (diffX > 0) -> الصفحة التالية (رقم أعلى)
    // السحب لليسار (diffX < 0) -> الصفحة السابقة (رقم أقل)
    if (zoom <= 1.3 && (isFastSwipe || isNormalSwipe) && Math.abs(diffX) > Math.abs(diffY) * 0.8) {
      if (diffX > 0) {
        handleNext(); // السحب لليمين -> الصفحة التالية
      } else {
        handlePrev(); // السحب لليسار -> الصفحة السابقة
      }
    } else if (!hasMovedSignificantlyRef.current && timeTaken < 350 && Math.abs(diffX) < 15 && Math.abs(diffY) < 15) {
      // نقرة خفيفة في الوسط للتبديل بين إظهار/إخفاء أشرطة التحكم
      lastTouchTapRef.current = Date.now();
      setShowControls(prev => !prev);
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isSwipingRef.current = false;
  };

  const handleScreenClick = (e: React.MouseEvent) => {
    // Prevent synthetic click from firing right after touch tap
    if (Date.now() - lastTouchTapRef.current < 500) {
      return;
    }
    // If click is not on an interactive button or input, toggle controls
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('.no-toggle')) {
      return;
    }
    setShowControls(prev => !prev);
  };

  // Live error calculation
  const currentEvalFath = Number(sardGroupMode && selectedGroupStudentId ? (sardGroupErrors[selectedGroupStudentId]?.fath ?? 0) : (evalFath ?? 0)) || 0;
  const currentEvalTashkeel = Number(sardGroupMode && selectedGroupStudentId ? (sardGroupErrors[selectedGroupStudentId]?.tashkeel ?? 0) : (evalTashkeel ?? 0)) || 0;
  const currentEvalTajweed = Number(sardGroupMode && selectedGroupStudentId ? (sardGroupErrors[selectedGroupStudentId]?.tajweed ?? 0) : (evalTajweed ?? 0)) || 0;

  const totalErrors = useMemo(() => {
    const fath = Number(currentEvalFath) || 0;
    const tashkeel = Number(currentEvalTashkeel) || 0;
    const tajweed = Number(currentEvalTajweed) || 0;
    if (isSardMode) {
      return calculateSardTotalErrors(fath, tashkeel, tajweed);
    }
    const rawSum = fath + tashkeel + (tajweed * 0.5);
    return Number(Number(rawSum).toFixed(1));
  }, [currentEvalFath, currentEvalTashkeel, currentEvalTajweed, isSardMode]);

  const liveRating = useMemo(() => {
    if (isSardMode) {
      const grade = calculateSardGrade(totalErrors);
      let color = 'bg-emerald-600 text-white';
      if (grade === 'ممتاز مع الشرف') {
        color = 'bg-amber-500 text-amber-950 font-black ring-1 ring-amber-300';
      } else if (grade === 'ممتاز') {
        color = 'bg-emerald-600 text-white font-black';
      } else if (grade === 'جيد جداً' || grade === 'جيد جدا') {
        color = 'bg-blue-600 text-white font-black';
      } else {
        color = 'bg-rose-600 text-white font-black';
      }
      return { label: grade, color };
    }
    if (totalErrors === 0) return { label: 'ممتاز', color: 'bg-emerald-600 text-white' };
    if (totalErrors <= 2) return { label: 'جيد جداً', color: 'bg-blue-600 text-white' };
    if (totalErrors <= 5) return { label: 'جيد', color: 'bg-amber-600 text-white' };
    return { label: 'لم يحفظ', color: 'bg-red-600 text-white' };
  }, [totalErrors, isSardMode]);

  const hasErrorControls = Boolean(setEvalFath || setEvalTashkeel || setEvalTajweed);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xs p-0 sm:p-2 overflow-hidden animate-fade-in select-none" dir="rtl">
      <div 
        ref={containerRef}
        className={`bg-[#fbf9f4] dark:bg-gray-950 w-full h-full max-w-5xl rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-0 sm:border border-amber-900/20 dark:border-gray-800 transition-all relative ${
          isFullscreen || isLandscape ? 'rounded-none max-w-none h-full' : 'h-[100dvh] sm:max-h-[98vh]'
        }`}
      >
        {/* Header Bar - Either simplified Test Passage Toolbar OR Standard Header Bar */}
        {isTestMode && activePassage ? (
          /* شريط المقطع المخصص للاختبار: يقتصر فقط على بيان نطاق المقطع، زر إكمال المقطع، زر الانتقال للمقطع الآخر، وزر الإغلاق */
          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out z-30 flex-shrink-0 ${
            showControls ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
          }`}>
            <div className="overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 dark:from-amber-700 dark:via-amber-600 dark:to-amber-700 text-amber-950 dark:text-amber-50 px-2.5 sm:px-4 py-2 shadow-md border-b-2 border-amber-600/80 dark:border-amber-500 select-none">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  {/* 1. بيان نطاق المقطع وزر الإغلاق على الهاتف */}
                  <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <span className="bg-amber-950 text-amber-100 text-[11px] sm:text-xs px-2.5 py-1 rounded-lg font-black flex items-center gap-1 shadow-xs shrink-0">
                        <span>🎯</span>
                        <span>المقطع {toArabicDigits(activePassage.passageNumber)} من {toArabicDigits(allPassages?.length || testPassagesCount || 3)}</span>
                      </span>
                      <span className="text-[11px] sm:text-sm font-black text-amber-950 dark:text-amber-50 break-words leading-tight">
                        {activePassage.description}
                      </span>
                    </div>

                    {/* زر الإغلاق على الهاتف في الزاوية العلوية */}
                    <button
                      type="button"
                      onClick={onClose}
                      className="sm:hidden px-2.5 py-1 min-h-[32px] rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-xs transition active:scale-95 flex items-center justify-center gap-1 border border-red-500 shrink-0"
                      title="إغلاق المصحف"
                    >
                      <span>✕</span>
                      <span>إغلاق</span>
                    </button>
                  </div>

                  {/* 2. الأزرار المختصرة المحددة: إكمال المقطع، الانتقال للمقطع الآخر، الإغلاق للشاشات الأكبر */}
                  <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 shrink-0">
                    {/* زر إنجاز المقطع (مربع بني مطابق لصفحة الاختبار) */}
                    {onTogglePassage && (
                      <button
                        type="button"
                        onClick={() => onTogglePassage(activePassage.passageNumber)}
                        className={`w-7 h-7 min-w-[28px] min-h-[28px] rounded-lg shrink-0 flex items-center justify-center transition-all border-2 cursor-pointer select-none active:scale-90 ${
                          completedPassages.includes(activePassage.passageNumber)
                            ? 'bg-[#78350f] border-[#78350f] text-white shadow-xs'
                            : 'bg-white border-[#78350f] hover:bg-amber-50'
                        }`}
                        title={completedPassages.includes(activePassage.passageNumber) ? 'تم التسميع - انقر للإلغاء' : 'تحديد المقطع كمُنجز'}
                      >
                        {completedPassages.includes(activePassage.passageNumber) && (
                          <Check className="w-4 h-4 text-white stroke-[3.5]" />
                        )}
                      </button>
                    )}

                    {/* زر تغيير المقطع المقترح مع الخصم (مطابق لزر صفحة الاختبار) */}
                    {onReplaceActivePassageWithDeduction && (
                      <button
                        type="button"
                        onClick={() => onReplaceActivePassageWithDeduction(activePassage.passageNumber)}
                        className="min-h-[28px] h-7 px-2 py-0.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-black shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1 border border-purple-500 shrink-0 cursor-pointer select-none"
                        title={`تغيير المقطع المقترح وخصم ${toArabicDigits(testDeductions?.passageChange ?? 2)} درجات`}
                      >
                        <RotateCw className="w-3.5 h-3.5 text-white shrink-0" />
                        <span className="text-[10px] bg-purple-900/90 text-purple-100 px-1 py-0.5 rounded-md font-black leading-none">
                          (-{toArabicDigits(testDeductions?.passageChange ?? 2)})
                        </span>
                      </button>
                    )}

                    {/* أزرار الانتقال للمقطع الآخر */}
                    {allPassages && allPassages.length > 1 && onSelectPassage && (
                      <div className="flex items-center gap-1 bg-amber-950/20 p-0.5 rounded-xl border border-amber-600/40 shrink-0">
                        <button
                          type="button"
                          disabled={activePassage.passageNumber <= 1}
                          onClick={() => {
                            const prev = allPassages.find(p => p.passageNumber === activePassage.passageNumber - 1);
                            if (prev) onSelectPassage(prev);
                          }}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-950 text-amber-100 text-xs font-black disabled:opacity-30 disabled:pointer-events-none hover:bg-black transition active:scale-95"
                          title="الانتقال للمقطع السابق"
                        >
                          ▶ السابق
                        </button>
                        <button
                          type="button"
                          disabled={activePassage.passageNumber >= allPassages.length}
                          onClick={() => {
                            const next = allPassages.find(p => p.passageNumber === activePassage.passageNumber + 1);
                            if (next) onSelectPassage(next);
                          }}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-950 text-amber-100 text-xs font-black disabled:opacity-30 disabled:pointer-events-none hover:bg-black transition active:scale-95"
                          title="الانتقال للمقطع التالي"
                        >
                          التالي ◀
                        </button>
                      </div>
                    )}

                    {/* زر الإغلاق للشاشات الكبيرة */}
                    <button
                      type="button"
                      onClick={onClose}
                      className="hidden sm:flex px-3 py-1 min-h-[34px] rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-xs transition active:scale-95 items-center justify-center gap-1 border border-red-500 shrink-0"
                      title="إغلاق المصحف"
                    >
                      <span>✕</span>
                      <span>إغلاق</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* الرأس القياسي لمصحف التسميع والسرد العادي */
          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out z-30 flex-shrink-0 ${
            showControls ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
          }`}>
            <div className="overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between shadow-md border-b border-emerald-800/60">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-base sm:text-lg flex-shrink-0">📖</span>
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
                <span className="text-xs sm:text-sm font-black text-amber-200 truncate">
                  {isSardMode ? 'مصحف السرد' : 'مصحف التسميع'}
                </span>

                {targetPages.length > 0 && (
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                    <span className="bg-emerald-800/90 text-white px-2 py-0.5 rounded-md text-[11px] font-bold border border-emerald-700/60 shadow-xs">
                      جزء {currentJuz}
                    </span>
                    {currentSurahs.length > 0 && (
                      <span className="bg-emerald-950/80 text-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-medium border border-emerald-800/80 truncate max-w-[150px]">
                        {currentSurahs.join('، ')}
                      </span>
                    )}
                    {isSardMode ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black">
                        سرد
                      </span>
                    ) : (
                      <>
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded bg-green-500 text-white text-[10px] font-black">
                            جديد
                          </span>
                        )}
                        {isPrevWeek && !isNew && (
                          <span className="px-1.5 py-0.5 rounded bg-[#8B4513] text-amber-100 text-[10px] font-black">
                            سابق
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}

                {studentName && (
                  <span className="hidden lg:inline-block text-[11px] text-emerald-300 font-medium">
                    ({studentName})
                  </span>
                )}
              </div>
            </div>

            {/* Header Action Tools */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              {/* Quick Zoom Buttons */}
              <div className="hidden sm:flex items-center bg-emerald-950/80 rounded-lg p-0.5 border border-emerald-700/50">
                <button 
                  type="button" 
                  onClick={handleZoomIn} 
                  className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold text-white hover:bg-emerald-700 transition"
                  title="تكبير"
                >
                  +
                </button>
                <button 
                  type="button" 
                  onClick={handleZoomReset} 
                  className="px-1.5 h-6 flex items-center justify-center rounded text-[10px] font-bold text-emerald-200 hover:bg-emerald-700 transition"
                  title="إعادة ضبط"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button 
                  type="button" 
                  onClick={handleZoomOut} 
                  className="w-6 h-6 flex items-center justify-center rounded text-xs font-bold text-white hover:bg-emerald-700 transition"
                  title="تصغير"
                >
                  -
                </button>
              </div>

              {/* Fit Width / Height Toggle */}
              <button 
                type="button" 
                onClick={() => setFitMode(prev => prev === 'width' ? 'height' : 'width')} 
                className="p-1 sm:p-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-700 text-amber-200 transition text-xs font-bold border border-emerald-700/50 flex items-center justify-center gap-1"
                title={fitMode === 'width' ? "التبديل إلى ملاءمة الارتفاع" : "التبديل إلى أقصى عرض (تمرير عمودي)"}
              >
                <span>{fitMode === 'width' ? '↕️' : '↔️'}</span>
                <span className="hidden sm:inline text-[11px]">{fitMode === 'width' ? 'ملاءمة الارتفاع' : 'أقصى عرض'}</span>
              </button>

              <button 
                type="button" 
                onClick={toggleFullscreen} 
                className="p-1 sm:p-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-700 text-white transition text-xs font-bold border border-emerald-700/50 flex items-center justify-center"
                title={isFullscreen ? "إلغاء ملء الشاشة" : "ملء الشاشة"}
              >
                ⛶
              </button>

              <button 
                type="button" 
                onClick={onClose} 
                className="px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white transition text-sm font-black shadow-lg shadow-red-900/20 flex items-center justify-center gap-1 border border-red-500 backdrop-blur-sm active:scale-95"
                title="إغلاق المصحف"
              >
                <span>✕</span> <span>إغلاق</span>
              </button>
            </div>
          </div>
          </div>
          </div>
        )}

        {/* Subtle Floating Page Info & Close Badge when bars are hidden */}
        {!showControls && (
          <div className="absolute top-2 left-2 right-2 z-40 flex items-center justify-between pointer-events-none animate-fade-in">
            {/* Quick Page Info Badge */}
            <div className="bg-black/80 backdrop-blur-md text-amber-200 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/40 shadow-lg flex items-center gap-2 pointer-events-auto">
              <span>صفحة {currentPage}</span>
              {currentSurahs.length > 0 && <span className="text-gray-300 font-normal">({currentSurahs[0]})</span>}
              <span className="text-emerald-400 text-[10px]">جزء {currentJuz}</span>
            </div>

            {/* Quick Close Button */}
            <button 
              type="button" 
              onClick={onClose} 
              className="w-8 h-8 rounded-full bg-red-600/90 hover:bg-red-600 text-white font-bold flex items-center justify-center shadow-lg border border-red-400 active:scale-95 transition pointer-events-auto"
              title="إغلاق المصحف"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Mushaf Page Display Area - Expands fully in landscape and allows natural vertical scroll */}
        <div 
          ref={readerAreaRef}
          onClick={handleScreenClick}
          className="flex-1 min-h-0 w-full relative flex flex-col items-center justify-start overflow-y-auto overflow-x-hidden p-0 sm:p-2 bg-[#f4ece1] dark:bg-gray-950 select-none touch-pan-y scrollbar-thin scrollbar-thumb-amber-700/30 cursor-pointer overscroll-contain"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {targetPages.length === 0 ? (
            <div className="text-center p-6 max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 my-auto cursor-default" onClick={e => e.stopPropagation()}>
              <span className="text-4xl mb-3 block">📖</span>
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
                لم يتم تحديد صفحات للحفظ أو المراجعة
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                يرجى اختيار أرقام الصفحات أو السور لعرض المصحف.
              </p>
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition"
              >
                العودة للاستمارة
              </button>
            </div>
          ) : (
            <div className="relative flex flex-col items-center justify-start min-h-full w-full max-w-full">
              {/* Prev Page Button (Right in Arabic RTL) - Hidden on mobile as touch swipe is supported */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                disabled={currentIndex === 0}
                className={`hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-xl border border-white/20 items-center justify-center font-black transition-all ${
                  currentIndex === 0 
                    ? 'opacity-0 pointer-events-none' 
                    : 'hover:scale-110 active:scale-95'
                }`}
                title="الصفحة السابقة"
              >
                <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Next Page Button (Left in Arabic RTL) - Hidden on mobile as touch swipe is supported */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                disabled={currentIndex === targetPages.length - 1}
                className={`hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-xl border border-white/20 items-center justify-center font-black transition-all ${
                  currentIndex === targetPages.length - 1 
                    ? 'opacity-0 pointer-events-none' 
                    : 'hover:scale-110 active:scale-95'
                }`}
                title="الصفحة التالية"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Mushaf Page Wrapper - Expands to maximum width for full readability and vertical touch scrolling */}
              <div 
                className={`relative w-full flex flex-col items-center justify-start transition-transform duration-200 ease-out py-0 sm:py-2 px-1 sm:px-3 ${
                  fitMode === 'width' || isLandscape ? 'max-w-full sm:max-w-4xl' : 'max-w-full'
                }`}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center top'
                }}
              >
                {/* Slight Top Scroll Clearance */}
                <div className="w-full h-8 sm:h-12 shrink-0 select-none pointer-events-none" />

                {/* صفحة مصحف المدينة النبوية عالية الدقة مع طبقة تظليل المتجهات Responsive SVG Overlay */}
                <MushafImagePage
                  pageNumber={currentPage}
                  activePassage={isTestMode ? activePassage : null}
                  fitMode={fitMode}
                  isLandscape={isLandscape}
                />

                {/* Bottom Clearance Indicator */}
                <div className="w-full max-w-[620px] md:max-w-[700px] lg:max-w-[760px] mx-auto flex items-center justify-center gap-2 py-2 text-xs text-amber-950/70 dark:text-gray-400 font-bold select-none bg-amber-100/50 dark:bg-gray-900/50 rounded-xl mt-3 border border-amber-700/20">
                  <span>🏁 نهاية صفحة المصحف ({currentPage})</span>
                </div>

                {/* Slight Bottom Scroll Clearance */}
                <div className="w-full h-12 sm:h-16 shrink-0 select-none pointer-events-none" />
              </div>
            </div>
          )}

        </div>

        {/* Unified Horizontal Error Controls & Result Bar - Collapses when hidden on center tap */}
        <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out z-40 flex-shrink-0 relative ${
          showControls ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
        }`}>
          <div className={showControls ? 'overflow-visible' : 'overflow-hidden'}>
            <div className="bg-white/95 dark:bg-gray-950/95 text-gray-900 dark:text-white border-t border-gray-200 dark:border-amber-500/40 px-2 sm:px-4 py-2 sm:py-2.5 flex flex-col gap-2 shadow-2xl backdrop-blur-md relative z-40">
              {/* Top Row: Larger Horizontal Error Buttons for (الفتح، التشكيل، التجويد، وتغيير المقطع) */}
          {hasErrorControls && (
            <div className={`grid ${isTestMode ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2 sm:gap-3 w-full max-w-4xl mx-auto`}>
              {/* الفتح */}
              <div 
                className="flex items-stretch bg-rose-50/95 hover:bg-rose-100/90 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 rounded-xl border-2 border-rose-300 dark:border-rose-500/50 overflow-hidden shadow-xs group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                onClick={() => {
                  if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                    setSardGroupErrors(prev => ({
                      ...prev,
                      [selectedGroupStudentId]: {
                        ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                        fath: (prev[selectedGroupStudentId]?.fath || 0) + 1
                      }
                    }));
                  } else if (setEvalFath) {
                    setEvalFath(prev => (Number(prev) || 0) + 1);
                  }
                }}
              >
                <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                  <span className="text-[10px] sm:text-xs font-black text-rose-900 dark:text-rose-200 group-hover:text-rose-950 dark:group-hover:text-white transition-colors select-none text-right flex flex-col leading-tight">
                    <span>الفتح</span>
                    {isTestMode ? <span className="text-[9px] text-rose-600 dark:text-rose-400">({testDeductions.fath}-)</span> : <span className="text-[9px] text-rose-600/90 dark:text-rose-300/80">(+1)</span>}
                  </span>
                </div>
                <div className="px-1.5 sm:px-2 flex items-center justify-center">
                  <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-white dark:bg-gray-900 border-2 border-rose-500 dark:border-rose-400 shadow-xs flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()} 
                      type="number" 
                      min="0" 
                      value={safeInputNumber(sardGroupMode && selectedGroupStudentId ? sardGroupErrors[selectedGroupStudentId]?.fath : evalFath)} 
                      placeholder="0"
                      onChange={e => {
                        const val = Math.max(0, parseSafeNumber(e.target.value));
                        if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                          setSardGroupErrors(prev => ({
                            ...prev,
                            [selectedGroupStudentId]: {
                              ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                              fath: val
                            }
                          }));
                        } else if (setEvalFath) {
                          setEvalFath(val);
                        }
                      }} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-rose-700 dark:text-rose-200 focus:text-rose-950 dark:focus:text-white border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-300 dark:placeholder:text-rose-700 z-10" 
                    />
                  </div>
                </div>
              </div>

              {/* التشكيل */}
              <div 
                className="flex items-stretch bg-amber-50/95 hover:bg-amber-100/90 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 rounded-xl border-2 border-amber-300 dark:border-amber-500/50 overflow-hidden shadow-xs group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                onClick={() => {
                  if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                    setSardGroupErrors(prev => ({
                      ...prev,
                      [selectedGroupStudentId]: {
                        ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                        tashkeel: (prev[selectedGroupStudentId]?.tashkeel || 0) + 1
                      }
                    }));
                  } else if (setEvalTashkeel) {
                    setEvalTashkeel(prev => (Number(prev) || 0) + 1);
                  }
                }}
              >
                <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                  <span className="text-[10px] sm:text-xs font-black text-amber-900 dark:text-amber-200 group-hover:text-amber-950 dark:group-hover:text-white transition-colors select-none text-right flex flex-col leading-tight">
                    <span>التشكيل</span>
                    {isTestMode ? <span className="text-[9px] text-amber-600 dark:text-amber-400">({testDeductions.tashkeel}-)</span> : <span className="text-[9px] text-amber-600/90 dark:text-amber-300/80">(+1)</span>}
                  </span>
                </div>
                <div className="px-1.5 sm:px-2 flex items-center justify-center">
                  <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-white dark:bg-gray-900 border-2 border-amber-500 dark:border-amber-400 shadow-xs flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()} 
                      type="number" 
                      min="0" 
                      value={safeInputNumber(sardGroupMode && selectedGroupStudentId ? sardGroupErrors[selectedGroupStudentId]?.tashkeel : evalTashkeel)} 
                      placeholder="0"
                      onChange={e => {
                        const val = Math.max(0, parseSafeNumber(e.target.value));
                        if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                          setSardGroupErrors(prev => ({
                            ...prev,
                            [selectedGroupStudentId]: {
                              ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                              tashkeel: val
                            }
                          }));
                        } else if (setEvalTashkeel) {
                          setEvalTashkeel(val);
                        }
                      }} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-amber-700 dark:text-amber-200 focus:text-amber-950 dark:focus:text-white border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-amber-300 dark:placeholder:text-amber-700 z-10" 
                    />
                  </div>
                </div>
              </div>

              {/* التجويد */}
              <div 
                className="flex items-stretch bg-teal-50/95 hover:bg-teal-100/90 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 rounded-xl border-2 border-teal-300 dark:border-teal-500/50 overflow-hidden shadow-xs group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                onClick={() => {
                  if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                    setSardGroupErrors(prev => ({
                      ...prev,
                      [selectedGroupStudentId]: {
                        ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                        tajweed: (prev[selectedGroupStudentId]?.tajweed || 0) + 1
                      }
                    }));
                  } else if (setEvalTajweed) {
                    setEvalTajweed(prev => (Number(prev) || 0) + 1);
                  }
                }}
              >
                <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                  <span className="text-[10px] sm:text-xs font-black text-teal-900 dark:text-teal-200 group-hover:text-teal-950 dark:group-hover:text-white transition-colors select-none text-right flex flex-col leading-tight">
                    <span>التجويد</span>
                    {isTestMode ? <span className="text-[9px] text-teal-600 dark:text-teal-400">({testDeductions.tajweed}-)</span> : <span className="text-[9px] text-teal-600/90 dark:text-teal-300/80">(0.5)</span>}
                  </span>
                </div>
                <div className="px-1.5 sm:px-2 flex items-center justify-center">
                  <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-white dark:bg-gray-900 border-2 border-teal-500 dark:border-teal-400 shadow-xs flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()} 
                      type="number" 
                      min="0" 
                      value={safeInputNumber(sardGroupMode && selectedGroupStudentId ? sardGroupErrors[selectedGroupStudentId]?.tajweed : evalTajweed)} 
                      placeholder="0"
                      onChange={e => {
                        const val = Math.max(0, parseSafeNumber(e.target.value));
                        if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                          setSardGroupErrors(prev => ({
                            ...prev,
                            [selectedGroupStudentId]: {
                              ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                              tajweed: val
                            }
                          }));
                        } else if (setEvalTajweed) {
                          setEvalTajweed(val);
                        }
                      }} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-teal-700 dark:text-teal-200 focus:text-teal-950 dark:focus:text-white border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-teal-300 dark:placeholder:text-teal-700 z-10" 
                    />
                  </div>
                </div>
              </div>

              {/* تغيير المقطع (خاص بالاختبار) */}
              {isTestMode && (
                <div 
                  className="flex items-stretch bg-purple-50/95 hover:bg-purple-100/90 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 rounded-xl border-2 border-purple-300 dark:border-purple-500/50 overflow-hidden shadow-xs group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                  onClick={() => {
                    if (setEvalPassageChanges) {
                      setEvalPassageChanges(prev => (Number(prev) || 0) + 1);
                    }
                  }}
                >
                  <div className="flex-1 flex items-center justify-end px-1.5 sm:px-2">
                    <span className="text-[10px] sm:text-xs font-black text-purple-900 dark:text-purple-200 group-hover:text-purple-950 dark:group-hover:text-white transition-colors select-none text-right flex flex-col leading-tight">
                      <span>تغيير المقطع</span>
                      <span className="text-[9px] text-purple-600 dark:text-purple-400">({testDeductions?.passageChange ?? 2}-)</span>
                    </span>
                  </div>
                  <div className="px-1 sm:px-1.5 flex items-center justify-center">
                    <div className="w-9 sm:w-11 h-7 sm:h-8 rounded-full bg-white dark:bg-gray-900 border-2 border-purple-500 dark:border-purple-400 shadow-xs flex items-center justify-center overflow-hidden">
                      <input 
                        onClick={(e) => e.stopPropagation()} 
                        type="number" 
                        min="0" 
                        value={safeInputNumber(evalPassageChanges)} 
                        placeholder="0"
                        onChange={e => {
                          const val = Math.max(0, parseSafeNumber(e.target.value));
                          if (setEvalPassageChanges) {
                            setEvalPassageChanges(val);
                          }
                        }} 
                        onFocus={e => e.target.select()} 
                        className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-purple-700 dark:text-purple-200 focus:text-purple-950 dark:focus:text-white border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-purple-300 dark:placeholder:text-purple-700 z-10" 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Row: Result Box (خانة النتيجة والمجموع) with page switcher button */}
          <div className="flex items-center justify-between flex-wrap gap-2 w-full max-w-3xl mx-auto pt-1.5 border-t border-gray-200 dark:border-gray-800">
            {/* Live Result / Score Box */}
            {isTestMode ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/30">
                  <span className="text-[11px] sm:text-xs text-gray-700 dark:text-gray-300 font-bold">درجة الاختبار:</span>
                  <span className={`text-sm sm:text-base font-black ${Math.max(0, testScore - (currentEvalFath * testDeductions.fath + currentEvalTashkeel * testDeductions.tashkeel + currentEvalTajweed * testDeductions.tajweed + (evalPassageChanges || 0) * (testDeductions.passageChange ?? 2))) < testScore * 0.5 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {Math.max(0, testScore - (currentEvalFath * testDeductions.fath + currentEvalTashkeel * testDeductions.tashkeel + currentEvalTajweed * testDeductions.tajweed + (evalPassageChanges || 0) * (testDeductions.passageChange ?? 2)))}
                  </span>
                  <span className="text-[10px] text-gray-500">/ {testScore}</span>
                </div>

                {testPassagesCount && testPassagesCount > 0 && onTogglePassage && (
                  <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-xl border border-amber-300/80 dark:border-amber-800">
                    <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 ml-1">
                      المقاطع ({completedPassages.length}/{testPassagesCount}):
                    </span>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: testPassagesCount }, (_, i) => {
                        const pNum = i + 1;
                        const isDone = completedPassages.includes(pNum);
                        const isSelected = activePassage?.passageNumber === pNum;
                        const passageObj = allPassages?.find(p => p.passageNumber === pNum);
                        return (
                          <button
                            key={pNum}
                            type="button"
                            onClick={() => {
                              if (passageObj && onSelectPassage && !isSelected) {
                                onSelectPassage(passageObj);
                              } else {
                                onTogglePassage(pNum);
                              }
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer select-none active:scale-95 ${
                              isSelected
                                ? 'bg-amber-500 text-amber-950 ring-2 ring-amber-400 font-black shadow-xs'
                                : isDone
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-gray-700 hover:bg-amber-100'
                            }`}
                            title={passageObj ? `${passageObj.description} - انقر للعرض والتظليل` : `مقطع ${pNum}`}
                          >
                            {isDone ? `✓ م${pNum}` : `م${pNum}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : isSardMode ? (
              <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/30">
                <span className="text-[11px] sm:text-xs text-emerald-900 dark:text-emerald-300 font-bold">تقدير السرد:</span>
                <span className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-300">
                  الأخطاء: {totalErrors}
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black shadow-xs ${liveRating.color}`}>
                  {liveRating.label}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/30">
                <span className="text-[11px] sm:text-xs text-gray-700 dark:text-gray-300 font-bold">النتيجة:</span>
                <span className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-300">
                  {totalErrors} {totalErrors === 1 ? 'خطأ' : totalErrors === 2 ? 'خطآن' : 'أخطاء'}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-xs font-black shadow-xs ${liveRating.color}`}>
                  {liveRating.label}
                </span>
              </div>
            )}

            {/* Student Selection Dropdown (Group Mode) */}
            {sardGroupMode && sardGroupStudents.length > 0 && (
              <div className="relative" ref={studentDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsStudentDropdownOpen(!isStudentDropdownOpen);
                    setStudentSearchTerm('');
                  }}
                  className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-gray-900 dark:hover:bg-gray-850 dark:text-emerald-200 px-3 py-1.5 rounded-xl text-xs font-black dark:border-emerald-500/40 transition-all shadow-xs cursor-pointer active:scale-95"
                  title="تحديد الطالب"
                >
                  <span className="truncate max-w-[100px] sm:max-w-[150px]">
                    {sardGroupStudents.find(s => s.id === selectedGroupStudentId)?.name || 'اختر الطالب'}
                  </span>
                  <svg className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 transition-transform duration-200 ${isStudentDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isStudentDropdownOpen && (
                  <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
                    onClick={() => setIsStudentDropdownOpen(false)}
                  >
                    <div 
                      className="w-full max-w-xs sm:max-w-sm max-h-[80vh] flex flex-col bg-white dark:bg-gray-900 border-2 border-emerald-500/60 dark:border-emerald-500/60 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md text-right dir-rtl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-3 bg-emerald-50 dark:bg-gray-950 border-b border-emerald-100 dark:border-gray-800 flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 dark:text-emerald-300">
                          طلاب السرد الجماعي ({filteredSardStudents.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsStudentDropdownOpen(false)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg text-xs font-black cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Search in students without autoFocus */}
                      {sardGroupStudents.length > 5 && (
                        <div className="p-2.5 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 relative flex items-center">
                          <input
                            type="text"
                            value={studentSearchTerm}
                            onChange={(e) => setStudentSearchTerm(e.target.value)}
                            placeholder="بحث عن اسم الطالب..."
                            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl pr-3 pl-7 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-right"
                          />
                          {studentSearchTerm && (
                            <button
                              type="button"
                              onClick={() => setStudentSearchTerm('')}
                              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200 flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer"
                              title="مسح البحث"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar divide-y divide-gray-100 dark:divide-gray-800/40">
                        {filteredSardStudents.length === 0 ? (
                          <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400 font-bold">
                            لا توجد نتائج مطابقة
                          </div>
                        ) : (
                          filteredSardStudents.map(student => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => {
                                setSelectedGroupStudentId(student.id);
                                setIsStudentDropdownOpen(false);
                              }}
                              className={`w-full text-right px-4 py-3 text-xs font-bold border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-emerald-50 dark:hover:bg-gray-800 transition-colors flex justify-between items-center cursor-pointer ${
                                selectedGroupStudentId === student.id ? 'bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              <div className="flex flex-col text-right truncate">
                                <span className="truncate">{student.name}</span>
                                {student.isAlAmeen && (
                                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-normal leading-tight">
                                    (من طلاب الأمين)
                                  </span>
                                )}
                              </div>
                              {selectedGroupStudentId === student.id && (
                                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Page Info & Dropdown Trigger Button */}
            {targetPages.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsPageDropdownOpen(!isPageDropdownOpen);
                    setPageSearchTerm('');
                  }}
                  className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 dark:bg-gray-900 dark:hover:bg-gray-850 dark:text-amber-200 px-3 py-1.5 rounded-xl text-xs font-black dark:border-amber-500/40 transition-all shadow-xs cursor-pointer active:scale-95"
                  title="اضغط لاختيار صفحة أخرى"
                >
                  <span>صفحة {currentPage}</span>
                  <span className="text-gray-500 dark:text-gray-400 font-normal">({currentIndex + 1} من {targetPages.length})</span>
                  <svg className={`w-3.5 h-3.5 text-amber-600 dark:text-amber-400 transition-transform duration-200 ${isPageDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isPageDropdownOpen && (
                  <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
                    onClick={() => setIsPageDropdownOpen(false)}
                  >
                    <div 
                      className="w-full max-w-xs sm:max-w-md max-h-[80vh] flex flex-col bg-white dark:bg-gray-900 border-2 border-amber-500/60 dark:border-amber-500/60 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md text-right dir-rtl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Dropdown Header */}
                      <div className="p-3 bg-amber-50 dark:bg-gray-950 border-b border-amber-100 dark:border-gray-800 flex items-center justify-between">
                        <span className="text-xs font-black text-amber-900 dark:text-amber-300">
                          قائمة الصفحات ({targetPages.length} صفحة)
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-amber-100/60 dark:bg-amber-900/40 px-2 py-0.5 rounded-md font-bold">
                            الحالية: {currentPage}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsPageDropdownOpen(false)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg text-xs font-black cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Search in pages without autoFocus */}
                      {targetPages.length > 5 && (
                        <div className="p-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 relative flex items-center">
                          <input
                            type="text"
                            value={pageSearchTerm}
                            onChange={(e) => setPageSearchTerm(e.target.value)}
                            placeholder="بحث برقم الصفحة أو اسم السورة..."
                            className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl pr-3 pl-7 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-amber-500 text-right"
                          />
                          {pageSearchTerm && (
                            <button
                              type="button"
                              onClick={() => setPageSearchTerm('')}
                              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200 flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer"
                              title="مسح البحث"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}

                      {/* Scrollable list of pages */}
                      <div className="overflow-y-auto max-h-[60vh] py-1 scrollbar-thin scrollbar-thumb-amber-500/50 scrollbar-track-transparent divide-y divide-gray-100 dark:divide-gray-800/40">
                        {filteredDropdownPages.length === 0 ? (
                          <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400 font-bold">
                            لا توجد نتائج مطابقة
                          </div>
                        ) : (
                          filteredDropdownPages.map(page => {
                            const isPNew = newPagesSet.has(page);
                            const isPPrev = prevWeekSet.has(page) && !isPNew;
                            const isSelected = page === currentPage;
                            const pSurahs = (pageSurahsMap[page] || []).map(id => surahNames[id]).filter(Boolean);

                            return (
                              <button
                                key={page}
                                type="button"
                                onClick={() => {
                                  const newIdx = targetPages.indexOf(page);
                                  if (newIdx !== -1) {
                                    setCurrentIndex(newIdx);
                                    setIsPageDropdownOpen(false);
                                  }
                                }}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors cursor-pointer text-right ${
                                  isSelected 
                                  ? 'bg-amber-100 text-amber-950 border-r-4 border-amber-500 dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-400' 
                                  : 'text-gray-700 hover:bg-amber-50 hover:text-amber-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-sm font-black">صفحة {page}</span>
                                  {pSurahs.length > 0 && (
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                                      ({pSurahs[0]})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {isSardMode ? (
                                    <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 px-1.5 py-0.5 rounded-md font-bold">
                                      صفحة سرد
                                    </span>
                                  ) : (
                                    <>
                                      {isPNew && (
                                        <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 px-1.5 py-0.5 rounded-md font-bold">
                                          حفظ جديد
                                        </span>
                                      )}
                                      {isPPrev && (
                                        <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-500/30 px-1.5 py-0.5 rounded-md font-bold">
                                          حفظ قديم
                                        </span>
                                      )}
                                    </>
                                  )}
                                  {isSelected && (
                                    <span className="text-amber-600 dark:text-amber-400 font-black mr-1 text-sm">✓</span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MushafReaderModal;
