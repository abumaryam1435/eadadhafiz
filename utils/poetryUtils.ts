/**
 * أدوات معالجة وتنسيق الشعر العربي والمتون العلمية
 * تقوم بتقسيم الأبيات إلى (صدر وعجز) ومحاذاة الأطوال بالتوازي
 * عبر تمديد الحروف بالتكشيدة العربية ("ـ" Tatweel) حصراً
 * دون أي فراغات أو مسافات إضافية بين الكلمات.
 */

// حروف الانفصال في اللغة العربية (لا تتصل بما بعدها، وبالتالي لا يمكن وضع كشيدة بعدها)
const NON_CONNECTING_LETTERS = new Set([
  'ا', 'أ', 'إ', 'آ', 'ٱ',
  'د', 'ذ',
  'ر', 'ز',
  'و', 'ؤ',
  'ة',
  'ء',
  'ى'
]);

// علامات التشكيل والحركات
const DIACRITICS_REGEX = /[\u064B-\u065F\u0670]/;

export const isArabicDiacritic = (char: string): boolean => {
  return DIACRITICS_REGEX.test(char);
};

/**
 * تنظيف النص من علامات التشكيل والكشيدات لحساب الطول البصري الحقيقي للحروف
 */
export const stripDiacriticsAndTatweel = (text: string): string => {
  return text.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
};

/**
 * حساب الطول البصري التقريبي للنص (الحروف والمسافات بدون حركات)
 */
export const getVisualLength = (text: string): number => {
  return text.replace(/[\u064B-\u065F\u0670]/g, '').length;
};

export interface VerseHemistichs {
  sadr: string; // الشطر الأول (الصدر)
  ajuz: string; // الشطر الثاني (العجز)
  hasAjuz: boolean;
}

/**
 * إزالة علامات الفصل والترقيم والرموز من أطراف الشطرين لضمان بقاء كلمات البيت نقية
 */
export const cleanHemistichBoundary = (text: string): string => {
  return text
    .replace(/^[\s،,;؛|#*\-–—~=_\/\\….:❖۞۝۩✦✧◇◆¤•■□★☆]+/gu, '')
    .replace(/[\s،,;؛|#*\-–—~=_\/\\….:❖۞۝۩✦✧◇◆¤•■□★☆]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * تقسيم البيت الشعري إلى شطرين (الصدر والعجز) بدقة متناهية:
 * 1. يدعم الرمز ❖ والرموز الزخرفية الشعرية
 * 2. يدعم الفواصل الصريحة (*، ...، #، |، ||، شرطة، علامة تبويب)
 * 3. يدعم المسافات المتعددة (مسافتين أو أكثر تفصل بين الصدر والعجز)
 * 4. يدعم الفاصلة العربية "،" أو الإنجليزية "," والفاصلة المنقوطة "؛"
 * 5. إذا لم توجد أي علامة فاصلة ولديه كلمات كافية يقسمه تلقائياً في المنتصف
 */
export const splitVerseIntoHemistichs = (rawLine: string): VerseHemistichs => {
  const line = rawLine.trim();
  if (!line) {
    return { sadr: '', ajuz: '', hasAjuz: false };
  }

  // 1. فحص الفواصل الصريحة والرموز الشعرية المعتمدة (بما فيها ❖ و |)
  const explicitSeparators = [
    '❖', '۞', '۝', '۩', '✦', '✧', '◇', '◆', '¤', '•', '■', '□', '★', '☆',
    '***', '**', '*',
    '.....', '....', '...', '…',
    '||', '|', '¦',
    '//', '/', '\\',
    '###', '##', '#',
    '\t',
    ' — ', ' – ', ' - ', '---', '--',
  ];

  for (const sep of explicitSeparators) {
    if (line.includes(sep)) {
      const parts = line.split(sep);
      const first = cleanHemistichBoundary(parts[0]);
      const rest = cleanHemistichBoundary(parts.slice(1).join(' '));
      if (first && rest) {
        return {
          sadr: first,
          ajuz: rest,
          hasAjuz: true,
        };
      }
    }
  }

  // 2. فحص المسافات المتعددة (مسافتين متتاليتين أو أكثر تفصل بين الصدر والعجز)
  const multiSpaceGaps = [...line.matchAll(/\s{2,}/g)];
  if (multiSpaceGaps.length > 0) {
    const halfLen = line.length / 2;
    // نفضل الفجوة الأطول مسافة (كالفراغات الواسعة بين الشطرين)، أو الأقرب للمنتصف
    const bestGap = multiSpaceGaps.reduce((closest, current) => {
      const currentLen = current[0].length;
      const closestLen = closest[0].length;
      if (currentLen >= closestLen + 2) return current;
      if (closestLen >= currentLen + 2) return closest;

      const currentDist = Math.abs((current.index ?? 0) - halfLen);
      const closestDist = Math.abs((closest.index ?? 0) - halfLen);
      return currentDist < closestDist ? current : closest;
    });

    if (bestGap.index !== undefined) {
      const first = cleanHemistichBoundary(line.slice(0, bestGap.index));
      const rest = cleanHemistichBoundary(line.slice(bestGap.index + bestGap[0].length));
      if (first && rest) {
        return {
          sadr: first,
          ajuz: rest,
          hasAjuz: true,
        };
      }
    }
  }

  // 3. فحص الفاصلة العربية "،" أو الإنجليزية "," أو الفاصلة المنقوطة "؛" و ";"
  const commaMatches = [...line.matchAll(/[\u060C,؛;]/g)];
  if (commaMatches.length > 0) {
    const halfLen = line.length / 2;
    // تفضيل الفاصلة المحاطة بمسافات أولاً، ثم الأقرب للمنتصف
    const bestComma = commaMatches.reduce((closest, current) => {
      const currentIdx = current.index ?? 0;
      const closestIdx = closest.index ?? 0;

      const currentHasSpace =
        (currentIdx > 0 && line[currentIdx - 1] === ' ') ||
        (currentIdx < line.length - 1 && line[currentIdx + 1] === ' ');
      const closestHasSpace =
        (closestIdx > 0 && line[closestIdx - 1] === ' ') ||
        (closestIdx < line.length - 1 && line[closestIdx + 1] === ' ');

      if (currentHasSpace && !closestHasSpace) return current;
      if (!currentHasSpace && closestHasSpace) return closest;

      const currentDist = Math.abs(currentIdx - halfLen);
      const closestDist = Math.abs(closestIdx - halfLen);
      return currentDist < closestDist ? current : closest;
    });

    if (bestComma.index !== undefined) {
      const first = cleanHemistichBoundary(line.slice(0, bestComma.index));
      const rest = cleanHemistichBoundary(line.slice(bestComma.index + 1));
      if (first && rest) {
        return {
          sadr: first,
          ajuz: rest,
          hasAjuz: true,
        };
      }
    }
  }

  // 4. إذا لم يكن هناك أي فاصل وكان البيت يحتوي على 4 كلمات فأكثر، نقسمه تلقائياً في المنتصف
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length >= 4) {
    const mid = Math.ceil(words.length / 2);
    const first = cleanHemistichBoundary(words.slice(0, mid).join(' '));
    const rest = cleanHemistichBoundary(words.slice(mid).join(' '));
    if (first && rest) {
      return {
        sadr: first,
        ajuz: rest,
        hasAjuz: true,
      };
    }
  }

  // 5. إذا كان سطراً مفرداً أو قصيراً جداً بدون شطرين
  return {
    sadr: cleanHemistichBoundary(line),
    ajuz: '',
    hasAjuz: false,
  };
};

/**
 * توحيد كتابة البيت الشعري واستبدال أي فاصل (فاصلة "،" أو مسافات متعددة أو "|" أو غيرها)
 * بالرمز الزخرفي ❖ في المنتصف تماماً بين الصدر والعجز
 */
export const standardizeVerseWithSymbol = (line: string): string => {
  const { sadr, ajuz, hasAjuz } = splitVerseIntoHemistichs(line);
  if (!hasAjuz || !ajuz) return sadr;
  return `${sadr} ❖ ${ajuz}`;
};

/**
 * البحث عن المواقع الصحيحة لغوياً لإدراج الكشيدة ("ـ") داخل كلمة عربية
 * يُشترط: حرف عربي متصل متبوع بحرف عربي آخر داخل الكلمة
 * استثناء: تجنب كسر رسم اللام-ألف (لا)
 */
export const findWordTatweelPositions = (word: string): number[] => {
  const positions: number[] = [];
  const chars = Array.from(word);

  for (let i = 0; i < chars.length - 1; i++) {
    const char = chars[i];

    if (isArabicDiacritic(char) || char === ' ' || char === '\u0640') {
      continue;
    }

    // حروف الانفصال لا تقبل المد بعدها
    if (NON_CONNECTING_LETTERS.has(char)) {
      continue;
    }

    // تجاوز الحركات الخاصة بالحرف الحالي
    let nextIdx = i + 1;
    while (nextIdx < chars.length && isArabicDiacritic(chars[nextIdx])) {
      nextIdx++;
    }

    if (nextIdx < chars.length) {
      const nextChar = chars[nextIdx];

      // تجنب مد داخل اللام ألف (لا / لأ / لإ / لآ)
      if (char === 'ل' && (nextChar === 'ا' || nextChar === 'أ' || nextChar === 'إ' || nextChar === 'آ')) {
        continue;
      }

      // الحرف التالي يجب أن يكون حرفاً عربياً متصلاً
      if (nextChar !== ' ' && nextChar !== '\u0640' && /[\u0621-\u064A]/.test(nextChar)) {
        positions.push(nextIdx);
      }
    }
  }

  return positions;
};

/**
 * تمديد النص الشعري بإدراج "ـ" في الكلمات بدون إضافة أي مسافات إضافية بين الكلمات
 * مثال: "وبعد فأفضل السلام" -> "وبعـــــد فأفضــــــــــــــل الســــــــــــــــلام"
 */
export const stretchHemistich = (
  text: string,
  targetLength: number
): string => {
  if (!text || !text.trim()) return text;

  // تنظيف الكشيدات السابقة وضبط المسافات إلى مسافة واحدة مفردة فقط بين كل كلمتين
  const cleanText = text.replace(/\u0640+/g, '').replace(/\s+/g, ' ').trim();
  const currentLen = getVisualLength(cleanText);

  const neededTatweels = targetLength - currentLen;
  if (neededTatweels <= 0) {
    return cleanText;
  }

  const words = cleanText.split(' ').filter(Boolean);
  if (words.length === 0) return cleanText;

  // إيجاد مواضع المد المتاحة في كل كلمة
  const wordsData = words.map(word => {
    const positions = findWordTatweelPositions(word);
    return {
      word,
      positions,
      hasPositions: positions.length > 0,
    };
  });

  const validWordIndices = wordsData
    .map((item, idx) => (item.hasPositions ? idx : -1))
    .filter(idx => idx !== -1);

  if (validWordIndices.length === 0) {
    return cleanText;
  }

  // توزيع الكشيدات المطلوبة بالكامل على الكلمات بالتساوي
  const baseCount = Math.floor(neededTatweels / validWordIndices.length);
  const remainder = neededTatweels % validWordIndices.length;

  const wordAllocations = new Array(words.length).fill(0);
  for (let i = 0; i < validWordIndices.length; i++) {
    const wIdx = validWordIndices[i];
    wordAllocations[wIdx] = baseCount + (i < remainder ? 1 : 0);
  }

  // مد كل كلمة بإدراج الكشيدات في أنسب موضع مد (الموضع الأخير قبل نهاية الكلمة مثل: ع في وبعد، ض في فأفضل، س في السلام)
  const stretchedWords = wordsData.map((item, idx) => {
    const count = wordAllocations[idx];
    if (count <= 0 || item.positions.length === 0) {
      return item.word;
    }

    // اختيار أنسب موضع (الموضع الأخير المتصل في الكلمة يعطي المظهر الكلاسيكي الأجمل)
    const targetPos = item.positions[item.positions.length - 1];
    const chars = Array.from(item.word);
    const before = chars.slice(0, targetPos).join('');
    const after = chars.slice(targetPos).join('');
    return `${before}${'\u0640'.repeat(count)}${after}`;
  });

  // إعادة دمج الكلمات بمسافة مفردة عادية تماماً (بدون أي مسافات زائدة)
  return stretchedWords.join(' ');
};

export interface FormattedPoeticVerse {
  index: number;
  original: string;
  sadr: string;
  ajuz: string;
  formattedSadr: string;
  formattedAjuz: string;
  hasAjuz: boolean;
  inRange?: boolean;
  isPrevRange?: boolean;
}

export type AlignBasis = 'poem';

/**
 * تنسيق مجموعة الأبيات الشعرية:
 * - الاعتماد الدائم على أطول شطر (صدراً أو عجزاً) في المتن كله بدون كشيدة
 * - تمديد كل شطر بالكشيدة ("ـ") بحيث يساوي طوله بعد التمديد أطول شطر في المتن كله بدون كشيدة
 * - الحفاظ على مسافة مفردة طبيعية بين الكلمات دون أي فراغات أو مسافات إضافية
 */
export const formatPoemVerses = (
  verses: string[],
  options?: {
    enableTatweel?: boolean;
    alignBasis?: string;
    startIndex?: number;
    rangeFrom?: number;
    rangeTo?: number;
    prevRangeFrom?: number;
    prevRangeTo?: number;
  }
): FormattedPoeticVerse[] => {
  const {
    enableTatweel = true,
    startIndex = 1,
    rangeFrom,
    rangeTo,
    prevRangeFrom,
    prevRangeTo,
  } = options || {};

  // 1. تفكيك الأبيات إلى صدر وعجز وتنظيف المسافات وحذف أي كشيدات سابقة لحساب الطول الخام
  const parsed = verses.map((v, idx) => {
    const verseIndex = startIndex + idx;
    const hemistichs = splitVerseIntoHemistichs(v);
    const cleanSadr = cleanHemistichBoundary(hemistichs.sadr.replace(/\u0640+/g, ''));
    const cleanAjuz = cleanHemistichBoundary(hemistichs.ajuz.replace(/\u0640+/g, ''));
    const inRange =
      rangeFrom !== undefined && rangeTo !== undefined
        ? verseIndex >= rangeFrom && verseIndex <= rangeTo
        : true;
    const isPrevRange = prevRangeFrom !== undefined && prevRangeTo !== undefined
      ? verseIndex >= prevRangeFrom && verseIndex <= prevRangeTo && !inRange
      : false;

    return {
      index: verseIndex,
      original: v,
      sadr: cleanSadr,
      ajuz: cleanAjuz,
      hasAjuz: hemistichs.hasAjuz,
      inRange,
      isPrevRange,
      cleanSadrLen: getVisualLength(cleanSadr),
      cleanAjuzLen: getVisualLength(cleanAjuz),
    };
  });

  if (!enableTatweel || parsed.length === 0) {
    return parsed.map(p => ({
      index: p.index,
      original: p.original,
      sadr: p.sadr,
      ajuz: p.ajuz,
      formattedSadr: p.sadr,
      formattedAjuz: p.ajuz,
      hasAjuz: p.hasAjuz,
      inRange: p.inRange,
      isPrevRange: p.isPrevRange,
    }));
  }

  // 2. حساب أطول شطر في المتن كله بدون كشيدة (مأخوذ من جميع صدور وأعجاز أبيات المتن)
  const candidateLengths = parsed.flatMap(p =>
    p.hasAjuz ? [p.cleanSadrLen, p.cleanAjuzLen] : [p.cleanSadrLen]
  );
  const globalMaxLen = candidateLengths.length > 0 ? Math.max(...candidateLengths, 20) : 20;

  // 3. تمديد كل شطر في المتن بالكشيدة ليساوي طوله أطول شطر في المتن كله بدون كشيدة
  return parsed.map(p => {
    const formattedSadr = stretchHemistich(p.sadr, globalMaxLen);
    const formattedAjuz = p.hasAjuz ? stretchHemistich(p.ajuz, globalMaxLen) : '';

    return {
      index: p.index,
      original: p.original,
      sadr: p.sadr,
      ajuz: p.ajuz,
      formattedSadr,
      formattedAjuz,
      hasAjuz: p.hasAjuz,
      inRange: p.inRange,
      isPrevRange: p.isPrevRange,
    };
  });
};
