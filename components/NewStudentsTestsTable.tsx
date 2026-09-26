import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { NewStudentTest, Halaqa } from '../types';
import { isSmartMatch, formatWhatsAppNumber } from '../utils/searchUtils';
import { parseSafeNumber, safeNumberVal } from '../utils/juzUtils';
import NewStudentTestForm from './NewStudentTestForm';
import * as XLSX from 'xlsx';
import { exportToWord } from '../utils/exportWord';
import { exportToExcel as exportToExcelFile } from '../utils/exportExcel';
import { exportToPdf, sharePdfDirectly } from '../utils/exportPdf';
import { WordExportModal } from './WordExportModal';
import { ExcelExportModal } from './ExcelExportModal';
import { FilterItem } from './FilterItem';
import { compareReportRows } from '../utils/reportSortUtils';

interface ColumnDef {
  key: string;
  label: string;
}

const ALL_NEW_STUDENT_COLUMNS: ColumnDef[] = [
  { key: 'sequence', label: 'م' },
  { key: 'studentName', label: 'اسم الطالب' },
  { key: 'isAlAmeenStr', label: 'من الأمين؟' },
  { key: 'isFromIbriStr', label: 'من جامع عبري؟' },
  { key: 'grade', label: 'الصف / المرحلة' },
  { key: 'parentPhone', label: 'رقم ولي الأمر' },
  { key: 'teacherName', label: 'المعلم المختبر' },
  { key: 'testDate', label: 'تاريخ الاختبار' },
  { key: 'fathErrors', label: 'الفتح' },
  { key: 'tashkeelErrors', label: 'التشكيل' },
  { key: 'tajweedErrors', label: 'التجويد' },
  { key: 'score', label: 'الدرجة' },
  { key: 'percentage', label: 'النسبة' },
  { key: 'isPassed', label: 'الاجتياز' },
  { key: 'notes', label: 'الملاحظات' },
  { key: 'status', label: 'القرار والقبول' },
  { key: 'actions', label: 'إجراءات' },
];

const LOCAL_STORAGE_KEY_COLUMNS = 'hafiz_new_students_tests_columns_keys';
const LOCAL_STORAGE_KEY_ORDER = 'hafiz_new_students_tests_columns_order';

export const NewStudentsTestsTable: React.FC = () => {
  const context = useContext(AppContext);

  const newStudentTests = context?.newStudentTests || [];
  const students = context?.students || [];
  const halaqas = context?.halaqas || [];
  const users = context?.users || [];
  const currentUser = context?.currentUser;
  const showToast = context?.showToast || (() => {});
  const hijriAdjustments = context?.hijriAdjustments || {};

  const isNewStudentTestActive = context?.isNewStudentTestActive ?? false;
  const setIsNewStudentTestActive = context?.setIsNewStudentTestActive || (() => {});
  const newStudentTestScore = context?.newStudentTestScore ?? 100;
  const setNewStudentTestScore = context?.setNewStudentTestScore || (() => {});
  const newStudentPassingRate = context?.newStudentPassingRate ?? 70;
  const setNewStudentPassingRate = context?.setNewStudentPassingRate || (() => {});
  const newStudentTestDeductions = context?.newStudentTestDeductions ?? { fath: 1, tashkeel: 1, tajweed: 0.5 };
  const setNewStudentTestDeductions = context?.setNewStudentTestDeductions || (() => {});

  const acceptNewStudent = context?.acceptNewStudent || (() => {});
  const rejectNewStudent = context?.rejectNewStudent || (() => {});
  const deleteNewStudentTest = context?.deleteNewStudentTest || (() => {});
  const deleteAllNewStudentTests = context?.deleteAllNewStudentTests;
  const updateNewStudentTest = context?.updateNewStudentTest || (() => {});

  // Helper to find accepted student object for a test
  const getAcceptedStudent = (test: NewStudentTest) => {
    if (test.createdStudentId) {
      const found = students.find(s => s.id === test.createdStudentId);
      if (found) return found;
    }
    const cleanTestName = test.studentName.trim().replace(/\s+/g, ' ').toLowerCase();
    const foundByName = students.find(s => s.name.trim().replace(/\s+/g, ' ').toLowerCase() === cleanTestName);
    if (foundByName) return foundByName;
    return null;
  };

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentNames, setSelectedStudentNames] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [passFilter, setPassFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [alAmeenFilter, setAlAmeenFilter] = useState<'all' | 'yes' | 'no' | 'na'>('all');
  const [ibriFilter, setIbriFilter] = useState<'all' | 'yes' | 'no' | 'na'>('all');

  // Student filter options from tests list
  const studentOptions = useMemo(() => {
    const uniqueNames = new Set<string>();
    const list: { id: string; name: string }[] = [];

    newStudentTests.forEach(test => {
      const name = (test.studentName || '').trim();
      if (name && !uniqueNames.has(name)) {
        uniqueNames.add(name);
        list.push({ id: name, name });
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [newStudentTests]);

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTestFormModal, setShowTestFormModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [acceptingStudent, setAcceptingStudent] = useState<NewStudentTest | null>(null);
  const [deletingTest, setDeletingTest] = useState<NewStudentTest | null>(null);
  const [selectedHalaqaId, setSelectedHalaqaId] = useState<number>(0);

  // Column Picker state & persistence
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_COLUMNS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return ALL_NEW_STUDENT_COLUMNS.map(c => c.key);
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ORDER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return ALL_NEW_STUDENT_COLUMNS.map(c => c.key);
  });

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_COLUMNS, JSON.stringify(selectedColumnKeys));
    } catch (e) {
      console.error(e);
    }
  }, [selectedColumnKeys]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ORDER, JSON.stringify(columnOrder));
    } catch (e) {
      console.error(e);
    }
  }, [columnOrder]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const moveColumn = (key: string, direction: 'up' | 'down') => {
    const currentOrder = columnOrder.length > 0 ? [...columnOrder] : ALL_NEW_STUDENT_COLUMNS.map(c => c.key);
    const middleKeys = currentOrder.filter(k => k !== 'sequence' && k !== 'actions');
    const index = middleKeys.indexOf(key);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = middleKeys[index];
      middleKeys[index] = middleKeys[index - 1];
      middleKeys[index - 1] = temp;
    } else if (direction === 'down' && index < middleKeys.length - 1) {
      const temp = middleKeys[index];
      middleKeys[index] = middleKeys[index + 1];
      middleKeys[index + 1] = temp;
    }

    const newOrder = ['sequence', ...middleKeys, 'actions'];
    setColumnOrder(newOrder);
  };

  const visibleColumns = useMemo(() => {
    const order = columnOrder.length > 0 ? columnOrder : ALL_NEW_STUDENT_COLUMNS.map(c => c.key);
    return order
      .filter(k => selectedColumnKeys.includes(k))
      .map(k => ALL_NEW_STUDENT_COLUMNS.find(c => c.key === k)!)
      .filter(Boolean);
  }, [columnOrder, selectedColumnKeys]);

  const scrollTable = (direction: 'right' | 'left') => {
    if (tableScrollRef.current) {
      const delta = direction === 'right' ? 300 : -300;
      tableScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  // Export Modals state
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Settings inputs for the modal
  const [settingsActive, setSettingsActive] = useState(isNewStudentTestActive);
  const [settingsScore, setSettingsScore] = useState(newStudentTestScore);
  const [settingsRate, setSettingsRate] = useState(newStudentPassingRate);
  const [settingsDeductions, setSettingsDeductions] = useState(newStudentTestDeductions);

  // Sync settings inputs when opening modal
  const openSettingsModal = () => {
    setSettingsActive(isNewStudentTestActive);
    setSettingsScore(newStudentTestScore);
    setSettingsRate(newStudentPassingRate);
    setSettingsDeductions(newStudentTestDeductions);
    setShowSettingsModal(true);
  };

  const handleSaveSettings = () => {
    setIsNewStudentTestActive(settingsActive);
    setNewStudentTestScore(Number(settingsScore));
    setNewStudentPassingRate(Number(settingsRate));
    setNewStudentTestDeductions(settingsDeductions);
    setShowSettingsModal(false);
    showToast('✅ تم حفظ إعدادات اختبار قبول الطلاب الجدد بنجاح.', 'success');
  };

  // Stats
  const stats = useMemo(() => {
    const total = newStudentTests.length;
    const accepted = newStudentTests.filter(t => t.status === 'accepted').length;
    const rejected = newStudentTests.filter(t => t.status === 'rejected').length;
    const pending = newStudentTests.filter(t => !t.status || t.status === 'pending').length;
    const passedRateCount = newStudentTests.filter(t => t.isPassed).length;
    return { total, accepted, rejected, pending, passedRateCount };
  }, [newStudentTests]);

  // Filtered list
  const filteredTests = useMemo(() => {
    return newStudentTests.filter(test => {
      const acceptedStudent = getAcceptedStudent(test);

      // Search match
      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        const matchesName = isSmartMatch(test.studentName, term);
        const matchesGrade = isSmartMatch(test.grade || '', term);
        const matchesPhone = test.parentPhone?.includes(term);
        const matchesTeacher = isSmartMatch(test.teacherName || '', term);
        const matchesAlAmeen = acceptedStudent?.isAlAmeen && (isSmartMatch('من طلاب الأمين', term) || isSmartMatch('الأمين', term));
        const matchesIbri = (acceptedStudent && acceptedStudent.isFromIbri !== false) && (isSmartMatch('من جامع عبري', term) || isSmartMatch('عبري', term));

        if (!matchesName && !matchesGrade && !matchesPhone && !matchesTeacher && !matchesAlAmeen && !matchesIbri) {
          return false;
        }
      }

      // Student filter (FilterItem)
      if (selectedStudentNames.length > 0 && !selectedStudentNames.includes('all') && !selectedStudentNames.includes('ALL')) {
        const sName = (test.studentName || '').trim();
        if (!selectedStudentNames.includes(sName)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        const st = test.status || 'pending';
        if (st !== statusFilter) return false;
      }

      // Passing rate filter
      if (passFilter === 'passed' && !test.isPassed) return false;
      if (passFilter === 'failed' && test.isPassed) return false;

      // Al-Ameen filter: 'all' | 'yes' | 'no' | 'na'
      if (alAmeenFilter !== 'all') {
        if (alAmeenFilter === 'yes') {
          if (!acceptedStudent || !acceptedStudent.isAlAmeen) return false;
        } else if (alAmeenFilter === 'no') {
          if (!acceptedStudent || acceptedStudent.isAlAmeen) return false;
        } else if (alAmeenFilter === 'na') {
          if (acceptedStudent) return false;
        }
      }

      // Ibri Mosque filter: 'all' | 'yes' | 'no' | 'na'
      if (ibriFilter !== 'all') {
        if (ibriFilter === 'yes') {
          if (!acceptedStudent || acceptedStudent.isFromIbri === false) return false;
        } else if (ibriFilter === 'no') {
          if (!acceptedStudent || acceptedStudent.isFromIbri !== false) return false;
        } else if (ibriFilter === 'na') {
          if (acceptedStudent) return false;
        }
      }

      return true;
    });
  }, [newStudentTests, searchTerm, selectedStudentNames, statusFilter, passFilter, alAmeenFilter, ibriFilter, students]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  const sortedTests = useMemo(() => {
    let list = [...filteredTests];
    if (sortConfig) {
      list.sort((a, b) => {
        const accA = getAcceptedStudent(a);
        const accB = getAcceptedStudent(b);
        const itemA = {
          ...a,
          isAlAmeenStr: accA?.isAlAmeen ? 'نعم' : 'لا',
          isFromIbriStr: (accA && accA.isFromIbri !== false) ? 'نعم' : 'لا',
        };
        const itemB = {
          ...b,
          isAlAmeenStr: accB?.isAlAmeen ? 'نعم' : 'لا',
          isFromIbriStr: (accB && accB.isFromIbri !== false) ? 'نعم' : 'لا',
        };
        return compareReportRows(itemA, itemB, sortConfig.key, sortConfig.direction);
      });
    }
    return list;
  }, [filteredTests, sortConfig, students]);

  // Confirmation of acceptance
  const confirmAcceptStudent = () => {
    if (!acceptingStudent) return;
    acceptNewStudent(acceptingStudent.id, selectedHalaqaId);
    setAcceptingStudent(null);
    setSelectedHalaqaId(0);
  };

  // Export Headers and Formatted Data
  const exportHeaders = useMemo(() => {
    return visibleColumns
      .filter(c => c.key !== 'actions')
      .map(c => ({
        key: c.key === 'isPassed' ? 'isPassedText' : c.key === 'status' ? 'statusText' : c.key,
        label: c.label === 'م' ? '#' : c.label,
      }));
  }, [visibleColumns]);

  const exportData = useMemo(() => {
    return sortedTests.map((t, idx) => {
      const row: Record<string, any> = {};
      const acceptedStudent = getAcceptedStudent(t);

      visibleColumns.forEach(c => {
        switch (c.key) {
          case 'sequence':
            row.sequence = idx + 1;
            break;
          case 'studentName': {
            let nameStr = t.studentName;
            if (acceptedStudent) {
              const tags: string[] = [];
              if (acceptedStudent.isAlAmeen) tags.push('(من طلاب الأمين)');
              if (acceptedStudent.isFromIbri !== false) tags.push('(من جامع عبري)');
              if (tags.length > 0) nameStr += ` ${tags.join(' ')}`;
            }
            row.studentName = nameStr;
            break;
          }
          case 'isAlAmeenStr':
            row.isAlAmeenStr = acceptedStudent ? (acceptedStudent.isAlAmeen ? 'نعم' : 'لا') : '—';
            break;
          case 'isFromIbriStr':
            row.isFromIbriStr = acceptedStudent ? (acceptedStudent.isFromIbri !== false ? 'نعم' : 'لا') : '—';
            break;
          case 'grade':
            row.grade = t.grade || '—';
            break;
          case 'parentPhone':
            row.parentPhone = t.parentPhone || '—';
            break;
          case 'teacherName':
            row.teacherName = t.teacherName || '—';
            break;
          case 'testDate':
            row.testDate = t.testDate;
            break;
          case 'fathErrors':
            row.fathErrors = t.fathErrors ?? 0;
            break;
          case 'tashkeelErrors':
            row.tashkeelErrors = t.tashkeelErrors ?? 0;
            break;
          case 'tajweedErrors':
            row.tajweedErrors = t.tajweedErrors ?? 0;
            break;
          case 'score':
            row.score = `${t.score} / ${t.maxScore}`;
            break;
          case 'percentage':
            row.percentage = `${t.percentage}%`;
            break;
          case 'isPassed':
            row.isPassedText = t.isPassed ? 'محقق' : 'غير محقق';
            break;
          case 'notes':
            row.notes = t.notes || '—';
            break;
          case 'status':
            row.statusText = t.status === 'accepted' ? 'مقبول' : t.status === 'rejected' ? 'غير مقبول' : 'قيد الانتظار';
            break;
        }
      });
      return row;
    });
  }, [filteredTests, visibleColumns, students]);

  const exportHeaderInfo = useMemo(() => {
    const statusLabel = statusFilter === 'accepted' ? 'المقبولين' : statusFilter === 'rejected' ? 'غير المقبولين' : statusFilter === 'pending' ? 'قيد الانتظار' : 'جميع الحالات';
    const alAmeenLabel = alAmeenFilter === 'yes' ? ' - طلاب الأمين' : alAmeenFilter === 'no' ? ' - ليسوا من الأمين' : alAmeenFilter === 'na' ? ' - الأمين: لا ينطبق' : '';
    const ibriLabel = ibriFilter === 'yes' ? ' - جامع عبري' : ibriFilter === 'no' ? ' - ليسوا من جامع عبري' : ibriFilter === 'na' ? ' - جامع عبري: لا ينطبق' : '';
    return {
      title: 'تقرير نتائج اختبارات قبول الطلاب الجدد',
      fileName: `نتائج_اختبارات_الطلاب_الجدد_${new Date().toISOString().split('T')[0]}`,
      subtitle: `إجمالي السجلات: ${filteredTests.length} (${statusLabel}${alAmeenLabel}${ibriLabel})`,
    };
  }, [filteredTests.length, statusFilter, alAmeenFilter, ibriFilter]);

  // Export to Excel
  const exportToExcel = () => {
    if (filteredTests.length === 0) {
      showToast('⚠️ لا توجد بيانات لتصديرها.', 'info');
      return;
    }

    const exportCols = visibleColumns.filter(c => c.key !== 'actions');
    const headers = exportCols.map(c => c.label === 'م' ? '#' : c.label);

    const rows = filteredTests.map((t, idx) => {
      const acceptedStudent = getAcceptedStudent(t);

      return exportCols.map(c => {
        switch (c.key) {
          case 'sequence': return idx + 1;
          case 'studentName': {
            let nameStr = t.studentName;
            if (acceptedStudent) {
              const tags: string[] = [];
              if (acceptedStudent.isAlAmeen) tags.push('(من طلاب الأمين)');
              if (acceptedStudent.isFromIbri !== false) tags.push('(من جامع عبري)');
              if (tags.length > 0) nameStr += ` ${tags.join(' ')}`;
            }
            return nameStr;
          }
          case 'isAlAmeenStr': return acceptedStudent ? (acceptedStudent.isAlAmeen ? 'نعم' : 'لا') : '—';
          case 'isFromIbriStr': return acceptedStudent ? (acceptedStudent.isFromIbri !== false ? 'نعم' : 'لا') : '—';
          case 'grade': return t.grade || '';
          case 'parentPhone': return t.parentPhone || '';
          case 'teacherName': return t.teacherName || '';
          case 'testDate': return t.testDate;
          case 'fathErrors': return t.fathErrors ?? 0;
          case 'tashkeelErrors': return t.tashkeelErrors ?? 0;
          case 'tajweedErrors': return t.tajweedErrors ?? 0;
          case 'score': return `${t.score} / ${t.maxScore}`;
          case 'percentage': return `${t.percentage}%`;
          case 'isPassed': return t.isPassed ? 'نعم' : 'لا';
          case 'status': return t.status === 'accepted' ? 'مقبول' : t.status === 'rejected' ? 'غير مقبول' : 'قيد الانتظار';
          case 'notes': return t.notes || '';
          default: return '';
        }
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نتائج قبول الطلاب الجدد');
    XLSX.writeFile(workbook, `نتائج_اختبارات_الطلاب_الجدد_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('📊 تم تصدير البيانات إلى Excel بنجاح.', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Quick Controls */}
      <div className="bg-gradient-to-l from-indigo-50/80 via-white to-slate-50 dark:from-indigo-950/50 dark:via-gray-800 dark:to-gray-800 rounded-3xl p-5 sm:p-7 text-gray-900 dark:text-white shadow-sm dark:shadow-xl border border-indigo-100/90 dark:border-gray-700 transition-colors duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🎓</span>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">اختبارات قبول الطلاب الجدد</h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed max-w-2xl">
              إدارة ومتابعة درجات اختبار الطلاب الجدد المتقدمين للالتحاق بالحلقات، واعتماد قبولهم لإدراجهم مباشرة في قائمة طلاب التطبيق.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Quick Toggle Status */}
            <button
              onClick={() => {
                const nextState = !isNewStudentTestActive;
                setIsNewStudentTestActive(nextState);
                showToast(
                  nextState
                    ? '✅ تم تفعيل اختبار قبول الطلاب الجدد للمعلمين.'
                    : '⏸️ تم إيقاف اختبار قبول الطلاب الجدد للمعلمين.',
                  'info'
                );
              }}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
                isNewStudentTestActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${isNewStudentTestActive ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></span>
              <span>{isNewStudentTestActive ? 'الاختبار مفعل للمعلمين' : 'الاختبار معطل'}</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={openSettingsModal}
              className="px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-650 text-gray-800 dark:text-white text-xs font-black rounded-2xl border border-gray-200 dark:border-gray-600 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>⚙️</span>
              <span>إعدادات اختبار القبول</span>
            </button>

            {/* Test New Student Direct Button */}
            <button
              onClick={() => setShowTestFormModal(true)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>➕</span>
              <span>اختبار طالب جديد</span>
            </button>

            {/* Clear/Delete All Data Button */}
            <button
              onClick={() => setShowDeleteAllModal(true)}
              disabled={newStudentTests.length === 0}
              title={newStudentTests.length === 0 ? 'التقرير فارغ حالياً' : 'حذف جميع بيانات التقرير بتأكيد منبثق'}
              className={`px-4 py-2.5 text-xs font-black rounded-2xl transition-all flex items-center gap-1.5 shadow-xs ${
                newStudentTests.length === 0
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white border border-red-200/80 dark:border-red-800/60 cursor-pointer active:scale-95'
              }`}
            >
              <span>🗑️</span>
              <span>حذف جميع البيانات</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mt-6 pt-5 border-t border-gray-200/80 dark:border-gray-700">
          <div className="bg-indigo-50/80 dark:bg-gray-700/60 rounded-2xl p-3 text-center border border-indigo-100/90 dark:border-gray-600/60 shadow-xs">
            <span className="block text-[11px] font-bold text-indigo-700 dark:text-indigo-300">إجمالي المختبرين</span>
            <span className="text-xl sm:text-2xl font-black text-indigo-950 dark:text-white">{stats.total}</span>
          </div>

          <div className="bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl p-3 text-center border border-emerald-100 dark:border-emerald-800/40 shadow-xs">
            <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-300">المقبولون</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-400">{stats.accepted}</span>
          </div>

          <div className="bg-amber-50/80 dark:bg-amber-950/40 rounded-2xl p-3 text-center border border-amber-100 dark:border-amber-800/40 shadow-xs">
            <span className="block text-[11px] font-bold text-amber-700 dark:text-amber-300">قيد الانتظار</span>
            <span className="text-xl sm:text-2xl font-black text-amber-800 dark:text-amber-400">{stats.pending}</span>
          </div>

          <div className="bg-red-50/80 dark:bg-red-950/40 rounded-2xl p-3 text-center border border-red-100 dark:border-red-800/40 shadow-xs">
            <span className="block text-[11px] font-bold text-red-700 dark:text-red-300">غير المقبولين</span>
            <span className="text-xl sm:text-2xl font-black text-red-800 dark:text-red-400">{stats.rejected}</span>
          </div>

          <div className="bg-blue-50/80 dark:bg-blue-950/40 rounded-2xl p-3 text-center border border-blue-100 dark:border-blue-800/40 shadow-xs">
            <span className="block text-[11px] font-bold text-blue-700 dark:text-blue-300">السجلات المفلترة</span>
            <span className="text-xl sm:text-2xl font-black text-blue-900 dark:text-blue-300">{filteredTests.length}</span>
          </div>

          <div className="bg-indigo-50/80 dark:bg-gray-700/60 rounded-2xl p-3 text-center border border-indigo-100/90 dark:border-gray-600/60 shadow-xs col-span-2 sm:col-span-1">
            <span className="block text-[11px] font-bold text-indigo-700 dark:text-indigo-300">نسبة القبول</span>
            <span className="text-xl sm:text-2xl font-black text-indigo-950 dark:text-white">{newStudentPassingRate}%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search & Student Filter dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-1 max-w-2xl">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="بحث بالاسم، الصف، الهاتف، أو المعلم..."
                className="w-full pl-4 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-indigo-500"
              />
              <span className="absolute right-3.5 top-3 text-gray-400">🔍</span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute left-3 top-2.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Student Filter dropdown */}
            <div className="w-full sm:w-56">
              <FilterItem
                id="newStudent"
                title="الطالب"
                selectedValues={selectedStudentNames}
                options={studentOptions}
                onSelect={setSelectedStudentNames}
                search={studentSearch}
                setSearch={setStudentSearch}
                openDropdown={openDropdown}
                setOpenDropdown={setOpenDropdown}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                الكل ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-white dark:bg-gray-800 text-amber-600 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                قيد الانتظار ({stats.pending})
              </button>
              <button
                onClick={() => setStatusFilter('accepted')}
                className={`px-3 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'accepted'
                    ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                المقبولون ({stats.accepted})
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'rejected'
                    ? 'bg-white dark:bg-gray-800 text-red-600 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                غير المقبولين ({stats.rejected})
              </button>
            </div>

            {/* Al-Ameen Filter */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl text-xs">
              <span className="text-[11px] font-black text-gray-600 dark:text-gray-300 px-2 whitespace-nowrap">
                من الأمين؟:
              </span>
              <button
                type="button"
                onClick={() => setAlAmeenFilter('all')}
                className={`px-2.5 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  alAmeenFilter === 'all'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setAlAmeenFilter('yes')}
                className={`px-2.5 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  alAmeenFilter === 'yes'
                    ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                نعم
              </button>
              <button
                type="button"
                onClick={() => setAlAmeenFilter('no')}
                className={`px-2.5 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  alAmeenFilter === 'no'
                    ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                لا
              </button>
              <button
                type="button"
                onClick={() => setAlAmeenFilter('na')}
                className={`px-2.5 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  alAmeenFilter === 'na'
                    ? 'bg-white dark:bg-gray-800 text-amber-600 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                لا ينطبق
              </button>
            </div>

            {/* Ibri Mosque Filter */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl text-xs">
              <span className="text-[11px] font-black text-gray-600 dark:text-gray-300 px-2 whitespace-nowrap">
                من جامع عبري؟:
              </span>
              <button
                type="button"
                onClick={() => setIbriFilter('all')}
                className={`px-2.5 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  ibriFilter === 'all'
                    ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setIbriFilter('yes')}
                className={`px-2.5 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  ibriFilter === 'yes'
                    ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                نعم
              </button>
              <button
                type="button"
                onClick={() => setIbriFilter('no')}
                className={`px-2.5 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  ibriFilter === 'no'
                    ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                لا
              </button>
              <button
                type="button"
                onClick={() => setIbriFilter('na')}
                className={`px-2.5 py-1.5 font-black rounded-lg transition-all cursor-pointer ${
                  ibriFilter === 'na'
                    ? 'bg-white dark:bg-gray-800 text-amber-600 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                لا ينطبق
              </button>
            </div>

            {/* Pass/Fail Filter */}
            <select
              value={passFilter}
              onChange={e => setPassFilter(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 outline-none cursor-pointer"
            >
              <option value="all">جميع النتائج</option>
              <option value="passed">محقق لنسبة القبول ({newStudentPassingRate}%+)</option>
              <option value="failed">دون نسبة القبول (&lt;{newStudentPassingRate}%)</option>
            </select>
          </div>
        </div>

        {/* Clear all filters bar if active */}
        {((selectedStudentNames.length > 0 && !selectedStudentNames.includes('all') && !selectedStudentNames.includes('ALL')) || statusFilter !== 'all' || passFilter !== 'all' || alAmeenFilter !== 'all' || ibriFilter !== 'all' || searchTerm.trim() !== '') && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
            <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold">
              <span>🎯</span>
              <span>تم تصفية {filteredTests.length} من أصل {newStudentTests.length} طالب</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedStudentNames([]);
                setSearchTerm('');
                setStatusFilter('all');
                setPassFilter('all');
                setAlAmeenFilter('all');
                setIbriFilter('all');
              }}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
            >
              <span>✕</span>
              <span>إلغاء التصفية وإظهار الكل</span>
            </button>
          </div>
        )}
      </div>

      {/* Export Action Buttons & Total Records Counter */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-2 no-print">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setIsExcelModalOpen(true)}
            className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
            title="تصدير ملف Excel"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => setIsWordModalOpen(true)}
            className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
            title="تصدير ملف Word"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span>Word</span>
          </button>
          <button
            type="button"
            onClick={() => exportToPdf(exportHeaders, exportData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments)}
            className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs active:scale-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
            title="طباعة وتصدير ملف PDF"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>طباعة</span>
          </button>
          <button
            type="button"
            onClick={() => sharePdfDirectly(exportHeaders, exportData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, undefined, undefined, "landscape")}
            className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs active:scale-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
            title="مشاركة تقرير PDF"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>مشاركة PDF</span>
          </button>

          {/* زر الأعمدة */}
          <div ref={columnPickerRef} className="relative inline-block text-right shrink-0">
            <button
              type="button"
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="px-2.5 sm:px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-xl shadow-xs flex items-center justify-center gap-1.5 hover:bg-gray-200 dark:hover:bg-gray-650 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <span>الأعمدة</span>
            </button>

            {showColumnPicker && (
              <>
                <div
                  className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[65] sm:hidden"
                  onClick={() => setShowColumnPicker(false)}
                />
                <div className="fixed sm:absolute z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0 sm:top-full sm:left-auto sm:right-0 sm:mt-2 w-[92vw] max-w-sm sm:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-fade-in ring-1 ring-black/10 text-right">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b dark:border-gray-700">
                    <span className="text-xs font-black text-green-800 dark:text-green-400 flex items-center gap-1.5">
                      <span>📊</span>
                      <span>تخصيص وترتيب الأعمدة</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowColumnPicker(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex gap-2 mb-2 pb-2 border-b dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setSelectedColumnKeys(ALL_NEW_STUDENT_COLUMNS.map(h => h.key))}
                      className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex-1 text-center bg-blue-50 dark:bg-blue-900/30 py-1.5 rounded-lg cursor-pointer"
                    >
                      إظهار الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedColumnKeys(['sequence', 'studentName'])}
                      className="text-[11px] text-red-600 dark:text-red-400 font-bold hover:underline flex-1 text-center bg-red-50 dark:bg-red-900/30 py-1.5 rounded-lg cursor-pointer"
                    >
                      إخفاء الاختياري
                    </button>
                  </div>

                  <div className="max-h-[50vh] sm:max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-1 divide-y divide-gray-100 dark:divide-gray-700/40">
                    {(columnOrder.length > 0 ? columnOrder : ALL_NEW_STUDENT_COLUMNS.map(h => h.key)).map(key => {
                      const h = ALL_NEW_STUDENT_COLUMNS.find(item => item.key === key);
                      if (!h) return null;
                      const isChecked = selectedColumnKeys.includes(h.key);
                      const currentOrder = columnOrder.length > 0 ? columnOrder : ALL_NEW_STUDENT_COLUMNS.map(item => item.key);
                      const middleKeys = currentOrder.filter(k => k !== 'sequence' && k !== 'actions');
                      const middleIdx = middleKeys.indexOf(h.key);
                      const isFirstMiddle = middleIdx === 0;
                      const isLastMiddle = middleIdx === middleKeys.length - 1;

                      return (
                        <div key={h.key} className="flex items-center justify-between gap-3 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl group transition-colors">
                          <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                setSelectedColumnKeys(prev =>
                                  isChecked ? prev.filter(k => k !== h.key) : [...prev, h.key]
                                )
                              }
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
                          ) : h.key === 'actions' ? (
                            <span className="text-[10px] sm:text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 font-bold px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800 whitespace-nowrap flex-shrink-0">
                              الأخير دائماً
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                disabled={isFirstMiddle}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  moveColumn(h.key, 'up');
                                }}
                                className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs cursor-pointer"
                                title="تقديم للأعلى"
                                aria-label="تقديم للأعلى"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={isLastMiddle}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  moveColumn(h.key, 'down');
                                }}
                                className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs cursor-pointer"
                                title="تأخير للأسفل"
                                aria-label="تأخير للأسفل"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scroll helper and Total Records Counter */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-gray-50 dark:bg-gray-750 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-bold">تمرير الجدول:</span>
            <button
              type="button"
              onClick={() => scrollTable('right')}
              className="p-1 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 border border-gray-200 dark:border-gray-600 cursor-pointer shadow-2xs"
              title="تمرير لليمين"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollTable('left')}
              className="p-1 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 border border-gray-200 dark:border-gray-600 cursor-pointer shadow-2xs"
              title="تمرير لليسار"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-xs">
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
              إجمالي السجلات:
            </span>
            <span className="text-lg font-black text-indigo-900 dark:text-white">
              {filteredTests.length}
            </span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {filteredTests.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <span className="text-4xl">📭</span>
            <h3 className="text-base font-black text-gray-700 dark:text-gray-300">
              لا توجد اختبارات لطلاب جدد تطابق التصفية الحالية
            </h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              عندما يقوم أي معلم باختبار طالب جديد أثناء تفعيل الاختبار، ستظهر درجاته وبياناته هنا لاعتماد قبوله.
            </p>
            <button
              onClick={() => setShowTestFormModal(true)}
              className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-sm"
            >
              + إجراء اختبار لطالب جديد الآن
            </button>
          </div>
        ) : (
          <div ref={tableScrollRef} className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-750/50 border-b border-gray-200 dark:border-gray-700 text-xs sm:text-sm font-black text-gray-700 dark:text-gray-300">
                  {visibleColumns.map(col => {
                    const isSorted = sortConfig?.key === col.key;
                    const arrow = isSorted ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : '';
                    const handleHeaderClick = () => {
                      if (col.key === 'actions') return;
                      setSortConfig(prev => {
                        if (prev?.key === col.key) {
                          return { key: col.key, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' };
                        }
                        return { key: col.key, direction: 'ascending' };
                      });
                    };

                    const isAction = col.key === 'actions';
                    const baseCls = `py-3.5 px-3.5 ${isAction ? 'text-center' : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 select-none transition-colors'}`;

                    switch (col.key) {
                      case 'sequence':
                        return <th key="sequence" onClick={handleHeaderClick} className={`${baseCls} w-10 text-center`}>م{arrow}</th>;
                      case 'studentName':
                        return <th key="studentName" onClick={handleHeaderClick} className={`${baseCls} px-4`}>اسم الطالب{arrow}</th>;
                      case 'isAlAmeenStr':
                        return <th key="isAlAmeenStr" onClick={handleHeaderClick} className={`${baseCls} text-center`}>من الأمين؟{arrow}</th>;
                      case 'isFromIbriStr':
                        return <th key="isFromIbriStr" onClick={handleHeaderClick} className={`${baseCls} text-center`}>من جامع عبري؟{arrow}</th>;
                      case 'grade':
                        return <th key="grade" onClick={handleHeaderClick} className={baseCls}>الصف / المرحلة{arrow}</th>;
                      case 'parentPhone':
                        return <th key="parentPhone" onClick={handleHeaderClick} className={baseCls}>رقم ولي الأمر{arrow}</th>;
                      case 'teacherName':
                        return <th key="teacherName" onClick={handleHeaderClick} className={baseCls}>المعلم المختبر{arrow}</th>;
                      case 'testDate':
                        return <th key="testDate" onClick={handleHeaderClick} className={baseCls}>تاريخ الاختبار{arrow}</th>;
                      case 'fathErrors':
                        return <th key="fathErrors" onClick={handleHeaderClick} className={`${baseCls} px-2 text-center text-red-600 dark:text-red-400 font-black`}>الفتح{arrow}</th>;
                      case 'tashkeelErrors':
                        return <th key="tashkeelErrors" onClick={handleHeaderClick} className={`${baseCls} px-2 text-center text-amber-600 dark:text-amber-400 font-black`}>التشكيل{arrow}</th>;
                      case 'tajweedErrors':
                        return <th key="tajweedErrors" onClick={handleHeaderClick} className={`${baseCls} px-2 text-center text-teal-600 dark:text-teal-400 font-black`}>التجويد{arrow}</th>;
                      case 'score':
                        return <th key="score" onClick={handleHeaderClick} className={`${baseCls} text-center`}>الدرجة{arrow}</th>;
                      case 'percentage':
                        return <th key="percentage" onClick={handleHeaderClick} className={`${baseCls} text-center`}>النسبة{arrow}</th>;
                      case 'isPassed':
                        return <th key="isPassed" onClick={handleHeaderClick} className={`${baseCls} text-center`}>الاجتياز{arrow}</th>;
                      case 'notes':
                        return <th key="notes" onClick={handleHeaderClick} className={`${baseCls} px-4`}>الملاحظات{arrow}</th>;
                      case 'status':
                        return <th key="status" onClick={handleHeaderClick} className={`${baseCls} px-4 text-center`}>القرار والقبول{arrow}</th>;
                      case 'actions':
                        return <th key="actions" className="py-3.5 px-3.5 text-center">إجراءات</th>;
                      default:
                        return <th key={col.key} onClick={handleHeaderClick} className={baseCls}>{col.label}{arrow}</th>;
                    }
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs sm:text-sm">
                {sortedTests.map((test, index) => {
                  const isAccepted = test.status === 'accepted';
                  const isRejected = test.status === 'rejected';
                  const acceptedStudent = getAcceptedStudent(test);

                  return (
                    <tr
                      key={test.id}
                      className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 transition-colors ${
                        isAccepted ? 'bg-emerald-50/20 dark:bg-emerald-950/5' : ''
                      }`}
                    >
                      {visibleColumns.map(col => {
                        switch (col.key) {
                          case 'sequence':
                            return (
                              <td key="sequence" className="py-3.5 px-3.5 text-center font-bold text-gray-400">
                                {index + 1}
                              </td>
                            );

                          case 'studentName':
                            return (
                              <td key="studentName" className="py-3.5 px-4">
                                <div className="font-black text-xs sm:text-sm text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                  <span>{test.studentName}</span>
                                  {isAccepted && (
                                    <span className="text-emerald-600 text-xs" title="مقبول ومدرج في التطبيق">✓</span>
                                  )}
                                </div>
                                {/* Affiliation Subtitles */}
                                {acceptedStudent && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    {acceptedStudent.isAlAmeen && (
                                      <span className="text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-300 font-bold leading-tight bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800">
                                        (من طلاب الأمين)
                                      </span>
                                    )}
                                    {acceptedStudent.isFromIbri !== false && (
                                      <span className="text-[10px] sm:text-[11px] text-blue-700 dark:text-blue-300 font-bold leading-tight bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200/80 dark:border-blue-800">
                                        (من جامع عبري)
                                      </span>
                                    )}
                                  </div>
                                )}
                                {test.surahs && test.surahs.length > 0 && (
                                  <span className="text-[11px] sm:text-xs text-gray-500 block mt-0.5">
                                    سور: {test.surahs.join('، ')}
                                  </span>
                                )}
                              </td>
                            );

                          case 'isAlAmeenStr':
                            return (
                              <td key="isAlAmeenStr" className="py-3.5 px-3.5 text-center font-bold">
                                {acceptedStudent ? (
                                  acceptedStudent.isAlAmeen ? (
                                    <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-md text-xs border border-emerald-200 dark:border-emerald-800">
                                      نعم
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">لا</span>
                                  )
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">-</span>
                                )}
                              </td>
                            );

                          case 'isFromIbriStr':
                            return (
                              <td key="isFromIbriStr" className="py-3.5 px-3.5 text-center font-bold">
                                {acceptedStudent ? (
                                  acceptedStudent.isFromIbri !== false ? (
                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-md text-xs border border-blue-200 dark:border-blue-800">
                                      نعم
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">لا</span>
                                  )
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">-</span>
                                )}
                              </td>
                            );

                          case 'grade':
                            return (
                              <td key="grade" className="py-3.5 px-3.5 font-bold text-gray-700 dark:text-gray-300">
                                {test.grade ? (
                                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md text-xs">
                                    {test.grade}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">-</span>
                                )}
                              </td>
                            );

                          case 'parentPhone':
                            return (
                              <td key="parentPhone" className="py-3.5 px-3.5 font-bold">
                                {test.parentPhone ? (
                                  <div className="flex items-center gap-1.5" dir="ltr">
                                    <a
                                      href={`tel:${test.parentPhone}`}
                                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono text-xs sm:text-sm"
                                    >
                                      {test.parentPhone}
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(test.parentPhone!);
                                        showToast('📋 تم نسخ رقم الهاتف.', 'info');
                                      }}
                                      className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                                      title="نسخ الرقم"
                                    >
                                      📋
                                    </button>
                                    <a
                                      href={`https://wa.me/${formatWhatsAppNumber(test.parentPhone)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center justify-center p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md shadow-xs transition-transform hover:scale-105"
                                      title="محادثة واتساب"
                                    >
                                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                                      </svg>
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">-</span>
                                )}
                              </td>
                            );

                          case 'teacherName':
                            return (
                              <td key="teacherName" className="py-3.5 px-3.5 font-bold text-gray-700 dark:text-gray-300">
                                {test.teacherName || 'معلم'}
                              </td>
                            );

                          case 'testDate':
                            return (
                              <td key="testDate" className="py-3.5 px-3.5 font-mono text-xs text-gray-600 dark:text-gray-300">
                                {test.testDate}
                              </td>
                            );

                          case 'fathErrors':
                            return (
                              <td key="fathErrors" className="py-3.5 px-2 text-center">
                                <span className={`inline-block font-mono font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-lg ${
                                  test.fathErrors > 0 
                                    ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60' 
                                    : 'text-gray-400'
                                }`}>
                                  {test.fathErrors ?? 0}
                                </span>
                              </td>
                            );

                          case 'tashkeelErrors':
                            return (
                              <td key="tashkeelErrors" className="py-3.5 px-2 text-center">
                                <span className={`inline-block font-mono font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-lg ${
                                  test.tashkeelErrors > 0 
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60' 
                                    : 'text-gray-400'
                                }`}>
                                  {test.tashkeelErrors ?? 0}
                                </span>
                              </td>
                            );

                          case 'tajweedErrors':
                            return (
                              <td key="tajweedErrors" className="py-3.5 px-2 text-center">
                                <span className={`inline-block font-mono font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-lg ${
                                  test.tajweedErrors > 0 
                                    ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-900/60' 
                                    : 'text-gray-400'
                                }`}>
                                  {test.tajweedErrors ?? 0}
                                </span>
                              </td>
                            );

                          case 'score':
                            return (
                              <td key="score" className="py-3.5 px-3.5 text-center font-black text-gray-900 dark:text-white text-xs sm:text-sm">
                                {test.score} <span className="text-[11px] text-gray-400">/ {test.maxScore}</span>
                              </td>
                            );

                          case 'percentage':
                            return (
                              <td key="percentage" className="py-3 px-3 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black ${
                                    test.isPassed
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                                  }`}
                                >
                                  {test.percentage}%
                                </span>
                              </td>
                            );

                          case 'isPassed':
                            return (
                              <td key="isPassed" className="py-3 px-3 text-center">
                                {test.isPassed ? (
                                  <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                                    ناجح ✅
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-black text-red-500 dark:text-red-400">
                                    دون النسبة ⚠️
                                  </span>
                                )}
                              </td>
                            );

                          case 'notes':
                            return (
                              <td key="notes" className="py-3 px-4 min-w-[180px] max-w-[280px] align-top">
                                {test.notes ? (
                                  <div className="text-[11px] text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed bg-gray-50/70 dark:bg-gray-900/40 p-2 rounded-xl border border-gray-100 dark:border-gray-750">
                                    {test.notes}
                                  </div>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">-</span>
                                )}
                              </td>
                            );

                          case 'status':
                            return (
                              <td key="status" className="py-3 px-4 text-center">
                                {isAccepted ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-xs">
                                      <span>✓</span>
                                      <span>مقبول في التطبيق</span>
                                    </span>
                                    <div className="flex items-center justify-center gap-2">
                                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                                        (مدرج في قائمة الطلاب)
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => rejectNewStudent(test.id)}
                                        className="text-[10px] text-red-500 hover:underline font-bold cursor-pointer"
                                        title="إلغاء القبول وحذفه من الطلاب"
                                      >
                                        تراجع
                                      </button>
                                    </div>
                                  </div>
                                ) : isRejected ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 rounded-xl text-xs font-black">
                                      <span>✕</span>
                                      <span>غير مقبول</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setAcceptingStudent(test)}
                                      className="text-[11px] text-emerald-600 hover:underline font-bold cursor-pointer"
                                    >
                                      قبول الآن
                                    </button>
                                  </div>
                                ) : (
                                  /* Pending - Buttons for Accept / Reject */
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setAcceptingStudent(test)}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>✅</span>
                                      <span>قبول</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => rejectNewStudent(test.id)}
                                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:hover:bg-red-900/40 dark:text-red-300 font-black text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
                                    >
                                      <span>✕</span>
                                      <span>عدم قبول</span>
                                    </button>
                                  </div>
                                )}
                              </td>
                            );

                          case 'actions':
                            return (
                              <td key="actions" className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setDeletingTest(test)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors text-xs cursor-pointer"
                                  title="حذف السجل"
                                >
                                  🗑️
                                </button>
                              </td>
                            );

                          default:
                            return null;
                        }
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Acceptance Modal: assign to halaqa and confirm */}
      {acceptingStudent && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-700 space-y-5 animate-in zoom-in-95">
            <div className="text-center space-y-1">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 text-2xl shadow-inner">
                🎓
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                تأكيد قبول الطالب الجديد
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                سيتم إدراج الطالب تلقائياً في قائمة طلاب التطبيق الرسمية، ويمكنك تعديل كامل بياناته ومستواه لاحقاً من صفحة "نظرة عامة على الطلاب".
              </p>
            </div>

            {/* Student Info Card */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200/60 dark:border-gray-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-bold text-gray-500">اسم الطالب:</span>
                <span className="font-black text-gray-900 dark:text-white">{acceptingStudent.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-gray-500">الصف / المرحلة:</span>
                <span className="font-bold text-gray-700 dark:text-gray-300">{acceptingStudent.grade || 'غير محدد'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-gray-500">رقم ولي الأمر:</span>
                <span className="font-mono font-bold text-gray-700 dark:text-gray-300" dir="ltr">{acceptingStudent.parentPhone || 'غير مسجل'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                <span className="font-bold text-gray-500">نتيجة الاختبار:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {acceptingStudent.score} / {acceptingStudent.maxScore} ({acceptingStudent.percentage}%)
                </span>
              </div>
            </div>

            {/* Halaqa Assignment Option */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-gray-700 dark:text-gray-300 block">
                تسكين الطالب في حلقة (اختياري):
              </label>
              <select
                value={selectedHalaqaId}
                onChange={e => setSelectedHalaqaId(Number(e.target.value))}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500"
              >
                <option value={0}>بدون حلقة حالياً (تحديد لاحقاً من نظرة عامة)</option>
                {[...halaqas]
                  .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }))
                  .map(h => (
                    <option key={h.id} value={h.id}>
                      حلقة: {h.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={confirmAcceptStudent}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>✅</span>
                <span>تأكيد القبول وإدراج الطالب</span>
              </button>
              <button
                onClick={() => setAcceptingStudent(null)}
                className="py-3.5 px-5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-xs rounded-xl transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Distinctive Delete Confirmation Modal */}
      {deletingTest && (
        <div 
          className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog" 
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-800 rounded-[2rem] p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-700 space-y-5 animate-in zoom-in-95 overflow-hidden">
            {/* Top Icon Badge */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner ring-8 ring-red-50 dark:ring-red-950/30">
                🗑️
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                تأكيد حذف سجل الاختبار
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                هل أنت متأكد من رغبتك في حذف نتيجة اختبار هذا الطالب؟
              </p>
            </div>

            {/* Test Record Details Card */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-200/70 dark:border-gray-700 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-500 dark:text-gray-400">اسم الطالب:</span>
                <span className="font-black text-gray-900 dark:text-white text-sm">{deletingTest.studentName}</span>
              </div>
              {deletingTest.grade && (
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-500 dark:text-gray-400">الصف / المرحلة:</span>
                  <span className="font-bold text-gray-700 dark:text-gray-300">{deletingTest.grade}</span>
                </div>
              )}
              {deletingTest.parentPhone && (
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-500 dark:text-gray-400">هاتف ولي الأمر:</span>
                  <span className="font-mono font-bold text-gray-700 dark:text-gray-300" dir="ltr">{deletingTest.parentPhone}</span>
                </div>
              )}
              {deletingTest.teacherName && (
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-500 dark:text-gray-400">المعلم المختبر:</span>
                  <span className="font-bold text-gray-700 dark:text-gray-300">{deletingTest.teacherName}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-500 dark:text-gray-400">تاريخ الاختبار:</span>
                <span className="font-mono text-gray-600 dark:text-gray-400">{deletingTest.testDate}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200/70 dark:border-gray-700">
                <span className="font-bold text-gray-500 dark:text-gray-400">الأخطاء (ف | ت | ج):</span>
                <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                  <span className="text-red-600">{deletingTest.fathErrors ?? 0}</span> فتح |{' '}
                  <span className="text-amber-600">{deletingTest.tashkeelErrors ?? 0}</span> تشكيل |{' '}
                  <span className="text-teal-600">{deletingTest.tajweedErrors ?? 0}</span> تجويد
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200/70 dark:border-gray-700">
                <span className="font-bold text-gray-500 dark:text-gray-400">النتيجة والنسبة:</span>
                <span className="font-black text-gray-900 dark:text-white">
                  {deletingTest.score} / {deletingTest.maxScore}{' '}
                  <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                    deletingTest.isPassed
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                  }`}>
                    {deletingTest.percentage}% ({deletingTest.isPassed ? 'محقق' : 'دون النسبة'})
                  </span>
                </span>
              </div>
            </div>

            {/* Warning Note */}
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-700 dark:text-red-300 text-[11px] font-bold">
              <span className="text-base shrink-0">⚠️</span>
              <span>تنبيه: سيتم مسح هذا السجل نهائياً من قاعدة البيانات ولا يمكن استرجاعه بعد الحذف.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => {
                  deleteNewStudentTest(deletingTest.id);
                  showToast(`تم حذف سجل اختبار الطالب "${deletingTest.studentName}" بنجاح.`, 'info');
                  setDeletingTest(null);
                }}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>🗑️</span>
                <span>نعم، تأكيد الحذف</span>
              </button>
              <button
                onClick={() => setDeletingTest(null)}
                className="py-3 px-5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-700 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  إعدادات اختبار قبول الطلاب الجدد
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Active Toggle */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200/70 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <span className="block text-xs font-black text-gray-900 dark:text-white">
                    تفعيل اختبار القبول للمعلمين
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    عند التفعيل يظهر زر الاختبار لجميع المعلمين لرصد الطلاب الجدد.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer" dir="ltr">
                  <input
                    type="checkbox"
                    checked={settingsActive}
                    onChange={e => setSettingsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Score and Passing Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-700 dark:text-gray-300">
                    درجة الاختبار الكلية
                  </label>
                  <input
                    type="number"
                    min="10"
                    value={safeNumberVal(settingsScore, 100)}
                    onChange={e => setSettingsScore(parseSafeNumber(e.target.value, 100))}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-700 dark:text-gray-300">
                    نسبة القبول المطلوبة (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={safeNumberVal(settingsRate, 70)}
                    onChange={e => setSettingsRate(parseSafeNumber(e.target.value, 70))}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-black text-gray-700 dark:text-gray-300 block">
                  درجات الخصم عند الأخطاء:
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-red-600 dark:text-red-400">
                      خصم الفتح
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={safeNumberVal(settingsDeductions.fath, 0)}
                      onChange={e =>
                        setSettingsDeductions({ ...settingsDeductions, fath: parseSafeNumber(e.target.value, 0) })
                      }
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      خصم التشكيل
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={safeNumberVal(settingsDeductions.tashkeel, 0)}
                      onChange={e =>
                        setSettingsDeductions({ ...settingsDeductions, tashkeel: parseSafeNumber(e.target.value, 0) })
                      }
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-yellow-600 dark:text-yellow-400">
                      خصم التجويد
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={safeNumberVal(settingsDeductions.tajweed, 0)}
                      onChange={e =>
                        setSettingsDeductions({ ...settingsDeductions, tajweed: parseSafeNumber(e.target.value, 0) })
                      }
                      className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={handleSaveSettings}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                حفظ الإعدادات
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="py-3 px-5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-xs rounded-xl transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Form Modal: allows supervisor to directly test a student too */}
      {showTestFormModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 sm:p-6 w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span>🎓</span>
                اختبار وتقييم طالب جديد (المشرف)
              </h3>
              <button
                onClick={() => setShowTestFormModal(false)}
                className="text-gray-400 hover:text-gray-600 text-base"
              >
                ✕ إغلاق
              </button>
            </div>

            <NewStudentTestForm
              teacherId={currentUser?.id || 1}
              isSupervisor={true}
              onComplete={() => setShowTestFormModal(false)}
            />
          </div>
        </div>
      )}

      {/* Clear/Delete All Data Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-[140] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-7 w-full max-w-md shadow-2xl border border-red-100 dark:border-red-900/50 space-y-5 animate-in zoom-in-95 text-center relative overflow-hidden">
            {/* Top red warning glow line */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-rose-600 to-red-500"></div>

            {/* Icon */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-red-100 dark:bg-red-950/80 border-2 border-red-200 dark:border-red-800 flex items-center justify-center text-3xl sm:text-4xl text-red-600 dark:text-red-400 mx-auto shadow-inner ring-8 ring-red-50 dark:ring-red-950/30">
              🗑️
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                تأكيد حذف جميع بيانات التقرير
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                هل أنت مقتنع بحذف جميع نتائج وسجلات تقييم الطلاب الجدد ({stats.total} سجل)؟
              </p>
            </div>

            {/* Detailed Mobile-Friendly Warning Box */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 rounded-2xl p-4 text-right text-xs space-y-2 text-amber-900 dark:text-amber-200 shadow-inner">
              <div className="flex items-center gap-2 font-black text-amber-800 dark:text-amber-300 text-xs sm:text-sm">
                <span className="text-base">⚠️</span>
                <span>تنبيه هام قبل الحذف:</span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-[11px] sm:text-xs font-semibold leading-relaxed text-amber-800/90 dark:text-amber-300/90 pr-1">
                <li>سيتم مسح كافّة درجات وسجلات تقرير اختبارات القبول نهائياً.</li>
                <li>سيكون التقرير فارغاً تماماً وجاهزاً لرصد تقييمات طلاب جدد في الفترة القادمة.</li>
                <li>الطلاب المقبولون الذين تم إدراجهم سابقاً في قائمة الطلاب الرئيسية <strong>لن يتأثروا</strong> بهذه العملية وسيبقون مقيدين في التطبيق.</li>
              </ul>
            </div>

            {/* Action Buttons (Mobile First layout: full-width column reverse on phone, row on desktop) */}
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="w-full sm:flex-1 py-3.5 px-5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs sm:text-sm rounded-2xl transition-all border border-gray-200 dark:border-gray-700 cursor-pointer active:scale-95"
              >
                إلغاء الأمر
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteAllNewStudentTests) {
                    deleteAllNewStudentTests();
                  } else {
                    newStudentTests.forEach(t => deleteNewStudentTest(t.id));
                    showToast('🗑️ تم تفريغ تقرير الطلاب الجدد وحذف جميع البيانات بنجاح.', 'success');
                  }
                  setShowDeleteAllModal(false);
                }}
                className="w-full sm:flex-1 py-3.5 px-5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer border border-red-500"
              >
                <span>🗑️</span>
                <span>نعم، مسح جميع البيانات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Word and Excel Export Modals */}
      <WordExportModal
        isOpen={isWordModalOpen}
        onClose={() => setIsWordModalOpen(false)}
        onExport={(orientation, action) => {
          if (action === 'share-pdf') {
            sharePdfDirectly(exportHeaders, exportData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, undefined, undefined, orientation);
          } else if (action === 'pdf') {
            exportToPdf(exportHeaders, exportData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments);
          } else {
            exportToWord(exportHeaders, exportData, exportHeaderInfo.fileName, exportHeaderInfo.title, hijriAdjustments, undefined, undefined, orientation, action);
          }
        }}
      />
      <ExcelExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onExport={(orientation, action) =>
          exportToExcelFile(exportHeaders, exportData, exportHeaderInfo.fileName, exportHeaderInfo.title, hijriAdjustments, undefined, undefined, orientation, action)
        }
      />
    </div>
  );
};

export default NewStudentsTestsTable;
