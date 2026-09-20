
import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import Logo from './Logo';
import { MaghribProgramForm } from './MaghribProgramForm';
import { MaghribReportTable } from './MaghribReportTable';
import Modal from './Modal';

export const MaghribDashboard: React.FC = () => {
  const context = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<'entry' | 'reports'>('entry');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [programType, setProgramType] = useState<'maghrib' | 'asr' | null>(null);

  const { appName, logout, maghribPassword, setMaghribPassword, darkMode, toggleDarkMode } = context;

  const handleUpdatePassword = () => {
    if (newPass.length < 4) return alert('كلمة السر قصيرة جداً');
    if (newPass !== confirmPass) return alert('كلمات السر غير متطابقة');
    setMaghribPassword(newPass);
    setShowPasswordModal(false);
    alert('تم تغيير كلمة السر بنجاح');
  };

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
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between py-3 sm:h-24 gap-4 sm:gap-0">
            <div className="flex items-center gap-3">
              <Logo className="h-14 w-14 sm:h-16 sm:w-16 drop-shadow-md" />
              <h1 className="text-xl sm:text-2xl font-black leading-tight tracking-tight hidden sm:block">{appName} - {programTitle}</h1>
            </div>
            <div className="flex gap-2 flex-nowrap justify-center sm:justify-end">
               <button onClick={toggleDarkMode} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-yellow-300 transition-all shrink-0">
                  {darkMode ? '☀️' : '🌙'}
               </button>
               <button onClick={() => setProgramType(null)} className="px-2 py-2 sm:px-4 sm:py-2.5 bg-white text-green-900 rounded-xl text-[10px] sm:text-sm font-extrabold hover:bg-gray-100 transition-all shadow-sm whitespace-nowrap">
                  تغيير البرنامج
               </button>
               <button onClick={() => setShowPasswordModal(true)} className="px-2 py-2 sm:px-4 sm:py-2.5 bg-amber-500 text-white rounded-xl text-[10px] sm:text-sm font-extrabold hover:bg-amber-600 transition-all shadow-sm whitespace-nowrap">
                  تغيير الرقم السري
               </button>
               <button onClick={logout} className="px-2 py-2 sm:px-4 sm:py-2.5 bg-red-500 text-white rounded-xl text-[10px] sm:text-sm font-extrabold hover:bg-red-600 transition-all shadow-sm whitespace-nowrap">
                  تسجيل الخروج
               </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="container mx-auto flex">
          <button 
            onClick={() => setActiveTab('entry')} 
            className={`flex-1 py-4 font-bold text-lg border-b-4 transition-all ${activeTab === 'entry' ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-transparent text-gray-400'}`}
          >
            تسجيل غياب الطلاب
          </button>
          <button 
            onClick={() => setActiveTab('reports')} 
            className={`flex-1 py-4 font-bold text-lg border-b-4 transition-all ${activeTab === 'reports' ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-transparent text-gray-400'}`}
          >
            سجل تقارير الغياب
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto p-4 sm:p-8">
        {activeTab === 'entry' ? (
          <div className="max-w-3xl mx-auto"><MaghribProgramForm onBack={() => {}} hideHeader programType={programType} /></div>
        ) : (
          <MaghribReportTable programType={programType} />
        )}
      </main>

      {/* Password Modal */}
      {showPasswordModal && (
        <Modal title={`تغيير الرقم السري لـ ${programTitle}`} onClose={() => setShowPasswordModal(false)} hideDefaultCloseButton>
           <div className="space-y-4">
              <p className="text-sm text-gray-500">الرقم السري الحالي هو: <span className="font-mono font-bold text-green-700">{maghribPassword}</span></p>
              <input type="password" placeholder="الرقم السري الجديد" value={newPass} onChange={e => setNewPass(e.target.value)} className="input-style" />
              <input type="password" placeholder="تأكيد الرقم السري" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="input-style" />
              <div className="flex gap-2 pt-4">
                <button onClick={() => setShowPasswordModal(false)} className="flex-1 py-2 bg-gray-200 rounded-lg">إلغاء</button>
                <button onClick={handleUpdatePassword} className="flex-1 py-2 bg-green-700 text-white rounded-lg">حفظ</button>
              </div>
           </div>
        </Modal>
      )}
    </div>
  );
};
