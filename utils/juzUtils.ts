export const toArabicDigits = (val: any): string => {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val);
  // تحويل أي أرقام مشرقية/هندية (٠-٩) إلى أرقام عربية قياسية (0-9)
  return str.replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString());
};

export const toEnglishDigits = (val: any): string => {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val);
  return str.replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString());
};

/**
 * دالة لتنسيق نطاقات الأرقام والأرقام المفردة باتجاه اليمين إلى اليسار (RTL)
 * تضمن ظهور البداية في اليمين والنهاية في اليسار (مثل: 1 - 2 أو 100 - 107)
 * حتى وإن لم يسبقها نص عربي، وتستخدم الأرقام العربية 1 2 3
 */
export const formatRtlRange = (val: any): string => {
  if (val === undefined || val === null || val === '') return '—';
  if (typeof val === 'number') return toArabicDigits(val);
  const strVal = String(val);
  const cleaned = strVal.replace(/[\u200E\u200F\u202A-\u202E]/g, '');
  const withArabic = toArabicDigits(cleaned);
  // تنسيق النطاقات مع علامة RTL لضمان ترتيب البداية على اليمين والنهاية على اليسار
  let formatted = withArabic.replace(/(\d+)\s*[-–—]\s*(\d+)/g, '\u200F$1 - $2\u200F');
  formatted = formatted.replace(/(\d+)\s*[,،]\s*(\d+)/g, '$1، $2');
  return formatted;
};

export function parseJuzsToNumbers(input: string | string[]): number[] {
  const parts = Array.isArray(input) ? input : input.split(/،|,/);
  const nums = new Set<number>();

  for (let part of parts) {
    part = part.trim().replace(/[\u200E\u200F\u202A-\u202E]/g, '');
    if (!part) continue;

    // Convert arabic numerals to english
    part = toEnglishDigits(part);

    const rangeMatch = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let i = min; i <= max; i++) {
        if (i <= 30 && i >= 1) {
          nums.add(i);
        }
      }
    } else {
      const val = parseInt(part, 10);
      if (!isNaN(val) && val >= 1 && val <= 30) {
        nums.add(val);
      }
    }
  }

  return Array.from(nums).sort((a, b) => a - b);
}

export function formatJuzsFromNumbers(nums: number[]): string {
  if (!nums || nums.length === 0) return "";

  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const ranges: string[] = [];

  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
    } else {
      if (start === prev) {
        ranges.push(toArabicDigits(start));
      } else if (prev === start + 1) {
        ranges.push(toArabicDigits(start) + "، " + toArabicDigits(prev));
      } else {
        ranges.push(formatRtlRange(`${start} - ${prev}`));
      }
      start = current;
      prev = current;
    }
  }

  return ranges.join("، ");
}

export function formatAndCountJuzs(input: string[] | string | undefined): {
  formatted: string;
  count: number;
  nums: number[];
} {
  if (!input || (Array.isArray(input) && input.length === 0))
    return { formatted: "", count: 0, nums: [] };
  const nums = parseJuzsToNumbers(input);
  return {
    formatted: formatJuzsFromNumbers(nums),
    count: nums.length,
    nums,
  };
}
