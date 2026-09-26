import { getLevelNumericRank } from './pageUtils';

/**
 * Grade ranks (التقدير):
 * ممتاز مع الشرف -> ممتاز -> جيد جدا -> جيد -> مقبول -> ضعيف -> غائب -> إعادة
 */
export function getGradeRank(gradeStr: any): number {
  if (!gradeStr) return 999;
  const s = String(gradeStr).trim();
  if (!s || s === '—' || s === 'undefined' || s === 'null') return 999;
  if (s.includes('شرف') || s.includes('مع الشرف')) return 1;
  if (s === 'ممتاز') return 2;
  if (s.includes('جيد جدا') || s.includes('جيد جداً')) return 3;
  if (s === 'جيد') return 4;
  if (s === 'مقبول') return 5;
  if (s === 'ضعيف') return 6;
  if (s === 'غائب') return 7;
  if (s.includes('إعادة') || s.includes('اعادة')) return 8;
  return 900;
}

/**
 * Performance ranks (الأداء):
 * ممتاز -> خطأ واحد -> خطآن -> 3 أخطاء -> 4 أخطاء -> 5 أخطاء -> أكثر من 5 أخطاء
 */
export function getPerformanceRank(perfStr: any): number {
  if (!perfStr) return 999;
  const s = String(perfStr).trim();
  if (!s || s === '—' || s === 'undefined') return 999;
  if (s === 'excellent' || s === 'ممتاز') return 1;
  if (s === 'one_error' || s.includes('خطأ واحد')) return 2;
  if (s === 'two_errors' || s.includes('خطآن') || s.includes('خطئين')) return 3;
  if (s === '3 أخطاء' || s === 'three_errors' || s.includes('3')) return 4;
  if (s === '4 أخطاء' || s === 'four_errors' || s.includes('4')) return 5;
  if (s === '5 أخطاء' || s === 'five_errors' || s.includes('5')) return 6;
  if (s === 'more_than_five_errors' || s.includes('أكثر من') || s.includes('اكثر من')) return 7;
  return 900;
}

/**
 * Attendance ranks (الحضور):
 * حاضر -> متأخر -> معذور -> غائب -> غير مستعد / لم يحفظ
 */
export function getAttendanceRank(attStr: any): number {
  if (!attStr) return 999;
  const s = String(attStr).trim();
  if (!s || s === '—') return 999;
  if (s === 'present' || s === 'حاضر') return 1;
  if (s === 'late' || s === 'maghrib_late' || s === 'متأخر') return 2;
  if (s === 'with_excuse' || s === 'maghrib_excused' || s.includes('عذر') || s.includes('معذور')) return 3;
  if (s === 'without_excuse' || s.includes('بدون عذر')) return 4;
  if (s === 'absent' || s === 'maghrib_absent' || s === 'غائب') return 5;
  if (s === 'unprepared' || s.includes('غير مستعد') || s.includes('لم يحفظ') || s.includes('لم يسمع')) return 6;
  return 900;
}

/**
 * Periodic review ranks (المراجعة الدورية):
 * ملتزم -> غير ملتزم -> غير محدد
 */
export function getPeriodicReviewRank(statusStr: any): number {
  if (!statusStr) return 999;
  const s = String(statusStr).trim();
  if (!s || s === '—') return 999;
  if (s === 'committed' || s === 'ملتزم') return 1;
  if (s === 'not_committed' || s === 'غير ملتزم') return 2;
  if (s === 'not_assigned' || s === 'غير محدد') return 3;
  return 900;
}

/**
 * Evaluation type ranks (نوع التقييم):
 * حفظ -> مراجعة -> لم يحفظ
 */
export function getEvaluationTypeRank(typeStr: any): number {
  if (!typeStr) return 999;
  const s = String(typeStr).trim();
  if (!s || s === '—') return 999;
  if (s === 'memorization' || s === 'حفظ') return 1;
  if (s === 'review' || s === 'مراجعة') return 2;
  if (s === 'did_not_memorize' || s === 'لم يحفظ') return 3;
  return 900;
}

/**
 * School stage ranks (المرحلة الدراسية):
 * تمهيدي -> صف 1 .. صف 12 -> جامعي
 */
export function getSchoolStageRank(stageStr: any): number {
  if (!stageStr) return 999;
  const s = String(stageStr).trim();
  if (!s || s === '—') return 999;
  if (s.includes('تمهيدي') || s.includes('روضة') || s.includes('براعم')) return 0;

  // Check for numbers (1 to 12)
  const match = s.match(/\d+/);
  if (match) {
    const n = parseInt(match[0], 10);
    if (!isNaN(n)) return n;
  }

  if (s.includes('أول') || s.includes('اول')) return 1;
  if (s.includes('ثان') || s.includes('ثاني')) return 2;
  if (s.includes('ثالث')) return 3;
  if (s.includes('رابع')) return 4;
  if (s.includes('خامس')) return 5;
  if (s.includes('سادس')) return 6;
  if (s.includes('سابع')) return 7;
  if (s.includes('ثامن')) return 8;
  if (s.includes('تاسع')) return 9;
  if (s.includes('عاشر')) return 10;
  if (s.includes('حادي عشر')) return 11;
  if (s.includes('ثاني عشر')) return 12;
  if (s.includes('جامع') || s.includes('كلية')) return 13;
  if (s.includes('خريج')) return 14;

  return 900;
}

/**
 * Boolean string ranks (نعم / لا أو ناجح / راسب):
 */
export function getBooleanRank(val: any): number {
  if (val === true || val === 'نعم' || val === 'ناجح' || val === 'اجتاز') return 1;
  if (val === false || val === 'لا' || val === 'راسب' || val === 'لم يجتز') return 2;
  return 999;
}

/**
 * Parse numeric value cleanly (including string with spaces/units like "15 صفحة" or "20%")
 */
export function extractNumeric(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const s = String(val).trim();
  if (s === '—' || s === '-' || s === '') return null;
  // Match first float or int
  const cleaned = s.replace(/,/g, '.');
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (match) {
    const num = parseFloat(match[0]);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Parse date or timestamp cleanly
 */
export function parseDateTimestamp(val: any): number | null {
  if (!val) return null;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (!s || s === '—') return null;

  // Handle formats like DD/MM/YYYY or YYYY-MM-DD
  const slashParts = s.split('/');
  if (slashParts.length === 3) {
    const d = parseInt(slashParts[0], 10);
    const m = parseInt(slashParts[1], 10) - 1;
    const y = parseInt(slashParts[2], 10);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      return new Date(y, m, d).getTime();
    }
  }

  const parsed = Date.parse(s);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Unified comparator for all report columns following the user's explicit rule:
 * - "studentName": ALWAYS Alphabetical (هجائياً)
 * - "teacherName" / "evaluatorName": ALWAYS Alphabetical (هجائياً)
 * - "halaqaName" / "studentOriginalHalaqaName": Alphabetical in Arabic with natural numbers
 * - All other columns: FOLLOW THE CORRECT LOGIC!
 *   - Levels: getLevelNumericRank (الأول < الثاني < الثالث < ...)
 *   - Grades: getGradeRank (ممتاز مع الشرف < ممتاز < جيد جداً < ...)
 *   - Performance: getPerformanceRank (ممتاز < خطأ واحد < ...)
 *   - Attendance: getAttendanceRank (حاضر < متأخر < معذور < غائب < ...)
 *   - Review / Evaluation type: logical rank
 *   - Counts, Scores, Pages, Weeks, Errors, Numbers: numerical comparison
 *   - Dates: chronological comparison
 *   - When values are equal: secondary sort by studentName alphabetically!
 */
export function compareReportRows<T extends Record<string, any>>(
  a: T,
  b: T,
  key: string,
  direction: 'ascending' | 'descending' = 'ascending'
): number {
  const dirMultiplier = direction === 'ascending' ? 1 : -1;

  // Helper for secondary tie-breaker by studentName
  const tieBreakByStudent = () => {
    const nameA = String(a.studentName || a.name || '');
    const nameB = String(b.studentName || b.name || '');
    return nameA.localeCompare(nameB, 'ar', { sensitivity: 'base' });
  };

  // 1. Student Name: Purely alphabetical
  if (key === 'studentName' || key === 'name') {
    const sA = String(a.studentName || a.name || '');
    const sB = String(b.studentName || b.name || '');
    const diff = sA.localeCompare(sB, 'ar', { sensitivity: 'base' });
    return diff !== 0 ? diff * dirMultiplier : 0;
  }

  // 2. Teacher Name / Evaluator Name: Purely alphabetical, fallback to studentName
  if (key === 'teacherName' || key === 'evaluatorName' || key === 'testTeacherName') {
    const tA = String(a[key] || '');
    const tB = String(b[key] || '');
    const diff = tA.localeCompare(tB, 'ar', { sensitivity: 'base' });
    if (diff !== 0) return diff * dirMultiplier;
    return tieBreakByStudent();
  }

  // 3. Halaqa Name: Alphabetical with numeric support, fallback to studentName
  if (key === 'halaqaName' || key === 'studentOriginalHalaqaName') {
    const hA = String(a[key] || '');
    const hB = String(b[key] || '');
    const diff = hA.localeCompare(hB, 'ar', { numeric: true });
    if (diff !== 0) return diff * dirMultiplier;
    return tieBreakByStudent();
  }

  // 4. Level (المستوى): Logical numerical rank!
  if (key === 'studentLevel' || key === 'level') {
    const rankA = getLevelNumericRank(a[key] || '');
    const rankB = getLevelNumericRank(b[key] || '');

    // Missing levels at the end
    const missingA = rankA === 999;
    const missingB = rankB === 999;
    if (missingA && !missingB) return 1;
    if (!missingA && missingB) return -1;
    if (missingA && missingB) return tieBreakByStudent();

    if (rankA !== rankB) {
      return (rankA - rankB) * dirMultiplier;
    }
    return tieBreakByStudent();
  }

  // 5. Grade (التقدير): Logical academic rank
  if (key === 'grade') {
    const rankA = getGradeRank(a.grade);
    const rankB = getGradeRank(b.grade);

    const missingA = rankA === 999;
    const missingB = rankB === 999;
    if (missingA && !missingB) return 1;
    if (!missingA && missingB) return -1;
    if (missingA && missingB) return tieBreakByStudent();

    if (rankA !== rankB) {
      return (rankA - rankB) * dirMultiplier;
    }
    return tieBreakByStudent();
  }

  // 6. Performance (الأداء)
  if (key === 'performance') {
    const rankA = getPerformanceRank(a.performance);
    const rankB = getPerformanceRank(b.performance);

    const missingA = rankA === 999;
    const missingB = rankB === 999;
    if (missingA && !missingB) return 1;
    if (!missingA && missingB) return -1;
    if (missingA && missingB) return tieBreakByStudent();

    if (rankA !== rankB) {
      return (rankA - rankB) * dirMultiplier;
    }
    return tieBreakByStudent();
  }

  // 7. Attendance (الحضور / الحالة)
  if (key === 'attendance' || key === 'status') {
    const rankA = getAttendanceRank(a[key]);
    const rankB = getAttendanceRank(b[key]);

    const missingA = rankA === 999;
    const missingB = rankB === 999;
    if (missingA && !missingB) return 1;
    if (!missingA && missingB) return -1;
    if (missingA && missingB) return tieBreakByStudent();

    if (rankA !== rankB) {
      return (rankA - rankB) * dirMultiplier;
    }
    return tieBreakByStudent();
  }

  // 8. Periodic Review (المراجعة الدورية)
  if (key === 'periodicReview') {
    const rankA = getPeriodicReviewRank(a.periodicReview);
    const rankB = getPeriodicReviewRank(b.periodicReview);
    if (rankA !== rankB) return (rankA - rankB) * dirMultiplier;
    return tieBreakByStudent();
  }

  // 9. Evaluation Type (النوع)
  if (key === 'evaluationType') {
    const rankA = getEvaluationTypeRank(a.evaluationType);
    const rankB = getEvaluationTypeRank(b.evaluationType);
    if (rankA !== rankB) return (rankA - rankB) * dirMultiplier;
    return tieBreakByStudent();
  }

  // 10. School stage (المرحلة الدراسية)
  if (key === 'schoolStage') {
    const rankA = getSchoolStageRank(a.schoolStage);
    const rankB = getSchoolStageRank(b.schoolStage);
    if (rankA !== rankB) return (rankA - rankB) * dirMultiplier;
    return tieBreakByStudent();
  }

  // 11. Booleans (من الأمين، من عبري، الاجتياز)
  if (key === 'isAlAmeenStr' || key === 'isFromIbriStr' || key === 'isPassed' || key === 'isAlAmeen' || key === 'isFromIbri') {
    const rankA = getBooleanRank(a[key]);
    const rankB = getBooleanRank(b[key]);
    if (rankA !== rankB) return (rankA - rankB) * dirMultiplier;
    return tieBreakByStudent();
  }

  // 12. Juz completed count or Juz string
  if (key === 'autoCompletedJuzsStr' || key === 'autoCompletedJuzsCount') {
    const countA = typeof a.autoCompletedJuzsCount === 'number'
      ? a.autoCompletedJuzsCount
      : (extractNumeric(a.autoCompletedJuzsStr) ?? 0);
    const countB = typeof b.autoCompletedJuzsCount === 'number'
      ? b.autoCompletedJuzsCount
      : (extractNumeric(b.autoCompletedJuzsStr) ?? 0);
    if (countA !== countB) return (countA - countB) * dirMultiplier;
    return tieBreakByStudent();
  }

  // 13. Last memorized page
  if (key === 'lastMemorizedPageStr') {
    const numA = extractNumeric(a.lastMemorizedPageStr);
    const numB = extractNumeric(b.lastMemorizedPageStr);
    const missingA = numA === null;
    const missingB = numB === null;
    if (missingA && !missingB) return 1;
    if (!missingA && missingB) return -1;
    if (missingA && missingB) return tieBreakByStudent();
    if (numA !== numB) return ((numA ?? 0) - (numB ?? 0)) * dirMultiplier;
    return tieBreakByStudent();
  }

  // 14. Dates (التاريخ)
  if (key === 'evaluationDate' || key === 'testDate' || key === 'date') {
    const timeA = parseDateTimestamp(a[key]);
    const timeB = parseDateTimestamp(b[key]);
    const missingA = timeA === null;
    const missingB = timeB === null;
    if (missingA && !missingB) return 1;
    if (!missingA && missingB) return -1;
    if (missingA && missingB) return tieBreakByStudent();
    if (timeA !== timeB) return ((timeA ?? 0) - (timeB ?? 0)) * dirMultiplier;
    return tieBreakByStudent();
  }

  // 15. Check if numeric column (scores, errors, counts, weeks, etc.)
  const valA = a[key];
  const valB = b[key];

  // Try extracting numbers first
  const numA = extractNumeric(valA);
  const numB = extractNumeric(valB);

  // If both values are numeric or numeric strings (or 0)
  if (numA !== null && numB !== null) {
    if (numA !== numB) {
      return (numA - numB) * dirMultiplier;
    }
    return tieBreakByStudent();
  }

  if (numA !== null && numB === null) return -1;
  if (numA === null && numB !== null) return 1;

  // 16. Fallback: string comparison with numeric support
  const sA = String(valA ?? '').trim();
  const sB = String(valB ?? '').trim();
  const missingA = !sA || sA === '—';
  const missingB = !sB || sB === '—';
  if (missingA && !missingB) return 1;
  if (!missingA && missingB) return -1;
  if (missingA && missingB) return tieBreakByStudent();

  const diff = sA.localeCompare(sB, 'ar', { numeric: true });
  if (diff !== 0) return diff * dirMultiplier;
  return tieBreakByStudent();
}
