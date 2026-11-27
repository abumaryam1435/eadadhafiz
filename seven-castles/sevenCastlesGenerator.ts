import { addDays, format, startOfDay, getDay, differenceInCalendarDays } from 'date-fns';
import {
  DailyAmount,
  PageRange,
  SevenCastlesPlan,
  SevenCastlesPortionInfo,
  Task,
  TaskType,
  VerseRange,
} from './types';
import { QURAN_QUARTERS } from './utils/quranQuarters';
import {
  getVerseRangeForPage,
  formatVerseDescription,
  getPageVerseSubset,
  getVerseSubsetFromRanges,
  getVerseRangesForQuarter,
  PageSection,
  SURAH_METADATAList,
  parseVerseRangesFromArabicText,
  parseJuzsFromText,
  getVerseRangesForJuzs,
} from './utils/quranPageMapping';

export const parsePlanDate = (dateStr: string | Date | undefined): Date => {
  if (!dateStr) return startOfDay(new Date());
  if (dateStr instanceof Date) return startOfDay(dateStr);
  if (typeof dateStr === 'string') {
    const cleanStr = dateStr.trim();
    if (cleanStr.length >= 10 && cleanStr.includes('-')) {
      const parts = cleanStr.substring(0, 10).split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      }
    }
    return startOfDay(new Date(cleanStr));
  }
  return startOfDay(new Date());
};

export const JUZ_PAGES: Record<number, { start: number; end: number }> = {
  1: { start: 1, end: 21 },
  2: { start: 22, end: 41 },
  3: { start: 42, end: 61 },
  4: { start: 62, end: 81 },
  5: { start: 82, end: 101 },
  6: { start: 102, end: 121 },
  7: { start: 121, end: 141 },
  8: { start: 142, end: 161 },
  9: { start: 162, end: 181 },
  10: { start: 182, end: 201 },
  11: { start: 201, end: 221 },
  12: { start: 222, end: 241 },
  13: { start: 242, end: 261 },
  14: { start: 262, end: 281 },
  15: { start: 282, end: 301 },
  16: { start: 302, end: 321 },
  17: { start: 322, end: 341 },
  18: { start: 342, end: 361 },
  19: { start: 362, end: 381 },
  20: { start: 382, end: 401 },
  21: { start: 402, end: 421 },
  22: { start: 422, end: 441 },
  23: { start: 442, end: 461 },
  24: { start: 462, end: 481 },
  25: { start: 482, end: 502 },
  26: { start: 502, end: 521 },
  27: { start: 522, end: 541 },
  28: { start: 542, end: 561 },
  29: { start: 562, end: 581 },
  30: { start: 582, end: 604 },
};

export const DAILY_AMOUNT_LABELS: Record<DailyAmount, string> = {
  [DailyAmount.JUZ_PER_PLAN]: 'جزء لكل خطة (مقسم بالسور - للأجزاء ٢٨، ٢٩، ٣٠)',
  [DailyAmount.QUARTER_PAGE]: 'ربع صفحة',
  [DailyAmount.HALF_PAGE]: 'نصف صفحة',
  [DailyAmount.ONE_PAGE]: 'صفحة واحدة',
  [DailyAmount.TWO_PAGES]: 'صفحتان',
  [DailyAmount.QUARTER_HIZB]: 'ربع حزب',
  [DailyAmount.THREE_PAGES]: '3 صفحات',
  [DailyAmount.FOUR_PAGES]: '4 صفحات',
  [DailyAmount.FIVE_PAGES]: '5 صفحات',
};

export const ARABIC_WEEKDAYS = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الإثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
];

/**
 * Expands one or more old-memorization page ranges (e.g. [{start: 1, end: 61}, {start: 502, end: 604}])
 * into a sorted, deduplicated array of individual Mushaf page numbers (1..604).
 */
export function expandOldMemorizationRanges(ranges: PageRange[] = []): number[] {
  const pageSet = new Set<number>();
  for (const r of ranges) {
    if (!r) continue;
    const low = Math.max(1, Math.min(604, Math.min(Number(r.start) || 1, Number(r.end) || 1)));
    const high = Math.max(1, Math.min(604, Math.max(Number(r.start) || 1, Number(r.end) || 1)));
    for (let p = low; p <= high; p++) {
      pageSet.add(p);
    }
  }
  return Array.from(pageSet).sort((a, b) => a - b);
}

/**
 * Compacts an array of page numbers back into contiguous PageRange segments.
 */
export function compressPagesToRanges(pages: number[] = []): PageRange[] {
  const unique = [...new Set(pages)].filter((p) => p >= 1 && p <= 604).sort((a, b) => a - b);
  if (unique.length === 0) return [];
  const ranges: PageRange[] = [];
  let start = unique[0];
  let prev = unique[0];
  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === prev + 1) {
      prev = unique[i];
    } else {
      ranges.push({ start, end: prev });
      start = unique[i];
      prev = unique[i];
    }
  }
  ranges.push({ start, end: prev });
  return ranges;
}

export function getJuzForPage(page: number): number {
  for (let j = 1; j <= 30; j++) {
    const range = JUZ_PAGES[j];
    if (range && page >= range.start && page <= range.end) {
      return j;
    }
  }
  return 1;
}

/**
 * Formats a student's old memorization ranges (supporting multiple ranges) into a concise Arabic summary.
 */
export function formatOldMemorizationSummary(
  oldRanges?: PageRange[],
  oldPages?: number[]
): string {
  const pages =
    oldPages && oldPages.length > 0
      ? [...new Set(oldPages)].sort((a, b) => a - b)
      : expandOldMemorizationRanges(oldRanges);

  if (pages.length === 0) return 'لا يوجد محفوظ قديم';

  const ranges = compressPagesToRanges(pages);
  const rangesText = ranges
    .map((r) => (r.start === r.end ? `ص ${r.start}` : `ص ${r.start}-${r.end}`))
    .join('، و');
  const approxJuzs = Math.round((pages.length / 20) * 10) / 10;
  return `${rangesText} (${pages.length} صفحة ≈ ${approxJuzs} جزء)`;
}

/**
 * Suggests the first unmemorized startPage & juzNumber for a student based on their existing old memorization.
 */
export function suggestStartForStudent(
  oldMemorizedPages: number[],
  isDescending: boolean = false
): { startPage: number; juzNumber: number } {
  const oldSet = new Set(oldMemorizedPages);
  if (isDescending) {
    for (let p = 604; p >= 1; p--) {
      if (!oldSet.has(p)) {
        return { startPage: p, juzNumber: getJuzForPage(p) };
      }
    }
    return { startPage: 604, juzNumber: 30 };
  }
  for (let p = 1; p <= 604; p++) {
    if (!oldSet.has(p)) {
      return { startPage: p, juzNumber: getJuzForPage(p) };
    }
  }
  return { startPage: 1, juzNumber: 1 };
}

/**
 * Computes smart default Seven Castles configuration for a student based on their old memorization:
 * 1. If the student has old memorization ranges from both the beginning and the end of the Mushaf:
 *    - If end-side memorized pages > beginning-side memorized pages -> start descending from the page reached at the end.
 *    - Otherwise -> start ascending from the page reached at the beginning.
 * 2. If the student has old memorization only in the end half (> 302) -> start descending from the page reached at the end.
 * 3. If the resulting plan starts in Juz 28, 29, or 30 -> default dailyAmount to JUZ_PER_PLAN (جزء لكل خطة).
 */
export function suggestSmartDefaultPlanStart(oldMemorizedPages: number[]): {
  dailyAmount: DailyAmount;
  sevenCastlesStartMode: 'juz' | 'page';
  juzNumber: number;
  startPage: number;
  isSevenCastlesDescending: boolean;
} {
  const uniquePages = [...new Set(oldMemorizedPages)]
    .filter((p) => p >= 1 && p <= 604)
    .sort((a, b) => a - b);

  if (uniquePages.length === 0) {
    return {
      dailyAmount: DailyAmount.QUARTER_PAGE,
      sevenCastlesStartMode: 'juz',
      juzNumber: 1,
      startPage: 1,
      isSevenCastlesDescending: false,
    };
  }

  const oldSet = new Set(uniquePages);
  const ranges = compressPagesToRanges(uniquePages);

  const findFirstUnmemorizedAscending = (): number => {
    const scanStart = !oldSet.has(1) && oldSet.has(2) ? 2 : 1;
    for (let p = scanStart; p <= 604; p++) {
      if (!oldSet.has(p)) return p;
    }
    return 1;
  };

  const findFirstUnmemorizedDescending = (): number => {
    const scanStart = !oldSet.has(604) && oldSet.has(603) ? 603 : 604;
    for (let p = scanStart; p >= 1; p--) {
      if (!oldSet.has(p)) return p;
    }
    return 604;
  };

  let isDescending = false;
  const firstRange = ranges[0];
  const lastRange = ranges[ranges.length - 1];

  if (firstRange.start > 302) {
    // Only memorized in the second half / end of the Mushaf
    isDescending = true;
  } else if (lastRange.end <= 302) {
    // Only memorized in the first half / beginning of the Mushaf
    isDescending = false;
  } else if (ranges.length === 1) {
    // Single contiguous block crossing the midpoint
    if (firstRange.start <= 2 && lastRange.end < 604) {
      isDescending = false;
    } else if (lastRange.end >= 603 && firstRange.start > 2) {
      isDescending = true;
    } else {
      const startHalfCount = uniquePages.filter((p) => p <= 302).length;
      const endHalfCount = uniquePages.length - startHalfCount;
      isDescending = endHalfCount > startHalfCount;
    }
  } else {
    // Multiple ranges spanning both beginning and end of the Mushaf:
    // Split at the largest unmemorized gap between consecutive ranges
    let splitIdx = 0;
    let maxGap = -1;
    for (let i = 0; i < ranges.length - 1; i++) {
      const gap = ranges[i + 1].start - ranges[i].end - 1;
      if (gap > maxGap) {
        maxGap = gap;
        splitIdx = i;
      }
    }
    let fromStartCount = 0;
    for (let i = 0; i <= splitIdx; i++) {
      fromStartCount += ranges[i].end - ranges[i].start + 1;
    }
    let fromEndCount = 0;
    for (let i = splitIdx + 1; i < ranges.length; i++) {
      fromEndCount += ranges[i].end - ranges[i].start + 1;
    }
    isDescending = fromEndCount > fromStartCount;
  }

  const rawStartPage = isDescending
    ? findFirstUnmemorizedDescending()
    : findFirstUnmemorizedAscending();
  const juzNumber = getJuzForPage(rawStartPage);
  const isLastThreeJuz = juzNumber === 28 || juzNumber === 29 || juzNumber === 30;
  const juzRange = JUZ_PAGES[juzNumber];

  if (isLastThreeJuz) {
    return {
      dailyAmount: DailyAmount.JUZ_PER_PLAN,
      sevenCastlesStartMode: 'juz',
      juzNumber,
      startPage: juzRange
        ? isDescending
          ? juzRange.end
          : juzRange.start
        : rawStartPage,
      isSevenCastlesDescending: isDescending,
    };
  }

  const startsAtJuzBoundary =
    !!juzRange &&
    (isDescending ? rawStartPage === juzRange.end : rawStartPage === juzRange.start);

  return {
    dailyAmount: DailyAmount.QUARTER_PAGE,
    sevenCastlesStartMode: startsAtJuzBoundary ? 'juz' : 'page',
    juzNumber,
    startPage: rawStartPage,
    isSevenCastlesDescending: isDescending,
  };
}

/**
 * Helper to build a complete, ready-to-use SevenCastlesPlan for a student from their existing old memorization ranges.
 */
export function createStudentSevenCastlesPlan(params: {
  studentId?: string | number;
  studentName: string;
  oldMemorizationRanges?: PageRange[];
  oldMemorizedPages?: number[];
  dailyAmount: DailyAmount;
  startDate: string;
  firstDayOfWeek: number;
  dailyFixationRepetitions: number;
  weeklyReviewRepetitions: number;
  isSevenCastlesDescending?: boolean;
  sevenCastlesStartMode?: 'juz' | 'page';
  juzNumber?: number;
  startPage?: number;
}): SevenCastlesPlan {
  const oldPages =
    params.oldMemorizedPages && params.oldMemorizedPages.length > 0
      ? [...new Set(params.oldMemorizedPages)].sort((a, b) => a - b)
      : expandOldMemorizationRanges(params.oldMemorizationRanges || []);
  const oldRanges =
    params.oldMemorizationRanges && params.oldMemorizationRanges.length > 0
      ? params.oldMemorizationRanges
      : compressPagesToRanges(oldPages);

  const isDesc = !!params.isSevenCastlesDescending;
  const isJuzPerPlan = params.dailyAmount === DailyAmount.JUZ_PER_PLAN;
  const startMode: 'juz' | 'page' = isJuzPerPlan ? 'juz' : params.sevenCastlesStartMode || 'juz';

  const suggested = suggestStartForStudent(oldPages, isDesc);
  let juzNum = params.juzNumber ?? suggested.juzNumber;
  if (isJuzPerPlan && (juzNum < 28 || juzNum > 30)) {
    juzNum = 29;
  }

  let startPage = params.startPage ?? suggested.startPage;
  let endPage = isDesc ? 1 : 604;

  if (startMode === 'juz' && JUZ_PAGES[juzNum]) {
    startPage = isDesc ? JUZ_PAGES[juzNum].end : JUZ_PAGES[juzNum].start;
    endPage = isDesc ? JUZ_PAGES[juzNum].start : JUZ_PAGES[juzNum].end;
  } else {
    juzNum = getJuzForPage(startPage);
  }

  const nowIso = new Date().toISOString();
  return {
    id: params.studentId ? `sc-${params.studentId}-${params.startDate}` : `sc-${Date.now()}`,
    studentId: params.studentId,
    studentName: params.studentName,
    name: `خطة القلاع السبع — ${params.studentName}`,
    planType: 'memorization',
    isSevenCastles: true,
    juzNumber: juzNum,
    startPage,
    endPage,
    dailyAmount: params.dailyAmount,
    startDate: params.startDate,
    firstDayOfWeek: params.firstDayOfWeek,
    isSevenCastlesDescending: isDesc,
    sevenCastlesStartMode: startMode,
    dailyFixationRepetitions: Math.max(1, params.dailyFixationRepetitions || 5),
    weeklyReviewRepetitions: Math.max(1, params.weeklyReviewRepetitions || 3),
    hasOldMemorization: oldPages.length > 0,
    oldMemorizationRanges: oldRanges,
    oldMemorizedPages: oldPages,
    oldMemorizationReviewMode: 'auto',
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

// ============================================================================
// CORE SEVEN CASTLES CALCULATION ENGINE (Extracted verbatim from planGenerator)
// ============================================================================

const mergeVerseRanges = (ranges: VerseRange[]): VerseRange[] => {
  if (ranges.length === 0) return [];
  const merged: VerseRange[] = [];
  for (const r of ranges) {
    if (merged.length === 0) {
      merged.push({ ...r });
    } else {
      const last = merged[merged.length - 1];
      if (last.surah === r.surah) {
        last.start = Math.min(last.start, r.start);
        last.end = Math.max(last.end, r.end);
      } else {
        merged.push({ ...r });
      }
    }
  }
  return merged;
};

export function getAdjustedVerseRangeForPage(
  page: number,
  plan?: Partial<SevenCastlesPlan>,
  contextPages?: number[]
): VerseRange[] {
  const originalRanges = getVerseRangeForPage(page);

  if (page === 121) {
    if (contextPages) {
      const hasJuz7Pages = contextPages.some((p) => p > 121 && p <= 141);
      const hasJuz6Pages = contextPages.some((p) => p >= 102 && p < 121);
      if (hasJuz7Pages && !hasJuz6Pages) return [{ surah: 'المائدة', start: 82, end: 82 }];
      if (hasJuz6Pages && !hasJuz7Pages) return [{ surah: 'المائدة', start: 77, end: 81 }];
    }
    if (plan) {
      const isJuz7 = Boolean(plan.startPage && Number(plan.startPage) >= 121);
      const isJuz6 = Boolean(plan.endPage && Number(plan.endPage) <= 121);
      if (isJuz7 && !isJuz6) return [{ surah: 'المائدة', start: 82, end: 82 }];
      if (isJuz6 && !isJuz7) return [{ surah: 'المائدة', start: 77, end: 81 }];
    }
  }

  if (page === 201) {
    if (contextPages) {
      const hasJuz11Pages = contextPages.some((p) => p > 201 && p <= 221);
      const hasJuz10Pages = contextPages.some((p) => p >= 182 && p < 201);
      if (hasJuz11Pages && !hasJuz10Pages) return [{ surah: 'التوبة', start: 93, end: 93 }];
      if (hasJuz10Pages && !hasJuz11Pages) return [{ surah: 'التوبة', start: 87, end: 92 }];
    }
    if (plan) {
      const isJuz11 = Boolean(plan.startPage && Number(plan.startPage) >= 201);
      const isJuz10 = Boolean(plan.endPage && Number(plan.endPage) <= 201);
      if (isJuz11 && !isJuz10) return [{ surah: 'التوبة', start: 93, end: 93 }];
      if (isJuz10 && !isJuz11) return [{ surah: 'التوبة', start: 87, end: 92 }];
    }
  }

  if (page === 502) {
    if (contextPages) {
      const hasJuz26Pages = contextPages.some((p) => p > 502 && p <= 521);
      const hasJuz25Pages = contextPages.some((p) => p >= 482 && p < 502);
      if (hasJuz26Pages && !hasJuz25Pages) return [{ surah: 'الأحقاف', start: 1, end: 5 }];
      if (hasJuz25Pages && !hasJuz26Pages) return [{ surah: 'الجاثية', start: 33, end: 37 }];
    }
    if (plan) {
      const isJuz26 = Boolean(plan.startPage && Number(plan.startPage) >= 502);
      const isJuz25 = Boolean(plan.endPage && Number(plan.endPage) <= 502);
      if (isJuz26 && !isJuz25) return [{ surah: 'الأحقاف', start: 1, end: 5 }];
      if (isJuz25 && !isJuz26) return [{ surah: 'الجاثية', start: 33, end: 37 }];
    }
  }

  return originalRanges;
}

export function getAdjustedPageVerseSubset(
  page: number,
  plan?: Partial<SevenCastlesPlan>,
  contextPages?: number[],
  section?: PageSection
): VerseRange[] {
  const adjustedRanges = getAdjustedVerseRangeForPage(page, plan, contextPages);
  return getVerseSubsetFromRanges(adjustedRanges, section);
}

const formatDetailedPages = (
  pages: number[],
  isCumulative?: boolean,
  plan?: Partial<SevenCastlesPlan>
): string => {
  if (pages.length === 0) return '';
  const uniquePages = [...new Set(pages)].sort((a, b) => a - b);

  const segments: number[][] = [];
  let currentSegment = [uniquePages[0]];
  for (let i = 1; i < uniquePages.length; i++) {
    if (uniquePages[i] === uniquePages[i - 1] + 1) {
      currentSegment.push(uniquePages[i]);
    } else {
      segments.push(currentSegment);
      currentSegment = [uniquePages[i]];
    }
  }
  segments.push(currentSegment);

  return segments
    .map((segment) => {
      const flatRanges: VerseRange[] = [];
      for (const p of segment) {
        flatRanges.push(...getAdjustedVerseRangeForPage(p, plan, segment));
      }
      const merged = mergeVerseRanges(flatRanges);
      let formattedRanges = '';
      if (isCumulative && merged.length > 0) {
        const first = merged[0];
        const last = merged[merged.length - 1];
        const firstSurah = first.surah.replace(/^(?:سورة|سُورَةُ)\s+/, '').trim();
        const lastSurah = last.surah.replace(/^(?:سورة|سُورَةُ)\s+/, '').trim();
        if (firstSurah === lastSurah) {
          formattedRanges =
            first.start === last.end
              ? `سورة ${firstSurah} الآية ${first.start}`
              : `سورة ${firstSurah} من الآية ${first.start} إلى الآية ${last.end}`;
        } else {
          formattedRanges = `من سورة ${firstSurah} الآية ${first.start} إلى سورة ${lastSurah} الآية ${last.end}`;
        }
      } else {
        formattedRanges = formatVerseDescription(merged);
      }

      const minPage = segment[0];
      const maxPage = segment[segment.length - 1];
      return minPage === maxPage
        ? `ص ${minPage} (${formattedRanges})`
        : `ص ${minPage}-${maxPage} (${formattedRanges})`;
    })
    .join('، و');
};

export interface MemorizationUnit {
  title: string;
  pages: number[];
  verseRanges?: VerseRange[];
  weight: number;
  isSurahUnit?: boolean;
}

interface UnitParsed {
  page: number;
  type: 'quarter' | 'half' | 'full' | 'other';
  index: number;
  title: string;
}

function parseUnit(u: { title: string; pages: number[] }): UnitParsed {
  const page = u.pages[0] || 0;
  let type: 'quarter' | 'half' | 'full' | 'other' = 'other';
  let index = 1;

  if (u.title.includes('الربع 1')) {
    type = 'quarter';
    index = 1;
  } else if (u.title.includes('الربع 2')) {
    type = 'quarter';
    index = 2;
  } else if (u.title.includes('الربع 3')) {
    type = 'quarter';
    index = 3;
  } else if (u.title.includes('الربع 4')) {
    type = 'quarter';
    index = 4;
  } else if (u.title.includes('النصف 1')) {
    type = 'half';
    index = 1;
  } else if (u.title.includes('النصف 2')) {
    type = 'half';
    index = 2;
  } else if (/^ص\s+\d+/.test(u.title.trim()) && u.pages.length === 1) {
    type = 'full';
    index = 1;
  }

  return { page, type, index, title: u.title };
}

function getVerseRangesForUnit(u: {
  title: string;
  pages: number[];
  verseRanges?: VerseRange[];
}): VerseRange[] {
  if (u.verseRanges && u.verseRanges.length > 0) {
    return u.verseRanges.map((r) => ({ ...r }));
  }

  const parsedRanges = parseVerseRangesFromArabicText(u.title);
  if (parsedRanges.length > 0) {
    return parsedRanges;
  }

  const parsedJuzs = parseJuzsFromText(u.title);
  let juzRestrictedRanges: VerseRange[] | null = null;
  if (parsedJuzs.length > 0) {
    juzRestrictedRanges = getVerseRangesForJuzs(parsedJuzs);
  }

  const ranges: VerseRange[] = [];
  for (const p of u.pages) {
    const match = u.title.match(/(سورة\s+[^(]+)\s*\(الآيات\s*(\d+)-(\d+)\)/);
    if (match) {
      ranges.push({
        surah: match[1].trim(),
        start: parseInt(match[2], 10),
        end: parseInt(match[3], 10),
      });
      continue;
    }

    let section: PageSection = 'full';
    if (u.title.includes('النصف 1')) section = 'first_half';
    else if (u.title.includes('النصف 2')) section = 'second_half';
    else if (u.title.includes('الربع 1')) section = 'first_quarter';
    else if (u.title.includes('الربع 2')) section = 'second_quarter';
    else if (u.title.includes('الربع 3')) section = 'third_quarter';
    else if (u.title.includes('الربع 4')) section = 'fourth_quarter';

    const subsets = getPageVerseSubset(p, section);
    if (juzRestrictedRanges) {
      subsets.forEach((sub) => {
        juzRestrictedRanges!.forEach((jr) => {
          if (sub.surah === jr.surah) {
            const start = Math.max(sub.start, jr.start);
            const end = Math.min(sub.end, jr.end);
            if (start <= end) ranges.push({ surah: sub.surah, start, end });
          }
        });
      });
    } else {
      ranges.push(...subsets);
    }
  }
  return ranges;
}

export function formatSurahUnitsTitle(
  unitsToFormat: { title: string; pages: number[]; verseRanges?: VerseRange[] }[]
): string {
  if (unitsToFormat.length === 0) return '';
  if (unitsToFormat.length === 1) return unitsToFormat[0].title;

  const rawRanges = unitsToFormat.flatMap((u) => getVerseRangesForUnit(u));
  if (rawRanges.length === 0) {
    return unitsToFormat.map((u) => u.title).join(' و');
  }

  const merged: VerseRange[] = [];
  for (const r of rawRanges) {
    const surahClean = r.surah.replace(/^سورة\s+/, '').trim();
    const last = merged[merged.length - 1];
    if (last && last.surah === surahClean) {
      last.start = Math.min(last.start, r.start);
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ surah: surahClean, start: r.start, end: r.end });
    }
  }

  const isFullSurah = (r: VerseRange): boolean => {
    const meta = SURAH_METADATAList.find((s) => s.name === r.surah);
    return meta ? r.start === 1 && r.end >= meta.endVerse : false;
  };

  const formatSingleRange = (r: VerseRange): string => {
    if (isFullSurah(r)) return `سورة ${r.surah} كاملة (الآيات 1-${r.end})`;
    if (r.start === r.end) return `سورة ${r.surah} (الآية ${r.start})`;
    return `سورة ${r.surah} (الآيات ${r.start}-${r.end})`;
  };

  const parts: string[] = [];
  let i = 0;
  while (i < merged.length) {
    if (isFullSurah(merged[i])) {
      let j = i;
      while (j < merged.length && isFullSurah(merged[j])) j++;
      if (j - i >= 3) {
        const runSlice = merged.slice(i, j);
        const indices = runSlice
          .map((r) => SURAH_METADATAList.findIndex((s) => s.name === r.surah))
          .filter((idx) => idx !== -1);
        if (indices.length >= 2) {
          const startMeta = SURAH_METADATAList[Math.min(...indices)];
          const endMeta = SURAH_METADATAList[Math.max(...indices)];
          parts.push(`من سورة ${startMeta.name} الآية 1 إلى سورة ${endMeta.name} الآية ${endMeta.endVerse}`);
        } else {
          const firstR = merged[i];
          const lastR = merged[j - 1];
          parts.push(`من سورة ${firstR.surah} الآية ${firstR.start} إلى سورة ${lastR.surah} الآية ${lastR.end}`);
        }
        i = j;
        continue;
      }
    }
    parts.push(formatSingleRange(merged[i]));
    i++;
  }

  return parts.join(' و');
}

export function formatUnitsTitle(
  unitsToFormat: { title: string; pages: number[]; verseRanges?: VerseRange[]; isSurahUnit?: boolean }[]
): string {
  if (unitsToFormat.length === 0) return '';
  if (unitsToFormat.some((u) => u.isSurahUnit)) {
    return formatSurahUnitsTitle(unitsToFormat);
  }

  const allQuarterHizb = unitsToFormat.every((u) => u.title.trim().startsWith('الحزب '));
  if (allQuarterHizb) {
    if (unitsToFormat.length === 1) return unitsToFormat[0].title;
    const allVerses = unitsToFormat.flatMap((u) => getVerseRangesForUnit(u));
    const verseRangeText = formatVerseDescription(allVerses);
    const extractHizbPrefix = (t: string) => {
      const m = t.match(/^(الحزب\s+\d+\s*\([^)]+\))/);
      return m ? m[1] : t;
    };
    const firstLabel = extractHizbPrefix(unitsToFormat[0].title);
    const lastLabel = extractHizbPrefix(unitsToFormat[unitsToFormat.length - 1].title);
    return verseRangeText ? `من ${firstLabel} إلى ${lastLabel} (${verseRangeText})` : `${firstLabel} إلى ${lastLabel}`;
  }

  const parsed = unitsToFormat.map((u) => parseUnit(u));
  const allPages = [...new Set(unitsToFormat.flatMap((u) => u.pages))].sort((a, b) => a - b);
  const validParsed = parsed.filter((p) => p.page > 0);

  let allQuarters = validParsed.length > 0 && validParsed.every((p) => p.type === 'quarter');
  let allHalves = validParsed.length > 0 && validParsed.every((p) => p.type === 'half');
  let allFullPages = validParsed.length > 0 && validParsed.every((p) => p.type === 'full');

  const hasFewVersesForSplit = allPages.some((p) => {
    const ranges = getVerseRangeForPage(p);
    let total = 0;
    ranges.forEach((r) => {
      total += r.end - r.start + 1;
    });
    if (allQuarters) return total < 4;
    if (allHalves) return total < 2;
    return total <= 2;
  });

  if (!hasFewVersesForSplit && (allQuarters || allHalves)) {
    allQuarters = false;
    allHalves = false;
    allFullPages = true;
  }

  const minPage = allPages[0];
  const maxPage = allPages[allPages.length - 1];
  let sectionDesc = '';

  if (allQuarters) {
    const quarterWords: Record<number, string> = {
      1: 'الربع الأول',
      2: 'الربع الثاني',
      3: 'الربع الثالث',
      4: 'الربع الرابع',
    };
    if (minPage === maxPage) {
      const idxs = validParsed.map((p) => p.index).sort((a, b) => a - b);
      const startQ = idxs[0];
      const endQ = idxs[idxs.length - 1];
      if (startQ === 1 && endQ === 4) sectionDesc = `ص ${minPage}`;
      else if (startQ === endQ) sectionDesc = `ص ${minPage} ${quarterWords[startQ]}`;
      else sectionDesc = `ص ${minPage} ${quarterWords[startQ]} إلى ${quarterWords[endQ]}`;
    } else {
      const startPageUnits = validParsed.filter((p) => p.page === minPage).sort((a, b) => a.index - b.index);
      const endPageUnits = validParsed.filter((p) => p.page === maxPage).sort((a, b) => a.index - b.index);
      const startQ = startPageUnits[0]?.index || 1;
      const endQ = endPageUnits[endPageUnits.length - 1]?.index || 4;
      sectionDesc = `من ص ${minPage} ${quarterWords[startQ]} إلى ص ${maxPage} ${quarterWords[endQ]}`;
    }
  } else if (allHalves) {
    const halfWords: Record<number, string> = { 1: 'النصف الأول', 2: 'النصف الثاني' };
    if (minPage === maxPage) {
      const idxs = validParsed.map((p) => p.index).sort((a, b) => a - b);
      const startH = idxs[0];
      const endH = idxs[idxs.length - 1];
      if (startH === 1 && endH === 2) sectionDesc = `ص ${minPage}`;
      else if (startH === endH) sectionDesc = `ص ${minPage} ${halfWords[startH]}`;
      else sectionDesc = `ص ${minPage} ${halfWords[startH]} إلى ${halfWords[endH]}`;
    } else {
      const startPageUnits = validParsed.filter((p) => p.page === minPage).sort((a, b) => a.index - b.index);
      const endPageUnits = validParsed.filter((p) => p.page === maxPage).sort((a, b) => a.index - b.index);
      const startH = startPageUnits[0]?.index || 1;
      const endH = endPageUnits[endPageUnits.length - 1]?.index || 2;
      sectionDesc = `من ص ${minPage} ${halfWords[startH]} إلى ص ${maxPage} ${halfWords[endH]}`;
    }
  } else if (allFullPages || allPages.length > 0) {
    sectionDesc = minPage === maxPage ? `ص ${minPage}` : `ص ${minPage} إلى ${maxPage}`;
  }

  const allVerses: VerseRange[] = [];
  for (const u of unitsToFormat) {
    allVerses.push(...getVerseRangesForUnit(u));
  }
  const verseRangeText = formatVerseDescription(allVerses);

  if (sectionDesc) {
    return verseRangeText ? `${sectionDesc} (${verseRangeText})` : sectionDesc;
  }
  if (verseRangeText) return verseRangeText;
  return unitsToFormat.map((u) => u.title).join(' و ');
}

export function getPageUnits(
  p: number,
  pagesPerDay: number,
  plan?: Partial<SevenCastlesPlan>
): MemorizationUnit[] {
  const makeSpecialUnit = (
    title: string,
    pageNum: number,
    weight: number,
    verseRanges: VerseRange[]
  ): MemorizationUnit => ({ title, pages: [pageNum], weight, verseRanges });

  if (p === 1) {
    if (pagesPerDay === 0.25) {
      return [
        makeSpecialUnit('ص 1 (سورة الفاتحة من الآية 1 إلى الآية 3)', 1, 0.25, [{ surah: 'الفاتحة', start: 1, end: 3 }]),
        makeSpecialUnit('ص 1 (سورة الفاتحة من الآية 4 إلى الآية 7)', 1, 0.25, [{ surah: 'الفاتحة', start: 4, end: 7 }]),
      ];
    }
    return [makeSpecialUnit('ص 1 (سورة الفاتحة من الآية 1 إلى الآية 7)', 1, 0.5, [{ surah: 'الفاتحة', start: 1, end: 7 }])];
  }

  if (p === 2) {
    if (pagesPerDay === 0.25) {
      return [
        makeSpecialUnit('ص 2 (النصف 1 - سورة البقرة من الآية 1 إلى الآية 2)', 2, 0.25, [{ surah: 'البقرة', start: 1, end: 2 }]),
        makeSpecialUnit('ص 2 (النصف 2 - سورة البقرة من الآية 3 إلى الآية 5)', 2, 0.25, [{ surah: 'البقرة', start: 3, end: 5 }]),
      ];
    }
    return [makeSpecialUnit('ص 2 (سورة البقرة من الآية 1 إلى الآية 5)', 2, 0.5, [{ surah: 'البقرة', start: 1, end: 5 }])];
  }

  if (p === 587) {
    if (pagesPerDay === 0.25) {
      return [
        makeSpecialUnit('ص 587 (سورة الانفطار من الآية 1 إلى الآية 10)', 587, 0.25, [{ surah: 'الانفطار', start: 1, end: 10 }]),
        makeSpecialUnit('ص 587 (سورة الانفطار من الآية 11 إلى الآية 19)', 587, 0.25, [{ surah: 'الانفطار', start: 11, end: 19 }]),
        makeSpecialUnit('ص 587 (سورة المطففين من الآية 1 إلى الآية 3)', 587, 0.25, [{ surah: 'المطففين', start: 1, end: 3 }]),
        makeSpecialUnit('ص 587 (سورة المطففين من الآية 4 إلى الآية 6)', 587, 0.25, [{ surah: 'المطففين', start: 4, end: 6 }]),
      ];
    } else if (pagesPerDay === 0.5) {
      return [
        makeSpecialUnit('ص 587 (سورة الانفطار من الآية 1 إلى الآية 19)', 587, 0.5, [{ surah: 'الانفطار', start: 1, end: 19 }]),
        makeSpecialUnit('ص 587 (سورة المطففين من الآية 1 إلى الآية 6)', 587, 0.5, [{ surah: 'المطففين', start: 1, end: 6 }]),
      ];
    }
  }

  if (p === 591) {
    if (pagesPerDay === 0.25) {
      return [
        makeSpecialUnit('ص 591 (سورة الطارق من الآية 1 إلى الآية 8)', 591, 0.25, [{ surah: 'الطارق', start: 1, end: 8 }]),
        makeSpecialUnit('ص 591 (سورة الطارق من الآية 9 إلى الآية 17)', 591, 0.25, [{ surah: 'الطارق', start: 9, end: 17 }]),
        makeSpecialUnit('ص 591 (سورة الأعلى من الآية 1 إلى الآية 8)', 591, 0.25, [{ surah: 'الأعلى', start: 1, end: 8 }]),
        makeSpecialUnit('ص 591 (سورة الأعلى من الآية 9 إلى الآية 15)', 591, 0.25, [{ surah: 'الأعلى', start: 9, end: 15 }]),
      ];
    } else if (pagesPerDay === 0.5) {
      return [
        makeSpecialUnit('ص 591 (سورة الطارق من الآية 1 إلى الآية 17)', 591, 0.5, [{ surah: 'الطارق', start: 1, end: 17 }]),
        makeSpecialUnit('ص 591 (سورة الأعلى من الآية 1 إلى الآية 15)', 591, 0.5, [{ surah: 'الأعلى', start: 1, end: 15 }]),
      ];
    }
  }

  if (p === 592) {
    if (pagesPerDay === 0.25) {
      return [
        makeSpecialUnit('ص 592 (سورة الأعلى من الآية 16 إلى الآية 19)', 592, 0.25, [{ surah: 'الأعلى', start: 16, end: 19 }]),
        makeSpecialUnit('ص 592 (سورة الغاشية من الآية 1 إلى الآية 8)', 592, 0.25, [{ surah: 'الغاشية', start: 1, end: 8 }]),
        makeSpecialUnit('ص 592 (سورة الغاشية من الآية 9 إلى الآية 17)', 592, 0.25, [{ surah: 'الغاشية', start: 9, end: 17 }]),
        makeSpecialUnit('ص 592 (سورة الغاشية من الآية 18 إلى الآية 26)', 592, 0.25, [{ surah: 'الغاشية', start: 18, end: 26 }]),
      ];
    } else if (pagesPerDay === 0.5) {
      return [
        makeSpecialUnit('ص 592 (من سورة الأعلى الآية 16 إلى سورة الغاشية الآية 11)', 592, 0.5, [
          { surah: 'الأعلى', start: 16, end: 19 },
          { surah: 'الغاشية', start: 1, end: 11 },
        ]),
        makeSpecialUnit('ص 592 (سورة الغاشية من الآية 12 إلى الآية 26)', 592, 0.5, [{ surah: 'الغاشية', start: 12, end: 26 }]),
      ];
    }
  }

  if (p === 594) {
    if (pagesPerDay === 0.25) {
      return [
        makeSpecialUnit('ص 594 (سورة الفجر من الآية 24 إلى الآية 30)', 594, 0.25, [{ surah: 'الفجر', start: 24, end: 30 }]),
        makeSpecialUnit('ص 594 (سورة البلد من الآية 1 إلى الآية 7)', 594, 0.25, [{ surah: 'البلد', start: 1, end: 7 }]),
        makeSpecialUnit('ص 594 (سورة البلد من الآية 8 إلى الآية 14)', 594, 0.25, [{ surah: 'البلد', start: 8, end: 14 }]),
        makeSpecialUnit('ص 594 (سورة البلد من الآية 15 إلى الآية 20)', 594, 0.25, [{ surah: 'البلد', start: 15, end: 20 }]),
      ];
    } else if (pagesPerDay === 0.5) {
      return [
        makeSpecialUnit('ص 594 (من سورة الفجر الآية 24 إلى سورة البلد الآية 7)', 594, 0.5, [
          { surah: 'الفجر', start: 24, end: 30 },
          { surah: 'البلد', start: 1, end: 7 },
        ]),
        makeSpecialUnit('ص 594 (سورة البلد من الآية 8 إلى الآية 20)', 594, 0.5, [{ surah: 'البلد', start: 8, end: 20 }]),
      ];
    }
  }

  if (p === 595) {
    if (pagesPerDay === 0.25) {
      return [
        makeSpecialUnit('ص 595 (سورة الشمس من الآية 1 إلى الآية 8)', 595, 0.25, [{ surah: 'الشمس', start: 1, end: 8 }]),
        makeSpecialUnit('ص 595 (سورة الشمس من الآية 9 إلى الآية 15)', 595, 0.25, [{ surah: 'الشمس', start: 9, end: 15 }]),
        makeSpecialUnit('ص 595 (سورة الليل من الآية 1 إلى الآية 7)', 595, 0.25, [{ surah: 'الليل', start: 1, end: 7 }]),
        makeSpecialUnit('ص 595 (سورة الليل من الآية 8 إلى الآية 14)', 595, 0.25, [{ surah: 'الليل', start: 8, end: 14 }]),
      ];
    } else if (pagesPerDay === 0.5) {
      return [
        makeSpecialUnit('ص 595 (سورة الشمس من الآية 1 إلى الآية 15)', 595, 0.5, [{ surah: 'الشمس', start: 1, end: 15 }]),
        makeSpecialUnit('ص 595 (سورة الليل من الآية 1 إلى الآية 14)', 595, 0.5, [{ surah: 'الليل', start: 1, end: 14 }]),
      ];
    }
  }

  if (p === 596) {
    return [
      makeSpecialUnit('ص 596 (سورة الليل من الآية 15 إلى الآية 21)', 596, 0.25, [{ surah: 'الليل', start: 15, end: 21 }]),
      makeSpecialUnit('ص 596 (سورة الضحى من الآية 1 إلى الآية 11)', 596, 0.25, [{ surah: 'الضحى', start: 1, end: 11 }]),
      makeSpecialUnit('ص 596 (سورة الشرح من الآية 1 إلى الآية 8)', 596, 0.25, [{ surah: 'الشرح', start: 1, end: 8 }]),
    ];
  }

  if (p === 597) {
    if (pagesPerDay === 0.25) {
      return [
        makeSpecialUnit('ص 597 (سورة التين من الآية 1 إلى الآية 8)', 597, 0.25, [{ surah: 'التين', start: 1, end: 8 }]),
        makeSpecialUnit('ص 597 (سورة العلق من الآية 1 إلى الآية 8)', 597, 0.25, [{ surah: 'العلق', start: 1, end: 8 }]),
        makeSpecialUnit('ص 597 (سورة العلق من الآية 9 إلى الآية 19)', 597, 0.25, [{ surah: 'العلق', start: 9, end: 19 }]),
      ];
    }
    return [
      makeSpecialUnit('ص 597 (سورة التين من الآية 1 إلى الآية 8)', 597, 0.25, [{ surah: 'التين', start: 1, end: 8 }]),
      makeSpecialUnit('ص 597 (سورة العلق من الآية 1 إلى الآية 19)', 597, 0.5, [{ surah: 'العلق', start: 1, end: 19 }]),
    ];
  }

  if (p === 598) {
    return [
      makeSpecialUnit('ص 598 (سورة القدر من الآية 1 إلى الآية 5)', 598, 0.25, [{ surah: 'القدر', start: 1, end: 5 }]),
      makeSpecialUnit('ص 598 (سورة البينة من الآية 1 إلى الآية 7)', 598, 0.25, [{ surah: 'البينة', start: 1, end: 7 }]),
    ];
  }

  if (p === 599) {
    return [
      makeSpecialUnit('ص 599 (سورة البينة الآية 8)', 599, 0.25, [{ surah: 'البينة', start: 8, end: 8 }]),
      makeSpecialUnit('ص 599 (سورة الزلزلة من الآية 1 إلى الآية 8)', 599, 0.25, [{ surah: 'الزلزلة', start: 1, end: 8 }]),
      makeSpecialUnit('ص 599 (سورة العاديات من الآية 1 إلى الآية 9)', 599, 0.25, [{ surah: 'العاديات', start: 1, end: 9 }]),
    ];
  }

  if (p === 600) {
    return [
      makeSpecialUnit('ص 600 (سورة العاديات من الآية 10 إلى الآية 11)', 600, 0.25, [{ surah: 'العاديات', start: 10, end: 11 }]),
      makeSpecialUnit('ص 600 (سورة القارعة من الآية 1 إلى الآية 11)', 600, 0.25, [{ surah: 'القارعة', start: 1, end: 11 }]),
      makeSpecialUnit('ص 600 (سورة التكاثر من الآية 1 إلى الآية 8)', 600, 0.25, [{ surah: 'التكاثر', start: 1, end: 8 }]),
    ];
  }

  if (p === 601) {
    return [
      makeSpecialUnit('ص 601 (سورة العصر من الآية 1 إلى الآية 3)', 601, 0.25, [{ surah: 'العصر', start: 1, end: 3 }]),
      makeSpecialUnit('ص 601 (سورة الهمزة من الآية 1 إلى الآية 9)', 601, 0.25, [{ surah: 'الهمزة', start: 1, end: 9 }]),
      makeSpecialUnit('ص 601 (سورة الفيل من الآية 1 إلى الآية 5)', 601, 0.25, [{ surah: 'الفيل', start: 1, end: 5 }]),
    ];
  }

  if (p === 602) {
    return [
      makeSpecialUnit('ص 602 (سورة قريش من الآية 1 إلى الآية 4)', 602, 0.25, [{ surah: 'قريش', start: 1, end: 4 }]),
      makeSpecialUnit('ص 602 (سورة الماعون من الآية 1 إلى الآية 7)', 602, 0.25, [{ surah: 'الماعون', start: 1, end: 7 }]),
      makeSpecialUnit('ص 602 (سورة الكوثر من الآية 1 إلى الآية 3)', 602, 0.25, [{ surah: 'الكوثر', start: 1, end: 3 }]),
    ];
  }

  if (p === 603) {
    return [
      makeSpecialUnit('ص 603 (سورة الكافرون من الآية 1 إلى الآية 6)', 603, 0.25, [{ surah: 'الكافرون', start: 1, end: 6 }]),
      makeSpecialUnit('ص 603 (سورة النصر من الآية 1 إلى الآية 3)', 603, 0.25, [{ surah: 'النصر', start: 1, end: 3 }]),
      makeSpecialUnit('ص 603 (سورة المسد من الآية 1 إلى الآية 5)', 603, 0.25, [{ surah: 'المسد', start: 1, end: 5 }]),
    ];
  }

  if (p === 604) {
    return [
      makeSpecialUnit('ص 604 (سورة الإخلاص من الآية 1 إلى الآية 4)', 604, 0.25, [{ surah: 'الإخلاص', start: 1, end: 4 }]),
      makeSpecialUnit('ص 604 (سورة الفلق من الآية 1 إلى الآية 5)', 604, 0.25, [{ surah: 'الفلق', start: 1, end: 5 }]),
      makeSpecialUnit('ص 604 (سورة الناس من الآية 1 إلى الآية 6)', 604, 0.25, [{ surah: 'الناس', start: 1, end: 6 }]),
    ];
  }

  if (pagesPerDay === 0.5) {
    const h1 = getAdjustedPageVerseSubset(p, plan, [p], 'first_half');
    const h2 = getAdjustedPageVerseSubset(p, plan, [p], 'second_half');
    return [
      { title: `ص ${p} (النصف 1 - ${formatVerseDescription(h1)})`, pages: [p], weight: 0.5, verseRanges: h1 },
      { title: `ص ${p} (النصف 2 - ${formatVerseDescription(h2)})`, pages: [p], weight: 0.5, verseRanges: h2 },
    ];
  } else if (pagesPerDay === 0.25) {
    const q1 = getAdjustedPageVerseSubset(p, plan, [p], 'first_quarter');
    const q2 = getAdjustedPageVerseSubset(p, plan, [p], 'second_quarter');
    const q3 = getAdjustedPageVerseSubset(p, plan, [p], 'third_quarter');
    const q4 = getAdjustedPageVerseSubset(p, plan, [p], 'fourth_quarter');
    return [
      { title: `ص ${p} (الربع 1 - ${formatVerseDescription(q1)})`, pages: [p], weight: 0.25, verseRanges: q1 },
      { title: `ص ${p} (الربع 2 - ${formatVerseDescription(q2)})`, pages: [p], weight: 0.25, verseRanges: q2 },
      { title: `ص ${p} (الربع 3 - ${formatVerseDescription(q3)})`, pages: [p], weight: 0.25, verseRanges: q3 },
      { title: `ص ${p} (الربع 4 - ${formatVerseDescription(q4)})`, pages: [p], weight: 0.25, verseRanges: q4 },
    ];
  } else {
    const full = getAdjustedPageVerseSubset(p, plan, [p], 'full');
    return [{ title: `ص ${p} (${formatVerseDescription(full)})`, pages: [p], weight: 1.0, verseRanges: full }];
  }
}

export function getSevenCastlesJuzForPlan(plan?: Partial<SevenCastlesPlan>): number {
  if (!plan) return 29;
  if (plan.juzNumber && plan.juzNumber >= 28 && plan.juzNumber <= 30) {
    return plan.juzNumber;
  }
  const sp = Number(plan.startPage || 562);
  if (sp >= 542 && sp <= 561) return 28;
  if (sp >= 562 && sp <= 581) return 29;
  if (sp >= 582 && sp <= 604) return 30;
  return 29;
}

export function getSevenCastlesJuzSurahUnits(juzNum: number, isDescending: boolean): MemorizationUnit[] {
  const makePart = (title: string, pages: number[], verseRanges: VerseRange[]): MemorizationUnit => ({
    title,
    pages,
    verseRanges,
    weight: 1,
    isSurahUnit: true,
  });

  if (juzNum === 28) {
    const weeksAscending: MemorizationUnit[][] = [
      [
        makePart('سورة المجادلة (الآيات 1-6)', [542], [{ surah: 'المجادلة', start: 1, end: 6 }]),
        makePart('سورة المجادلة (الآيات 7-11)', [543], [{ surah: 'المجادلة', start: 7, end: 11 }]),
        makePart('سورة المجادلة (الآيات 12-16)', [544], [{ surah: 'المجادلة', start: 12, end: 16 }]),
        makePart('سورة المجادلة (الآيات 17-22)', [544, 545], [{ surah: 'المجادلة', start: 17, end: 22 }]),
      ],
      [
        makePart('سورة الحشر (الآيات 1-5)', [545, 546], [{ surah: 'الحشر', start: 1, end: 5 }]),
        makePart('سورة الحشر (الآيات 6-9)', [546], [{ surah: 'الحشر', start: 6, end: 9 }]),
        makePart('سورة الحشر (الآيات 10-16)', [547], [{ surah: 'الحشر', start: 10, end: 16 }]),
        makePart('سورة الحشر (الآيات 17-24)', [548], [{ surah: 'الحشر', start: 17, end: 24 }]),
      ],
      [
        makePart('سورة الممتحنة (الآيات 1-3)', [549], [{ surah: 'الممتحنة', start: 1, end: 3 }]),
        makePart('سورة الممتحنة (الآيات 4-6)', [549, 550], [{ surah: 'الممتحنة', start: 4, end: 6 }]),
        makePart('سورة الممتحنة (الآيات 7-9)', [550], [{ surah: 'الممتحنة', start: 7, end: 9 }]),
        makePart('سورة الممتحنة (الآيات 10-13)', [550, 551], [{ surah: 'الممتحنة', start: 10, end: 13 }]),
      ],
      [
        makePart('سورة الصف (الآيات 1-4)', [551], [{ surah: 'الصف', start: 1, end: 4 }]),
        makePart('سورة الصف (الآيات 5-7)', [551, 552], [{ surah: 'الصف', start: 5, end: 7 }]),
        makePart('سورة الصف (الآيات 8-11)', [552], [{ surah: 'الصف', start: 8, end: 11 }]),
        makePart('سورة الصف (الآيات 12-14)', [552], [{ surah: 'الصف', start: 12, end: 14 }]),
      ],
      [
        makePart('سورة الجمعة (الآيات 1-4)', [553], [{ surah: 'الجمعة', start: 1, end: 4 }]),
        makePart('سورة الجمعة (الآيات 5-8)', [553], [{ surah: 'الجمعة', start: 5, end: 8 }]),
        makePart('سورة الجمعة (الآيات 9-10)', [554], [{ surah: 'الجمعة', start: 9, end: 10 }]),
        makePart('سورة الجمعة (الآية 11)', [554], [{ surah: 'الجمعة', start: 11, end: 11 }]),
      ],
      [
        makePart('سورة المنافقون (الآيات 1-4)', [554], [{ surah: 'المنافقون', start: 1, end: 4 }]),
        makePart('سورة المنافقون (الآيات 5-6)', [555], [{ surah: 'المنافقون', start: 5, end: 6 }]),
        makePart('سورة المنافقون (الآيات 7-8)', [555], [{ surah: 'المنافقون', start: 7, end: 8 }]),
        makePart('سورة المنافقون (الآيات 9-11)', [555], [{ surah: 'المنافقون', start: 9, end: 11 }]),
      ],
      [
        makePart('سورة التغابن (الآيات 1-5)', [556], [{ surah: 'التغابن', start: 1, end: 5 }]),
        makePart('سورة التغابن (الآيات 6-9)', [556], [{ surah: 'التغابن', start: 6, end: 9 }]),
        makePart('سورة التغابن (الآيات 10-13)', [557], [{ surah: 'التغابن', start: 10, end: 13 }]),
        makePart('سورة التغابن (الآيات 14-18)', [557], [{ surah: 'التغابن', start: 14, end: 18 }]),
      ],
      [
        makePart('سورة الطلاق (الآيات 1-2)', [558], [{ surah: 'الطلاق', start: 1, end: 2 }]),
        makePart('سورة الطلاق (الآيات 3-5)', [558], [{ surah: 'الطلاق', start: 3, end: 5 }]),
        makePart('سورة الطلاق (الآيات 6-9)', [559], [{ surah: 'الطلاق', start: 6, end: 9 }]),
        makePart('سورة الطلاق (الآيات 10-12)', [559], [{ surah: 'الطلاق', start: 10, end: 12 }]),
      ],
      [
        makePart('سورة التحريم (الآيات 1-4)', [560], [{ surah: 'التحريم', start: 1, end: 4 }]),
        makePart('سورة التحريم (الآيات 5-7)', [560], [{ surah: 'التحريم', start: 5, end: 7 }]),
        makePart('سورة التحريم (الآيات 8-9)', [561], [{ surah: 'التحريم', start: 8, end: 9 }]),
        makePart('سورة التحريم (الآيات 10-12)', [561], [{ surah: 'التحريم', start: 10, end: 12 }]),
      ],
    ];
    return (isDescending ? [...weeksAscending].reverse() : weeksAscending).flat();
  }

  if (juzNum === 30) {
    if (!isDescending) {
      const weeksAscending: MemorizationUnit[][] = [
        [
          makePart('سورة النبأ (الآيات 1-16)', [582], [{ surah: 'النبأ', start: 1, end: 16 }]),
          makePart('سورة النبأ (الآيات 17-30)', [582], [{ surah: 'النبأ', start: 17, end: 30 }]),
          makePart('سورة النبأ (الآيات 31-36)', [583], [{ surah: 'النبأ', start: 31, end: 36 }]),
          makePart('سورة النبأ (الآيات 37-40)', [583], [{ surah: 'النبأ', start: 37, end: 40 }]),
        ],
        [
          makePart('سورة النازعات (الآيات 1-14)', [583], [{ surah: 'النازعات', start: 1, end: 14 }]),
          makePart('سورة النازعات (الآيات 15-26)', [584], [{ surah: 'النازعات', start: 15, end: 26 }]),
          makePart('سورة النازعات (الآيات 27-39)', [584], [{ surah: 'النازعات', start: 27, end: 39 }]),
          makePart('سورة النازعات (الآيات 40-46)', [584], [{ surah: 'النازعات', start: 40, end: 46 }]),
        ],
        [
          makePart('سورة عبس (الآيات 1-23)', [585], [{ surah: 'عبس', start: 1, end: 23 }]),
          makePart('سورة عبس (الآيات 24-42)', [585], [{ surah: 'عبس', start: 24, end: 42 }]),
          makePart('سورة التكوير (الآيات 1-14)', [586], [{ surah: 'التكوير', start: 1, end: 14 }]),
          makePart('سورة التكوير (الآيات 15-29)', [586], [{ surah: 'التكوير', start: 15, end: 29 }]),
        ],
        [
          makePart('سورة الانفطار (الآيات 1-10)', [587], [{ surah: 'الانفطار', start: 1, end: 10 }]),
          makePart('سورة الانفطار (الآيات 11-19)', [587], [{ surah: 'الانفطار', start: 11, end: 19 }]),
          makePart('سورة المطففين (الآيات 1-17)', [587, 588], [{ surah: 'المطففين', start: 1, end: 17 }]),
          makePart('سورة المطففين (الآيات 18-36)', [588, 589], [{ surah: 'المطففين', start: 18, end: 36 }]),
        ],
        [
          makePart('سورة الانشقاق (الآيات 1-15)', [589], [{ surah: 'الانشقاق', start: 1, end: 15 }]),
          makePart('سورة الانشقاق (الآيات 16-25)', [589], [{ surah: 'الانشقاق', start: 16, end: 25 }]),
          makePart('سورة البروج (الآيات 1-11)', [590], [{ surah: 'البروج', start: 1, end: 11 }]),
          makePart('سورة البروج (الآيات 12-22)', [590], [{ surah: 'البروج', start: 12, end: 22 }]),
        ],
        [
          makePart('من سورة الطارق الآية 1 إلى سورة الأعلى الآية 19', [591, 592], [
            { surah: 'الطارق', start: 1, end: 17 },
            { surah: 'الأعلى', start: 1, end: 19 },
          ]),
          makePart('سورة الغاشية كاملة (الآيات 1-26)', [592], [{ surah: 'الغاشية', start: 1, end: 26 }]),
          makePart('سورة الفجر (الآيات 1-16)', [593], [{ surah: 'الفجر', start: 1, end: 16 }]),
          makePart('سورة الفجر (الآيات 17-30)', [593, 594], [{ surah: 'الفجر', start: 17, end: 30 }]),
        ],
        [
          makePart('سورة البلد كاملة (الآيات 1-20)', [594], [{ surah: 'البلد', start: 1, end: 20 }]),
          makePart('سورة الشمس كاملة (الآيات 1-15)', [595], [{ surah: 'الشمس', start: 1, end: 15 }]),
          makePart('سورة الليل كاملة (الآيات 1-21)', [595, 596], [{ surah: 'الليل', start: 1, end: 21 }]),
          makePart('من سورة الضحى الآية 1 إلى سورة الشرح الآية 8', [596], [
            { surah: 'الضحى', start: 1, end: 11 },
            { surah: 'الشرح', start: 1, end: 8 },
          ]),
        ],
        [
          makePart('من سورة التين الآية 1 إلى سورة العلق الآية 19', [597], [
            { surah: 'التين', start: 1, end: 8 },
            { surah: 'العلق', start: 1, end: 19 },
          ]),
          makePart('من سورة القدر الآية 1 إلى سورة البينة الآية 8', [598, 599], [
            { surah: 'القدر', start: 1, end: 5 },
            { surah: 'البينة', start: 1, end: 8 },
          ]),
          makePart('من سورة الزلزلة الآية 1 إلى سورة العاديات الآية 11', [599, 600], [
            { surah: 'الزلزلة', start: 1, end: 8 },
            { surah: 'العاديات', start: 1, end: 11 },
          ]),
          makePart('من سورة القارعة الآية 1 إلى سورة التكاثر الآية 8', [600], [
            { surah: 'القارعة', start: 1, end: 11 },
            { surah: 'التكاثر', start: 1, end: 8 },
          ]),
        ],
        [
          makePart('ص 601 (من سورة العصر الآية 1 إلى سورة الفيل الآية 5)', [601], [
            { surah: 'العصر', start: 1, end: 3 },
            { surah: 'الهمزة', start: 1, end: 9 },
            { surah: 'الفيل', start: 1, end: 5 },
          ]),
          makePart('ص 602 (من سورة قريش الآية 1 إلى سورة الكوثر الآية 3)', [602], [
            { surah: 'قريش', start: 1, end: 4 },
            { surah: 'الماعون', start: 1, end: 7 },
            { surah: 'الكوثر', start: 1, end: 3 },
          ]),
          makePart('ص 603 (من سورة الكافرون الآية 1 إلى سورة المسد الآية 5)', [603], [
            { surah: 'الكافرون', start: 1, end: 6 },
            { surah: 'النصر', start: 1, end: 3 },
            { surah: 'المسد', start: 1, end: 5 },
          ]),
          makePart('ص 604 (من سورة الإخلاص الآية 1 إلى سورة الناس الآية 6)', [604], [
            { surah: 'الإخلاص', start: 1, end: 4 },
            { surah: 'الفلق', start: 1, end: 5 },
            { surah: 'الناس', start: 1, end: 6 },
          ]),
        ],
      ];
      return weeksAscending.flat();
    } else {
      const weeksDescending: MemorizationUnit[][] = [
        [
          makePart('ص 604 (من سورة الإخلاص الآية 1 إلى سورة الناس الآية 6)', [604], [
            { surah: 'الإخلاص', start: 1, end: 4 },
            { surah: 'الفلق', start: 1, end: 5 },
            { surah: 'الناس', start: 1, end: 6 },
          ]),
          makePart('ص 603 (من سورة الكافرون الآية 1 إلى سورة المسد الآية 5)', [603], [
            { surah: 'الكافرون', start: 1, end: 6 },
            { surah: 'النصر', start: 1, end: 3 },
            { surah: 'المسد', start: 1, end: 5 },
          ]),
          makePart('ص 602 (من سورة قريش الآية 1 إلى سورة الكوثر الآية 3)', [602], [
            { surah: 'قريش', start: 1, end: 4 },
            { surah: 'الماعون', start: 1, end: 7 },
            { surah: 'الكوثر', start: 1, end: 3 },
          ]),
          makePart('ص 601 (من سورة العصر الآية 1 إلى سورة الفيل الآية 5)', [601], [
            { surah: 'العصر', start: 1, end: 3 },
            { surah: 'الهمزة', start: 1, end: 9 },
            { surah: 'الفيل', start: 1, end: 5 },
          ]),
        ],
        [
          makePart('من سورة القارعة الآية 1 إلى سورة التكاثر الآية 8', [600], [
            { surah: 'القارعة', start: 1, end: 11 },
            { surah: 'التكاثر', start: 1, end: 8 },
          ]),
          makePart('من سورة الزلزلة الآية 1 إلى سورة العاديات الآية 11', [599, 600], [
            { surah: 'الزلزلة', start: 1, end: 8 },
            { surah: 'العاديات', start: 1, end: 11 },
          ]),
          makePart('من سورة القدر الآية 1 إلى سورة البينة الآية 8', [598, 599], [
            { surah: 'القدر', start: 1, end: 5 },
            { surah: 'البينة', start: 1, end: 8 },
          ]),
          makePart('من سورة التين الآية 1 إلى سورة العلق الآية 19', [597], [
            { surah: 'التين', start: 1, end: 8 },
            { surah: 'العلق', start: 1, end: 19 },
          ]),
        ],
        [
          makePart('من سورة الضحى الآية 1 إلى سورة الشرح الآية 8', [596], [
            { surah: 'الضحى', start: 1, end: 11 },
            { surah: 'الشرح', start: 1, end: 8 },
          ]),
          makePart('سورة الليل كاملة (الآيات 1-21)', [595, 596], [{ surah: 'الليل', start: 1, end: 21 }]),
          makePart('سورة الشمس كاملة (الآيات 1-15)', [595], [{ surah: 'الشمس', start: 1, end: 15 }]),
          makePart('سورة البلد كاملة (الآيات 1-20)', [594], [{ surah: 'البلد', start: 1, end: 20 }]),
        ],
        [
          makePart('سورة الفجر (الآيات 1-16)', [593], [{ surah: 'الفجر', start: 1, end: 16 }]),
          makePart('سورة الفجر (الآيات 17-30)', [593, 594], [{ surah: 'الفجر', start: 17, end: 30 }]),
          makePart('سورة الغاشية كاملة (الآيات 1-26)', [592], [{ surah: 'الغاشية', start: 1, end: 26 }]),
          makePart('من سورة الطارق الآية 1 إلى سورة الأعلى الآية 19', [591, 592], [
            { surah: 'الطارق', start: 1, end: 17 },
            { surah: 'الأعلى', start: 1, end: 19 },
          ]),
        ],
        [
          makePart('سورة البروج (الآيات 1-11)', [590], [{ surah: 'البروج', start: 1, end: 11 }]),
          makePart('سورة البروج (الآيات 12-22)', [590], [{ surah: 'البروج', start: 12, end: 22 }]),
          makePart('سورة الانشقاق (الآيات 1-15)', [589], [{ surah: 'الانشقاق', start: 1, end: 15 }]),
          makePart('سورة الانشقاق (الآيات 16-25)', [589], [{ surah: 'الانشقاق', start: 16, end: 25 }]),
        ],
        [
          makePart('سورة المطففين (الآيات 1-17)', [587, 588], [{ surah: 'المطففين', start: 1, end: 17 }]),
          makePart('سورة المطففين (الآيات 18-36)', [588, 589], [{ surah: 'المطففين', start: 18, end: 36 }]),
          makePart('سورة الانفطار (الآيات 1-10)', [587], [{ surah: 'الانفطار', start: 1, end: 10 }]),
          makePart('سورة الانفطار (الآيات 11-19)', [587], [{ surah: 'الانفطار', start: 11, end: 19 }]),
        ],
        [
          makePart('سورة التكوير (الآيات 1-14)', [586], [{ surah: 'التكوير', start: 1, end: 14 }]),
          makePart('سورة التكوير (الآيات 15-29)', [586], [{ surah: 'التكوير', start: 15, end: 29 }]),
          makePart('سورة عبس (الآيات 1-23)', [585], [{ surah: 'عبس', start: 1, end: 23 }]),
          makePart('سورة عبس (الآيات 24-42)', [585], [{ surah: 'عبس', start: 24, end: 42 }]),
        ],
        [
          makePart('سورة النازعات (الآيات 1-14)', [583], [{ surah: 'النازعات', start: 1, end: 14 }]),
          makePart('سورة النازعات (الآيات 15-26)', [584], [{ surah: 'النازعات', start: 15, end: 26 }]),
          makePart('سورة النازعات (الآيات 27-39)', [584], [{ surah: 'النازعات', start: 27, end: 39 }]),
          makePart('سورة النازعات (الآيات 40-46)', [584], [{ surah: 'النازعات', start: 40, end: 46 }]),
        ],
        [
          makePart('سورة النبأ (الآيات 1-16)', [582], [{ surah: 'النبأ', start: 1, end: 16 }]),
          makePart('سورة النبأ (الآيات 17-30)', [582], [{ surah: 'النبأ', start: 17, end: 30 }]),
          makePart('سورة النبأ (الآيات 31-36)', [583], [{ surah: 'النبأ', start: 31, end: 36 }]),
          makePart('سورة النبأ (الآيات 37-40)', [583], [{ surah: 'النبأ', start: 37, end: 40 }]),
        ],
      ];
      return weeksDescending.flat();
    }
  }

  // الجزء 29 (تبارك): 11 سورة = 11 أسبوعاً (44 يوم حفظ)
  const weeksJuz29Ascending: MemorizationUnit[][] = [
    [
      makePart('سورة الملك (الآيات 1-8)', [562], [{ surah: 'الملك', start: 1, end: 8 }]),
      makePart('سورة الملك (الآيات 9-15)', [562, 563], [{ surah: 'الملك', start: 9, end: 15 }]),
      makePart('سورة الملك (الآيات 16-23)', [563], [{ surah: 'الملك', start: 16, end: 23 }]),
      makePart('سورة الملك (الآيات 24-30)', [563, 564], [{ surah: 'الملك', start: 24, end: 30 }]),
    ],
    [
      makePart('سورة القلم (الآيات 1-15)', [564], [{ surah: 'القلم', start: 1, end: 15 }]),
      makePart('سورة القلم (الآيات 16-33)', [565], [{ surah: 'القلم', start: 16, end: 33 }]),
      makePart('سورة القلم (الآيات 34-42)', [565], [{ surah: 'القلم', start: 34, end: 42 }]),
      makePart('سورة القلم (الآيات 43-52)', [566], [{ surah: 'القلم', start: 43, end: 52 }]),
    ],
    [
      makePart('سورة الحاقة (الآيات 1-12)', [566, 567], [{ surah: 'الحاقة', start: 1, end: 12 }]),
      makePart('سورة الحاقة (الآيات 13-24)', [567], [{ surah: 'الحاقة', start: 13, end: 24 }]),
      makePart('سورة الحاقة (الآيات 25-37)', [567, 568], [{ surah: 'الحاقة', start: 25, end: 37 }]),
      makePart('سورة الحاقة (الآيات 38-52)', [568], [{ surah: 'الحاقة', start: 38, end: 52 }]),
    ],
    [
      makePart('سورة المعارج (الآيات 1-10)', [568], [{ surah: 'المعارج', start: 1, end: 10 }]),
      makePart('سورة المعارج (الآيات 11-25)', [569], [{ surah: 'المعارج', start: 11, end: 25 }]),
      makePart('سورة المعارج (الآيات 26-39)', [569], [{ surah: 'المعارج', start: 26, end: 39 }]),
      makePart('سورة المعارج (الآيات 40-44)', [570], [{ surah: 'المعارج', start: 40, end: 44 }]),
    ],
    [
      makePart('سورة نوح (الآيات 1-7)', [570], [{ surah: 'نوح', start: 1, end: 7 }]),
      makePart('سورة نوح (الآيات 8-14)', [570, 571], [{ surah: 'نوح', start: 8, end: 14 }]),
      makePart('سورة نوح (الآيات 15-21)', [571], [{ surah: 'نوح', start: 15, end: 21 }]),
      makePart('سورة نوح (الآيات 22-28)', [571], [{ surah: 'نوح', start: 22, end: 28 }]),
    ],
    [
      makePart('سورة الجن (الآيات 1-7)', [572], [{ surah: 'الجن', start: 1, end: 7 }]),
      makePart('سورة الجن (الآيات 8-13)', [572], [{ surah: 'الجن', start: 8, end: 13 }]),
      makePart('سورة الجن (الآيات 14-20)', [573], [{ surah: 'الجن', start: 14, end: 20 }]),
      makePart('سورة الجن (الآيات 21-28)', [573], [{ surah: 'الجن', start: 21, end: 28 }]),
    ],
    [
      makePart('سورة المزمل (الآيات 1-9)', [574], [{ surah: 'المزمل', start: 1, end: 9 }]),
      makePart('سورة المزمل (الآيات 10-15)', [574], [{ surah: 'المزمل', start: 10, end: 15 }]),
      makePart('سورة المزمل (الآيات 16-19)', [574], [{ surah: 'المزمل', start: 16, end: 19 }]),
      makePart('سورة المزمل (الآية 20)', [575], [{ surah: 'المزمل', start: 20, end: 20 }]),
    ],
    [
      makePart('سورة المدثر (الآيات 1-17)', [575], [{ surah: 'المدثر', start: 1, end: 17 }]),
      makePart('سورة المدثر (الآيات 18-31)', [576], [{ surah: 'المدثر', start: 18, end: 31 }]),
      makePart('سورة المدثر (الآيات 32-47)', [576], [{ surah: 'المدثر', start: 32, end: 47 }]),
      makePart('سورة المدثر (الآيات 48-56)', [577], [{ surah: 'المدثر', start: 48, end: 56 }]),
    ],
    [
      makePart('سورة القيامة (الآيات 1-10)', [577], [{ surah: 'القيامة', start: 1, end: 10 }]),
      makePart('سورة القيامة (الآيات 11-19)', [577], [{ surah: 'القيامة', start: 11, end: 19 }]),
      makePart('سورة القيامة (الآيات 20-30)', [578], [{ surah: 'القيامة', start: 20, end: 30 }]),
      makePart('سورة القيامة (الآيات 31-40)', [578], [{ surah: 'القيامة', start: 31, end: 40 }]),
    ],
    [
      makePart('سورة الإنسان (الآيات 1-8)', [578, 579], [{ surah: 'الإنسان', start: 1, end: 8 }]),
      makePart('سورة الإنسان (الآيات 9-16)', [579], [{ surah: 'الإنسان', start: 9, end: 16 }]),
      makePart('سورة الإنسان (الآيات 17-25)', [579], [{ surah: 'الإنسان', start: 17, end: 25 }]),
      makePart('سورة الإنسان (الآيات 26-31)', [580], [{ surah: 'الإنسان', start: 26, end: 31 }]),
    ],
    [
      makePart('سورة المرسلات (الآيات 1-15)', [580], [{ surah: 'المرسلات', start: 1, end: 15 }]),
      makePart('سورة المرسلات (الآيات 16-28)', [580, 581], [{ surah: 'المرسلات', start: 16, end: 28 }]),
      makePart('سورة المرسلات (الآيات 29-40)', [581], [{ surah: 'المرسلات', start: 29, end: 40 }]),
      makePart('سورة المرسلات (الآيات 41-50)', [581], [{ surah: 'المرسلات', start: 41, end: 50 }]),
    ],
  ];
  return (isDescending ? [...weeksJuz29Ascending].reverse() : weeksJuz29Ascending).flat();
}

export function getMemorizationUnits(
  pagesToMemorize: number[],
  pagesPerDay: number,
  plan?: Partial<SevenCastlesPlan>
): MemorizationUnit[] {
  if (plan?.dailyAmount === DailyAmount.JUZ_PER_PLAN) {
    const juzNum = getSevenCastlesJuzForPlan(plan);
    return getSevenCastlesJuzSurahUnits(juzNum, !!plan.isSevenCastlesDescending);
  }

  const allUnits: MemorizationUnit[] = [];

  if (pagesPerDay === 2.5) {
    const isDescending = pagesToMemorize.length >= 2 && pagesToMemorize[0] > pagesToMemorize[1];
    const sortedPages = [...pagesToMemorize].sort((a, b) => a - b);

    const matchingQuarters = QURAN_QUARTERS.filter((q) => {
      for (let p = q.startPage; p <= q.endPage; p++) {
        if (sortedPages.includes(p)) return true;
      }
      return false;
    });

    if (isDescending) matchingQuarters.reverse();

    matchingQuarters.forEach((q) => {
      const overlappingPages: number[] = [];
      for (let p = q.startPage; p <= q.endPage; p++) {
        if (sortedPages.includes(p)) overlappingPages.push(p);
      }
      if (overlappingPages.length > 0) {
        if (isDescending) overlappingPages.reverse();
        const hizbNum = Math.floor((q.number - 1) / 4) + 1;
        const quarterInHizb = ((q.number - 1) % 4) + 1;
        let quarterLabel = 'بداية الحزب';
        if (quarterInHizb === 2) quarterLabel = 'ربع الحزب';
        if (quarterInHizb === 3) quarterLabel = 'نصف الحزب';
        if (quarterInHizb === 4) quarterLabel = 'ثلاثة أرباع الحزب';

        const qRanges = getVerseRangesForQuarter(q.number);
        const patternPart = formatVerseDescription(qRanges);
        allUnits.push({
          title: `الحزب ${hizbNum} (${quarterLabel}) (${patternPart})`,
          pages: overlappingPages,
          verseRanges: qRanges,
          weight: 2.5,
        });
      }
    });
    return allUnits;
  }

  for (let i = 0; i < pagesToMemorize.length; i++) {
    allUnits.push(...getPageUnits(pagesToMemorize[i], pagesPerDay, plan));
  }

  allUnits.forEach((u) => {
    if (!u.verseRanges || u.verseRanges.length === 0) {
      u.verseRanges = getVerseRangesForUnit(u);
    }
  });
  return allUnits;
}

export function getUnitsForMemDay(
  memDay: number,
  units: MemorizationUnit[],
  pagesPerDay: number
): MemorizationUnit[] {
  if (memDay < 1) return [];
  const startWeight = (memDay - 1) * pagesPerDay;
  const endWeight = memDay * pagesPerDay;

  let currentWeightAccum = 0;
  const assignedUnits: MemorizationUnit[] = [];
  for (const u of units) {
    const sw = currentWeightAccum;
    currentWeightAccum += u.weight;
    const ew = currentWeightAccum;
    if (sw < endWeight - 0.0001 && ew > startWeight + 0.0001) {
      assignedUnits.push(u);
    }
  }
  return assignedUnits;
}

export const getSevenCastlesDurationWeeks = (plan: Partial<SevenCastlesPlan>): number => {
  if (plan.dailyAmount === DailyAmount.JUZ_PER_PLAN) {
    const juzNum = getSevenCastlesJuzForPlan(plan);
    const units = getSevenCastlesJuzSurahUnits(juzNum, !!plan.isSevenCastlesDescending);
    return Math.ceil(units.length / 4);
  }
  return 11;
};

const dailyAmountToNumericPages = (dailyAmount: DailyAmount): number => {
  switch (dailyAmount) {
    case DailyAmount.QUARTER_PAGE:
      return 0.25;
    case DailyAmount.HALF_PAGE:
      return 0.5;
    case DailyAmount.ONE_PAGE:
      return 1;
    case DailyAmount.TWO_PAGES:
      return 2;
    case DailyAmount.QUARTER_HIZB:
      return 2.5;
    case DailyAmount.THREE_PAGES:
      return 3;
    case DailyAmount.FOUR_PAGES:
      return 4;
    case DailyAmount.FIVE_PAGES:
      return 5;
    default:
      return 1;
  }
};

export const getSevenCastlesPages = (plan: Partial<SevenCastlesPlan>): number[] => {
  if (plan.dailyAmount === DailyAmount.JUZ_PER_PLAN) {
    const juzNum = getSevenCastlesJuzForPlan(plan);
    const range = JUZ_PAGES[juzNum] || JUZ_PAGES[29];
    const pages: number[] = [];
    if (plan.isSevenCastlesDescending) {
      for (let p = range.end; p >= range.start; p--) pages.push(p);
    } else {
      for (let p = range.start; p <= range.end; p++) pages.push(p);
    }
    return pages;
  }

  const pagesPerDay = dailyAmountToNumericPages(plan.dailyAmount || DailyAmount.ONE_PAGE);
  const neededWeight = 42 * pagesPerDay;

  const getPageWeight = (p: number): number => {
    if (p === 1 || p === 2) return 0.5;
    if (p === 598) return 0.25;
    if (p >= 599 && p <= 604) return 0.75;
    return 1.0;
  };

  const sp = Number(plan.startPage) || 1;
  const startJuz = getJuzForPage(sp);

  const searchJuzs: number[] = [];
  if (plan.isSevenCastlesDescending) {
    for (let j = startJuz; j >= 1; j--) searchJuzs.push(j);
    for (let j = startJuz + 1; j <= 30; j++) searchJuzs.push(j);
  } else {
    for (let j = startJuz; j <= 30; j++) searchJuzs.push(j);
    for (let j = startJuz - 1; j >= 1; j--) searchJuzs.push(j);
  }

  // Support both explicit oldMemorizedPages and multi-range oldMemorizationRanges seamlessly
  const oldPages =
    plan.oldMemorizedPages && plan.oldMemorizedPages.length > 0
      ? plan.oldMemorizedPages
      : expandOldMemorizationRanges(plan.oldMemorizationRanges);
  const oldSet = new Set(oldPages);
  const targetPages: number[] = [];

  let currentAccumulatedWeight = 0;
  for (let i = 0; i < searchJuzs.length; i++) {
    const j = searchJuzs[i];
    const range = JUZ_PAGES[j];
    if (!range) continue;

    const juzPages: number[] = [];
    if (j === startJuz) {
      if (plan.isSevenCastlesDescending) {
        for (let p = sp; p >= range.start; p--) juzPages.push(p);
      } else {
        for (let p = sp; p <= range.end; p++) juzPages.push(p);
      }
    } else {
      if (plan.isSevenCastlesDescending) {
        for (let p = range.end; p >= range.start; p--) juzPages.push(p);
      } else {
        for (let p = range.start; p <= range.end; p++) juzPages.push(p);
      }
    }

    for (const p of juzPages) {
      if (!oldSet.has(p)) {
        targetPages.push(p);
        currentAccumulatedWeight += getPageWeight(p);
        if (currentAccumulatedWeight >= neededWeight - 0.001) break;
      }
    }
    if (currentAccumulatedWeight >= neededWeight - 0.001) break;
  }

  return targetPages;
};

export const getSevenCastlesPortionsTable = (
  plan: Partial<SevenCastlesPlan>
): SevenCastlesPortionInfo[] => {
  const targetPagesToMemorize = getSevenCastlesPages(plan);
  const isJuzPerPlan = plan.dailyAmount === DailyAmount.JUZ_PER_PLAN;
  const A = isJuzPerPlan ? 1 : dailyAmountToNumericPages(plan.dailyAmount || DailyAmount.ONE_PAGE);
  const units = getMemorizationUnits(targetPagesToMemorize, A, plan);
  const neededMemDays = isJuzPerPlan ? units.length : 42;
  const maxCastles = isJuzPerPlan ? Math.min(7, Math.ceil(neededMemDays / 6)) : 7;

  const castleNames = [
    'القلعة الأولى',
    'القلعة الثانية',
    'القلعة الثالثة',
    'القلعة الرابعة',
    'القلعة الخامسة',
    'القلعة السادسة',
    'القلعة السابعة',
  ];

  const result: SevenCastlesPortionInfo[] = [];

  for (let c = 0; c < maxCastles; c++) {
    const portions = [];
    const allCastleUnits: MemorizationUnit[] = [];

    for (let m = 0; m < 6; m++) {
      const memDay = c * 6 + m + 1;
      let memUnits: MemorizationUnit[] = [];

      if (isJuzPerPlan && c === 6 && neededMemDays === 44) {
        if (m < 4) memUnits = getUnitsForMemDay(37 + m, units, A);
        else if (m === 4) memUnits = [...getUnitsForMemDay(41, units, A), ...getUnitsForMemDay(42, units, A)];
        else memUnits = [...getUnitsForMemDay(43, units, A), ...getUnitsForMemDay(44, units, A)];
      } else {
        memUnits = getUnitsForMemDay(memDay, units, A);
      }

      allCastleUnits.push(...memUnits);
      const desc = memUnits.length > 0 ? formatUnitsTitle(memUnits) : '';
      const pages = [...new Set(memUnits.flatMap((u) => u.pages))].sort((a, b) => a - b);
      portions.push({ portionIndex: m, memDay, desc, pages });
    }

    result.push({
      castleIndex: c,
      castleName: castleNames[c],
      castleSummary: allCastleUnits.length > 0 ? formatUnitsTitle(allCastleUnits) : '',
      portions,
    });
  }

  return result;
};

/**
 * Generates the daily Old Memorization Review task for Seven Castles
 * (supports multiple non-contiguous page ranges seamlessly; rotates every 7 days if <= 140 pages, or 14 days if > 140 pages).
 */
export const getSevenCastlesOldReviewTask = (
  date: Date,
  plan: SevenCastlesPlan
): Task | null => {
  const startDate = parsePlanDate(plan.startDate);
  const targetDate = startOfDay(date);
  if (targetDate < startDate) return null;

  const initialOldPages =
    plan.oldMemorizedPages && plan.oldMemorizedPages.length > 0
      ? plan.oldMemorizedPages
      : expandOldMemorizationRanges(plan.oldMemorizationRanges);

  const combinedOldPages = [...new Set(initialOldPages)].sort((a, b) => a - b);
  if (!plan.hasOldMemorization || combinedOldPages.length === 0) return null;

  const daysElapsed = differenceInCalendarDays(targetDate, startDate);
  const totalPages = combinedOldPages.length;

  let N = totalPages > 140 ? 14 : 7;
  let useQuarters = false;
  let quarterUnits: MemorizationUnit[] = [];

  if (plan.oldMemorizationReviewMode === 'custom_days' && plan.oldMemorizationCustomDays && plan.oldMemorizationCustomDays > 0) {
    N = plan.oldMemorizationCustomDays;
  } else if (plan.oldMemorizationReviewMode === 'custom_amount' && plan.oldMemorizationCustomAmountType) {
    let pagesPerDay = 10;
    if (plan.oldMemorizationCustomAmountType === 'pages') {
      pagesPerDay = plan.oldMemorizationCustomAmountValue || 5;
    } else if (plan.oldMemorizationCustomAmountType === 'quarter_hizb') {
      useQuarters = true;
      const mult = plan.oldMemorizationCustomAmountValue || 2;
      const allQuarters = getMemorizationUnits(combinedOldPages, 2.5, plan);
      for (let i = 0; i < allQuarters.length; i += mult) {
        const group = allQuarters.slice(i, i + mult);
        quarterUnits.push({
          title: formatUnitsTitle(group),
          pages: [...new Set(group.flatMap((q) => q.pages))],
          verseRanges: group.flatMap((q) => q.verseRanges || getVerseRangesForUnit(q)),
          weight: group.reduce((s, item) => s + (item.weight || 1), 0),
        });
      }
      N = Math.max(1, quarterUnits.length);
    } else if (plan.oldMemorizationCustomAmountType === 'juz') {
      pagesPerDay = (plan.oldMemorizationCustomAmountValue || 1) * 20;
    }
    if (!useQuarters) {
      N = Math.max(1, Math.ceil(totalPages / pagesPerDay));
    }
  }

  const chunkIndex = daysElapsed % N;
  let pagesToday: number[] = [];
  let detailedText = '';

  if (useQuarters && quarterUnits.length > 0) {
    const q = quarterUnits[chunkIndex];
    if (!q) return null;
    pagesToday = q.pages;
    detailedText = q.title;
  } else {
    const baseSize = Math.floor(totalPages / N);
    const remainder = totalPages % N;
    let startIdx = 0;
    for (let i = 0; i < chunkIndex; i++) {
      startIdx += baseSize + (i < remainder ? 1 : 0);
    }
    const currentChunkSize = baseSize + (chunkIndex < remainder ? 1 : 0);
    pagesToday = combinedOldPages.slice(startIdx, startIdx + currentChunkSize);
    detailedText = formatDetailedPages(pagesToday, true, plan);
  }

  if (pagesToday.length === 0) return null;

  return {
    id: `old-rev-${format(targetDate, 'yyyyMMdd')}`,
    title: `مراجعة ${detailedText}`,
    type: TaskType.REVIEW,
    completed: false,
    targetCount: 1,
    currentCount: 0,
    pages: pagesToday,
  };
};

/**
 * Generates ALL Seven Castles tasks for a given date (Listening, New Memorization, Daily Fixation,
 * Day 3 & Day 6 Fixation + Recitation, Day 7 Review + Cumulative Recitation, Completed Castles Review,
 * AND daily Old Memorization Review across all of the student's old memorization ranges).
 */
export const getSevenCastlesTasksForDate = (date: Date, plan: SevenCastlesPlan): Task[] => {
  const startDate = parsePlanDate(plan.startDate);
  const targetDate = startOfDay(date);
  if (targetDate < startDate) return [];

  const targetPagesToMemorize = getSevenCastlesPages(plan);
  const daysElapsed = differenceInCalendarDays(targetDate, startDate);

  const isJuzPerPlan = plan.dailyAmount === DailyAmount.JUZ_PER_PLAN;
  const A = isJuzPerPlan ? 1 : dailyAmountToNumericPages(plan.dailyAmount);
  const units = getMemorizationUnits(targetPagesToMemorize, A, plan);

  const neededMemDays = isJuzPerPlan ? units.length : 42;
  const neededWeeks = isJuzPerPlan ? Math.ceil(neededMemDays / 4) : 11;
  const totalPlanDays = neededWeeks * 7;

  if (daysElapsed >= totalPlanDays) return [];

  const week = Math.floor(daysElapsed / 7);
  const realD = getDay(targetDate);
  const d = (realD - (plan.firstDayOfWeek || 0) + 7) % 7;

  const getPagesForMemDay = (memDay: number): number[] => {
    if (memDay > neededMemDays) return [];
    const memUnits = getUnitsForMemDay(memDay, units, A);
    return [...new Set(memUnits.flatMap((u) => u.pages))].sort((a, b) => a - b);
  };

  const getPagesDescForMemDay = (memDay: number): string => {
    if (memDay > neededMemDays) return '';
    const memUnits = getUnitsForMemDay(memDay, units, A);
    return memUnits.length > 0 ? formatUnitsTitle(memUnits) : '';
  };

  const getUnitsForCastle = (castleNum: number): MemorizationUnit[] => {
    if (castleNum < 1 || castleNum > 7) return [];
    const startMemDay = (castleNum - 1) * 6 + 1;
    if (startMemDay > neededMemDays) return [];
    const endMemDay =
      castleNum === 7 ? Math.max(42, neededMemDays) : Math.min(castleNum * 6, neededMemDays);
    const castleUnits: MemorizationUnit[] = [];
    for (let md = startMemDay; md <= endMemDay; md++) {
      castleUnits.push(...getUnitsForMemDay(md, units, A));
    }
    return castleUnits;
  };

  const getCastleNameAr = (idx: number): string => {
    const names = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة'];
    return names[idx] || `${idx + 1}`;
  };

  const getVerseRangesFromUnits = (uList: MemorizationUnit[]): VerseRange[] | undefined => {
    const ranges = uList.flatMap((u) => u.verseRanges || []);
    return ranges.length > 0 ? ranges : undefined;
  };

  const memDay1 = week * 4 + 1;
  const memDay2 = week * 4 + 2;
  const memDay3 = week * 4 + 3;
  const memDay4 = week * 4 + 4;

  const Pg1_pages = getPagesForMemDay(memDay1);
  const Pg1_desc = getPagesDescForMemDay(memDay1);
  const Pg2_pages = getPagesForMemDay(memDay2);
  const Pg2_desc = getPagesDescForMemDay(memDay2);
  const Pg3_pages = getPagesForMemDay(memDay3);
  const Pg3_desc = getPagesDescForMemDay(memDay3);
  const Pg4_pages = getPagesForMemDay(memDay4);
  const Pg4_desc = getPagesDescForMemDay(memDay4);

  const Pg1_units = getUnitsForMemDay(memDay1, units, A);
  const Pg2_units = getUnitsForMemDay(memDay2, units, A);
  const Pg3_units = getUnitsForMemDay(memDay3, units, A);
  const Pg4_units = getUnitsForMemDay(memDay4, units, A);

  const Pg12_pages = [...new Set([...Pg1_pages, ...Pg2_pages])].sort((a, b) => a - b);
  const Pg12_units = [...Pg1_units, ...Pg2_units];
  const Pg12_desc = Pg12_units.length > 0 ? formatUnitsTitle(Pg12_units) : '';

  const Pg34_pages = [...new Set([...Pg3_pages, ...Pg4_pages])].sort((a, b) => a - b);
  const Pg34_units = [...Pg3_units, ...Pg4_units];
  const Pg34_desc = Pg34_units.length > 0 ? formatUnitsTitle(Pg34_units) : '';

  const PgAll_pages = [...new Set([...Pg1_pages, ...Pg2_pages, ...Pg3_pages, ...Pg4_pages])].sort(
    (a, b) => a - b
  );
  const PgAll_units = [...Pg1_units, ...Pg2_units, ...Pg3_units, ...Pg4_units];
  const PgAll_desc = PgAll_units.length > 0 ? formatUnitsTitle(PgAll_units) : '';

  const tasks: Task[] = [];
  const dateStr = format(targetDate, 'yyyyMMdd');

  const pushMemDayTasks = (
    dayNum: number,
    pages: number[],
    desc: string,
    vr: VerseRange[] | undefined
  ) => {
    if (pages.length === 0) return;
    tasks.push({
      id: `sc-lis-${dayNum}-${dateStr}`,
      title: `استماع: ${desc}`,
      type: TaskType.LISTENING,
      completed: false,
      targetCount: 1,
      currentCount: 0,
      pages,
      verseRanges: vr,
    });
    tasks.push({
      id: `sc-mem-${dayNum}-${dateStr}`,
      title: `حفظ جديد: ${desc}`,
      type: TaskType.MEMORIZATION,
      completed: false,
      targetCount: 1,
      currentCount: 0,
      pages,
      verseRanges: vr,
    });
    tasks.push({
      id: `sc-fix-${dayNum}-${dateStr}`,
      title: `تثبيت المقدار الجديد: ${desc}`,
      type: TaskType.FIXATION,
      completed: false,
      targetCount: plan.dailyFixationRepetitions || 5,
      currentCount: 0,
      pages,
      verseRanges: vr,
    });
  };

  switch (d) {
    case 0:
      pushMemDayTasks(1, Pg1_pages, Pg1_desc, getVerseRangesFromUnits(Pg1_units));
      break;
    case 1:
      pushMemDayTasks(2, Pg2_pages, Pg2_desc, getVerseRangesFromUnits(Pg2_units));
      break;
    case 2:
      if (Pg12_pages.length > 0) {
        const vr12 = getVerseRangesFromUnits(Pg12_units);
        tasks.push({
          id: `sc-fix-12-${dateStr}`,
          title: `تثبيت ${Pg12_desc}`,
          type: TaskType.FIXATION,
          completed: false,
          targetCount: plan.weeklyReviewRepetitions || 3,
          currentCount: 0,
          pages: Pg12_pages,
          verseRanges: vr12,
        });
        tasks.push({
          id: `sc-rec-12-${dateStr}`,
          title: `تسميع ${Pg12_desc}`,
          type: TaskType.RECITATION,
          completed: false,
          targetCount: 1,
          currentCount: 0,
          pages: Pg12_pages,
          verseRanges: vr12,
        });
      }
      break;
    case 3:
      pushMemDayTasks(3, Pg3_pages, Pg3_desc, getVerseRangesFromUnits(Pg3_units));
      break;
    case 4:
      pushMemDayTasks(4, Pg4_pages, Pg4_desc, getVerseRangesFromUnits(Pg4_units));
      break;
    case 5:
      if (Pg34_pages.length > 0) {
        const vr34 = getVerseRangesFromUnits(Pg34_units);
        tasks.push({
          id: `sc-fix-34-${dateStr}`,
          title: `تثبيت ${Pg34_desc}`,
          type: TaskType.FIXATION,
          completed: false,
          targetCount: plan.weeklyReviewRepetitions || 3,
          currentCount: 0,
          pages: Pg34_pages,
          verseRanges: vr34,
        });
        tasks.push({
          id: `sc-rec-34-${dateStr}`,
          title: `تسميع ${Pg34_desc}`,
          type: TaskType.RECITATION,
          completed: false,
          targetCount: 1,
          currentCount: 0,
          pages: Pg34_pages,
          verseRanges: vr34,
        });
      }
      break;
    case 6:
      if (PgAll_pages.length > 0 && (isJuzPerPlan || week < neededWeeks - 1)) {
        const vrAll = getVerseRangesFromUnits(PgAll_units);
        tasks.push({
          id: `sc-rev-week-${dateStr}`,
          title: `مراجعة ${PgAll_desc}`,
          type: TaskType.REVIEW,
          completed: false,
          targetCount: 1,
          currentCount: 0,
          pages: PgAll_pages,
          verseRanges: vrAll,
        });

        let pagesToRecitate = PgAll_pages;
        let recitationTitle = `تسميع ${PgAll_desc}`;
        let recitationVr = vrAll;

        if (week > 0) {
          const prevUnitsAll = [
            ...getUnitsForMemDay((week - 1) * 4 + 1, units, A),
            ...getUnitsForMemDay((week - 1) * 4 + 2, units, A),
            ...getUnitsForMemDay((week - 1) * 4 + 3, units, A),
            ...getUnitsForMemDay((week - 1) * 4 + 4, units, A),
          ];
          const combinedUnits = [...prevUnitsAll, ...PgAll_units];
          recitationVr = getVerseRangesFromUnits(combinedUnits);
          const prevPagesAll = [...new Set(prevUnitsAll.flatMap((u) => u.pages))].sort((a, b) => a - b);
          pagesToRecitate = [...new Set([...prevPagesAll, ...PgAll_pages])].sort((a, b) => a - b);
          recitationTitle = `تسميع ${formatUnitsTitle(combinedUnits)}`;
        }

        tasks.push({
          id: `sc-rec-week-${dateStr}`,
          title: recitationTitle,
          type: TaskType.RECITATION,
          completed: false,
          targetCount: 1,
          currentCount: 0,
          pages: pagesToRecitate,
          verseRanges: recitationVr,
        });
      }
      break;
  }

  let targetK = d + 1;
  if (isJuzPerPlan && neededMemDays === 36 && week === neededWeeks - 1 && d === 6) {
    targetK = 6;
  }
  const compWeek = Math.floor((targetK * 6 - 1) / 4);
  const shouldReviewCastle =
    week > compWeek ||
    (week === neededWeeks - 1 && targetK === 7) ||
    (isJuzPerPlan && neededMemDays === 36 && week === neededWeeks - 1 && d === 6 && targetK === 6);

  if (shouldReviewCastle) {
    const castleUnits = getUnitsForCastle(targetK);
    const cPages = [...new Set(castleUnits.flatMap((u) => u.pages))].sort((a, b) => a - b);
    if (castleUnits.length > 0 && cPages.length > 0) {
      tasks.push({
        id: `sc-castle-rev-${targetK - 1}-${dateStr}`,
        title: `مراجعة القلعة ${getCastleNameAr(targetK - 1)}: ${formatUnitsTitle(castleUnits)}`,
        type: TaskType.REVIEW,
        completed: false,
        targetCount: 1,
        currentCount: 0,
        pages: cPages,
        verseRanges: getVerseRangesFromUnits(castleUnits),
      });
    }
  }

  // Append daily Old Memorization Review across all of the student's old memorization ranges
  const oldReviewTask = getSevenCastlesOldReviewTask(targetDate, plan);
  if (oldReviewTask) {
    tasks.push(oldReviewTask);
  }

  return tasks;
};

/**
 * Generates the entire day-by-day schedule for the Seven Castles plan (9 or 11 weeks).
 */
export function generateFullSevenCastlesSchedule(
  plan: SevenCastlesPlan
): { date: Date; tasks: Task[] }[] {
  const totalDays = getSevenCastlesDurationWeeks(plan) * 7;
  const start = parsePlanDate(plan.startDate);
  const schedule: { date: Date; tasks: Task[] }[] = [];

  for (let i = 0; i < totalDays; i++) {
    const currentDate = addDays(start, i);
    const tasks = getSevenCastlesTasksForDate(currentDate, plan);
    schedule.push({ date: currentDate, tasks });
  }
  return schedule;
}
