
import React, { useState } from 'react';
import Modal from './Modal';
import { Evaluation, Student, Halaqa, EvaluationType, AttendanceStatus } from '../types';
import { translationMap, toArabicDigits, formatRtlRange } from '../utils/exportWord';

interface EvaluationSummaryModalProps {
  evaluation: Evaluation;
  student?: Student;
  halaqa?: Halaqa;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const EvaluationSummaryModal: React.FC<EvaluationSummaryModalProps> = ({
  evaluation,
  student,
  halaqa,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const getAyahRangeDisplay = () => {
    if (evaluation.fromAyah && evaluation.toAyah) {
      return evaluation.fromAyah === evaluation.toAyah ? toArabicDigits(evaluation.fromAyah) : formatRtlRange(`${evaluation.fromAyah} - ${evaluation.toAyah}`);
    }
    if (evaluation.fromAyah) return toArabicDigits(evaluation.fromAyah);
    if (evaluation.subject !== 'mutoon' && evaluation.surahs && evaluation.surahs.length > 0) return 'كاملة';
    return '—';
  };

  const SummaryRow = ({ label, value, colorClass = "" }: { label: string, value: any, colorClass?: string }) => (
    <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/50 last:border-0" dir="rtl">
        <span className="text-[10px] font-bold text-gray-500 shrink-0">{label}:</span>
        <span className={`text-[10px] font-black text-left ${colorClass || "text-gray-800 dark:text-white"}`} dir="rtl">{value}</span>
    </div>
  );

  if (showConfirmDelete) {
    return (
      <Modal title="حذف السجل" onClose={() => setShowConfirmDelete(false)} hideDefaultCloseButton={true}>
        <div className="space-y-3 text-center py-2">
          <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <p className="text-sm font-black dark:text-white">تأكيد حذف التقييم نهائياً؟</p>
          <div className="flex flex-col gap-2 pt-3">
            <button onClick={onDelete} className="w-full py-3 bg-red-600 text-white rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all">نعم، حذف السجل</button>
            <button onClick={() => setShowConfirmDelete(false)} className="w-full py-2.5 bg-gray-200 text-gray-800 rounded-xl font-bold dark:bg-gray-700 dark:text-white text-xs">تراجع</button>
          </div>
        </div>
      </Modal>
    );
  }

  const FooterButtons = (
    <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowConfirmDelete(true)} className="py-3 bg-red-50 text-red-600 rounded-2xl font-black border border-red-100 hover:bg-red-100 transition-all text-xs flex items-center justify-center gap-1 active:scale-95">
               حذف
            </button>
            <button onClick={onEdit} className="py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all text-xs flex items-center justify-center gap-1">
               تعديل
            </button>
        </div>
        <button onClick={onClose} className="w-full py-3 bg-gray-100 text-gray-700 rounded-2xl font-black hover:bg-gray-200 dark:bg-gray-800 dark:text-white transition-all text-xs border border-gray-200 dark:border-gray-700">
           إغلاق
        </button>
    </div>
  );

  return (
    <Modal title="ملخص التقييم" onClose={onClose} hideDefaultCloseButton={true} footer={FooterButtons}>
      <div className="relative">
        {/* خلفية متميزة (خلفية ورقية ملكية) */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-white dark:from-green-950/10 dark:to-slate-900 rounded-3xl -m-2 border border-green-100/50 dark:border-green-800/20 shadow-inner pointer-events-none" />
        
        <div className="relative space-y-3">
            {/* الهيدر المتميز */}
            <div className="text-center pb-2 border-b-2 border-dashed border-green-200 dark:border-green-800">
                <h4 className="text-[13px] font-black text-green-900 dark:text-green-300 leading-tight">
                    {student?.name}
                </h4>
                {student?.isAlAmeen && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold leading-tight mt-0.5">
                        (من طلاب الأمين)
                    </div>
                )}
                <div className="flex justify-center items-center gap-2 mt-1">
                   <span className="px-2 py-0.5 bg-green-700 text-white rounded-full text-[9px] font-black">{evaluation.isTest ? (evaluation.testName || 'الاختبار') : `الأسبوع ${evaluation.weekNumber}`}</span>
                   <span className="text-[10px] text-gray-400 font-bold">الحلقة: {halaqa?.name || '---'}</span>
                </div>
            </div>

            {/* قسم التفاصيل */}
            <div className="bg-white/60 dark:bg-slate-800/40 rounded-2xl p-3 shadow-sm border border-white/80 dark:border-slate-700/50 space-y-1">
                <h5 className="text-[9px] font-black text-green-700/60 dark:text-green-400/50 mb-2 uppercase tracking-tighter">تفاصيل التقييم:</h5>
                
                <SummaryRow label="الحالة" value={translationMap[evaluation.attendance]} colorClass={evaluation.attendance === AttendanceStatus.PRESENT ? "text-green-600" : "text-red-600"} />
                
                {evaluation.attendance === AttendanceStatus.ABSENT ? (
                  <SummaryRow label="السبب" value={translationMap[evaluation.absenceReason || ''] || '—'} colorClass="text-amber-600" />
                ) : (
                  <>
                    {!evaluation.isTest && (
                      <SummaryRow label="نوع الإنجاز" value={translationMap[evaluation.evaluationType!] || '—'} colorClass="text-blue-600" />
                    )}

                    {!evaluation.isTest && evaluation.evaluationType === EvaluationType.MEMORIZATION && (
                      <>
                        <SummaryRow 
                          label={evaluation.subject === 'mutoon' ? 'عدد الأبيات' : 'عدد الصفحات'} 
                          value={evaluation.subject === 'mutoon' ? (evaluation.pages ?? '0') : (evaluation.pages !== null && evaluation.pages !== undefined ? evaluation.pages : (evaluation.newMemorizedPages?.length ?? '0'))} 
                        />
                        
                        {evaluation.subject !== 'mutoon' && evaluation.newMemorizedPages && evaluation.newMemorizedPages.length > 0 && (
                          <SummaryRow label="أرقام الصفحات" value={evaluation.newMemorizedPages.map(toArabicDigits).join('، ')} colorClass="text-emerald-700 dark:text-emerald-300" />
                        )}

                        <SummaryRow label={evaluation.subject === 'mutoon' ? 'الأبيات' : 'الآيات'} value={getAyahRangeDisplay()} />
                        
                        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/50">
                            <span className="text-[10px] font-bold text-gray-500 shrink-0">{evaluation.subject === 'mutoon' ? 'المتون:' : 'السور:'}</span>
                            <div className="flex flex-wrap gap-1 justify-end max-w-[150px]">
                                {evaluation.surahs?.map(s => (
                                    <span key={s} className="text-[9px] font-black bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-green-800 dark:text-green-300 border border-green-100 dark:border-green-800/50">{s}</span>
                                )) || <span className="text-[10px] text-gray-400">—</span>}
                            </div>
                        </div>

                        {((evaluation.evalFathErrors || 0) > 0 || (evaluation.evalTashkeelErrors || 0) > 0 || (evaluation.evalTajweedErrors || 0) > 0) && (
                          <SummaryRow 
                            label="أخطاء التسميع" 
                            value={`فتح: ${toArabicDigits(evaluation.evalFathErrors || 0)} | تشكيل: ${toArabicDigits(evaluation.evalTashkeelErrors || 0)} | تجويد: ${toArabicDigits(evaluation.evalTajweedErrors || 0)} (المجموع: ${toArabicDigits((evaluation.evalFathErrors || 0) + (evaluation.evalTashkeelErrors || 0) + (evaluation.evalTajweedErrors || 0))})`} 
                          />
                        )}

                        <SummaryRow label="مستوى الأداء" value={translationMap[evaluation.performance!] || '—'} colorClass="text-purple-600" />
                      </>
                    )}

                    {evaluation.isTest && (
                      <>
                        <SummaryRow label="نتيجة الاختبار" value={`${evaluation.testTotalScore ?? 0} / ${evaluation.testMaxScore ?? 100}`} colorClass="text-indigo-600 font-bold" />
                        <SummaryRow label="أخطاء الفتح" value={evaluation.testFathErrors ?? 0} />
                        <SummaryRow label="أخطاء التشكيل" value={evaluation.testTashkeelErrors ?? 0} />
                        <SummaryRow label="أخطاء التجويد" value={evaluation.testTajweedErrors ?? 0} />
                      </>
                    )}

                    {!evaluation.isTest && (
                      <SummaryRow label="المراجعة الدورية" value={translationMap[evaluation.periodicReview!] || '—'} colorClass={evaluation.periodicReview === 'committed' ? "text-teal-600" : ""} />
                    )}
                  </>
                )}
            </div>
            
            {evaluation.notes && (
              <div className="p-2 bg-amber-50/40 dark:bg-amber-900/5 rounded-xl border border-amber-100/30 dark:border-amber-800/20">
                <p className="text-gray-600 dark:text-gray-400 text-[9px] leading-relaxed italic line-clamp-2">
                    <span className="font-bold text-amber-700/50 ml-1">ملاحظة:</span>
                    {evaluation.notes}
                </p>
              </div>
            )}
        </div>
      </div>
    </Modal>
  );
};

export default EvaluationSummaryModal;
