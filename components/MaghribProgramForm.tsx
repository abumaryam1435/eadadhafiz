import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { Student, MaghribAttendanceStatus, MaghribAttendance, AttendanceStatus } from '../types';
import Logo from './Logo';
import Modal from './Modal';
import { isSmartMatch } from '../utils/searchUtils';
import { translationMap, toArabicDigits } from '../utils/exportWord';
import { isStudentFromOutside } from '../utils/categoryUtils';

interface MaghribProgramFormProps {
  onBack: () => void;
  hideHeader?: boolean;
  programType?: 'maghrib' | 'asr';
}

export const MaghribProgramForm: React.FC<MaghribProgramFormProps> = ({ 
  onBack, 
  hideHeader = false, 
  programType = 'maghrib' 
}) => {
  const context = useContext(AppContext);

  const { 
    students = [], 
    addMaghribAttendance = async () => {}, 
    deleteMaghribAttendance = async () => {}, 
    maghribAttendances = [],
    evaluations = [],
    sardEvaluations = [],
    ilmiyyaAttendances = [],
    halaqas = [],
    sardHalaqas = [],
    ilmiyyaHalaqas = [],
    showToast = () => {}
  } = context || {};

  // تصفية طلاب جامع عبري حصراً (إدارة الحضور خاصة بطلاب جامع عبري)
  const ibriStudents = useMemo(() => {
    return students
      .filter(s => s.isFromIbri !== false && !isStudentFromOutside(s, halaqas, sardHalaqas, ilmiyyaHalaqas))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [students, halaqas, sardHalaqas, ilmiyyaHalaqas]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [weekNumber, setWeekNumber] = useState<number | ''>('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filterView, setFilterView] = useState<'all' | 'absent' | 'notAbsent'>('all');
  
  // حقول التاريخ والوقت
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attTime, setAttTime] = useState(new Date().toTimeString().slice(0, 5));

  // حالة المودال لتعديل أو حذف الغياب
  const [modalStudent, setModalStudent] = useState<Student | null>(null);
  const [modalRecord, setModalRecord] = useState<MaghribAttendance | null>(null);
  const [modalStatus, setModalStatus] = useState<MaghribAttendanceStatus>(MaghribAttendanceStatus.ABSENT);
  const [modalDate, setModalDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalTime, setModalTime] = useState(new Date().toTimeString().slice(0, 5));

  // دالة لمعرفة هل الطالب مسجل غائب أو لديه سجل في هذا الأسبوع والبرنامج
  const getStudentRecord = (studentId: number) => {
    if (!weekNumber) return null;
    return maghribAttendances.find(
      m => m.studentId === studentId && 
           Number(m.weekNumber) === Number(weekNumber) && 
           (m.programType === programType || (!m.programType && programType === 'maghrib'))
    ) || null;
  };

  // فحص حالة الطالب في التقييمات المرتبطة (الأولوية لاستمارة التقييم دائماً)
  const getStudentEvaluationState = (studentId: number): { isPresentEvaluated: boolean; isLateEvaluated: boolean; isAbsentEvaluated: boolean; source?: string } => {
    if (!weekNumber) return { isPresentEvaluated: false, isLateEvaluated: false, isAbsentEvaluated: false };
    const wk = Number(weekNumber);

    if (programType === 'asr') {
      const studentEvals = (evaluations || []).filter(
        e => e.studentId === studentId && Number(e.weekNumber) === wk && e.subject !== 'mutoon' && !e.isTest
      );
      const presentEv = studentEvals.find(e => e.attendance === AttendanceStatus.PRESENT);
      if (presentEv) {
        return { isPresentEvaluated: true, isLateEvaluated: false, isAbsentEvaluated: false, source: 'evaluation' };
      }
      const lateEv = studentEvals.find(e => e.attendance === AttendanceStatus.LATE);
      if (lateEv) {
        return { isPresentEvaluated: false, isLateEvaluated: true, isAbsentEvaluated: false, source: 'evaluation' };
      }
      const absentEv = studentEvals.find(e => e.attendance === AttendanceStatus.ABSENT);
      if (absentEv) {
        return { isPresentEvaluated: false, isLateEvaluated: false, isAbsentEvaluated: true, source: 'evaluation' };
      }
      return { isPresentEvaluated: false, isLateEvaluated: false, isAbsentEvaluated: false };
    } else {
      const studentSardEvals = (sardEvaluations || []).filter(
        se => se.studentId === studentId && Number(se.weekNumber) === wk
      );
      const presentSard = studentSardEvals.find(se => se.attendance === AttendanceStatus.PRESENT);
      if (presentSard) {
        return { isPresentEvaluated: true, isLateEvaluated: false, isAbsentEvaluated: false, source: 'sard' };
      }
      const lateSard = studentSardEvals.find(se => se.attendance === AttendanceStatus.LATE);
      if (lateSard) {
        return { isPresentEvaluated: false, isLateEvaluated: true, isAbsentEvaluated: false, source: 'sard' };
      }
      const absentSard = studentSardEvals.find(se => se.attendance === AttendanceStatus.ABSENT);
      if (absentSard) {
        return { isPresentEvaluated: false, isLateEvaluated: false, isAbsentEvaluated: true, source: 'sard' };
      }

      const studentIlmiyya = (ilmiyyaAttendances || []).filter(
        ia => ia.studentId === studentId && Number(ia.weekNumber) === wk
      );
      const presentIlmiyya = studentIlmiyya.find(ia => ia.status === AttendanceStatus.PRESENT);
      if (presentIlmiyya) {
        return { isPresentEvaluated: true, isLateEvaluated: false, isAbsentEvaluated: false, source: 'ilmiyya' };
      }
      const lateIlmiyya = studentIlmiyya.find(ia => ia.status === AttendanceStatus.LATE);
      if (lateIlmiyya) {
        return { isPresentEvaluated: false, isLateEvaluated: true, isAbsentEvaluated: false, source: 'ilmiyya' };
      }
      const absentIlmiyya = studentIlmiyya.find(ia => ia.status === AttendanceStatus.ABSENT);
      if (absentIlmiyya) {
        return { isPresentEvaluated: false, isLateEvaluated: false, isAbsentEvaluated: true, source: 'ilmiyya' };
      }
      return { isPresentEvaluated: false, isLateEvaluated: false, isAbsentEvaluated: false };
    }
  };

  // الطلاب المتاحون للعرض في إدارة الحضور (يُستبعد منهم من تم تقييمه كـ "حاضر" في استمارة التقييم، بينما يبقى المتأخر والغائب وغير المقيّم)
  const visibleIbriStudents = useMemo(() => {
    if (!weekNumber) return ibriStudents;
    return ibriStudents.filter(s => {
      const evalState = getStudentEvaluationState(s.id);
      if (evalState.isPresentEvaluated) return false;
      return true;
    });
  }, [ibriStudents, weekNumber, evaluations, sardEvaluations, ilmiyyaAttendances, programType]);

  const studentAttendanceMap = useMemo(() => {
    const map = new Map<number, { record: MaghribAttendance | null; isAbsent: boolean; status?: MaghribAttendanceStatus; source?: string }>();
    if (!weekNumber) return map;

    visibleIbriStudents.forEach(s => {
      const evalState = getStudentEvaluationState(s.id);
      const rec = getStudentRecord(s.id);

      // إذا كان الطالب مسجلاً كـ "متأخر" في استمارة التقييم، فالأولوية للتقييم دائماً
      if (evalState.isLateEvaluated) {
        map.set(s.id, {
          record: rec,
          isAbsent: false,
          status: MaghribAttendanceStatus.LATE,
          source: evalState.source || 'evaluation'
        });
      } else if (rec) {
        map.set(s.id, {
          record: rec,
          isAbsent: rec.status === MaghribAttendanceStatus.ABSENT || rec.status === MaghribAttendanceStatus.EXCUSED,
          status: rec.status,
          source: 'attendance'
        });
      } else if (evalState.isAbsentEvaluated) {
        map.set(s.id, {
          record: null,
          isAbsent: true,
          status: MaghribAttendanceStatus.ABSENT,
          source: evalState.source
        });
      }
    });
    return map;
  }, [visibleIbriStudents, weekNumber, maghribAttendances, evaluations, sardEvaluations, ilmiyyaAttendances, programType]);

  const filteredStudents = useMemo(() => {
    return visibleIbriStudents
      .filter(s => {
        if (searchTerm.trim() && !isSmartMatch(s.name, searchTerm)) return false;
        const info = studentAttendanceMap.get(s.id);
        const isRecorded = !!(info && (info.isAbsent || info.status === MaghribAttendanceStatus.LATE));
        if (filterView === 'absent' && !isRecorded) return false;
        if (filterView === 'notAbsent' && isRecorded) return false;
        return true;
      })
      .sort((a, b) => {
        const aInfo = studentAttendanceMap.get(a.id);
        const bInfo = studentAttendanceMap.get(b.id);
        const aRecorded = !!(aInfo?.isAbsent || aInfo?.status === MaghribAttendanceStatus.LATE);
        const bRecorded = !!(bInfo?.isAbsent || bInfo?.status === MaghribAttendanceStatus.LATE);
        if (aRecorded && !bRecorded) return -1;
        if (!aRecorded && bRecorded) return 1;
        return a.name.localeCompare(b.name, 'ar', { numeric: true });
      });
  }, [visibleIbriStudents, searchTerm, filterView, studentAttendanceMap]);

  const stats = useMemo(() => {
    let absentCount = 0;
    let excusedCount = 0;
    let lateCount = 0;
    visibleIbriStudents.forEach(s => {
      const info = studentAttendanceMap.get(s.id);
      if (info) {
        if (info.status === MaghribAttendanceStatus.ABSENT) absentCount++;
        else if (info.status === MaghribAttendanceStatus.EXCUSED) excusedCount++;
        else if (info.status === MaghribAttendanceStatus.LATE) lateCount++;
      }
    });
    return {
      totalStudents: visibleIbriStudents.length,
      absentCount,
      excusedCount,
      lateCount,
      totalRecorded: absentCount + excusedCount + lateCount
    };
  }, [visibleIbriStudents, studentAttendanceMap]);

  const existingRecord = useMemo(() => {
    if (!selectedStudent || !weekNumber) return null;
    return getStudentRecord(selectedStudent.id);
  }, [selectedStudent, weekNumber, maghribAttendances, programType]);

  const handleStudentClick = (student: Student) => {
    const info = studentAttendanceMap.get(student.id);
    if (info && (info.record || info.isAbsent || info.status === MaghribAttendanceStatus.LATE)) {
      setModalStudent(student);
      setModalRecord(info.record);
      setModalStatus(info.status || MaghribAttendanceStatus.ABSENT);
      setModalDate(info.record?.date || attDate);
      setModalTime(info.record?.time || attTime);
    } else {
      setSelectedStudent(student);
      setStep(3);
    }
  };

  const handleAttendance = (status: MaghribAttendanceStatus) => {
    if (!selectedStudent || !weekNumber) return;
    
    addMaghribAttendance({
      studentId: selectedStudent.id,
      weekNumber: Number(weekNumber),
      status,
      date: attDate,
      time: attTime,
      programType,
    });

    const statusLabel = status === MaghribAttendanceStatus.ABSENT ? 'غائب' : status === MaghribAttendanceStatus.EXCUSED ? 'مستأذن' : 'متأخر';
    setSuccessMessage(`✅ تم تسجيل "${selectedStudent.name}" كـ ${statusLabel} بنجاح.`);
    setSelectedStudent(null);
    setSearchTerm('');
    setStep(2);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // حفظ التعديل من المودال
  const handleSaveModalEdit = () => {
    if (!modalStudent || !weekNumber) return;

    (addMaghribAttendance as any)({
      id: modalRecord ? modalRecord.id : undefined,
      studentId: modalStudent.id,
      weekNumber: Number(weekNumber),
      status: modalStatus,
      date: modalDate,
      time: modalTime,
      programType,
    });

    showToast(`✅ تم تعديل حالة الطالب "${modalStudent.name}" إلى ${translationMap[modalStatus] || modalStatus}`, 'success');
    setModalStudent(null);
    setModalRecord(null);
  };

  // حذف الغياب من المودال
  const handleDeleteAbsence = () => {
    if (!modalStudent || !weekNumber) return;

    if (modalRecord) {
      deleteMaghribAttendance(modalRecord.id);
    } else {
      const tempId = Date.now();
      deleteMaghribAttendance(tempId);
    }

    showToast(`🗑️ تم حذف غياب الطالب "${modalStudent.name}" وإعادته للحضور الطبيعي`, 'success');
    setModalStudent(null);
    setModalRecord(null);
  };

  // حذف الغياب من الخطوة 3
  const handleDeleteFromStep3 = () => {
    if (!selectedStudent || !existingRecord) return;
    deleteMaghribAttendance(existingRecord.id);
    showToast(`🗑️ تم حذف غياب الطالب "${selectedStudent.name}" بنجاح`, 'success');
    setSelectedStudent(null);
    setStep(2);
  };

  const programTitle = programType === 'maghrib' ? 'برنامج المغرب' : 'برنامج العصر';

  if (!context) return null;

  return (
    <div className={`w-full ${hideHeader ? '' : 'min-h-screen bg-gray-50 dark:bg-gray-900'}`}>
      {!hideHeader && (
        <header className="bg-white dark:bg-gray-800 shadow-md p-3 sm:p-4 flex justify-between items-center sticky top-0 z-40">
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo className="h-8 w-8 sm:h-10 sm:w-10" />
            <div>
              <h1 className="text-sm sm:text-xl font-black">{programTitle}</h1>
              <span className="text-[10px] sm:text-xs text-green-700 dark:text-green-400 font-bold block">
                خاص بطلاب جامع عبري 🕌
              </span>
            </div>
          </div>
          <button onClick={onBack} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 rounded-xl text-xs sm:text-sm font-bold">رجوع</button>
        </header>
      )}

      {/* مودال تعديل أو حذف الغياب عند الضغط على الطالب المسجل غائب */}
      {modalStudent && (
        <Modal
          title="تعديل أو حذف الغياب"
          onClose={() => { setModalStudent(null); setModalRecord(null); }}
          hideDefaultCloseButton={true}
        >
          <div className="space-y-4 text-right animate-fade-in" dir="rtl">
            {/* بطاقة معلومات الطالب */}
            <div className="bg-rose-50/90 dark:bg-rose-950/40 p-3.5 sm:p-4 rounded-2xl border-2 border-rose-300 dark:border-rose-800 flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-lg">🚫</span>
                  <h3 className="text-base sm:text-lg font-black text-rose-950 dark:text-rose-100 truncate">
                    {modalStudent.name}
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs font-bold text-rose-800 dark:text-rose-300 mt-1">
                  الحلقة: {halaqas.find(h => h.id === modalStudent.halaqaId)?.name || 'غير محددة'} · الأسبوع {toArabicDigits(weekNumber)}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-rose-200/80 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200">
                  <span>الحالة:</span>
                  <span className="underline">{translationMap[modalStatus] || modalStatus}</span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-white dark:bg-gray-800 text-rose-800 dark:text-rose-300 rounded-xl text-[10px] sm:text-xs font-black shadow-2xs border border-rose-200 dark:border-rose-700 shrink-0">
                جامع عبري 🕌
              </span>
            </div>

            {/* خيارات التعديل */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-700 dark:text-gray-300">
                1. تحديد الحالة الجديدة:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setModalStatus(MaghribAttendanceStatus.ABSENT)}
                  className={`py-3 px-2 rounded-xl font-black text-xs sm:text-sm border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation min-h-[46px] ${
                    modalStatus === MaghribAttendanceStatus.ABSENT
                      ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-400'
                      : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900'
                  }`}
                >
                  <span>🚫</span>
                  <span>غائب</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalStatus(MaghribAttendanceStatus.EXCUSED)}
                  className={`py-3 px-2 rounded-xl font-black text-xs sm:text-sm border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation min-h-[46px] ${
                    modalStatus === MaghribAttendanceStatus.EXCUSED
                      ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900'
                  }`}
                >
                  <span>📝</span>
                  <span>مستأذن</span>
                </button>

                {programType === 'asr' ? (
                  <button
                    type="button"
                    onClick={() => setModalStatus(MaghribAttendanceStatus.LATE)}
                    className={`py-3 px-2 rounded-xl font-black text-xs sm:text-sm border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation min-h-[46px] col-span-2 sm:col-span-1 ${
                      modalStatus === MaghribAttendanceStatus.LATE
                        ? 'bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-400'
                        : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900'
                    }`}
                  >
                    <span>⏰</span>
                    <span>متأخر</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* تعديل التاريخ والوقت */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                  تاريخ الغياب:
                </label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={e => setModalDate(e.target.value)}
                  className="input-style py-1.5 px-2 text-xs sm:text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                  وقت التسجيل:
                </label>
                <input
                  type="time"
                  value={modalTime}
                  onChange={e => setModalTime(e.target.value)}
                  className="input-style py-1.5 px-2 text-xs sm:text-sm w-full"
                />
              </div>
            </div>

            {/* أزرار الإجراءات */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <button
                type="button"
                onClick={handleSaveModalEdit}
                className="w-full py-3 bg-green-700 hover:bg-green-800 active:bg-green-900 text-white rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation min-h-[46px]"
              >
                <span>💾</span>
                <span>حفظ التعديل</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteAbsence}
                className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation min-h-[46px]"
              >
                <span>🗑️</span>
                <span>حذف الغياب (إلغاء الغياب تماماً)</span>
              </button>

              <button
                type="button"
                onClick={() => { setModalStudent(null); setModalRecord(null); }}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition-colors cursor-pointer min-h-[38px]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="p-1 sm:p-4 max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 p-3.5 sm:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
          {successMessage && (
            <div className="p-3 mb-4 bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200 rounded-xl text-center font-black text-xs sm:text-sm animate-fade-in border border-green-300">
              {successMessage}
            </div>
          )}

          {/* الخطوة 1: تحديد الأسبوع */}
          {step === 1 && (
            <div className="text-center space-y-5 animate-fade-in py-4 max-w-sm mx-auto">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 flex items-center justify-center text-2xl sm:text-3xl mx-auto shadow-inner">
                🕌
              </div>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-white">
                  {programTitle}
                </h2>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300 border border-green-200 dark:border-green-800">
                  خاص بطلاب جامع عبري فقط ({toArabicDigits(ibriStudents.length)} طالب)
                </span>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 pt-1">
                  حدد رقم الأسبوع الدراسي للمتابعة
                </p>
              </div>

              <input
                type="number"
                value={weekNumber === '' || isNaN(Number(weekNumber)) ? '' : weekNumber}
                onChange={e => {
                  const p = parseInt(e.target.value, 10);
                  setWeekNumber(isNaN(p) || p <= 0 ? '' : p);
                }}
                className="input-style text-center text-3xl sm:text-4xl font-black h-20 w-36 sm:w-44 mx-auto rounded-2xl shadow-inner border-2 border-green-500"
                placeholder="0"
                autoFocus
              />

              <button
                onClick={() => weekNumber && setStep(2)}
                className="w-full py-3.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-black text-base disabled:opacity-50 shadow-md active:scale-95 transition-all cursor-pointer min-h-[48px]"
                disabled={!weekNumber}
              >
                متابعة واختيار الطلاب ←
              </button>
            </div>
          )}

          {/* الخطوة 2: اختيار الطلاب متناسق 100% مع شاشات الهواتف */}
          {step === 2 && (
            <div className="space-y-3.5 animate-fade-in">
              {/* شريط رأس متجاوب */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="font-black text-sm sm:text-base text-gray-900 dark:text-white truncate">
                      طلاب جامع عبري ({toArabicDigits(stats.totalStudents)})
                    </h2>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/60 text-green-900 dark:text-green-200 rounded-md text-[11px] font-black">
                      أسبوع {toArabicDigits(weekNumber)}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block sm:inline">
                    {programTitle}
                  </span>
                </div>
                <button 
                  onClick={() => setStep(1)} 
                  className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>🔄</span>
                  <span>تغيير الأسبوع</span>
                </button>
              </div>

              {/* بطاقة توضيحية لتمييز الغياب مع شارات إحصائية متناسقة */}
              <div className="bg-gradient-to-r from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/30 p-2.5 sm:p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-rose-950 dark:text-rose-200">
                  <span className="text-base shrink-0">💡</span>
                  <p className="text-[11px] sm:text-xs font-bold leading-snug">
                    الطلاب الذين تم تقييمهم كحاضرين يختفون تلقائياً من القائمة، بينما يظهر الغائبون والمتأخرون وغير المقيّمين بعد.
                  </p>
                </div>

                {/* إحصائيات الغياب المتناسقة لشاشة الهاتف */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                  <div className="px-2 py-1 bg-red-600 text-white rounded-lg text-center font-black text-[11px] shadow-2xs flex items-center justify-center gap-1">
                    <span>🚫 غائب:</span>
                    <span>{toArabicDigits(stats.absentCount)}</span>
                  </div>
                  <div className="px-2 py-1 bg-amber-500 text-white rounded-lg text-center font-black text-[11px] shadow-2xs flex items-center justify-center gap-1">
                    <span>📝 مستأذن:</span>
                    <span>{toArabicDigits(stats.excusedCount)}</span>
                  </div>
                  {(programType === 'asr' || stats.lateCount > 0) ? (
                    <div className="px-2 py-1 bg-orange-500 text-white rounded-lg text-center font-black text-[11px] shadow-2xs flex items-center justify-center gap-1 col-span-2 sm:col-span-1">
                      <span>⏰ متأخر:</span>
                      <span>{toArabicDigits(stats.lateCount)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* خيارات التاريخ والوقت لتسجيل الغياب الجديد */}
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-100 dark:border-gray-700">
                <div>
                  <label className="block text-[10px] font-black text-gray-600 dark:text-gray-300 mb-0.5">
                    تاريخ التسجيل:
                  </label>
                  <input
                    type="date"
                    value={attDate}
                    onChange={e => setAttDate(e.target.value)}
                    className="input-style py-1 px-2 text-xs w-full"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-600 dark:text-gray-300 mb-0.5">
                    وقت التسجيل:
                  </label>
                  <input
                    type="time"
                    value={attTime}
                    onChange={e => setAttTime(e.target.value)}
                    className="input-style py-1 px-2 text-xs w-full"
                  />
                </div>
              </div>

              {/* شريط البحث وفلاتر العرض المتناسقة للهاتف */}
              <div className="space-y-2">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="ابحث عن اسم طالب في جامع عبري..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="input-style w-full pl-8 py-2 text-xs sm:text-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-200 flex items-center justify-center text-[10px] font-bold cursor-pointer"
                      title="مسح البحث"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* أزرار التصفية مقسمة لثلاثة أعمدة متساوية على الهاتف */}
                <div className="grid grid-cols-3 gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterView('all')}
                    className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer text-center truncate ${
                      filterView === 'all'
                        ? 'bg-green-700 text-white shadow-2xs'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    الكل ({toArabicDigits(stats.totalStudents)})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterView('absent')}
                    className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer text-center truncate ${
                      filterView === 'absent'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    🚫 المسجلون ({toArabicDigits(stats.totalRecorded)})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterView('notAbsent')}
                    className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer text-center truncate ${
                      filterView === 'notAbsent'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    }`}
                  >
                    غير المسجلين ({toArabicDigits(stats.totalStudents - stats.totalRecorded)})
                  </button>
                </div>
              </div>

              {/* قائمة الطلاب متوافقة وسريعة التمرير على الهاتف */}
              <div className="max-h-[460px] overflow-y-auto space-y-2 pr-0.5">
                {filteredStudents.length === 0 ? (
                  <div className="p-6 text-center bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <p className="text-gray-400 font-bold text-xs sm:text-sm">لا يوجد طلاب يطابقون خيارات البحث.</p>
                  </div>
                ) : (
                  filteredStudents.map(student => {
                    const info = studentAttendanceMap.get(student.id);
                    const isAbsent = !!info?.isAbsent;
                    const status = info?.status;
                    const isLate = status === MaghribAttendanceStatus.LATE;
                    const isExcused = status === MaghribAttendanceStatus.EXCUSED;

                    return (
                      <div
                        key={student.id}
                        onClick={() => handleStudentClick(student)}
                        className={`p-3 sm:p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none active:scale-[0.99] touch-manipulation ${
                          isAbsent
                            ? isExcused
                              ? 'bg-amber-50 hover:bg-amber-100/80 border-amber-400 dark:bg-amber-950/40 dark:border-amber-700 text-amber-950 dark:text-amber-100 shadow-2xs'
                              : 'bg-rose-50 hover:bg-rose-100/90 border-rose-400 dark:bg-rose-950/40 dark:border-rose-700 text-rose-950 dark:text-rose-100 shadow-2xs'
                            : isLate
                            ? 'bg-orange-50 hover:bg-orange-100/90 border-orange-400 dark:bg-orange-950/40 dark:border-orange-700 text-orange-950 dark:text-orange-100 shadow-2xs'
                            : 'bg-gray-50 hover:bg-green-50/80 rounded-xl border-gray-200 dark:bg-gray-700 dark:border-gray-600 text-gray-800 dark:text-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-black text-xs sm:text-sm ${isAbsent ? 'text-rose-950 dark:text-rose-100' : ''}`}>
                                {student.name}
                              </span>
                              {student.isAlAmeen && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                                  أمين
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block truncate mt-0.5">
                              {halaqas.find(h => h.id === student.halaqaId)?.name || 'حلقة غير محددة'}
                            </span>
                          </div>

                          {/* الشارات المدمجة للهاتف */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            {isAbsent ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-black shadow-2xs flex items-center gap-1 ${
                                  isExcused
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-red-600 text-white'
                                }`}>
                                  <span>{isExcused ? '📝' : '🚫'}</span>
                                  <span>{isExcused ? 'مستأذن' : 'غائب'}</span>
                                </span>
                                <span className="text-[9px] text-rose-700 dark:text-rose-300 font-bold bg-white/80 dark:bg-gray-800/80 px-1.5 py-0.2 rounded-md border border-rose-200 dark:border-rose-800">
                                  تعديل/حذف ⚙️
                                </span>
                              </div>
                            ) : isLate ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-black bg-orange-500 text-white shadow-2xs flex items-center gap-1">
                                  <span>⏰</span>
                                  <span>متأخر</span>
                                </span>
                                <span className="text-[9px] text-orange-700 dark:text-orange-300 font-bold">
                                  تعديل/حذف ⚙️
                                </span>
                              </div>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-600">
                                + تسجيل
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* الخطوة 3: تسجيل الغياب لطالب غير مسجل متناسق في شاشة الهاتف */}
          {step === 3 && selectedStudent && (
            <div className="text-center space-y-4 animate-fade-in max-w-md mx-auto py-2">
              <div className="space-y-1">
                <span className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 inline-flex items-center justify-center text-xl mx-auto shadow-inner">
                  👤
                </span>
                <h2 className="text-lg sm:text-2xl font-black text-green-900 dark:text-green-300">
                  {selectedStudent.name}
                </h2>
                <p className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400">
                  {halaqas.find(h => h.id === selectedStudent.halaqaId)?.name || 'جامع عبري'} · أسبوع {toArabicDigits(weekNumber)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/60 p-2.5 rounded-xl inline-block border dark:border-gray-600 text-[11px] text-gray-600 dark:text-gray-300 font-bold">
                التسجيل في: <span className="font-black text-gray-900 dark:text-white">{toArabicDigits(attDate)}</span> · الساعة <span className="font-black text-gray-900 dark:text-white">{attTime}</span>
              </div>

              {existingRecord && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 p-2.5 rounded-xl text-right animate-pulse space-y-0.5">
                  <p className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>تنبيه: يوجد سجل سابق لهذا الطالب في هذا الأسبوع</span>
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    الحالة الحالية: <span className="font-black underline">{translationMap[existingRecord.status]}</span>
                  </p>
                </div>
              )}

              {/* أزرار تحديد الحالة متناسقة في شاشة الهاتف */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleAttendance(MaghribAttendanceStatus.ABSENT)}
                  className={`py-5 sm:py-8 rounded-xl text-lg sm:text-2xl font-black transition-all border-2 flex flex-col items-center justify-center gap-1 cursor-pointer touch-manipulation ${
                    existingRecord?.status === MaghribAttendanceStatus.ABSENT
                      ? 'bg-red-100 border-red-600 text-red-800 shadow-inner scale-102'
                      : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
                  }`}
                >
                  <span className="text-2xl sm:text-3xl">🚫</span>
                  <span>غائب</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAttendance(MaghribAttendanceStatus.EXCUSED)}
                  className={`py-5 sm:py-8 rounded-xl text-lg sm:text-2xl font-black transition-all border-2 flex flex-col items-center justify-center gap-1 cursor-pointer touch-manipulation ${
                    existingRecord?.status === MaghribAttendanceStatus.EXCUSED
                      ? 'bg-amber-100 border-amber-600 text-amber-800 shadow-inner scale-102'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                  }`}
                >
                  <span className="text-2xl sm:text-3xl">📝</span>
                  <span>مستأذن</span>
                </button>

                {programType === 'asr' ? (
                  <button
                    type="button"
                    onClick={() => handleAttendance(MaghribAttendanceStatus.LATE)}
                    className={`py-5 sm:py-8 rounded-xl text-lg sm:text-2xl font-black transition-all border-2 flex flex-col items-center justify-center gap-1 cursor-pointer touch-manipulation col-span-2 sm:col-span-1 ${
                      existingRecord?.status === MaghribAttendanceStatus.LATE
                        ? 'bg-orange-100 border-orange-600 text-orange-800 shadow-inner scale-102'
                        : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl">⏰</span>
                    <span>متأخر</span>
                  </button>
                ) : null}
              </div>

              {/* إذا كان هناك سجل سابق، يمكن حذفه مباشرة من هنا أيضاً */}
              {existingRecord && (
                <button
                  type="button"
                  onClick={handleDeleteFromStep3}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation min-h-[44px]"
                >
                  <span>🗑️</span>
                  <span>حذف هذا الغياب وإلغاء تسجيله</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-2.5 bg-gray-200 hover:bg-gray-300 rounded-xl font-bold text-xs sm:text-sm dark:bg-gray-700 dark:text-gray-200 transition-colors cursor-pointer min-h-[40px]"
              >
                ← رجوع لقائمة الطلاب
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
