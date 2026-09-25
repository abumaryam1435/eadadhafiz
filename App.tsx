
import React, { useState, createContext, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Evaluation, UserRole, Student, Halaqa, FullBackupData, DeletedItem, MaghribAttendance, Suggestion, StudentBehavior, Matn, SardHalaqa, SardEvaluation, NewStudentTest } from './types';
import { INITIAL_USERS, DEFAULT_APP_NAME, DEFAULT_MAGHRIB_PASSWORD } from './constants';
import LoginScreen from './components/LoginScreen';
import SupervisorDashboard from './components/SupervisorDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import Header from './components/Header';
import { HelpModal } from './components/HelpModal';
import UnevaluatedStudentsWarningModal from './components/UnevaluatedStudentsWarningModal';
import MobileInstallModal from './components/MobileInstallModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import { initializeFirebase, getDb, HARDCODED_FIREBASE_CONFIG } from './utils/firebase';
import { MaghribDashboard } from './components/MaghribDashboard'; 
import { FirebaseSetupWizard } from './components/FirebaseSetupWizard';
import { preloadPagesOnIdle } from './utils/mushafPreload';
import { initSwipeNavigation } from './utils/navigationHistory';
import { PwaUpdater } from './PwaUpdater';
import { findSimilarHalaqa } from './utils/searchUtils';

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

export interface TeacherSessionState {
  activeView: 'menu' | 'evaluate' | 'test' | 'newStudentTest' | 'behaviors';
  step: string;
  selectedWeek: number | null;
}

interface AppContextType {
  users: User[];
  students: Student[];
  halaqas: Halaqa[];
  sardHalaqas: SardHalaqa[];
  evaluations: Evaluation[];
  sardEvaluations: SardEvaluation[];
  maghribAttendances: MaghribAttendance[]; 
  suggestions: Suggestion[];
  studentBehaviors: StudentBehavior[];
  matns: Matn[];
  addMatn: (matn: Omit<Matn, "id" | "updatedAt">) => void;
  updateMatn: (matn: Matn) => void;
  deleteMatn: (id: number) => void;
  addStudentBehavior: (behavior: Omit<StudentBehavior, 'id' | 'updatedAt'>) => void;
  updateStudentBehavior: (behavior: StudentBehavior) => void;
  deleteStudentBehavior: (behaviorId: number) => void;
  deleteAllStudentBehaviors: () => void;
  addEvaluation: (evaluation: Omit<Evaluation, 'id' | 'updatedAt'>) => void;
  updateEvaluation: (evaluation: Evaluation) => void;
  deleteEvaluation: (evaluationId: number) => void;
  addSardEvaluation: (evaluation: Omit<SardEvaluation, 'id' | 'updatedAt'>) => void;
  updateSardEvaluation: (evaluation: SardEvaluation) => void;
  deleteSardEvaluation: (evaluationId: number) => void;
  deleteAllSardEvaluations: () => Promise<void>;
  addMaghribAttendance: (attendance: Omit<MaghribAttendance, 'id' | 'updatedAt'>) => void;
  deleteMaghribAttendance: (attendanceId: number) => void; 
  addStudent: (student: Omit<Student, 'id'>) => number;
  updateStudent: (student: Student) => void;
  deleteStudent: (studentId: number) => void;
  resetAllStudentsLevelToAuto: () => void;
  assignStudentToSardHalaqa: (studentId: number, sardHalaqaId?: number) => void;
  addHalaqa: (halaqa: Omit<Halaqa, 'id'>) => number;
  updateHalaqa: (halaqa: Halaqa) => void;
  deleteHalaqa: (halaqaId: number) => void;
  assignTeacherToHalaqa: (halaqaId: number, teacherId: number) => void;
  addSardHalaqa: (sardHalaqa: Omit<SardHalaqa, 'id'>) => number;
  updateSardHalaqa: (sardHalaqa: SardHalaqa) => void;
  deleteSardHalaqa: (sardHalaqaId: number) => void;
  assignTeacherToSardHalaqa: (sardHalaqaId: number, teacherId: number) => void;
  addSuggestion: (suggestion: Omit<Suggestion, 'id' | 'updatedAt'>) => void;
  updateSuggestion: (suggestion: Suggestion) => void;
  deleteSuggestion: (suggestionId: number) => void;
  deleteAllSuggestions: () => void;
  deleteAllEvaluations: () => Promise<void>;
  deleteAllData: () => Promise<void>;
  loadMockData: () => void;
  customLogo: string | null;
  setCustomLogo: (logo: string | null) => void;
  addTeacher: (name: string) => number;
  updateTeacher: (teacher: User) => void;
  deleteTeacher: (teacherId: number) => void;
  importFullBackup: (data: FullBackupData) => void;
  supervisorPassword: string;
  setSupervisorPassword: (password: string) => void;
  maghribPassword: string;
  setMaghribPassword: (password: string) => void;
  logout: () => void;
  isLoading: boolean;
  isLoadingFirebase: boolean;
  latestWeek: number;
  lastUsedWeek: number | null;
  setLastUsedWeek: (week: number | null) => void;
  isTestActive: boolean;
  setIsTestActive: (active: boolean) => void;
  testScore: number;
  setTestScore: (score: number) => void;
  testName: string;
  setTestName: (name: string) => void;
  testDeductions: { fath: number; tashkeel: number; tajweed: number; passageChange?: number };
  setTestDeductions: (deductions: { fath: number; tashkeel: number; tajweed: number; passageChange?: number }) => void;
  isNewStudentTestActive: boolean;
  setIsNewStudentTestActive: (active: boolean) => void;
  allowTeacherEditOldMemorized?: boolean;
  setAllowTeacherEditOldMemorized?: (allowed: boolean) => void;
  newStudentTestScore: number;
  setNewStudentTestScore: (score: number) => void;
  newStudentPassingRate: number;
  setNewStudentPassingRate: (rate: number) => void;
  newStudentTestDeductions: { fath: number; tashkeel: number; tajweed: number };
  setNewStudentTestDeductions: (deductions: { fath: number; tashkeel: number; tajweed: number }) => void;
  newStudentTests: NewStudentTest[];
  addNewStudentTest: (test: Omit<NewStudentTest, 'id' | 'updatedAt'>) => number;
  updateNewStudentTest: (test: NewStudentTest) => void;
  deleteNewStudentTest: (testId: number) => void;
  deleteAllNewStudentTests?: () => void;
  acceptNewStudent: (testId: number, halaqaId?: number) => void;
  rejectNewStudent: (testId: number) => void;
  initiateLogoutCheck: () => void;
  appName: string;
  setAppName: (name: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  firebaseConnectionStatus: 'connected' | 'disconnected' | 'error' | 'connecting';
  firebaseConfig: any;
  setFirebaseConfig: (config: any) => void;
  isDistributable: boolean;
  isPublishedConnected: boolean;
  currentUser: User | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hijriAdjustments: Record<string, number>;
  setHijriAdjustment: (month: number, year: number, offset: number) => void;
  colorMap: Record<string, string>;
  setColorMap: (map: Record<string, string>) => void;
  saveColors: boolean;
  setSaveColors: (save: boolean) => void;
  rankColors: Record<string, string>;
  setRankColors: (colors: Record<string, string>) => void;
  manualRanks: Record<string, number>;
  setManualRanks: (ranks: Record<string, number>) => void;
  certificateConfig: any;
  setCertificateConfig: (config: any) => void;
  cardConfig: any;
  setCardConfig: (config: any) => void;
  testsSummaryFilteredData: any[];
  setTestsSummaryFilteredData: (data: any[]) => void;
  syncSettingsToCloud: () => void;
  resetCloudSettings: () => void;
  teacherSessionState?: TeacherSessionState;
  setTeacherSessionState?: React.Dispatch<React.SetStateAction<TeacherSessionState>>;
}

export const AppContext = createContext<AppContextType | null>(null);

const THEME_KEY = 'halaqaTheme_v2';
const LOCAL_STORAGE_DATA_KEY = 'halaqaAppData_local_cache';
const CURRENT_USER_KEY = 'halaqaCurrentUser'; 
const SESSION_TIMESTAMP_KEY = 'halaqaSessionStart'; // مفتاح تخزين وقت الدخول
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 ساعة بالميلي ثانية

const sanitizeForFirebase = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj === undefined ? null : obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirebase);
    }
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            newObj[key] = sanitizeForFirebase(val);
        }
    }
    return newObj;
};

let _lastId = 0;
const generateId = () => {
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  _lastId = _lastId >= id ? _lastId + 1 : id;
  return _lastId;
};

const getInitialStoredData = (): FullBackupData | null => {
  try {
    if (typeof window !== 'undefined' && (window as any).embeddedAppData) {
      try {
        const jsonStr = new TextDecoder().decode(Uint8Array.from(atob((window as any).embeddedAppData), c => c.charCodeAt(0)));
        const parsed = JSON.parse(jsonStr);
        if (parsed) return parsed;
      } catch (e) {
        console.error("Failed to parse embedded data", e);
      }
    }
    if (typeof window !== 'undefined') {
      const localData = localStorage.getItem(LOCAL_STORAGE_DATA_KEY);
      if (localData) {
        return JSON.parse(localData);
      }
    }
  } catch (e) {
    console.error("Failed to load initial local data", e);
  }
  return null;
};

const initialBackupData = getInitialStoredData();

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
      try {
          const savedUser = localStorage.getItem(CURRENT_USER_KEY);
          const savedTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
          
          if (savedUser && savedTimestamp) {
              const loginTime = parseInt(savedTimestamp, 10);
              const now = Date.now();
              
              // التحقق مما إذا مرت 24 ساعة
              if (now - loginTime < SESSION_TIMEOUT_MS) {
                  return JSON.parse(savedUser);
              }
          }
          
          // إذا انتهت الجلسة أو لم توجد بيانات، نقوم بتنظيف التخزين
          localStorage.removeItem(CURRENT_USER_KEY);
          localStorage.removeItem(SESSION_TIMESTAMP_KEY);
          return null;
      } catch (e) { return null; }
  });

  const [data, setData] = useState<{
    users: User[];
    halaqas: Halaqa[];
    sardHalaqas: SardHalaqa[];
    students: Student[];
    evaluations: Evaluation[];
    sardEvaluations: SardEvaluation[];
    maghribAttendances: MaghribAttendance[];
    suggestions: Suggestion[];
    studentBehaviors: StudentBehavior[];
    matns: Matn[];
    newStudentTests: NewStudentTest[];
  }>(() => ({
    users: initialBackupData?.users || INITIAL_USERS,
    halaqas: initialBackupData?.halaqas || [],
    sardHalaqas: initialBackupData?.sardHalaqas || [],
    students: (initialBackupData?.students || []).map(s => ({
      ...s,
      isFromIbri: s.isFromIbri !== undefined ? s.isFromIbri : true,
      manualStudentLevel: undefined,
      manualLevel: undefined,
      studentLevel: undefined,
    })),
    evaluations: initialBackupData?.evaluations || [],
    sardEvaluations: initialBackupData?.sardEvaluations || [],
    maghribAttendances: initialBackupData?.maghribAttendances || [],
    suggestions: initialBackupData?.suggestions || [],
    studentBehaviors: initialBackupData?.studentBehaviors || [],
    matns: initialBackupData?.matns || [],
    newStudentTests: initialBackupData?.newStudentTests || [],
  }));
  
  const [pendingDeletions, setPendingDeletions] = useState<Set<number>>(new Set());

  const [supervisorPassword, setSupervisorPasswordState] = useState<string>(() => initialBackupData?.supervisorPassword || '123');
  const [maghribPassword, setMaghribPasswordState] = useState<string>(() => initialBackupData?.maghribPassword || '123');
  const [customLogo, setCustomLogoState] = useState<string | null>(() => initialBackupData?.customLogo || null);
  const [appName, setAppNameState] = useState<string>(() => initialBackupData?.appName || DEFAULT_APP_NAME);
  const [hijriAdjustments, setHijriAdjustmentsState] = useState<Record<string, number>>(() => initialBackupData?.hijriAdjustments || {});
  const [colorMap, setColorMapState] = useState<Record<string, string>>(() => initialBackupData?.colorMap || {});
  const [saveColors, setSaveColorsState] = useState<boolean>(() => initialBackupData?.saveColors || false);
  const [rankColors, setRankColorsState] = useState<Record<string, string>>(() => initialBackupData?.rankColors || {});
  const [manualRanks, setManualRanksState] = useState<Record<string, number>>(() => initialBackupData?.manualRanks || {});
  const [certificateConfig, setCertificateConfigState] = useState<any>(() => initialBackupData?.certificateConfig || null);
  const [cardConfig, setCardConfigState] = useState<any>(() => initialBackupData?.cardConfig || null);
  const [testsSummaryFilteredData, setTestsSummaryFilteredData] = useState<any[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark';
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const [lastUsedWeek, setLastUsedWeekState] = useState<number | null>(null);
  const [isTestActiveState, setIsTestActiveState] = useState<boolean>(() => initialBackupData?.isTestActive || false);
  const [testScoreState, setTestScoreState] = useState<number>(() => initialBackupData?.testScore || 0);
  const [testNameState, setTestNameState] = useState<string>(() => initialBackupData?.testName || '');
  const [testDeductionsState, setTestDeductionsState] = useState<{ fath: number; tashkeel: number; tajweed: number; passageChange?: number }>(() => initialBackupData?.testDeductions ? { fath: 1, tashkeel: 1, tajweed: 0.5, passageChange: 2, ...initialBackupData.testDeductions } : { fath: 1, tashkeel: 1, tajweed: 0.5, passageChange: 2 });
  const [isNewStudentTestActiveState, setIsNewStudentTestActiveState] = useState<boolean>(() => initialBackupData?.isNewStudentTestActive ?? false);
  const [allowTeacherEditOldMemorizedState, setAllowTeacherEditOldMemorizedState] = useState<boolean>(() => initialBackupData?.allowTeacherEditOldMemorized ?? false);
  const [newStudentTestScoreState, setNewStudentTestScoreState] = useState<number>(() => initialBackupData?.newStudentTestScore ?? 100);
  const [newStudentPassingRateState, setNewStudentPassingRateState] = useState<number>(() => initialBackupData?.newStudentPassingRate ?? 70);
  const [newStudentTestDeductionsState, setNewStudentTestDeductionsState] = useState<{ fath: number; tashkeel: number; tajweed: number }>(() => initialBackupData?.newStudentTestDeductions || { fath: 1, tashkeel: 1, tajweed: 0.5 });
  const [firebaseConfigState, setFirebaseConfigState] = useState<any>(() => {
    if (initialBackupData?.isDistributable) {
      return initialBackupData?.firebaseConfig || null;
    }
    return initialBackupData?.firebaseConfig || HARDCODED_FIREBASE_CONFIG;
  });
  const [firebaseConnectionStatus, setFirebaseConnectionStatus] = useState<'connected' | 'disconnected' | 'error' | 'connecting'>('disconnected');
  const [syncQueue, setSyncQueue] = useState<any[]>(() => {
    try {
      const queueStr = localStorage.getItem('halaqaSyncQueue');
      return queueStr ? JSON.parse(queueStr) : [];
    } catch (e) {
      return [];
    }
  });

  const processSyncQueue = useCallback(async () => {
    if (navigator.onLine && firebaseConnectionStatus === 'connected') {
        const queueStr = localStorage.getItem('halaqaSyncQueue');
        if (queueStr) {
            try {
                const queue = JSON.parse(queueStr);
                if (queue.length > 0) {
                    const db = getDb();
                    if (db) {
                        for (const item of queue) {
                            await db.ref(item.path).set(sanitizeForFirebase(item.value));
                        }
                        localStorage.removeItem('halaqaSyncQueue');
                        setSyncQueue([]);
                        showToast('✅ تم مزامنة البيانات المخزنة محلياً', 'success');
                    }
                }
            } catch (e) { console.error("Sync error:", e); }
        }
    }
  }, [firebaseConnectionStatus, showToast]);

  useEffect(() => {
    const handleOnline = () => {
        setFirebaseConnectionStatus('connecting');
        processSyncQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [processSyncQueue]);
  const [isDistributable, setIsDistributable] = useState(() => !!initialBackupData?.isDistributable);
  const [isPublishedConnected, setIsPublishedConnected] = useState(() => !!initialBackupData?.isPublishedConnected);

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMobileInstallModal, setShowMobileInstallModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFirebase, setIsLoadingFirebase] = useState(false);
  const [unevaluatedStudentsModalOpen, setUnevaluatedStudentsModalOpen] = useState(false);
  const [unevaluatedCheckedWeek, setUnevaluatedCheckedWeek] = useState<number>(1);
  const [unevaluatedQuranStudents, setUnevaluatedQuranStudents] = useState<string[]>([]);
  const [unevaluatedMutoonStudents, setUnevaluatedMutoonStudents] = useState<string[]>([]);
  const [unevaluatedSardStudents, setUnevaluatedSardStudents] = useState<string[]>([]);
  const [teacherSessionState, setTeacherSessionState] = useState<TeacherSessionState>({
    activeView: 'evaluate',
    step: 'selectHalaqa',
    selectedWeek: null,
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    const rootDiv = document.getElementById('root');
    const metaTheme = document.querySelector('meta[name="theme-color"]');

    // إجبار المتصفح على احترام وضع التطبيق واستقلاله التام عن إعدادات الهاتف (Android و iPhone)
    root.style.colorScheme = darkMode ? 'dark' : 'light';
    if (body) body.style.colorScheme = darkMode ? 'dark' : 'light';

    // تحديث وسم color-scheme لمنع ميزة التعتيم التلقائي في متصفحات أندرويد (Chrome Auto-Dark Mode)
    let metaColorScheme = document.querySelector('meta[name="color-scheme"]');
    if (!metaColorScheme) {
      metaColorScheme = document.createElement('meta');
      metaColorScheme.setAttribute('name', 'color-scheme');
      document.head.appendChild(metaColorScheme);
    }
    metaColorScheme.setAttribute('content', darkMode ? 'dark' : 'light');

    // شريط الحالة في أجهزة iOS (iPhone/iPad)
    const metaStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (metaStatusBar) {
      metaStatusBar.setAttribute('content', darkMode ? 'black-translucent' : 'default');
    }

    if (darkMode) {
      root.classList.add('dark');
      if (body) body.classList.add('dark');
      if (rootDiv) rootDiv.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
      if (metaTheme) metaTheme.setAttribute('content', '#020617');
    } else {
      root.classList.remove('dark');
      if (body) body.classList.remove('dark');
      if (rootDiv) rootDiv.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
      if (metaTheme) metaTheme.setAttribute('content', '#006A4E');
    }
  }, [darkMode]);

  const loadData = useCallback(async () => {
    let loadedConfig: FullBackupData | null = null;
    if ((window as any).embeddedAppData) {
       try {
           const jsonStr = new TextDecoder().decode(Uint8Array.from(atob((window as any).embeddedAppData), c => c.charCodeAt(0)));
           loadedConfig = JSON.parse(jsonStr);
       } catch(e) { console.error("Failed to parse embedded data", e); }
    }
    if (!loadedConfig) {
        const localData = localStorage.getItem(LOCAL_STORAGE_DATA_KEY);
        if (localData) { try { loadedConfig = JSON.parse(localData); } catch (e) {} }
    }
    if (loadedConfig) {
      setData(prev => ({
        users: loadedConfig?.users || prev.users || INITIAL_USERS,
        halaqas: loadedConfig?.halaqas || prev.halaqas || [],
        sardHalaqas: loadedConfig?.sardHalaqas || prev.sardHalaqas || [],
        students: loadedConfig?.students || prev.students || [],
        evaluations: loadedConfig?.evaluations || prev.evaluations || [],
        sardEvaluations: loadedConfig?.sardEvaluations || prev.sardEvaluations || [],
        maghribAttendances: loadedConfig?.maghribAttendances || prev.maghribAttendances || [],
        suggestions: loadedConfig?.suggestions || prev.suggestions || [],
        studentBehaviors: loadedConfig?.studentBehaviors || prev.studentBehaviors || [],
        matns: loadedConfig?.matns || prev.matns || [],
        newStudentTests: loadedConfig?.newStudentTests || prev.newStudentTests || [],
      }));
      if (loadedConfig.appName) setAppNameState(loadedConfig.appName);
      if (loadedConfig.customLogo !== undefined) setCustomLogoState(loadedConfig.customLogo);
      if (loadedConfig.supervisorPassword) setSupervisorPasswordState(loadedConfig.supervisorPassword);
      if (loadedConfig.maghribPassword) setMaghribPasswordState(loadedConfig.maghribPassword);
      if (loadedConfig.hijriAdjustments) setHijriAdjustmentsState(loadedConfig.hijriAdjustments);
      if (loadedConfig.isTestActive !== undefined) setIsTestActiveState(loadedConfig.isTestActive);
      if (loadedConfig.testScore !== undefined) setTestScoreState(loadedConfig.testScore);
      if (loadedConfig.testName !== undefined) setTestNameState(loadedConfig.testName);
      if (loadedConfig.isNewStudentTestActive !== undefined) setIsNewStudentTestActiveState(loadedConfig.isNewStudentTestActive);
      if (loadedConfig.newStudentTestScore !== undefined) setNewStudentTestScoreState(loadedConfig.newStudentTestScore);
      if (loadedConfig.newStudentPassingRate !== undefined) setNewStudentPassingRateState(loadedConfig.newStudentPassingRate);
      if (loadedConfig.newStudentTestDeductions !== undefined) setNewStudentTestDeductionsState(loadedConfig.newStudentTestDeductions);
      if (loadedConfig.colorMap !== undefined) setColorMapState(loadedConfig.colorMap);
      if (loadedConfig.saveColors !== undefined) setSaveColorsState(loadedConfig.saveColors);
      if (loadedConfig.rankColors !== undefined) setRankColorsState(loadedConfig.rankColors);
      if (loadedConfig.manualRanks !== undefined) setManualRanksState(loadedConfig.manualRanks);
      if (loadedConfig.certificateConfig !== undefined) setCertificateConfigState(loadedConfig.certificateConfig);
      if (loadedConfig.cardConfig !== undefined) setCardConfigState(loadedConfig.cardConfig);
      if (loadedConfig.isDistributable) {
          setIsDistributable(true);
          setIsPublishedConnected(!!loadedConfig.isPublishedConnected);
          setFirebaseConfigState(loadedConfig.firebaseConfig || null);
      } else {
          setFirebaseConfigState(loadedConfig.firebaseConfig || HARDCODED_FIREBASE_CONFIG);
      }
    } else {
      setFirebaseConfigState(HARDCODED_FIREBASE_CONFIG);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // التحميل المسبق لصفحات المصحف الشائعة في وقت خمول المتصفح
  useEffect(() => {
    // تفعيل إيماءة الرجوع باللمس (تمرير الإصبع لليسار) وإيماءات الهواتف
    initSwipeNavigation();

    // تحميل أجزاء عم وتبارك والصفحات الشائعة (560 إلى 604) تدريجياً في الخلفية
    const commonPages: number[] = [];
    for (let p = 604; p >= 560; p--) {
      commonPages.push(p);
    }
    preloadPagesOnIdle(commonPages);
  }, []);

  useEffect(() => {
    if (!isLoading) {
        const dataToSave: FullBackupData = {
            users: data.users, halaqas: data.halaqas, sardHalaqas: data.sardHalaqas, students: data.students, evaluations: data.evaluations, sardEvaluations: data.sardEvaluations, maghribAttendances: data.maghribAttendances, suggestions: data.suggestions, studentBehaviors: data.studentBehaviors, matns: data.matns, newStudentTests: data.newStudentTests || [],
            customLogo, supervisorPassword, maghribPassword, appName, hijriAdjustments,
            colorMap, saveColors, rankColors, manualRanks, certificateConfig, cardConfig,
            isTestActive: isTestActiveState, testScore: testScoreState, testName: testNameState,
            testDeductions: testDeductionsState,
            isNewStudentTestActive: isNewStudentTestActiveState,
            newStudentTestScore: newStudentTestScoreState,
            newStudentPassingRate: newStudentPassingRateState,
            newStudentTestDeductions: newStudentTestDeductionsState,
            isDistributable, isPublishedConnected, firebaseConfig: firebaseConfigState
        };
        localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(dataToSave));
    }
  }, [data, appName, customLogo, supervisorPassword, maghribPassword, hijriAdjustments, colorMap, saveColors, rankColors, manualRanks, certificateConfig, cardConfig, isTestActiveState, testScoreState, testNameState, testDeductionsState, firebaseConfigState, isDistributable, isPublishedConnected, isLoading]);

  useEffect(() => {
    if (!firebaseConfigState || Object.keys(firebaseConfigState).length === 0) {
        setFirebaseConnectionStatus('disconnected');
        return;
    }
    setFirebaseConnectionStatus('connecting');
    setIsLoadingFirebase(true);

    const timeoutId = setTimeout(() => {
        if (isLoadingFirebase) {
            setIsLoadingFirebase(false);
            if (firebaseConnectionStatus === 'connecting') {
                setFirebaseConnectionStatus('disconnected');
                showToast('⚠️ تعذر الاتصال السحابي حالياً، تم التبديل للعمل المحلي.', 'info');
            }
        }
    }, 6000);

    initializeFirebase(firebaseConfigState).then(firebaseInstance => {
        if (!firebaseInstance.db) { 
            setFirebaseConnectionStatus('disconnected'); 
            setIsLoadingFirebase(false);
            return; 
        }
        const db = firebaseInstance.db;

        db.ref('config').on('value', (snapshot: any) => {
          const val = snapshot.val();
          if (val) {
            if(val.appName) setAppNameState(val.appName);
            if(val.customLogo !== undefined) setCustomLogoState(val.customLogo);
            if(val.supervisorPassword) setSupervisorPasswordState(val.supervisorPassword);
            if(val.maghribPassword) setMaghribPasswordState(val.maghribPassword);
            if(val.hijriAdjustments) setHijriAdjustmentsState(val.hijriAdjustments);
            if(val.isTestActive !== undefined) setIsTestActiveState(val.isTestActive);
            if(val.testScore !== undefined) setTestScoreState(val.testScore);
            if(val.testName !== undefined) setTestNameState(val.testName);
            if(val.testDeductions !== undefined) setTestDeductionsState(val.testDeductions);
            if(val.isNewStudentTestActive !== undefined) setIsNewStudentTestActiveState(val.isNewStudentTestActive);
            if(val.newStudentTestScore !== undefined) setNewStudentTestScoreState(val.newStudentTestScore);
            if(val.newStudentPassingRate !== undefined) setNewStudentPassingRateState(val.newStudentPassingRate);
            if(val.newStudentTestDeductions !== undefined) setNewStudentTestDeductionsState(val.newStudentTestDeductions);
            if(val.allowTeacherEditOldMemorized !== undefined) setAllowTeacherEditOldMemorizedState(val.allowTeacherEditOldMemorized);
            if(val.lastUsedWeek !== undefined) setLastUsedWeekState(val.lastUsedWeek);
            if(val.colorMap !== undefined) setColorMapState(val.colorMap);
            if(val.saveColors !== undefined) setSaveColorsState(val.saveColors);
            if(val.rankColors !== undefined) setRankColorsState(val.rankColors);
            if(val.manualRanks !== undefined) setManualRanksState(val.manualRanks);
            if(val.certificateConfig !== undefined) setCertificateConfigState(val.certificateConfig);
            if(val.cardConfig !== undefined) setCardConfigState(val.cardConfig);
          }
          setIsLoadingFirebase(false);
          clearTimeout(timeoutId);
        }, (error: any) => {
            console.error("Firebase Config Listen Error:", error);
            setIsLoadingFirebase(false);
            clearTimeout(timeoutId);
        });

        const syncTable = (table: keyof typeof data, firebasePath: string) => {
            db.ref(firebasePath).on('value', (snapshot: any) => {
                const val = snapshot.val();
                let items: any[] = [];
                if (val) {
                    items = Object.entries(val).map(([key, item]: [string, any]) => ({
                        ...item,
                        id: parseInt(key) || item.id 
                    }));
                } else {
                    items = (table === 'users') ? INITIAL_USERS : [];
                }

                if (table === 'students') {
                    items = items.map((st: any) => ({
                        ...st,
                        isFromIbri: st.isFromIbri !== undefined ? st.isFromIbri : true
                    }));
                }

                setData(prev => {
                    const filteredItems = items.filter(item => !pendingDeletions.has(item.id));
                    return { ...prev, [table]: filteredItems };
                });
            }, (err: any) => console.error(`Sync error on ${String(table)}:`, err));
        };

        syncTable('users', 'data/users');
        syncTable('halaqas', 'data/halaqas');
        syncTable('sardHalaqas', 'data/sardHalaqas');
        syncTable('students', 'data/students');
        syncTable('evaluations', 'data/evaluations');
        syncTable('sardEvaluations', 'data/sardEvaluations');
        syncTable('maghribAttendances', 'data/maghribAttendances');
        syncTable('suggestions', 'data/suggestions');
        syncTable('studentBehaviors', 'data/studentBehaviors');
        syncTable('matns', 'data/matns');
        syncTable('newStudentTests', 'data/newStudentTests');

        setFirebaseConnectionStatus('connected');
      }).catch(err => {
          console.error("Firebase Sync Error:", err);
          setFirebaseConnectionStatus('error');
          setIsLoadingFirebase(false);
          clearTimeout(timeoutId);
      });

      return () => {
          clearTimeout(timeoutId);
          const db = getDb();
          if (db) { 
            db.ref('data/users').off();
            db.ref('data/halaqas').off();
            db.ref('data/sardHalaqas').off();
            db.ref('data/students').off();
            db.ref('data/evaluations').off();
            db.ref('data/sardEvaluations').off();
            db.ref('data/maghribAttendances').off();
            db.ref('data/suggestions').off();
            db.ref('data/studentBehaviors').off();
            db.ref('data/matns').off();
            db.ref('data/newStudentTests').off();
            db.ref('config').off(); 
          }
      };
  }, [firebaseConfigState, pendingDeletions, showToast]);

  const writeData = (path: string, value: any) => {
    const db = getDb();
    if (db && navigator.onLine) {
        const sanitizedValue = sanitizeForFirebase(value);
        db.ref(path).set(sanitizedValue).catch((err: any) => {
            console.error("Write error, queuing:", err);
            queueForSync(path, value);
        });
    } else {
        queueForSync(path, value);
    }

    const parts = path.split('/');
    if (parts[0] === 'data' && parts[1]) {
      const table = parts[1] as keyof typeof data;
      if (table in data) {
        const idStr = parts[2];
        setData(prev => {
          const currentList = (prev[table] as any[]) || [];
          if (value === null) {
            if (!idStr) return { ...prev, [table]: [] };
            const id = parseInt(idStr);
            return { ...prev, [table]: currentList.filter(item => item.id !== id) };
          } else if (idStr) {
            const id = parseInt(idStr);
            const exists = currentList.some(item => item.id === id);
            if (exists) {
              return { ...prev, [table]: currentList.map(item => item.id === id ? value : item) };
            } else {
              return { ...prev, [table]: [...currentList, value] };
            }
          }
          return prev;
        });
      }
    }
    
    if (value === null) {
        const idStr = path.split('/').pop();
        if (idStr) {
            const id = parseInt(idStr);
            if (!isNaN(id)) {
                setPendingDeletions(prev => new Set(prev).add(id));
                setTimeout(() => {
                    setPendingDeletions(prev => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                }, 5000);
            }
        }
    }
  };

  const queueForSync = (path: string, value: any) => {
    const queueStr = localStorage.getItem('halaqaSyncQueue');
    const queue = queueStr ? JSON.parse(queueStr) : [];
    queue.push({ path, value, timestamp: Date.now() });
    localStorage.setItem('halaqaSyncQueue', JSON.stringify(queue));
    setSyncQueue(queue);
    if (!navigator.onLine) {
        showToast('📡 تم الحفظ محلياً (سيتم الرفع عند توفر الإنترنت)', 'info');
    }
  };

  const addEvaluation = (ev: any) => {
    const id = generateId();
    writeData(`data/evaluations/${id}`, { ...ev, id, updatedAt: id });
  };
  const updateEvaluation = (ev: any) => writeData(`data/evaluations/${ev.id}`, { ...ev, updatedAt: Date.now() });
  const deleteEvaluation = (id: number) => writeData(`data/evaluations/${id}`, null);

  const addSardEvaluation = (ev: any) => {
    const id = generateId();
    writeData(`data/sardEvaluations/${id}`, { ...ev, id, updatedAt: id });
  };
  const updateSardEvaluation = (ev: any) => writeData(`data/sardEvaluations/${ev.id}`, { ...ev, updatedAt: Date.now() });
  const deleteSardEvaluation = (id: number) => writeData(`data/sardEvaluations/${id}`, null);
  const deleteAllSardEvaluations = useCallback(async () => {
    writeData('data/sardEvaluations', null);
  }, []);
  
  const addMaghribAttendance = (att: any) => {
    const existing = (data.maghribAttendances || []).find(m => m.studentId === att.studentId && m.weekNumber === att.weekNumber && (m.programType === att.programType || (!m.programType && att.programType === 'maghrib')));
    const id = existing ? existing.id : generateId();
    writeData(`data/maghribAttendances/${id}`, { ...att, id, updatedAt: Date.now() });
  };
  const deleteMaghribAttendance = (id: number) => writeData(`data/maghribAttendances/${id}`, null);

  const addStudent = (s: any) => {
    const id = generateId();
    writeData(`data/students/${id}`, { ...s, id, isFromIbri: s.isFromIbri !== undefined ? s.isFromIbri : true, updatedAt: id });
    return id;
  };
  const updateStudent = (s: any) => writeData(`data/students/${s.id}`, { ...s, updatedAt: Date.now() });
  const deleteStudent = (id: number) => writeData(`data/students/${id}`, null);
  
  const resetAllStudentsLevelToAuto = () => {
    const updatedStudents = (data.students || []).map(s => {
      const copy = { ...s };
      delete copy.manualStudentLevel;
      delete copy.manualLevel;
      delete copy.studentLevel;
      copy.updatedAt = Date.now();
      return copy;
    });

    const toObj = (arr: any[]) => arr.reduce((acc, i) => ({ ...acc, [i.id]: i }), {});
    writeData('data/students', toObj(updatedStudents));
    setData(prev => ({
      ...prev,
      students: updatedStudents
    }));
    showToast(`✅ تم إعادة ضبط مستويات جميع الطلاب لتكون تلقائية بحسب الحفظ (${updatedStudents.length} طالب)`, 'success');
  };
  
  const assignStudentToSardHalaqa = (studentId: number, sardHalaqaId?: number) => {
    const s = (data.students || []).find(x => x.id === studentId);
    if (s) {
      writeData(`data/students/${studentId}`, { ...s, sardHalaqaId: sardHalaqaId || null, updatedAt: Date.now() });
    }
  };

  const addHalaqa = (h: any) => {
    const existing = findSimilarHalaqa(h.name, data.halaqas || []);
    if (existing) {
      console.warn(`Halaqa with similar name already exists: "${existing.name}"`);
      return existing.id;
    }
    const id = generateId();
    writeData(`data/halaqas/${id}`, { ...h, id, updatedAt: id });
    return id;
  };
  const updateHalaqa = (h: any) => {
    const conflict = findSimilarHalaqa(h.name, data.halaqas || [], h.id);
    if (conflict) {
      console.warn(`Cannot update halaqa: name "${h.name}" conflicts with existing halaqa "${conflict.name}"`);
      return;
    }
    writeData(`data/halaqas/${h.id}`, { ...h, updatedAt: Date.now() });
  };
  const deleteHalaqa = (id: number) => {
    const studentsInHalaqa = (data.students || []).filter(s => s.halaqaId === id);
    studentsInHalaqa.forEach(s => writeData(`data/students/${s.id}`, null));
    writeData(`data/halaqas/${id}`, null);
  };

  const assignTeacherToHalaqa = (halaqaId: number, teacherId: number) => {
    const h = (data.halaqas || []).find(x => x.id === halaqaId);
    if (h) writeData(`data/halaqas/${halaqaId}`, { ...h, teacherId, updatedAt: Date.now() });
  };

  const addSardHalaqa = (h: any) => {
    const existing = findSimilarHalaqa(h.name, data.sardHalaqas || []);
    if (existing) {
      console.warn(`Sard halaqa with similar name already exists: "${existing.name}"`);
      return existing.id;
    }
    const id = generateId();
    writeData(`data/sardHalaqas/${id}`, { ...h, id, updatedAt: id });
    return id;
  };
  const updateSardHalaqa = (h: any) => {
    const conflict = findSimilarHalaqa(h.name, data.sardHalaqas || [], h.id);
    if (conflict) {
      console.warn(`Cannot update sard halaqa: name "${h.name}" conflicts with existing sard halaqa "${conflict.name}"`);
      return;
    }
    writeData(`data/sardHalaqas/${h.id}`, { ...h, updatedAt: Date.now() });
  };
  const deleteSardHalaqa = (id: number) => {
    const studentsInSardHalaqa = (data.students || []).filter(s => s.sardHalaqaId === id);
    studentsInSardHalaqa.forEach(s => writeData(`data/students/${s.id}`, { ...s, sardHalaqaId: null, updatedAt: Date.now() }));
    writeData(`data/sardHalaqas/${id}`, null);
  };

  const assignTeacherToSardHalaqa = (sardHalaqaId: number, teacherId: number) => {
    const h = (data.sardHalaqas || []).find(x => x.id === sardHalaqaId);
    if (h) writeData(`data/sardHalaqas/${sardHalaqaId}`, { ...h, teacherId, updatedAt: Date.now() });
  };

  const addMatn = (m: any) => {
    const id = generateId();
    writeData(`data/matns/${id}`, { ...m, id, updatedAt: id });
  };
  const updateMatn = (m: any) => writeData(`data/matns/${m.id}`, { ...m, updatedAt: Date.now() });
  const deleteMatn = (id: number) => writeData(`data/matns/${id}`, null);

  const addStudentBehavior = (s: any) => {
    const id = generateId();
    writeData(`data/studentBehaviors/${id}`, { ...s, id, createdAt: Date.now(), updatedAt: id });
  };
  const updateStudentBehavior = (s: any) => writeData(`data/studentBehaviors/${s.id}`, { ...s, updatedAt: Date.now() });
  const deleteStudentBehavior = (id: number) => writeData(`data/studentBehaviors/${id}`, null);

  const addSuggestion = (s: any) => {
    const id = generateId();
    writeData(`data/suggestions/${id}`, { ...s, id, createdAt: Date.now(), updatedAt: id });
  };
  const updateSuggestion = (s: any) => writeData(`data/suggestions/${s.id}`, { ...s, updatedAt: Date.now() });
  const deleteSuggestion = (id: number) => writeData(`data/suggestions/${id}`, null);

  const addTeacher = (n: string) => {
    const id = generateId();
    writeData(`data/users/${id}`, { id, name: n, role: UserRole.TEACHER, updatedAt: id });
    return id;
  };
  const updateTeacher = (u: any) => writeData(`data/users/${u.id}`, { ...u, updatedAt: Date.now() });
  const deleteTeacher = (id: number) => writeData(`data/users/${id}`, null);

  const setIsNewStudentTestActive = useCallback((a: boolean) => {
    setIsNewStudentTestActiveState(a);
    writeData('config/isNewStudentTestActive', a);
  }, [writeData]);

  const setAllowTeacherEditOldMemorized = useCallback((a: boolean) => {
    setAllowTeacherEditOldMemorizedState(a);
    writeData('config/allowTeacherEditOldMemorized', a);
  }, [writeData]);

  const setNewStudentTestScore = useCallback((score: number) => {
    const safe = isNaN(score) ? 100 : score;
    setNewStudentTestScoreState(safe);
    writeData('config/newStudentTestScore', safe);
  }, [writeData]);

  const setNewStudentPassingRate = useCallback((rate: number) => {
    const safe = isNaN(rate) ? 70 : rate;
    setNewStudentPassingRateState(safe);
    writeData('config/newStudentPassingRate', safe);
  }, [writeData]);

  const setNewStudentTestDeductions = useCallback((deductions: { fath: number; tashkeel: number; tajweed: number }) => {
    const safe = {
      fath: isNaN(deductions?.fath) ? 1 : deductions.fath,
      tashkeel: isNaN(deductions?.tashkeel) ? 1 : deductions.tashkeel,
      tajweed: isNaN(deductions?.tajweed) ? 0.5 : deductions.tajweed,
    };
    setNewStudentTestDeductionsState(safe);
    writeData('config/newStudentTestDeductions', safe);
  }, [writeData]);

  const addNewStudentTest = useCallback((test: Omit<NewStudentTest, 'id' | 'updatedAt'>) => {
    const id = generateId();
    const item: NewStudentTest = { ...test, id, updatedAt: id };
    writeData(`data/newStudentTests/${id}`, item);
    return id;
  }, [writeData]);

  const updateNewStudentTest = useCallback((test: NewStudentTest) => {
    writeData(`data/newStudentTests/${test.id}`, { ...test, updatedAt: Date.now() });
  }, [writeData]);

  const deleteNewStudentTest = useCallback((testId: number) => {
    writeData(`data/newStudentTests/${testId}`, null);
  }, [writeData]);

  const deleteAllNewStudentTests = useCallback(() => {
    writeData('data/newStudentTests', null);
    showToast('🗑️ تم تفريغ تقرير الطلاب الجدد وحذف جميع بيانات الاختبارات بنجاح.', 'success');
  }, [writeData, showToast]);

  const acceptNewStudent = useCallback((testId: number, halaqaId: number = 0) => {
    const currentTest = (data.newStudentTests || []).find(t => t.id === testId);
    if (!currentTest) return;

    const newStudentId = generateId();
    const newStudent: Student = {
      id: newStudentId,
      name: currentTest.studentName.trim(),
      halaqaId: Number(halaqaId) || 0,
      schoolStage: currentTest.grade.trim() || undefined,
      parentPhone: currentTest.parentPhone.trim() || undefined,
      isFromIbri: true,
      updatedAt: newStudentId,
    };

    writeData(`data/students/${newStudentId}`, newStudent);
    writeData(`data/newStudentTests/${testId}`, {
      ...currentTest,
      status: 'accepted',
      createdStudentId: newStudentId,
      updatedAt: Date.now(),
    });

    showToast(`✅ تم قبول الطالب "${currentTest.studentName}" وإدراجه في قائمة الطلاب بنجاح.`, 'success');
  }, [data.newStudentTests, writeData, showToast]);

  const rejectNewStudent = useCallback((testId: number) => {
    const currentTest = (data.newStudentTests || []).find(t => t.id === testId);
    if (!currentTest) return;

    if (currentTest.createdStudentId) {
      writeData(`data/students/${currentTest.createdStudentId}`, null);
    }

    writeData(`data/newStudentTests/${testId}`, {
      ...currentTest,
      status: 'rejected',
      createdStudentId: null,
      updatedAt: Date.now(),
    });

    showToast(`تم تسجيل عدم قبول الطالب "${currentTest.studentName}".`, 'info');
  }, [data.newStudentTests, writeData, showToast]);

  const handleLogout = () => { 
      setCurrentUser(null); 
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem(SESSION_TIMESTAMP_KEY); // مسح وقت الجلسة
      setUnevaluatedStudentsModalOpen(false); 
      setUnevaluatedQuranStudents([]);
      setUnevaluatedMutoonStudents([]);
      setUnevaluatedSardStudents([]);
      setTeacherSessionState({
        activeView: 'evaluate',
        step: 'selectHalaqa',
        selectedWeek: null,
      });
  };

  const initiateLogoutCheck = () => {
    if (currentUser?.role === UserRole.TEACHER) {
      const { activeView, step, selectedWeek } = teacherSessionState;

      // 1. إذا كان المعلم في القائمة الرئيسية (menu) أو شاشة السلوكيات (behaviors) أو اختبار طالب جديد -> تسجيل خروج فوري
      if (activeView === 'menu' || activeView === 'behaviors' || activeView === 'newStudentTest') {
        handleLogout();
        return;
      }

      // 2. إذا كان في شاشة التقييم الأسبوعي (evaluate):
      // تفعيل الرسالة فقط عندما يكون قد سجل رقم الأسبوع وانتقل للصفحة التالية بعد صفحة رقم الأسبوع
      // أما إذا لم يسجل رقم الأسبوع، أو كان في صفحة تسجيل رقم الأسبوع (selectWeek) أو الصفحة السابقة لها (selectHalaqa) فلا داعي لإظهار الرسالة التنبيهية
      if (activeView === 'evaluate') {
        if (!selectedWeek || selectedWeek <= 0 || step === 'selectHalaqa' || step === 'selectWeek') {
          handleLogout();
          return;
        }
      }

      // 3. تحديد الأسبوع المستهدف للتحقق
      const targetWeek = Number(selectedWeek) > 0 ? Number(selectedWeek) : Number(lastUsedWeek);
      if (!targetWeek || targetWeek <= 0) {
        handleLogout();
        return;
      }

      setUnevaluatedCheckedWeek(targetWeek);

      // 1. فحص طلاب حلقات المعلم في القرآن الكريم
      const teacherHalaqaIds = (data.halaqas || []).filter(h => h.teacherId === currentUser.id).map(h => h.id);
      const teacherStudents = (data.students || []).filter(s => teacherHalaqaIds.includes(s.halaqaId));
      
      const quranEvaluatedIds = new Set(
        (data.evaluations || [])
          .filter(e => Number(e.weekNumber) === targetWeek && e.subject !== 'mutoon')
          .map(e => e.studentId)
      );
      const missingQuranStudents = teacherStudents
        .filter(s => !quranEvaluatedIds.has(s.id))
        .map(s => s.name);

      // 2. فحص طلاب المتون إذا كانت مفعلة وللطلاب المتاح لهم المتون (طلاب الأمين)
      const hasActiveMatns = (data.matns || []).some(m => m.isActive !== false);
      const mutoonEvaluatedIds = new Set(
        (data.evaluations || [])
          .filter(e => Number(e.weekNumber) === targetWeek && e.subject === 'mutoon')
          .map(e => e.studentId)
      );
      const missingMutoonStudents = hasActiveMatns
        ? teacherStudents
            .filter(s => !!s.isAlAmeen && !mutoonEvaluatedIds.has(s.id))
            .map(s => s.name)
        : [];

      // 3. فحص طلاب السرد التابعين لحلقات السرد الخاصة بالمعلم
      const teacherSardHalaqaIds = (data.sardHalaqas || []).filter(sh => sh.teacherId === currentUser.id).map(sh => sh.id);
      const teacherSardStudents = (data.students || []).filter(s => s.sardHalaqaId && teacherSardHalaqaIds.includes(s.sardHalaqaId));
      const sardEvaluatedIds = new Set(
        (data.sardEvaluations || [])
          .filter(se => Number(se.weekNumber) === targetWeek)
          .map(se => se.studentId)
      );
      const missingSardStudents = teacherSardStudents
        .filter(s => !sardEvaluatedIds.has(s.id))
        .map(s => s.name);
      
      if (missingQuranStudents.length > 0 || missingMutoonStudents.length > 0 || missingSardStudents.length > 0) { 
        setUnevaluatedQuranStudents(missingQuranStudents); 
        setUnevaluatedMutoonStudents(missingMutoonStudents);
        setUnevaluatedSardStudents(missingSardStudents);
        setUnevaluatedStudentsModalOpen(true); 
      } else {
        handleLogout();
      }
    } else {
      handleLogout();
    }
  };
  
  const handleLogin = (user: User) => { 
      if (!user) return;
      setCurrentUser(user); 
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString()); // تسجيل وقت بدء الجلسة
  };

  const handleImportFullBackup = (d: FullBackupData) => {
      const db = getDb();
      if (db) {
          const toObj = (arr: any[]) => arr.reduce((acc, i) => ({ ...acc, [i.id]: i }), {});
          const cleanData = sanitizeForFirebase({
              users: toObj(d.users || []),
              halaqas: toObj(d.halaqas || []),
              sardHalaqas: toObj(d.sardHalaqas || []),
              students: toObj(d.students || []),
              evaluations: toObj(d.evaluations || []),
              sardEvaluations: toObj(d.sardEvaluations || []),
              maghribAttendances: toObj(d.maghribAttendances || []),
              suggestions: toObj(d.suggestions || []),
              studentBehaviors: toObj(d.studentBehaviors || []),
              matns: toObj(d.matns || []),
              newStudentTests: toObj(d.newStudentTests || [])
          });
          db.ref('data').set(cleanData);
          db.ref('config').set(sanitizeForFirebase({
              appName: d.appName, customLogo: d.customLogo, supervisorPassword: d.supervisorPassword, maghribPassword: d.maghribPassword, hijriAdjustments: d.hijriAdjustments, isTestActive: d.isTestActive, testScore: d.testScore, testName: d.testName, lastUsedWeek: d.lastUsedWeek
          }));
      }
      setData({ users: d.users, halaqas: d.halaqas, sardHalaqas: d.sardHalaqas || [], students: d.students, evaluations: d.evaluations, sardEvaluations: d.sardEvaluations || [], maghribAttendances: d.maghribAttendances || [], suggestions: d.suggestions || [], studentBehaviors: d.studentBehaviors || [], matns: d.matns || [], newStudentTests: d.newStudentTests || [] });
      if(d.appName) setAppNameState(d.appName);
      if(d.customLogo !== undefined) setCustomLogoState(d.customLogo);
      if(d.supervisorPassword) setSupervisorPasswordState(d.supervisorPassword);
      if(d.maghribPassword) setMaghribPasswordState(d.maghribPassword);
      if(d.hijriAdjustments) setHijriAdjustmentsState(d.hijriAdjustments);
      if(d.isTestActive !== undefined) setIsTestActiveState(d.isTestActive);
      if(d.testScore !== undefined) setTestScoreState(d.testScore);
      if(d.testName !== undefined) setTestNameState(d.testName);
      if(d.testDeductions !== undefined) setTestDeductionsState(d.testDeductions);
      if(d.lastUsedWeek !== undefined) setLastUsedWeekState(d.lastUsedWeek);
  };

  // وظيفة لتحديث التعديل لشهر معين
  const setHijriAdjustment = (month: number, year: number, offset: number) => {
      const key = `${month}-${year}`;
      const newAdjustments = { ...hijriAdjustments };
      if (offset === 0) {
          delete newAdjustments[key];
      } else {
          newAdjustments[key] = offset;
      }
      setHijriAdjustmentsState(newAdjustments);
      writeData('config/hijriAdjustments', newAdjustments);
  };

  const setAppName = useCallback((n: string) => { setAppNameState(n); writeData('config/appName', n); }, []);
  const setCustomLogo = useCallback((l: string | null) => { setCustomLogoState(l); writeData('config/customLogo', l); }, []);
  const setSupervisorPassword = useCallback((p: string) => { setSupervisorPasswordState(p); writeData('config/supervisorPassword', p); }, []);
  const setMaghribPassword = useCallback((p: string) => { setMaghribPasswordState(p); writeData('config/maghribPassword', p); }, []);
  const setLastUsedWeek = useCallback((w: number | null) => { setLastUsedWeekState(w); writeData('config/lastUsedWeek', w); }, []);
  const setIsTestActive = useCallback((a: boolean) => { setIsTestActiveState(a); writeData('config/isTestActive', a); }, []);
  const setTestScore = useCallback((s: number) => { const safe = isNaN(s) ? 100 : s; setTestScoreState(safe); writeData('config/testScore', safe); }, [writeData]);
  const setTestName = useCallback((s: string) => { setTestNameState(s); writeData('config/testName', s); }, [writeData]);
  const setTestDeductions = useCallback((d: { fath: number; tashkeel: number; tajweed: number; passageChange?: number }) => {
    const safe = {
      fath: isNaN(d?.fath) ? 1 : d.fath,
      tashkeel: isNaN(d?.tashkeel) ? 1 : d.tashkeel,
      tajweed: isNaN(d?.tajweed) ? 0.5 : d.tajweed,
      passageChange: isNaN(d?.passageChange as number) ? 2 : (d.passageChange ?? 2),
    };
    setTestDeductionsState(safe);
    writeData('config/testDeductions', safe);
  }, [writeData]);
  const toggleDarkMode = useCallback(() => setDarkMode(prev => !prev), []);
  const setColorMap = useCallback((map: Record<string, string>) => { setColorMapState(map); localStorage.setItem('testReportColorMap', JSON.stringify(map)); }, []);
  const setSaveColors = useCallback((save: boolean) => { setSaveColorsState(save); localStorage.setItem('testReportSaveColors', JSON.stringify(save)); }, []);
  const setRankColors = useCallback((colors: Record<string, string>) => { setRankColorsState(colors); localStorage.setItem('testReportRankColors', JSON.stringify(colors)); }, []);
  const setManualRanks = useCallback((ranks: Record<string, number>) => { setManualRanksState(ranks); localStorage.setItem('testReportManualRanks', JSON.stringify(ranks)); }, []);
  const setCertificateConfig = useCallback((config: any) => { setCertificateConfigState(config); localStorage.setItem('simpleCertificateConfig', JSON.stringify(config)); }, []);
  const setCardConfig = useCallback((config: any) => { setCardConfigState(config); localStorage.setItem('simpleCardConfig', JSON.stringify(config)); }, []);

  const syncSettingsToCloud = useCallback(() => {
      writeData('config/colorMap', colorMap);
      writeData('config/saveColors', saveColors);
      writeData('config/rankColors', rankColors);
      writeData('config/manualRanks', manualRanks);
      writeData('config/certificateConfig', certificateConfig);
      writeData('config/cardConfig', cardConfig);
      showToast('تم حفظ التنسيقات سحابيا بنجاح', 'success');
  }, [colorMap, saveColors, rankColors, manualRanks, certificateConfig, cardConfig, showToast]);

  const resetCloudSettings = useCallback(() => {
      writeData('config/colorMap', null);
      writeData('config/saveColors', null);
      writeData('config/rankColors', null);
      writeData('config/manualRanks', null);
      writeData('config/certificateConfig', null);
      writeData('config/cardConfig', null);
      
      setColorMapState({});
      setSaveColorsState(false);
      setRankColorsState({});
      setManualRanksState({});
      setCertificateConfigState(null);
      setCardConfigState(null);
      
      showToast('تم استعادة التنسيق الافتراضي', 'success');
  }, [showToast]);

  const deleteAllEvaluations = useCallback(async () => { 
      writeData('data/evaluations', null); 
      writeData('data/maghribAttendances', null); 
      writeData('data/sardEvaluations', null);
  }, []);

  const deleteAllSuggestions = useCallback(() => {
      writeData('data/suggestions', null);
  }, []);

  const deleteAllStudentBehaviors = useCallback(() => {
      writeData('data/studentBehaviors', null);
  }, []);

  const deleteAllData = useCallback(async () => {
      const supervisor = (data.users || []).find(u => u.role === UserRole.SUPERVISOR) || INITIAL_USERS[0];
      writeData('data', { users: { [supervisor.id]: supervisor } });
      writeData('config', { 
          appName: DEFAULT_APP_NAME, 
          supervisorPassword: '123', 
          maghribPassword: '123', 
          customLogo: null,
          hijriAdjustments: {},
          isTestActive: false,
          testScore: 0,
          testName: ''
      });
  }, [data.users]);

  const contextValue = useMemo(() => ({
    users: data.users || [], students: data.students || [], halaqas: data.halaqas || [], sardHalaqas: data.sardHalaqas || [], evaluations: data.evaluations || [], sardEvaluations: data.sardEvaluations || [], maghribAttendances: data.maghribAttendances || [], suggestions: data.suggestions || [], studentBehaviors: data.studentBehaviors || [], matns: data.matns || [], newStudentTests: data.newStudentTests || [],
    addEvaluation, updateEvaluation, deleteEvaluation,
    addSardEvaluation, updateSardEvaluation, deleteSardEvaluation, deleteAllSardEvaluations,
    addMaghribAttendance, deleteMaghribAttendance, addStudent, updateStudent, deleteStudent, resetAllStudentsLevelToAuto, assignStudentToSardHalaqa,
    addHalaqa, updateHalaqa, deleteHalaqa, assignTeacherToHalaqa,
    addSardHalaqa, updateSardHalaqa, deleteSardHalaqa, assignTeacherToSardHalaqa,
    addSuggestion, updateSuggestion, deleteSuggestion, addMatn, updateMatn, deleteMatn,
    addStudentBehavior, updateStudentBehavior, deleteStudentBehavior, deleteAllStudentBehaviors,
    deleteAllSuggestions,
    deleteAllEvaluations,
    deleteAllData,
    loadMockData: () => {},
    customLogo, setCustomLogo,
    addTeacher, updateTeacher, deleteTeacher, importFullBackup: handleImportFullBackup,
    supervisorPassword, setSupervisorPassword,
    maghribPassword, setMaghribPassword,
    logout: handleLogout, isLoading, isLoadingFirebase, latestWeek: 0, lastUsedWeek, setLastUsedWeek,
    isTestActive: isTestActiveState, setIsTestActive,
    testScore: testScoreState, setTestScore,
    testName: testNameState, setTestName,
    testDeductions: testDeductionsState, setTestDeductions,
    isNewStudentTestActive: isNewStudentTestActiveState, setIsNewStudentTestActive,
    allowTeacherEditOldMemorized: allowTeacherEditOldMemorizedState, setAllowTeacherEditOldMemorized,
    newStudentTestScore: newStudentTestScoreState, setNewStudentTestScore,
    newStudentPassingRate: newStudentPassingRateState, setNewStudentPassingRate,
    newStudentTestDeductions: newStudentTestDeductionsState, setNewStudentTestDeductions,
    addNewStudentTest, updateNewStudentTest, deleteNewStudentTest, deleteAllNewStudentTests, acceptNewStudent, rejectNewStudent,
    initiateLogoutCheck, appName, setAppName,
    darkMode, toggleDarkMode, 
    firebaseConnectionStatus, firebaseConfig: firebaseConfigState, setFirebaseConfig: setFirebaseConfigState,
    isDistributable, isPublishedConnected, currentUser, showToast,
    hijriAdjustments, setHijriAdjustment,
    colorMap, setColorMap,
    saveColors, setSaveColors,
    rankColors, setRankColors,
    manualRanks, setManualRanks,
    certificateConfig, setCertificateConfig,
    cardConfig, setCardConfig,
    testsSummaryFilteredData, setTestsSummaryFilteredData,
    syncSettingsToCloud,
    resetCloudSettings,
    teacherSessionState,
    setTeacherSessionState
  }), [
    data, addEvaluation, updateEvaluation, deleteEvaluation, addSardEvaluation, updateSardEvaluation, deleteSardEvaluation, deleteAllSardEvaluations, addMaghribAttendance, deleteMaghribAttendance, addStudent, updateStudent, deleteStudent, resetAllStudentsLevelToAuto, assignStudentToSardHalaqa,
    addHalaqa, updateHalaqa, deleteHalaqa, assignTeacherToHalaqa, addSardHalaqa, updateSardHalaqa, deleteSardHalaqa, assignTeacherToSardHalaqa, addSuggestion, updateSuggestion, deleteSuggestion, deleteAllSuggestions, deleteAllEvaluations, deleteAllData,
    addStudentBehavior, updateStudentBehavior, deleteStudentBehavior, deleteAllStudentBehaviors,
    customLogo, setCustomLogo, addTeacher, updateTeacher, deleteTeacher, handleImportFullBackup,
    supervisorPassword, setSupervisorPassword, maghribPassword, setMaghribPassword,
    handleLogout, isLoading, isLoadingFirebase, lastUsedWeek, setLastUsedWeek,
    isTestActiveState, setIsTestActive, testScoreState, setTestScore, testNameState, setTestName, testDeductionsState, setTestDeductions,
    isNewStudentTestActiveState, setIsNewStudentTestActive, allowTeacherEditOldMemorizedState, setAllowTeacherEditOldMemorized, newStudentTestScoreState, setNewStudentTestScore, newStudentPassingRateState, setNewStudentPassingRate, newStudentTestDeductionsState, setNewStudentTestDeductions,
    addNewStudentTest, updateNewStudentTest, deleteNewStudentTest, deleteAllNewStudentTests, acceptNewStudent, rejectNewStudent,
    initiateLogoutCheck, appName, setAppName, darkMode, toggleDarkMode,
    firebaseConnectionStatus, firebaseConfigState, setFirebaseConfigState,
    isDistributable, isPublishedConnected, currentUser, showToast,
    hijriAdjustments, setHijriAdjustment, colorMap, setColorMap,
    saveColors, setSaveColors, rankColors, setRankColors,
    manualRanks, setManualRanks, certificateConfig, setCertificateConfig,
    cardConfig, setCardConfig,
    testsSummaryFilteredData, setTestsSummaryFilteredData,
    syncSettingsToCloud, resetCloudSettings,
    teacherSessionState, setTeacherSessionState
  ]);

  return (
    <AppContext.Provider value={contextValue}>

      <div className={`min-h-screen min-h-[100dvh] w-full flex-1 transition-colors duration-300 flex flex-col ${darkMode ? 'bg-slate-950 text-white' : 'bg-green-50 text-gray-900'}`}>
          <PwaUpdater />
          {/* حاوية رسائل التنبيه */}
              <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10001] flex flex-col gap-3 w-full max-w-sm px-4 pointer-events-none">
                  {toasts.map(toast => (
                <div key={toast.id} className={`pointer-events-auto p-4 rounded-2xl shadow-2xl text-center font-extrabold text-white animate-fade-in border-b-4 ${toast.type === 'success' ? 'bg-green-600 border-green-800' : toast.type === 'error' ? 'bg-red-600 border-red-800' : 'bg-blue-600 border-blue-800'}`}>
                  {toast.message}
                </div>
              ))}
          </div>

          {isDistributable && !firebaseConfigState && !isPublishedConnected && <FirebaseSetupWizard onConfigSave={setFirebaseConfigState} />}
          {!currentUser ? <LoginScreen onLogin={handleLogin} /> : (
            currentUser.role === UserRole.SUPERVISOR ? (
                <>
                <Header user={currentUser} onShowHelp={() => setShowHelpModal(true)} onInitiateLogoutCheck={initiateLogoutCheck} onShowMobileInstallModal={() => setShowMobileInstallModal(true)} onShowChangePassword={() => setShowChangePasswordModal(true)} />
                <main className="px-2 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex-1 pb-16 w-full max-w-full overflow-x-hidden"><SupervisorDashboard /></main>
                </>
            ) : currentUser.role === UserRole.MAGHRIB_ADMIN ? (
                <MaghribDashboard />
            ) : (
                <>
                <Header user={currentUser} onShowHelp={() => setShowHelpModal(true)} onInitiateLogoutCheck={initiateLogoutCheck} onShowMobileInstallModal={() => setShowMobileInstallModal(true)} onShowChangePassword={() => setShowChangePasswordModal(true)} />
                <main className="px-2 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex-1 pb-16 w-full max-w-full overflow-x-hidden"><TeacherDashboard teacherId={currentUser.id} /></main>
                </>
            )
          )}
          {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
          {showMobileInstallModal && <MobileInstallModal onClose={() => setShowMobileInstallModal(false)} />}
          {showChangePasswordModal && (
            <ChangePasswordModal onClose={() => setShowChangePasswordModal(false)} supervisorPassword={supervisorPassword} setSupervisorPassword={(p) => { setSupervisorPasswordState(p); writeData('config/supervisorPassword', p); }} />
          )}
          {unevaluatedStudentsModalOpen && (
            <UnevaluatedStudentsWarningModal 
              quranStudentNames={unevaluatedQuranStudents} 
              mutoonStudentNames={unevaluatedMutoonStudents} 
              sardStudentNames={unevaluatedSardStudents}
              weekNumber={unevaluatedCheckedWeek} 
              onConfirmLogout={handleLogout} 
              onCancel={() => setUnevaluatedStudentsModalOpen(false)} 
            />
          )}
      </div>
    </AppContext.Provider>
  );
};

export default App;
