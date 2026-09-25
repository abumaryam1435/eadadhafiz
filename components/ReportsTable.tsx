
import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { Evaluation, AttendanceStatus, PerformanceLevel, UserRole, AbsenceReason, PeriodicReviewStatus, EvaluationType } from '../types';
import { renderCell, translationMap, exportToWord, toArabicDigits, formatRtlRange } from '../utils/exportWord';
import { exportToExcel } from '../utils/exportExcel';
import { exportToPdf, getDualDate, sharePdfDirectly } from '../utils/exportPdf';
import { shareHtmlViaWhatsApp } from '../utils/exportHtml';
import { isSmartMatch } from '../utils/searchUtils';
import { HexColorPicker } from "react-colorful";
import EvaluationEditForm from './EvaluationEditForm';
import Modal from './Modal';
import { FilterItem } from './FilterItem';
import { WordExportModal } from './WordExportModal';
import { getMemorizedPagesData, calculateStudentLevel, normalizeStudentLevel } from '../utils/pageUtils';
import { ExcelExportModal } from './ExcelExportModal';

const NOT_RECORDED = 'not_recorded';
const LOCAL_STORAGE_REPORT_COLUMNS_KEY = 'halaqaReportSelectedColumns';
const LOCAL_STORAGE_COLOR_MAP_KEY = 'halaqaReportColorMap';
const LOCAL_STORAGE_SAVE_COLORS_KEY = 'halaqaReportSaveColors';

const isValueEffectivelyEmpty = (value: any, type?: string): boolean => {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  let stringValue = String(value).trim();
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

export interface ReportsTableProps {
  subjectFilter?: 'quran' | 'mutoon';
}

export const ReportsTable: React.FC<ReportsTableProps> = ({ subjectFilter = 'quran' }) => {
  const context = useContext(AppContext);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(['ALL']);
  const [hasSetDefaultWeek, setHasSetDefaultWeek] = useState(false);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedHalaqaIds, setSelectedHalaqaIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedAttendance, setSelectedAttendance] = useState<string[]>([AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.ABSENT]);
  const [selectedPerformance, setSelectedPerformance] = useState<string[]>([]);
  const [selectedPeriodicReview, setSelectedPeriodicReview] = useState<string[]>([]);
  const [selectedEvaluationTypes, setSelectedEvaluationTypes] = useState<string[]>([]);
  const [selectedAlAmeen, setSelectedAlAmeen] = useState<string[]>([]);
  const [selectedFromIbri, setSelectedFromIbri] = useState<string[]>(['نعم']);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>({ key: 'halaqaName', direction: 'ascending' });
  const [topStudentsCount, setTopStudentsCount] = useState<string>('');
  const [topStudentsSortDesc, setTopStudentsSortDesc] = useState<boolean>(false);
  const [strictMode, setStrictMode] = useState(false);

  // New State for Color Mapping
  const [saveColors, setSaveColors] = useState(() => {
      return localStorage.getItem(LOCAL_STORAGE_SAVE_COLORS_KEY) === 'true';
  });

  const [colorMap, setColorMap] = useState<Record<string, string>>(() => {
      try {
          if (localStorage.getItem(LOCAL_STORAGE_SAVE_COLORS_KEY) === 'true') {
              const saved = localStorage.getItem(LOCAL_STORAGE_COLOR_MAP_KEY);
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
  const [performanceSearch, setPerformanceSearch] = useState('');
  const [periodicReviewSearch, setPeriodicReviewSearch] = useState('');
  const [evaluationTypeSearch, setEvaluationTypeSearch] = useState('');
  const [alAmeenSearch, setAlAmeenSearch] = useState('');
  const [fromIbriSearch, setFromIbriSearch] = useState('');

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const scrollTable = (direction: 'right' | 'left') => {
    if (tableScrollRef.current) {
      const delta = direction === 'right' ? 300 : -300;
      tableScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };
  const [weekSearch, setWeekSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [isDefaultSaved, setIsDefaultSaved] = useState(false);
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  
  const [isQuickEditActive, setIsQuickEditActive] = useState(false);
  const [draftEdits, setDraftEdits] = useState<Record<number, Partial<Evaluation>>>({});

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

  const evaluations = context?.evaluations || [];
  const students = context?.students || [];
  const halaqas = context?.halaqas || [];
  const users = context?.users || [];
  const updateEvaluation = context?.updateEvaluation;
  const addEvaluation = context?.addEvaluation;
  const deleteEvaluation = context?.deleteEvaluation;
  const showToast = context?.showToast;
  const hijriAdjustments = context?.hijriAdjustments;
  const currentUser = context?.currentUser;

  const targetStudents = useMemo(() => {
    if (subjectFilter === 'mutoon') {
      return students.filter(s => !!s.isAlAmeen);
    }
    return students;
  }, [students, subjectFilter]);

  const targetHalaqas = useMemo(() => {
    if (subjectFilter === 'mutoon') {
      const alAmeenHalaqaIds = new Set(targetStudents.map(s => String(s.halaqaId)));
      return halaqas.filter(h => alAmeenHalaqaIds.has(String(h.id)));
    }
    return halaqas;
  }, [halaqas, targetStudents, subjectFilter]);

  const maxWeekFound = useMemo(() => {
    const regularEvaluations = evaluations.filter(e => !e.isTest && (subjectFilter === 'mutoon' ? e.subject === 'mutoon' : e.subject !== 'mutoon'));
    if (regularEvaluations.length === 0) return 'all';
    const weeks = regularEvaluations.map(e => e.weekNumber);
    return Math.max(...weeks).toString();
  }, [evaluations, subjectFilter]);

  useEffect(() => {
    if (!hasSetDefaultWeek && maxWeekFound !== 'all' && evaluations.filter(e => !e.isTest && (subjectFilter === 'mutoon' ? e.subject === 'mutoon' : e.subject !== 'mutoon')).length > 0) {
        setSelectedWeeks([maxWeekFound]);
        setHasSetDefaultWeek(true);
    }
  }, [maxWeekFound, hasSetDefaultWeek, evaluations.length, subjectFilter]);

  const allHeaders = useMemo(() => [
    { key: 'sequence', label: '#' },
    { key: 'studentName', label: 'الطالب' },
    { key: 'studentOriginalHalaqaName', label: 'حلقة الطالب' },
    { key: 'halaqaName', label: 'حلقة المقيم' },
    { key: 'evaluatorName', label: 'المقيم' },
    { key: 'weekNumber', label: 'الأسبوع' },
    { key: 'evaluationDate', label: 'التاريخ' },
    { key: 'attendance', label: 'الحضور', type: 'translation' },
    { key: 'absenceReason', label: 'سبب الغياب', type: 'translation' },
    { key: 'evaluationType', label: 'النوع', type: 'translation' },
    { key: 'pages', label: subjectFilter === 'mutoon' ? 'عدد الأبيات' : 'الصفحات' },
    { key: 'ayahRangeDisplay', label: subjectFilter === 'mutoon' ? 'نطاق الأبيات' : 'الآيات', type: 'text' },
    { key: 'surahs', label: subjectFilter === 'mutoon' ? 'المتن' : 'السور', type: 'array' },
    { key: 'performance', label: 'الأداء', type: 'translation' },
    { key: 'periodicReview', label: 'المراجعة الدورية', type: 'translation' },
    { key: 'oldMemorizedPagesStr', label: subjectFilter === 'mutoon' ? 'الأبيات السابقة' : 'الحفظ القديم' },
    { key: 'newMemorizedPagesStr', label: subjectFilter === 'mutoon' ? 'الأبيات المضافة' : 'الحفظ الجديد' },
    { key: 'totalMemorizedPagesCount', label: 'إجمالي الحفظ' },
    { key: 'evalMemorizedPages', label: 'أرقام صفحات التقييم' },
    { key: 'evalFathErrors', label: subjectFilter === 'mutoon' ? 'الأخطاء' : 'أخطاء الفتح' },
    { key: 'evalTashkeelErrors', label: 'أخطاء التشكيل' },
    { key: 'evalTajweedErrors', label: 'أخطاء التجويد' },
    { key: 'evalTotalErrors', label: 'مجموع الأخطاء' },
    { key: 'studentLevel', label: 'المستوى' },
    { key: 'isAlAmeenStr', label: 'من الأمين؟' },
    { key: 'isFromIbriStr', label: 'من جامع عبري؟' },
    { key: 'notes', label: 'ملاحظات' },
  ], [subjectFilter]);

  const defaultExcludedKeys = useMemo(() => {
    if (subjectFilter === 'mutoon') {
      return [
        'evaluatorName', 
        'evaluationDate', 
        'studentOriginalHalaqaName',
        
        'periodicReview',
        'oldMemorizedPagesStr',
        'newMemorizedPagesStr',
        'totalMemorizedPagesCount',
        'evalMemorizedPages',
        'evalTashkeelErrors',
        'evalTajweedErrors',
        'evalTotalErrors',
        'studentLevel',
        'isAlAmeenStr',
        'isFromIbriStr'
      ];
    }
    return [
    'evaluatorName', 
    'evaluationDate', 
    'studentOriginalHalaqaName',
    'oldMemorizedPagesStr',
    'newMemorizedPagesStr',
    'totalMemorizedPagesCount',
    'evalMemorizedPages',
    'evalFathErrors',
    'evalTashkeelErrors',
    'evalTajweedErrors',
    'evalTotalErrors',
    'studentLevel',
    'isAlAmeenStr',
    'isFromIbriStr'
  ]}, [subjectFilter]);

  useEffect(() => {
    const storageKey = subjectFilter === 'mutoon' ? 'mutoonReportSelectedColumns' : 'halaqaReportSelectedColumns';
    const saved = localStorage.getItem(storageKey);
    const defaultKeys = allHeaders.map(h => h.key).filter(k => !defaultExcludedKeys.includes(k));
    const baseOrder = allHeaders.map(h => h.key);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let cols = parsed;
          if (subjectFilter === 'mutoon' && !cols.includes('ayahRangeDisplay')) {
            cols = [...cols, 'ayahRangeDisplay'];
          }
          setSelectedColumnKeys(cols);
          const customMiddle = cols.filter(k => k !== 'sequence' && k !== 'notes');
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
  }, [allHeaders, subjectFilter, defaultExcludedKeys]);

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
    const storageKey = subjectFilter === 'mutoon' ? 'mutoonReportSelectedColumns' : 'halaqaReportSelectedColumns';
    localStorage.setItem(storageKey, JSON.stringify({
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

  const processedEvaluationData = useMemo(() => {
    return evaluations.filter(e => {
      if (e.isTest) return false;
      if (subjectFilter === 'mutoon') {
        if (e.subject !== 'mutoon') return false;
        const student = students.find(s => Number(s.id) === Number(e.studentId));
        return student ? !!student.isAlAmeen : true;
      } else {
        return e.subject !== 'mutoon';
      }
    }).map(e => {
      const student = students.find(s => Number(s.id) === Number(e.studentId));
      
      // تم إزالة البحث عن الحلقة بواسطة e.halaqaId لدعم المنطق الجديد (حلقة المعلم)
      
      const evaluator = users.find(u => Number(u.id) === Number(e.teacherId));
      
      const studentOriginalHalaqa = student ? halaqas.find(h => Number(h.id) === Number(student.halaqaId)) : null;
      const studentOriginalHalaqaId = student ? Number(student.halaqaId) : -1;

      // Guest evaluation logic is kept for data but not used for red highlighting anymore
      const isGuestEvaluation = student ? Number(e.halaqaId) !== Number(student.halaqaId) : false;
      const getAyahRangeDisplay = (from?: string | number, to?: string | number) => (from && to) ? (from === to ? toArabicDigits(from) : formatRtlRange(`${from} - ${to}`)) : (from ? toArabicDigits(from) : '—');
      
      // المنطق: البحث عن الحلقة التي جرى فيها التقييم أو التي يشرف عليها المعلم (المقيم)
      const evalHalaqa = halaqas.find(h => Number(h.id) === Number(e.halaqaId));
      const evaluatorOwnedHalaqa = halaqas.find(h => Number(h.teacherId) === Number(e.teacherId));
      
      let displayHalaqaName = "معلم متنقل";
      if (evalHalaqa) {
          displayHalaqaName = evalHalaqa.name;
      } else if (evaluatorOwnedHalaqa) {
          displayHalaqaName = evaluatorOwnedHalaqa.name;
      }

      const pagesData = student ? getMemorizedPagesData(student, context?.evaluations || []) : { oldStr: "—", newStr: "—", totalCount: 0 };
      
      const evalPagesStr = e.newMemorizedPages && e.newMemorizedPages.length > 0 
        ? e.newMemorizedPages.map(toArabicDigits).join('، ') 
        : '—';
      const hasErrors = e.evalFathErrors !== undefined || e.evalTashkeelErrors !== undefined || e.evalTajweedErrors !== undefined;
      const isPresent = e.attendance === AttendanceStatus.PRESENT || e.attendance === AttendanceStatus.LATE;
      
      return { 
        ...e, 
        studentName: student?.name || 'غير معروف', 
        isAlAmeen: student?.isAlAmeen,
        isAlAmeenStr: student?.isAlAmeen ? 'نعم' : 'لا',
        isFromIbri: student?.isFromIbri !== false,
        isFromIbriStr: (student?.isFromIbri !== false) ? 'نعم' : 'لا',
        studentOriginalHalaqaName: studentOriginalHalaqa?.name || '-',
        studentOriginalHalaqaId, 
        studentLevel: student ? (normalizeStudentLevel(student.manualStudentLevel || student.manualLevel) || calculateStudentLevel(pagesData.totalCount)) : '—',
        halaqaName: displayHalaqaName,
        oldMemorizedPagesStr: pagesData.oldStr,
        newMemorizedPagesStr: pagesData.newStr,
        totalMemorizedPagesCount: pagesData.totalCount,
        evalMemorizedPages: evalPagesStr,
        evalFathErrors: e.evalFathErrors !== undefined ? toArabicDigits(e.evalFathErrors) : (isPresent ? toArabicDigits(0) : '—'),
        evalTashkeelErrors: e.evalTashkeelErrors !== undefined ? toArabicDigits(e.evalTashkeelErrors) : (isPresent ? toArabicDigits(0) : '—'),
        evalTajweedErrors: e.evalTajweedErrors !== undefined ? toArabicDigits(e.evalTajweedErrors) : (isPresent ? toArabicDigits(0) : '—'),
        evalTotalErrors: hasErrors 
          ? toArabicDigits((e.evalFathErrors || 0) + (e.evalTashkeelErrors || 0) + (e.evalTajweedErrors || 0)) 
          : (isPresent ? toArabicDigits(0) : '—'),
        evaluatorOwnedHalaqaId: evaluatorOwnedHalaqa?.id,
        evaluatorName: evaluator?.name || '—', 
        isGuestEvaluation,
        ayahRangeDisplay: (() => {
          let fromAyahVal = e.fromAyah;
          let toAyahVal = e.toAyah;
          if (e.subject === 'mutoon' && (fromAyahVal === undefined || fromAyahVal === null || toAyahVal === undefined || toAyahVal === null) && e.pages && e.evaluationType === EvaluationType.MEMORIZATION) {
            const matnName = e.surahs?.[0];
            if (matnName) {
              const studentEvals = evaluations
                .filter(ev => ev.studentId === e.studentId && ev.subject === 'mutoon' && ev.evaluationType === EvaluationType.MEMORIZATION && ev.surahs?.includes(matnName))
                .sort((a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0));
              const idx = studentEvals.findIndex(ev => ev.id === e.id);
              const prevLines = idx > 0 ? studentEvals.slice(0, idx).reduce((sum, ev) => sum + (ev.pages || 0), 0) : 0;
              fromAyahVal = prevLines + 1;
              toAyahVal = prevLines + Number(e.pages);
            }
          }
          return getAyahRangeDisplay(fromAyahVal, toAyahVal);
        })(),
        evaluationDate: e.evaluationDate || '—'
      };
    });
  }, [evaluations, students, halaqas, users, subjectFilter]);
  
  const allWeeks = useMemo(() => ['all', ...Array.from(new Set(evaluations.filter(e => !e.isTest && (subjectFilter === 'mutoon' ? e.subject === 'mutoon' : e.subject !== 'mutoon')).map(e => e.weekNumber))).sort((a: any, b: any) => a - b).map(String)], [evaluations, subjectFilter]);
  
  const attendanceOptions = [
    {id: AttendanceStatus.PRESENT, name: translationMap[AttendanceStatus.PRESENT]},
    {id: AttendanceStatus.LATE, name: translationMap[AttendanceStatus.LATE]},
    {id: AttendanceStatus.ABSENT, name: translationMap[AttendanceStatus.ABSENT]},
    {id: NOT_RECORDED, name: translationMap[NOT_RECORDED]}
  ];
  const performanceOptions = Object.values(PerformanceLevel).map(level => ({ id: level, name: translationMap[level] }));
  const periodicReviewOptions = Object.values(PeriodicReviewStatus).map(status => ({ id: status, name: translationMap[status] }));
  const evaluationTypeOptions = Object.values(EvaluationType).map(type => ({ id: type, name: translationMap[type] }));
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
        items = [...processedEvaluationData];
    } else {
        // Generate rows for selected weeks
        items = [];
        selectedWeeks.forEach(weekStr => {
            const weekNum = parseInt(weekStr);
            const weekItems = targetStudents.map(s => {
                const ev = processedEvaluationData.find(e => Number(e.studentId) === Number(s.id) && e.weekNumber === weekNum);
                if (ev) return ev;
                const studentHalaqa = halaqas.find(h => Number(h.id) === Number(s.halaqaId));
                const studentTeacher = users.find(u => Number(u.id) === Number(studentHalaqa?.teacherId));
                return { 
                  id: `p-${s.id}-${weekNum}`, studentId: s.id, studentName: s.name, isAlAmeen: s.isAlAmeen, isAlAmeenStr: s.isAlAmeen ? 'نعم' : 'لا', isFromIbri: s.isFromIbri !== false, isFromIbriStr: (s.isFromIbri !== false) ? 'نعم' : 'لا', halaqaId: s.halaqaId, teacherId: studentHalaqa?.teacherId, 
                  studentOriginalHalaqaId: Number(s.halaqaId),
                  studentOriginalHalaqaName: studentHalaqa?.name || '-',
                  halaqaName: studentHalaqa?.name || '-', evaluatorName: studentTeacher?.name || '—',
                  weekNumber: weekNum, attendance: NOT_RECORDED, isGuestEvaluation: false, ayahRangeDisplay: '—', evaluationDate: '—'
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
    const hasPerformanceFilter = selectedPerformance.length > 0 && !selectedPerformance.includes('ALL');
    const hasPeriodicReviewFilter = selectedPeriodicReview.length > 0 && !selectedPeriodicReview.includes('ALL');
    const hasEvaluationTypeFilter = selectedEvaluationTypes.length > 0 && !selectedEvaluationTypes.includes('ALL');

    if (strictMode && (hasAttendanceFilter || hasPerformanceFilter || hasPeriodicReviewFilter || hasEvaluationTypeFilter)) {
        // Group by student
        const studentGroups: Record<string, any[]> = {};
        items.forEach(item => {
            const sid = String(item.studentId);
            if (!studentGroups[sid]) studentGroups[sid] = [];
            studentGroups[sid].push(item);
        });

        let keptItems: any[] = [];
        Object.values(studentGroups).forEach(group => {
            // Check if group has all selected weeks? 
            // If isAllWeeks is false, we generated placeholders, so group.length should equal selectedWeeks.length.
            // If isAllWeeks is true, group.length varies.
            // Strict mode implies: For ALL displayed records of this student, they must match the criteria.
            
            const meetsCriteria = group.every(item => {
                let pass = true;
                if (hasAttendanceFilter) {
                    if (!selectedAttendance.includes(item.attendance)) pass = false;
                }
                if (hasPerformanceFilter) {
                    if (!item.performance || !selectedPerformance.includes(item.performance)) pass = false;
                }
                if (hasPeriodicReviewFilter) {
                    if (!item.periodicReview || !selectedPeriodicReview.includes(item.periodicReview)) pass = false;
                }
                if (hasEvaluationTypeFilter) {
                    if (!item.evaluationType || !selectedEvaluationTypes.includes(item.evaluationType)) pass = false;
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
        if (hasPerformanceFilter) items = items.filter(i => i.performance && selectedPerformance.includes(i.performance));
        if (hasPeriodicReviewFilter) items = items.filter(i => i.periodicReview && selectedPeriodicReview.includes(i.periodicReview));
        if (hasEvaluationTypeFilter) items = items.filter(i => selectedEvaluationTypes.includes(i.evaluationType));
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
            
            if (item.pages) {
                const num = parseFloat(String(item.pages).trim());
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
            
            // Get unique weeks where student has actual (non-placeholder) evaluations
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
                attendance: group[0]?.attendance || NOT_RECORDED
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
    
    // Add sequence number
    return items.map((item, index) => ({ ...item, sequence: index + 1 }));
  }, [processedEvaluationData, targetStudents, students, halaqas, users, selectedWeeks, selectedStudentIds, selectedHalaqaIds, selectedTeacherIds, selectedAlAmeen, selectedFromIbri, selectedAttendance, selectedPerformance, selectedPeriodicReview, selectedEvaluationTypes, sortConfig, strictMode, selectedColumnKeys, topStudentsSortDesc, topStudentsCount]);

  const exportHeaderInfo = useMemo(() => {
    const isAllWeeks = selectedWeeks.includes('ALL') || selectedWeeks.length === 0;
    
    let title = "";
    let fileName = "";
    
    if (isAllWeeks) {
        title = subjectFilter === 'mutoon' ? "تقرير تقييمات المتون (طلاب الأمين)" : "تقرير جميع الأسابيع";
        fileName = subjectFilter === 'mutoon' ? "تقرير_متون_الأمين" : "تقرير_التقييمات_الشامل";
    } else if (selectedWeeks.length === 1) {
        title = `تقرير ${subjectFilter === 'mutoon' ? 'متون الأمين' : 'الأسبوع'} (${selectedWeeks[0]})`;
        fileName = `تقرير_${subjectFilter === 'mutoon' ? 'متون_الأمين' : 'الأسبوع'}_${selectedWeeks[0]}`;
    } else if (selectedWeeks.length === 2) {
        title = `تقرير ${subjectFilter === 'mutoon' ? 'متون الأمين' : 'الأسبوعين'} (${selectedWeeks[0]}، ${selectedWeeks[1]})`;
        fileName = `تقرير_${subjectFilter === 'mutoon' ? 'متون_الأمين' : 'الأسبوعين'}_${selectedWeeks[0]}_${selectedWeeks[1]}`;
    } else {
        title = `تقرير الأسابيع (${selectedWeeks.join('، ')})`;
        fileName = `تقرير_الأسابيع_${selectedWeeks.join('_')}`;
    }

    const filters = [];
    if (subjectFilter === 'mutoon') filters.push("خاص ببرنامج الأمين");
    if (selectedStudentIds.length > 0 && !selectedStudentIds.includes('ALL')) filters.push(`الطلاب: ${selectedStudentIds.length} مختار`);
    if (selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes('ALL')) filters.push(`الحلقات: ${selectedHalaqaIds.length} مختار`);
    if (selectedTeacherIds.length > 0 && !selectedTeacherIds.includes('ALL')) filters.push(`المعلمين: ${selectedTeacherIds.length} مختار`);
    if (selectedAlAmeen.length > 0 && !selectedAlAmeen.includes('ALL')) filters.push(`من الأمين: ${selectedAlAmeen.join('، ')}`);
    if (selectedFromIbri.length > 0 && !selectedFromIbri.includes('ALL')) filters.push(`من جامع عبري: ${selectedFromIbri.join('، ')}`);
    
    // Logic for attendance filter subtitle: hide if all traditional statuses are selected
    const traditionalStatuses = [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.ABSENT];
    const isFilteredByAllTraditional = traditionalStatuses.every(s => selectedAttendance.includes(s)) && selectedAttendance.length >= 3;
    
    if (selectedAttendance.length > 0 && !selectedAttendance.includes('ALL') && !isFilteredByAllTraditional) {
        filters.push(`الحضور: ${selectedAttendance.map(a => translationMap[a as keyof typeof translationMap] || a).join(', ')}`);
    } else if (selectedAttendance.length > 0 && !selectedAttendance.includes('ALL') && isFilteredByAllTraditional && selectedAttendance.length > 3) {
        // If they selected something extra beyond the 3 traditional ones
        filters.push(`الحضور: ${selectedAttendance.map(a => translationMap[a as keyof typeof translationMap] || a).join(', ')}`);
    }

    if (selectedPerformance.length > 0 && !selectedPerformance.includes('ALL')) filters.push(`الأداء: ${selectedPerformance.map(p => translationMap[p as keyof typeof translationMap] || p).join(', ')}`);
    if (selectedPeriodicReview.length > 0 && !selectedPeriodicReview.includes('ALL')) filters.push(`المراجعة الدورية: ${selectedPeriodicReview.map(p => translationMap[p as keyof typeof translationMap] || p).join(', ')}`);
    if (selectedEvaluationTypes.length > 0 && !selectedEvaluationTypes.includes('ALL')) filters.push(`نوع الإنجاز: ${selectedEvaluationTypes.map(t => translationMap[t as keyof typeof translationMap] || t).join(', ')}`);
    
    return { title, subtitle: filters.length > 0 ? filters.join(' | ') : undefined, fileName };
  }, [selectedWeeks, selectedStudentIds, selectedHalaqaIds, selectedTeacherIds, selectedAlAmeen, selectedFromIbri, selectedAttendance, selectedPerformance, selectedPeriodicReview, selectedEvaluationTypes, students, halaqas, users, subjectFilter]);

  const dynamicHeaders = useMemo(() => {
    if (topStudentsSortDesc) {
        return [
            { key: 'sequence', label: '#', type: 'text' },
            { key: 'studentName', label: 'اسم الطالب', type: 'text' },
            { key: 'totalPagesInSelectedWeeks', label: subjectFilter === 'mutoon' ? 'عدد الأبيات' : 'عدد الصفحات', type: 'text' }
        ];
    }
    const headersMap = new Map(allHeaders.map(h => [h.key, h]));
    const currentOrder = columnOrder.length > 0 ? columnOrder : allHeaders.map(h => h.key);
    
    // Ordered active columns
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
  }, [allHeaders, columnOrder, selectedColumnKeys, sortedAndFilteredData, topStudentsSortDesc, subjectFilter]);

  const handleDelete = (id: any) => {
      if (typeof id === 'string' && id.startsWith('p-')) return; 
      setItemToDelete(id);
  };

  const handleEdit = (item: any) => {
      if (typeof item.id === 'string' && item.id.startsWith('p-')) {
          setEditingEvaluation({ ...item, attendance: null });
          return;
      }
      setEditingEvaluation(item);
  };

  const handleDraftUpdate = (id: string | number, key: keyof Evaluation, value: any) => {
      let finalValue = (key === 'halaqaId' || key === 'teacherId') ? Number(value) : value;
      
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
          
          if (key === 'halaqaId') {
              const targetHalaqa = halaqas.find(h => Number(h.id) === Number(finalValue));
              if (targetHalaqa) {
                  newDraft.teacherId = Number(targetHalaqa.teacherId);
              } else if (Number(finalValue) === 0) {
                  newDraft.teacherId = 0;
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
              // بحث مرن عن التقييم الأصلي سواء كان المعرف نصاً أو رقماً
              const original = evaluations.find(e => String(e.id) === String(idKey));
              const draft = draftEdits[idKey as any];
              if (!original || !draft) {
                  console.warn(`Evaluation not found for ID: ${idKey}`);
                  return;
              }

              const cleanDraft: Partial<Evaluation> = { ...draft };

              // معالجة رقم الأسبوع: حفظ الرقم الذي حدده المشرف مباشرة وبدقة لجميع الطلاب
              if (cleanDraft.weekNumber !== undefined) {
                  const str = String(cleanDraft.weekNumber).trim().replace(/[٠-٩]/g, d => (d.charCodeAt(0) - 1632).toString());
                  const targetWeek = parseInt(str, 10);
                  if (isNaN(targetWeek) || targetWeek <= 0) {
                      delete cleanDraft.weekNumber; // إبقاء الأسبوع الأصلي في حال تفريغ الحقل تماماً
                  } else {
                      cleanDraft.weekNumber = targetWeek;
                  }
              }

              if (cleanDraft.pages !== undefined) {
                  const str = String(cleanDraft.pages).trim().replace(/[٠-٩]/g, d => (d.charCodeAt(0) - 1632).toString());
                  const p = parseFloat(str);
                  if (isNaN(p)) {
                      delete cleanDraft.pages;
                  } else {
                      cleanDraft.pages = p;
                  }
              }

              updateEvaluation({ ...original, ...cleanDraft, updatedAt: Date.now() });
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
          localStorage.setItem(LOCAL_STORAGE_COLOR_MAP_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleToggleSaveColors = (checked: boolean) => {
      setSaveColors(checked);
      localStorage.setItem(LOCAL_STORAGE_SAVE_COLORS_KEY, String(checked));
      if (checked) {
          localStorage.setItem(LOCAL_STORAGE_COLOR_MAP_KEY, JSON.stringify(colorMap));
      } else {
          localStorage.removeItem(LOCAL_STORAGE_COLOR_MAP_KEY);
      }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xl dark:bg-gray-800 border border-gray-100 dark:border-gray-700" ref={containerRef}>
      {editingEvaluation && (
          <EvaluationEditForm 
            initialEvaluation={editingEvaluation}
            student={students.find(s => Number(s.id) === Number(editingEvaluation.studentId))!}
            halaqa={halaqas.find(h => Number(h.id) === Number(editingEvaluation.halaqaId))}
            onClose={() => setEditingEvaluation(null)}
            onSave={(v) => { 
                if (typeof v.id === 'string' && (v.id as string).startsWith('p-')) {
                    const newEval = { ...v };
                    delete (newEval as any).id;
                    if (currentUser) newEval.teacherId = currentUser.id;
                    addEvaluation(newEval);
                } else {
                    updateEvaluation(v); 
                }
                setEditingEvaluation(null); 
                showToast('✅ تم تحديث التقييم بنجاح.'); 
            }}
            onDelete={() => { deleteEvaluation(editingEvaluation.id); setEditingEvaluation(null); showToast('🗑️ تم حذف التقييم بنجاح.'); }}
          />
      )}

      {itemToDelete && (
          <Modal title="تأكيد حذف التقييم" onClose={() => setItemToDelete(null)} hideDefaultCloseButton={true}>
              <div className="text-center py-4">
                  <p className="text-lg font-bold mb-6 dark:text-white">هل أنت متأكد من حذف هذا التقييم؟</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={() => { deleteEvaluation(itemToDelete); setItemToDelete(null); showToast('🗑️ تم حذف التقييم بنجاح.'); }} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg active:scale-95 text-xl">نعم، حذف</button>
                      <button onClick={() => setItemToDelete(null)} className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-2xl font-bold dark:bg-gray-700 dark:text-gray-200 text-xl">إلغاء</button>
                  </div>
              </div>
          </Modal>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between no-print mb-6 gap-4">
        <div className="flex flex-wrap items-center gap-4">
            <h3 className="text-lg font-bold text-green-900 dark:text-green-300 flex items-center gap-2">
            تصفية التقارير
            </h3>
            
            {(selectedWeeks.length > 1 || selectedWeeks.includes('ALL')) && (
            <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border shadow-sm transition-all animate-fade-in ${strictMode ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`} title="عند التفعيل: يظهر فقط الطلاب الذين يطابقون الفلاتر المختارة (مثل الأداء الممتاز) في كل أسبوع من الأسابيع المحددة. سيتم إخفاء الطالب إذا لم يحقق الشرط في أسبوع واحد على الأقل.">
                <div className="relative" dir="ltr">
                    <input type="checkbox" checked={strictMode} onChange={e => setStrictMode(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 shadow-inner peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
                </div>
                <span className={`text-xs font-bold select-none ${strictMode ? 'text-amber-900 dark:text-amber-100' : 'text-gray-700 dark:text-gray-200'}`}>تصفية صارمة (تحقق تصفية الأداء في جميع الأسابيع المختارة)</span>
            </label>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border shadow-sm transition-all bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <div className="relative" dir="ltr">
                        <input type="checkbox" checked={topStudentsSortDesc} onChange={e => setTopStudentsSortDesc(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 shadow-inner peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                    </div>
                    <span className={`text-xs font-bold select-none ${topStudentsSortDesc ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}>
                      {subjectFilter === 'mutoon' ? 'أكثر حفظاً (أبيات)' : 'أكثر حفظاً (صفحات)'}
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

        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-100 dark:border-green-800 shadow-sm">
            <span className="text-[10px] font-bold text-green-700 dark:text-green-300">إجمالي السجلات:</span>
            <span className="text-lg font-black text-green-900 dark:text-white">{sortedAndFilteredData.length}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-3 mb-8 no-print">
          <FilterItem id="student" title="الطالب" selectedValues={selectedStudentIds} options={targetStudents.map(s => ({id: s.id, name: s.name}))} onSelect={setSelectedStudentIds} search={studentSearch} setSearch={setStudentSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
          <FilterItem id="halaqa" title="حلقة الطالب" selectedValues={selectedHalaqaIds} options={[...targetHalaqas].sort((a,b) => a.name.localeCompare(b.name, 'ar', { numeric: true })).map(h => ({id: h.id, name: h.name}))} onSelect={setSelectedHalaqaIds} search={halaqaSearch} setSearch={setHalaqaSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
          <FilterItem id="teacher" title="المقيم" selectedValues={selectedTeacherIds} options={users.filter(u => u.role === UserRole.TEACHER).map(t => ({id: t.id, name: t.name}))} onSelect={setSelectedTeacherIds} search={teacherSearch} setSearch={setTeacherSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
          <FilterItem id="week" title="الأسبوع" selectedValues={selectedWeeks} options={allWeeks.filter(w => w !== 'all').map(w => ({id: w, name: `أسبوع ${w}`}))} onSelect={setSelectedWeeks} search={weekSearch} setSearch={setWeekSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
          <FilterItem id="alAmeen" title="من الأمين؟" selectedValues={selectedAlAmeen} options={alAmeenOptions} onSelect={setSelectedAlAmeen} search={alAmeenSearch} setSearch={setAlAmeenSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
          <FilterItem id="fromIbri" title="من جامع عبري؟" selectedValues={selectedFromIbri} options={ibriOptions} onSelect={setSelectedFromIbri} search={fromIbriSearch} setSearch={setFromIbriSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
          <FilterItem id="attendance" title="الحضور" selectedValues={selectedAttendance} options={attendanceOptions} onSelect={setSelectedAttendance} search={attendanceSearch} setSearch={setAttendanceSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
          <FilterItem id="performance" title="الأداء" selectedValues={selectedPerformance} options={performanceOptions} onSelect={setSelectedPerformance} search={performanceSearch} setSearch={setPerformanceSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
          <FilterItem id="periodicReview" title="المراجعة الدورية" selectedValues={selectedPeriodicReview} options={periodicReviewOptions} onSelect={setSelectedPeriodicReview} search={periodicReviewSearch} setSearch={setPeriodicReviewSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
          <FilterItem id="evaluationType" title="نوع الإنجاز" selectedValues={selectedEvaluationTypes} options={evaluationTypeOptions} onSelect={setSelectedEvaluationTypes} search={evaluationTypeSearch} setSearch={setEvaluationTypeSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
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
                    >الأعمدة</button>
                    {showColumnPicker && (
                        <>
                          <div 
                            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[65] sm:hidden" 
                            onClick={() => setShowColumnPicker(false)} 
                          />
                          <div className="fixed sm:absolute z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0 sm:top-full sm:left-auto sm:right-0 sm:mt-2 w-[92vw] max-w-sm sm:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-fade-in ring-1 ring-black/10 text-right">
                            <div className="flex justify-between items-center mb-3 pb-2 border-b dark:border-gray-700">
                                <span className="text-xs font-black text-green-800 dark:text-green-400">تخصيص وترتيب الأعمدة</span>
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
                                                  className="w-4 h-4 rounded text-green-600 border-gray-300 focus:ring-green-500 cursor-pointer flex-shrink-0"
                                                />
                                                <span className={`text-xs font-bold truncate ${isChecked ? 'text-green-950 dark:text-green-200' : 'text-gray-400 dark:text-gray-500'}`}>
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
                                                      className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
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
                                                      className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
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

      <div className="flex justify-between items-center mb-2 no-print sm:hidden">
          <span className="text-xs text-gray-500 font-bold">مرر يميناً ويساراً لعرض الأعمدة</span>
          <div className="flex gap-2">
              <button
                  onClick={() => scrollTable('right')}
                  className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="تمرير يمين"
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
              </button>
              <button
                  onClick={() => scrollTable('left')}
                  className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="تمرير يسار"
              >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
              </button>
          </div>
      </div>

      <div className="relative group">
        <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity">
             <button
                  onClick={() => scrollTable('right')}
                  className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                  title="تمرير يمين"
              >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
              </button>
        </div>
        
        <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity">
             <button
                  onClick={() => scrollTable('left')}
                  className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                  title="تمرير يسار"
              >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              </button>
        </div>

        <div ref={tableScrollRef} className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-gray-100 dark:border-gray-700 custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/90 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
              <tr>
              {dynamicHeaders.map(h => (
                 <th key={h.key} onClick={() => setSortConfig({ key: h.key, direction: sortConfig?.key === h.key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })} className={`px-3 py-4 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase cursor-pointer whitespace-nowrap text-right ${h.key === 'sequence' ? 'w-px !px-2 text-center' : ''}`}>
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
              } else if (item.performance && colorMap && colorMap[item.performance]) {
                  rowColorStyle = { color: colorMap[item.performance] };
              }

              return (
                <tr key={item.id} className={`${idx % 2 === 0 ? "" : "bg-gray-50/20 dark:bg-gray-900/5"} hover:bg-green-50/30 transition-colors group`}>
                  {dynamicHeaders.map(h => {
                    const isEditable = isQuickEditActive && !isPlaceholder;
                    let cellContent;
                    
                    let cellStyle: any = {};
                    if (h.key === 'attendance' && item.attendance && colorMap && colorMap[item.attendance]) {
                        // Only apply background if NOT absent/not_recorded
                        if (!isAbsentOrNotRecorded) {
                            cellStyle = { backgroundColor: hexToRgba(colorMap[item.attendance], 0.15), color: colorMap[item.attendance], fontWeight: 'bold' };
                        }
                    } else if (h.key === 'periodicReview' && item.periodicReview && colorMap && colorMap[item.periodicReview]) {
                        cellStyle = { backgroundColor: hexToRgba(colorMap[item.periodicReview], 0.15), color: colorMap[item.periodicReview], fontWeight: 'bold' };
                    } else if (h.key === 'performance' && item.performance && colorMap && colorMap[item.performance]) {
                        cellStyle = { backgroundColor: hexToRgba(colorMap[item.performance], 0.15), color: colorMap[item.performance], fontWeight: 'bold' };
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
                    } else if (isEditable && h.key === 'halaqaName') {
                      const currentHalaqaId = draft.halaqaId ?? (item.evaluatorOwnedHalaqaId || item.halaqaId || 0);
                      cellContent = <select value={currentHalaqaId} onChange={(e) => handleDraftUpdate(item.id, 'halaqaId', e.target.value)} className="p-1 text-[10px] border-2 border-amber-400 bg-amber-50 dark:bg-gray-700 dark:border-amber-500 rounded-lg font-bold"><option value="0">معلم متنقل</option>{[...halaqas].sort((a,b) => a.name.localeCompare(b.name, 'ar', { numeric: true })).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select>;
                    } else if (isEditable && h.key === 'evaluatorName') {
                      const currentTeacherId = draft.teacherId !== undefined ? draft.teacherId : item.teacherId;
                      cellContent = (
                        <select 
                          value={currentTeacherId} 
                          onChange={(e) => handleDraftUpdate(item.id, 'teacherId', parseInt(e.target.value))}
                          className="p-1 text-[10px] border-2 border-amber-400 rounded-lg bg-amber-50 dark:bg-gray-700 dark:border-amber-500 focus:ring-amber-500 max-w-[120px] font-bold"
                        >
                          <option value="0">---</option>
                          {users.filter(u => u.role === UserRole.TEACHER).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      );
                    } else if (isEditable && h.key === 'attendance') {
                      const currentVal = draft.attendance !== undefined ? draft.attendance : item.attendance;
                      cellContent = (
                        <select
                          value={currentVal || AttendanceStatus.PRESENT}
                          onChange={(e) => handleDraftUpdate(item.id, 'attendance', e.target.value)}
                          className="p-1 text-[10px] border-2 border-amber-400 bg-amber-50 dark:bg-gray-700 dark:border-amber-500 rounded-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        >
                          <option value={AttendanceStatus.PRESENT}>حاضر</option>
                          <option value={AttendanceStatus.LATE}>متأخر</option>
                          <option value={AttendanceStatus.ABSENT}>غائب</option>
                        </select>
                      );
                    } else if (isEditable && h.key === 'performance') {
                      const currentVal = draft.performance !== undefined ? draft.performance : item.performance;
                      cellContent = (
                        <select
                          value={currentVal || ''}
                          onChange={(e) => handleDraftUpdate(item.id, 'performance', e.target.value as any)}
                          className="p-1 text-[10px] border-2 border-amber-400 bg-amber-50 dark:bg-gray-700 dark:border-amber-500 rounded-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">—</option>
                          {performanceOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                      );
                    } else if (isEditable && h.key === 'periodicReview') {
                      const currentVal = draft.periodicReview !== undefined ? draft.periodicReview : item.periodicReview;
                      cellContent = (
                        <select
                          value={currentVal || ''}
                          onChange={(e) => handleDraftUpdate(item.id, 'periodicReview', e.target.value as any)}
                          className="p-1 text-[10px] border-2 border-amber-400 bg-amber-50 dark:bg-gray-700 dark:border-amber-500 rounded-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">—</option>
                          {periodicReviewOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                      );
                    } else if (isEditable && h.key === 'pages') {
                      const rawVal = draft.pages !== undefined ? draft.pages : item.pages;
                      const safeVal = rawVal === null || rawVal === undefined || isNaN(rawVal) ? '' : rawVal;
                      cellContent = (
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={safeVal}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          onChange={(e) => handleDraftUpdate(item.id, 'pages', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          className="w-16 p-1 text-[10px] text-center border-2 border-amber-400 bg-amber-50 dark:bg-gray-700 dark:border-amber-500 rounded-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 selection:bg-amber-300 selection:text-amber-950"
                        />
                      );
                    } else if (isEditable && h.key === 'notes') {
                      const currentVal = draft.notes !== undefined ? draft.notes : (item.notes || '');
                      cellContent = (
                        <input
                          type="text"
                          value={currentVal}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => e.currentTarget.select()}
                          onChange={(e) => handleDraftUpdate(item.id, 'notes', e.target.value)}
                          placeholder="ملاحظات..."
                          className="w-32 sm:w-44 p-1 text-[10px] border-2 border-amber-400 bg-amber-50 dark:bg-gray-700 dark:border-amber-500 rounded-lg font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 selection:bg-amber-300 selection:text-amber-950"
                        />
                      );
                    } else if (h.key === 'evaluationDate') {
                      cellContent = (
                         <div className="flex flex-col items-center justify-center w-full mx-auto">
                             {(() => {
                                 const dual = getDualDate(item.evaluationDate, hijriAdjustments);
                                 return dual ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                          <span className="font-extrabold text-green-700 dark:text-green-400 text-[11px] leading-tight">{dual.hijri}</span>
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
                      cellContent = renderCell(draft[h.key as keyof Evaluation] ?? item[h.key], h.type);
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
                            <button onClick={() => handleEdit(item)} disabled={isQuickEditActive} className={`p-1.5 rounded-lg transition-colors ${isQuickEditActive ? 'text-gray-300 opacity-50' : 'text-blue-600 hover:bg-blue-50 border border-blue-100'}`} title="تعديل"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                            <button onClick={() => handleDelete(item.id)} disabled={item.attendance === NOT_RECORDED || isQuickEditActive} className={`p-1.5 rounded-lg transition-colors ${item.attendance === NOT_RECORDED || isQuickEditActive ? 'text-gray-300 opacity-50' : 'text-red-600 hover:bg-red-50 border border-red-100'}`} title="حذف"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                        </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
