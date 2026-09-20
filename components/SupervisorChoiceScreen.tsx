
import React, { useContext } from 'react';
import { User } from '../types';
import Logo from './Logo';
import { AppContext } from '../App';

interface SupervisorChoiceScreenProps {
  user: User;
  onSelectDashboard: () => void;
  onSelectMaghrib: () => void;
  onLogout: () => void;
}

const SupervisorChoiceScreen: React.FC<SupervisorChoiceScreenProps> = ({ user, onSelectDashboard, onSelectMaghrib, onLogout }) => {
  const context = useContext(AppContext);
  const { appName } = context;

  if (!context) return null;
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-2xl text-center bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-2xl golden-frame">
        <div className="flex justify-center mb-6">
          <Logo className="h-28 w-28 drop-shadow-2xl" />
        </div>
        <h1 className="text-4xl font-black text-green-800 dark:text-green-300 mb-1">{appName}</h1>
        <p className="font-amiri text-2xl golden-text mb-6 italic">"خيركم من تعلم القرآن وعلمه"</p>
        
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 border-t dark:border-slate-800 pt-4 font-bold">مرحباً بك، {user.name}<br/>الرجاء اختيار الواجهة المطلوبة</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={onSelectDashboard}
            className="group flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-slate-800 rounded-[2rem] border-2 border-transparent hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-300 shadow-sm"
          >
            <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-700 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100">لوحة التحكم</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 font-bold">إدارة التقارير والطلاب</p>
          </button>
          
          <button
            onClick={onSelectMaghrib}
            className="group flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-900/20 rounded-[2rem] border-2 border-transparent hover:border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-800/40 transition-all duration-300 shadow-sm"
          >
            <div className="p-4 bg-amber-100 dark:bg-amber-900 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100">برنامج المغرب</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 font-bold">تسجيل الغياب السريع</p>
          </button>
        </div>

        <div className="mt-12">
          <button onClick={onLogout} className="px-10 py-4 text-lg font-black text-red-700 bg-red-50 rounded-2xl hover:bg-red-100 transition-all duration-300 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900">
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupervisorChoiceScreen;
