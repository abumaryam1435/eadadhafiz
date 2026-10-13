
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
const REMEMBER_TEACHER_NAME_KEY = 'hafiz_rem_teacher_name';
const REMEMBER_TEACHER_CAT_KEY = 'hafiz_rem_teacher_cat';
const REMEMBER_TEACHER_PASS_KEY = 'hafiz_rem_teacher_pwd';
const REMEMBER_TEACHER_IBRI_KEY = 'hafiz_rem_t_ibri';
const REMEMBER_TEACHER_OUTSIDE_KEY = 'hafiz_rem_t_outside';

type LoginMode = 'initial' | 'supervisor' | 'maghrib' | 'teacher_category' | 'teacher_password' | 'teacher_select';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const context = useContext(AppContext);

  const { 
    users = [], 
    halaqas = [], 
    supervisorPassword = "", 
    maghribPassword = "", 
    teacherIbriPassword = "Ibri123", 
    teacherOutsidePassword = "Ameen123", 
    appName = "", 
    darkMode = false, 
    toggleDarkMode = () => {}, 
    isLoadingFirebase = false 
  } = context || {};

  const [mode, setMode] = useState<LoginMode>('initial');
  const [selectedTeacherCategory, setSelectedTeacherCategory] = useState<'ibri' | 'outside'>('ibri');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberTeacher, setRememberTeacher] = useState<boolean>(() => {
    return localStorage.getItem(REMEMBER_TEACHER_KEY) !== null || true;
  });
  const [error, setError] = useState('');
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [forceUpdate, setForceUpdate] = useState(0); // To trigger re-render on storage clear
  
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const teacherSearchInputRef = useRef<HTMLInputElement>(null);
  const teacherSectionRef = useRef<HTMLDivElement>(null);
  const mainWrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const scrollSearchToTop = () => {
    const doScroll = () => {
      if (teacherSectionRef.current) {
        teacherSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (mainWrapperRef.current) {
        const offset = teacherSectionRef.current?.offsetTop || 0;
        mainWrapperRef.current.scrollTo({ top: Math.max(0, offset - 20), behavior: 'smooth' });
      }
      window.scrollTo({ top: teacherSectionRef.current?.offsetTop || 0, behavior: 'smooth' });
    };

    doScroll();
    setTimeout(doScroll, 120);
    setTimeout(doScroll, 320);
  };

  const teachers = useMemo(() => users.filter(u => u.role === UserRole.TEACHER), [users]);

  // Teachers filtered by selected category
  const categoryTeachers = useMemo(() => {
    return teachers.filter(t => {
      const teacherHalaqas = halaqas.filter(h => h.teacherId === t.id || h.testTeacherId === t.id);
      if (selectedTeacherCategory === 'outside') {
        const hasOutsideHalaqa = teacherHalaqas.some(h => h.category === 'outside');
        return hasOutsideHalaqa || (t.category === 'outside' && teacherHalaqas.length === 0);
      } else {
        const hasIbriHalaqa = teacherHalaqas.some(h => (h.category || 'ibri') === 'ibri');
        const hasOutsideHalaqa = teacherHalaqas.some(h => h.category === 'outside');
        if (hasIbriHalaqa) return true;
        if (hasOutsideHalaqa) return false;
        return t.category !== 'outside';
      }
    });
  }, [teachers, halaqas, selectedTeacherCategory]);

  const filteredTeachers = useMemo(() => {
    return categoryTeachers
      .filter(t => isSmartMatch(t.name, teacherSearchTerm))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [categoryTeachers, teacherSearchTerm]);

  // Check for saved teacher on mount or update
  const savedTeacherId = useMemo(() => localStorage.getItem(REMEMBER_TEACHER_KEY), [forceUpdate, mode]);
  const savedTeacherCategory = useMemo(() => (localStorage.getItem(REMEMBER_TEACHER_CAT_KEY) as 'ibri' | 'outside') || 'ibri', [forceUpdate, mode]);
  const savedTeacherName = useMemo(() => localStorage.getItem(REMEMBER_TEACHER_NAME_KEY), [forceUpdate, mode]);
  const savedTeacher = useMemo(() => {
    if (!savedTeacherId) return null;
    const found = teachers.find(t => t.id.toString() === savedTeacherId);
    if (found) return found;
    if (savedTeacherName) {
      return { id: Number(savedTeacherId) || 0, name: savedTeacherName, role: UserRole.TEACHER, category: savedTeacherCategory } as User;
    }
    return null;
  }, [savedTeacherId, savedTeacherName, savedTeacherCategory, teachers]);

  const handleQuickTeacherLogin = () => {
    if (!savedTeacher || isLoadingFirebase) return;
    const cat = savedTeacherCategory || 'ibri';
    const storageKey = cat === 'ibri' ? REMEMBER_TEACHER_IBRI_KEY : REMEMBER_TEACHER_OUTSIDE_KEY;
    const savedPass = localStorage.getItem(REMEMBER_TEACHER_PASS_KEY) || localStorage.getItem(storageKey);
    const expectedPass = cat === 'ibri' ? (teacherIbriPassword || 'Ibri123') : (teacherOutsidePassword || 'Ameen123');

    // إذا كانت كلمة المرور متطابقة، دخول فوري مباشر
    if (savedPass && (savedPass.trim() === expectedPass.trim() || savedPass.trim().toLowerCase() === expectedPass.trim().toLowerCase())) {
      const fullTeacher = teachers.find(t => t.id.toString() === savedTeacher.id.toString()) || savedTeacher;
      onLogin(fullTeacher);
    } else {
      // إذا لم تكن محفوظة أو تم تغييرها من المشرف، فتح شاشة كلمة المرور للقسم
      setSelectedTeacherCategory(cat);
      setMode('teacher_password');
      setError('تم تحديث كلمة المرور من قبل المشرف، يرجى إدخال كلمة المرور للمتابعة');
    }
  };

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
    } else if (mode === 'teacher_password') {
      const storageKey = selectedTeacherCategory === 'ibri' ? REMEMBER_TEACHER_IBRI_KEY : REMEMBER_TEACHER_OUTSIDE_KEY;
      const saved = localStorage.getItem(storageKey);
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
    } else if (mode === 'teacher_select') {
      setTimeout(() => {
        scrollSearchToTop();
      }, 80);
    }
  }, [mode, selectedTeacherCategory]);

  // Keep search box scrolled to top when mobile keyboard opens
  useEffect(() => {
    if (mode !== 'teacher_select') return;
    const handleViewportResize = () => {
      if (document.activeElement === teacherSearchInputRef.current) {
        teacherSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportResize);
      };
    }
  }, [mode]);

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
    } else if (mode === 'teacher_password') {
      const expectedPassword = selectedTeacherCategory === 'ibri' 
        ? (teacherIbriPassword || 'Ibri123') 
        : (teacherOutsidePassword || 'Ameen123');

      const matches = password.trim() === expectedPassword.trim() || password.trim().toLowerCase() === expectedPassword.trim().toLowerCase();

      if (matches) {
        const storageKey = selectedTeacherCategory === 'ibri' ? REMEMBER_TEACHER_IBRI_KEY : REMEMBER_TEACHER_OUTSIDE_KEY;
        if (rememberMe) {
          localStorage.setItem(storageKey, password);
          localStorage.setItem(REMEMBER_TEACHER_PASS_KEY, password);
        } else {
          localStorage.removeItem(storageKey);
        }

        setMode('teacher_select');
        setError('');
        setPassword('');
        setTimeout(() => {
          scrollSearchToTop();
        }, 80);
      } else {
        setError(selectedTeacherCategory === 'ibri' ? 'الرقم السري لمعلمي جامع عبري غير صحيح' : 'الرقم السري لخارج جامع عبري غير صحيح');
      }
    }
  };

  const handleTeacherSelect = (t: User) => {
      if (isLoadingFirebase) return;
      if (rememberTeacher) {
          localStorage.setItem(REMEMBER_TEACHER_KEY, t.id.toString());
          localStorage.setItem(REMEMBER_TEACHER_NAME_KEY, t.name);
          localStorage.setItem(REMEMBER_TEACHER_CAT_KEY, selectedTeacherCategory);
          const expectedPass = selectedTeacherCategory === 'ibri' ? (teacherIbriPassword || 'Ibri123') : (teacherOutsidePassword || 'Ameen123');
          localStorage.setItem(REMEMBER_TEACHER_PASS_KEY, expectedPass);
          const storageKey = selectedTeacherCategory === 'ibri' ? REMEMBER_TEACHER_IBRI_KEY : REMEMBER_TEACHER_OUTSIDE_KEY;
          localStorage.setItem(storageKey, expectedPass);
      } else {
          localStorage.removeItem(REMEMBER_TEACHER_KEY);
          localStorage.removeItem(REMEMBER_TEACHER_NAME_KEY);
          localStorage.removeItem(REMEMBER_TEACHER_CAT_KEY);
          localStorage.removeItem(REMEMBER_TEACHER_PASS_KEY);
      }
      onLogin(t);
  };

  if (!context) return null;

  const isTeacherView = mode === 'teacher_select';

  return (
    <div ref={mainWrapperRef} className="flex flex-col items-center justify-center min-h-[100dvh] p-2 sm:p-8 bg-green-50 dark:bg-slate-950 transition-colors duration-500 overflow-y-auto overflow-x-hidden">
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

      <div 
        ref={cardRef}
        className={`w-full max-w-md p-5 sm:p-10 bg-white rounded-[2.5rem] text-center shadow-2xl golden-frame dark:bg-slate-900 animate-fade-in relative flex flex-col transition-all duration-300 ${
          isTeacherView 
            ? 'justify-start pt-4 sm:pt-8 min-h-0 my-auto' 
            : 'justify-center min-h-[98dvh] sm:min-h-fit mb-0 sm:mb-auto'
        }`}
      >
        <div className={`flex flex-col transition-all duration-300 ${isTeacherView ? 'justify-start' : 'flex-grow justify-center'}`}>
            <Logo className={`transition-all duration-300 mx-auto drop-shadow-2xl ${
              isTeacherView 
                ? 'h-14 w-14 sm:h-20 sm:w-20 mb-2' 
                : 'h-24 w-24 sm:h-28 sm:w-28 mb-3'
            }`} />
            <h1 
              className={`font-[900] text-green-900 dark:text-green-400 flex items-center justify-center gap-1.5 tracking-wide transition-all duration-300 ${
                isTeacherView ? 'text-lg sm:text-xl mb-1' : 'text-xl sm:text-2xl mb-3'
              }`}
              style={{ fontFamily: "'Cairo', 'Tajawal', 'Alexandria', 'IBM Plex Sans Arabic', sans-serif" }}
            >
              <span className="text-xs sm:text-sm text-gold opacity-80 select-none">✦</span>
              <span>{appName && appName !== 'إعداد حافظ' ? appName : 'مشروع إعداد حافظ'}</span>
              <span className="text-xs sm:text-sm text-gold opacity-80 select-none">✦</span>
            </h1>
            <p className={`font-amiri golden-text transition-all duration-300 italic ${
              isTeacherView 
                ? 'hidden sm:block text-sm sm:text-lg mb-3' 
                : 'text-xl sm:text-2xl mb-8'
            }`}>"خيركم من تعلم القرآن وعلمه"</p>

            {/* 1. الشاشة الرئيسية لاختيار بوابة الدخول */}
            {mode === 'initial' && (
            <div className="space-y-4 w-full animate-in fade-in duration-300">
                <button 
                  onClick={() => { setMode('supervisor'); setError(''); setPassword(''); }} 
                  className="w-full py-5 text-xl font-black text-white bg-green-700 rounded-2xl hover:bg-green-800 transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  دخول المشرف
                </button>
                
                {savedTeacher ? (
                  <div className="space-y-1 w-full">
                    <button 
                      onClick={handleQuickTeacherLogin} 
                      className="w-full py-5 px-4 text-xl font-bold text-emerald-800 bg-emerald-50 rounded-2xl border-2 border-emerald-700 hover:bg-emerald-100 transition-all dark:bg-slate-800 dark:text-emerald-300 dark:border-emerald-600 active:scale-95 cursor-pointer shadow-sm text-center"
                    >
                      دخول المعلم ({savedTeacher.name})
                    </button>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem(REMEMBER_TEACHER_KEY);
                          localStorage.removeItem(REMEMBER_TEACHER_NAME_KEY);
                          localStorage.removeItem(REMEMBER_TEACHER_CAT_KEY);
                          localStorage.removeItem(REMEMBER_TEACHER_PASS_KEY);
                          setRememberTeacher(false);
                          setForceUpdate(p => p + 1);
                          setMode('teacher_category');
                          setError('');
                          setPassword('');
                        }}
                        className="text-xs font-semibold text-gray-500 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-emerald-300 cursor-pointer py-1 px-3 transition-colors"
                      >
                        تبديل المعلم / حساب آخر
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => { setMode('teacher_category'); setError(''); setPassword(''); }} 
                    className="w-full py-5 text-xl font-bold text-emerald-800 bg-emerald-50 rounded-2xl border-2 border-emerald-700 hover:bg-emerald-100 transition-all dark:bg-slate-800 dark:text-emerald-300 dark:border-emerald-600 active:scale-95 cursor-pointer shadow-sm"
                  >
                    دخول المعلم
                  </button>
                )}
                
                <button 
                  onClick={() => { setMode('maghrib'); setError(''); setPassword(''); }} 
                  className="w-full py-5 text-xl font-black text-amber-950 bg-amber-400 rounded-2xl hover:bg-amber-500 transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  إدارة الحضور
                </button>
            </div>
            )}

            {/* 2. شاشة اختيار فئة المعلم (جامع عبري / خارج جامع عبري) */}
            {mode === 'teacher_category' && (
            <div className="space-y-4 w-full animate-in slide-in-from-right-4 duration-300">
                <div className="mb-2 text-center">
                    <h3 className="text-2xl font-black text-green-950 dark:text-green-300">دخول المعلم</h3>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">اختر القسم الخاص بك للمتابعة:</p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setSelectedTeacherCategory('ibri');
                        setMode('teacher_password');
                        setError('');
                        setPassword('');
                    }}
                    className="w-full py-5 px-6 text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-600 dark:bg-slate-800 dark:text-emerald-300 dark:border-emerald-500 rounded-2xl shadow-md hover:shadow-xl transition-all active:scale-95 flex items-center justify-between cursor-pointer group"
                >
                    <div className="flex items-center gap-3.5">
                        <span className="text-3xl p-2 bg-white dark:bg-slate-700 rounded-xl shadow-xs">🕌</span>
                        <div className="text-right">
                            <div className="text-xl font-black text-emerald-900 dark:text-emerald-200">معلمو جامع عبري</div>
                            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">حلقات جامع عبري</div>
                        </div>
                    </div>
                    <span className="text-emerald-700 dark:text-emerald-400 font-black text-xl group-hover:-translate-x-1 transition-transform">⬅</span>
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSelectedTeacherCategory('outside');
                        setMode('teacher_password');
                        setError('');
                        setPassword('');
                    }}
                    className="w-full py-5 px-6 text-blue-950 bg-blue-50 hover:bg-blue-100 border-2 border-blue-600 dark:bg-slate-800 dark:text-blue-300 dark:border-blue-500 rounded-2xl shadow-md hover:shadow-xl transition-all active:scale-95 flex items-center justify-between cursor-pointer group"
                >
                    <div className="flex items-center gap-3.5">
                        <span className="text-3xl p-2 bg-white dark:bg-slate-700 rounded-xl shadow-xs">🌐</span>
                        <div className="text-right">
                            <div className="text-xl font-black text-blue-900 dark:text-blue-200">خارج جامع عبري</div>
                            <div className="text-xs text-blue-700 dark:text-blue-400 font-bold">حلقات خارج جامع عبري</div>
                        </div>
                    </div>
                    <span className="text-blue-700 dark:text-blue-400 font-black text-xl group-hover:-translate-x-1 transition-transform">⬅</span>
                </button>

                <button 
                  type="button" 
                  onClick={() => { setMode('initial'); setError(''); setPassword(''); }} 
                  className="w-full py-3.5 text-base font-black bg-gray-100 dark:bg-gray-800 dark:text-white rounded-2xl hover:bg-gray-200 transition-all mt-2 active:scale-95 cursor-pointer"
                >
                  رجوع
                </button>
            </div>
            )}

            {/* 3. شاشة إدخال الرقم السري (المشرف / إدارة الحضور / كلمة مرور المعلم حسب القسم) */}
            {(mode === 'supervisor' || mode === 'maghrib' || mode === 'teacher_password') && (
            <form onSubmit={handleLoginAttempt} className="space-y-6 animate-in slide-in-from-left-4 duration-300 w-full">
                <div className="text-center">
                    {mode === 'teacher_password' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-2 text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        <span>{selectedTeacherCategory === 'ibri' ? '🕌 معلمو جامع عبري' : '🌐 خارج جامع عبري'}</span>
                      </div>
                    )}
                    <h3 className="text-2xl font-black text-gray-800 dark:text-white">
                      {mode === 'supervisor' ? 'دخول المشرف' : mode === 'maghrib' ? 'إدارة الحضور' : (selectedTeacherCategory === 'ibri' ? 'دخول معلمي جامع عبري' : 'دخول المعلمين خارج جامع عبري')}
                    </h3>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
                      {mode === 'teacher_password' 
                        ? (selectedTeacherCategory === 'ibri' ? 'أدخل كلمة المرور المحددة لمعلمي جامع عبري' : 'أدخل كلمة المرور المحددة لخارج عبري')
                        : 'أدخل الرقم السري للمتابعة'}
                    </p>
                </div>
                
                <div className="space-y-4 text-right">
                <input
                    ref={passwordInputRef}
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="أدخل الرقم السري"
                    className="input-style text-center text-3xl tracking-[0.5rem] font-bold py-4"
                    disabled={isLoadingFirebase}
                    autoFocus
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
                <button 
                  type="button" 
                  onClick={() => {
                    if (mode === 'teacher_password') setMode('teacher_category');
                    else setMode('initial');
                    setError(''); 
                    setPassword('');
                  }} 
                  className="flex-1 py-4 text-lg font-black bg-gray-100 dark:bg-gray-800 dark:text-white rounded-2xl hover:bg-gray-200 transition-all cursor-pointer"
                >
                  رجوع
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] py-4 text-lg font-black text-white bg-green-700 rounded-2xl hover:bg-green-800 shadow-xl transition-all active:scale-95 cursor-pointer" 
                  disabled={isLoadingFirebase}
                >
                    {isLoadingFirebase ? 'جاري التحميل...' : 'دخول'}
                </button>
                </div>
            </form>
            )}

            {/* 4. شاشة اختيار المعلم بالاسم (مصفاة حسب القسم) */}
            {mode === 'teacher_select' && (
            <div ref={teacherSectionRef} className="space-y-3 sm:space-y-4 animate-in slide-in-from-right-4 duration-300 flex flex-col w-full scroll-mt-2">
                <div className="flex items-center justify-between px-2 py-1 bg-green-50 dark:bg-slate-800/80 rounded-xl border border-green-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{selectedTeacherCategory === 'ibri' ? '🕌' : '🌐'}</span>
                        <span className="font-black text-xs sm:text-sm text-green-900 dark:text-green-300">
                            {selectedTeacherCategory === 'ibri' ? 'معلمو جامع عبري' : 'معلمو خارج جامع عبري'}
                        </span>
                        <span className="text-xs bg-green-200 dark:bg-green-900 text-green-900 dark:text-green-200 px-2 py-0.5 rounded-full font-bold">
                            {categoryTeachers.length}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setMode('teacher_category'); setError(''); }}
                        className="text-[11px] font-bold text-gray-600 hover:text-green-800 dark:text-gray-300 underline cursor-pointer"
                    >
                        تغيير القسم
                    </button>
                </div>

                <div className="relative flex items-center">
                <input 
                  ref={teacherSearchInputRef}
                  type="text" 
                  placeholder="ابحث عن اسمك..." 
                  value={teacherSearchTerm} 
                  onChange={e => {
                    setTeacherSearchTerm(e.target.value);
                    scrollSearchToTop();
                  }}
                  onFocus={scrollSearchToTop}
                  onClick={scrollSearchToTop}
                  className="input-style pr-12 pl-10 font-bold py-3.5 sm:py-4 w-full shadow-xs focus:ring-2 focus:ring-green-600 transition-all text-right" 
                  disabled={isLoadingFirebase} 
                  autoFocus
                />
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                {teacherSearchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherSearchTerm('');
                      if (teacherSearchInputRef.current) teacherSearchInputRef.current.focus();
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-200 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                    title="مسح البحث"
                  >
                    ✕
                  </button>
                )}
                </div>
                
                <div className="max-h-[46dvh] sm:max-h-[40dvh] overflow-y-auto border-2 border-gray-100 rounded-[1.5rem] p-2 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 custom-scrollbar shadow-inner">
                {filteredTeachers.map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => handleTeacherSelect(t)} 
                      className="w-full text-right p-3.5 sm:p-4 hover:bg-green-600 hover:text-white dark:hover:bg-green-700 rounded-2xl border-b dark:border-slate-700 last:border-0 font-black text-base sm:text-lg transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {t.name}
                    </button>
                ))}
                {filteredTeachers.length === 0 && !isLoadingFirebase && (
                  <div className="p-8 text-center text-gray-400 font-bold space-y-2">
                    <p>لا يوجد معلم بهذا الاسم في {selectedTeacherCategory === 'ibri' ? 'جامع عبري' : 'خارج جامع عبري'}</p>
                    <button
                      type="button"
                      onClick={() => { setMode('teacher_category'); setError(''); }}
                      className="text-xs text-green-700 dark:text-green-400 underline font-black"
                    >
                      التحقق من القسم الآخر
                    </button>
                  </div>
                )}
                </div>

                <div className="flex items-center gap-2 mt-2">
                    <button 
                      onClick={() => setMode('teacher_category')} 
                      className="flex-grow py-3 px-4 text-base font-black bg-red-50 text-red-700 border-2 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/50 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                        رجوع
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer p-3 bg-amber-50 border-2 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shrink-0 active:scale-95 shadow-xs">
                        <input 
                            type="checkbox" 
                            checked={rememberTeacher} 
                            onChange={e => setRememberTeacher(e.target.checked)}
                            className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="text-[11px] sm:text-xs font-black text-amber-900 dark:text-amber-200">
                          تذكر دخولي كمعلم (الاحتفاظ بالاسم وكلمة المرور في زر دخول المعلم)
                        </span>
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
