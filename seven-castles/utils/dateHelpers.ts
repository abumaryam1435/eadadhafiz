/**
 * Helper utility to convert a Gregorian date to Hijri date in Arabic format
 * supporting per-month/year offsets.
 */

export const HIJRI_MONTHS_AR = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة"
];

/**
 * Get the Arabic name of a Hijri month by index (1-12)
 */
export function getHijriMonthNameAr(month: number): string {
  return HIJRI_MONTHS_AR[month - 1] || "";
}

/**
 * Gets the base (0-offset) Hijri year and month for a Gregorian date
 */
export function getBaseHijriYearMonth(date: Date): { year: number; month: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      month: 'numeric',
      year: 'numeric'
    });
    const parts = formatter.formatToParts(date);
    const yearVal = parts.find(p => p.type === 'year')?.value;
    const monthVal = parts.find(p => p.type === 'month')?.value;
    return {
      year: yearVal ? parseInt(yearVal, 10) : 1447,
      month: monthVal ? parseInt(monthVal, 10) : 1
    };
  } catch (e) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
        month: 'numeric',
        year: 'numeric'
      });
      const parts = formatter.formatToParts(date);
      const yearVal = parts.find(p => p.type === 'year')?.value;
      const monthVal = parts.find(p => p.type === 'month')?.value;
      return {
        year: yearVal ? parseInt(yearVal, 10) : 1447,
        month: monthVal ? parseInt(monthVal, 10) : 1
      };
    } catch (err) {
      console.error("Error getting Hijri year/month:", err);
      return { year: 1447, month: 1 };
    }
  }
}

/**
 * Reads local storage to get the Hijri offset (in days) for a specific Hijri month & year
 */
export function getHijriOffsetForYearMonth(year: number, month: number): number {
  try {
    const stored = localStorage.getItem('hijriOffsets');
    if (stored) {
      const offsets = JSON.parse(stored);
      if (offsets && typeof offsets[`${year}-${month}`] === 'number') {
        return offsets[`${year}-${month}`];
      }
    }
  } catch (e) {
    console.error("Error formatting Hijri offset parsing:", e);
  }
  return 0; // default is no offset
}

/**
 * Resolves the offset for a given Gregorian date based on its base Hijri month/year
 */
export function getHijriOffsetForDate(date: Date): number {
  const { year, month } = getBaseHijriYearMonth(date);
  return getHijriOffsetForYearMonth(year, month);
}

/**
 * Converts a Gregorian date into a formatted Hijri string (e.g., "15 شعبان 1447 هـ")
 * with custom per-month offsets applied.
 */
export function getHijriDate(date: Date): string {
  try {
    const offset = getHijriOffsetForDate(date);
    const adjustedDate = new Date(date);
    if (offset !== 0) {
      adjustedDate.setDate(adjustedDate.getDate() + offset);
    }

    const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    let formatted = formatter.format(adjustedDate);
    if (formatted && !formatted.includes('هـ')) {
      formatted = `${formatted} هـ`;
    }
    return formatted;
  } catch (error) {
    try {
      const offset = getHijriOffsetForDate(date);
      const adjustedDate = new Date(date);
      if (offset !== 0) {
        adjustedDate.setDate(adjustedDate.getDate() + offset);
      }

      // Fallback to basic islamic calendar locale subtag
      const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      let formatted = formatter.format(adjustedDate);
      if (formatted && !formatted.includes('هـ')) {
        formatted = `${formatted} هـ`;
      }
      return formatted;
    } catch (e) {
      console.error("Error formatting Hijri date:", e);
      return "";
    }
  }
}
