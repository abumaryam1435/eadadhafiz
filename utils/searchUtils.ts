
export const normalizeArabic = (text: string): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "") // إزالة التشكيل والألف الخنجرية
    .replace(/ـ+/g, "") // إزالة التطويل والكشيدة
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ") // دمج المسافات المتعددة
    .trim();
};

/**
 * دالة لتطبيع وتوحيد أسماء الحلقات لاكتشاف أي تشابه أو تكرار بدقة عالية:
 * - توحيد الأرقام المشرقية (٠-٩) إلى (0-9)
 * - توحيد الأصفار في بادئة الأرقام (مثل 01 إلى 1)
 * - توحيد الهمزات والتاء المربوطة والألف المقصورة
 * - إزالة التشكيل وحركات الإعراب والتطويل
 * - دمج وتوحيد المسافات
 */
export const normalizeHalaqaName = (text: string): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/\b0+(\d+)\b/g, "$1") // إزالة الأصفار البادئة في الأرقام (مثال: حلقة 01 تتطابق مع حلقة 1)
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "") // إزالة التشكيل
    .replace(/ـ+/g, "") // إزالة الكشيدة / التطويل
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * البحث عن حلقة سابقة مطابقة أو مشابهة بالاسم، مع إمكانية استثناء معرف حلقة حالية عند التعديل
 */
export const findSimilarHalaqa = <T extends { id?: number; name: string }>(
  nameToCheck: string,
  existingHalaqas: T[],
  excludeId?: number
): T | undefined => {
  const normTarget = normalizeHalaqaName(nameToCheck);
  if (!normTarget) return undefined;
  return existingHalaqas.find(h => {
    if (excludeId !== undefined && h.id !== undefined && h.id === excludeId) return false;
    return normalizeHalaqaName(h.name) === normTarget;
  });
};

export const isSmartMatch = (text: string, query: string): boolean => {
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return true;
  
  const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
  const normalizedText = normalizeArabic(text);
  
  return tokens.every(token => normalizedText.includes(token));
};

export const formatWhatsAppNumber = (phone?: string, defaultDialCode = '968'): string => {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (!clean) return '';

  if (clean.startsWith('00')) {
    clean = clean.slice(2);
  }

  // If starts with Saudi mobile format (05...)
  if (clean.startsWith('05')) {
    return `966${clean.slice(1)}`;
  }

  // Remove local leading single zero
  if (clean.startsWith('0')) {
    clean = clean.replace(/^0+/, '');
  }

  // If already starts with 968
  if (clean.startsWith('968')) {
    return clean;
  }

  // If already starts with common country codes and is a full number
  const knownCountryCodes = ['966', '971', '965', '974', '973', '962', '963', '961', '967', '20'];
  if (knownCountryCodes.some(code => clean.startsWith(code)) && clean.length >= 10) {
    return clean;
  }

  // Default to 968
  return `${defaultDialCode}${clean}`;
};
