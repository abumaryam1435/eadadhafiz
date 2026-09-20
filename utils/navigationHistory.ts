// نظام التنقل باللمس والإيماءات والرجوع للخلف للشاشات السابقة بأمان تام
type BackHandler = () => boolean | void;

const handlerStack: BackHandler[] = [];
let isInitialized = false;

/**
 * تسجيل دالة رجوع خاصة بشاشة أو نافذة منبثقة معينة.
 * يتم استدعاؤها أولاً عند محاولة الرجوع.
 */
export function registerBackHandler(handler: BackHandler): () => void {
  handlerStack.push(handler);
  
  // دفع حالة في سجل المتصفح لدعم زر الرجوع في الهاتف (Android Back / Popstate)
  if (typeof window !== 'undefined' && window.history) {
    try {
      window.history.pushState({ appNavLevel: handlerStack.length }, '');
    } catch (_) {}
  }

  return () => {
    const idx = handlerStack.lastIndexOf(handler);
    if (idx !== -1) {
      handlerStack.splice(idx, 1);
    }
  };
}

/**
 * تنفيذ الرجوع للخلف:
 * يستدعي فقط أحدث معالج مسجل في المكدس (مثل إغلاق نافذة منبثقة أو الرجوع لخطوة سابقة).
 * تم إلغاء النقر البرمجي العشوائي على الأزرار لمنع الخروج المفاجئ أثناء تقييم الطلاب.
 */
export function triggerAppGoBack(): boolean {
  while (handlerStack.length > 0) {
    const handler = handlerStack.pop();
    if (handler) {
      try {
        const result = handler();
        if (result !== false) {
          triggerHapticFeedback();
          return true;
        }
      } catch (err) {
        console.error('Error executing back handler:', err);
      }
    }
  }

  return false;
}

function triggerHapticFeedback() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(15);
    } catch (_) {}
  }
}

/**
 * تهيئة الاستماع لزر الرجوع الفعلي للهاتف مع حماية استمارات التقييم
 */
export function initSwipeNavigation() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // دعم زر الرجوع المدمج بنظام الهاتف (Android System Back)
  window.addEventListener('popstate', () => {
    const handled = triggerAppGoBack();
    if (handled) {
      try {
        window.history.pushState({ appNavLevel: handlerStack.length }, '');
      } catch (_) {}
    }
  });
}

