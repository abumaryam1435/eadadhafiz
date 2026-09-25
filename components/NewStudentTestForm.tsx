import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import { NewStudentTest } from '../types';
import { parseSafeNumber, safeInputNumber } from '../utils/juzUtils';
import MushafReaderModal from './MushafReaderModal';
import { registerBackHandler } from '../utils/navigationHistory';

interface NewStudentTestFormProps {
  teacherId: number;
  onComplete?: () => void;
  onReturnToMenu?: () => void;
  isSupervisor?: boolean;
}

const QUICK_GRADES = ['الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

export const NewStudentTestForm: React.FC<NewStudentTestFormProps> = ({
  teacherId,
  onComplete,
  onReturnToMenu,
  isSupervisor = false,
}) => {
  const context = useContext(AppContext);

  const users = context?.users || [];
  const students = context?.students || [];
  const currentTeacher = users.find(u => u.id === teacherId);
  const showToast = context?.showToast || (() => {});
  const addNewStudentTest = context?.addNewStudentTest;
  const updateNewStudentTest = context?.updateNewStudentTest;
  const deleteNewStudentTest = context?.deleteNewStudentTest;
  const newStudentTests = context?.newStudentTests || [];

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

  const testScore = context?.newStudentTestScore ?? 100;
  const passingRate = context?.newStudentPassingRate ?? 70;
  const testDeductions = context?.newStudentTestDeductions ?? { fath: 1, tashkeel: 1, tajweed: 0.5 };

  // Form states
  const [studentName, setStudentName] = useState('');
  const [grade, setGrade] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [testFath, setTestFath] = useState(0);
  const [testTashkeel, setTestTashkeel] = useState(0);
  const [testTajweed, setTestTajweed] = useState(0);
  const [notes, setNotes] = useState('');
  const [isMushafOpen, setIsMushafOpen] = useState(false);
  const [editingTestId, setEditingTestId] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // All 604 pages for Mushaf browsing during test
  const allQuranPages = useMemo(() => Array.from({ length: 604 }, (_, i) => i + 1), []);

  const fathDeduction = testDeductions?.fath ?? 1;
  const tashkeelDeduction = testDeductions?.tashkeel ?? 1;
  const tajweedDeduction = testDeductions?.tajweed ?? 0.5;

  const currentScore = Math.max(
    0,
    Number(
      (
        testScore -
        (testFath * fathDeduction + testTashkeel * tashkeelDeduction + testTajweed * tajweedDeduction)
      ).toFixed(2)
    )
  );

  const percentage = testScore > 0 ? Math.round((currentScore / testScore) * 1000) / 10 : 0;
  const isPassed = percentage >= passingRate;

  // Tests evaluated by this teacher
  const teacherTests = useMemo(() => {
    return newStudentTests.filter(t => isSupervisor || t.teacherId === teacherId);
  }, [newStudentTests, teacherId, isSupervisor]);

  const resetForm = () => {
    setStudentName('');
    setGrade('');
    setParentPhone('');
    setTestFath(0);
    setTestTashkeel(0);
    setTestTajweed(0);
    setNotes('');
    setEditingTestId(null);
    setIsSaving(false);
    setSaveSuccess(false);
  };

  const handleEditClick = (test: NewStudentTest) => {
    setEditingTestId(test.id);
    setStudentName(test.studentName);
    setGrade(test.grade || '');
    setParentPhone(test.parentPhone || '');
    setTestFath(test.fathErrors || 0);
    setTestTashkeel(test.tashkeelErrors || 0);
    setTestTajweed(test.tajweedErrors || 0);
    setNotes(test.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // الاحتفاظ بأحدث قيم النموذج عبر ref لتجنب إعادة تسجيل معالج الرجوع مع كل حرف أو ضغطة
  const formDataRef = React.useRef({
    studentName,
    testFath,
    testTashkeel,
    testTajweed,
    notes,
    editingTestId,
    onReturnToMenu,
  });

  useEffect(() => {
    formDataRef.current = {
      studentName,
      testFath,
      testTashkeel,
      testTajweed,
      notes,
      editingTestId,
      onReturnToMenu,
    };
  });

  // معالج الرجوع الآمن لمنع الخروج المفاجئ وفقدان بيانات الطالب الجديد (يسجل مرة واحدة فقط)
  useEffect(() => {
    return registerBackHandler(() => {
      const {
        studentName: sName,
        testFath: sFath,
        testTashkeel: sTashkeel,
        testTajweed: sTajweed,
        notes: sNotes,
        editingTestId: editId,
        onReturnToMenu: returnFn,
      } = formDataRef.current;

      if (sName.trim() || sFath > 0 || sTashkeel > 0 || sTajweed > 0 || sNotes.trim()) {
        if (window.confirm('هل تريد الرجوع؟ سيتم فقدان البيانات غير المحفوظة.')) {
          if (editId) {
            resetForm();
          } else if (returnFn) {
            returnFn();
          }
        }
        return true;
      } else if (editId) {
        resetForm();
        return true;
      } else if (returnFn) {
        returnFn();
        return true;
      }
      return false;
    });
  }, []);

  const handleSave = async () => {
    const trimmedName = studentName.trim();
    if (!trimmedName) {
      showToast('⚠️ الرجاء إدخال اسم الطالب.', 'error');
      return;
    }

    setIsSaving(true);
    const testPayload: Omit<NewStudentTest, 'id' | 'updatedAt'> = {
      studentName: trimmedName,
      grade: grade.trim(),
      parentPhone: parentPhone.trim(),
      teacherId,
      teacherName: currentTeacher?.name || 'المعلم',
      testDate: new Date().toISOString().split('T')[0],
      fathErrors: testFath,
      tashkeelErrors: testTashkeel,
      tajweedErrors: testTajweed,
      score: currentScore,
      maxScore: testScore,
      percentage: percentage,
      passingRate: passingRate,
      isPassed: isPassed,
      status: 'pending',
      notes: notes.trim(),
    };

    try {
      if (editingTestId) {
        const existing = newStudentTests.find(t => t.id === editingTestId);
        if (existing && updateNewStudentTest) {
          await updateNewStudentTest({
            ...existing,
            ...testPayload,
            id: editingTestId,
            status: existing.status,
            createdStudentId: existing.createdStudentId,
          });
        }
      } else {
        if (addNewStudentTest) {
          await addNewStudentTest(testPayload);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsSaving(false);
        resetForm();
        if (onComplete) onComplete();
      }, 1200);
    } catch (error) {
      setIsSaving(false);
      console.error('Error saving new student test:', error);
      showToast('حدث خطأ أثناء حفظ التقييم.', 'error');
    }
  };

  // Error Counter Component identical to TestEvaluationForm
  const ErrorCounter = ({
    label,
    value,
    onChange,
    incrementText = '-1',
    color = 'red',
  }: {
    label: string;
    value: number;
    onChange: (val: number) => void;
    incrementText?: string;
    color?: string;
  }) => {
    const colorConfig = {
      red: {
        container:
          'bg-gradient-to-r sm:bg-gradient-to-b from-rose-50/90 to-red-50/70 dark:from-rose-950/40 dark:to-red-950/30 border-2 border-rose-200 dark:border-rose-800/70 hover:border-rose-400 dark:hover:border-rose-600',
        badge: 'bg-rose-600 text-white',
        text: 'text-rose-950 dark:text-rose-100 group-hover:text-rose-700',
        subtext: 'text-rose-700/80 dark:text-rose-400',
        input: 'text-rose-600 dark:text-rose-400 placeholder:text-rose-200 dark:placeholder:text-rose-900/40',
        circleBorder: 'border-rose-400 dark:border-rose-500',
      },
      amber: {
        container:
          'bg-gradient-to-r sm:bg-gradient-to-b from-amber-50/90 to-orange-50/70 dark:from-amber-950/40 dark:to-orange-950/30 border-2 border-amber-200 dark:border-amber-800/70 hover:border-amber-400 dark:hover:border-amber-600',
        badge: 'bg-amber-600 text-white',
        text: 'text-amber-950 dark:text-amber-100 group-hover:text-amber-700',
        subtext: 'text-amber-700/80 dark:text-amber-400',
        input: 'text-amber-600 dark:text-amber-400 placeholder:text-amber-200 dark:placeholder:text-amber-900/40',
        circleBorder: 'border-amber-400 dark:border-amber-500',
      },
      yellow: {
        container:
          'bg-gradient-to-r sm:bg-gradient-to-b from-teal-50/90 to-emerald-50/70 dark:from-teal-950/40 dark:to-emerald-950/30 border-2 border-teal-200 dark:border-teal-800/70 hover:border-teal-400 dark:hover:border-teal-600',
        badge: 'bg-teal-600 text-white',
        text: 'text-teal-950 dark:text-teal-100 group-hover:text-teal-700',
        subtext: 'text-teal-700/80 dark:text-teal-400',
        input: 'text-teal-600 dark:text-teal-400 placeholder:text-teal-200 dark:placeholder:text-teal-900/40',
        circleBorder: 'border-teal-400 dark:border-teal-500',
      },
    };
    const currentConfig = colorConfig[color as keyof typeof colorConfig] || colorConfig.red;

    return (
      <div
        onClick={() => onChange(value + 1)}
        className={`rounded-2xl shadow-xs overflow-hidden flex items-stretch group cursor-pointer transition-all active:scale-[0.98] h-14 sm:h-18 ${currentConfig.container}`}
      >
        <div className="flex-1 flex items-center justify-between px-3 sm:px-4 select-none">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs sm:text-sm font-black px-2 py-0.5 rounded-lg shadow-xs ${currentConfig.badge}`}>
              {incrementText}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className={`text-sm sm:text-base font-black text-right ${currentConfig.text}`}>{label}</span>
          </div>
        </div>
        <div className="px-2.5 sm:px-4 flex items-center justify-center">
          <div
            className={`w-14 sm:w-16 h-11 sm:h-12 rounded-full bg-white dark:bg-gray-900 border-2 ${currentConfig.circleBorder} shadow-sm flex items-center justify-center overflow-hidden`}
          >
            <input
              onClick={e => e.stopPropagation()}
              type="number"
              min="0"
              value={safeInputNumber(value)}
              placeholder="0"
              onChange={e => onChange(Math.max(0, parseSafeNumber(e.target.value)))}
              onFocus={e => e.target.select()}
              className={`w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent ${currentConfig.input} focus:opacity-90 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none z-10`}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 max-w-4xl mx-auto">
      {/* Student Data Input Card */}
      <div className="bg-indigo-50 dark:bg-indigo-900/30 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-2">
            <span>🎓</span>
            <span>{editingTestId ? 'تعديل بيانات واختبار الطالب الجديد' : 'بيانات الطالب الجديد'}</span>
          </h3>
          <div className="flex items-center gap-2">
            {editingTestId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-100 dark:bg-red-950/40 px-3 py-1.5 rounded-xl transition-all"
              >
                ✕ إلغاء التعديل
              </button>
            )}
            {onReturnToMenu && (
              <button
                type="button"
                onClick={onReturnToMenu}
                className="px-3 py-1.5 text-xs font-black text-gray-600 dark:text-gray-300 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border border-indigo-200 dark:border-indigo-700 rounded-xl transition-all flex items-center gap-1.5"
              >
                <span>القائمة الرئيسية</span>
                <span>←</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Student Name */}
          <div className="space-y-1">
            <label className="text-xs font-black text-indigo-900 dark:text-indigo-200">
              اسم الطالب <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              placeholder="اكتب اسم الطالب"
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-2xl text-sm font-bold text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all outline-none"
            />
          </div>

          {/* School Grade */}
          <div className="space-y-1">
            <label className="text-xs font-black text-indigo-900 dark:text-indigo-200">
              الصف الدراسي
            </label>
            <input
              type="text"
              value={grade}
              onChange={e => setGrade(e.target.value)}
              placeholder="اكتب الصف الدراسي"
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-2xl text-sm font-bold text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all outline-none"
            />
          </div>

          {/* Parent Phone */}
          <div className="space-y-1">
            <label className="text-xs font-black text-indigo-900 dark:text-indigo-200">
              هاتف ولي الأمر
            </label>
            <input
              type="tel"
              value={parentPhone}
              onChange={e => setParentPhone(e.target.value)}
              placeholder="اكتب هاتف ولي الأمر"
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-2xl text-sm font-bold text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all outline-none text-right"
            />
          </div>
        </div>

        {/* Quick choices for Grade */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 ml-1">
            خيارات سريعة للصف:
          </span>
          {QUICK_GRADES.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGrade(g)}
              className={`text-xs font-black px-3 py-1 rounded-xl transition-all ${
                grade === g
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-indigo-900 dark:bg-gray-800 dark:hover:bg-gray-750 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Open Mushaf Reader Button */}
        <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-800/60">
          <button
            type="button"
            onClick={() => setIsMushafOpen(true)}
            className="px-4 py-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            title="فتح مصحف الاختبار"
          >
            <span className="text-lg">📖</span>
            <span>فتح مصحف الاختبار</span>
            <span className="bg-emerald-800/60 text-emerald-100 text-[10px] px-2 py-0.5 rounded-md mr-1">604 ص</span>
          </button>
        </div>
      </div>

      {/* Error Counters - Exactly same as TestEvaluationForm */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ErrorCounter
          label="أخطاء الفتح"
          value={testFath}
          onChange={setTestFath}
          incrementText={`-${fathDeduction}`}
          color="red"
        />
        <ErrorCounter
          label="أخطاء التشكيل"
          value={testTashkeel}
          onChange={setTestTashkeel}
          incrementText={`-${tashkeelDeduction}`}
          color="amber"
        />
        <ErrorCounter
          label="أخطاء التجويد"
          value={testTajweed}
          onChange={setTestTajweed}
          incrementText={`-${tajweedDeduction}`}
          color="yellow"
        />
      </div>

      {/* Notes */}
      <div className="space-y-3 mt-6">
        <label className="text-sm font-black text-gray-700 dark:text-gray-300 flex items-center gap-2">
          ملاحظات على الاختبار (اختياري)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="أضف أي ملاحظات حول أداء الطالب في الاختبار..."
          className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl min-h-[100px] text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      {/* Final Score - Same as TestEvaluationForm */}
      <div
        className={`mt-6 p-5 rounded-2xl border-2 flex justify-between items-center ${
          currentScore < testScore * 0.5
            ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
            : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
        }`}
      >
        <span className="text-sm font-black text-gray-700 dark:text-gray-300">الدرجة النهائية:</span>
        <div className="flex items-baseline gap-1">
          <span
            className={`text-4xl font-black ${
              currentScore < testScore * 0.5
                ? 'text-red-700 dark:text-red-400'
                : 'text-green-700 dark:text-green-400'
            }`}
          >
            {currentScore}
          </span>
          <span className="text-sm font-bold text-gray-400">/ {testScore}</span>
        </div>
      </div>

      {/* Bottom Actions Buttons - Same as TestEvaluationForm */}
      <div className="flex flex-wrap justify-between items-center mt-8 pt-4 border-t border-gray-100 dark:border-gray-700 gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetForm}
            disabled={isSaving}
            className="px-6 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            مسح الحقول
          </button>

          {editingTestId && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving}
              className="px-4 py-3 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-lg shadow-red-100 dark:shadow-none transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              حذف
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || saveSuccess}
          className={`px-8 py-3 text-sm font-black text-white rounded-xl shadow-lg transition-all flex items-center gap-2 ${
            saveSuccess
              ? 'bg-green-600'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'
          } active:scale-95 disabled:scale-100`}
        >
          {isSaving ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              جاري الحفظ...
            </>
          ) : saveSuccess ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
              تم الحفظ بنجاح
            </>
          ) : (
            <>
              {editingTestId ? 'حفظ التعديلات' : 'حفظ النتيجة'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">تأكيد الحذف</h3>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-6 font-sans">
              هل أنت متأكد من حذف تقييم هذا الطالب نهائياً؟
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (editingTestId && deleteNewStudentTest) {
                    deleteNewStudentTest(editingTestId);
                    showToast('تم حذف التقييم.', 'info');
                    resetForm();
                    setShowDeleteConfirm(false);
                  }
                }}
                className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-200 dark:shadow-none"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-500 font-black rounded-xl hover:bg-gray-200 active:scale-95 transition-all dark:bg-gray-700 dark:text-gray-300"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mushaf Reader Modal */}
      <MushafReaderModal
        isOpen={isMushafOpen}
        onClose={() => setIsMushafOpen(false)}
        newPages={allQuranPages}
        previousWeekPages={[]}
        studentName={studentName || 'طالب جديد'}
        evalFath={testFath}
        setEvalFath={setTestFath}
        evalTashkeel={testTashkeel}
        setEvalTashkeel={setTestTashkeel}
        evalTajweed={testTajweed}
        setEvalTajweed={setTestTajweed}
        isTestMode={true}
        testScore={testScore}
        testDeductions={testDeductions}
      />

      {/* Recent Evaluations by this Teacher */}
      {teacherTests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3 mt-8">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>📋</span>
              <span>سجل اختبارات الطلاب الجدد ({teacherTests.length})</span>
            </h3>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {teacherTests.map(t => {
              const isBeingEdited = editingTestId === t.id;
              const acceptedStudent = getAcceptedStudent(t);
              return (
                <div
                  key={t.id}
                  className={`py-3.5 px-3 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isBeingEdited
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-2 border-indigo-300 dark:border-indigo-700 shadow-xs'
                      : 'hover:bg-gray-50/60 dark:hover:bg-gray-750/50'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-gray-900 dark:text-white">{t.studentName}</span>
                      {acceptedStudent && (
                        <>
                          {acceptedStudent.isAlAmeen && (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800">
                              (من طلاب الأمين)
                            </span>
                          )}
                          {acceptedStudent.isFromIbri !== false && (
                            <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200/80 dark:border-blue-800">
                              (من جامع عبري)
                            </span>
                          )}
                        </>
                      )}
                      {t.grade && (
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-md">
                          {t.grade}
                        </span>
                      )}
                      {isBeingEdited && (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-600 text-white rounded-md animate-pulse">
                          ✏️ جاري التعديل في النموذج أعلاه
                        </span>
                      )}
                      {isSupervisor && (
                        <>
                          {t.status === 'accepted' && (
                            <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-md">
                              مقبول ✓
                            </span>
                          )}
                          {t.status === 'rejected' && (
                            <span className="text-[10px] font-black px-2 py-0.5 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-md">
                              غير مقبول ✕
                            </span>
                          )}
                          {t.status === 'pending' && (
                            <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-md">
                              قيد المراجعة
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3 flex-wrap font-sans">
                      <span>التاريخ: {t.testDate}</span>
                      {t.parentPhone && <span>هاتف: {t.parentPhone}</span>}
                      <span>الأخطاء: فتح ({t.fathErrors}) • تشكيل ({t.tashkeelErrors}) • تجويد ({t.tajweedErrors})</span>
                    </div>
                    {t.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 italic bg-gray-50 dark:bg-gray-900/40 p-2 rounded-lg">
                        ملاحظة: {t.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <div className="text-left bg-gray-50 dark:bg-gray-900/60 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700">
                      <span className="block text-sm font-black text-gray-900 dark:text-white">
                        {t.score} <span className="text-xs font-normal text-gray-400">/ {t.maxScore}</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleEditClick(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                        isBeingEdited
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800'
                      }`}
                      title="تعديل بيانات ودرجات هذا التقييم"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>{isBeingEdited ? 'قيد التعديل' : 'تعديل التقييم'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewStudentTestForm;
