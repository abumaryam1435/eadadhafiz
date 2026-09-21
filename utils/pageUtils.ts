import { Student, Evaluation, AttendanceStatus, EvaluationType } from "../types";
import { toArabicDigits, toEnglishDigits, formatRtlRange, formatAndCountJuzs } from "./juzUtils";
import { quranPageMap, surahNames, surahPagesMap } from "./quranData";

export function getSurahIdByName(name: string): number {
  if (!name) return 0;
  const clean = name.trim().replace(/^(سورة|سوره)\s+/, "");
  const directIdx = surahNames.indexOf(clean as any);
  if (directIdx > 0) return directIdx;
  const originalIdx = surahNames.indexOf(name.trim() as any);
  if (originalIdx > 0) return originalIdx;

  const normalize = (s: string) =>
    (s || "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[\s\-_]/g, "");

  const cleanNorm = normalize(clean);
  const foundIdx = surahNames.findIndex((s) => s && normalize(s) === cleanNorm);
  return foundIdx > 0 ? foundIdx : 0;
}

export function findPageBySurahAndAyah(
  surahId: number,
  ayahNumber?: number | null,
): number | null {
  if (!surahId || surahId < 1 || surahId > 114) return null;
  const pages = surahPagesMap[surahId] || [];
  if (pages.length === 0) return null;
  if (!ayahNumber || isNaN(ayahNumber) || ayahNumber <= 0) {
    return pages[pages.length - 1];
  }
  for (const p of pages) {
    const entries = quranPageMap[p] || [];
    for (const e of entries) {
      if (e.surah === surahId && ayahNumber >= e.start && ayahNumber <= e.end) {
        return p;
      }
    }
  }
  return pages[pages.length - 1];
}

export function parseTargetAyah(
  fromAyah?: string | number,
  toAyah?: string | number,
): number | null {
  if (toAyah !== undefined && toAyah !== null && toAyah !== "") {
    const cleanTo = toEnglishDigits(String(toAyah).trim());
    if (cleanTo.includes("-")) {
      const parts = cleanTo.split("-");
      const num = parseInt(parts[parts.length - 1].trim(), 10);
      if (!isNaN(num) && num > 0) return num;
    } else {
      const num = parseInt(cleanTo, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  if (fromAyah !== undefined && fromAyah !== null && fromAyah !== "") {
    const cleanFrom = toEnglishDigits(String(fromAyah).trim());
    if (cleanFrom.includes("-")) {
      const parts = cleanFrom.split("-");
      const num = parseInt(parts[parts.length - 1].trim(), 10);
      if (!isNaN(num) && num > 0) return num;
    } else {
      const num = parseInt(cleanFrom, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

export function getLastMemorizedPage(
  student: Student,
  evaluations: Evaluation[],
): string {
  if (!student || !evaluations || !Array.isArray(evaluations)) return "—";

  // 1. Filter evaluations for this student
  // Must be Quran subject, not test, and student was present or late
  const validEvals = evaluations.filter((e) => {
    if (e.studentId !== student.id) return false;
    if (e.subject === "mutoon") return false;
    if (e.isTest) return false;

    const att = String(e.attendance || "").toLowerCase();
    const isAttended =
      att === AttendanceStatus.PRESENT ||
      att === AttendanceStatus.LATE ||
      att === "present" ||
      att === "late";
    if (!isAttended) return false;

    const isMemType =
      e.evaluationType === EvaluationType.MEMORIZATION ||
      e.evaluationType === ("memorization" as any);
    const hasPages = e.newMemorizedPages && e.newMemorizedPages.length > 0;
    const hasSurahs = e.surahs && e.surahs.length > 0;
    const hasPageCount = typeof e.pages === "number" && e.pages > 0;

    return isMemType || hasPages || hasSurahs || hasPageCount;
  });

  if (validEvals.length === 0) return "—";

  // 2. Sort to get the latest week
  validEvals.sort((a, b) => {
    const wA =
      typeof a.weekNumber === "number"
        ? a.weekNumber
        : parseInt(String(a.weekNumber), 10) || 0;
    const wB =
      typeof b.weekNumber === "number"
        ? b.weekNumber
        : parseInt(String(b.weekNumber), 10) || 0;
    if (wB !== wA) return wB - wA;
    return (b.id || 0) - (a.id || 0);
  });

  const latest = validEvals[0];

  // 3. New format: newMemorizedPages recorded
  if (
    latest.newMemorizedPages &&
    Array.isArray(latest.newMemorizedPages) &&
    latest.newMemorizedPages.length > 0
  ) {
    if (latest.surahs && latest.surahs.length > 0) {
      const lastSurah = latest.surahs[latest.surahs.length - 1];
      const sId = getSurahIdByName(lastSurah);
      const targetAyah = parseTargetAyah(latest.fromAyah, latest.toAyah);
      if (sId > 0 && targetAyah) {
        const p = findPageBySurahAndAyah(sId, targetAyah);
        if (p && latest.newMemorizedPages.includes(p)) {
          return toArabicDigits(p);
        }
      }
    }
    const maxPage = Math.max(...latest.newMemorizedPages);
    return toArabicDigits(maxPage);
  }

  // 4. Old format: without newMemorizedPages
  if (latest.surahs && latest.surahs.length > 0) {
    const targetAyah = parseTargetAyah(latest.fromAyah, latest.toAyah);
    const lastSurah = latest.surahs[latest.surahs.length - 1];
    const sId = getSurahIdByName(lastSurah);

    if (sId > 0) {
      const p = findPageBySurahAndAyah(sId, targetAyah);
      if (p) return toArabicDigits(p);
    }
  }

  // 5. Fallback: if single page number is in e.pages and between 1 and 604
  if (
    typeof latest.pages === "number" &&
    latest.pages >= 1 &&
    latest.pages <= 604 &&
    (!latest.surahs || latest.surahs.length === 0)
  ) {
    return toArabicDigits(latest.pages);
  }

  return "—";
}

export function getMemorizedPagesData(student: Student, evaluations: Evaluation[]) {
  const oldSet = new Set<number>();
  if (student.oldMemorizedPages) {
    const cleaned = toEnglishDigits(student.oldMemorizedPages.replace(/[\u200E\u200F\u202A-\u202E]/g, ''));
    const parts = cleaned.split(/[,،]/);
    for (const part of parts) {
      const range = part.trim().split(/[-–—]/);
      if (range.length === 2) {
        let start = parseInt(range[0].trim(), 10);
        let end = parseInt(range[1].trim(), 10);
        if (!isNaN(start) && !isNaN(end)) {
          let s = Math.min(start, end);
          let e = Math.max(start, end);
          for(let i = s; i <= e; i++) oldSet.add(i);
        }
      } else if (range.length === 1) {
        const num = parseInt(range[0].trim(), 10);
        if (!isNaN(num)) oldSet.add(num);
      }
    }
  }

  const newSet = new Set<number>();
  evaluations.forEach(e => {
    if (e.studentId === student.id && e.newMemorizedPages) {
      e.newMemorizedPages.forEach(p => {
         if (!oldSet.has(p)) {
             newSet.add(p);
         }
      });
    }
  });

  const totalSet = new Set<number>([...oldSet, ...newSet]);
  
  const formatSet = (s: Set<number>) => {
      const arr = Array.from(s).sort((a,b) => a-b);
      if (arr.length === 0) return "";
      let ranges = [];
      let start = arr[0];
      let end = arr[0];
      for (let i = 1; i < arr.length; i++) {
          if (arr[i] === end + 1) {
              end = arr[i];
          } else {
              ranges.push(start === end ? toArabicDigits(start) : formatRtlRange(`${start} - ${end}`));
              start = arr[i];
              end = arr[i];
          }
      }
      ranges.push(start === end ? toArabicDigits(start) : formatRtlRange(`${start} - ${end}`));
      return ranges.join('، ');
  };

  return {
      oldStr: formatSet(oldSet) || "—",
      newStr: formatSet(newSet) || "—",
      combinedStr: formatSet(totalSet) || "—",
      totalCount: totalSet.size,
      totalSet: totalSet,
      oldSet: oldSet,
      newSet: newSet
  };
}

export const LEVEL_WORDS_ORDER = [
  "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر",
  "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون",
  "الحادي والعشرون", "الثاني والعشرون", "الثالث والعشرون", "الرابع والعشرون", "الخامس والعشرون", "السادس والعشرون", "السابع والعشرون", "الثامن والعشرون", "التاسع والعشرون", "الثلاثون",
  "الحادي والثلاثون", "الثاني والثلاثون", "الثالث والثلاثون"
];

export const ALL_LEVEL_NAMES = LEVEL_WORDS_ORDER.map(w => `المستوى ${w}`);

export function calculateStudentLevel(totalCount: number): string {
  if (totalCount < 40) return "المستوى الأول";
  const levelNum = Math.floor(totalCount / 20);
  if (levelNum >= 1 && levelNum <= LEVEL_WORDS_ORDER.length) {
    return `المستوى ${LEVEL_WORDS_ORDER[levelNum - 1]}`;
  }
  return `المستوى ${levelNum}`;
}

export function getLevelNumericRank(levelStr: string): number {
  if (!levelStr) return 999;
  const clean = String(levelStr).replace(/(المستوى|مستوى)\s*/g, "").trim();
  const num = parseInt(clean, 10);
  if (!isNaN(num) && num > 0) return num;

  // 1. Exact match in LEVEL_WORDS_ORDER
  const exactIdx = LEVEL_WORDS_ORDER.indexOf(clean);
  if (exactIdx !== -1) return exactIdx + 1;

  // 2. Exact match after normalizing alef and yaa
  const normalizedClean = clean
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ين$/g, "ون");

  const normalizedOrder = LEVEL_WORDS_ORDER.map(w =>
    w.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ين$/g, "ون")
  );

  const normIdx = normalizedOrder.indexOf(normalizedClean);
  if (normIdx !== -1) return normIdx + 1;

  // 3. Match longest phrase first to prevent partial collision (e.g. "الثاني عشر" matching "الثاني")
  const sortedWords = LEVEL_WORDS_ORDER.map((w, idx) => ({ word: w, rank: idx + 1 }))
    .sort((a, b) => b.word.length - a.word.length);

  for (const item of sortedWords) {
    if (clean === item.word || clean.includes(item.word)) {
      return item.rank;
    }
  }

  return 999;
}

export function normalizeStudentLevel(levelStr: string | undefined | null): string {
  if (!levelStr) return "";
  const trimmed = String(levelStr).trim();
  if (!trimmed || trimmed === "—" || trimmed === "لم يحدد" || trimmed === "undefined" || trimmed === "null") return "";

  const exact = ALL_LEVEL_NAMES.find(l => l === trimmed);
  if (exact) return exact;

  const rank = getLevelNumericRank(trimmed);
  if (rank >= 1 && rank <= LEVEL_WORDS_ORDER.length) {
    return `المستوى ${LEVEL_WORDS_ORDER[rank - 1]}`;
  }
  if (rank !== 999) {
    return `المستوى ${rank}`;
  }
  return trimmed;
}

export function getCompletedJuzs(totalSet: Set<number>): number[] {
    const completedJuzs: number[] = [];
    for (let juz = 1; juz <= 30; juz++) {
        let startPage = 0;
        let length = 20;
        
        if (juz === 1) {
            startPage = 1;
            length = 21;
        } else if (juz === 30) {
            startPage = 582;
            length = 23;
        } else {
            startPage = (juz - 1) * 20 + 2;
            length = 20;
        }
        
        let isCompleted = true;
        for (let i = 0; i < length; i++) {
            if (!totalSet.has(startPage + i)) {
                isCompleted = false;
                break;
            }
        }
        
        if (isCompleted) {
            completedJuzs.push(juz);
        }
    }
    return completedJuzs;
}

export interface TestPassagesInfo {
  requiredPassages: number;
  passagesText: string;
  tierLabel: string;
  detailsText: string;
  totalJuzsCount: number;
  juzsFormatted: string;
  totalPagesCount: number;
}

/**
 * دالة حساب عدد المقاطع المطلوب اختبار الطالب فيها بناءً على محفوظه
 * الضابط: (كل مقطع لا يقل عن ربع صفحة ولا يزيد عن نصف صفحة تقريباً)
 * جزء واحد (أو أقل) ... يسمع 3 مقاطع
 * 2 - 3 أجزاء ........... يسمع 4 مقاطع
 * 4 - 5 أجزاء ........... يسمع 5 مقاطع
 * أكثر من 5 أجزاء ..... يسمع 6 مقاطع
 */
export function getStudentTestPassagesInfo(
  student: Student | null | undefined,
  evaluations: Evaluation[] = []
): TestPassagesInfo {
  if (!student) {
    return {
      requiredPassages: 3,
      passagesText: '3 مقاطع',
      tierLabel: 'جزء واحد (أو أقل)',
      detailsText: 'كل مقطع لا يقل عن ربع صفحة ولا يزيد عن نصف صفحة تقريباً',
      totalJuzsCount: 0,
      juzsFormatted: '—',
      totalPagesCount: 0,
    };
  }

  let totalJuzsCount = 0;
  let juzsFormatted = '';
  let totalPagesCount = 0;

  const pagesData = getMemorizedPagesData(student, evaluations);
  totalPagesCount = pagesData.totalCount;
  const completedJuzs = getCompletedJuzs(pagesData.totalSet);
  const parsed = formatAndCountJuzs(completedJuzs.map(String));

  if (parsed.count > 0) {
    totalJuzsCount = parsed.count;
    juzsFormatted = parsed.formatted;
  } else if (totalPagesCount > 0) {
    totalJuzsCount = Math.max(1, Math.round(totalPagesCount / 20));
    juzsFormatted = `${toArabicDigits(totalPagesCount)} صفحة`;
  }

  let requiredPassages = 3;
  let passagesText = '3 مقاطع';
  let tierLabel = 'جزء واحد (أو أقل)';

  if (totalJuzsCount <= 1) {
    requiredPassages = 3;
    passagesText = '3 مقاطع';
    tierLabel = 'جزء واحد (أو أقل)';
  } else if (totalJuzsCount >= 2 && totalJuzsCount <= 3) {
    requiredPassages = 4;
    passagesText = '4 مقاطع';
    tierLabel = '2 - 3 أجزاء';
  } else if (totalJuzsCount >= 4 && totalJuzsCount <= 5) {
    requiredPassages = 5;
    passagesText = '5 مقاطع';
    tierLabel = '4 - 5 أجزاء';
  } else {
    requiredPassages = 6;
    passagesText = '6 مقاطع';
    tierLabel = 'أكثر من 5 أجزاء';
  }

  return {
    requiredPassages,
    passagesText,
    tierLabel,
    detailsText: 'كل مقطع لا يقل عن ربع صفحة ولا يزيد عن نصف صفحة تقريباً',
    totalJuzsCount,
    juzsFormatted: juzsFormatted || '—',
    totalPagesCount,
  };
}

