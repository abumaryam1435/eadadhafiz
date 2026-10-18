import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { UserRole, IlmiyyaHalaqa, User, Student, AttendanceStatus, AbsenceReason } from '../types';
import Modal from './Modal';
import { isSmartMatch } from '../utils/searchUtils';
import { isTeacherFromOutside, isStudentFromOutside } from '../utils/categoryUtils';

export const IlmiyyaManagement: React.FC = () => {
  const context = useContext(AppContext);
  const ilmiyyaHalaqas = context?.ilmiyyaHalaqas || [];
  const users = context?.users || [];
  const students = context?.students || [];
  const halaqas = context?.halaqas || [];
  const sardHalaqas = context?.sardHalaqas || [];
  const ilmiyyaAttendances = context?.ilmiyyaAttendances || [];
  const addIlmiyyaHalaqa = context?.addIlmiyyaHalaqa;
  const updateIlmiyyaHalaqa = context?.updateIlmiyyaHalaqa;
  const deleteIlmiyyaHalaqa = context?.deleteIlmiyyaHalaqa;
  const updateStudent = context?.updateStudent;
  const showToast = context?.showToast || (() => {});

  const [categoryTab, setCategoryTab] = useState<'all' | 'shared' | 'ibri' | 'outside'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHalaqa, setEditingHalaqa] = useState<IlmiyyaHalaqa | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<'shared' | 'ibri' | 'outside'>('shared');
  const [formTeacherFilter, setFormTeacherFilter] = useState<'all' | 'ibri' | 'outside'>('all');
  const [formSelectedTeacherIds, setFormSelectedTeacherIds] = useState<number[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showFormStudentsPreview, setShowFormStudentsPreview] = useState(false);

  // Attendance History Modal
  const [viewingAttendanceHalaqa, setViewingAttendanceHalaqa] = useState<IlmiyyaHalaqa | null>(null);
  const [attendanceWeekFilter, setAttendanceWeekFilter] = useState<number>(1);

  // Confirmation Modal
  const [deleteConfirmHalaqa, setDeleteConfirmHalaqa] = useState<IlmiyyaHalaqa | null>(null);

  // Manage Al-Ameen Students Modal
  const [isStudentsModalOpen, setIsStudentsModalOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Preview Halaqa Students Modal
  const [previewHalaqaStudents, setPreviewHalaqaStudents] = useState<IlmiyyaHalaqa | null>(null);

  // All teachers in the system
  const teachers = useMemo(() => {
    return users
      .filter(u => u.role === UserRole.TEACHER)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [users]);

  // تصنيف المعلمين بحسب جامع عبري وخارج جامع عبري
  const ibriTeachers = useMemo(() => {
    return teachers.filter(t => !isTeacherFromOutside(t.id, t, halaqas, sardHalaqas, ilmiyyaHalaqas));
  }, [teachers, halaqas, sardHalaqas, ilmiyyaHalaqas]);

  const outsideTeachers = useMemo(() => {
    return teachers.filter(t => isTeacherFromOutside(t.id, t, halaqas, sardHalaqas, ilmiyyaHalaqas));
  }, [teachers, halaqas, sardHalaqas, ilmiyyaHalaqas]);

  // طلاب الأمين الإجمالي
  const alAmeenStudents = useMemo(() => {
    return students.filter(s => !!s.isAlAmeen)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [students]);

  // طلاب الأمين التابعين لجامع عبري تلقائياً
  const ibriAlAmeenStudents = useMemo(() => {
    return students.filter(s => !!s.isAlAmeen && s.isFromIbri !== false && !isStudentFromOutside(s, halaqas, sardHalaqas, ilmiyyaHalaqas))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [students, halaqas, sardHalaqas, ilmiyyaHalaqas]);

  // طلاب الأمين التابعين لخارج جامع عبري تلقائياً
  const outsideAlAmeenStudents = useMemo(() => {
    return students.filter(s => !!s.isAlAmeen && isStudentFromOutside(s, halaqas, sardHalaqas, ilmiyyaHalaqas))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [students, halaqas, sardHalaqas, ilmiyyaHalaqas]);

  // المعلمون المتاحون للاختيار في الاستمارة (مشتركة أو بحسب فلتر المعلمين)
  const availableTeachersForForm = useMemo(() => {
    if (formTeacherFilter === 'outside') return outsideTeachers;
    if (formTeacherFilter === 'ibri') return ibriTeachers;
    return teachers;
  }, [formTeacherFilter, outsideTeachers, ibriTeachers, teachers]);

  // طلاب الأمين المشمولين تلقائياً في الحلقة المفتوحة بالاستمارة
  const targetAlAmeenStudentsForForm = useMemo(() => {
    if (formCategory === 'outside') return outsideAlAmeenStudents;
    if (formCategory === 'ibri') return ibriAlAmeenStudents;
    // مشتركة: يظهر جميع طلاب الأمين سواء من جامع عبري أو خارج جامع عبري
    return alAmeenStudents;
  }, [formCategory, outsideAlAmeenStudents, ibriAlAmeenStudents, alAmeenStudents]);

  // Filtered halaqas for main view
  const filteredHalaqas = useMemo(() => {
    return ilmiyyaHalaqas.filter(h => {
      const cat = h.category || 'shared';
      if (categoryTab !== 'all') {
        if (categoryTab === 'shared' && cat !== 'shared') return false;
        if (categoryTab === 'ibri' && cat !== 'ibri') return false;
        if (categoryTab === 'outside' && cat !== 'outside') return false;
      }
      if (searchQuery.trim() && !isSmartMatch(h.name, searchQuery)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [ilmiyyaHalaqas, categoryTab, searchQuery]);

  const openAddModal = () => {
    const defaultCat: 'shared' | 'ibri' | 'outside' = categoryTab === 'outside' ? 'outside' : categoryTab === 'ibri' ? 'ibri' : 'shared';
    setEditingHalaqa(null);
    setFormCategory(defaultCat);
    setFormName(defaultCat === 'outside' ? 'حلقة خارج جامع عبري العلمية' : defaultCat === 'ibri' ? 'حلقة جامع عبري العلمية' : 'الحلقة العلمية المشتركة');
    setFormTeacherFilter('all');
    setFormSelectedTeacherIds([]);
    setTeacherSearch('');
    setShowFormStudentsPreview(false);
    setIsModalOpen(true);
  };

  const openEditModal = (h: IlmiyyaHalaqa) => {
    setEditingHalaqa(h);
    setFormName(h.name);
    setFormCategory((h.category as any) || 'shared');
    const assignedIds = h.teacherIds && h.teacherIds.length > 0
      ? [...h.teacherIds]
      : (h.teacherId ? [h.teacherId] : []);
    setFormSelectedTeacherIds(assignedIds);
    setFormTeacherFilter('all');
    setTeacherSearch('');
    setShowFormStudentsPreview(false);
    setIsModalOpen(true);
  };

  const handleCategoryChange = (newCat: 'shared' | 'ibri' | 'outside') => {
    setFormCategory(newCat);
    if (!formName || formName.includes('العلمية')) {
      setFormName(newCat === 'outside' ? 'حلقة خارج جامع عبري العلمية' : newCat === 'ibri' ? 'حلقة جامع عبري العلمية' : 'الحلقة العلمية المشتركة');
    }
  };

  const handleSaveHalaqa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('الرجاء إدخال اسم الحلقة العلمية', 'error');
      return;
    }

    if (editingHalaqa) {
      if (updateIlmiyyaHalaqa) {
        updateIlmiyyaHalaqa({
          ...editingHalaqa,
          name: formName.trim(),
          category: formCategory,
          teacherId: formSelectedTeacherIds[0] || 0,
          teacherIds: formSelectedTeacherIds,
          updatedAt: Date.now(),
        });
      }
      showToast('✅ تم تعديل الحلقة العلمية وتعيين المعلمين بنجاح');
    } else {
      if (addIlmiyyaHalaqa) {
        addIlmiyyaHalaqa({
          name: formName.trim(),
          category: formCategory,
          teacherId: formSelectedTeacherIds[0] || 0,
          teacherIds: formSelectedTeacherIds,
          updatedAt: Date.now(),
        });
      }
      showToast('✅ تم إضافة الحلقة العلمية بنجاح');
    }

    setIsModalOpen(false);
  };

  const handleDeleteHalaqa = () => {
    if (!deleteConfirmHalaqa) return;
    if (deleteIlmiyyaHalaqa) {
      deleteIlmiyyaHalaqa(deleteConfirmHalaqa.id);
    }
    showToast('🗑️ تم حذف الحلقة العلمية');
    setDeleteConfirmHalaqa(null);
  };

  const toggleTeacherSelection = (tId: number) => {
    setFormSelectedTeacherIds(prev => 
      prev.includes(tId) ? prev.filter(id => id !== tId) : [...prev, tId]
    );
  };

  // Toggle student as Al-Ameen
  const toggleStudentAlAmeen = (st: Student) => {
    if (updateStudent) {
      updateStudent({
        ...st,
        isAlAmeen: !st.isAlAmeen,
        updatedAt: Date.now()
      });
      showToast(st.isAlAmeen ? `تم إلغاء تمييز الطالب "${st.name}" من طلاب الأمين` : `تم تعيين الطالب "${st.name}" كطالب أمين بنجاح`);
    }
  };

  const filteredTeachersForForm = useMemo(() => {
    if (!teacherSearch.trim()) return availableTeachersForForm;
    return availableTeachersForForm.filter(t => isSmartMatch(t.name, teacherSearch));
  }, [availableTeachersForForm, teacherSearch]);

  const filteredStudentsForModal = useMemo(() => {
    if (!studentSearch.trim()) return students;
    return students.filter(s => isSmartMatch(s.name, studentSearch));
  }, [students, studentSearch]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header and stats */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-3xl shadow-inner backdrop-blur-xs">
                📜
              </span>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black">إدارة الحلقات العلمية</h2>
                <p className="text-amber-100 font-bold text-xs sm:text-sm">
                  مشتركة بين معلمي جامع عبري وخارج عبري - يظهر الطلاب لجميع المعلمين المكلفين سواء كانوا في جامع عبري أو خارج جامع عبري
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={openAddModal}
              className="flex-1 md:flex-initial px-5 py-3 rounded-2xl bg-white text-amber-900 hover:bg-amber-50 font-black text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="text-lg">➕</span>
              <span>إضافة حلقة علمية</span>
            </button>
            <button
              type="button"
              onClick={() => setIsStudentsModalOpen(true)}
              className="flex-1 md:flex-initial px-5 py-3 rounded-2xl bg-amber-900/60 hover:bg-amber-900/80 text-white font-black text-sm border border-white/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="text-lg">🎓</span>
              <span>تحديد طلاب الأمين ({alAmeenStudents.length})</span>
            </button>
          </div>
        </div>

        {/* Quick summary badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/20">
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 text-center">
            <span className="text-xs font-bold text-amber-200 block">إجمالي الحلقات</span>
            <span className="text-2xl font-black">{ilmiyyaHalaqas.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 text-center">
            <span className="text-xs font-bold text-amber-200 block">إجمالي طلاب الأمين</span>
            <span className="text-2xl font-black">{alAmeenStudents.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 text-center">
            <span className="text-xs font-bold text-amber-200 block">عبري / خارج عبري</span>
            <span className="text-lg font-black">{ibriAlAmeenStudents.length} / {outsideAlAmeenStudents.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 text-center">
            <span className="text-xs font-bold text-amber-200 block">المعلمون المكلفون</span>
            <span className="text-2xl font-black">
              {new Set(ilmiyyaHalaqas.flatMap(h => h.teacherIds || (h.teacherId ? [h.teacherId] : []))).size}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-wrap gap-1.5 p-1 bg-gray-100 dark:bg-gray-750 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setCategoryTab('all')}
            className={`px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${
              categoryTab === 'all'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
            }`}
          >
            الكل ({ilmiyyaHalaqas.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryTab('shared')}
            className={`px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center gap-1 ${
              categoryTab === 'shared'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
            }`}
          >
            <span>🌟</span>
            <span>مشتركة ({ilmiyyaHalaqas.filter(h => !h.category || h.category === 'shared').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryTab('ibri')}
            className={`px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center gap-1 ${
              categoryTab === 'ibri'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
            }`}
          >
            <span>🕌</span>
            <span>جامع عبري ({ilmiyyaHalaqas.filter(h => h.category === 'ibri').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryTab('outside')}
            className={`px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center gap-1 ${
              categoryTab === 'outside'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
            }`}
          >
            <span>🌐</span>
            <span>خارج عبري ({ilmiyyaHalaqas.filter(h => h.category === 'outside').length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث عن حلقة علمية..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
          <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
        </div>
      </div>

      {/* Halaqas Grid */}
      {filteredHalaqas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
          <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
            📜
          </div>
          <h3 className="text-xl font-black text-gray-800 dark:text-white">لا توجد حلقات علمية حالياً</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-bold max-w-md mx-auto">
            قم بإضافة حلقة علمية مشتركة وتعيين المعلمين المناوبين عليها، وسيظهر طلاب الأمين تلقائياً سواء كانوا في جامع عبري أو خارج عبري.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm shadow-md active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <span>➕ إضافة حلقة علمية مشتركة</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredHalaqas.map(halaqa => {
            const assignedIds = halaqa.teacherIds && halaqa.teacherIds.length > 0
              ? halaqa.teacherIds
              : (halaqa.teacherId ? [halaqa.teacherId] : []);
            
            const assignedTeachers = teachers.filter(t => assignedIds.includes(t.id));
            const cat = halaqa.category || 'shared';
            const isShared = cat === 'shared';
            const isOutside = cat === 'outside';
            const circleStudents = isOutside 
              ? outsideAlAmeenStudents 
              : cat === 'ibri' 
                ? ibriAlAmeenStudents 
                : alAmeenStudents;

            return (
              <div 
                key={halaqa.id}
                className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🏛️</span>
                        <h4 className="text-lg font-black text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">
                          {halaqa.name}
                        </h4>
                      </div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-black ${
                        isShared
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                          : isOutside
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                      }`}>
                        {isShared ? '🌟 حلقة مشتركة' : isOutside ? '🌐 خارج جامع عبري' : '🕌 جامع عبري'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(halaqa)}
                        title="تعديل الحلقة وتعيين المعلمين"
                        className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-amber-50 dark:bg-gray-700 dark:hover:bg-amber-950/40 text-gray-600 hover:text-amber-600 dark:text-gray-300 flex items-center justify-center transition-all cursor-pointer"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmHalaqa(halaqa)}
                        title="حذف الحلقة"
                        className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-red-50 dark:bg-gray-700 dark:hover:bg-red-950/40 text-gray-600 hover:text-red-600 dark:text-gray-300 flex items-center justify-center transition-all cursor-pointer"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Assigned Teachers list */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                      <span>المعلمون المكلفون ({assignedTeachers.length}):</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full">
                        تناوب أسبوعي
                      </span>
                    </div>

                    {assignedTeachers.length === 0 ? (
                      <p className="text-xs text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/30 p-2 rounded-xl text-center">
                        ⚠️ لم يتم تعيين أي معلم بعد! لن تظهر هذه الحلقة إلا للمعلمين المكلفين بها.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                        {assignedTeachers.map(t => {
                          const isTOutside = outsideTeachers.some(ot => ot.id === t.id);
                          return (
                            <span
                              key={t.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200/60 dark:border-amber-800/40 shadow-2xs"
                            >
                              <span>{isTOutside ? '🌐' : '🕌'}</span>
                              <span>{t.name}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom stats and action */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewHalaqaStudents(halaqa)}
                    className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    title="انقر لعرض قائمة الطلاب التابعين للحلقة تلقائياً"
                  >
                    <span>👥 طلاب الأمين:</span>
                    <strong className="font-black text-amber-900 dark:text-amber-200 underline">
                      {circleStudents.length} طالب
                    </strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setViewingAttendanceHalaqa(halaqa);
                      setAttendanceWeekFilter(1);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span>📋</span>
                    <span>سجل الغياب</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Halaqa Modal */}
      {isModalOpen && (
        <Modal
          title={editingHalaqa ? 'تعديل الحلقة العلمية وتعيين المعلمين' : 'إضافة حلقة علمية جديدة'}
          onClose={() => setIsModalOpen(false)}
          hideDefaultCloseButton
        >
          <form onSubmit={handleSaveHalaqa} className="space-y-5">
            <div>
              <label className="block text-sm font-black text-gray-800 dark:text-white mb-1.5">
                اسم الحلقة العلمية *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="مثال: الحلقة العلمية المشتركة"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-black text-gray-800 dark:text-white mb-1.5">
                نوع الحلقة العلمية
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleCategoryChange('shared')}
                  className={`py-2 px-2.5 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer text-center ${
                    formCategory === 'shared'
                      ? 'border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-500 shadow-xs ring-1 ring-amber-500/30'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span>🌟</span>
                  <span>مشتركة (الكل)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange('ibri')}
                  className={`py-2 px-2.5 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer text-center ${
                    formCategory === 'ibri'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-500 shadow-xs'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span>🕌</span>
                  <span>جامع عبري</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange('outside')}
                  className={`py-2 px-2.5 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer text-center ${
                    formCategory === 'outside'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-500 shadow-xs'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span>🌐</span>
                  <span>خارج عبري</span>
                </button>
              </div>
            </div>

            {/* بطاقة توضيحية لشمول جميع طلاب الأمين تلقائياً */}
            <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 rounded-2xl border border-amber-200/80 dark:border-amber-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎓</span>
                  <span className="text-xs font-black text-amber-950 dark:text-amber-200">
                    طلاب الأمين التابعون للحلقة تلقائياً ({targetAlAmeenStudentsForForm.length} طالب):
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFormStudentsPreview(!showFormStudentsPreview)}
                  className="text-[11px] font-bold text-amber-800 dark:text-amber-300 underline cursor-pointer hover:text-amber-900"
                >
                  {showFormStudentsPreview ? 'إخفاء الأسماء' : 'معاينة الأسماء'}
                </button>
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 font-bold leading-relaxed">
                {formCategory === 'shared' 
                  ? 'يظهر جميع طلاب الأمين سواء من جامع عبري أو خارج جامع عبري تلقائياً في هذه الحلقة، وتكون مشتركة بين جميع المعلمين المكلفين.'
                  : `يظهر جميع طلاب الأمين التابعين لـ (${formCategory === 'outside' ? 'خارج جامع عبري' : 'جامع عبري'}) تلقائياً في هذه الحلقة دون حاجة لتخصيصهم يدوياً.`}
              </p>

              {showFormStudentsPreview && (
                <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 max-h-36 overflow-y-auto space-y-1">
                  {targetAlAmeenStudentsForForm.length === 0 ? (
                    <p className="text-xs text-amber-600 text-center font-bold py-2">
                      لا يوجد طلاب أمين مسجلين في هذا القسم حالياً.
                    </p>
                  ) : (
                    targetAlAmeenStudentsForForm.map(s => {
                      const isOut = isStudentFromOutside(s, halaqas, sardHalaqas, ilmiyyaHalaqas);
                      return (
                        <div key={s.id} className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between bg-white/60 dark:bg-gray-800/60 px-2 py-1 rounded-lg">
                          <span>• {s.name}</span>
                          <span className={`text-[10px] font-bold ${isOut ? 'text-blue-600' : 'text-emerald-600'}`}>
                            {isOut ? 'خارج عبري' : 'جامع عبري'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Teachers assignment multi-select - SHARED between Jamia Ibri and outside */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-sm font-black text-gray-800 dark:text-white">
                  تعيين المعلمين للحلقة العلمية ({formSelectedTeacherIds.length} محدد)
                </label>
                
                {/* تصفية قائمة المعلمين أثناء التحديد */}
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-750 p-0.5 rounded-lg text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setFormTeacherFilter('all')}
                    className={`px-2 py-0.5 rounded-md transition-all ${
                      formTeacherFilter === 'all' ? 'bg-amber-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    الكل ({teachers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTeacherFilter('ibri')}
                    className={`px-2 py-0.5 rounded-md transition-all ${
                      formTeacherFilter === 'ibri' ? 'bg-emerald-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    جامع عبري ({ibriTeachers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTeacherFilter('outside')}
                    className={`px-2 py-0.5 rounded-md transition-all ${
                      formTeacherFilter === 'outside' ? 'bg-blue-600 text-white' : 'text-gray-500'
                    }`}
                  >
                    خارج عبري ({outsideTeachers.length})
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
                يمكن تعيين معلمين من جامع عبري أو من خارجه في نفس الحلقة العلمية، ويتناوبون على تدريسها.
              </p>

              <div className="relative">
                <input
                  type="text"
                  value={teacherSearch}
                  onChange={e => setTeacherSearch(e.target.value)}
                  placeholder="بحث عن معلم بالاسم..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-lg font-bold"
                />
                <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700">
                {filteredTeachersForForm.length === 0 ? (
                  <p className="p-4 text-center text-xs text-gray-400 font-bold">
                    لا يوجد معلمون يطابقون خيارات البحث.
                  </p>
                ) : (
                  filteredTeachersForForm.map(teacher => {
                    const isChecked = formSelectedTeacherIds.includes(teacher.id);
                    const isOutside = outsideTeachers.some(ot => ot.id === teacher.id);
                    return (
                      <label
                        key={teacher.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 font-black text-amber-900 dark:text-amber-200'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-amber-300 text-gray-700 dark:text-gray-200 font-bold'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTeacherSelection(teacher.id)}
                            className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500 cursor-pointer"
                          />
                          <span className="text-sm">{teacher.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                            isOutside 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' 
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          }`}>
                            {isOutside ? 'خارج عبري' : 'جامع عبري'}
                          </span>
                        </div>
                        <span className={`text-xs font-bold ${isChecked ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                          {isChecked ? '✅ مكلف بالحلقة' : 'غير مكلف'}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-800 dark:text-gray-200 font-black rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-md cursor-pointer active:scale-95 transition-all"
              >
                {editingHalaqa ? 'حفظ التعديلات' : 'إضافة الحلقة العلمية'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmHalaqa && (
        <Modal
          title="تأكيد حذف الحلقة العلمية"
          onClose={() => setDeleteConfirmHalaqa(null)}
          hideDefaultCloseButton
        >
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center text-3xl mx-auto">
              ⚠️
            </div>
            <p className="text-lg font-black text-gray-800 dark:text-white">
              هل أنت متأكد من حذف حلقة "{deleteConfirmHalaqa.name}"؟
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-bold">
              لن يتم حذف الطلاب، ولكن سيتم إزالة تعيين الحلقة وسجلات غيابها المسجلة.
            </p>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setDeleteConfirmHalaqa(null)}
                className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 font-bold text-gray-800 dark:text-gray-200 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteHalaqa}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-md cursor-pointer"
              >
                نعم، احذف الحلقة
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Preview Halaqa Students Modal */}
      {previewHalaqaStudents && (
        <Modal
          title={`طلاب الأمين التابعون لحلقة: ${previewHalaqaStudents.name}`}
          onClose={() => setPreviewHalaqaStudents(null)}
          hideDefaultCloseButton
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200/60 dark:border-amber-800/40">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {previewHalaqaStudents.category === 'outside'
                  ? 'جميع طلاب الأمين التابعين لقسم خارج جامع عبري.'
                  : previewHalaqaStudents.category === 'ibri'
                    ? 'جميع طلاب الأمين التابعين لقسم جامع عبري.'
                    : 'حلقة مشتركة: تضم جميع طلاب الأمين من جامع عبري ومن خارج جامع عبري.'}
                يظهر هؤلاء الطلاب تلقائياً في كشف تحضير الحلقة العلمية للمعلمين المناوبين.
              </p>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-1.5 p-1">
              {(() => {
                const list = previewHalaqaStudents.category === 'outside' 
                  ? outsideAlAmeenStudents 
                  : previewHalaqaStudents.category === 'ibri' 
                    ? ibriAlAmeenStudents 
                    : alAmeenStudents;

                if (list.length === 0) {
                  return (
                    <p className="p-8 text-center text-sm font-bold text-gray-400">
                      لا يوجد طلاب أمين مسجلين في هذا القسم حتى الآن.
                    </p>
                  );
                }
                return list.map((s, idx) => {
                  const isOut = isStudentFromOutside(s, halaqas, sardHalaqas, ilmiyyaHalaqas);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 text-xs font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-sm text-gray-900 dark:text-white">
                          {s.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isOut ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isOut ? 'خارج عبري' : 'جامع عبري'}
                        </span>
                        <span className="text-xs text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                          {s.schoolStage || 'طالب أمين'}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <button
              type="button"
              onClick={() => setPreviewHalaqaStudents(null)}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-md cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </Modal>
      )}

      {/* Manage Al-Ameen Students Modal */}
      {isStudentsModalOpen && (
        <Modal
          title="تحديد وتمييز طلاب الأمين للحلقات العلمية"
          onClose={() => setIsStudentsModalOpen(false)}
          hideDefaultCloseButton
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-bold">
              الحلقات العلمية مخصصة لطلاب الأمين. يمكنك النقر على الطالب لتمييزه كطالب أمين، وسيظهر تلقائياً في الحلقة العلمية المشتركة أو التابعة لقسمه.
            </p>

            <div className="relative">
              <input
                type="text"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="بحث عن طالب..."
                className="w-full pl-8 pr-4 py-2 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-sm"
              />
              <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 p-1">
              {filteredStudentsForModal.map(st => {
                const isAlAmeen = !!st.isAlAmeen;
                const isOutside = isStudentFromOutside(st, halaqas, sardHalaqas, ilmiyyaHalaqas);
                return (
                  <div
                    key={st.id}
                    onClick={() => toggleStudentAlAmeen(st)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                      isAlAmeen
                        ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 shadow-xs'
                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                        isAlAmeen ? 'bg-amber-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      }`}>
                        {isAlAmeen ? '✓' : ''}
                      </span>
                      <div>
                        <span className="font-bold text-sm text-gray-900 dark:text-white block">
                          {st.name}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                          <span>{st.schoolStage || 'طالب'}</span>
                          <span>•</span>
                          <span className={isOutside ? 'text-blue-500 font-bold' : 'text-emerald-500 font-bold'}>
                            {isOutside ? 'خارج عبري' : 'جامع عبري'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                      isAlAmeen
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                    }`}>
                      {isAlAmeen ? '🎓 طالب أمين' : 'طالب عادي'}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsStudentsModalOpen(false)}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-md cursor-pointer"
            >
              تم
            </button>
          </div>
        </Modal>
      )}

      {/* Attendance History Log Modal */}
      {viewingAttendanceHalaqa && (
        <Modal
          title={`سجل غياب: ${viewingAttendanceHalaqa.name}`}
          onClose={() => setViewingAttendanceHalaqa(null)}
          hideDefaultCloseButton
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-black text-gray-700 dark:text-gray-300">
                اختر الأسبوع:
              </label>
              <select
                value={attendanceWeekFilter}
                onChange={e => setAttendanceWeekFilter(Number(e.target.value))}
                className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl font-bold text-sm"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map(w => (
                  <option key={w} value={w}>
                    الأسبوع {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Attendance list for this week */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(() => {
                const weekRecords = ilmiyyaAttendances.filter(
                  a => a.ilmiyyaHalaqaId === viewingAttendanceHalaqa.id && Number(a.weekNumber) === Number(attendanceWeekFilter)
                );

                if (weekRecords.length === 0) {
                  return (
                    <p className="p-8 text-center text-gray-400 font-bold">
                      لا يوجد تحضير مسجل لهذا الأسبوع في هذه الحلقة العلمية.
                    </p>
                  );
                }

                return weekRecords.map(rec => {
                  const student = students.find(s => s.id === rec.studentId);
                  const isPresent = rec.status === AttendanceStatus.PRESENT;
                  const isExcused = rec.absenceReason === AbsenceReason.WITH_EXCUSE;
                  const isOut = student ? isStudentFromOutside(student, halaqas, sardHalaqas, ilmiyyaHalaqas) : false;

                  return (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-750 rounded-2xl border border-gray-100 dark:border-gray-700"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white block">
                            {student?.name || `طالب #${rec.studentId}`}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            isOut ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isOut ? 'خارج عبري' : 'جامع عبري'}
                          </span>
                        </div>
                        {rec.notes && (
                          <span className="text-xs text-gray-400 block mt-0.5 font-medium">
                            ملاحظة: {rec.notes}
                          </span>
                        )}
                      </div>

                      <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                        isPresent
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : isExcused
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300'
                      }`}>
                        {isPresent ? '✅ حاضر' : isExcused ? '⚠️ غائب بعذر' : '❌ غائب بدون عذر'}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>

            <button
              type="button"
              onClick={() => setViewingAttendanceHalaqa(null)}
              className="w-full py-3 bg-gray-200 dark:bg-gray-700 font-bold rounded-xl text-gray-800 dark:text-gray-200 cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default IlmiyyaManagement;
