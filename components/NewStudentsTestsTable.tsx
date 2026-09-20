import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { NewStudentTest, Halaqa } from '../types';
import { isSmartMatch, formatWhatsAppNumber } from '../utils/searchUtils';
import NewStudentTestForm from './NewStudentTestForm';
import * as XLSX from 'xlsx';
import { exportToWord } from '../utils/exportWord';
import { exportToExcel as exportToExcelFile } from '../utils/exportExcel';
import { exportToPdf, sharePdfDirectly } from '../utils/exportPdf';
import { WordExportModal } from './WordExportModal';
import { ExcelExportModal } from './ExcelExportModal';

export const NewStudentsTestsTable: React.FC = () => {
  const context = useContext(AppContext);

  const newStudentTests = context?.newStudentTests || [];
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
  const updateNewStudentTest = context?.updateNewStudentTest || (() => {});

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [passFilter, setPassFilter] = useState<'all' | 'passed' | 'failed'>('all');

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTestFormModal, setShowTestFormModal] = useState(false);
  const [acceptingStudent, setAcceptingStudent] = useState<NewStudentTest | null>(null);
  const [deletingTest, setDeletingTest] = useState<NewStudentTest | null>(null);
  const [selectedHalaqaId, setSelectedHalaqaId] = useState<number>(0);

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
      // Search match
      if (searchTerm.trim()) {
        const term = searchTerm.trim();
        const matchesName = isSmartMatch(test.studentName, term);
        const matchesGrade = isSmartMatch(test.grade || '', term);
        const matchesPhone = test.parentPhone?.includes(term);
        const matchesTeacher = isSmartMatch(test.teacherName || '', term);
        if (!matchesName && !matchesGrade && !matchesPhone && !matchesTeacher) {
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

      return true;
    });
  }, [newStudentTests, searchTerm, statusFilter, passFilter]);

  // Confirmation of acceptance
  const confirmAcceptStudent = () => {
    if (!acceptingStudent) return;
    acceptNewStudent(acceptingStudent.id, selectedHalaqaId);
    setAcceptingStudent(null);
    setSelectedHalaqaId(0);
  };

  // Export Headers and Formatted Data
  const exportHeaders = useMemo(() => [
    { key: 'sequence', label: '#' },
    { key: 'studentName', label: 'اسم الطالب' },
    { key: 'grade', label: 'الصف / المرحلة' },
    { key: 'parentPhone', label: 'رقم ولي الأمر' },
    { key: 'teacherName', label: 'المعلم المختبر' },
    { key: 'testDate', label: 'تاريخ الاختبار' },
    { key: 'fathErrors', label: 'الفتح' },
    { key: 'tashkeelErrors', label: 'التشكيل' },
    { key: 'tajweedErrors', label: 'التجويد' },
    { key: 'score', label: 'الدرجة' },
    { key: 'percentage', label: 'النسبة' },
    { key: 'isPassedText', label: 'الاجتياز' },
    { key: 'statusText', label: 'حالة القبول' },
    { key: 'notes', label: 'الملاحظات' },
  ], []);

  const exportData = useMemo(() => {
    return filteredTests.map((t, idx) => ({
      sequence: idx + 1,
      studentName: t.studentName,
      grade: t.grade || '—',
      parentPhone: t.parentPhone || '—',
      teacherName: t.teacherName || '—',
      testDate: t.testDate,
      fathErrors: t.fathErrors ?? 0,
      tashkeelErrors: t.tashkeelErrors ?? 0,
      tajweedErrors: t.tajweedErrors ?? 0,
      score: `${t.score} / ${t.maxScore}`,
      percentage: `${t.percentage}%`,
      isPassedText: t.isPassed ? 'محقق' : 'غير محقق',
      statusText: t.status === 'accepted' ? 'مقبول' : t.status === 'rejected' ? 'غير مقبول' : 'قيد الانتظار',
      notes: t.notes || '—',
    }));
  }, [filteredTests]);

  const exportHeaderInfo = useMemo(() => {
    const statusLabel = statusFilter === 'accepted' ? 'المقبولين' : statusFilter === 'rejected' ? 'غير المقبولين' : statusFilter === 'pending' ? 'قيد الانتظار' : 'جميع الحالات';
    return {
      title: 'تقرير نتائج اختبارات قبول الطلاب الجدد',
      fileName: `نتائج_اختبارات_الطلاب_الجدد_${new Date().toISOString().split('T')[0]}`,
      subtitle: `إجمالي السجلات: ${filteredTests.length} (${statusLabel})`,
    };
  }, [filteredTests.length, statusFilter]);

  // Export to Excel
  const exportToExcel = () => {
    if (filteredTests.length === 0) {
      showToast('⚠️ لا توجد بيانات لتصديرها.', 'info');
      return;
    }

    const headers = [
      'م',
      'اسم الطالب',
      'الصف / المرحلة',
      'رقم ولي الأمر',
      'المعلم المختبر',
      'تاريخ الاختبار',
      'الدرجة',
      'الدرجة الكلية',
      'النسبة المئوية %',
      'محقق لنسبة القبول',
      'حالة القبول',
      'أخطاء الفتح',
      'أخطاء التشكيل',
      'أخطاء التجويد',
      'الملاحظات',
    ];

    const rows = filteredTests.map((t, idx) => [
      idx + 1,
      t.studentName,
      t.grade || '',
      t.parentPhone || '',
      t.teacherName || '',
      t.testDate,
      t.score,
      t.maxScore,
      `${t.percentage}%`,
      t.isPassed ? 'نعم' : 'لا',
      t.status === 'accepted' ? 'مقبول' : t.status === 'rejected' ? 'غير مقبول' : 'قيد الانتظار',
      t.fathErrors,
      t.tashkeelErrors,
      t.tajweedErrors,
      t.notes || '',
    ]);

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
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
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
              className="absolute left-3 top-2.5 text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 font-black rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              الكل ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 font-black rounded-lg transition-all ${
                statusFilter === 'pending'
                  ? 'bg-white dark:bg-gray-800 text-amber-600 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              قيد الانتظار ({stats.pending})
            </button>
            <button
              onClick={() => setStatusFilter('accepted')}
              className={`px-3 py-1.5 font-black rounded-lg transition-all ${
                statusFilter === 'accepted'
                  ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              المقبولون ({stats.accepted})
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 font-black rounded-lg transition-all ${
                statusFilter === 'rejected'
                  ? 'bg-white dark:bg-gray-800 text-red-600 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              غير المقبولين ({stats.rejected})
            </button>
          </div>

          {/* Pass/Fail Filter */}
          <select
            value={passFilter}
            onChange={e => setPassFilter(e.target.value as any)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
          >
            <option value="all">جميع النتائج</option>
            <option value="passed">محقق لنسبة القبول ({newStudentPassingRate}%+)</option>
            <option value="failed">دون نسبة القبول (&lt;{newStudentPassingRate}%)</option>
          </select>
        </div>
      </div>

      {/* Export Action Buttons & Total Records Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="px-3 py-2 text-[10px] font-bold text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 transition-colors"
          >
            Excel
          </button>
          <button
            onClick={() => setIsWordModalOpen(true)}
            className="px-3 py-2 text-[10px] font-bold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
          >
            Word
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => exportToPdf(exportHeaders, exportData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments)}
              className="px-3 py-2 text-[10px] font-bold text-white bg-red-600 rounded-lg shadow-sm hover:bg-red-700 transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              طباعة
            </button>
            <button
              onClick={() => sharePdfDirectly(exportHeaders, exportData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, undefined, undefined, "landscape")}
              className="px-3 py-2 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              مشاركة PDF
            </button>
          </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-750/50 border-b border-gray-200 dark:border-gray-700 text-[11px] font-black text-gray-500 dark:text-gray-400">
                  <th className="py-3 px-3 w-10 text-center">م</th>
                  <th className="py-3 px-4">اسم الطالب</th>
                  <th className="py-3 px-3">الصف / المرحلة</th>
                  <th className="py-3 px-3">رقم ولي الأمر</th>
                  <th className="py-3 px-3">المعلم المختبر</th>
                  <th className="py-3 px-3">تاريخ الاختبار</th>
                  <th className="py-3 px-2 text-center text-red-600 dark:text-red-400 font-black">الفتح</th>
                  <th className="py-3 px-2 text-center text-amber-600 dark:text-amber-400 font-black">التشكيل</th>
                  <th className="py-3 px-2 text-center text-teal-600 dark:text-teal-400 font-black">التجويد</th>
                  <th className="py-3 px-3 text-center">الدرجة</th>
                  <th className="py-3 px-3 text-center">النسبة</th>
                  <th className="py-3 px-3 text-center">الاجتياز</th>
                  <th className="py-3 px-4">ملاحظات</th>
                  <th className="py-3 px-4 text-center">القرار والقبول</th>
                  <th className="py-3 px-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs">
                {filteredTests.map((test, index) => {
                  const isAccepted = test.status === 'accepted';
                  const isRejected = test.status === 'rejected';
                  const isPending = !test.status || test.status === 'pending';

                  return (
                    <tr
                      key={test.id}
                      className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 transition-colors ${
                        isAccepted ? 'bg-emerald-50/20 dark:bg-emerald-950/5' : ''
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3 px-3 text-center font-bold text-gray-400">
                        {index + 1}
                      </td>

                      {/* Student Name */}
                      <td className="py-3 px-4">
                        <div className="font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>{test.studentName}</span>
                          {isAccepted && (
                            <span className="text-emerald-600 text-xs" title="مقبول ومدرج في التطبيق">✓</span>
                          )}
                        </div>
                        {test.surahs && test.surahs.length > 0 && (
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            سور: {test.surahs.join('، ')}
                          </span>
                        )}
                      </td>

                      {/* School Stage */}
                      <td className="py-3 px-3 font-bold text-gray-600 dark:text-gray-300">
                        {test.grade ? (
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md text-[11px]">
                            {test.grade}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>

                      {/* Parent Phone */}
                      <td className="py-3 px-3 font-bold">
                        {test.parentPhone ? (
                          <div className="flex items-center gap-1.5" dir="ltr">
                            <a
                              href={`tel:${test.parentPhone}`}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono text-xs"
                            >
                              {test.parentPhone}
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(test.parentPhone);
                                showToast('📋 تم نسخ رقم الهاتف.', 'info');
                              }}
                              className="text-gray-400 hover:text-gray-600 text-[10px]"
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

                      {/* Teacher Name */}
                      <td className="py-3 px-3 font-bold text-gray-700 dark:text-gray-300">
                        {test.teacherName || 'معلم'}
                      </td>

                      {/* Test Date */}
                      <td className="py-3 px-3 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                        {test.testDate}
                      </td>

                      {/* Fath Errors */}
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-block font-mono font-black text-xs px-2 py-0.5 rounded-lg ${
                          test.fathErrors > 0 
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60' 
                            : 'text-gray-400'
                        }`}>
                          {test.fathErrors ?? 0}
                        </span>
                      </td>

                      {/* Tashkeel Errors */}
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-block font-mono font-black text-xs px-2 py-0.5 rounded-lg ${
                          test.tashkeelErrors > 0 
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60' 
                            : 'text-gray-400'
                        }`}>
                          {test.tashkeelErrors ?? 0}
                        </span>
                      </td>

                      {/* Tajweed Errors */}
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-block font-mono font-black text-xs px-2 py-0.5 rounded-lg ${
                          test.tajweedErrors > 0 
                            ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-900/60' 
                            : 'text-gray-400'
                        }`}>
                          {test.tajweedErrors ?? 0}
                        </span>
                      </td>

                      {/* Score */}
                      <td className="py-3 px-3 text-center font-black text-gray-900 dark:text-white">
                        {test.score} <span className="text-[10px] text-gray-400">/ {test.maxScore}</span>
                      </td>

                      {/* Percentage */}
                      <td className="py-3 px-3 text-center">
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

                      {/* Passing Criteria */}
                      <td className="py-3 px-3 text-center">
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

                      {/* Notes */}
                      <td className="py-3 px-4 max-w-[180px]">
                        {test.notes ? (
                          <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate block" title={test.notes}>
                            {test.notes}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>

                      {/* Acceptance Decision & Action */}
                      <td className="py-3 px-4 text-center">
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
                                onClick={() => rejectNewStudent(test.id)}
                                className="text-[10px] text-red-500 hover:underline font-bold"
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
                              onClick={() => setAcceptingStudent(test)}
                              className="text-[11px] text-emerald-600 hover:underline font-bold"
                            >
                              قبول الآن
                            </button>
                          </div>
                        ) : (
                          /* Pending - Buttons for Accept / Reject */
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setAcceptingStudent(test)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1"
                            >
                              <span>✅</span>
                              <span>قبول</span>
                            </button>
                            <button
                              onClick={() => rejectNewStudent(test.id)}
                              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/30 dark:hover:bg-red-900/40 dark:text-red-300 font-black text-xs rounded-xl transition-all active:scale-95"
                            >
                              <span>✕</span>
                              <span>عدم قبول</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setDeletingTest(test)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors text-xs"
                          title="حذف السجل"
                        >
                          🗑️
                        </button>
                      </td>
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
                    value={settingsScore}
                    onChange={e => setSettingsScore(Number(e.target.value))}
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
                    value={settingsRate}
                    onChange={e => setSettingsRate(Number(e.target.value))}
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
                      value={settingsDeductions.fath}
                      onChange={e =>
                        setSettingsDeductions({ ...settingsDeductions, fath: Number(e.target.value) })
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
                      value={settingsDeductions.tashkeel}
                      onChange={e =>
                        setSettingsDeductions({ ...settingsDeductions, tashkeel: Number(e.target.value) })
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
                      value={settingsDeductions.tajweed}
                      onChange={e =>
                        setSettingsDeductions({ ...settingsDeductions, tajweed: Number(e.target.value) })
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
