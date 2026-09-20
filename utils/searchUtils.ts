
export const normalizeArabic = (text: string): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F]/g, "") // إزالة التشكيل
    .trim();
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
