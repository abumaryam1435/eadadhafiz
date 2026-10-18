
import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import Logo from './Logo';
import { MaghribProgramForm } from './MaghribProgramForm';
import { MaghribReportTable } from './MaghribReportTable';

export const MaghribDashboard: React.FC = () => {
  const context = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<'entry' | 'reports'>('entry');
  const [programType, setProgramType] = useState<'maghrib' | 'asr' | null>(null);

  const { appName, logout, darkMode, toggleDarkMode } = context || {};

  if (!programType) {
      
  return (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] p-1 sm:p-8 bg-green-50 dark:bg-slate-950 transition-colors duration-500 overflow-hidden">
            <div className="w-full max-w-md p-6 sm:p-10 bg-white rounded-[2.5rem] text-center shadow-2xl golden-frame dark:bg-slate-900 animate-fade-in relative flex flex-col justify-center min-h-[98dvh] sm:min-h-fit mb-0 sm:mb-auto">
                <div className="flex-grow flex flex-col justify-center">
                    <Logo className="h-24 w-24 sm:h-28 sm:w-28 mx-auto mb-6 drop-shadow-2xl" />
                    <h1 className="text-3xl sm:text-4xl font-black text-green-900 dark:text-green-400 mb-8">إدارة الحضور</h1>
                    
                    <div className="space-y-4 w-full">
                        <button 
                            onClick={() => setProgramType('maghrib')} 
                            className="w-full py-5 text-xl font-black text-amber-950 bg-amber-400 rounded-2xl hover:bg-amber-500 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
                        >
                            <span>🌅</span>
                            <span>برنامج المغرب</span>
                        </button>

                        <button 
                            onClick={() => setProgramType('asr')} 
                            className="w-full py-5 text-xl font-black text-blue-900 bg-blue-400 rounded-2xl hover:bg-blue-500 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
                        >
                            <span>☀️</span>
                            <span>برنامج العصر</span>
                        </button>

                        <button onClick={logout} className="w-full py-4 text-lg font-black bg-gray-100 dark:bg-gray-800 dark:text-white rounded-2xl hover:bg-gray-200 transition-all mt-4">تسجيل الخروج</button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  const programTitle = programType === 'maghrib' ? 'برنامج المغرب' : 'برنامج العصر';

  if (!context) return null;
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-green-800 text-white shadow-2xl dark:bg-slate-900 dark:text-white border-b-[6px] border-[#D4AF37] sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-6">
          <div className="flex flex-row items-center justify-between py-2 sm:py-3 min-h-[64px] sm:min-h-[80px] gap-2">
            <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0">
              <Logo className="h-9 w-9 sm:h-14 sm:w-14 drop-shadow-md shrink-0" />
              <div className="flex flex-col text-right min-w-0">
                <h1 className="text-xs sm:text-xl font-black leading-tight tracking-tight truncate max-w-[140px] sm:max-w-none">{appName}</h1>
                <span className="text-[10px] sm:text-xs text-yellow-300 font-bold truncate">{programTitle}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
               <button 
                 onClick={toggleDarkMode} 
                 className="w-9 h-9 sm:w-10 sm:h-10 bg-white/10 hover:bg-white/20 rounded-xl text-yellow-300 transition-all flex items-center justify-center text-sm sm:text-base"
                 title="الوضع الليلي"
                 aria-label="تبديل الوضع الليلي"
               >
                  {darkMode ? '☀️' : '🌙'}
               </button>
               <button 
                 onClick={() => setProgramType(null)} 
                 className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-white text-green-900 rounded-xl text-xs sm:text-sm font-black hover:bg-gray-100 transition-all shadow-xs flex items-center gap-1 cursor-pointer"
               >
                  <span>🔄</span>
                  <span>البرنامج</span>
               </button>

               <button 
                 onClick={logout} 
                 className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-red-500 text-white rounded-xl text-xs sm:text-sm font-black hover:bg-red-600 transition-all shadow-xs flex items-center gap-1 cursor-pointer"
               >
                  <span>🚪</span>
                  <span>خروج</span>
               </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-2xs">
        <div className="container mx-auto flex">
          <button 
            onClick={() => setActiveTab('entry')} 
            className={`flex-1 py-3 sm:py-4 font-black text-xs sm:text-base border-b-4 transition-all flex items-center justify-center gap-1.5 ${activeTab === 'entry' ? 'border-green-600 text-green-700 dark:text-green-400 bg-green-50/40 dark:bg-green-950/20' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <span>📝</span>
            <span>تسجيل غياب الطلاب</span>
          </button>
          <button 
            onClick={() => setActiveTab('reports')} 
            className={`flex-1 py-3 sm:py-4 font-black text-xs sm:text-base border-b-4 transition-all flex items-center justify-center gap-1.5 ${activeTab === 'reports' ? 'border-green-600 text-green-700 dark:text-green-400 bg-green-50/40 dark:bg-green-950/20' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <span>📊</span>
            <span>سجل تقارير الغياب</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto p-2 sm:p-6 lg:p-8">
        {activeTab === 'entry' ? (
          <div className="max-w-3xl mx-auto"><MaghribProgramForm onBack={() => {}} hideHeader programType={programType} /></div>
        ) : (
          <MaghribReportTable programType={programType} />
        )}
      </main>


    </div>
  );
};
