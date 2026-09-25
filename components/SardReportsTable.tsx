import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { SardEvaluation, AttendanceStatus, AbsenceReason, UserRole } from '../types';
import { renderCell, translationMap, exportToWord, toArabicDigits, formatRtlRange } from '../utils/exportWord';
import { exportToExcel } from '../utils/exportExcel';
import { exportToPdf, getDualDate, sharePdfDirectly } from '../utils/exportPdf';
import { FilterItem } from './FilterItem';
import { WordExportModal } from './WordExportModal';
import { ExcelExportModal } from './ExcelExportModal';
import Modal from './Modal';
import { SardEvaluationEditModal } from './SardEvaluationEditModal';
import { surahNames } from '../utils/quranData';

const NOT_RECORDED = 'not_recorded';
const LOCAL_STORAGE_SARD_REPORT_COLUMNS_KEY = 'sardReportSelectedColumns';
const LOCAL_STORAGE_SARD_COLOR_MAP_KEY = 'sardReportColorMap';
const LOCAL_STORAGE_SARD_SAVE_COLORS_KEY = 'sardReportSaveColors';

const isValueEffectivelyEmpty = (value: any, type?: string): boolean => {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  const stringValue = String(value).trim();
  if (stringValue === '' || stringValue === '—' || stringValue === '-') return true; 
  if (stringValue === 'غير معروف' || stringValue === 'غير معين') return true;
  if (type === 'translation') {
    const translated = translationMap[value as keyof typeof translationMap];
    if (!translated || translated === '—' || translated === 'غير معروف' || translated === 'غير معين') return true;
  }
  return false;
};

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return hex;
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const SardReportsTable: React.FC = () => {
  const context = useContext(AppContext);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(['ALL']);
  const [hasSetDefaultWeek, setHasSetDefaultWeek] = useState(false);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedHalaqaIds, setSelectedHalaqaIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedAttendance, setSelectedAttendance] = useState<string[]>([AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.ABSENT]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedAlAmeen, setSelectedAlAmeen] = useState<string[]>([]);
  const [selectedFromIbri, setSelectedFromIbri] = useState<string[]>(['نعم']);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>({ key: 'halaqaName', direction: 'ascending' });
  const [topStudentsCount, setTopStudentsCount] = useState<string>('');
  const [topStudentsSortDesc, setTopStudentsSortDesc] = useState<boolean>(false);
  const [strictMode, setStrictMode] = useState(false);

  // Color Mapping
  const [saveColors, setSaveColors] = useState(() => {
    return localStorage.getItem(LOCAL_STORAGE_SARD_SAVE_COLORS_KEY) === 'true';
  });

  const [colorMap, setColorMap] = useState<Record<string, string>>(() => {
    try {
      if (localStorage.getItem(LOCAL_STORAGE_SARD_SAVE_COLORS_KEY) === 'true') {
        const saved = localStorage.getItem(LOCAL_STORAGE_SARD_COLOR_MAP_KEY);
        return saved ? (JSON.parse(saved) || {}) : {};
      }
    } catch (e) {
      console.error("Error parsing colorMap from localStorage:", e);
    }
    return {};
  });

  const [studentSearch, setStudentSearch] = useState('');
  const [halaqaSearch, setHalaqaSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [gradeSearch, setGradeSearch] = useState('');
  const [alAmeenSearch, setAlAmeenSearch] = useState('');
  const [fromIbriSearch, setFromIbriSearch] = useState('');
  const [weekSearch, setWeekSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [editingEvaluation, setEditingEvaluation] = useState<SardEvaluation | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [isDefaultSaved, setIsDefaultSaved] = useState(false);
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  
  const [isQuickEditActive, setIsQuickEditActive] = useState(false);
  const [draftEdits, setDraftEdits] = useState<Record<number, Partial<SardEvaluation>>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const sardEvaluations = context?.sardEvaluations || [];
  const students = context?.students || [];
  const sardHalaqas = context?.sardHalaqas || [];
  const halaqas = context?.halaqas || [];
  const users = context?.users || [];
  const updateSardEvaluation = context?.updateSardEvaluation;
  const addSardEvaluation = context?.addSardEvaluation;
  const deleteSardEvaluation = context?.deleteSardEvaluation;
  const showToast = context?.showToast;
  const hijriAdjustments = context?.hijriAdjustments;
  const currentUser = context?.currentUser;

  const targetStudents = useMemo(() => {
    return students;
  }, [students]);

  const targetHalaqas = useMemo(() => {
    return sardHalaqas;
  }, [sardHalaqas]);

  const maxWeekFound = useMemo(() => {
    if (sardEvaluations.length === 0) return 'all';
    const weeks = sardEvaluations.map(e => e.weekNumber).filter((w): w is number => typeof w === 'number' && !isNaN(w));
    if (weeks.length === 0) return 'all';
    return Math.max(...weeks).toString();
  }, [sardEvaluations]);

  useEffect(() => {
    if (!hasSetDefaultWeek && maxWeekFound !== 'all' && sardEvaluations.length > 0) {
      setSelectedWeeks([maxWeekFound]);
      setHasSetDefaultWeek(true);
    }
  }, [maxWeekFound, hasSetDefaultWeek, sardEvaluations.length]);

  const allHeaders = useMemo(() => [
    { key: 'sequence', label: '#' },
    { key: 'studentName', label: 'الطالب' },
    { key: 'studentOriginalHalaqaName', label: 'حلقة السرد' },
    { key: 'evaluatorName', label: 'معلم السرد' },
    { key: 'weekNumber', label: 'الأسبوع' },
    { key: 'evaluationDate', label: 'التاريخ' },
    { key: 'attendance', label: 'الحضور', type: 'translation' },
    { key: 'absenceReason', label: 'سبب الغياب', type: 'translation' },
    { key: 'sardContent', label: 'المحتوى المسرد' },
    { key: 'pagesCount', label: 'عدد الصفحات' },
    { key: 'fathErrors', label: 'الفتح (1)' },
    { key: 'hesitationErrors', label: 'التشكيل (1)' },
    { key: 'tajweedErrors', label: 'التجويد (0.5)' },
    { key: 'totalErrors', label: 'مجموع الأخطاء' },
    { key: 'grade', label: 'التقدير' },
    { key: 'isAlAmeenStr', label: 'من الأمين؟' },
    { key: 'isFromIbriStr', label: 'من جامع عبري؟' },
    { key: 'notes', label: 'ملاحظات' },
  ], []);

  const defaultExcludedKeys = useMemo(() => [
    'evaluatorName', 
    'evaluationDate', 
    'absenceReason',
    'isAlAmeenStr',
    'isFromIbriStr'
  ], []);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_SARD_REPORT_COLUMNS_KEY);
    const defaultKeys = allHeaders.map(h => h.key).filter(k => !defaultExcludedKeys.includes(k));
    const baseOrder = allHeaders.map(h => h.key);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedColumnKeys(parsed);
          const customMiddle = parsed.filter(k => k !== 'sequence' && k !== 'notes');
          const remaining = baseOrder.filter(k => !customMiddle.includes(k) && k !== 'sequence' && k !== 'notes');
          setColumnOrder(['sequence', ...customMiddle, ...remaining, 'notes']);
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.selected)) setSelectedColumnKeys(parsed.selected);
          if (Array.isArray(parsed.order)) {
            const middle = parsed.order.filter((k: string) => k !== 'sequence' && k !== 'notes');
            const missing = baseOrder.filter(k => !middle.includes(k) && k !== 'sequence' && k !== 'notes');
            setColumnOrder(['sequence', ...middle, ...missing, 'notes']);
          } else {
            setColumnOrder(baseOrder);
          }
        } else {
          setSelectedColumnKeys(defaultKeys);
          setColumnOrder(baseOrder);
        }
      } catch (e) { 
        setSelectedColumnKeys(defaultKeys); 
        setColumnOrder(baseOrder);
      }
    } else { 
      setSelectedColumnKeys(defaultKeys); 
      setColumnOrder(baseOrder);
    }
  }, [allHeaders, defaultExcludedKeys]);

  const moveColumn = (key: string, direction: 'up' | 'down') => {
    if (key === 'sequence' || key === 'notes') return;
    setColumnOrder(prev => {
      const baseOrder = allHeaders.map(h => h.key);
      const currentFull = prev.length > 0 ? prev : baseOrder;
      const middle = currentFull.filter(k => k !== 'sequence' && k !== 'notes');
      const idx = middle.indexOf(key);
      if (idx === -1) return currentFull;
      
      if (direction === 'up' && idx > 0) {
        const updated = [...middle];
        [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
        return ['sequence', ...updated, 'notes'];
      }
      if (direction === 'down' && idx < middle.length - 1) {
        const updated = [...middle];
        [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
        return ['sequence', ...updated, 'notes'];
      }
      return currentFull;
    });
  };

  const handleSaveAsDefault = () => {
    localStorage.setItem(LOCAL_STORAGE_SARD_REPORT_COLUMNS_KEY, JSON.stringify({
      selected: selectedColumnKeys,
      order: columnOrder.length > 0 ? columnOrder : allHeaders.map(h => h.key)
    }));
    setIsDefaultSaved(true);
    setTimeout(() => setIsDefaultSaved(false), 2500);
  };

  const handleResetToDefault = () => {
    const defaultKeys = allHeaders.map(h => h.key).filter(k => !defaultExcludedKeys.includes(k));
    const baseOrder = allHeaders.map(h => h.key);
    setSelectedColumnKeys(defaultKeys);
    setColumnOrder(baseOrder);
  };

  const processedSardData = useMemo(() => {
    return sardEvaluations.map(e => {
      const student = students.find(s => Number(s.id) === Number(e.studentId));
      const studentSardHalaqa = sardHalaqas.find(h => Number(h.id) === Number(e.sardHalaqaId || student?.sardHalaqaId));
      const evaluator = users.find(u => Number(u.id) === Number(e.teacherId || studentSardHalaqa?.teacherId));

      let sardContent = '—';
      if (e.juzList && e.juzList.length > 0) {
        sardContent = `الأجزاء (${e.juzList.slice().sort((a: number, b: number) => Number(a) - Number(b)).map(toArabicDigits).join('، ')})`;
      } else if (e.surahs && e.surahs.length > 0) {
        sardContent = e.surahs.join('، ');
      } else if (e.pageRanges && e.pageRanges.length > 0) {
        sardContent = e.pageRanges.map(r => `ص ${formatRtlRange(`${r.fromPage} - ${r.toPage}`)}`).join(' | ');
      }

      return {
        ...e,
        studentName: student?.name || 'غير معروف',
        isAlAmeen: student?.isAlAmeen,
        isAlAmeenStr: student?.isAlAmeen ? 'نعم' : 'لا',
        isFromIbri: student?.isFromIbri !== false,
        isFromIbriStr: (student?.isFromIbri !== false) ? 'نعم' : 'لا',
        studentOriginalHalaqaName: studentSardHalaqa?.name || 'غير محدد',
        studentOriginalHalaqaId: studentSardHalaqa?.id ? Number(studentSardHalaqa.id) : -1,
        halaqaName: studentSardHalaqa?.name || 'غير محدد',
        evaluatorName: evaluator?.name || '—',
        evaluatorOwnedHalaqaId: studentSardHalaqa?.id,
        weekNumber: e.weekNumber || 1,
        attendance: e.attendance || AttendanceStatus.PRESENT,
        absenceReason: e.absenceReason,
        sardContent,
        pagesCount: e.pagesCount || 0,
        fathErrors: e.fathErrors || 0,
        hesitationErrors: e.hesitationErrors || 0,
        tajweedErrors: e.tajweedErrors || 0,
        totalErrors: e.totalErrors || 0,
        grade: e.grade || '—',
        evaluationDate: e.date || '—',
        notes: e.notes || '—',
        student,
        sardHalaqa: studentSardHalaqa,
      };
    });
  }, [sardEvaluations, students, sardHalaqas, users]);

  const allWeeks = useMemo(() => {
    const validWeeks: number[] = Array.from(
      new Set(
        sardEvaluations
          .map(e => e.weekNumber)
          .filter((w): w is number => typeof w === 'number' && !isNaN(w))
      )
    );
    return ['all', ...validWeeks.sort((a, b) => a - b).map(String)];
  }, [sardEvaluations]);

  const attendanceOptions = [
    { id: AttendanceStatus.PRESENT, name: translationMap[AttendanceStatus.PRESENT] },
    { id: AttendanceStatus.LATE, name: translationMap[AttendanceStatus.LATE] },
    { id: AttendanceStatus.ABSENT, name: translationMap[AttendanceStatus.ABSENT] },
    { id: NOT_RECORDED, name: translationMap[NOT_RECORDED] }
  ];

  const gradeOptions = [
    { id: 'ممتاز مع الشرف', name: 'ممتاز مع الشرف' },
    { id: 'ممتاز', name: 'ممتاز' },
    { id: 'جيد جداً', name: 'جيد جداً' },
    { id: 'جيد', name: 'جيد' },
    { id: 'مقبول', name: 'مقبول' },
    { id: 'ضعيف', name: 'ضعيف' },
    { id: 'غائب', name: 'غائب' },
  ];

  const alAmeenOptions = [
    { id: 'نعم', name: 'نعم' },
    { id: 'لا', name: 'لا' }
  ];

  const ibriOptions = [
    { id: 'نعم', name: 'نعم' },
    { id: 'لا', name: 'لا' }
  ];

  const sortedAndFilteredData = useMemo(() => {
    let items: any[] = [];
    const isAllWeeks = selectedWeeks.includes('ALL') || selectedWeeks.length === 0;

    if (isAllWeeks) {
      items = [...processedSardData];
    } else {
      items = [];
      selectedWeeks.forEach(weekStr => {
        const weekNum = parseInt(weekStr);
        const weekItems = targetStudents.map(s => {
          const ev = processedSardData.find(e => Number(e.studentId) === Number(s.id) && e.weekNumber === weekNum);
          if (ev) return ev;
          const studentSardHalaqa = sardHalaqas.find(h => Number(h.id) === Number(s.sardHalaqaId));
          const studentTeacher = users.find(u => Number(u.id) === Number(studentSardHalaqa?.teacherId));
          return { 
            id: `p-${s.id}-${weekNum}`, 
            studentId: s.id, 
            studentName: s.name, 
            isAlAmeen: s.isAlAmeen,
            isAlAmeenStr: s.isAlAmeen ? 'نعم' : 'لا',
            isFromIbri: s.isFromIbri !== false,
            isFromIbriStr: (s.isFromIbri !== false) ? 'نعم' : 'لا',
            sardHalaqaId: s.sardHalaqaId, 
            teacherId: studentSardHalaqa?.teacherId, 
            studentOriginalHalaqaId: s.sardHalaqaId ? Number(s.sardHalaqaId) : -1,
            studentOriginalHalaqaName: studentSardHalaqa?.name || '-',
            halaqaName: studentSardHalaqa?.name || '-', 
            evaluatorName: studentTeacher?.name || '—',
            weekNumber: weekNum, 
            attendance: NOT_RECORDED, 
            sardContent: '—',
            pagesCount: 0,
            fathErrors: 0,
            hesitationErrors: 0,
            tajweedErrors: 0,
            totalErrors: 0,
            grade: '—',
            evaluationDate: '—',
            notes: '—',
            student: s,
            sardHalaqa: studentSardHalaqa,
          };
        });
        items.push(...weekItems);
      });
    }

    if (selectedStudentIds.length > 0 && !selectedStudentIds.includes('ALL')) items = items.filter(i => selectedStudentIds.includes(String(i.studentId)));
    if (selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes('ALL')) items = items.filter(i => selectedHalaqaIds.includes(String(i.studentOriginalHalaqaId)));
    if (selectedTeacherIds.length > 0 && !selectedTeacherIds.includes('ALL')) items = items.filter(i => selectedTeacherIds.includes(String(i.teacherId)));
    if (selectedAlAmeen.length > 0 && !selectedAlAmeen.includes('ALL')) {
      items = items.filter(i => {
        const val = i.isAlAmeen ? 'نعم' : 'لا';
        return selectedAlAmeen.includes(val);
      });
    }
    if (selectedFromIbri.length > 0 && !selectedFromIbri.includes('ALL')) {
      items = items.filter(i => {
        const val = i.isFromIbri !== false ? 'نعم' : 'لا';
        return selectedFromIbri.includes(val);
      });
    }

    const hasAttendanceFilter = selectedAttendance.length > 0 && !selectedAttendance.includes('ALL');
    const hasGradeFilter = selectedGrades.length > 0 && !selectedGrades.includes('ALL');

    if (strictMode && (hasAttendanceFilter || hasGradeFilter)) {
      const studentGroups: Record<string, any[]> = {};
      items.forEach(item => {
        const sid = String(item.studentId);
        if (!studentGroups[sid]) studentGroups[sid] = [];
        studentGroups[sid].push(item);
      });

      let keptItems: any[] = [];
      Object.values(studentGroups).forEach(group => {
        const meetsCriteria = group.every(item => {
          let pass = true;
          if (hasAttendanceFilter) {
            if (!selectedAttendance.includes(item.attendance)) pass = false;
          }
          if (hasGradeFilter) {
            if (!item.grade || !selectedGrades.includes(item.grade)) pass = false;
          }
          return pass;
        });

        if (meetsCriteria) {
          keptItems.push(...group);
        }
      });
      items = keptItems;
    } else {
      if (hasAttendanceFilter) items = items.filter(i => selectedAttendance.includes(i.attendance));
      if (hasGradeFilter) items = items.filter(i => i.grade && selectedGrades.includes(i.grade));
    }
    
    if (topStudentsSortDesc) {
      const studentGroups: Record<string, any[]> = {};
      const studentTotalPages: Record<string, number> = {};
      
      items.forEach(item => {
        const sid = String(item.studentId);
        if (!studentGroups[sid]) {
          studentGroups[sid] = [];
          studentTotalPages[sid] = 0;
        }
        studentGroups[sid].push(item);
        
        if (item.pagesCount) {
          const num = parseFloat(String(item.pagesCount).trim());
          if (!isNaN(num)) {
            studentTotalPages[sid] += num;
          }
        }
      });
      
      let sortedStudentIds = Object.keys(studentGroups).sort((a, b) => studentTotalPages[b] - studentTotalPages[a]);
      
      const limit = parseInt(topStudentsCount);
      if (!isNaN(limit) && limit > 0) {
        sortedStudentIds = sortedStudentIds.slice(0, limit);
      }
      
      let newItems: any[] = [];
      sortedStudentIds.forEach(sid => {
        const group = studentGroups[sid];
        const total = Number(studentTotalPages[sid].toFixed(2));
        
        const studentWeeks = group
          .filter(g => !String(g.id).startsWith('p-') || g.attendance !== NOT_RECORDED)
          .map(g => g.weekNumber);
        const uniqueWeeks = Array.from(new Set(studentWeeks)).sort((a, b) => a - b);
        const weeksText = uniqueWeeks.length > 0 ? uniqueWeeks.map(w => `أسبوع ${w}`).join('، ') : '—';
        
        newItems.push({
          id: `top-${sid}`,
          studentId: sid,
          studentName: group[0]?.studentName || 'غير معروف',
          isAlAmeen: group[0]?.isAlAmeen,
          selectedWeeksDisplay: weeksText,
          totalPagesInSelectedWeeks: total,
          attendance: group[0]?.attendance || NOT_RECORDED,
        });
      });
      
      items = newItems;
    } else if (sortConfig) {
      items.sort((a, b) => {
        if (sortConfig.key === 'halaqaName' || sortConfig.key === 'studentName') {
          const isHalaqaVisible = selectedColumnKeys.includes('studentOriginalHalaqaName') || selectedColumnKeys.includes('halaqaName');
          if (isHalaqaVisible) {
            const hA = a.halaqaName || '';
            const hB = b.halaqaName || '';
            const halaqaComp = hA.localeCompare(hB, 'ar', { numeric: true });
            if (halaqaComp !== 0) {
              const direction = sortConfig.key === 'halaqaName' ? sortConfig.direction : 'ascending';
              return direction === 'ascending' ? halaqaComp : -halaqaComp;
            }
          }
          const sA = a.studentName || '';
          const sB = b.studentName || '';
          const studentComp = sA.localeCompare(sB, 'ar', { numeric: true });
          const direction = sortConfig.key === 'studentName' ? sortConfig.direction : 'ascending';
          return direction === 'ascending' ? studentComp : -studentComp;
        }

        const vA = a[sortConfig.key];
        const vB = b[sortConfig.key];
        
        if (typeof vA === 'string' && typeof vB === 'string') {
          const comparison = vA.localeCompare(vB, undefined, { numeric: true, sensitivity: 'base' });
          return sortConfig.direction === 'ascending' ? comparison : -comparison;
        }

        if (vA < vB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (vA > vB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    
    return items.map((item, index) => ({ ...item, sequence: index + 1 }));
  }, [processedSardData, targetStudents, sardHalaqas, users, selectedWeeks, selectedStudentIds, selectedHalaqaIds, selectedTeacherIds, selectedAlAmeen, selectedFromIbri, selectedAttendance, selectedGrades, sortConfig, strictMode, selectedColumnKeys, topStudentsSortDesc, topStudentsCount]);

  const exportHeaderInfo = useMemo(() => {
    const isAllWeeks = selectedWeeks.includes('ALL') || selectedWeeks.length === 0;
    
    let title = "";
    let fileName = "";
    
    if (isAllWeeks) {
      title = "تقرير تقييمات السرد (جميع الأسابيع)";
      fileName = "تقرير_السرد_الشامل";
    } else if (selectedWeeks.length === 1) {
      title = `تقرير السرد للأسبوع (${selectedWeeks[0]})`;
      fileName = `تقرير_السرد_أسبوع_${selectedWeeks[0]}`;
    } else if (selectedWeeks.length === 2) {
      title = `تقرير السرد للأسبوعين (${selectedWeeks[0]}، ${selectedWeeks[1]})`;
      fileName = `تقرير_السرد_أسبوع_${selectedWeeks[0]}_${selectedWeeks[1]}`;
    } else {
      title = `تقرير السرد للأسابيع (${selectedWeeks.join('، ')})`;
      fileName = `تقرير_السرد_الأسابيع_${selectedWeeks.join('_')}`;
    }

    const filters = [];
    if (selectedStudentIds.length > 0 && !selectedStudentIds.includes('ALL')) filters.push(`الطلاب: ${selectedStudentIds.length} مختار`);
    if (selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes('ALL')) filters.push(`حلقات السرد: ${selectedHalaqaIds.length} مختار`);
    if (selectedTeacherIds.length > 0 && !selectedTeacherIds.includes('ALL')) filters.push(`المعلمين: ${selectedTeacherIds.length} مختار`);
    if (selectedAlAmeen.length > 0 && !selectedAlAmeen.includes('ALL')) filters.push(`من الأمين: ${selectedAlAmeen.join('، ')}`);
    if (selectedFromIbri.length > 0 && !selectedFromIbri.includes('ALL')) filters.push(`من جامع عبري: ${selectedFromIbri.join('، ')}`);
    
    const traditionalStatuses = [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.ABSENT];
    const isFilteredByAllTraditional = traditionalStatuses.every(s => selectedAttendance.includes(s)) && selectedAttendance.length >= 3;
    
    if (selectedAttendance.length > 0 && !selectedAttendance.includes('ALL') && !isFilteredByAllTraditional) {
      filters.push(`الحضور: ${selectedAttendance.map(a => translationMap[a as keyof typeof translationMap] || a).join(', ')}`);
    }

    if (selectedGrades.length > 0 && !selectedGrades.includes('ALL')) filters.push(`التقدير: ${selectedGrades.join(', ')}`);
    
    return { title, subtitle: filters.length > 0 ? filters.join(' | ') : undefined, fileName };
  }, [selectedWeeks, selectedStudentIds, selectedHalaqaIds, selectedTeacherIds, selectedAlAmeen, selectedFromIbri, selectedAttendance, selectedGrades]);

  const dynamicHeaders = useMemo(() => {
    if (topStudentsSortDesc) {
      return [
        { key: 'sequence', label: '#', type: 'text' },
        { key: 'studentName', label: 'اسم الطالب', type: 'text' },
        { key: 'totalPagesInSelectedWeeks', label: 'إجمالي الصفحات المسردة', type: 'text' }
      ];
    }
    const headersMap = new Map(allHeaders.map(h => [h.key, h]));
    const currentOrder = columnOrder.length > 0 ? columnOrder : allHeaders.map(h => h.key);
    
    const orderedSelected = currentOrder.filter(k => selectedColumnKeys.includes(k) && headersMap.has(k));
    
    const hasSeq = orderedSelected.includes('sequence');
    const hasNotes = orderedSelected.includes('notes');
    const middle = orderedSelected.filter(k => k !== 'sequence' && k !== 'notes');
    
    const finalKeys: string[] = [];
    if (hasSeq) finalKeys.push('sequence');
    finalKeys.push(...middle);
    if (hasNotes) finalKeys.push('notes');

    let headers: typeof allHeaders = finalKeys.map(k => headersMap.get(k)!).filter(Boolean) as typeof allHeaders;
    if (sortedAndFilteredData.length > 0) {
      headers = headers.filter((h: any) => sortedAndFilteredData.some(i => !isValueEffectivelyEmpty(i[h.key], h.type)));
    }
    return headers;
  }, [allHeaders, columnOrder, selectedColumnKeys, sortedAndFilteredData, topStudentsSortDesc]);

  const handleDelete = (id: any) => {
    if (typeof id === 'string' && id.startsWith('p-')) return; 
    setItemToDelete(id);
  };

  const handleEdit = (item: any) => {
    if (typeof item.id === 'string' && item.id.startsWith('p-')) {
      return;
    }
    setEditingEvaluation(item);
  };

  const handleDraftUpdate = (id: string | number, key: keyof SardEvaluation, value: any) => {
    let finalValue = (key === 'sardHalaqaId' || key === 'teacherId') ? Number(value) : value;
    
    if (key === 'weekNumber') {
      if (value === '' || value === null || value === undefined) {
        finalValue = '';
      } else {
        const str = String(value).trim().replace(/[٠-٩]/g, d => (d.charCodeAt(0) - 1632).toString());
        const parsed = parseInt(str, 10);
        finalValue = isNaN(parsed) ? '' : parsed;
      }
    }
    
    setDraftEdits(prev => {
      const newDraft = { ...(prev[id as any] || {}), [key]: finalValue };
      
      if (key === 'sardHalaqaId') {
        const targetHalaqa = sardHalaqas.find(h => Number(h.id) === Number(finalValue));
        if (targetHalaqa) {
          newDraft.teacherId = Number(targetHalaqa.teacherId);
        }
      }
      
      return { ...prev, [id as any]: newDraft };
    });
  };

  const handleFinishQuickEdit = () => {
    const editKeys = Object.keys(draftEdits);
    if (editKeys.length > 0) {
      let savedCount = 0;
      editKeys.forEach(idKey => {
        const original = sardEvaluations.find(e => String(e.id) === String(idKey));
        const draft = draftEdits[idKey as any];
        if (!original || !draft) return;

        const cleanDraft: Partial<SardEvaluation> = { ...draft };

        if (cleanDraft.weekNumber !== undefined) {
          const str = String(cleanDraft.weekNumber).trim().replace(/[٠-٩]/g, d => (d.charCodeAt(0) - 1632).toString());
          const targetWeek = parseInt(str, 10);
          if (isNaN(targetWeek) || targetWeek <= 0) {
            delete cleanDraft.weekNumber;
          } else {
            cleanDraft.weekNumber = targetWeek;
          }
        }

        updateSardEvaluation({ ...original, ...cleanDraft, updatedAt: Date.now() });
        savedCount++;
      });
      showToast(`✅ تم حفظ تعديلات ${savedCount} سجل بنجاح.`);
    }
    setDraftEdits({});
    setIsQuickEditActive(false);
  };

  const handleColorChange = (id: string, color: string | null) => {
    setColorMap(prev => {
      const next = { ...prev };
      if (color) next[id] = color;
      else delete next[id];
      
      if (saveColors) {
        localStorage.setItem(LOCAL_STORAGE_SARD_COLOR_MAP_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleToggleSaveColors = (checked: boolean) => {
    setSaveColors(checked);
    localStorage.setItem(LOCAL_STORAGE_SARD_SAVE_COLORS_KEY, String(checked));
    if (checked) {
      localStorage.setItem(LOCAL_STORAGE_SARD_COLOR_MAP_KEY, JSON.stringify(colorMap));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_SARD_COLOR_MAP_KEY);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xl dark:bg-gray-800 border border-gray-100 dark:border-gray-700" ref={containerRef}>
      {editingEvaluation && (() => {
        const student = students.find(s => s.id === editingEvaluation.studentId);
        if (!student) return null;
        const sardHalaqa = sardHalaqas.find(h => h.id === (editingEvaluation.sardHalaqaId || student.sardHalaqaId));
        return (
          <SardEvaluationEditModal 
            evaluation={editingEvaluation}
            student={student}
            sardHalaqa={sardHalaqa}
            onClose={() => setEditingEvaluation(null)}
            onSave={(updated) => { 
              updateSardEvaluation(updated);
              setEditingEvaluation(null); 
              showToast('✅ تم تحديث تقييم السرد بنجاح.'); 
            }}
            onDelete={(id) => { 
              deleteSardEvaluation(id); 
              setEditingEvaluation(null); 
              showToast('🗑️ تم حذف تقييم السرد بنجاح.'); 
            }}
          />
        );
      })()}

      {itemToDelete && (
        <Modal title="تأكيد حذف تقييم السرد" onClose={() => setItemToDelete(null)} hideDefaultCloseButton={true}>
          <div className="text-center py-4">
            <p className="text-lg font-bold mb-6 dark:text-white">هل أنت متأكد من حذف تقييم السرد هذا؟</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => { 
                  deleteSardEvaluation(itemToDelete); 
                  setItemToDelete(null); 
                  showToast('🗑️ تم حذف تقييم السرد بنجاح.'); 
                }} 
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg active:scale-95 text-xl"
              >
                نعم، حذف
              </button>
              <button 
                onClick={() => setItemToDelete(null)} 
                className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-2xl font-bold dark:bg-gray-700 dark:text-gray-200 text-xl"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between no-print mb-6 gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
            <span>📖</span>
            <span>تصفية تقارير السرد</span>
          </h3>
          
          {(selectedWeeks.length > 1 || selectedWeeks.includes('ALL')) && (
            <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border shadow-sm transition-all animate-fade-in ${strictMode ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`} title="عند التفعيل: يظهر فقط الطلاب الذين يطابقون الفلاتر المختارة في كل أسبوع من الأسابيع المحددة.">
              <div className="relative" dir="ltr">
                <input type="checkbox" checked={strictMode} onChange={e => setStrictMode(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 shadow-inner peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
              </div>
              <span className={`text-xs font-bold select-none ${strictMode ? 'text-amber-900 dark:text-amber-100' : 'text-gray-700 dark:text-gray-200'}`}>تصفية صارمة (تحقق شرط التقدير في جميع الأسابيع المختارة)</span>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border shadow-sm transition-all bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600">
              <div className="relative" dir="ltr">
                <input type="checkbox" checked={topStudentsSortDesc} onChange={e => setTopStudentsSortDesc(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 shadow-inner peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
              </div>
              <span className={`text-xs font-bold select-none ${topStudentsSortDesc ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-200'}`}>
                أكثر سرداً (صفحات)
              </span>
            </label>

            {topStudentsSortDesc && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">العدد:</span>
                <input type="number" min="1" value={topStudentsCount} onChange={e => setTopStudentsCount(e.target.value)} className="w-16 p-1 text-sm border border-gray-300 rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" placeholder="الكل" />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">إجمالي السجلات:</span>
          <span className="text-lg font-black text-emerald-900 dark:text-white">{sortedAndFilteredData.length}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-8 no-print">
        <FilterItem id="student" title="الطالب" selectedValues={selectedStudentIds} options={targetStudents.map(s => ({id: s.id, name: s.name}))} onSelect={setSelectedStudentIds} search={studentSearch} setSearch={setStudentSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
        <FilterItem id="halaqa" title="حلقة السرد" selectedValues={selectedHalaqaIds} options={[...targetHalaqas].sort((a,b) => a.name.localeCompare(b.name, 'ar', { numeric: true })).map(h => ({id: h.id, name: h.name}))} onSelect={setSelectedHalaqaIds} search={halaqaSearch} setSearch={setHalaqaSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
        <FilterItem id="teacher" title="معلم السرد" selectedValues={selectedTeacherIds} options={users.filter(u => u.role === UserRole.TEACHER).map(t => ({id: t.id, name: t.name}))} onSelect={setSelectedTeacherIds} search={teacherSearch} setSearch={setTeacherSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
        <FilterItem id="week" title="الأسبوع" selectedValues={selectedWeeks} options={allWeeks.filter(w => w !== 'all').map(w => ({id: w, name: `أسبوع ${w}`}))} onSelect={setSelectedWeeks} search={weekSearch} setSearch={setWeekSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
        <FilterItem id="alAmeen" title="من الأمين؟" selectedValues={selectedAlAmeen} options={alAmeenOptions} onSelect={setSelectedAlAmeen} search={alAmeenSearch} setSearch={setAlAmeenSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
        <FilterItem id="fromIbri" title="من جامع عبري؟" selectedValues={selectedFromIbri} options={ibriOptions} onSelect={setSelectedFromIbri} search={fromIbriSearch} setSearch={setFromIbriSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
        <FilterItem id="attendance" title="الحضور" selectedValues={selectedAttendance} options={attendanceOptions} onSelect={setSelectedAttendance} search={attendanceSearch} setSearch={setAttendanceSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
        <FilterItem id="grade" title="التقدير" selectedValues={selectedGrades} options={gradeOptions} onSelect={setSelectedGrades} search={gradeSearch} setSearch={setGradeSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6 no-print border-t border-gray-100 dark:border-gray-700 pt-5">
        <button onClick={() => setIsExcelModalOpen(true)} className="px-3 py-2 text-[10px] font-bold text-white bg-green-600 rounded-lg shadow-sm">Excel</button>
        <button onClick={() => setIsWordModalOpen(true)} className="px-3 py-2 text-[10px] font-bold text-white bg-blue-600 rounded-lg shadow-sm">Word</button>
        <div className="flex gap-1">
          <button onClick={() => exportToPdf(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, colorMap)} className="px-3 py-2 text-[10px] font-bold text-white bg-red-600 rounded-lg shadow-sm flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            طباعة
          </button>

          <button onClick={() => sharePdfDirectly(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, colorMap, undefined, "landscape")} className="px-3 py-2 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            مشاركة PDF
          </button>
        </div>
        
        {currentUser?.role === UserRole.SUPERVISOR && (
          <button 
            onClick={() => isQuickEditActive ? handleFinishQuickEdit() : setIsQuickEditActive(true)}
            className={`px-4 py-2 text-xs font-black rounded-xl shadow-lg transition-all flex items-center gap-2 ${isQuickEditActive ? 'bg-amber-600 text-white ring-4 ring-amber-300 animate-pulse' : 'bg-amber-100 text-amber-700 border-2 border-amber-200'}`}
          >
            {isQuickEditActive ? 'حفظ البيانات' : 'تعديل سريع'}
          </button>
        )}

        {!topStudentsSortDesc && (
          <div ref={columnPickerRef} className="relative inline-block text-right">
            <button 
              onClick={() => setShowColumnPicker(!showColumnPicker)} 
              className="px-3 py-2 text-[10px] font-bold text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-lg shadow-sm flex items-center gap-2"
            >
              الأعمدة
            </button>
            {showColumnPicker && (
              <>
                <div 
                  className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[65] sm:hidden" 
                  onClick={() => setShowColumnPicker(false)} 
                />
                <div className="fixed sm:absolute z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0 sm:top-full sm:left-auto sm:right-0 sm:mt-2 w-[92vw] max-w-sm sm:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-fade-in ring-1 ring-black/10 text-right">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b dark:border-gray-700">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-400">تخصيص وترتيب أعمدة السرد</span>
                    <button onClick={() => setShowColumnPicker(false)} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></button>
                  </div>
                  <div className="flex gap-2 mb-2 pb-2 border-b dark:border-gray-700">
                    <button onClick={() => setSelectedColumnKeys(allHeaders.map(h => h.key))} className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex-1 text-center bg-blue-50 dark:bg-blue-900/30 py-1.5 rounded-lg">إظهار الكل</button>
                    <button onClick={() => setSelectedColumnKeys([])} className="text-[11px] text-red-600 dark:text-red-400 font-bold hover:underline flex-1 text-center bg-red-50 dark:bg-red-900/30 py-1.5 rounded-lg">إخفاء الكل</button>
                  </div>
                  <div className="max-h-[50vh] sm:max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-1 divide-y divide-gray-100 dark:divide-gray-700/40">
                    {(columnOrder.length > 0 ? columnOrder : allHeaders.map(h => h.key)).map((key) => {
                      const h = allHeaders.find(item => item.key === key);
                      if (!h) return null;
                      const isChecked = selectedColumnKeys.includes(h.key);
                      const currentOrder = columnOrder.length > 0 ? columnOrder : allHeaders.map(item => item.key);
                      const middleKeys = currentOrder.filter(k => k !== 'sequence' && k !== 'notes');
                      const middleIdx = middleKeys.indexOf(h.key);
                      const isFirstMiddle = middleIdx === 0;
                      const isLastMiddle = middleIdx === middleKeys.length - 1;

                      return (
                        <div key={h.key} className="flex items-center justify-between gap-3 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl group transition-colors">
                          <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={() => setSelectedColumnKeys(prev => isChecked ? prev.filter(k => k !== h.key) : [...prev, h.key])}
                              className="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
                            />
                            <span className={`text-xs font-bold truncate ${isChecked ? 'text-emerald-950 dark:text-emerald-200' : 'text-gray-400 dark:text-gray-500'}`}>
                              {h.label}
                            </span>
                          </label>

                          {h.key === 'sequence' ? (
                            <span className="text-[10px] sm:text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-bold px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800 whitespace-nowrap flex-shrink-0">
                              الأول دائماً
                            </span>
                          ) : h.key === 'notes' ? (
                            <span className="text-[10px] sm:text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 font-bold px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800 whitespace-nowrap flex-shrink-0">
                              الأخير دائماً
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                disabled={isFirstMiddle}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveColumn(h.key, 'up'); }}
                                className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
                                title="تقديم للأعلى"
                                aria-label="تقديم للأعلى"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={isLastMiddle}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveColumn(h.key, 'down'); }}
                                className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
                                title="تأخير للأسفل"
                                aria-label="تأخير للأسفل"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="pt-2.5 mt-2.5 border-t dark:border-gray-700 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={handleSaveAsDefault}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                        isDefaultSaved 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-500/30 active:scale-95'
                      }`}
                    >
                      {isDefaultSaved ? (
                        <span>✓ تم حفظ الترتيب والتنسيق الافتراضي</span>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          <span>حفظ الترتيب كعرض افتراضي</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="w-full py-1 text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold text-center transition-colors cursor-pointer"
                    >
                      استعادة الترتيب الافتراضي
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              {dynamicHeaders.map(h => (
                <th 
                  key={h.key} 
                  onClick={() => setSortConfig({ key: h.key, direction: sortConfig?.key === h.key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })} 
                  className={`px-3 py-4 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase cursor-pointer whitespace-nowrap text-right ${h.key === 'sequence' ? 'w-px !px-2 text-center' : ''}`}
                >
                  {h.label}
                </th>
              ))}
              {!topStudentsSortDesc && <th className="px-3 py-4 text-center text-[10px] font-bold text-gray-500 no-print">العمليات</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
            {sortedAndFilteredData.map((item: any, idx: number) => {
              const isPlaceholder = typeof item.id === 'string' && item.id.startsWith('p-');
              const draft = draftEdits[item.id] || {};

              // Color Logic
              let rowColorStyle = {};
              const isAbsentOrNotRecorded = item.attendance === AttendanceStatus.ABSENT || item.attendance === NOT_RECORDED;
              
              if (isAbsentOrNotRecorded && item.attendance && colorMap && colorMap[item.attendance]) {
                rowColorStyle = { color: colorMap[item.attendance] };
              } else if (item.grade && colorMap && colorMap[item.grade]) {
                rowColorStyle = { color: colorMap[item.grade] };
              }

              return (
                <tr key={item.id} className={`${idx % 2 === 0 ? "" : "bg-gray-50/20 dark:bg-gray-900/5"} hover:bg-emerald-50/30 transition-colors group`}>
                  {dynamicHeaders.map(h => {
                    const isEditable = isQuickEditActive && !isPlaceholder;
                    let cellContent;
                    
                    let cellStyle: any = {};
                    if (h.key === 'attendance' && item.attendance && colorMap && colorMap[item.attendance]) {
                      if (!isAbsentOrNotRecorded) {
                        cellStyle = { backgroundColor: hexToRgba(colorMap[item.attendance], 0.15), color: colorMap[item.attendance], fontWeight: 'bold' };
                      }
                    } else if (h.key === 'grade' && item.grade && colorMap && colorMap[item.grade]) {
                      cellStyle = { backgroundColor: hexToRgba(colorMap[item.grade], 0.15), color: colorMap[item.grade], fontWeight: 'bold' };
                    }

                    if (isEditable && h.key === 'weekNumber') {
                      const rawVal = draft.weekNumber !== undefined ? draft.weekNumber : item.weekNumber;
                      const safeVal = rawVal === null || rawVal === undefined || isNaN(rawVal) ? '' : rawVal;
                      cellContent = (
                        <input 
                          type="number" 
                          min="1"
                          max="100"
                          value={safeVal} 
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              handleDraftUpdate(item.id, 'weekNumber', '');
                            } else {
                              const parsed = parseInt(val, 10);
                              handleDraftUpdate(item.id, 'weekNumber', isNaN(parsed) ? '' : parsed);
                            }
                          }} 
                          className="w-16 p-1.5 text-xs text-center border-2 border-amber-400 bg-amber-50 dark:bg-gray-700 dark:border-amber-500 rounded-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-xs selection:bg-amber-300 selection:text-amber-950" 
                          title="تعديل رقم الأسبوع"
                        />
                      );
                    } else if (isEditable && h.key === 'studentOriginalHalaqaName') {
                      const currentHalaqaId = draft.sardHalaqaId ?? (item.sardHalaqaId || 0);
                      cellContent = (
                        <select 
                          value={currentHalaqaId} 
                          onChange={(e) => handleDraftUpdate(item.id, 'sardHalaqaId', e.target.value)} 
                          className="p-1 text-[10px] border-amber-300 rounded-lg font-bold"
                        >
                          <option value="0">---</option>
                          {[...sardHalaqas].sort((a,b) => a.name.localeCompare(b.name, 'ar', { numeric: true })).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                      );
                    } else if (isEditable && h.key === 'evaluatorName') {
                      const currentTeacherId = draft.teacherId !== undefined ? draft.teacherId : item.teacherId;
                      cellContent = (
                        <select 
                          value={currentTeacherId} 
                          onChange={(e) => handleDraftUpdate(item.id, 'teacherId', parseInt(e.target.value))}
                          className="p-1 text-[10px] border-amber-300 rounded-lg bg-amber-50 focus:ring-amber-500 max-w-[120px] font-bold"
                        >
                          <option value="0">---</option>
                          {users.filter(u => u.role === UserRole.TEACHER).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      );
                    } else if (h.key === 'evaluationDate') {
                      cellContent = (
                        <div className="flex flex-col items-center justify-center w-full mx-auto">
                          {(() => {
                            const dual = getDualDate(item.evaluationDate, hijriAdjustments);
                            return dual ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-[11px] leading-tight">{dual.hijri}</span>
                                <span className="text-[9px] text-gray-500 font-bold leading-tight">{dual.gregorian}</span>
                              </div>
                            ) : <span className="text-[9px] text-gray-500 font-bold">{item.evaluationDate}</span>;
                          })()}
                        </div>
                      );
                    } else if (h.key === 'studentName') {
                      cellContent = (
                        <div className="flex flex-col">
                          <span className="font-bold">{item.studentName}</span>
                          {item.isAlAmeen && (
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold leading-tight mt-0.5">
                              (من طلاب الأمين)
                            </span>
                          )}
                        </div>
                      );
                    } else {
                      cellContent = renderCell(draft[h.key as keyof SardEvaluation] ?? item[h.key], h.type);
                    }

                    return (
                      <td key={h.key} className={`px-3 py-3.5 whitespace-nowrap text-[10px] sm:text-xs ${item.attendance === NOT_RECORDED ? 'text-gray-600 italic' : 'text-gray-900 dark:text-gray-100'} ${isEditable ? 'bg-amber-50/30' : ''} ${h.key === 'sequence' ? 'w-px !px-2 text-center font-bold text-gray-500' : ''}`} style={{ ...rowColorStyle, ...cellStyle }}>
                        {cellContent}
                      </td>
                    );
                  })}
                  {!topStudentsSortDesc && (
                    <td className="px-3 py-3.5 whitespace-nowrap text-center no-print">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(item)} 
                          disabled={isPlaceholder || isQuickEditActive} 
                          className={`p-1.5 rounded-lg transition-colors ${isPlaceholder || isQuickEditActive ? 'text-gray-300 opacity-50 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50 border border-blue-100'}`} 
                          title="تعديل"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          disabled={isPlaceholder || item.attendance === NOT_RECORDED || isQuickEditActive} 
                          className={`p-1.5 rounded-lg transition-colors ${isPlaceholder || item.attendance === NOT_RECORDED || isQuickEditActive ? 'text-gray-300 opacity-50 cursor-not-allowed' : 'text-red-600 hover:bg-red-50 border border-red-100'}`} 
                          title="حذف"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <WordExportModal 
        isOpen={isWordModalOpen} 
        onClose={() => setIsWordModalOpen(false)} 
        onExport={(orientation, action) => {
          if (action === 'share-pdf') {
            sharePdfDirectly(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, colorMap, undefined, orientation);
          } else if (action === 'pdf') {
            exportToPdf(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, colorMap);
          } else {
            exportToWord(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, hijriAdjustments, colorMap, undefined, orientation, action);
          }
        }} 
      />

      <ExcelExportModal 
        isOpen={isExcelModalOpen} 
        onClose={() => setIsExcelModalOpen(false)} 
        onExport={(orientation, action) => exportToExcel(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, hijriAdjustments, colorMap, undefined, orientation, action)} 
      />
    </div>
  );
};

export default SardReportsTable;
