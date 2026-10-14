import React, { useState, useMemo, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import { 
  normalizeParentPhone, 
  matchesParentPhone,
  getParentRandomCode
} from '../utils/parentReportUtils';
import { 
  AttendanceStatus, 
  EvaluationType, 
  Student, 
  Evaluation 
} from '../types';
import { 
  User as UserIcon, 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Printer, 
  Share2, 
  Moon, 
  Sun, 
  ShieldAlert, 
  Filter, 
  Layers, 
  ChevronDown,
  Sparkles,
  PhoneCall,
  Hash,
  Award
} from 'lucide-react';
import Logo from './Logo';

interface ParentPortalProps {
  parentPhone: string;
  onExit?: () => void;
}

export const ParentPortal: React.FC<ParentPortalProps> = ({ parentPhone }) => {
  const context = useContext(AppContext);
  const appName = context?.appName || 'مشروع إعداد حافظ';
  const darkMode = context?.darkMode || false;
  const toggleDarkMode = context?.toggleDarkMode || (() => {});
  const parentReportsEnabled = context?.parentReportsEnabled ?? true;

  const rawStudents = context?.students || [];
  const rawEvaluations = context?.evaluations || [];
  const halaqas = context?.halaqas || [];
  const users = context?.users || [];

  const cleanPhone = useMemo(() => normalizeParentPhone(parentPhone), [parentPhone]);

  // استخراج الكود العشوائي لولي الأمر سواء من الرابط أو التوليد المتسق
  const parentCode = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        const c = url.searchParams.get('code') || url.searchParams.get('token');
        if (c && c.trim()) return c.trim();
      } catch (_) {}
    }
    return getParentRandomCode(cleanPhone || parentPhone);
  }, [cleanPhone, parentPhone]);

  // البحث عن الطلاب المطابقين لهذا الرقم
  const matchedStudents = useMemo(() => {
    const list = rawStudents.filter(s => matchesParentPhone(s.parentPhone, cleanPhone));
    
    // بيانات نموذجية لتجربة التقرير في حال كان الرقم 99375259
    if (list.length === 0 && (cleanPhone === '99375259' || cleanPhone.endsWith('99375259'))) {
      const demoStudents: Student[] = [
        {
          id: 993701,
          name: 'مالك بن هلال بن محمد الصارخي',
          halaqaId: 1,
          schoolStage: 'الصف السادس',
          parentPhone: '9937 5259',
          isFromIbri: true,
          updatedAt: Date.now()
        },
        {
          id: 993702,
          name: 'محمد بن منير بن محمد الصارخي',
          halaqaId: 2,
          schoolStage: 'الصف السادس',
          parentPhone: '9937 5259',
          isFromIbri: true,
          updatedAt: Date.now()
        }
      ];
      return demoStudents;
    }

    return list;
  }, [rawStudents, cleanPhone]);

  // اختيار الطالب النشط (أو 'all' لعرض كافة الأبناء)
  const [selectedStudentId, setSelectedStudentId] = useState<number | 'all'>('all');

  // قائمة الأسابيع المتوفرة في النظام للفرز (تقارير الحفظ فقط)
  const availableWeeks = useMemo(() => {
    const weekSet = new Set<number>();
    
    matchedStudents.forEach(st => {
      rawEvaluations.filter(e => e.studentId === st.id).forEach(e => {
        if (e.weekNumber) weekSet.add(e.weekNumber);
      });
    });

    if (weekSet.size === 0) {
      weekSet.add(1);
      weekSet.add(2);
      weekSet.add(3);
    }

    return Array.from(weekSet).sort((a, b) => a - b);
  }, [matchedStudents, rawEvaluations]);

  // الأسبوع الأخير المتوفر (الأحدث)
  const latestWeek = useMemo(() => {
    return availableWeeks.length > 0 ? availableWeeks[availableWeeks.length - 1] : 1;
  }, [availableWeeks]);

  // اختيار الأسبوع المحدد (الافتراضي هو الأسبوع الأخير)
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>(() => {
    return availableWeeks.length > 0 ? availableWeeks[availableWeeks.length - 1] : 1;
  });

  const [hasManuallySelectedWeek, setHasManuallySelectedWeek] = useState(false);

  // ضبط عنوان الصفحة في المتصفح لولي الأمر
  useEffect(() => {
    document.title = 'إعداد حافظ';
  }, []);

  // ضبط الأسبوع الافتراضي تلقائياً إلى الأسبوع الأخير فور توفر الأسابيع
  useEffect(() => {
    if (!hasManuallySelectedWeek && availableWeeks.length > 0) {
      setSelectedWeek(availableWeeks[availableWeeks.length - 1]);
    }
  }, [availableWeeks, hasManuallySelectedWeek]);

  // الطلاب المعروضون حالياً بناء على الفرز
  const displayedStudents = useMemo(() => {
    if (selectedStudentId === 'all') return matchedStudents;
    return matchedStudents.filter(s => s.id === selectedStudentId);
  }, [matchedStudents, selectedStudentId]);

  // جلب تقييمات الحفظ للطلاب
  const getStudentEvaluations = (studentId: number): Evaluation[] => {
    const evals = rawEvaluations.filter(e => e.studentId === studentId);
    if (evals.length > 0) {
      return selectedWeek === 'all' ? evals : evals.filter(e => e.weekNumber === selectedWeek);
    }
    // بيانات نموذجية لعرض التجربة
    if (studentId === 993701 || studentId === 993702) {
      const demo: Evaluation[] = [
        {
          id: studentId * 10 + 1,
          studentId: studentId,
          halaqaId: 1,
          weekNumber: 1,
          attendance: AttendanceStatus.PRESENT,
          evaluationType: EvaluationType.MEMORIZATION,
          pages: 4,
          surahs: ['الملك', 'القلم'],
          performance: 'ممتاز' as any,
          evalFathErrors: 0,
          evalTashkeelErrors: 1,
          evalTajweedErrors: 0,
          notes: 'ما شاء الله، إتقان ممتاز ومتابعة جيدة للورد.',
          updatedAt: Date.now() - 86400000 * 7
        },
        {
          id: studentId * 10 + 2,
          studentId: studentId,
          halaqaId: 1,
          weekNumber: 2,
          attendance: AttendanceStatus.PRESENT,
          evaluationType: EvaluationType.REVIEW,
          pages: 5,
          surahs: ['الحاقة', 'المعارج'],
          performance: 'متقن مع خطأ' as any,
          evalFathErrors: 1,
          evalTashkeelErrors: 0,
          evalTajweedErrors: 1,
          notes: 'حفظ متقن مع تنبيه خفيف على أحكام النون الساكنة.',
          updatedAt: Date.now() - 86400000 * 3
        }
      ];
      return selectedWeek === 'all' ? demo : demo.filter(e => e.weekNumber === selectedWeek);
    }
    return selectedWeek === 'all' ? evals : evals.filter(e => e.weekNumber === selectedWeek);
  };

  const getHalaqaName = (halaqaId?: number) => {
    if (!halaqaId) return 'غير محدد';
    const h = halaqas.find(x => x.id === halaqaId);
    return h ? h.name : 'حلقة عامة';
  };

  const getTeacherName = (halaqaId?: number) => {
    if (!halaqaId) return '—';
    const h = halaqas.find(x => x.id === halaqaId);
    if (!h) return '—';
    const teacher = users.find(u => u.id === h.teacherId);
    return teacher ? teacher.name : '—';
  };

  // شارة حالة الحضور
  const renderAttendanceBadge = (status?: AttendanceStatus) => {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
            <CheckCircle className="w-3.5 h-3.5" /> حاضر
          </span>
        );
      case AttendanceStatus.ABSENT:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
            <XCircle className="w-3.5 h-3.5" /> غائب
          </span>
        );
      case AttendanceStatus.LATE:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
            <Clock className="w-3.5 h-3.5" /> متأخر
          </span>
        );
      case AttendanceStatus.UNPREPARED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300">
            <AlertCircle className="w-3.5 h-3.5" /> غير مستعد
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            مسجل
          </span>
        );
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `تقرير ولي الأمر - ${appName}`,
          text: `تقرير متابعة حفظ الأبناء في ${appName}`,
          url: window.location.href,
        });
      } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('تم نسخ رابط التقرير بنجاح!');
      } catch (_) {}
    }
  };

  // حالة تعطيل التقارير من قِبل المشرف
  if (!parentReportsEnabled) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white" dir="rtl">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-200 dark:border-slate-800 text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black mb-2 text-gray-900 dark:text-white">
            التقرير غير متاح حالياً
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
            عذراً، خدمة الاطلاع على تقارير الطلاب معطلة حالياً من قِبل إدارة البرنامج، يُرجى المتابعة لاحقاً أو التواصل مع المشرف.
          </p>
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 font-medium">
            💡 يتم تفعيل التقارير أسبوعياً فور اكتمال رصد التقييمات والحفظ من المعلمين.
          </div>
        </div>
      </div>
    );
  }

  // حالة عدم العثور على طلاب مسجلين بهذا الرقم
  if (matchedStudents.length === 0) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white" dir="rtl">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-200 dark:border-slate-800 text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-9 h-9" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black mb-2 text-gray-900 dark:text-white">
            لم يتم العثور على بيانات
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            لم نتمكن من العثور على طالب مسجل برقم الهاتف:
          </p>
          <div className="inline-block px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 font-mono font-black text-lg text-emerald-600 dark:text-emerald-400 mb-6" dir="ltr">
            {parentPhone}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            يُرجى التأكد من الرابط أو التواصل مع إدارة الحلقات لتسجيل رقم هاتف ولي الأمر في ملف الطالب.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 antialiased" dir="rtl">
      {/* رأس الصفحة العلوية - متوافق مع Safari ومحسن للموبايل */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 border-b border-gray-200/80 dark:border-slate-800 shadow-xs print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-xs overflow-hidden text-white shrink-0">
              <Logo className="w-8 h-8 object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate">
                  {appName}
                </h1>
                <span className="text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 shrink-0">
                  بوابة ولي الأمر
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
                تقرير الحفظ والمراجعة الأسبوعي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleDarkMode}
              title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
            <button
              type="button"
              onClick={handleShare}
              title="مشاركة الرابط"
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePrint}
              title="طباعة التقرير"
              className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي للموبايل والشاشات */}
      <main className="max-w-3xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
        
        {/* بطاقة الترحيب والتعريف برقم الهاتف والكود */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-4 sm:p-6 text-white shadow-md relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-emerald-100 text-xs font-semibold mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>مرحباً بكم يا ولي الأمر الكريم</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black">
                تقرير الحفظ والمراجعة الأسبوعي
              </h2>
              <p className="text-emerald-100 text-xs mt-0.5">
                متابعة مباشرة وموثقة لتقدم الأبناء في الحفظ والمواظبة
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="bg-white/15 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs border border-white/20">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-200" />
                <span className="font-mono font-bold" dir="ltr">{parentPhone}</span>
              </div>
              {parentCode && (
                <div className="bg-white/20 rounded-xl px-2.5 py-1.5 flex items-center gap-1 text-[11px] font-mono font-black border border-white/25" title="كود التقرير المعتمد">
                  <Hash className="w-3 h-3 text-amber-200" />
                  <span>{parentCode}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 1. فرز الأبناء إذا كان مسجلاً أكثر من طالب */}
        {matchedStudents.length > 1 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 shadow-xs border border-gray-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-emerald-600" />
                الأبناء المسجلون ({matchedStudents.length}):
              </span>
              <span className="text-[11px] text-gray-400">اختر طالباً أو اعرض الكل</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedStudentId('all')}
                className={`py-1.5 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                  selectedStudentId === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                جميع الأبناء ({matchedStudents.length})
              </button>

              {matchedStudents.map(student => (
                <button
                  type="button"
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                    selectedStudentId === student.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  {student.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. زر قائمة منسدلة لاختيار رقم الأسبوع أو الكل (مطلوب بدقة) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 shadow-xs border border-gray-200/70 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <label htmlFor="parent-week-dropdown" className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-200">
                تصفية تقرير الأسبوع:
              </label>
            </div>

            <div className="relative w-full sm:w-72">
              <select
                id="parent-week-dropdown"
                value={selectedWeek === 'all' ? 'all' : String(selectedWeek)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedWeek(val === 'all' ? 'all' : Number(val));
                  setHasManuallySelectedWeek(true);
                }}
                className="w-full appearance-none pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 font-bold text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
              >
                {availableWeeks.map(wk => (
                  <option key={wk} value={wk}>
                    الأسبوع {wk} {wk === latestWeek ? ' (الأسبوع الأخير ⭐)' : ''}
                  </option>
                ))}
                <option value="all">جميع الأسابيع (سجل الحفظ الكامل)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* 3. بطاقات تفاصيل الطلاب - تقسيمات واضحة وسلسة على الهاتف */}
        <div className="space-y-4">
          {displayedStudents.map(student => {
            const studentEvals = getStudentEvaluations(student.id);
            const totalPages = studentEvals.reduce((acc, curr) => acc + (curr.pages || 0), 0);
            const presentCount = studentEvals.filter(e => e.attendance === AttendanceStatus.PRESENT).length;
            const absentCount = studentEvals.filter(e => e.attendance === AttendanceStatus.ABSENT).length;

            return (
              <div
                key={student.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-xs border border-gray-200/80 dark:border-slate-800 space-y-4"
              >
                {/* رأس بطاقة الطالب */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                          {student.name}
                        </h3>
                        {student.schoolStage && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300">
                            {student.schoolStage}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
                        <span>الحلقة: <strong className="text-gray-800 dark:text-gray-200">{getHalaqaName(student.halaqaId)}</strong></span>
                        <span>• المعلم: <strong className="text-gray-800 dark:text-gray-200">{getTeacherName(student.halaqaId)}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* ملخص الأرقام - حفظ وحضور فقط */}
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl px-3 py-2 text-center">
                      <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">صفحات الحفظ</div>
                      <div className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400">{totalPages} ص</div>
                    </div>
                    <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-900/40 rounded-xl px-3 py-2 text-center">
                      <div className="text-[10px] font-bold text-teal-800 dark:text-teal-300">مرات الحضور</div>
                      <div className="text-base sm:text-lg font-black text-teal-700 dark:text-teal-400">{presentCount}</div>
                    </div>
                  </div>
                </div>

                {/* قسم سجل الحفظ والمراجعة فقط (تم حذف السرد) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>سجل الحفظ والمراجعة</span>
                      {selectedWeek !== 'all' ? (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">(الأسبوع {selectedWeek})</span>
                      ) : (
                        <span className="text-xs text-gray-500 font-normal">(كافة الأسابيع)</span>
                      )}
                    </h4>
                    <span className="text-[11px] text-gray-500 font-bold">{studentEvals.length} تقييم</span>
                  </div>

                  {studentEvals.length === 0 ? (
                    <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-5 text-center text-gray-500 text-xs">
                      لم يتم تسجيل تقييمات حفظ لهذا الأسبوع بعد.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {studentEvals.map(ev => (
                        <div
                          key={ev.id}
                          className="bg-gray-50 dark:bg-slate-800/60 rounded-2xl p-3.5 sm:p-4 border border-gray-200/60 dark:border-slate-700/60 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                              الأسبوع {ev.weekNumber}
                            </span>
                            {renderAttendanceBadge(ev.attendance)}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                              <span className="text-gray-500 block text-[11px]">نوع التقييم:</span>
                              <span className="font-bold text-gray-800 dark:text-gray-200">
                                {ev.evaluationType === EvaluationType.MEMORIZATION ? 'حفظ جديد' : ev.evaluationType === EvaluationType.REVIEW ? 'مراجعة' : 'غير مستعد'}
                              </span>
                            </div>
                            <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                              <span className="text-gray-500 block text-[11px]">الصفحات المنجزة:</span>
                              <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                {ev.pages || 0} صفحة
                              </span>
                            </div>
                            {ev.surahs && ev.surahs.length > 0 && (
                              <div className="col-span-2 bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
                                <span className="text-gray-500 block text-[11px]">السور المقروءة:</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                  {ev.surahs.join('، ')}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* مستوى الأداء وحصيلة الأخطاء */}
                          <div className="bg-white dark:bg-slate-900/90 rounded-xl p-2.5 border border-gray-100 dark:border-slate-800 text-xs flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-gray-500 text-[11px]">الأداء:</span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {ev.performance || 'ممتاز'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                              <span>فتح: <strong className="text-gray-900 dark:text-white">{ev.evalFathErrors || 0}</strong></span>
                              <span>• تشكيل: <strong className="text-gray-900 dark:text-white">{ev.evalTashkeelErrors || 0}</strong></span>
                              <span>• تجويد: <strong className="text-gray-900 dark:text-white">{ev.evalTajweedErrors || 0}</strong></span>
                            </div>
                          </div>

                          {/* ملاحظة المعلم إن وجدت */}
                          {ev.notes && (
                            <div className="bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/50 dark:border-amber-900/30 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                              <span className="font-black block text-[11px] mb-0.5 text-amber-800 dark:text-amber-300">توجيه وملاحظة المعلم:</span>
                              {ev.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* بطاقة ختامية وتوثيقية */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 text-center border border-gray-200/70 dark:border-slate-800 space-y-1 print:border-none">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            تم استخراج هذا التقرير الإلكتروني آلياً من نظام <strong className="text-emerald-700 dark:text-emerald-400">{appName}</strong>.
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            نسأل الله تعالى أن يبارك في أبنائنا وأن يجعلهم من حفظة كتابه العاملين به.
          </p>
        </div>
      </main>
    </div>
  );
};
