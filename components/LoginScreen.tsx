
import React, { useState, useContext, useMemo, useEffect, useRef } from 'react';
import { User, UserRole } from '../types';
import Logo from './Logo';
import { AppContext } from '../App';
import { isSmartMatch } from '../utils/searchUtils';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const REMEMBER_SUPERVISOR_KEY = 'hafiz_rem_sup';
const REMEMBER_MAGHRIB_KEY = 'hafiz_rem_mag';
const REMEMBER_TEACHER_KEY = 'hafiz_rem_teacher';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const context = useContext(AppContext);

  const { users = [], supervisorPassword = "", maghribPassword = "", appName = "", darkMode = false, toggleDarkMode = () => {}, isLoadingFirebase = false } = context || {};

  const [mode, setMode] = useState<'initial' | 'supervisor' | 'teacher' | 'maghrib'>('initial');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberTeacher, setRememberTeacher] = useState(false);
  const [error, setError] = useState('');
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [forceUpdate, setForceUpdate] = useState(0); // To trigger re-render on storage clear
  
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const teachers = useMemo(() => users.filter(u => u.role === UserRole.TEACHER), [users]);

  // Check for saved teacher on mount or update
  const savedTeacherId = useMemo(() => localStorage.getItem(REMEMBER_TEACHER_KEY), [forceUpdate, mode]);
  const savedTeacher = useMemo(() => savedTeacherId ? teachers.find(t => t.id.toString() === savedTeacherId) : null, [savedTeacherId, teachers]);

  useEffect(() => {
    if (mode === 'supervisor') {
      const saved = localStorage.getItem(REMEMBER_SUPERVISOR_KEY);
      if (saved) {
        setPassword(saved);
        setRememberMe(true);
        if (passwordInputRef.current) passwordInputRef.current.blur();
      } else {
        setPassword('');
        setRememberMe(false);
        setTimeout(() => {
            if (passwordInputRef.current) passwordInputRef.current.focus();
        }, 50);
      }
    } else if (mode === 'maghrib') {
      const saved = localStorage.getItem(REMEMBER_MAGHRIB_KEY);
      if (saved) {
        setPassword(saved);
        setRememberMe(true);
        if (passwordInputRef.current) passwordInputRef.current.blur();
      } else {
        setPassword('');
        setRememberMe(false);
        setTimeout(() => {
            if (passwordInputRef.current) passwordInputRef.current.focus();
        }, 50);
      }
    } else if (mode === 'teacher') {
        // Auto-login if teacher is saved
        if (savedTeacher) {
            onLogin(savedTeacher);
        }
    }
  }, [mode, savedTeacher, onLogin]);

  const handleLoginAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoadingFirebase) return;
    setError('');

    if (mode === 'supervisor') {
      if (password === supervisorPassword) {
        if (rememberMe) localStorage.setItem(REMEMBER_SUPERVISOR_KEY, password);
        else localStorage.removeItem(REMEMBER_SUPERVISOR_KEY);
        const supervisorUser = users.find(u => u.role === UserRole.SUPERVISOR) || { id: 1, name: 'المشرف', role: UserRole.SUPERVISOR };
        onLogin(supervisorUser);
      } else setError('الرقم السري للمشرف غير صحيح');
    } else if (mode === 'maghrib') {
      if (password === maghribPassword) {
        if (rememberMe) localStorage.setItem(REMEMBER_MAGHRIB_KEY, password);
        else localStorage.removeItem(REMEMBER_MAGHRIB_KEY);
        onLogin({ id: 999, name: 'مسؤول غياب المغرب', role: UserRole.MAGHRIB_ADMIN });
      } else setError('الرقم السري لبرنامج المغرب غير صحيح');
    }
  };

  const handleTeacherSelect = (t: User) => {
      if (isLoadingFirebase) return;
      if (rememberTeacher) {
          localStorage.setItem(REMEMBER_TEACHER_KEY, t.id.toString());
      } else {
          localStorage.removeItem(REMEMBER_TEACHER_KEY);
      }
      onLogin(t);
  };

  const filteredTeachers = useMemo(() => {
    return teachers
      .filter(t => isSmartMatch(t.name, teacherSearchTerm))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [teachers, teacherSearchTerm]);

  if (!context) return null;
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-1 sm:p-8 bg-green-50 dark:bg-slate-950 transition-colors duration-500 overflow-hidden">
      {isLoadingFirebase && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 border border-green-600/20">
                  <div className="w-12 h-12 border-[5px] border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                  <p className="font-black text-green-900 dark:text-green-300">مزامنة البيانات السحابية...</p>
              </div>
          </div>
      )}

      <button 
        onClick={toggleDarkMode} 
        className="absolute top-6 left-6 p-4 rounded-full bg-white shadow-xl dark:bg-gray-800 dark:text-yellow-400 border-2 border-gray-100 dark:border-gray-700 transition-all active:scale-90 z-50 text-xl"
      >
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="w-full max-w-md p-6 sm:p-10 bg-white rounded-[2.5rem] text-center shadow-2xl golden-frame dark:bg-slate-900 animate-fade-in relative flex flex-col justify-center min-h-[98dvh] sm:min-h-fit mb-0 sm:mb-auto">
        <div className="flex-grow flex flex-col justify-center">
            <Logo className="h-24 w-24 sm:h-28 sm:w-28 mx-auto mb-6 drop-shadow-2xl" />
            <h1 className="text-3xl sm:text-4xl font-black text-green-900 dark:text-green-400 mb-1">{appName}</h1>
            <p className="font-amiri text-xl sm:text-2xl golden-text mb-8 italic">"خيركم من تعلم القرآن وعلمه"</p>

            {mode === 'initial' && (
            <div className="space-y-4 w-full">
                <button onClick={() => setMode('supervisor')} className="w-full py-5 text-xl font-black text-white bg-green-700 rounded-2xl hover:bg-green-800 transition-all shadow-lg active:scale-95">دخول المشرف</button>
                
                <div className="relative w-full">
                    <button onClick={() => setMode('teacher')} className="w-full py-5 text-xl font-black text-green-800 bg-green-50 rounded-2xl border-2 border-green-700 hover:bg-green-100 transition-all dark:bg-slate-800 dark:text-green-300 dark:border-green-600 active:scale-95">
                        {savedTeacher ? `دخول: ${savedTeacher.name}` : 'دخول المعلم'}
                    </button>
                    {savedTeacher && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                localStorage.removeItem(REMEMBER_TEACHER_KEY);
                                setForceUpdate(n => n + 1);
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors z-10"
                            title="إلغاء الحفظ وتسجيل دخول بمعلم آخر"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
                
                <button onClick={() => setMode('maghrib')} className="w-full py-5 text-xl font-black text-amber-950 bg-amber-400 rounded-2xl hover:bg-amber-500 transition-all shadow-lg active:scale-95">إدارة الحضور</button>
            </div>
            )}

            {(mode === 'supervisor' || mode === 'maghrib') && (
            <form onSubmit={handleLoginAttempt} className="space-y-6 animate-in slide-in-from-left-4 duration-300 w-full">
                <h3 className="text-2xl font-black text-gray-800 dark:text-white">{mode === 'supervisor' ? 'دخول المشرف' : 'إدارة الحضور'}</h3>
                
                <div className="space-y-4 text-right">
                <input
                    ref={passwordInputRef}
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="أدخل الرقم السري"
                    className="input-style text-center text-3xl tracking-[0.5rem] font-bold py-4"
                    disabled={isLoadingFirebase}
                />
                
                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={e => setRememberMe(e.target.checked)}
                    disabled={isLoadingFirebase}
                    className="w-6 h-6 rounded border-gray-300 text-green-700 focus:ring-green-500"
                    />
                    <span className="text-lg font-bold text-gray-700 dark:text-gray-300">تذكر الرقم السري</span>
                </label>
                </div>

                {error && <p className="text-red-600 dark:text-red-400 text-base font-black animate-pulse">{error}</p>}
                
                <div className="flex gap-3">
                <button type="button" onClick={() => {setMode('initial'); setError(''); setPassword('');}} className="flex-1 py-4 text-lg font-black bg-gray-100 dark:bg-gray-800 dark:text-white rounded-2xl hover:bg-gray-200 transition-all">رجوع</button>
                <button type="submit" className="flex-[2] py-4 text-lg font-black text-white bg-green-700 rounded-2xl hover:bg-green-800 shadow-xl transition-all active:scale-95" disabled={isLoadingFirebase}>
                    {isLoadingFirebase ? 'جاري التحميل...' : 'دخول'}
                </button>
                </div>
            </form>
            )}

            {mode === 'teacher' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 flex flex-col w-full">
                <div className="relative">
                <input type="text" placeholder="ابحث عن اسمك..." value={teacherSearchTerm} onChange={e => setTeacherSearchTerm(e.target.value)} className="input-style pr-12 font-bold py-4" disabled={isLoadingFirebase} />
                <svg className="absolute right-4 top-4.5 h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                
                <div className="max-h-[40dvh] overflow-y-auto border-2 border-gray-100 rounded-[1.5rem] p-2 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 custom-scrollbar shadow-inner">
                {filteredTeachers.map(t => (
                    <button key={t.id} onClick={() => handleTeacherSelect(t)} className="w-full text-right p-4 hover:bg-green-600 hover:text-white dark:hover:bg-green-700 rounded-2xl border-b dark:border-slate-700 last:border-0 font-black text-lg transition-all active:scale-[0.98]">
                    {t.name}
                    </button>
                ))}
                {filteredTeachers.length === 0 && !isLoadingFirebase && <p className="p-10 text-gray-400 font-bold">لا يوجد معلم بهذا الاسم</p>}
                </div>

                <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setMode('initial')} className="flex-grow py-3 px-4 text-base font-black bg-red-50 text-red-700 border-2 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/50 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all shadow-sm active:scale-95">
                        رجوع
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer p-3 bg-amber-50 border-2 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/50 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors shrink-0 active:scale-95">
                        <input 
                            type="checkbox" 
                            checked={rememberTeacher} 
                            onChange={e => setRememberTeacher(e.target.checked)}
                            className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span className="text-[10px] sm:text-xs font-bold text-amber-800 dark:text-amber-300">حفظ دخولي</span>
                    </label>
                </div>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
