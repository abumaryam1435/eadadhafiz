import React from 'react';
import Modal from './Modal';

interface UnevaluatedStudentsWarningModalProps {
  quranStudentNames: string[];
  mutoonStudentNames: string[];
  sardStudentNames?: string[];
  weekNumber: number;
  onConfirmLogout: () => void;
  onCancel: () => void;
}

const UnevaluatedStudentsWarningModal: React.FC<UnevaluatedStudentsWarningModalProps> = ({
  quranStudentNames,
  mutoonStudentNames,
  sardStudentNames = [],
  weekNumber,
  onConfirmLogout,
  onCancel,
}) => {
  const totalCount = quranStudentNames.length + mutoonStudentNames.length + sardStudentNames.length;

  return (
    <Modal
      title="⚠️ تنبيه: طلاب لم يتم تقييمهم"
      onClose={onCancel}
      hideDefaultCloseButton={true}
    >
      <div className="space-y-4 text-gray-800 dark:text-gray-200">
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 text-center">
          <p className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200">
            توجد تقييمات غير مكتملة لطلابك في <span className="text-red-600 dark:text-red-400 font-black">الأسبوع ({weekNumber})</span> (إجمالي {totalCount} حالة متبقية لم تسجل تقييماً أو غياباً).
          </p>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
            هل ترغب في العودة لإكمال التقييم، أم تسجيل الخروج على أي حال؟
          </p>
        </div>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1 pl-1 custom-scrollbar">
          {/* قسم القرآن الكريم */}
          {quranStudentNames.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-red-200/80 dark:border-red-900/60">
                <div className="flex items-center gap-2 font-black text-red-800 dark:text-red-300 text-sm sm:text-base">
                  <span>📖</span>
                  <span>القرآن الكريم (الحفظ والمراجعة)</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200">
                  {quranStudentNames.length} طالب
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {quranStudentNames.map((name, index) => (
                  <span
                    key={`uneval-quran-${index}`}
                    className="inline-flex items-center px-3 py-1 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 border border-red-200 dark:border-red-800/60 shadow-xs"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* قسم المتون */}
          {mutoonStudentNames.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-amber-200/80 dark:border-amber-900/60">
                <div className="flex items-center gap-2 font-black text-amber-800 dark:text-amber-300 text-sm sm:text-base">
                  <span>📜</span>
                  <span>المتون العلمية (طلاب الأمين)</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                  {mutoonStudentNames.length} طالب
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {mutoonStudentNames.map((name, index) => (
                  <span
                    key={`uneval-mutoon-${index}`}
                    className="inline-flex items-center px-3 py-1 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 border border-amber-200 dark:border-amber-800/60 shadow-xs"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* قسم السرد */}
          {sardStudentNames.length > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-emerald-200/80 dark:border-emerald-900/60">
                <div className="flex items-center gap-2 font-black text-emerald-800 dark:text-emerald-300 text-sm sm:text-base">
                  <span>🛡️</span>
                  <span>حلقات السرد القرآني</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
                  {sardStudentNames.length} طالب
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sardStudentNames.map((name, index) => (
                  <span
                    key={`uneval-sard-${index}`}
                    className="inline-flex items-center px-3 py-1 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 border border-emerald-200 dark:border-emerald-800/60 shadow-xs"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3 text-sm sm:text-base font-extrabold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-800/80 transition-all flex-1 shadow-sm active:scale-95 text-center"
          >
            العودة لصفحة التقييم
          </button>
          <button
            type="button"
            onClick={onConfirmLogout}
            className="px-5 py-3 text-sm sm:text-base font-extrabold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-all flex-1 shadow-md active:scale-95 text-center"
          >
            تسجيل الخروج على أي حال
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UnevaluatedStudentsWarningModal;
