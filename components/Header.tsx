
import React, { useContext, useState } from 'react';
import { User, UserRole } from '../types';
import Logo from './Logo';
import { AppContext } from '../App';
import { SuggestionsModal } from './SuggestionsModal';

interface HeaderProps {
  user: User;
  onShowHelp: () => void;
  onInitiateLogoutCheck: () => void;
  onShowMobileInstallModal: () => void;
  onShowChangePassword: () => void;
  onGoToChoiceScreen?: () => void;
}

const roleMap = {
  [UserRole.SUPERVISOR]: 'مشرف',
  [UserRole.TEACHER]: 'معلم',
  [UserRole.MAGHRIB_ADMIN]: 'مسؤول المغرب',
};

const Header: React.FC<HeaderProps> = ({ user, onShowHelp, onInitiateLogoutCheck, onShowMobileInstallModal, onShowChangePassword, onGoToChoiceScreen }) => {
  const context = useContext(AppContext);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const appName = context?.appName || '';
  const darkMode = context?.darkMode || false;
  const toggleDarkMode = context?.toggleDarkMode || (() => {});

  const isSupervisor = user.role === UserRole.SUPERVISOR;

  const buttonBaseClass = "flex items-center justify-center p-2.5 text-sm font-extrabold text-green-900 bg-white rounded-xl hover:bg-gray-100 focus:outline-none ring-2 ring-transparent hover:ring-green-400 transition-all dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 sm:px-5 sm:py-2.5 sm:w-auto sm:gap-2 shadow-sm active:scale-95";

  return (
    <header className="bg-green-800 text-white shadow-2xl dark:bg-slate-900 dark:text-white border-b-[6px] border-[#D4AF37] sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between py-3 sm:h-24 gap-4 sm:gap-0">
          <div className="flex items-center space-x-4 rtl:space-x-reverse">
             <Logo className="h-16 w-16 drop-shadow-md" />
            <div className="flex flex-col text-right">
                <h1 className="text-xl sm:text-2xl font-black leading-tight tracking-tight">{appName}</h1>
                <p className="font-amiri text-sm text-yellow-300 font-bold italic hidden sm:block">خيركم من تعلم القرآن وعلمه</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-3 rtl:space-x-reverse flex-wrap justify-center sm:flex-nowrap">
            {isSupervisor && onGoToChoiceScreen && (
                 <button
                  onClick={onGoToChoiceScreen}
                  className="flex items-center justify-center p-2 text-xs font-extrabold text-green-950 bg-yellow-400 border-2 border-yellow-600/70 rounded-lg hover:bg-yellow-500 hover:border-yellow-700 transition-all sm:px-5 sm:py-2.5 sm:w-auto sm:gap-2 shadow-md active:scale-95"
                  aria-label="القائمة الرئيسية"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                  <span className="hidden sm:inline">القائمة الرئيسية</span>
                </button>
            )}
            
            <button
              onClick={toggleDarkMode}
              className={`${buttonBaseClass} !p-2 sm:!p-2.5 border-2 ${darkMode ? 'border-yellow-400/80 bg-slate-800 text-yellow-300 hover:border-yellow-300' : 'border-emerald-600/70 bg-white text-emerald-950 hover:border-emerald-700'} shadow-md`}
              aria-label={darkMode ? "الوضع الحالي: ليلي - انقر للتبديل إلى الوضع النهاري" : "الوضع الحالي: نهاري - انقر للتبديل إلى الوضع الليلي"}
              title={darkMode ? "الوضع الحالي: ليلي (انقر للتبديل إلى الوضع النهاري)" : "الوضع الحالي: نهاري (انقر للتبديل إلى الوضع الليلي)"}
            >
              {darkMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12 10.607a1 1 0 010-1.414l.706-.707a1 1 0 111.414 1.414l-.707.707a1 1 0 01-1.414 0zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
              ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-700 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
              )}
              <span className="hidden sm:inline font-bold">{darkMode ? "نهاري" : "ليلي"}</span>
            </button>

            {user.role === UserRole.TEACHER && (
              <button
                onClick={() => setShowSuggestions(true)}
                className="flex items-center justify-center p-2.5 text-sm font-extrabold text-green-950 bg-yellow-400 hover:bg-yellow-500 rounded-xl focus:outline-none ring-2 ring-transparent hover:ring-yellow-400 transition-all sm:px-5 sm:py-2.5 sm:w-auto sm:gap-2 shadow-md active:scale-95"
                title="مقترحات للمشرف"
                aria-label="تقديم مقترحات للمشرف"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="hidden sm:inline">الاقتراحات</span>
              </button>
            )}

            <div className="flex flex-col text-right px-1 sm:px-3 border-r-2 border-white/20 min-w-0 max-w-[80px] sm:max-w-none">
              <div className="font-black text-white text-[10px] sm:text-base truncate">{user.name}</div>
              <div className="text-[8px] sm:text-xs font-bold text-yellow-300 uppercase truncate">{(roleMap as any)[user.role]}</div>
            </div>

            {isSupervisor && (
              <button
                onClick={onShowChangePassword}
                className="flex items-center justify-center p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all shadow-md sm:px-4 active:scale-95"
                title="تغيير الرقم السري"
                aria-label="تغيير الرقم السري"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="hidden lg:inline mr-2 font-bold">الرقم السري</span>
              </button>
            )}

            <button
              onClick={onInitiateLogoutCheck}
              className="flex items-center justify-center p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md sm:px-4 active:scale-95"
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {showSuggestions && <SuggestionsModal onClose={() => setShowSuggestions(false)} />}
    </header>
  );
};

export default Header;
