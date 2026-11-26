import React, { useState, useEffect, useMemo } from 'react';
import { getMushafImageSources, isPagePreloaded, preloadMushafPage, preloadSurroundingPages } from '../utils/mushafPreload';
import { SuggestedTestPassage } from '../utils/testPassageGenerator';
import { toArabicDigits } from '../utils/juzUtils';
import { quranPageMap } from '../utils/quranData';
import {
  calculateLineHighlights,
  getPageVerseData,
  getPageVerseDataSync,
  LineHighlightRect,
  PageVerseData,
  MUSHAF_SVG_BOUNDS
} from '../utils/mushafVerseHighlightService';

export interface MushafHighlightRange {
  startSurahId: number;
  startAyah: number;
  endSurahId: number;
  endAyah: number;
}

export interface ActiveRecitingAyah {
  surahId: number;
  ayah: number;
  page?: number;
}

export interface MushafImagePageProps {
  pageNumber: number;
  activePassage?: SuggestedTestPassage | null;
  highlightRanges?: MushafHighlightRange[];
  activeRecitingAyah?: ActiveRecitingAyah | null;
  onRecitingAyahPosition?: (yFraction: number) => void;
  fitMode?: 'width' | 'height';
  isLandscape?: boolean;
  onImageLoaded?: () => void;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * الأبعاد القياسية لمصحف المدينة النبوية (مجمع الملك فهد لطباعة المصحف الشريف - 15 سطراً):
 * العرض: 1000 وحدة متجهات SVG
 * الارتفاع: 1520 وحدة متجهات SVG
 * النسبة الثابتة: 1000 / 1520
 */
const SVG_VIEW_WIDTH = MUSHAF_SVG_BOUNDS.viewWidth;
const SVG_VIEW_HEIGHT = MUSHAF_SVG_BOUNDS.viewHeight;

export const MushafImagePage: React.FC<MushafImagePageProps> = ({
  pageNumber,
  activePassage,
  highlightRanges,
  activeRecitingAyah,
  onRecitingAyahPosition,
  fitMode = 'width',
  isLandscape = false,
  onImageLoaded,
  onClick
}) => {
  const [srcIndex, setSrcIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(() => !isPagePreloaded(pageNumber));
  const [isError, setIsError] = useState(false);

  // تحميل بيانات مواضع الآيات والأسطر للصفحة الحالية
  const [pageVerseData, setPageVerseData] = useState<PageVerseData | null>(() => {
    return getPageVerseDataSync(pageNumber);
  });

  useEffect(() => {
    let isCancelled = false;
    const syncData = getPageVerseDataSync(pageNumber);
    if (syncData) {
      setPageVerseData(syncData);
    }
    getPageVerseData(pageNumber).then(data => {
      if (!isCancelled && data) {
        setPageVerseData(data);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [pageNumber]);

  const imageSources = useMemo(() => getMushafImageSources(pageNumber), [pageNumber]);
  const currentSrc = imageSources[srcIndex] || imageSources[0];

  // عند تغيير رقم الصفحة: إعادة ضبط حالة التحميل
  useEffect(() => {
    setSrcIndex(0);
    const preloaded = isPagePreloaded(pageNumber);
    setIsLoading(!preloaded);
    setIsError(false);

    if (pageNumber > 0) {
      preloadMushafPage(pageNumber)
        .then(() => {
          setIsLoading(false);
          onImageLoaded?.();
        })
        .catch(() => {
          // سيتم التعامل مع الخطأ عبر onError للصورة
        });
      preloadSurroundingPages(pageNumber, 2);
    }
  }, [pageNumber, onImageLoaded]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setIsError(false);
    onImageLoaded?.();
  };

  const handleImageError = () => {
    if (srcIndex < imageSources.length - 1) {
      setSrcIndex(prev => prev + 1);
      setIsLoading(true);
    } else {
      setIsLoading(false);
      setIsError(true);
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsError(false);
    setIsLoading(true);
    setSrcIndex(0);
  };

  // حساب مستطيلات التظليل المتجهية لكل سطر بدقة متناهية وبدون أي إطار مشوه
  // - يبدأ التظليل مع بداية الآية الأولى في النطاق (حتى لو بدأت في منتصف السطر)
  // - تظلل الأسطر الوسطى بالكامل
  // - آخر سطر في النطاق يظلل حتى نهاية آخر آية
  const lineHighlightRects: LineHighlightRect[] = useMemo(() => {
    const rangesToDraw: MushafHighlightRange[] = [];

    if (activePassage && activePassage.pages && activePassage.pages.includes(pageNumber)) {
      rangesToDraw.push({
        startSurahId: activePassage.startSurahId,
        startAyah: activePassage.startAyah,
        endSurahId: activePassage.endSurahId,
        endAyah: activePassage.endAyah,
      });
    }

    if (highlightRanges && highlightRanges.length > 0) {
      const pageEntries = quranPageMap[pageNumber] || [];
      for (const r of highlightRanges) {
        const overlapsPage =
          pageEntries.length === 0 ||
          pageEntries.some((entry) => {
            const endsAtOrAfterStart =
              entry.surah > r.startSurahId ||
              (entry.surah === r.startSurahId && entry.end >= r.startAyah);
            const startsAtOrBeforeEnd =
              entry.surah < r.endSurahId ||
              (entry.surah === r.endSurahId && entry.start <= r.endAyah);
            return endsAtOrAfterStart && startsAtOrBeforeEnd;
          });
        if (overlapsPage) {
          rangesToDraw.push(r);
        }
      }
    }

    if (rangesToDraw.length === 0) {
      return [];
    }

    if (rangesToDraw.length === 1) {
      const r = rangesToDraw[0];
      return calculateLineHighlights(
        pageNumber,
        r.startSurahId,
        r.startAyah,
        r.endSurahId,
        r.endAyah,
        pageVerseData
      );
    }

    // Multiple verse ranges: compute via calculateLineHighlights and merge overlapping rects per line
    const byLine = new Map<number, LineHighlightRect[]>();
    for (const r of rangesToDraw) {
      const rects = calculateLineHighlights(
        pageNumber,
        r.startSurahId,
        r.startAyah,
        r.endSurahId,
        r.endAyah,
        pageVerseData
      );
      for (const rect of rects) {
        const list = byLine.get(rect.line) || [];
        list.push(rect);
        byLine.set(rect.line, list);
      }
    }

    const merged: LineHighlightRect[] = [];
    const sortedLines = Array.from(byLine.keys()).sort((a, b) => a - b);
    for (const lineNum of sortedLines) {
      const rects = (byLine.get(lineNum) || []).sort((a, b) => a.x - b.x);
      const lineMerged: LineHighlightRect[] = [];
      for (const rect of rects) {
        const prev = lineMerged[lineMerged.length - 1];
        if (prev && rect.x <= prev.x + prev.width + 14) {
          const maxRight = Math.max(prev.x + prev.width, rect.x + rect.width);
          const minY = Math.min(prev.y, rect.y);
          const maxBottom = Math.max(prev.y + prev.height, rect.y + rect.height);
          prev.width = maxRight - prev.x;
          prev.y = minY;
          prev.height = maxBottom - minY;
        } else {
          lineMerged.push({ ...rect });
        }
      }
      merged.push(...lineMerged);
    }

    return merged;
  }, [pageNumber, activePassage, highlightRanges, pageVerseData]);

  // حساب مستطيلات التظليل المميزة للآية المتلوة حالياً أثناء الاستماع (تتبع آية بآية)
  const recitingAyahRects: LineHighlightRect[] = useMemo(() => {
    if (!activeRecitingAyah || !activeRecitingAyah.surahId || !activeRecitingAyah.ayah) {
      return [];
    }
    if (activeRecitingAyah.page && activeRecitingAyah.page !== pageNumber) {
      return [];
    }
    const pageEntries = quranPageMap[pageNumber] || [];
    const onThisPage =
      pageEntries.length === 0 ||
      pageEntries.some(
        (entry) =>
          entry.surah === activeRecitingAyah.surahId &&
          activeRecitingAyah.ayah >= entry.start &&
          activeRecitingAyah.ayah <= entry.end
      );
    if (!onThisPage) return [];

    return calculateLineHighlights(
      pageNumber,
      activeRecitingAyah.surahId,
      activeRecitingAyah.ayah,
      activeRecitingAyah.surahId,
      activeRecitingAyah.ayah,
      pageVerseData
    );
  }, [pageNumber, activeRecitingAyah, pageVerseData]);

  // إبلاغ العارض بالموضع العمودي للآية المتلوة لتمرير الصفحة بسلاسة نحوها عند الحاجة
  useEffect(() => {
    if (!onRecitingAyahPosition || recitingAyahRects.length === 0) return;
    const first = recitingAyahRects[0];
    const last = recitingAyahRects[recitingAyahRects.length - 1];
    const midY = (first.y + (last.y + last.height)) / 2;
    onRecitingAyahPosition(midY / SVG_VIEW_HEIGHT);
  }, [
    onRecitingAyahPosition,
    pageNumber,
    activeRecitingAyah?.surahId,
    activeRecitingAyah?.ayah,
    recitingAyahRects.length,
  ]);

  return (
    <div
      onClick={onClick}
      className={`relative select-none transition-all duration-300 mx-auto flex items-center justify-center ${
        fitMode === 'height' && !isLandscape
          ? 'h-[80vh] max-h-[920px] w-auto'
          : 'w-full max-w-[620px] md:max-w-[700px] lg:max-w-[760px] h-auto'
      }`}
      style={{
        // تثبيت نسبة العرض إلى الارتفاع بدقة هندسية مطلقة (Aspect Ratio 1000:1520)
        aspectRatio: `${SVG_VIEW_WIDTH} / ${SVG_VIEW_HEIGHT}`
      }}
      id={`mushaf-page-container-${pageNumber}`}
    >
      {/* 1. الحاوية الداخلية الحاضنة للصورة وطبقة SVG */}
      <div className="relative w-full h-full rounded-none sm:rounded-xl overflow-hidden shadow-2xl bg-[#faf7f0] dark:bg-gray-900 border-0 sm:border border-amber-900/20 dark:border-amber-500/20">
        
        {/* حالة التحميل الأولي (Shimmer & Spinner متوافق مع النسبة الثابتة) */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-amber-50/90 dark:bg-gray-900/90 backdrop-blur-xs transition-opacity duration-200">
            <div className="relative w-12 h-12 flex items-center justify-center mb-3">
              <div className="absolute inset-0 border-3 border-amber-600/30 dark:border-amber-400/20 rounded-full"></div>
              <div className="absolute inset-0 border-3 border-amber-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">📖</span>
            </div>
            <p className="text-xs font-black text-amber-950 dark:text-amber-200">
              جاري تحميل صفحة المصحف ({toArabicDigits(pageNumber)})...
            </p>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400/70 mt-1">
              مصحف المدينة النبوية عالي الدقة
            </span>
          </div>
        )}

        {/* حالة الخطأ مع زر إعادة المحاولة */}
        {isError && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-900/95 p-6 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center text-xl mb-3 border border-red-300 dark:border-red-800">
              ⚠️
            </div>
            <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 mb-1">
              تعذر تحميل صفحة المصحف رقم {toArabicDigits(pageNumber)}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
              يرجى التحقق من الاتصال بالإنترنت والمحاولة مجدداً
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition active:scale-95 flex items-center gap-1.5"
            >
              <span>🔄</span>
              <span>إعادة تحميل الصفحة</span>
            </button>
          </div>
        )}

        {/* 2. صورة صفحة مصحف المدينة النبوية عالية الدقة */}
        <img
          key={`page-img-${pageNumber}-${srcIndex}`}
          src={currentSrc}
          alt={`صفحة المصحف الشريف رقم ${pageNumber}`}
          referrerPolicy="no-referrer"
          draggable={false}
          loading="eager"
          decoding="async"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`w-full h-full object-fill select-none pointer-events-none transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {/* 3. طبقة التظليل المتجهية التفاعلية عالية الدقة (Responsive SVG Overlay) */}
        <svg
          viewBox={`0 0 ${SVG_VIEW_WIDTH} ${SVG_VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
          aria-hidden="true"
        >
          <defs>
            {/* تدرج لوني ذهبي لطيف يحاكي قلم التظليل المكتبي مع الحفاظ على وضوح الحروف ورسم المصحف */}
            <linearGradient id="verseLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.27" />
              <stop offset="35%" stopColor="#fbbf24" stopOpacity="0.25" />
              <stop offset="65%" stopColor="#fbbf24" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.27" />
            </linearGradient>
            {/* تدرج زمردي/فيروزي مميز للآية المتلوة حالياً أثناء الاستماع لسهولة المتابعة آية بآية */}
            <linearGradient id="recitingAyahGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.36" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#0d9488" stopOpacity="0.36" />
            </linearGradient>
          </defs>

          {/* رسم مستطيلات التظليل لكل سطر: مستطيل مستقل لكل سطر بدون إطار وبدقة متناهية */}
          {lineHighlightRects.length > 0 && (
            <g className="transition-opacity duration-300">
              {lineHighlightRects.map((rect, idx) => (
                <rect
                  key={`line-hl-${pageNumber}-${rect.line}-${idx}`}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  rx={6}
                  ry={6}
                  fill="url(#verseLineGrad)"
                  stroke="none"
                  className="transition-all duration-200"
                />
              ))}
            </g>
          )}

          {/* تظليل الآية المتلوة حالياً بلون زمردي مميز فوق تظليل المقرر */}
          {recitingAyahRects.length > 0 && (
            <g className="transition-opacity duration-200">
              {recitingAyahRects.map((rect, idx) => (
                <rect
                  key={`reciting-hl-${pageNumber}-${rect.line}-${idx}`}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  rx={8}
                  ry={8}
                  fill="url(#recitingAyahGrad)"
                  stroke="#059669"
                  strokeOpacity="0.55"
                  strokeWidth={2.5}
                  className="transition-all duration-200"
                />
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

export default MushafImagePage;
