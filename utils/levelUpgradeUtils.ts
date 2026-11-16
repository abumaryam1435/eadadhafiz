import { Student, Evaluation, SardEvaluation, Halaqa, SardHalaqa, User, PerformanceLevel } from '../types';
import { countQuranPages } from './quranData';
import { calculateStudentLevel } from './pageUtils';
import { toArabicDigits, toEnglishDigits, formatRtlRange } from './juzUtils';

export interface LevelUpgradeRecord {
  id: string;
  upgradeKey: string;
  studentId: number;
  studentNumber: number | string;
  studentName: string;
  studentOriginalHalaqaId: number;
  studentOriginalHalaqaName: string;
  halaqaId: number;
  halaqaName: string;
  teacherId: number;
  evaluatorName: string;
  weekNumber: number;
  evaluationId: number;
  evaluationDate: string;
  updatedAt: number;
  previousRank: number;
  newRank: number;
  levelsJumped: number;
  previousLevel: string;
  newLevel: string;
  currentStudentLevel: string;
  previousPagesCount: number;
  totalMemorizedPagesAtUpgrade: number;
  totalMemorizedPagesCurrent: number;
  oldPagesCount: number;
  oldMemorizedPagesStr: string;
  newMemorizedPagesAtUpgradeStr: string;
  evalMemorizedPages: string;
  pagesInEval: number | string;
  surahs: string[];
  ayahRangeDisplay: string;
  performance: PerformanceLevel | string;
  schoolStage: string;
  parentPhone: string;
  isAlAmeen: boolean;
  isAlAmeenStr: string;
  isFromIbri: boolean;
  isFromIbriStr: string;
  notes: string;
}

export interface TeacherEvalNoteItem {
  noteKey: string;
  sourceType: 'quran' | 'mutoon' | 'test' | 'sard';
  recordId: number;
  studentId: number;
  studentNumber: number | string;
  studentName: string;
  teacherId: number;
  teacherName: string;
  halaqaName: string;
  weekNumber: number;
  date: string;
  updatedAt: number;
  content: string;
}

export function parseOldMemorizedPagesSet(oldMemorizedPages?: string): Set<number> {
  const oldSet = new Set<number>();
  if (!oldMemorizedPages) return oldSet;
  const cleaned = toEnglishDigits(oldMemorizedPages.replace(/[\u200E\u200F\u202A-\u202E]/g, ''));
  const parts = cleaned.split(/[,،]/);
  for (const part of parts) {
    const range = part.trim().split(/[-–—]/);
    if (range.length === 2) {
      const start = parseInt(range[0].trim(), 10);
      const end = parseInt(range[1].trim(), 10);
      if (!isNaN(start) && !isNaN(end)) {
        const s = Math.min(start, end);
        const e = Math.max(start, end);
        for (let i = s; i <= e; i++) oldSet.add(i);
      }
    } else if (range.length === 1) {
      const num = parseInt(range[0].trim(), 10);
      if (!isNaN(num)) oldSet.add(num);
    }
  }
  return oldSet;
}

export function formatPagesSet(s: Set<number>): string {
  const arr = Array.from(s).sort((a, b) => a - b);
  if (arr.length === 0) return '—';
  const ranges: string[] = [];
  let start = arr[0];
  let end = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === end + 1) {
      end = arr[i];
    } else {
      ranges.push(start === end ? toArabicDigits(start) : formatRtlRange(`${start} - ${end}`));
      start = arr[i];
      end = arr[i];
    }
  }
  ranges.push(start === end ? toArabicDigits(start) : formatRtlRange(`${start} - ${end}`));
  return ranges.join('، ') || '—';
}

const getAyahRangeDisplay = (from?: string | number, to?: string | number) =>
  from && to
    ? from === to
      ? toArabicDigits(from)
      : formatRtlRange(`${from} - ${to}`)
    : from
      ? toArabicDigits(from)
      : '—';

export function getStudentLevelUpgrades(
  students: Student[],
  evaluations: Evaluation[],
  halaqas: Halaqa[],
  users: User[]
): LevelUpgradeRecord[] {
  if (!Array.isArray(students) || !Array.isArray(evaluations)) return [];

  const halaqaMap = new Map<number, Halaqa>();
  (halaqas || []).forEach(h => halaqaMap.set(Number(h.id), h));

  const userMap = new Map<number, User>();
  (users || []).forEach(u => userMap.set(Number(u.id), u));

  const evalsByStudent = new Map<number, Evaluation[]>();
  evaluations.forEach(e => {
    if (!e || e.isTest || e.subject === 'mutoon') return;
    if (!Array.isArray(e.newMemorizedPages) || e.newMemorizedPages.length === 0) return;
    const sid = Number(e.studentId);
    if (!evalsByStudent.has(sid)) evalsByStudent.set(sid, []);
    evalsByStudent.get(sid)!.push(e);
  });

  const upgrades: LevelUpgradeRecord[] = [];

  students.forEach(student => {
    const sid = Number(student.id);
    const studentEvals = evalsByStudent.get(sid);
    if (!studentEvals || studentEvals.length === 0) return;

    const sortedEvals = [...studentEvals].sort((a, b) => {
      const wA = Number(a.weekNumber) || 0;
      const wB = Number(b.weekNumber) || 0;
      if (wA !== wB) return wA - wB;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    const oldSet = parseOldMemorizedPagesSet(student.oldMemorizedPages);
    const oldCount = countQuranPages(oldSet);
    const oldStr = formatPagesSet(oldSet);

    const cumulativeSet = new Set<number>(oldSet);
    const newOnlySet = new Set<number>();

    let currentCount = oldCount;
    let currentRank = Math.floor(currentCount / 20) + 1;
    let currentLevelName = calculateStudentLevel(currentCount);

    // Precompute final total memorized pages & current level
    const finalTotalSet = new Set<number>(oldSet);
    sortedEvals.forEach(e => {
      (e.newMemorizedPages || []).forEach(p => finalTotalSet.add(p));
    });
    const finalTotalCount = countQuranPages(finalTotalSet);
    const currentStudentLevel = calculateStudentLevel(finalTotalCount);

    const studentOriginalHalaqa = halaqaMap.get(Number(student.halaqaId));

    for (const e of sortedEvals) {
      const evalPages = Array.isArray(e.newMemorizedPages) ? e.newMemorizedPages : [];
      let addedAny = false;
      for (const p of evalPages) {
        if (!cumulativeSet.has(p)) {
          cumulativeSet.add(p);
          addedAny = true;
        }
        if (!oldSet.has(p)) {
          newOnlySet.add(p);
        }
      }
      if (!addedAny) continue;

      const afterCount = countQuranPages(cumulativeSet);
      const afterRank = Math.floor(afterCount / 20) + 1;

      if (afterRank > currentRank) {
        const afterLevelName = calculateStudentLevel(afterCount);
        const weekNum = Number(e.weekNumber) || 1;
        const evalHalaqa = halaqaMap.get(Number(e.halaqaId));
        const evaluator = userMap.get(Number(e.teacherId));
        const evaluatorOwnedHalaqa = (halaqas || []).find(h => Number(h.teacherId) === Number(e.teacherId));
        const displayHalaqaName = evalHalaqa?.name || evaluatorOwnedHalaqa?.name || studentOriginalHalaqa?.name || 'معلم متنقل';

        const upgradeKey = `upgrade_${sid}_w${weekNum}_lvl${afterRank}`;
        upgrades.push({
          id: upgradeKey,
          upgradeKey,
          studentId: sid,
          studentNumber: student.studentNumber ?? '—',
          studentName: student.name || 'غير معروف',
          studentOriginalHalaqaId: studentOriginalHalaqa ? Number(studentOriginalHalaqa.id) : -1,
          studentOriginalHalaqaName: studentOriginalHalaqa?.name || '—',
          halaqaId: Number(e.halaqaId || student.halaqaId || 0),
          halaqaName: displayHalaqaName,
          teacherId: Number(e.teacherId || 0),
          evaluatorName: evaluator?.name || '—',
          weekNumber: weekNum,
          evaluationId: Number(e.id),
          evaluationDate: e.evaluationDate || '—',
          updatedAt: Number(e.updatedAt) || 0,
          previousRank: currentRank,
          newRank: afterRank,
          levelsJumped: afterRank - currentRank,
          previousLevel: currentLevelName,
          newLevel: afterLevelName,
          currentStudentLevel,
          previousPagesCount: currentCount,
          totalMemorizedPagesAtUpgrade: afterCount,
          totalMemorizedPagesCurrent: finalTotalCount,
          oldPagesCount: oldCount,
          oldMemorizedPagesStr: oldStr,
          newMemorizedPagesAtUpgradeStr: formatPagesSet(newOnlySet),
          evalMemorizedPages: evalPages.length > 0 ? evalPages.map(toArabicDigits).join('، ') : '—',
          pagesInEval: e.pages ?? evalPages.length,
          surahs: Array.isArray(e.surahs) ? e.surahs : [],
          ayahRangeDisplay: getAyahRangeDisplay(e.fromAyah, e.toAyah),
          performance: e.performance || '—',
          schoolStage: student.schoolStage || '—',
          parentPhone: student.parentPhone || '—',
          isAlAmeen: !!student.isAlAmeen,
          isAlAmeenStr: student.isAlAmeen ? 'نعم' : 'لا',
          isFromIbri: student.isFromIbri !== false,
          isFromIbriStr: student.isFromIbri !== false ? 'نعم' : 'لا',
          notes: e.notes || '—',
        });

        currentRank = afterRank;
        currentLevelName = afterLevelName;
      }

      currentCount = afterCount;
    }
  });

  return upgrades;
}

const isSystemAutoNote = (note?: string | null): boolean => {
  if (!note) return true;
  const trimmed = String(note).trim();
  if (!trimmed || trimmed === '—' || trimmed === '-') return true;
  if (trimmed.includes('مسجل غائب')) return true;
  if (/^غائب\s*\(.*\)$/.test(trimmed)) return true;
  return false;
};

const hashNoteText = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
};

export function getTeacherEvaluationNotes(
  students: Student[],
  evaluations: Evaluation[],
  sardEvaluations: SardEvaluation[],
  halaqas: Halaqa[],
  sardHalaqas: SardHalaqa[],
  users: User[]
): TeacherEvalNoteItem[] {
  const studentMap = new Map<number, Student>();
  (students || []).forEach(s => studentMap.set(Number(s.id), s));

  const halaqaMap = new Map<number, Halaqa>();
  (halaqas || []).forEach(h => halaqaMap.set(Number(h.id), h));

  const sardHalaqaMap = new Map<number, SardHalaqa>();
  (sardHalaqas || []).forEach(h => sardHalaqaMap.set(Number(h.id), h));

  const userMap = new Map<number, User>();
  (users || []).forEach(u => userMap.set(Number(u.id), u));

  const notes: TeacherEvalNoteItem[] = [];

  (evaluations || []).forEach(e => {
    if (!e || isSystemAutoNote(e.notes)) return;
    const content = String(e.notes).trim();
    const student = studentMap.get(Number(e.studentId));
    const halaqa = halaqaMap.get(Number(e.halaqaId || student?.halaqaId));
    const teacher = userMap.get(Number(e.teacherId || halaqa?.teacherId));
    const sourceType: 'quran' | 'mutoon' | 'test' = e.isTest
      ? 'test'
      : e.subject === 'mutoon'
        ? 'mutoon'
        : 'quran';
    notes.push({
      noteKey: `evalNote_${sourceType}_${e.id}_${hashNoteText(content)}`,
      sourceType,
      recordId: Number(e.id),
      studentId: Number(e.studentId),
      studentNumber: student?.studentNumber ?? '—',
      studentName: student?.name || 'غير معروف',
      teacherId: Number(e.teacherId || 0),
      teacherName: teacher?.name || 'معلم',
      halaqaName: halaqa?.name || '—',
      weekNumber: Number(e.weekNumber) || 1,
      date: e.evaluationDate || '—',
      updatedAt: Number(e.updatedAt) || Number(e.id) || 0,
      content,
    });
  });

  (sardEvaluations || []).forEach(se => {
    if (!se || isSystemAutoNote(se.notes)) return;
    const content = String(se.notes).trim();
    const student = studentMap.get(Number(se.studentId));
    const sHalaqa = sardHalaqaMap.get(Number(se.sardHalaqaId || student?.sardHalaqaId));
    const teacher = userMap.get(Number(se.teacherId || sHalaqa?.teacherId));
    notes.push({
      noteKey: `evalNote_sard_${se.id}_${hashNoteText(content)}`,
      sourceType: 'sard',
      recordId: Number(se.id),
      studentId: Number(se.studentId),
      studentNumber: student?.studentNumber ?? '—',
      studentName: student?.name || 'غير معروف',
      teacherId: Number(se.teacherId || 0),
      teacherName: teacher?.name || 'معلم السرد',
      halaqaName: sHalaqa?.name || '—',
      weekNumber: Number(se.weekNumber) || 1,
      date: se.date || '—',
      updatedAt: Number(se.updatedAt) || Number(se.id) || 0,
      content,
    });
  });

  notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return notes;
}
