import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import { Suggestion, UserRole } from '../types';

interface Props { isTeacher?: boolean; }
export const SupervisorSuggestionsView: React.FC<Props> = ({ isTeacher = false }) => {
  const context = useContext(AppContext);

  const suggestions = context?.suggestions || [];
  const deleteSuggestion = context?.deleteSuggestion || (async () => {});
  const updateSuggestion = context?.updateSuggestion || (async () => {});
  const deleteAllSuggestions = context?.deleteAllSuggestions || (async () => {});
  const showToast = context?.showToast || (() => {});
  const studentBehaviors = context?.studentBehaviors || [];
  const updateStudentBehavior = context?.updateStudentBehavior || (async () => {});
  const deleteStudentBehavior = context?.deleteStudentBehavior || (async () => {});
  const deleteAllStudentBehaviors = context?.deleteAllStudentBehaviors || (async () => {});
  const users = context?.users || [];
  const updateTeacher = context?.updateTeacher || (async () => {});

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'text' | 'voice'>('all');
  const [hasAttachmentsFilter, setHasAttachmentsFilter] = useState<boolean | null>(null);
  const [reviewedFilter, setReviewedFilter] = useState<'all' | 'reviewed' | 'unreviewed'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [behaviorDeleteConfirmId, setBehaviorDeleteConfirmId] = useState<number | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState<boolean>(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [teacherPermissionsSearchTerm, setTeacherPermissionsSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'suggestions' | 'behaviors'>(isTeacher ? 'behaviors' : 'suggestions');
  const [behaviorSearchTerm, setBehaviorSearchTerm] = useState('');
  const [behaviorReviewedFilter, setBehaviorReviewedFilter] = useState<'all' | 'reviewed' | 'unreviewed'>('all');

  const teachers = users ? users.filter(u => u.role === UserRole.TEACHER) : [];

  // Filter and sort suggestions (newest first - descending by date)
  const allSuggestions = suggestions ? [...suggestions].sort((a, b) => b.createdAt - a.createdAt) : [];

  const filteredSuggestions = allSuggestions.filter((s) => {
    // Advanced search filter (match any parts of text, even if non-contiguous)
    const matchesSearch = (() => {
      if (!searchTerm.trim()) return true;
      const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      const textToSearch = `${s.teacherName} ${s.content || ''}`.toLowerCase();
      return searchWords.every(word => textToSearch.includes(word));
    })();

    // Type filter
    const matchesType = typeFilter === 'all' || s.type === typeFilter;

    // Attachments filter
    const hasAttachments = s.attachments && s.attachments.length > 0;
    const matchesAttachments =
      hasAttachmentsFilter === null || (hasAttachmentsFilter ? hasAttachments : !hasAttachments);

    // Reviewed/Read filter
    const matchesReviewed =
      reviewedFilter === 'all' ||
      (reviewedFilter === 'reviewed' ? !!s.reviewed : !s.reviewed);

    return matchesSearch && matchesType && matchesAttachments && matchesReviewed;
  });

  const allBehaviors = studentBehaviors ? [...studentBehaviors].sort((a, b) => b.createdAt - a.createdAt) : [];
  const filteredBehaviors = allBehaviors.filter((b) => {
    const matchesSearch = (() => {
      if (!behaviorSearchTerm.trim()) return true;
      const searchWords = behaviorSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      const textToSearch = `${b.teacherName} ${b.studentName} ${b.content || ''}`.toLowerCase();
      return searchWords.every(word => textToSearch.includes(word));
    })();
    const matchesReviewed = behaviorReviewedFilter === 'all' || (behaviorReviewedFilter === 'reviewed' ? !!b.reviewed : !b.reviewed);
    return matchesSearch && matchesReviewed;
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 relative min-h-[500px]">
      {/* Header Info */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-black text-green-900 dark:text-green-400 mb-1">صندوق مقترحات المعلمين</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 font-bold">هنا يمكنك الإطلاع على كافة مقترحات وتوصيات المعلمين المكتوبة والصوتية ومرفقاتها.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 px-4 py-2 rounded-2xl font-black text-sm border border-green-100 dark:border-green-900/50 shadow-sm">
            إجمالي المقترحات: {allSuggestions.length}
          </div>
          {allSuggestions.length > 0 && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40 rounded-2xl font-black text-sm shadow-sm transition-all active:scale-95"
              title="حذف جميع المقترحات"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              حذف الكل
            </button>
          )}
        </div>
      </div>

      
      {/* Tabs */}
      {!isTeacher && (<div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl mb-2 border border-gray-200 dark:border-slate-700 shadow-sm flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`flex-1 py-3 text-center rounded-xl font-black text-sm transition-all ${
            activeTab === 'suggestions'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          المقترحات ({allSuggestions.length})
        </button>
        <button
          onClick={() => setActiveTab('behaviors')}
          className={`flex-1 py-3 text-center rounded-xl font-black text-sm transition-all ${
            activeTab === 'behaviors'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          سلوك الطلاب ({allBehaviors.length})
        </button>
      </div>)}

      {activeTab === 'suggestions' ? (
        <>

      {/* Controls / Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search bar */}
          <div className="sm:col-span-2 lg:col-span-2 relative flex items-center">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم المعلم أو بمحتوى الاقتراح..."
              className="w-full pl-8 pr-10 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-900 dark:text-white text-sm outline-none focus:border-green-600 transition-all font-bold"
            />
            <svg className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                title="مسح البحث"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Selector */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-900 dark:text-white text-sm outline-none focus:border-green-600 transition-all font-bold"
            >
              <option value="all">كل أنواع الاقتراحات</option>
              <option value="text">المقترحات المكتوبة فقط</option>
              <option value="voice">المقترحات الصوتية فقط</option>
            </select>
          </div>

          {/* Attachments filter */}
          <div>
            <select
              value={hasAttachmentsFilter === null ? 'all' : hasAttachmentsFilter ? 'yes' : 'no'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all') setHasAttachmentsFilter(null);
                else if (val === 'yes') setHasAttachmentsFilter(true);
                else setHasAttachmentsFilter(false);
              }}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-900 dark:text-white text-sm outline-none focus:border-green-600 transition-all font-bold"
            >
              <option value="all">كل المرفقات</option>
              <option value="yes">بمرفقات فقط</option>
              <option value="no">بدون مرفقات</option>
            </select>
          </div>

          {/* Reviewed/Status Filter */}
          <div>
            <select
              value={reviewedFilter}
              onChange={(e) => setReviewedFilter(e.target.value as any)}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-900 dark:text-white text-sm outline-none focus:border-green-600 transition-all font-bold"
            >
              <option value="all">كل حالات الاطلاع</option>
              <option value="unreviewed">لم يتم الاطلاع عليها (جديد)</option>
              <option value="reviewed">تم الاطلاع عليها</option>
            </select>
          </div>
        </div>
      </div>

      {/* Suggestions List/Table */}
      {filteredSuggestions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl py-16 text-center text-gray-500 dark:text-slate-400 border border-gray-100 dark:border-slate-800 font-medium shadow-sm">
          <svg className="w-20 h-20 mx-auto mb-4 text-gray-200 dark:text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          لا توجد مقترحات تطابق خيارات التصفية الحالية.
        </div>
      ) : (
        <div className="space-y-4 relative min-h-[400px]">
          {/* Mobile/Card view & Desktop view combo */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 text-xs text-gray-400 font-black tracking-wider uppercase">
                  <th className="py-4 px-6 text-center w-24">تم الاطلاع</th>
                  <th className="py-4 px-6">اسم المعلم</th>
                  <th className="py-4 px-6">محتوى الاقتراح</th>
                  <th className="py-4 px-6">المرفقات التوضيحية</th>
                  <th className="py-4 px-6 w-52">تاريخ الارسال</th>
                  <th className="py-4 px-6 text-center w-24">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60 text-sm font-bold text-gray-800 dark:text-slate-200">
                {filteredSuggestions.map((s, index) => {
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-all">
                      <td className="py-5 px-6 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={!!s.reviewed}
                            onChange={() => {
                              updateSuggestion({ ...s, reviewed: !s.reviewed });
                              showToast(
                                s.reviewed ? '⚠️ تم وضع المقترح كغير مقروء.' : '✅ تم وضع المقترح كمقروء/تم الاطلاع عليه.',
                                'success'
                              );
                            }}
                            className="sr-only"
                          />
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                            s.reviewed
                              ? 'bg-green-600 border-green-600 text-white shadow-sm shadow-green-500/20'
                              : 'border-gray-300 dark:border-slate-700 hover:border-green-500 bg-transparent'
                          }`}>
                            {s.reviewed && (
                              <svg className="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </label>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-green-900 dark:text-green-400 block">{s.teacherName}</span>
                          {!s.reviewed && (
                            <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                              جديد
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-5 px-6 max-w-xl">
                        {s.type === 'text' ? (
                          <div className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-slate-300">
                            {s.content}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-950 p-2.5 rounded-2xl border dark:border-slate-800 w-fit">
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                              </span>
                              صوتي
                            </span>
                            <audio src={s.audioUrl || undefined} controls className="h-9 w-64" />
                          </div>
                        )}
                      </td>
                      <td className="py-5 px-6">
                        {s.attachments && s.attachments.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                            {s.attachments.map((file, fIdx) => (
                              <a
                                key={fIdx}
                                href={file.data}
                                download={file.name}
                                title={file.name}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 dark:bg-slate-950 border dark:border-slate-800 rounded-xl text-xs text-gray-700 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 hover:border-green-300 dark:hover:border-green-900 transition-all shadow-sm"
                              >
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2-8H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2z" />
                                </svg>
                                <span className="truncate max-w-[80px]">{file.name}</span>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">لا توجد مرفقات</span>
                        )}
                      </td>
                      <td className="py-5 px-6 text-xs text-gray-500 dark:text-slate-400 font-bold">
                        {formatDate(s.createdAt)}
                      </td>
                      <td className="py-5 px-6 text-center">
                        <button
                          onClick={() => setDeleteConfirmId(s.id)}
                          className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl transition-all hover:scale-105 active:scale-95"
                          title="حذف هذا المقترح"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list view */}
          <div className="lg:hidden space-y-4">
            {filteredSuggestions.map((s) => {
              return (
                <div key={s.id} className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      {/* Checkbox for Mobile */}
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!s.reviewed}
                          onChange={() => {
                            updateSuggestion({ ...s, reviewed: !s.reviewed });
                            showToast(
                              s.reviewed ? '⚠️ تم وضع المقترح كغير مقروء.' : '✅ تم وضع المقترح كمقروء/تم الاطلاع عليه.',
                              'success'
                            );
                          }}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          s.reviewed
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'border-gray-300 dark:border-slate-700 bg-transparent'
                        }`}>
                          {s.reviewed && (
                            <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs font-black text-gray-500 dark:text-slate-400">تم الاطلاع</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 font-bold">{formatDate(s.createdAt)}</span>
                      <button
                        onClick={() => setDeleteConfirmId(s.id)}
                        className="p-1.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg transition-all active:scale-95"
                        title="حذف المقترح"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-gray-400 dark:text-slate-500 block">اسم المعلم:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-green-900 dark:text-green-400 text-base">{s.teacherName}</span>
                      {!s.reviewed && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                          جديد
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-gray-400 dark:text-slate-500 block">محتوى الاقتراح:</span>
                    {s.type === 'text' ? (
                      <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {s.content}
                      </p>
                    ) : (
                      <div className="bg-gray-50 dark:bg-slate-950 p-3 rounded-2xl border dark:border-slate-800 flex flex-col gap-2">
                        <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          تسجيل صوتي
                        </span>
                        <audio src={s.audioUrl || undefined} controls className="w-full h-10" />
                      </div>
                    )}
                  </div>

                  {s.attachments && s.attachments.length > 0 && (
                    <div className="space-y-2 pt-3 border-t dark:border-slate-800">
                      <span className="text-xs text-gray-400 dark:text-slate-500 block">المرفقات:</span>
                      <div className="flex flex-wrap gap-2">
                        {s.attachments.map((file, fIdx) => (
                          <a
                            key={fIdx}
                            href={file.data}
                            download={file.name}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-950 border dark:border-slate-800 rounded-xl text-xs text-gray-700 dark:text-slate-300 shadow-sm"
                          >
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2-8H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2z" />
                            </svg>
                            <span className="truncate max-w-[120px]">{file.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
        </>
      ) : (
        <>
          {/* Controls / Filter Bar for Behaviors */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
              <h4 className="text-lg font-black text-gray-800 dark:text-gray-200">سجل السلوكيات</h4>
              
              <div className="flex flex-wrap items-center gap-3">
                {(() => {
                  const permitted = teachers.filter(t => t.canViewBehaviors);
                  return (
                    <div className="flex flex-wrap items-center gap-1.5" title="المعلمون المصرح لهم بالاطلاع">
                      <span className="text-xs font-black text-gray-500 dark:text-slate-400 ml-1">
                        المصرح لهم:
                      </span>
                      {permitted.length === 0 ? (
                        <span className="text-xs font-bold text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                          لا يوجد
                        </span>
                      ) : (
                        permitted.map(pt => (
                          <span
                            key={pt.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60 rounded-lg text-xs font-bold shadow-2xs"
                          >
                            <span className="text-[10px]">👤</span>
                            {pt.name}
                          </span>
                        ))
                      )}
                    </div>
                  );
                })()}
                {!isTeacher && (<button
                  onClick={() => setShowPermissionsModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-xl font-black text-sm transition-all border border-indigo-100 dark:border-indigo-900/40 shadow-sm shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  صلاحيات الاطلاع
                </button>)}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 relative flex items-center">
                <input
                  type="text"
                  value={behaviorSearchTerm}
                  onChange={(e) => setBehaviorSearchTerm(e.target.value)}
                  placeholder="ابحث باسم المعلم، الطالب، أو محتوى السلوك..."
                  className="w-full pl-8 pr-10 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-900 dark:text-white text-sm outline-none focus:border-green-600 transition-all font-bold"
                />
                <svg className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {behaviorSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setBehaviorSearchTerm('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                    title="مسح البحث"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div>
                <select
                  value={behaviorReviewedFilter}
                  onChange={(e) => setBehaviorReviewedFilter(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-900 dark:text-white text-sm outline-none focus:border-green-600 transition-all font-bold"
                >
                  <option value="all">كل حالات السلوك</option>
                  <option value="unreviewed">لم يتم الاطلاع عليها</option>
                  <option value="reviewed">تمت قراءتها ✔️</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Behaviors List */}
          {filteredBehaviors.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-12 text-center shadow-sm">
              <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="text-xl font-black text-gray-800 dark:text-gray-200 mb-2">لا توجد سجلات سلوك</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 font-bold max-w-md mx-auto">لا يوجد أي سلوكيات مسجلة تطابق شروط البحث الحالية.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBehaviors.map((b) => (
                <div key={b.id} className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border-2 ${!b.reviewed ? 'border-green-200 dark:border-green-900/50 shadow-md' : 'border-gray-100 dark:border-slate-800 shadow-sm opacity-80'} transition-all hover:opacity-100`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                    <div>
                      <h4 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                        الطالب: {b.studentName}
                        {b.reviewed && <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-lg">مقروء</span>}
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400 font-bold mt-1">
                        <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>المعلم: {b.teacherName}</span>
                        <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{formatDate(b.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => updateStudentBehavior({ ...b, reviewed: !b.reviewed })}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${b.reviewed ? 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700' : 'bg-green-600 text-white hover:bg-green-700 shadow-md'}`}
                      >
                        {b.reviewed ? 'تحديد كغير مقروء' : 'تمت القراءة'}
                      </button>
                      <button
                        onClick={() => setBehaviorDeleteConfirmId(b.id)}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-xl transition-all active:scale-95 shadow-sm"
                        title="حذف"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{b.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {deleteConfirmId !== null && (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 rounded-3xl flex items-start justify-center pt-20 pb-10 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-gray-100 dark:border-slate-800 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/35 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2">تأكيد حذف المقترح</h4>
            <p className="text-sm text-gray-500 dark:text-slate-400 font-bold mb-6">هل أنت متأكد من رغبتك في حذف هذا الاقتراح نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  deleteSuggestion(deleteConfirmId);
                  setDeleteConfirmId(null);
                  showToast('🗑️ تم حذف الاقتراح بنجاح.', 'success');
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg text-sm active:scale-95"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black rounded-2xl transition-all text-sm active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

            {behaviorDeleteConfirmId !== null && (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 rounded-3xl flex items-start justify-center pt-20 pb-10 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-gray-100 dark:border-slate-800 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/35 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2">تأكيد حذف السلوك</h4>
            <p className="text-sm text-gray-500 dark:text-slate-400 font-bold mb-6">هل أنت متأكد من رغبتك في حذف هذا السلوك نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  deleteStudentBehavior(behaviorDeleteConfirmId);
                  setBehaviorDeleteConfirmId(null);
                  showToast('🗑️ تم حذف السلوك بنجاح.', 'success');
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg text-sm active:scale-95"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => setBehaviorDeleteConfirmId(null)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black rounded-2xl transition-all text-sm active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      
      {showPermissionsModal && (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 rounded-3xl flex items-start justify-center pt-20 pb-10 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full border border-gray-100 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-slate-800 pb-4">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                صلاحيات الاطلاع على السلوكيات
              </h3>
              <button
                onClick={() => { setShowPermissionsModal(false); setTeacherPermissionsSearchTerm(''); }}
                className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 rounded-full transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-4">
              <p className="text-sm text-gray-500 dark:text-slate-400 font-bold mb-4">
                اختر المعلمين الذين يُسمح لهم بالاطلاع على السجل الكامل لسلوكيات جميع الطلاب. يجب تعيين كلمة مرور لكل معلم للسماح له بالدخول.
              </p>
              

              <div className="relative mb-4 flex items-center">
                <input
                  type="text"
                  value={teacherPermissionsSearchTerm}
                  onChange={(e) => setTeacherPermissionsSearchTerm(e.target.value)}
                  placeholder="ابحث عن معلم..."
                  className="w-full pl-8 pr-10 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition-all font-bold"
                />
                <svg className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {teacherPermissionsSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setTeacherPermissionsSearchTerm('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer"
                    title="مسح البحث"
                  >
                    ✕
                  </button>
                )}
              </div>

              {teachers.filter(t => t.name.toLowerCase().includes(teacherPermissionsSearchTerm.toLowerCase())).map(teacher => (
                <div key={teacher.id} className="bg-gray-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center justify-center font-black">
                      {teacher.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-gray-800 dark:text-gray-200">{teacher.name}</h4>
                      <span className="text-xs text-gray-500 font-bold">معلم</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!teacher.canViewBehaviors}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          updateTeacher({ 
                            ...teacher, 
                            canViewBehaviors: isChecked,
                            behaviorsPassword: isChecked ? (teacher.behaviorsPassword || '') : ''
                          });
                        }}
                        className="w-5 h-5 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                      />
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">مسموح بالاطلاع</span>
                    </label>
                    
                    {teacher.canViewBehaviors && (
                      <div className="relative w-full sm:w-48">
                        <input
                          type="text"
                          placeholder="كلمة المرور..."
                          value={teacher.behaviorsPassword || ''}
                          onChange={(e) => {
                            updateTeacher({
                              ...teacher,
                              behaviorsPassword: e.target.value
                            });
                          }}
                          className="w-full pl-4 pr-10 py-2 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition-all font-bold"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {teachers.length === 0 && (
                <div className="text-center py-8 text-gray-500">لا يوجد معلمين مضافين بعد.</div>
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                onClick={() => { setShowPermissionsModal(false); setTeacherPermissionsSearchTerm(''); }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-md active:scale-95 text-sm"
              >
                حفظ وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllConfirm && (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 rounded-3xl flex items-start justify-center pt-20 pb-10 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-gray-100 dark:border-slate-800 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/35 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4">
              <svg className="w-8 h-8 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2">حذف جميع المقترحات</h4>
            <p className="text-sm text-gray-500 dark:text-slate-400 font-bold mb-6">هل أنت متأكد تماماً من رغبتك في مسح كافة المقترحات الموجودة في النظام؟ سيتم حذف جميع الرسائل والتسجيلات بشكل نهائي.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  deleteAllSuggestions();
                  setShowDeleteAllConfirm(false);
                  showToast('🗑️ تم إفراغ صندوق المقترحات بنجاح.', 'success');
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg text-sm active:scale-95"
              >
                تأكيد حذف الكل
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black rounded-2xl transition-all text-sm active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
