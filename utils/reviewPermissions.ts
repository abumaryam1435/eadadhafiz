import { Halaqa, Student, ReviewFeatureConfig } from '../types';

/**
 * Checks whether the "Review" (مراجعة) evaluation option is allowed for a given student and teacher.
 * By default (config is undefined or config.enabled is false), it returns false.
 * When enabled, checks if the teacher is authorized:
 * - If teacher has allStudents === true, returns true for all students under this teacher.
 * - If teacher has specific studentIds, returns true only if the studentId is in studentIds.
 */
export function isReviewAllowedForStudent(
  studentId: number | undefined,
  teacherId: number | undefined,
  config: ReviewFeatureConfig | undefined,
  halaqas: Halaqa[] = [],
  students: Student[] = []
): boolean {
  if (!config || !config.enabled) return false;

  // Resolve effective teacherId if not explicitly provided
  let effectiveTeacherId = teacherId;
  if (!effectiveTeacherId && studentId) {
    const student = students.find(s => s.id === studentId);
    if (student) {
      const halaqa = halaqas.find(h => h.id === student.halaqaId);
      if (halaqa) {
        effectiveTeacherId = halaqa.teacherId;
      }
    }
  }

  if (!effectiveTeacherId) return false;

  const teacherCfg = config.teachers?.[effectiveTeacherId] || config.teachers?.[String(effectiveTeacherId)];
  if (!teacherCfg || teacherCfg.enabled === false) return false;

  // If enabled for all students of this teacher
  if (teacherCfg.allStudents) {
    return true;
  }

  // If enabled for specific students
  if (studentId && Array.isArray(teacherCfg.studentIds)) {
    return teacherCfg.studentIds.includes(studentId);
  }

  return false;
}
