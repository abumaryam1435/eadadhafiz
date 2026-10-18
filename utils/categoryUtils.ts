import { User, Student, Halaqa, SardHalaqa, IlmiyyaHalaqa } from '../types';

/**
 * فحص ما إذا كان المعلم تابعاً لقسم "خارج جامع عبري"
 */
export const isTeacherFromOutside = (
  teacherId: number,
  currentUser?: User | null,
  halaqas: Halaqa[] = [],
  sardHalaqas: SardHalaqa[] = [],
  ilmiyyaHalaqas: IlmiyyaHalaqa[] = []
): boolean => {
  if (currentUser && currentUser.id === teacherId && currentUser.category) {
    return currentUser.category === 'outside';
  }
  const teacherHalaqas = halaqas.filter(h => h.teacherId === teacherId || h.testTeacherId === teacherId);
  if (teacherHalaqas.some(h => h.category === 'outside')) {
    return true;
  }
  const teacherSards = sardHalaqas.filter(sh => sh.teacherId === teacherId);
  if (teacherSards.some(sh => sh.category === 'outside')) {
    return true;
  }
  const teacherIlmiyyas = ilmiyyaHalaqas.filter(ih => {
    if (ih.teacherIds && Array.isArray(ih.teacherIds)) return ih.teacherIds.includes(teacherId);
    return ih.teacherId === teacherId;
  });
  if (teacherIlmiyyas.some(ih => ih.category === 'outside')) {
    return true;
  }
  return false;
};

/**
 * فحص ما إذا كان الطالب تابعاً لقسم "خارج جامع عبري"
 */
export const isStudentFromOutside = (
  student: Student,
  halaqas: Halaqa[] = [],
  sardHalaqas: SardHalaqa[] = [],
  ilmiyyaHalaqas: IlmiyyaHalaqa[] = []
): boolean => {
  if (student.isFromIbri === false) {
    return true;
  }
  if (student.halaqaId) {
    const h = halaqas.find(item => item.id === student.halaqaId);
    if (h?.category === 'outside') {
      return true;
    }
  }
  if (student.sardHalaqaId) {
    const sh = sardHalaqas.find(item => item.id === student.sardHalaqaId);
    if (sh?.category === 'outside') {
      return true;
    }
  }
  if (student.ilmiyyaHalaqaId) {
    const ih = ilmiyyaHalaqas.find(item => item.id === student.ilmiyyaHalaqaId);
    if (ih?.category === 'outside') {
      return true;
    }
  }
  return false;
};

/**
 * فحص ما إذا كانت حلقة السرد تابعة لقسم "خارج جامع عبري"
 */
export const isSardHalaqaFromOutside = (
  sardHalaqa: SardHalaqa
): boolean => {
  return sardHalaqa.category === 'outside';
};
