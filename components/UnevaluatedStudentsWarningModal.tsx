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
  return (
    <Modal
      title="تنبيه: ملاحظات على تقييم الطلاب"
      onClose={onCancel} 
      hideDefaultCloseButton={true} 
    >
      <div className="space-y-4 text-gray-800 dark:text-gray-200">
        <p className="text-lg font-medium">
          هناك بعض الملاحظات على تقييم طلابك للأسبوع <span className="font-bold text-red-600 dark:text-red-400">{weekNumber}</span>.
          هل ترغب في العودة للمراجعة، أم تسجيل الخروج على أي حال؟
        </p>

        {quranStudentNames.length > 0 && (
          <div>
            <p className="font-semibold text-red-700 dark:text-red-300">الطلاب الذين لم يتم تقييمهم في القرآن:</p>
            <ul className="list-disc pr-6 space-y-1 bg-red-50 p-3 rounded-md mt-2 dark:bg-red-900/40 border border-red-200 dark:border-red-800">
              {quranStudentNames.map((name, index) => (
                <li key={`uneval-quran-${index}`} className="text-base text-gray-700 dark:text-gray-200">{name}</li>
              ))}
            </ul>
          </div>
        )}
        
        {mutoonStudentNames.length > 0 && (
          <div className="mt-4">
            <p className="font-semibold text-orange-700 dark:text-orange-300">الطلاب الذين لم يتم تقييمهم في المتون:</p>
            <ul className="list-disc pr-6 space-y-1 bg-orange-50 p-3 rounded-md mt-2 dark:bg-orange-900/40 border border-orange-200 dark:border-orange-800">
              {mutoonStudentNames.map((name, index) => (
                <li key={`uneval-mutoon-${index}`} className="text-base text-gray-700 dark:text-gray-200">{name}</li>
              ))}
            </ul>
          </div>
        )}

        {sardStudentNames.length > 0 && (
          <div className="mt-4">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">الطلاب الذين لم يتم تقييمهم في السرد:</p>
            <ul className="list-disc pr-6 space-y-1 bg-emerald-50 p-3 rounded-md mt-2 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              {sardStudentNames.map((name, index) => (
                <li key={`uneval-sard-${index}`} className="text-base text-gray-700 dark:text-gray-200">{name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex justify-between gap-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onCancel}
          className="px-6 py-3 text-lg font-semibold text-green-700 bg-green-100 rounded-lg hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-300 transition-colors duration-300 flex-1 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
        >
          العودة لصفحة التقييم
        </button>
        <button
          onClick={onConfirmLogout}
          className="px-6 py-3 text-lg font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-300 flex-1"
        >
          تسجيل الخروج على أي حال
        </button>
      </div>
    </Modal>
  );
};

export default UnevaluatedStudentsWarningModal;