/**
 * دوال مساعدة لحساب أخطاء تقييم السرد والتقدير المستحق
 *
 * معايير الأخطاء:
 * - الفتح: 1
 * - التشكيل: 1
 * - التجويد: 0.5
 *
 * معايير التقدير:
 * - ممتاز مع الشرف: من دون خطأ (0)
 * - ممتاز: أقل من 10 أخطاء (> 0 و < 10)
 * - جيد جداً: أقل من 20 خطأ (>= 10 و < 20)
 * - ضعيف: 20 خطأ فأكثر (>= 20)
 */

export const calculateSardTotalErrors = (
  fathErrors: number = 0,
  hesitationErrors: number = 0, // التشكيل والتردد
  tajweedErrors: number = 0 // التجويد
): number => {
  const f = Math.max(0, Number(fathErrors) || 0);
  const h = Math.max(0, Number(hesitationErrors) || 0);
  const t = Math.max(0, Number(tajweedErrors) || 0);
  const total = f * 1 + h * 1 + t * 0.5;
  return Math.floor(total);
};

export const calculateSardGrade = (totalErrors: number): string => {
  const errors = Math.max(0, Number(totalErrors) || 0);
  if (errors === 0) {
    return 'ممتاز مع الشرف';
  }
  if (errors < 10) {
    return 'ممتاز';
  }
  if (errors < 20) {
    return 'جيد جداً';
  }
  return 'ضعيف';
};

export const getSardGradeBadgeClass = (grade: string): string => {
  switch (grade) {
    case 'ممتاز مع الشرف':
      return 'bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 ring-1 ring-amber-400 font-black';
    case 'ممتاز':
      return 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-200 ring-1 ring-emerald-400 font-black';
    case 'جيد جداً':
    case 'جيد جدا':
      return 'bg-blue-100 text-blue-950 dark:bg-blue-900/60 dark:text-blue-200 ring-1 ring-blue-400 font-black';
    case 'جيد':
      return 'bg-yellow-100 text-yellow-950 dark:bg-yellow-900/60 dark:text-yellow-200 font-bold';
    case 'ضعيف':
    default:
      return 'bg-red-100 text-red-950 dark:bg-red-900/60 dark:text-red-200 ring-1 ring-red-400 font-black';
  }
};
