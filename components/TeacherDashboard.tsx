
import React, { useContext, useState, useEffect } from 'react';
import { EvaluationForm } from './EvaluationForm';
import { TestEvaluationForm } from './TestEvaluationForm';
import { NewStudentTestForm } from './NewStudentTestForm';
import { AppContext } from '../App';
import { SupervisorSuggestionsView } from './SupervisorSuggestionsView';
import { registerBackHandler } from '../utils/navigationHistory';
import { ErrorBoundary } from './ErrorBoundary';

interface TeacherDashboardProps {
  teacherId: number;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacherId }) => {
  const context = useContext(AppContext);
  const currentUser = context?.users?.find(u => u.id === teacherId);
  const canViewBehaviors = currentUser?.canViewBehaviors;
  const [isBehaviorsUnlocked, setIsBehaviorsUnlocked] = useState(false);
  const [behaviorPassword, setBehaviorPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const isTestActive = context?.isTestActive;
  const isNewStudentTestActive = context?.isNewStudentTestActive;
  const hasActiveMatns = (context?.matns || []).some(m => m.isActive !== false);

  // إذا كانت ميزة تقييم الاختبار أو اختبار طالب جديد مفعلة، نظهر قائمة الاختيار أولاً (menu)
  // أما إذا لم تكن مفعلة، فيدخل المعلم مباشرة إلى التقييم (evaluate)
  const hasSpecialFeatures = Boolean(isTestActive || isNewStudentTestActive);
  const [activeView, setActiveView] = useState<'menu' | 'evaluate' | 'test' | 'newStudentTest' | 'behaviors'>(
    () => (hasSpecialFeatures ? 'menu' : 'evaluate')
  );

  const handleFormSubmit = (action: 'add' | 'update' | 'delete') => {
    const messages = {
        add: '✅ تم الحفظ بنجاح!',
        update: '✅ تم التعديل بنجاح!',
        delete: '🗑️ تم الحذف بنجاح.'
    };
    context?.showToast(messages[action] || '✅ تمت العملية بنجاح!');
  };

  const handleReturnToMenu = () => {
    if (hasSpecialFeatures) {
      setActiveView('menu');
    }
  };

  // معالج الرجوع للقائمة الرئيسية عند التواجد في شاشة السلوكيات
  useEffect(() => {
    if (hasSpecialFeatures && activeView === 'behaviors') {
      return registerBackHandler(() => {
        handleReturnToMenu();
        return true;
      });
    }
  }, [hasSpecialFeatures, activeView]);

  return (
    <div className="container mx-auto animate-fade-in px-2 sm:px-6 lg:px-8 space-y-6 max-w-full">
      {/* صفحة اختيار نوع العمل (تظهر فقط إذا كان تقييم الاختبار أو اختبار طالب جديد مفعلاً) */}
      {activeView === 'menu' && hasSpecialFeatures && (
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 py-3 sm:py-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="text-center space-y-1.5 sm:space-y-2">
            <h2 className="text-xl sm:text-3xl font-black text-gray-800 dark:text-white">
              مرحباً بك{currentUser?.name ? `: ${currentUser.name}` : ''}
            </h2>
            <p className="text-xs sm:text-base font-bold text-gray-500 dark:text-gray-400">
              اختر الإجراء الذي ترغب في البدء به:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <button 
              type="button"
              onClick={() => setActiveView('evaluate')} 
              className="py-3 px-4 sm:p-6 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border-2 border-emerald-500/50 hover:border-emerald-600 hover:shadow-xl transition-all flex flex-row sm:flex-col items-center text-right sm:text-center justify-start sm:justify-center gap-3.5 sm:gap-3 group active:scale-98 sm:active:scale-95 shadow-sm"
            >
              <div className="w-11 h-11 sm:w-16 sm:h-16 shrink-0 rounded-xl sm:rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-2xl sm:text-3xl group-hover:scale-105 sm:group-hover:scale-110 transition-transform">
                📖
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-base sm:text-lg font-black text-gray-900 dark:text-white truncate sm:whitespace-normal">
                  التقييم الأسبوعي
                </span>
                <span className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 block truncate sm:whitespace-normal">
                  {hasActiveMatns ? 'الحفظ، المتون، السرد' : 'الحفظ، السرد'}
                </span>
              </div>
            </button>

            {isTestActive && (
              <button 
                type="button"
                onClick={() => setActiveView('test')} 
                className="py-3 px-4 sm:p-6 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border-2 border-indigo-500/50 hover:border-indigo-600 hover:shadow-xl transition-all flex flex-row sm:flex-col items-center text-right sm:text-center justify-start sm:justify-center gap-3.5 sm:gap-3 group active:scale-98 sm:active:scale-95 relative overflow-hidden shadow-sm"
              >
                <div className="w-11 h-11 sm:w-16 sm:h-16 shrink-0 rounded-xl sm:rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-2xl sm:text-3xl group-hover:scale-105 sm:group-hover:scale-110 transition-transform">
                  📝
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center sm:justify-center gap-2">
                    <span className="block text-base sm:text-lg font-black text-gray-900 dark:text-white truncate sm:whitespace-normal">
                      تقييم الاختبار
                    </span>
                    <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-indigo-500"></span>
                    </span>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 block truncate sm:whitespace-normal">
                    تقييم اختبارات الحفظ للطلاب
                  </span>
                </div>
              </button>
            )}

            {isNewStudentTestActive && (
              <button 
                type="button"
                onClick={() => setActiveView('newStudentTest')} 
                className="py-3 px-4 sm:p-6 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border-2 border-teal-500/50 hover:border-teal-600 hover:shadow-xl transition-all flex flex-row sm:flex-col items-center text-right sm:text-center justify-start sm:justify-center gap-3.5 sm:gap-3 group active:scale-98 sm:active:scale-95 relative overflow-hidden shadow-sm"
              >
                <div className="w-11 h-11 sm:w-16 sm:h-16 shrink-0 rounded-xl sm:rounded-2xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-2xl sm:text-3xl group-hover:scale-105 sm:group-hover:scale-110 transition-transform">
                  🎓
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center sm:justify-center gap-2">
                    <span className="block text-base sm:text-lg font-black text-gray-900 dark:text-white truncate sm:whitespace-normal">
                      اختبار طالب جديد
                    </span>
                    <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-teal-500"></span>
                    </span>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 block truncate sm:whitespace-normal">
                    تسجيل وتقييم الطلاب المستجدين
                  </span>
                </div>
              </button>
            )}

            {canViewBehaviors && (
              <button 
                type="button"
                onClick={() => setActiveView('behaviors')} 
                className="py-3 px-4 sm:p-6 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border-2 border-amber-500/50 hover:border-amber-600 hover:shadow-xl transition-all flex flex-row sm:flex-col items-center text-right sm:text-center justify-start sm:justify-center gap-3.5 sm:gap-3 group active:scale-98 sm:active:scale-95 shadow-sm"
              >
                <div className="w-11 h-11 sm:w-16 sm:h-16 shrink-0 rounded-xl sm:rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center text-2xl sm:text-3xl group-hover:scale-105 sm:group-hover:scale-110 transition-transform">
                  ⭐
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-base sm:text-lg font-black text-gray-900 dark:text-white truncate sm:whitespace-normal">
                    سجل السلوكيات
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 block truncate sm:whitespace-normal">
                    متابعة وتدوين سلوكيات الطلاب
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* زر العودة للقائمة الرئيسية عند الانتقال لأي قسم (إذا كانت الميزات مفعلة) */}
      {hasSpecialFeatures && activeView !== 'menu' && (
        <div className="flex justify-between items-center max-w-4xl mx-auto px-1">
          <button
            type="button"
            onClick={handleReturnToMenu}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-2 border-emerald-600 dark:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-700 dark:hover:border-emerald-400 transition-all flex items-center gap-2.5 shadow-sm active:scale-95 cursor-pointer ring-1 ring-emerald-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 rtl:rotate-0 rotate-180 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span>العودة للقائمة الرئيسية</span>
          </button>
        </div>
      )}

      {/* إذا لم تكن الميزات الخاصة مفعلة ولكن المعلم لديه صلاحية سجل السلوكيات فقط */}
      {!hasSpecialFeatures && canViewBehaviors && (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-2 bg-gray-100/90 dark:bg-gray-900/80 rounded-2xl w-full max-w-md sm:max-w-none sm:w-fit mx-auto mb-6 border border-gray-200/90 dark:border-gray-700/90 shadow-sm justify-center items-stretch sm:items-center">
          <button 
            type="button"
            onClick={() => setActiveView('evaluate')} 
            className={`w-full sm:w-auto px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 border-2 shadow-xs cursor-pointer active:scale-95 ${
              activeView === 'evaluate' 
                ? 'bg-emerald-700 text-white border-emerald-800 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/30' 
                : 'bg-white dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-gray-750 hover:text-emerald-800 dark:hover:text-emerald-300'
            }`}
          >
            <span className="text-base">📖</span>
            <span>{hasActiveMatns ? 'التقييم الأسبوعي (الحفظ، المتون، السرد)' : 'التقييم الأسبوعي (الحفظ، السرد)'}</span>
          </button>

          <button 
            type="button"
            onClick={() => setActiveView('behaviors')} 
            className={`w-full sm:w-auto px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 border-2 shadow-xs cursor-pointer active:scale-95 ${
              activeView === 'behaviors' 
                ? 'bg-amber-600 text-white border-amber-700 dark:border-amber-400 shadow-md ring-2 ring-amber-500/30' 
                : 'bg-white dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50/60 dark:hover:bg-gray-750 hover:text-amber-800 dark:hover:text-amber-300'
            }`}
          >
            <span className="text-base">⭐</span>
            <span>سجل السلوكيات</span>
          </button>
        </div>
      )}

      {activeView === 'evaluate' && (
        <ErrorBoundary fallbackTitle="تنبيه في نموذج التقييم">
          <EvaluationForm 
            teacherId={teacherId} 
            onFormSubmit={handleFormSubmit}
            onBackToMenu={hasSpecialFeatures ? handleReturnToMenu : undefined}
          />
        </ErrorBoundary>
      )}

      {activeView === 'behaviors' && canViewBehaviors && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-slate-800">
          {!isBehaviorsUnlocked ? (
            <div className="max-w-sm mx-auto text-center space-y-4 py-10">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-gray-800 dark:text-gray-200">سجل السلوكيات محمي</h3>
              <p className="text-sm text-gray-500 font-bold mb-4">الرجاء إدخال كلمة المرور المخصصة لك للوصول إلى السجل</p>
              
              <div className="relative">
                <input 
                  type="password" 
                  value={behaviorPassword}
                  onChange={(e) => { setBehaviorPassword(e.target.value); setPasswordError(''); }}
                  placeholder="كلمة المرور..."
                  className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition-all font-bold text-center"
                />
              </div>
              
              {passwordError && (
                <p className="text-red-500 text-xs font-bold">{passwordError}</p>
              )}
              
              <button 
                type="button"
                onClick={() => {
                  if (behaviorPassword === currentUser?.behaviorsPassword) {
                    setIsBehaviorsUnlocked(true);
                  } else {
                    setPasswordError('كلمة المرور غير صحيحة');
                  }
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-md active:scale-95 text-sm"
              >
                دخول
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              <SupervisorSuggestionsView isTeacher={true} />
            </div>
          )}
        </div>
      )}

      {activeView === 'test' && (
        <ErrorBoundary fallbackTitle="تنبيه في تقييم الاختبار">
          <TestEvaluationForm 
            teacherId={teacherId} 
            onFormSubmit={handleFormSubmit} 
            onReturnToMenu={handleReturnToMenu}
          />
        </ErrorBoundary>
      )}

      {activeView === 'newStudentTest' && (
        <ErrorBoundary fallbackTitle="تنبيه في اختبار الطلاب الجدد">
          <NewStudentTestForm 
            teacherId={teacherId} 
            onReturnToMenu={handleReturnToMenu}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default TeacherDashboard;


