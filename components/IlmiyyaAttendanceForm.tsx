import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import { AttendanceStatus, AbsenceReason, IlmiyyaAttendance, Student, MaghribAttendanceStatus } from '../types';
import { isTeacherFromOutside, isStudentFromOutside } from '../utils/categoryUtils';
import { isSmartMatch } from '../utils/searchUtils';

interface IlmiyyaAttendanceFormProps {
  teacherId: number;
  onBackToMenu?: () => void;
  initialWeekNumber?: number;
  hideHeader?: boolean;
}

export const IlmiyyaAttendanceForm: React.FC<IlmiyyaAttendanceFormProps> = ({
  teacherId,
  onBackToMenu,
  initialWeekNumber,
  hideHeader = false,
}) => {
  const context = useContext(AppContext);
  const rawHalaqas = context?.halaqas || [];
  const rawSardHalaqas = context?.sardHalaqas || [];
  const ilmiyyaHalaqas = context?.ilmiyyaHalaqas || [];
  const rawStudents = context?.students || [];
  const ilmiyyaAttendances = context?.ilmiyyaAttendances || [];
  const saveIlmiyyaAttendances = context?.saveIlmiyyaAttendances;
  const showToast = context?.showToast || (() => {});
  const currentUser = context?.currentUser;
  const evaluations = context?.evaluations || [];
  const maghribAttendances = context?.maghribAttendances || [];

  // فحص ما إذا كان المعلم من خارج جامع عبري
  const isOutsideTeacher = useMemo(() => {
    return isTeacherFromOutside(teacherId, currentUser, rawHalaqas, rawSardHalaqas);
  }, [teacherId, currentUser, rawHalaqas, rawSardHalaqas]);

  // الحلقات العلمية المكلف بها هذا المعلم (مشتركة بين معلمي جامع عبري وخارج عبري)
  const assignedIlmiyyaHalaqas = useMemo(() => {
    return ilmiyyaHalaqas.filter(h => {
      if (h.teacherIds && Array.isArray(h.teacherIds) && h.teacherIds.length > 0) {
        return h.teacherIds.includes(teacherId);
      }
      return h.teacherId === teacherId;
    });
  }, [ilmiyyaHalaqas, teacherId]);

  const hasNoAssignedIlmiyya = assignedIlmiyyaHalaqas.length === 0;

  const teacherIlmiyyaHalaqas = useMemo(() => {
    return assignedIlmiyyaHalaqas.length > 0 ? assignedIlmiyyaHalaqas : ilmiyyaHalaqas;
  }, [assignedIlmiyyaHalaqas, ilmiyyaHalaqas]);

  const [selectedHalaqaId, setSelectedHalaqaId] = useState<number | null>(() => {
    return teacherIlmiyyaHalaqas[0]?.id || null;
  });

  // إذا تغيرت الحلقات المكلف بها، تأكد من صحة الحلقة المحددة
  useEffect(() => {
    if (teacherIlmiyyaHalaqas.length > 0) {
      if (!selectedHalaqaId || !teacherIlmiyyaHalaqas.some(h => h.id === selectedHalaqaId)) {
        setSelectedHalaqaId(teacherIlmiyyaHalaqas[0].id);
      }
    } else {
      setSelectedHalaqaId(null);
    }
  }, [teacherIlmiyyaHalaqas, selectedHalaqaId]);

  const [selectedWeek, setSelectedWeek] = useState<number>(() => {
    return initialWeekNumber || context?.lastUsedWeek || 1;
  });

  useEffect(() => {
    if (initialWeekNumber && initialWeekNumber !== selectedWeek) {
      setSelectedWeek(initialWeekNumber);
    }
  }, [initialWeekNumber]);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'present' | 'absent'>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | 'ibri' | 'outside'>('all');
  const [showGuestList, setShowGuestList] = useState(false);

  // خريطة حالة التحضير لكل طالب: studentId -> { status, reason, notes }
  const [attendanceMap, setAttendanceMap] = useState<
    Record<number, { status: AttendanceStatus; reason?: AbsenceReason; notes?: string }>
  >({});

  const [isSaving, setIsSaving] = useState(false);

  const selectedHalaqa = useMemo(() => {
    return teacherIlmiyyaHalaqas.find(h => h.id === selectedHalaqaId) || teacherIlmiyyaHalaqas[0];
  }, [teacherIlmiyyaHalaqas, selectedHalaqaId]);

  // طلاب الأمين المتاحون
  // الحلقات العلمية مشتركة بين معلمي جامع عبري وخارج عبري، بحيث يظهر جميع طلاب الأمين سواء كانوا في جامع عبري أو خارج عبري
  const availableStudents = useMemo(() => {
    return rawStudents.filter(s => {
      // خاصة بطلاب الأمين - مشتركة ليظهر جميع طلاب الأمين سواء كان في جامع عبري أو خارج عبري
      return !!s.isAlAmeen;
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [rawStudents]);

  // تحميل بيانات التحضير المسجلة مسبقاً لهذا الأسبوع والحلقة، أو التعيين الافتراضي (الكل حاضر)
  useEffect(() => {
    if (!selectedHalaqaId) return;

    const existingRecords = ilmiyyaAttendances.filter(
      a => a.ilmiyyaHalaqaId === selectedHalaqaId && Number(a.weekNumber) === Number(selectedWeek)
    );

    const newMap: Record<number, { status: AttendanceStatus; reason?: AbsenceReason; notes?: string }> = {};

    if (existingRecords.length > 0) {
      existingRecords.forEach(rec => {
        newMap[rec.studentId] = {
          status: rec.status,
          reason: rec.absenceReason,
          notes: rec.notes || '',
        };
      });
      // للطلاب الذين ليس لديهم سجل بعد في هذا الأسبوع، نضعهم كحاضرين افتراضياً
      availableStudents.forEach(s => {
        if (!newMap[s.id]) {
          newMap[s.id] = { status: AttendanceStatus.PRESENT };
        }
      });
    } else {
      // تعيين افتراضي: الكل حاضر
      availableStudents.forEach(s => {
        newMap[s.id] = { status: AttendanceStatus.PRESENT };
      });
    }

    setAttendanceMap(newMap);
  }, [selectedHalaqaId, selectedWeek, ilmiyyaAttendances, availableStudents]);

  // إحصائيات التحضير المباشرة
  const stats = useMemo(() => {
    let present = 0;
    let absentExcused = 0;
    let absentUnexcused = 0;

    availableStudents.forEach(s => {
      const att = attendanceMap[s.id];
      if (!att || att.status === AttendanceStatus.PRESENT) {
        present++;
      } else if (att.reason === AbsenceReason.WITH_EXCUSE) {
        absentExcused++;
      } else {
        absentUnexcused++;
      }
    });

    const total = availableStudents.length;
    const totalAbsent = absentExcused + absentUnexcused;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absentExcused, absentUnexcused, totalAbsent, rate };
  }, [availableStudents, attendanceMap]);

  // تحديد حالة طالب فردي
  const setStudentAttendance = (studentId: number, status: AttendanceStatus, reason?: AbsenceReason) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        reason: status === AttendanceStatus.ABSENT ? reason : undefined,
      },
    }));
  };

  const setStudentNotes = (studentId: number, notes: string) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: prev[studentId]?.status || AttendanceStatus.PRESENT,
        notes,
      },
    }));
  };

  // إجراءات جماعية سريعة
  const handleMarkAllPresent = () => {
    const updated: Record<number, { status: AttendanceStatus; reason?: AbsenceReason; notes?: string }> = {};
    availableStudents.forEach(s => {
      updated[s.id] = {
        ...attendanceMap[s.id],
        status: AttendanceStatus.PRESENT,
        reason: undefined,
      };
    });
    setAttendanceMap(updated);
    showToast('✅ تم تحديد جميع الطلاب كحاضرين');
  };

  const handleMarkAllAbsent = (reason: AbsenceReason) => {
    const updated: Record<number, { status: AttendanceStatus; reason?: AbsenceReason; notes?: string }> = {};
    availableStudents.forEach(s => {
      updated[s.id] = {
        ...attendanceMap[s.id],
        status: AttendanceStatus.ABSENT,
        reason,
      };
    });
    setAttendanceMap(updated);
    showToast(reason === AbsenceReason.WITH_EXCUSE ? '⚠️ تم تحديد الكل غياب بعذر' : '❌ تم تحديد الكل غياب بدون عذر');
  };

  // حفظ التحضير
  const handleSave = () => {
    if (!selectedHalaqaId) {
      showToast('الرجاء اختيار الحلقة العلمية', 'error');
      return;
    }
    if (availableStudents.length === 0) {
      showToast('لا يوجد طلاب مسجلين في الحلقة العلمية', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const recordsToSave: Omit<IlmiyyaAttendance, 'id' | 'updatedAt'>[] = availableStudents.map(student => {
        const att = attendanceMap[student.id] || { status: AttendanceStatus.PRESENT };
        return {
          studentId: student.id,
          ilmiyyaHalaqaId: selectedHalaqaId,
          teacherId,
          weekNumber: selectedWeek,
          date: selectedDate,
          status: att.status,
          absenceReason: att.status === AttendanceStatus.ABSENT ? (att.reason || AbsenceReason.WITHOUT_EXCUSE) : undefined,
          notes: att.notes?.trim() || undefined,
        };
      });

      if (saveIlmiyyaAttendances) {
        saveIlmiyyaAttendances(recordsToSave);
      }

      showToast(`✅ تم حفظ كشف غياب الحلقة العلمية بنجاح (${availableStudents.length} طالب)`);
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء حفظ التحضير', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // تصفية الطلاب بحسب البحث وحالة الحضور والقسم (جامع عبري / خارج عبري)
  const filteredStudents = useMemo(() => {
    return availableStudents.filter(s => {
      if (searchQuery.trim() && !isSmartMatch(s.name, searchQuery)) return false;

      if (sectionFilter !== 'all') {
        const isOutside = isStudentFromOutside(s, rawHalaqas, rawSardHalaqas, ilmiyyaHalaqas);
        if (sectionFilter === 'outside' && !isOutside) return false;
        if (sectionFilter === 'ibri' && isOutside) return false;
      }

      const att = attendanceMap[s.id];
      const isPresent = !att || att.status === AttendanceStatus.PRESENT;

      if (filterMode === 'present' && !isPresent) return false;
      if (filterMode === 'absent' && isPresent) return false;

      return true;
    });
  }, [availableStudents, searchQuery, attendanceMap, filterMode, sectionFilter, rawHalaqas, rawSardHalaqas, ilmiyyaHalaqas]);

  // إذا لم يكن المعلم مكلفاً بأي حلقة علمية
  if (teacherIlmiyyaHalaqas.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-4xl mx-auto shadow-inner">
          📜
        </div>
        <h3 className="text-2xl font-black text-gray-800 dark:text-white">
          لست مكلفاً بأي حلقة علمية
        </h3>
        <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">
          الحلقات العلمية تظهر فقط للمعلمين الذين قام المشرف بتعيينهم عليها. إذا كنت أحد المعلمين المناوبين، يرجى التواصل مع المشرف لإضافتك إلى الحلقة العلمية.
        </p>
        {onBackToMenu && (
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-6 py-2.5 rounded-xl bg-amber-600 text-white font-black text-sm shadow-md active:scale-95 transition-all cursor-pointer"
          >
            العودة للقائمة الرئيسية
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24 max-w-4xl mx-auto">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white rounded-3xl p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl shadow-inner">
              📜
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black">
                  كشف غياب الحلقة العلمية
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-white/20">
                  خاص بطلاب الأمين
                </span>
              </div>
              <p className="text-amber-100 font-bold text-xs mt-0.5">
                تسجيل الحضور والغياب فقط (بدون درجات أو استمارة تقييم)
              </p>
            </div>
          </div>

          {onBackToMenu && (
            <button
              type="button"
              onClick={onBackToMenu}
              className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 rtl:rotate-0 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span>العودة للقائمة</span>
            </button>
          )}
        </div>

        {/* تنبيه المعلم المتنقل عندما تكون الأسماء مخفية */}
        {hasNoAssignedIlmiyya && !showGuestList ? (
          <div className="bg-amber-950/60 border-2 border-amber-300/40 p-6 rounded-2xl text-center space-y-4 my-4 text-white shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">ℹ️</span>
              <span className="font-black text-amber-200 text-base sm:text-lg">
                معلم متنقل (ليس لديك حلقة علمية مخصصة)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-amber-100 font-bold leading-relaxed max-w-md mx-auto">
              لا توجد لديك حلقة علمية مخصصة. انقر على الزر أدناه لإظهار قائمة الحلقات العلمية والطلاب المتاحين للتحضير.
            </p>
            <button
              type="button"
              onClick={() => setShowGuestList(true)}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer mx-auto"
            >
              <span>🔍</span>
              <span>اختيار طالب من حلقة علمية أخرى</span>
            </button>
          </div>
        ) : (
          <>
            {hasNoAssignedIlmiyya && showGuestList && (
              <div className="flex justify-between items-center bg-amber-950/40 p-3 rounded-xl border border-amber-300/30 text-white mt-4">
                <span className="text-xs font-bold text-amber-200">
                  🔍 يتم عرض طلاب الحلقات العلمية الأخرى (نمط معلم متنقل)
                </span>
                <button
                  type="button"
                  onClick={() => setShowGuestList(false)}
                  className="text-xs font-bold text-amber-300 underline hover:text-white cursor-pointer"
                >
                  إخفاء القائمة والعودة
                </button>
              </div>
            )}

        {/* Controls: Select Halaqa, Week, Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/20">
          {/* Halaqa Selector */}
          <div>
            <label className="block text-xs font-black text-amber-100 mb-1">الحلقة العلمية:</label>
            {teacherIlmiyyaHalaqas.length === 1 ? (
              <div className="px-3.5 py-2 rounded-xl bg-white/10 font-black text-sm text-white border border-white/20">
                {teacherIlmiyyaHalaqas[0].name}
              </div>
            ) : (
              <select
                value={selectedHalaqaId || ''}
                onChange={e => setSelectedHalaqaId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-amber-900/60 border border-white/20 rounded-xl font-bold text-sm text-white focus:outline-hidden"
              >
                {teacherIlmiyyaHalaqas.map(h => (
                  <option key={h.id} value={h.id} className="text-gray-900">
                    {h.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Week Selector */}
          <div>
            <label className="block text-xs font-black text-amber-100 mb-1">الأسبوع:</label>
            <select
              value={selectedWeek}
              onChange={e => setSelectedWeek(Number(e.target.value))}
              className="w-full px-3 py-2 bg-amber-900/60 border border-white/20 rounded-xl font-bold text-sm text-white focus:outline-hidden"
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map(w => (
                <option key={w} value={w} className="text-gray-900">
                  الأسبوع {w}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-black text-amber-100 mb-1">تاريخ التحضير:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-amber-900/60 border border-white/20 rounded-xl font-bold text-sm text-white focus:outline-hidden"
            />
          </div>
        </div>
      </>
    )}
    </div>

      {/* Summary KPI Bar, Quick Actions & Student List - Hidden by default for floating teachers */}
      {(!hasNoAssignedIlmiyya || showGuestList) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-2xs text-center">
          <span className="text-xs text-gray-400 font-bold block">إجمالي طلاب الأمين</span>
          <span className="text-xl font-black text-gray-900 dark:text-white">{stats.total}</span>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-2xl border border-emerald-200/50 dark:border-emerald-800/40 shadow-2xs text-center">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold block">الحضور</span>
          <span className="text-xl font-black text-emerald-800 dark:text-emerald-200">
            {stats.present} <span className="text-xs font-bold text-emerald-600">({stats.rate}%)</span>
          </span>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-2xl border border-amber-200/50 dark:border-amber-800/40 shadow-2xs text-center">
          <span className="text-xs text-amber-700 dark:text-amber-300 font-bold block">غياب بعذر</span>
          <span className="text-xl font-black text-amber-800 dark:text-amber-200">{stats.absentExcused}</span>
        </div>
        <div className="bg-red-50 dark:bg-red-950/40 p-3.5 rounded-2xl border border-red-200/50 dark:border-red-800/40 shadow-2xs text-center">
          <span className="text-xs text-red-700 dark:text-red-300 font-bold block">غياب بدون عذر</span>
          <span className="text-xl font-black text-red-800 dark:text-red-200">{stats.absentUnexcused}</span>
        </div>
      </div>

      {/* Quick Action Bar: Bulk Mark */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs font-black text-gray-700 dark:text-gray-300">
            ⚡ إجراءات التحديد السريع:
          </span>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>✅</span>
              <span>تحديد الكل حضور</span>
            </button>
            <button
              type="button"
              onClick={() => handleMarkAllAbsent(AbsenceReason.WITHOUT_EXCUSE)}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>❌</span>
              <span>الكل غياب (بدون عذر)</span>
            </button>
            <button
              type="button"
              onClick={() => handleMarkAllAbsent(AbsenceReason.WITH_EXCUSE)}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>⚠️</span>
              <span>الكل غياب (بعذر)</span>
            </button>
          </div>
        </div>

        {/* Search & Sub-filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl font-bold focus:ring-2 focus:ring-amber-500"
            />
            <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
          </div>

          {/* فلتر القسم: جامع عبري / خارج عبري / الكل */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-750 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSectionFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  sectionFilter === 'all' ? 'bg-amber-600 text-white shadow-2xs' : 'text-gray-500'
                }`}
              >
                الكل ({availableStudents.length})
              </button>
              <button
                type="button"
                onClick={() => setSectionFilter('ibri')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  sectionFilter === 'ibri' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-gray-500'
                }`}
              >
                <span>🕌</span>
                <span>جامع عبري</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionFilter('outside')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  sectionFilter === 'outside' ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-500'
                }`}
              >
                <span>🌐</span>
                <span>خارج عبري</span>
              </button>
            </div>

            <div className="flex gap-1 bg-gray-100 dark:bg-gray-750 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterMode === 'all' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs' : 'text-gray-500'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('present')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterMode === 'present' ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-2xs' : 'text-gray-500'
                }`}
              >
                الحضور ({stats.present})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('absent')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterMode === 'absent' ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-2xs' : 'text-gray-500'
                }`}
              >
                الغياب ({stats.totalAbsent})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Students List */}
      <div className="space-y-2.5">
        {filteredStudents.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl text-center border border-gray-100 dark:border-gray-700">
            <p className="text-gray-400 font-bold text-sm">
              لا يوجد طلاب يطابقون خيارات البحث.
            </p>
          </div>
        ) : (
          filteredStudents.map((student, idx) => {
            const att = attendanceMap[student.id] || { status: AttendanceStatus.PRESENT };
            const isPresent = att.status === AttendanceStatus.PRESENT;
            const isExcused = att.status === AttendanceStatus.ABSENT && att.reason === AbsenceReason.WITH_EXCUSE;
            const isUnexcused = att.status === AttendanceStatus.ABSENT && att.reason !== AbsenceReason.WITH_EXCUSE;
            const isOutside = isStudentFromOutside(student, rawHalaqas, rawSardHalaqas, ilmiyyaHalaqas);
            const isAbsentInAsr = (evaluations || []).some(
              e => e.studentId === student.id && 
                   Number(e.weekNumber) === Number(selectedWeek) && 
                   e.subject !== 'mutoon' && 
                   !e.isTest && 
                   e.attendance === AttendanceStatus.ABSENT
            ) || (maghribAttendances || []).some(
              m => m.studentId === student.id && 
                   Number(m.weekNumber) === Number(selectedWeek) && 
                   m.programType === 'asr' && 
                   (m.status === MaghribAttendanceStatus.ABSENT || m.status === MaghribAttendanceStatus.EXCUSED)
            );

            return (
              <div
                key={student.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isPresent
                    ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/80'
                    : isExcused
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60 shadow-2xs'
                      : 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800/60 shadow-2xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Student Info */}
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-black shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-sm sm:text-base text-gray-900 dark:text-white">
                          {student.name}
                        </span>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                          طالب أمين
                        </span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                          isOutside
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                        }`}>
                          {isOutside ? '🌐 خارج عبري' : '🕌 جامع عبري'}
                        </span>
                        {isAbsentInAsr && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200 border border-rose-300 dark:border-rose-800 inline-flex items-center gap-1">
                            ⚠️ مسجل غائب في برنامج العصر
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 font-bold">
                        {student.schoolStage || 'طالب أمين'}
                      </span>
                    </div>
                  </div>

                  {/* Attendance Toggle Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* الحضور */}
                    <button
                      type="button"
                      onClick={() => setStudentAttendance(student.id, AttendanceStatus.PRESENT)}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                        isPresent
                          ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/30'
                          : 'bg-gray-100 dark:bg-gray-750 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                      }`}
                    >
                      <span>✓</span>
                      <span>حاضر</span>
                    </button>

                    {/* غائب بعذر */}
                    <button
                      type="button"
                      onClick={() => setStudentAttendance(student.id, AttendanceStatus.ABSENT, AbsenceReason.WITH_EXCUSE)}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                        isExcused
                          ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-500/30'
                          : 'bg-gray-100 dark:bg-gray-750 text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                      }`}
                    >
                      <span>⚠️</span>
                      <span>بعذر</span>
                    </button>

                    {/* غائب بدون عذر */}
                    <button
                      type="button"
                      onClick={() => setStudentAttendance(student.id, AttendanceStatus.ABSENT, AbsenceReason.WITHOUT_EXCUSE)}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                        isUnexcused
                          ? 'bg-red-600 text-white shadow-xs ring-2 ring-red-500/30'
                          : 'bg-gray-100 dark:bg-gray-750 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-950/40'
                      }`}
                    >
                      <span>✕</span>
                      <span>بدون عذر</span>
                    </button>
                  </div>
                </div>

                {/* Optional note when absent */}
                {!isPresent && (
                  <div className="mt-2.5 pt-2.5 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-bold shrink-0">ملاحظة:</span>
                    <input
                      type="text"
                      value={att.notes || ''}
                      onChange={e => setStudentNotes(student.id, e.target.value)}
                      placeholder="سبب الغياب أو ملاحظة إضافية (اختياري)..."
                      className="w-full px-3 py-1 text-xs bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-600 rounded-lg font-bold"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-4 left-0 right-0 max-w-4xl mx-auto px-4 z-40">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3.5 rounded-2xl shadow-2xl border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="text-xs font-bold text-gray-600 dark:text-gray-300">
            <span>الأسبوع {selectedWeek}: </span>
            <strong className="text-emerald-600 font-black">{stats.present} حضور</strong>
            <span> / </span>
            <strong className="text-red-600 font-black">{stats.totalAbsent} غياب</strong>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-sm shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>💾</span>
            <span>{isSaving ? 'جاري الحفظ...' : 'حفظ كشف الغياب'}</span>
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
