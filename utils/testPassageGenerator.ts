import { quranPageMap, surahNames } from './quranData';
import { toArabicDigits } from './juzUtils';
import ayahSegmentsData from './mushafAyahSegments.json';

const allSegments = ayahSegmentsData as unknown as Record<string, [number, number, number, number, number, number, number][]>;

export interface PassageHighlight {
  page: number;
  topPercent: number; // Vertical start in percentage (0 - 100)
  heightPercent: number; // Height in percentage
  label: string;
}

export interface SuggestedTestPassage {
  id: string;
  passageNumber: number; // 1, 2, 3, 4, 5, 6
  pages: number[]; // e.g. [120] or [120, 121]
  surahName: string;
  startSurahId: number;
  startAyah: number;
  endSurahId: number;
  endAyah: number;
  startPage: number;
  endPage: number;
  positionType: 'beginning' | 'middle' | 'end' | 'cross-page' | 'full';
  positionLabel: string;
  description: string;
  shortLabel: string;
  highlights: Record<number, PassageHighlight>;
  actualLinesCount?: number;
}

/**
 * Format a test passage into a single, concise unified text.
 * Example: "صفحة 581-582 (المرسلات 45 إلى النبأ 7)"
 */
export function formatPassageDescription(
  pages: number[],
  startSurahId: number,
  startAyah: number,
  endSurahId: number,
  endAyah: number
): string {
  const pagesText = pages.length > 1
    ? `صفحة ${toArabicDigits(pages[0])}-${toArabicDigits(pages[pages.length - 1])}`
    : `صفحة ${toArabicDigits(pages[0])}`;

  const surahName1 = surahNames[startSurahId] || '';
  const surahName2 = surahNames[endSurahId] || '';

  let ayahsText = '';
  if (startSurahId === endSurahId) {
    ayahsText = startAyah === endAyah
      ? `${surahName1} ${toArabicDigits(startAyah)}`
      : `${surahName1} ${toArabicDigits(startAyah)} إلى ${toArabicDigits(endAyah)}`;
  } else {
    ayahsText = `${surahName1} ${toArabicDigits(startAyah)} إلى ${surahName2} ${toArabicDigits(endAyah)}`;
  }

  return `${pagesText} (${ayahsText})`;
}

interface PageVerseInfo {
  surah: number;
  ayah: number;
  firstLine: number;
  lastLine: number;
  linesCount: number;
}

/**
 * استخراج آيات الصفحة مع حساب عدد الأسطر الفعلية الدقيقة لكل آية
 * بناءً على الإحداثيات الفعلية لبيانات مقاطع المصحف (15 سطراً)
 */
function getPageVerses(page: number): PageVerseInfo[] {
  const segs = allSegments[String(page)] || [];
  if (segs.length === 0) {
    const pageEntries = quranPageMap[page] || [];
    const res: PageVerseInfo[] = [];
    const totalAyahs = pageEntries.reduce((acc, ent) => acc + (ent.end - ent.start + 1), 0);
    const avgLines = Math.max(0.5, 14 / Math.max(1, totalAyahs));
    for (const ent of pageEntries) {
      for (let a = ent.start; a <= ent.end; a++) {
        res.push({
          surah: ent.surah,
          ayah: a,
          firstLine: 1,
          lastLine: 15,
          linesCount: avgLines,
        });
      }
    }
    return res;
  }

  // حساب عرض النص الإجمالي لكل سطر لحساب الكسر الفعلي الدقيق
  const lineTotals = new Map<number, number>();
  for (const [, , line, minX, maxX] of segs) {
    lineTotals.set(line, (lineTotals.get(line) || 0) + Math.max(0, maxX - minX));
  }

  const verseMap = new Map<string, PageVerseInfo>();
  const orderedKeys: string[] = [];

  for (const [surah, ayah, line, minX, maxX] of segs) {
    const key = `${surah}:${ayah}`;
    const width = Math.max(0, maxX - minX);
    const lineTotal = lineTotals.get(line) || 1;
    const fraction = lineTotal > 0 ? width / lineTotal : 0;

    if (!verseMap.has(key)) {
      verseMap.set(key, {
        surah,
        ayah,
        firstLine: line,
        lastLine: line,
        linesCount: fraction,
      });
      orderedKeys.push(key);
    } else {
      const v = verseMap.get(key)!;
      v.firstLine = Math.min(v.firstLine, line);
      v.lastLine = Math.max(v.lastLine, line);
      v.linesCount += fraction;
    }
  }

  return orderedKeys.map(k => verseMap.get(k)!);
}

interface CandidatePassage {
  startPage: number;
  endPage: number;
  startSurahId: number;
  startAyah: number;
  endSurahId: number;
  endAyah: number;
  linesCount: number;
  positionType: 'beginning' | 'middle' | 'end' | 'cross-page';
  startLine: number;
  endLine: number;
  p1Lines: number;
  p2Lines: number;
}

/**
 * استخراج كافة المقاطع الممكنة لصفحة محددة بحيث تقع أسطرها الفعلية
 * بدقة بين 5.0 أسطر فعلية كحد أدنى و 7.5 أسطر فعلية كحد أقصى
 */
function getCandidatePassagesForPage(page: number, canCrossPage: boolean): CandidatePassage[] {
  const verses = getPageVerses(page);
  if (verses.length === 0) return [];

  const candidates: CandidatePassage[] = [];

  // النطاق المطلوب: لا تقل عن 5.0 أسطر ولا تزيد عن 7.5 أسطر فعلية
  const MIN_LINES = 4.95;
  const MAX_LINES = 7.55;

  // 1. مقاطع داخل نفس الصفحة (بداية، وسط، نهاية)
  for (let i = 0; i < verses.length; i++) {
    let sum = 0;
    for (let j = i; j < verses.length; j++) {
      sum += verses[j].linesCount;
      if (sum >= MIN_LINES && sum <= MAX_LINES) {
        let posType: 'beginning' | 'middle' | 'end' = 'middle';
        if (i === 0 || verses[i].firstLine <= 2) {
          posType = 'beginning';
        } else if (j === verses.length - 1 || verses[j].lastLine >= 14) {
          posType = 'end';
        }

        candidates.push({
          startPage: page,
          endPage: page,
          startSurahId: verses[i].surah,
          startAyah: verses[i].ayah,
          endSurahId: verses[j].surah,
          endAyah: verses[j].ayah,
          linesCount: Math.round(sum * 10) / 10,
          positionType: posType,
          startLine: verses[i].firstLine,
          endLine: verses[j].lastLine,
          p1Lines: sum,
          p2Lines: 0,
        });
      }
      if (sum > MAX_LINES) break;
    }
  }

  // 2. مقاطع ممتدة بين صفحتين متتاليتين (cross-page)
  if (canCrossPage && page < 604) {
    const nextVerses = getPageVerses(page + 1);
    if (nextVerses.length > 0) {
      // البدء من آيات النصف الثاني من الصفحة الأولى
      for (let i = Math.max(0, Math.floor(verses.length / 2)); i < verses.length; i++) {
        let p1Sum = 0;
        for (let k = i; k < verses.length; k++) p1Sum += verses[k].linesCount;

        // مساهمة الصفحة الأولى تكون معقولة (بين 1.5 و 5.2 أسطر)
        if (p1Sum >= 1.5 && p1Sum <= 5.2) {
          let totalSum = p1Sum;
          for (let j = 0; j < nextVerses.length; j++) {
            totalSum += nextVerses[j].linesCount;
            if (totalSum >= MIN_LINES && totalSum <= MAX_LINES) {
              candidates.push({
                startPage: page,
                endPage: page + 1,
                startSurahId: verses[i].surah,
                startAyah: verses[i].ayah,
                endSurahId: nextVerses[j].surah,
                endAyah: nextVerses[j].ayah,
                linesCount: Math.round(totalSum * 10) / 10,
                positionType: 'cross-page',
                startLine: verses[i].firstLine,
                endLine: nextVerses[j].lastLine,
                p1Lines: p1Sum,
                p2Lines: totalSum - p1Sum,
              });
            }
            if (totalSum > MAX_LINES) break;
          }
        }
      }
    }
  }

  // 3. حالة استثنائية: إذا كانت الصفحة تحتوي على آية واحدة طويلة جداً (مثل آية الدين ص 48 = 15 سطراً)
  if (candidates.length === 0) {
    let bestRange = { i: 0, j: 0, diff: Infinity, sum: 0 };
    for (let i = 0; i < verses.length; i++) {
      let sum = 0;
      for (let j = i; j < verses.length; j++) {
        sum += verses[j].linesCount;
        const diff = Math.abs(sum - 6.0);
        if (diff < bestRange.diff) {
          bestRange = { i, j, diff, sum };
        }
      }
    }
    const i = bestRange.i;
    const j = bestRange.j;
    candidates.push({
      startPage: page,
      endPage: page,
      startSurahId: verses[i].surah,
      startAyah: verses[i].ayah,
      endSurahId: verses[j].surah,
      endAyah: verses[j].ayah,
      linesCount: Math.round(bestRange.sum * 10) / 10,
      positionType: 'middle',
      startLine: verses[i].firstLine,
      endLine: verses[j].lastLine,
      p1Lines: bestRange.sum,
      p2Lines: 0,
    });
  }

  return candidates;
}

/**
 * Generate randomly distributed, balanced test passages for a student
 * across their memorized pages, strictly adhering to [5.0, 7.5] actual lines.
 */
export function generateSuggestedTestPassages(
  memorizedPages: number[],
  requiredCount: number = 3
): SuggestedTestPassage[] {
  if (!memorizedPages || memorizedPages.length === 0) {
    // Default fallback to Juz 30 (page 582)
    memorizedPages = [582, 583, 584, 585, 586];
  }

  // Deduplicate and sort ascending
  const sortedPages = Array.from(new Set(memorizedPages)).sort((a, b) => a - b);
  const totalPages = sortedPages.length;
  const count = Math.max(1, Math.min(6, requiredCount));

  const passages: SuggestedTestPassage[] = [];
  const usedPages = new Set<number>();

  // تفضيل تنويع مواضع المقاطع أثناء الاختبار (بداية، وسط، نهاية، بين صفحتين)
  const preferredPositionsBySlot: ('beginning' | 'middle' | 'end' | 'cross-page')[][] = [
    ['beginning', 'middle'],
    ['middle', 'cross-page', 'beginning'],
    ['end', 'cross-page', 'middle'],
    ['beginning', 'middle'],
    ['middle', 'end'],
    ['end', 'cross-page'],
  ];

  for (let i = 0; i < count; i++) {
    const passageNumber = i + 1;
    const binStartIdx = Math.floor((i * totalPages) / count);
    const binEndIdx = Math.min(totalPages - 1, Math.floor(((i + 1) * totalPages) / count) - 1);

    // Filter available pages in this bin that haven't been used yet
    let candidateIndices: number[] = [];
    for (let idx = binStartIdx; idx <= Math.max(binStartIdx, binEndIdx); idx++) {
      if (!usedPages.has(sortedPages[idx])) {
        candidateIndices.push(idx);
      }
    }

    if (candidateIndices.length === 0) {
      for (let idx = binStartIdx; idx <= Math.max(binStartIdx, binEndIdx); idx++) {
        candidateIndices.push(idx);
      }
    }

    const selectedIdx = candidateIndices[Math.floor(Math.random() * candidateIndices.length)] || binStartIdx;
    const selectedPage = sortedPages[selectedIdx];
    usedPages.add(selectedPage);

    const canCrossPage = sortedPages.includes(selectedPage + 1) && selectedPage < 604;
    const allCandidates = getCandidatePassagesForPage(selectedPage, canCrossPage);

    if (allCandidates.length === 0) {
      passages.push(createFallbackPassage(passageNumber, selectedPage));
      continue;
    }

    // تنويع موضع المقطع بحسب ترتيب السؤال
    const slotPreferences = preferredPositionsBySlot[i % preferredPositionsBySlot.length];
    let matchingCandidates: CandidatePassage[] = [];

    for (const pref of slotPreferences) {
      const match = allCandidates.filter(c => c.positionType === pref);
      if (match.length > 0) {
        matchingCandidates = match;
        break;
      }
    }

    if (matchingCandidates.length === 0) {
      matchingCandidates = allCandidates;
    }

    // اختيار مقطع مثالي من المرشحين يميل نحو 5.5 إلى 6.5 أسطر فعلية مع تنويع عشوائي
    matchingCandidates.sort((a, b) => {
      const diffA = Math.abs(a.linesCount - 6.0);
      const diffB = Math.abs(b.linesCount - 6.0);
      return diffA - diffB;
    });

    const topCandidates = matchingCandidates.slice(0, Math.min(4, matchingCandidates.length));
    const chosen = topCandidates[Math.floor(Math.random() * topCandidates.length)] || matchingCandidates[0];

    if (chosen.endPage > chosen.startPage) {
      usedPages.add(chosen.endPage);
    }

    const pagesList = chosen.startPage === chosen.endPage ? [chosen.startPage] : [chosen.startPage, chosen.endPage];
    const surahName1 = surahNames[chosen.startSurahId] || '';
    const surahName2 = surahNames[chosen.endSurahId] || '';
    const sameSurah = chosen.startSurahId === chosen.endSurahId;

    const desc = formatPassageDescription(
      pagesList,
      chosen.startSurahId,
      chosen.startAyah,
      chosen.endSurahId,
      chosen.endAyah
    );

    let positionLabel = `ص ${toArabicDigits(chosen.startPage)}`;
    if (chosen.positionType === 'cross-page') {
      positionLabel = `ص ${toArabicDigits(chosen.startPage)}-${toArabicDigits(chosen.endPage)}`;
    }

    const highlights: Record<number, PassageHighlight> = {};
    if (chosen.startPage === chosen.endPage) {
      const topPercent = Math.max(3, Math.min(85, Math.round(((chosen.startLine - 1) / 15) * 100) + 2));
      const heightPercent = Math.min(95, Math.max(25, Math.round((chosen.linesCount / 15) * 100)));
      highlights[chosen.startPage] = {
        page: chosen.startPage,
        topPercent,
        heightPercent,
        label: `آية ${toArabicDigits(chosen.startAyah)} إلى ${toArabicDigits(chosen.endAyah)}`,
      };
    } else {
      highlights[chosen.startPage] = {
        page: chosen.startPage,
        topPercent: Math.max(3, Math.min(85, Math.round(((chosen.startLine - 1) / 15) * 100) + 2)),
        heightPercent: Math.min(95, Math.max(20, Math.round((chosen.p1Lines / 15) * 100))),
        label: `آية ${toArabicDigits(chosen.startAyah)} فصاعداً`,
      };
      highlights[chosen.endPage] = {
        page: chosen.endPage,
        topPercent: 3,
        heightPercent: Math.min(95, Math.max(20, Math.round((chosen.p2Lines / 15) * 100))),
        label: `إلى آية ${toArabicDigits(chosen.endAyah)}`,
      };
    }

    passages.push({
      id: `passage-${passageNumber}-${chosen.startPage}`,
      passageNumber,
      pages: pagesList,
      surahName: sameSurah ? surahName1 : `${surahName1} / ${surahName2}`,
      startSurahId: chosen.startSurahId,
      startAyah: chosen.startAyah,
      endSurahId: chosen.endSurahId,
      endAyah: chosen.endAyah,
      startPage: chosen.startPage,
      endPage: chosen.endPage,
      positionType: chosen.positionType,
      positionLabel,
      description: desc,
      shortLabel: positionLabel,
      highlights,
      actualLinesCount: chosen.linesCount,
    });
  }

  return passages;
}

/**
 * Generate a single replacement passage for a specific slot, avoiding identical already selected passages where possible
 */
export function generateSingleReplacementPassage(
  memorizedPages: number[],
  passageNumber: number,
  existingPassages: SuggestedTestPassage[] = []
): SuggestedTestPassage {
  if (!memorizedPages || memorizedPages.length === 0) {
    memorizedPages = [582, 583, 584, 585, 586];
  }

  const sortedPages = Array.from(new Set(memorizedPages)).sort((a, b) => a - b);
  const currentPassage = existingPassages.find(p => p.passageNumber === passageNumber);
  const existingDescriptions = new Set(existingPassages.map(p => p.description));
  const usedPages = new Set<number>();
  
  existingPassages.forEach(p => {
    if (p.passageNumber !== passageNumber) {
      p.pages.forEach(pg => usedPages.add(pg));
    }
  });

  // Prefer pages not used in other passages
  let candidatePages = sortedPages.filter(p => !usedPages.has(p));
  if (candidatePages.length === 0) {
    candidatePages = [...sortedPages];
  }

  // If current passage has a page, try to pick a different page first
  if (currentPassage && candidatePages.length > 1) {
    const diffPages = candidatePages.filter(p => !currentPassage.pages.includes(p));
    if (diffPages.length > 0) {
      candidatePages = diffPages;
    }
  }

  // Shuffle candidate pages to find valid passage candidates
  const shuffledPages = [...candidatePages].sort(() => Math.random() - 0.5);
  let chosenCandidate: CandidatePassage | null = null;

  for (const page of shuffledPages) {
    const canCrossPage = sortedPages.includes(page + 1) && page < 604;
    const candidates = getCandidatePassagesForPage(page, canCrossPage);
    if (candidates.length > 0) {
      // Filter out exact same description if possible
      const freshCandidates = candidates.filter(c => {
        const desc = formatPassageDescription(
          c.startPage === c.endPage ? [c.startPage] : [c.startPage, c.endPage],
          c.startSurahId,
          c.startAyah,
          c.endSurahId,
          c.endAyah
        );
        return !existingDescriptions.has(desc);
      });

      const pool = freshCandidates.length > 0 ? freshCandidates : candidates;
      chosenCandidate = pool[Math.floor(Math.random() * pool.length)];
      break;
    }
  }

  if (!chosenCandidate) {
    const fallbackPage = candidatePages[0] || sortedPages[0] || 582;
    return createFallbackPassage(passageNumber, fallbackPage);
  }

  const pagesList = chosenCandidate.startPage === chosenCandidate.endPage 
    ? [chosenCandidate.startPage] 
    : [chosenCandidate.startPage, chosenCandidate.endPage];
  const surahName1 = surahNames[chosenCandidate.startSurahId] || '';
  const surahName2 = surahNames[chosenCandidate.endSurahId] || '';
  const sameSurah = chosenCandidate.startSurahId === chosenCandidate.endSurahId;

  const desc = formatPassageDescription(
    pagesList,
    chosenCandidate.startSurahId,
    chosenCandidate.startAyah,
    chosenCandidate.endSurahId,
    chosenCandidate.endAyah
  );

  let positionLabel = `ص ${toArabicDigits(chosenCandidate.startPage)}`;
  if (chosenCandidate.positionType === 'cross-page') {
    positionLabel = `ص ${toArabicDigits(chosenCandidate.startPage)}-${toArabicDigits(chosenCandidate.endPage)}`;
  }

  const highlights: Record<number, PassageHighlight> = {};
  if (chosenCandidate.startPage === chosenCandidate.endPage) {
    const topPercent = Math.max(3, Math.min(85, Math.round(((chosenCandidate.startLine - 1) / 15) * 100) + 2));
    const heightPercent = Math.min(95, Math.max(25, Math.round((chosenCandidate.linesCount / 15) * 100)));
    highlights[chosenCandidate.startPage] = {
      page: chosenCandidate.startPage,
      topPercent,
      heightPercent,
      label: `آية ${toArabicDigits(chosenCandidate.startAyah)} إلى ${toArabicDigits(chosenCandidate.endAyah)}`,
    };
  } else {
    highlights[chosenCandidate.startPage] = {
      page: chosenCandidate.startPage,
      topPercent: Math.max(3, Math.min(85, Math.round(((chosenCandidate.startLine - 1) / 15) * 100) + 2)),
      heightPercent: Math.min(95, Math.max(20, Math.round((chosenCandidate.p1Lines / 15) * 100))),
      label: `آية ${toArabicDigits(chosenCandidate.startAyah)} فصاعداً`,
    };
    highlights[chosenCandidate.endPage] = {
      page: chosenCandidate.endPage,
      topPercent: 3,
      heightPercent: Math.min(95, Math.max(20, Math.round((chosenCandidate.p2Lines / 15) * 100))),
      label: `إلى آية ${toArabicDigits(chosenCandidate.endAyah)}`,
    };
  }

  return {
    id: `passage-${passageNumber}-${chosenCandidate.startPage}-${Date.now()}`,
    passageNumber,
    pages: pagesList,
    surahName: sameSurah ? surahName1 : `${surahName1} / ${surahName2}`,
    startSurahId: chosenCandidate.startSurahId,
    startAyah: chosenCandidate.startAyah,
    endSurahId: chosenCandidate.endSurahId,
    endAyah: chosenCandidate.endAyah,
    startPage: chosenCandidate.startPage,
    endPage: chosenCandidate.endPage,
    positionType: chosenCandidate.positionType,
    positionLabel,
    description: desc,
    shortLabel: positionLabel,
    highlights,
    actualLinesCount: chosenCandidate.linesCount,
  };
}

function createFallbackPassage(passageNum: number, page: number): SuggestedTestPassage {
  return {
    id: `passage-${passageNum}-${page}`,
    passageNumber: passageNum,
    pages: [page],
    surahName: 'القرآن الكريم',
    startSurahId: 1,
    startAyah: 1,
    endSurahId: 1,
    endAyah: 7,
    startPage: page,
    endPage: page,
    positionType: 'beginning',
    positionLabel: `ص ${toArabicDigits(page)}`,
    description: `صفحة ${toArabicDigits(page)}`,
    shortLabel: `صفحة ${toArabicDigits(page)}`,
    highlights: {
      [page]: {
        page,
        topPercent: 4,
        heightPercent: 40,
        label: 'المقطع المحدد',
      },
    },
    actualLinesCount: 6.0,
  };
}

