/**
 * أدوات وروابط تقارير أولياء الأمور
 */

// تحويل الأرقام المشرقية (٠-٩) إلى الأرقام الإنجليزية (0-9)
export const convertArabicDigitsToEnglish = (str: string): string => {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, d => arabicDigits.indexOf(d).toString());
};

/**
 * تنظيف وتطبيع رقم هاتف ولي الأمر لمطابقته بدقة:
 * - تحويل الأرقام المشرقية
 * - إزالة المسافات، الفواصل، علامات الزائد، والأحرف المخفية (مثل LRM \u200e)
 * - إزالة مفتاح سلطنة عمان الدولي (968 أو 00968) إن وجد لمقارنة الرقم الأساسي المكون من 8 خانات
 */
export const normalizeParentPhone = (phone?: string | null): string => {
  if (!phone) return '';
  let cleaned = convertArabicDigitsToEnglish(String(phone));
  // إزالة كل ما ليس رقماً
  cleaned = cleaned.replace(/\D/g, '');
  
  // إزالة أصفار البداية إذا كانت دولية
  if (cleaned.startsWith('00968') && cleaned.length > 8) {
    cleaned = cleaned.slice(5);
  } else if (cleaned.startsWith('968') && cleaned.length > 8) {
    cleaned = cleaned.slice(3);
  }
  
  return cleaned;
};

/**
 * التحقق من تطابق رقمي هاتف
 */
export const matchesParentPhone = (phoneA?: string | null, phoneB?: string | null): boolean => {
  const normA = normalizeParentPhone(phoneA);
  const normB = normalizeParentPhone(phoneB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  // في حال كان أحدهما 8 أرقام والآخر يحتوي على مفتاح إضافي
  if (normA.endsWith(normB) || normB.endsWith(normA)) return true;
  return false;
};

/**
 * توليد كود عشوائي مستقر لكل ولي أمر وحفظه محلياً لضمان ثبات الرابط
 */
export const getParentRandomCode = (phone: string): string => {
  const norm = normalizeParentPhone(phone) || phone.trim();
  if (!norm) return '000000';

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('parent_random_codes');
      const map: Record<string, string> = stored ? JSON.parse(stored) : {};
      if (map[norm] && map[norm].length >= 4) {
        return map[norm];
      }
      // توليد كود عشوائي نظيف من 6 خانات حروف وأرقام واضحة
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      map[norm] = code;
      localStorage.setItem('parent_random_codes', JSON.stringify(map));
      return code;
    } catch (_) {}
  }

  // كود احتياطي متسق
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash * 31 + norm.charCodeAt(i)) & 0xffffff;
  }
  return hash.toString(36).toUpperCase().padStart(6, 'X');
};

/**
 * توليد الرابط الخاص لولي الأمر متضمناً رقم الهاتف وكوداً عشوائياً
 */
export const generateParentLink = (phone: string, code?: string, customBaseUrl?: string): string => {
  const norm = normalizeParentPhone(phone) || phone.trim();
  const parentCode = code || getParentRandomCode(norm);
  let base = (customBaseUrl && customBaseUrl.trim()) ? customBaseUrl.trim() : '';

  if (!base && typeof window !== 'undefined') {
    try {
      const savedBase = localStorage.getItem('parentPortalBaseUrl');
      if (savedBase && savedBase.trim()) {
        base = savedBase.trim();
      }
    } catch (_) {}
  }

  if (!base && typeof window !== 'undefined' && window.location?.origin) {
    base = window.location.origin;
  }
  
  // إزالة الشرطة المائلة الزائدة في النهاية
  base = base.replace(/\/+$/, '');

  // رابط الاستعلام ?parent= مع كود عشوائي فريد لضمان العمل بسلاسة عبر جميع المتصفحات والاستضافات
  return `${base}/?parent=${encodeURIComponent(norm)}&code=${encodeURIComponent(parentCode)}`;
};

/**
 * توليد رابط المسار المباشر كخيار بديل /parent/:phone
 */
export const generateParentDirectPathLink = (phone: string, customBaseUrl?: string): string => {
  const norm = normalizeParentPhone(phone) || phone.trim();
  const parentCode = getParentRandomCode(norm);
  let base = (customBaseUrl && customBaseUrl.trim()) ? customBaseUrl.trim() : '';

  if (!base && typeof window !== 'undefined') {
    try {
      const savedBase = localStorage.getItem('parentPortalBaseUrl');
      if (savedBase && savedBase.trim()) {
        base = savedBase.trim();
      }
    } catch (_) {}
  }

  if (!base && typeof window !== 'undefined' && window.location?.origin) {
    base = window.location.origin;
  }

  base = base.replace(/\/+$/, '');
  return `${base}/parent/${encodeURIComponent(norm)}?code=${encodeURIComponent(parentCode)}`;
};

/**
 * تجهيز نص رسالة الواتساب الجاهزة للإرسال لولي الأمر
 */
export const generateParentWhatsAppMessage = (
  studentNames: string[],
  link: string,
  appName: string = 'مشروع إعداد حافظ',
  customTemplate?: string
): string => {
  const namesStr = studentNames.length === 1 
    ? `ابنكم/ابنتكم: *${studentNames[0]}*` 
    : `الأبناء: *${studentNames.join(' و ')}*`;

  let template = customTemplate;
  if (!template && typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('parentWhatsAppTemplate');
      if (saved && saved.trim()) {
        template = saved;
      }
    } catch (_) {}
  }

  if (template && template.trim()) {
    return template
      .replace(/\{student_names\}/g, namesStr)
      .replace(/\{names\}/g, namesStr)
      .replace(/\{link\}/g, link)
      .replace(/\{appName\}/g, appName)
      .replace(/\{app_name\}/g, appName);
  }

  return `السلام عليكم ورحمة الله وبركاته 🌿\n\nأهلاً بكم في *${appName}*.\n\nيسرنا مشاركتكم رابط تقرير متابعة الحفظ والمراجعة الأسبوعية الخاص بـ ${namesStr}:\n\n🔗 ${link}\n\nنسأل الله تعالى لهم التوفيق والبركة في حفظ القرآن الكريم.`;
};
