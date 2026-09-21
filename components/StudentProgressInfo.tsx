import React, { useContext, useMemo } from 'react';
import { AppContext } from '../App';
import { Student } from '../types';
import { getMemorizedPagesData, calculateStudentLevel, getCompletedJuzs, normalizeStudentLevel } from '../utils/pageUtils';
import { formatAndCountJuzs } from '../utils/juzUtils';

interface StudentProgressInfoProps {
  student: Student;
  subject?: string;
}

export const StudentProgressInfo: React.FC<StudentProgressInfoProps> = ({ student, subject }) => {
  const context = useContext(AppContext);
  const { evaluations = [], matns = [] } = context || {};

  const pagesData = useMemo(() => getMemorizedPagesData(student, evaluations), [student, evaluations]);
  const studentLevel = normalizeStudentLevel(student.manualStudentLevel || student.manualLevel) || calculateStudentLevel(pagesData.totalCount);
  
  const mutoonProgress = useMemo(() => {
     if (subject !== 'mutoon') return null;
     const counts: Record<string, number> = {};
     evaluations.forEach(e => {
         if (e.studentId === student.id && e.subject === 'mutoon' && e.evaluationType === 'memorization') {
             if (e.surahs && e.surahs.length > 0 && e.pages) {
                 e.surahs.forEach(matnName => {
                     counts[matnName] = (counts[matnName] || 0) + e.pages!;
                 });
             }
         }
     });
     return counts;
  }, [student.id, evaluations, subject]);


  if (subject === 'mutoon' && mutoonProgress) {
      const mutoonKeys = Object.keys(mutoonProgress);
  
  return (
        <div className="flex flex-col gap-2 mt-2 mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
            <h4 className="font-bold text-xs text-gray-500 dark:text-gray-400 mb-1">معلومات تقدم الطالب في المتون</h4>
            <div className="w-full mt-1 space-y-1.5">
                <div className="bg-blue-100 text-blue-800 p-2.5 rounded-md font-bold dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-xs leading-relaxed break-words whitespace-normal space-y-1.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-blue-200/70 dark:border-blue-800/70">
                        <span className="font-extrabold text-blue-950 dark:text-blue-100">✨ الأبيات المحفوظة</span>
                    </div>
                    {mutoonKeys.length > 0 ? (
                        <ul className="space-y-1 mt-1">
                            {mutoonKeys.map(matnName => {
                                const matn = matns?.find(m => m.name === matnName);
                                const total = matn ? matn.linesCount : '?';
                                if (!context) return null;
  return (
                                    <li key={matnName}>
                                        <span className="text-blue-900 dark:text-blue-100 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-4 ml-1">{matnName}:</span>
                                        {mutoonProgress[matnName]} أبيات (من مجموع {total} أبيات)
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div>لا يوجد حفظ متون مسجل حتى الآن.</div>
                    )}
                </div>
            </div>
        </div>
      );
  }

  const oldCompletedJuzs = getCompletedJuzs(pagesData.oldSet);
  const newCompletedJuzs = getCompletedJuzs(pagesData.newSet);
  const oldJuzsFormatted = formatAndCountJuzs(oldCompletedJuzs.map(String));
  const newJuzsFormatted = formatAndCountJuzs(newCompletedJuzs.map(String));


  if (!context) return null;
  return (
    <div className="flex flex-col gap-2 mt-2 mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
        <h4 className="font-bold text-xs text-gray-500 dark:text-gray-400 mb-1">معلومات تقدم الطالب</h4>
        <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-md font-bold dark:bg-indigo-900/50 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                المستوى: {studentLevel}
            </span>
            <div className="w-full mt-1 space-y-1.5">
                <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-md font-bold dark:bg-emerald-900/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs leading-relaxed break-words whitespace-normal space-y-1.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-emerald-200/70 dark:border-emerald-800/70">
                        <span className="font-extrabold text-emerald-950 dark:text-emerald-100">📖 الحفظ القديم</span>
                    </div>
                    <div>
                        <span className="text-emerald-900 dark:text-emerald-100 underline decoration-emerald-300 dark:decoration-emerald-700 underline-offset-4 ml-1">الصفحات:</span>
                        {pagesData.oldStr}
                    </div>
                    {oldCompletedJuzs.length > 0 && (
                        <div>
                            <span className="text-emerald-900 dark:text-emerald-100 underline decoration-emerald-300 dark:decoration-emerald-700 underline-offset-4 ml-1">الأجزاء المكتملة:</span>
                            {oldJuzsFormatted.formatted} (العدد: {oldJuzsFormatted.count})
                        </div>
                    )}
                </div>
                <div className="bg-blue-100 text-blue-800 p-2.5 rounded-md font-bold dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-xs leading-relaxed break-words whitespace-normal space-y-1.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-blue-200/70 dark:border-blue-800/70">
                        <span className="font-extrabold text-blue-950 dark:text-blue-100">✨ الحفظ الجديد</span>
                    </div>
                    <div>
                        <span className="text-blue-900 dark:text-blue-100 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-4 ml-1">الصفحات:</span>
                        {pagesData.newStr}
                    </div>
                    {newCompletedJuzs.length > 0 && (
                        <div>
                            <span className="text-blue-900 dark:text-blue-100 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-4 ml-1">الأجزاء المكتملة:</span>
                            {newJuzsFormatted.formatted} (العدد: {newJuzsFormatted.count})
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
