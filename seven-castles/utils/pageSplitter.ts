import { QURAN_QUARTERS } from './quranQuarters';
import { getPageVerseSubset, VerseRange, SURAH_METADATAList, formatVerseDescription } from './quranPageMapping';

export function formatVerseDescForTitle(ranges: VerseRange[]): string {
  return formatVerseDescription(ranges);
}

function getSurahNum(surahName: string): number {
  const normalized = surahName.replace("سورة ", "").trim();
  const idx = SURAH_METADATAList.findIndex(s => 
    s.name === normalized || 
    s.name.replace(/[أإآاةه]/g, '') === normalized.replace(/[أإآاةه]/g, '')
  );
  return idx >= 0 ? idx + 1 : 1;
}

function compareVerses(s1: number, a1: number, s2: number, a2: number): number {
  if (s1 !== s2) {
    return s1 - s2;
  }
  return a1 - a2;
}

export function getQuarterForVerse(surahName: string, ayah: number): number {
  const surahNum = getSurahNum(surahName);
  
  for (let i = 0; i < QURAN_QUARTERS.length; i++) {
    const q = QURAN_QUARTERS[i];
    
    // Compare with current quarter start
    const startCompare = compareVerses(surahNum, ayah, q.surahNum, q.ayah);
    if (startCompare < 0) {
      return i; // fallback to index as quarter number (or i since it's 1-based)
    }
    
    // If it's the last quarter, it belongs to it
    if (i === QURAN_QUARTERS.length - 1) {
      return q.number;
    }
    
    // Check if it is before the next quarter
    const nextQ = QURAN_QUARTERS[i + 1];
    const nextCompare = compareVerses(surahNum, ayah, nextQ.surahNum, nextQ.ayah);
    if (nextCompare < 0) {
      return q.number;
    }
  }
  
  return 1;
}

export function getSplitPartsForPage(page: number, activeQuarters?: number[]): VerseRange[][] {
  const fullRanges = getPageVerseSubset(page, 'full');
  if (!fullRanges || fullRanges.length === 0) return [];

  const allVerses: {surah: string, v: number}[] = [];
  fullRanges.forEach(r => {
    for(let v = r.start; v <= r.end; v++) {
      allVerses.push({surah: r.surah.replace("سورة ", ""), v});
    }
  });

  const parts: VerseRange[][] = [];
  let currentPartVerses: {surah: string, v: number}[] = [];

  const quartersOnPage = QURAN_QUARTERS.filter(q => q.startPage === page);

  for (let i = 0; i < allVerses.length; i++) {
    const verse = allVerses[i];
    if (i > 0) {
       const isQuarterStart = quartersOnPage.some(q => 
         q.surahName.replace("سورة ", "") === verse.surah && q.ayah === verse.v
       );
       if (isQuarterStart) {
         if (currentPartVerses.length > 0) {
           parts.push(compactVersesToRanges(currentPartVerses));
           currentPartVerses = [];
         }
       }
    }
    currentPartVerses.push(verse);
  }

  if (currentPartVerses.length > 0) {
    parts.push(compactVersesToRanges(currentPartVerses));
  }

  // Filter parts if activeQuarters are provided
  if (activeQuarters && activeQuarters.length > 0) {
    return parts.filter(part => {
      if (part.length === 0) return false;
      const firstVerse = part[0];
      const qNum = getQuarterForVerse(firstVerse.surah, firstVerse.start);
      return activeQuarters.includes(qNum);
    });
  }

  return parts;
}

function compactVersesToRanges(verses: {surah: string, v: number}[]): VerseRange[] {
  const subRanges: VerseRange[] = [];
  let currRange: VerseRange | null = null;
  verses.forEach(item => {
    if (!currRange) {
      currRange = {surah: item.surah, start: item.v, end: item.v};
    } else if (currRange.surah === item.surah && item.v === currRange.end + 1) {
      currRange.end = item.v;
    } else {
      subRanges.push(currRange);
      currRange = {surah: item.surah, start: item.v, end: item.v};
    }
  });
  if (currRange) subRanges.push(currRange);
  return subRanges;
}
