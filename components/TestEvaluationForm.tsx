import React, { useState, useContext, useMemo, useEffect, useRef, useCallback } from 'react';
import { AppContext } from '../App';
import { Student, Evaluation, AttendanceStatus } from '../types';
import { isSmartMatch } from '../utils/searchUtils';
import { StudentProgressInfo } from './StudentProgressInfo';
import MushafReaderModal from './MushafReaderModal';
import { surahNames, surahPagesMap } from '../utils/quranData';
import { getMemorizedPagesData, getStudentTestPassagesInfo, calculateStudentLevel } from '../utils/pageUtils';
import { toArabicDigits } from '../utils/juzUtils';
import { preloadMushafPages } from '../utils/mushafPreload';
import { generateSuggestedTestPassages, generateSingleReplacementPassage, SuggestedTestPassage, formatPassageDescription } from '../utils/testPassageGenerator';
import { registerBackHandler } from '../utils/navigationHistory';
import { 
  BookOpen, 
  CheckCircle2, 
  Check, 
  Circle, 
  Shuffle, 
  Sparkles, 
  ArrowLeft, 
  Target,
  RotateCw
} from 'lucide-react';

interface TestEvaluationFormProps {
  teacherId: number;
  onFormSubmit: (action: 'add' | 'update' | 'delete') => void;
  onReturnToMenu?: () => void;
}

export const TestEvaluationForm: React.FC<TestEvaluationFormProps> = ({ teacherId, onFormSubmit, onReturnToMenu }) => {
  const context = useContext(AppContext);

  const students = context?.students || [];
  const halaqas = context?.halaqas || [];
  const evaluations = context?.evaluations || [];
  const addEvaluation = context?.addEvaluation || (async () => {});
  const updateEvaluation = context?.updateEvaluation || (async () => {});
  const deleteEvaluation = context?.deleteEvaluation || (async () => {});
  const setLastUsedWeek = context?.setLastUsedWeek || (() => {});
  const testScore = context?.testScore;
  const testName = context?.testName;
  const testDeductions = context?.testDeductions;

  const [currentStep, setCurrentStep] = useState<'selectStudent' | 'test'>('selectStudent');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(1);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

  const [testFath, setTestFath] = useState(0);
  const [testTashkeel, setTestTashkeel] = useState(0);
  const [testTajweed, setTestTajweed] = useState(0);
  const [testPassageChanges, setTestPassageChanges] = useState(0);
  const [notes, setNotes] = useState('');

  const [studentSearch, setStudentSearch] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [existingEvaluation, setExistingEvaluation] = useState<Evaluation | null>(null);

  const [selectedSurahs, setSelectedSurahs] = useState<string[]>([]);
  const [isSurahsModified, setIsSurahsModified] = useState(false);
  const [isMushafOpen, setIsMushafOpen] = useState(false);
  const [completedPassages, setCompletedPassages] = useState<number[]>([]);

  // Suggested Test Passages Feature State (الافتراضي عدم التفعيل حسب الرغبة)
  const [isSuggestedPassagesEnabled, setIsSuggestedPassagesEnabled] = useState<boolean>(false);
  const [suggestedPassages, setSuggestedPassages] = useState<SuggestedTestPassage[]>([]);
  const [activePassageForMushaf, setActivePassageForMushaf] = useState<SuggestedTestPassage | null>(null);

  const activeStudentPassagesInfo = useMemo(() => {
    if (!activeStudent) return null;
    return getStudentTestPassagesInfo(activeStudent, evaluations);
  }, [activeStudent, evaluations]);

  const togglePassage = (num: number) => {
    setCompletedPassages(prev =>
      prev.includes(num) ? prev.filter(p => p !== num) : [...prev, num]
    );
  };

  const { newPages, previousWeekPages } = useMemo(() => {
    const newP = new Set<number>();
    const prevP = new Set<number>();
    
    if (activeStudent) {
      const studentPages = getMemorizedPagesData(activeStudent, evaluations);
      
      // If specific surahs are selected for the test, those are the newPages to test
      if (selectedSurahs.length > 0) {
        selectedSurahs.forEach(surah => {
          const sIndex = surahNames.indexOf(surah) + 1;
          if (sIndex > 0 && surahPagesMap[sIndex]) {
            surahPagesMap[sIndex].forEach(p => newP.add(p));
          }
        });
        
        // All other memorized pages of the student (old memorization + previous evaluations) are previousWeekPages
        studentPages.totalSet.forEach(p => {
          if (!newP.has(p)) {
            prevP.add(p);
          }
        });
      } else {
        // If no surahs manually selected, all new evaluations pages are newPages, and old memorized pages are previousWeekPages
        studentPages.newSet.forEach(p => newP.add(p));
        studentPages.oldSet.forEach(p => {
          if (!newP.has(p)) {
            prevP.add(p);
          }
        });
      }
    }

    return { 
      newPages: Array.from(newP).sort((a, b) => a - b), 
      previousWeekPages: Array.from(prevP).sort((a, b) => a - b)
    };
  }, [activeStudent, selectedSurahs, evaluations]);

  // التحميل المسبق التلقائي لصفحات المصحف المصورة الخاصة بالاختبار في الخلفية فور اختيار الطالب
  useEffect(() => {
    const pagesToPreload = [...newPages, ...previousWeekPages];
    if (pagesToPreload.length > 0) {
      preloadMushafPages(pagesToPreload);
    }
  }, [newPages, previousWeekPages]);

  // توليد المقاطع المقترحة تلقائياً عند اختيار الطالب أو تغير نطاق صفحاته وتحميل صفحاتها مسبقاً
  useEffect(() => {
    if (activeStudent && activeStudentPassagesInfo) {
      const allStudentPages = Array.from(new Set([...newPages, ...previousWeekPages])).sort((a, b) => a - b);
      if (allStudentPages.length > 0) {
        const generated = generateSuggestedTestPassages(allStudentPages, activeStudentPassagesInfo.requiredPassages);
        setSuggestedPassages(generated);
        const passagePages = generated.flatMap(p => p.pages);
        if (passagePages.length > 0) {
          preloadMushafPages(passagePages);
        }
      } else {
        setSuggestedPassages([]);
      }
    } else {
      setSuggestedPassages([]);
    }
  }, [activeStudent?.id, activeStudentPassagesInfo?.requiredPassages, newPages.length, previousWeekPages.length]);

  const handleRegeneratePassages = () => {
    if (activeStudent && activeStudentPassagesInfo) {
      const allStudentPages = Array.from(new Set([...newPages, ...previousWeekPages])).sort((a, b) => a - b);
      const generated = generateSuggestedTestPassages(allStudentPages, activeStudentPassagesInfo.requiredPassages);
      setSuggestedPassages(generated);
      const passagePages = generated.flatMap(p => p.pages);
      if (passagePages.length > 0) {
        preloadMushafPages(passagePages);
      }
    }
  };

  const handleReplacePassageWithDeduction = (passageNumber: number) => {
    if (activeStudent && activeStudentPassagesInfo) {
      const allStudentPages = Array.from(new Set([...newPages, ...previousWeekPages])).sort((a, b) => a - b);
      const newPassage = generateSingleReplacementPassage(allStudentPages, passageNumber, suggestedPassages);
      setSuggestedPassages(prev => prev.map(p => p.passageNumber === passageNumber ? newPassage : p));
      setTestPassageChanges(prev => prev + 1);
      setCompletedPassages(prev => prev.filter(num => num !== passageNumber));
      if (activePassageForMushaf?.passageNumber === passageNumber) {
        setActivePassageForMushaf(newPassage);
      }
    }
  };

  const bottomSectionRef = useRef<HTMLDivElement>(null);
  const openedSuggestedPassageRef = useRef(false);

  const scrollToBottomSection = useCallback(() => {
    setTimeout(() => {
      if (bottomSectionRef.current) {
        bottomSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
      window.scrollTo({
        top: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        behavior: 'smooth'
      });
    }, 120);
  }, []);

  const handleCloseMushaf = useCallback(() => {
    setIsMushafOpen(false);
    if (isSuggestedPassagesEnabled && openedSuggestedPassageRef.current) {
      openedSuggestedPassageRef.current = false;
      scrollToBottomSection();
    }
  }, [isSuggestedPassagesEnabled, scrollToBottomSection]);

  const handleOpenPassageInMushaf = (passage: SuggestedTestPassage) => {
    openedSuggestedPassageRef.current = true;
    setActivePassageForMushaf(passage);
    setIsMushafOpen(true);
  };

  const handleOpenGeneralMushaf = () => {
    if (isSuggestedPassagesEnabled) {
      openedSuggestedPassageRef.current = true;
    }
    setActivePassageForMushaf(null);
    setIsMushafOpen(true);
  };

  const [isSurahOpen, setIsSurahOpen] = useState(false);
  const [surahSearchTerm, setSurahSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const calculateAutoSurahs = (student: Student) => {
    const regularEvaluations = evaluations.filter(e => e.studentId === student.id && !e.isTest && e.attendance === AttendanceStatus.PRESENT);
    const surahsSet = new Set<string>();
    regularEvaluations.forEach(e => {
        (e.surahs || []).forEach(s => surahsSet.add(s as string));
    });
    return Array.from(surahsSet);
  };

  // Test HALAQAS for this teacher
  const testHalaqas = useMemo(() => halaqas.filter(h => {
      // Teacher is responsible for testing if testTeacherId === teacherId
      // OR if testTeacherId is undefined and teacherId === teacherId
      return (h.testTeacherId !== undefined ? h.testTeacherId === teacherId : h.teacherId === teacherId);
  }).sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true })), [halaqas, teacherId]);

  const isFloating = testHalaqas.length === 0;

  const baseStudents = useMemo(() => {
    if (isGuest || isFloating) return students.sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
    const halaqaIds = new Set(testHalaqas.map(h => h.id));
    return students.filter(s => halaqaIds.has(s.halaqaId)).sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [students, testHalaqas, isGuest, isFloating]);

  const filteredStudents = useMemo(() => {
    return baseStudents.filter(s => isSmartMatch(s.name, studentSearch));
  }, [baseStudents, studentSearch]);

  // Test evaluations for this week
  const currentTestName = testName || `اختبار أسبوع ${selectedWeek}`;
  const weekEvaluations = useMemo(() => evaluations.filter(e => e.weekNumber === selectedWeek && e.isTest && (e.testName === currentTestName || (!e.testName && !testName))), [evaluations, selectedWeek, currentTestName, testName]);

  const loadExistingEvaluation = (student: Student) => {
    setCompletedPassages([]);
    const evaluation = weekEvaluations.find(e => e.studentId === student.id);
    if (evaluation) {
      setExistingEvaluation(evaluation);
      setTestFath(evaluation.testFathErrors || 0);
      setTestTashkeel(evaluation.testTashkeelErrors || 0);
      setTestTajweed(evaluation.testTajweedErrors || 0);
      setTestPassageChanges(evaluation.testPassageChanges || 0);
      setNotes(evaluation.notes || '');
      setSelectedSurahs(evaluation.surahs || []);
      setIsSurahsModified(false);
    } else {
      setExistingEvaluation(null);
      setTestFath(0);
      setTestTashkeel(0);
      setTestTajweed(0);
      setTestPassageChanges(0);
      setNotes('');
      const autoSurahs = calculateAutoSurahs(student);
      setSelectedSurahs(autoSurahs);
      setIsSurahsModified(false);
    }
  };

  const fathDeduction = testDeductions?.fath ?? 1;
  const tashkeelDeduction = testDeductions?.tashkeel ?? 1;
  const tajweedDeduction = testDeductions?.tajweed ?? 0.5;
  const passageChangeDeduction = testDeductions?.passageChange ?? 2;
  const currentScore = Math.max(0, testScore - (testFath * fathDeduction + testTashkeel * tashkeelDeduction + testTajweed * tajweedDeduction + testPassageChanges * passageChangeDeduction));

  const handleSave = async () => {
    if (!selectedWeek || !activeStudent) return;
    
    setIsSaving(true);
    const dateStr = new Date().toLocaleDateString('en-GB');

    const evalData: Evaluation = {
        id: existingEvaluation ? existingEvaluation.id : Date.now(),
        studentId: activeStudent.id,
        halaqaId: activeStudent.halaqaId,
        teacherId,
        weekNumber: selectedWeek,
        attendance: AttendanceStatus.PRESENT,
        evaluationDate: existingEvaluation?.evaluationDate || dateStr,
        isTest: true,
        testName: testName || `اختبار أسبوع ${selectedWeek}`,
        testFathErrors: testFath,
        testTashkeelErrors: testTashkeel,
        testTajweedErrors: testTajweed,
        testPassageChanges: testPassageChanges,
        testMaxScore: testScore,
        testTotalScore: currentScore,
        surahs: selectedSurahs.length > 0 ? selectedSurahs : undefined,
        notes: notes || null,
        updatedAt: Date.now()
    };

    try {
        if (existingEvaluation) {
            await updateEvaluation(evalData);
            onFormSubmit('update');
        } else {
            await updateEvaluation(evalData);
            onFormSubmit('add');
            setExistingEvaluation(evalData);
        }
        
        setSaveSuccess(true);
        setTimeout(() => {
            setLastUsedWeek(selectedWeek);
            setCurrentStep('selectStudent');
            setActiveStudent(null);
            setSaveSuccess(false);
            setIsSaving(false);
        }, 1500);
    } catch (error) {
        setIsSaving(false);
        console.error("Save error:", error);
    }
  };

  // Wake Lock effect
  React.useEffect(() => {
    let wakeLock: any = null;
    let isMounted = true;
    
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && (navigator as any).wakeLock) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err: any) {
        console.log(`Wake Lock error: ${err?.name}, ${err?.message}`);
      }
    };

    if (currentStep === 'test') {
      requestWakeLock().catch(e => console.log(e));
    }

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible' && currentStep === 'test') {
        requestWakeLock().catch(e => console.log(e));
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock !== null) {
        try {
          const p = wakeLock.release();
          if (p && p.catch) p.catch((e: any) => console.log(e));
        } catch(e) {
          console.log(e);
        }
      }
    };
  }, [currentStep]);

  // الاحتفاظ بأحدث قيم نموذج الاختبار عبر ref لمنع إعادة تسجيل معالج الرجوع مع كل خطأ
  const testStateRef = React.useRef({
    testFath,
    testTashkeel,
    testTajweed,
    notes,
    isMushafOpen,
    isSurahOpen,
    handleCloseMushaf,
  });

  useEffect(() => {
    testStateRef.current = {
      testFath,
      testTashkeel,
      testTajweed,
      notes,
      isMushafOpen,
      isSurahOpen,
      handleCloseMushaf,
    };
  });

  // معالج الرجوع الآمن عند التواجد في خطوة تقييم الطالب لمنع الخروج المفاجئ
  useEffect(() => {
    if (currentStep === 'test') {
      return registerBackHandler(() => {
        const { testFath: f, testTashkeel: ts, testTajweed: tj, notes: n, isMushafOpen: mOpen, isSurahOpen: sOpen, handleCloseMushaf: closeM } = testStateRef.current;
        if (mOpen) {
          closeM();
          return true;
        }
        if (sOpen) {
          setIsSurahOpen(false);
          return true;
        }
        if (f > 0 || ts > 0 || tj > 0 || (n && n.trim() !== '')) {
          if (window.confirm('هل تريد الرجوع لاختيار طالب آخر؟ سيتم فقدان الدرجات غير المحفوظة.')) {
            setCurrentStep('selectStudent');
            setActiveStudent(null);
          }
        } else {
          setCurrentStep('selectStudent');
          setActiveStudent(null);
        }
        return true;
      });
    }
  }, [currentStep]);

  // Helper for student progress display (similar to OverviewTable)
  const SURAH_JUZ_MAPPING: Record<string, number[]> = {
    "الفاتحة": [1], "البقرة": [1, 2, 3], "آل عمران": [3, 4], "النساء": [4, 5, 6],
    "المائدة": [6, 7], "الأنعام": [7, 8], "الأعراف": [8, 9], "الأنفال": [9, 10], "التوبة": [10, 11],
    "يونس": [11], "هود": [11, 12], "يوسف": [12, 13], "الرعد": [13], "إبراهيم": [13],
    "الحجر": [14], "النحل": [14], "الإسراء": [15], "الكهف": [15, 16], "مريم": [16], "طه": [16],
    "الأنبياء": [17], "الحج": [17], "المؤمنون": [18], "النور": [18], "الفرقان": [18, 19],
    "الشعراء": [19], "النمل": [19, 20], "القصص": [20], "العنكبوت": [20, 21], "الروم": [21],
    "لقمان": [21], "السجدة": [21], "الأحزاب": [21, 22], "سبأ": [22], "فاطر": [22], "يس": [22, 23],
    "الصافات": [23], "ص": [23], "الزمر": [23, 24], "غافر": [24], "فصلت": [24, 25], "الشورى": [25],
    "الزخرف": [25], "الدخان": [25], "الجاثية": [25], "الأحقاف": [26], "محمد": [26], "الفتح": [26],
    "الحجرات": [26], "ق": [26], "الذاريات": [26, 27], "الطور": [27], "النجم": [27], "القمر": [27],
    "الرحمن": [27], "الواقعة": [27], "الحديد": [27], "المجادلة": [28], "الحشر": [28], "الممتحنة": [28],
    "الصف": [28], "الجمعة": [28], "المنافقون": [28], "التغابن": [28], "الطلاق": [28], "التحريم": [28],
    "الملك": [29], "القلم": [29], "الحاقة": [29], "المعارج": [29], "نوح": [29], "الجن": [29],
    "المزمل": [29], "المدثر": [29], "القيامة": [29], "الإنسان": [29], "المرسلات": [29], "النبأ": [30],
    "النازعات": [30], "عبس": [30], "التكوير": [30], "الإنفطار": [30], "المطففين": [30], "الإنشقاق": [30],
    "البروج": [30], "الطارق": [30], "الأعلى": [30], "الغاشية": [30], "الفجر": [30], "البلد": [30],
    "الشمس": [30], "الليل": [30], "الضحى": [30], "الشرح": [30], "التين": [30], "العلق": [30],
    "القدر": [30], "البينة": [30], "الزلزلة": [30], "العاديات": [30], "القارعة": [30], "التكاثر": [30],
    "العصر": [30], "الهمزة": [30], "الفيل": [30], "قريش": [30], "الماعون": [30], "الكوثر": [30],
    "الكافرون": [30], "النصر": [30], "المسد": [30], "الإخلاص": [30], "الفلق": [30], "الناس": [30]
  };

  const getStudentProgress = (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
      return { surahs: '—', juzs: '—', level: 'لم يحدد مستوى بعد' };
    }

    const pagesData = getMemorizedPagesData(student, evaluations);
    const calculatedLevel = student.manualStudentLevel || student.manualLevel || calculateStudentLevel(pagesData.totalCount);

    if (student.useManualData) {
      return {
        surahs: student.manualSurahs?.join('، ') || '—',
        juzs: student.manualParts?.join('، ') || '—',
        level: calculatedLevel
      };
    }

    const studentEvaluations = evaluations.filter(e => e.studentId === studentId && e.surahs && e.surahs.length > 0 && !e.isTest);
    const uniqueSurahs = new Set<string>();
    const uniqueJuzs = new Set<number>();
    
    studentEvaluations.forEach(e => {
      e.surahs?.forEach(s => {
        uniqueSurahs.add(s as string);
        const juzs = SURAH_JUZ_MAPPING[s as string] || [];
        juzs.forEach(j => uniqueJuzs.add(j));
      });
    });

    return {
      surahs: Array.from(uniqueSurahs).join('، '),
      juzs: Array.from(uniqueJuzs).sort((a, b) => a - b).join('، '),
      level: calculatedLevel
    };
  };

  const Nav = ({ back, next, nextState, preventNext }: any) => (
    <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-8 pt-4 border-t border-gray-100 dark:border-gray-700">
      {back ? (
        <button onClick={back} className="px-6 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors text-center w-full sm:w-auto">
          رجوع
        </button>
      ) : <div className="hidden sm:block"></div>}
      {next && (
        <button onClick={next} disabled={preventNext} className={`px-8 py-3 text-sm font-bold text-white rounded-xl shadow-md transition-all active:scale-95 text-center w-full sm:w-auto ${preventNext ? 'bg-indigo-300 cursor-not-allowed dark:bg-indigo-900' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
          {nextState || "التالي"}
        </button>
      )}
    </div>
  );

  return (
    <>
    <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 dark:bg-gray-800 dark:border-gray-700 max-w-2xl mx-auto min-h-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-8 pb-4 border-b border-gray-100 dark:border-gray-700">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center dark:bg-indigo-900/40">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
               </div>
               <div>
                  <h2 className="text-xl font-black text-gray-800 dark:text-white">{testName || 'تقييم الاختبارات'}</h2>
                  <div className="text-xs font-bold text-gray-400 mt-1 flex items-center gap-2">
                      <span className={currentStep === 'selectStudent' ? 'text-indigo-600 dark:text-indigo-400' : ''}>الطالب</span> / 
                      <span className={currentStep === 'test' ? 'text-indigo-600 dark:text-indigo-400' : ''}>التقييم</span>
                  </div>
               </div>
             </div>
             {onReturnToMenu && (
               <button
                 type="button"
                 onClick={onReturnToMenu}
                 className="px-3 py-1.5 text-xs font-black text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl transition-all flex items-center gap-1.5"
               >
                 <span>القائمة الرئيسية</span>
                 <span>←</span>
               </button>
             )}
        </div>

        {currentStep === 'selectStudent' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                        {isFloating ? 'البحث في جميع الحلقات' : (isGuest ? 'البحث في جميع الحلقات' : 'طلابي المخصصين للاختبار')}
                    </p>
                    {!isFloating && (
                        <button 
                            type="button" 
                            onClick={() => setIsGuest(!isGuest)} 
                            className="text-[10px] font-black text-indigo-600 underline hover:text-indigo-800 transition-colors"
                        >
                            {isGuest ? 'العودة لطلابي' : 'تقييم طالب من حلقة أخرى'}
                        </button>
                    )}
                </div>

                <div className="relative">
                    <input type="text" placeholder="البحث عن طالب للإختبار..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-1">
                    {filteredStudents.map(student => {
                        const isEvaluated = weekEvaluations.some(e => e.studentId === student.id);
                        const studentHalaqa = halaqas.find(h => h.id === student.halaqaId);
                        const stPassagesInfo = getStudentTestPassagesInfo(student, evaluations);
                        return (
                            <button 
                                key={student.id} 
                                onClick={() => { setActiveStudent(student); loadExistingEvaluation(student); setCurrentStep('test'); }}
                                className={`flex flex-col text-right p-4 rounded-2xl border-2 transition-all group hover:scale-[1.02] whitespace-nowrap overflow-hidden ${student.name.length > 35 ? 'text-[11px]' : 'text-sm'} sm:text-base ${isEvaluated ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white border-gray-100 hover:border-indigo-300 hover:shadow-md dark:bg-gray-800 dark:border-gray-700'}`}
                            >
                                <span className={`font-black mb-1 truncate w-full ${isEvaluated ? 'text-indigo-800 dark:text-indigo-300' : 'text-gray-800 dark:text-gray-200'}`}>{student.name}</span>
                                {student.isAlAmeen && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold leading-tight -mt-0.5 mb-1 text-right w-full">
                                        (من طلاب الأمين)
                                    </span>
                                )}
                                <div className="flex items-center justify-between gap-1 w-full mt-0.5">
                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate">{studentHalaqa?.name || 'بدون حلقة'}</span>
                                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/50 flex-shrink-0">
                                        🎯 {stPassagesInfo.passagesText}
                                    </span>
                                </div>
                                {isEvaluated && <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full inline-block mt-2 self-start dark:bg-indigo-900 dark:text-indigo-300 tracking-wider">تم الاختبار ✓</span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        )}

        {currentStep === 'test' && activeStudent && (() => {
            const ErrorCounter = ({ label, value, onChange, incrementText = "-1", color = "red" }: any) => {
                const colorConfig = {
                    red: {
                        container: 'bg-gradient-to-r sm:bg-gradient-to-b from-rose-50/90 to-red-50/70 dark:from-rose-950/40 dark:to-red-950/30 border-2 border-rose-200 dark:border-rose-800/70 hover:border-rose-400 dark:hover:border-rose-600',
                        badge: 'bg-rose-600 text-white',
                        text: 'text-rose-950 dark:text-rose-100 group-hover:text-rose-700',
                        subtext: 'text-rose-700/80 dark:text-rose-400',
                        input: 'text-rose-600 dark:text-rose-400 placeholder:text-rose-200 dark:placeholder:text-rose-900/40',
                        circleBorder: 'border-rose-400 dark:border-rose-500',
                    },
                    amber: {
                        container: 'bg-gradient-to-r sm:bg-gradient-to-b from-amber-50/90 to-orange-50/70 dark:from-amber-950/40 dark:to-orange-950/30 border-2 border-amber-200 dark:border-amber-800/70 hover:border-amber-400 dark:hover:border-amber-600',
                        badge: 'bg-amber-600 text-white',
                        text: 'text-amber-950 dark:text-amber-100 group-hover:text-amber-700',
                        subtext: 'text-amber-700/80 dark:text-amber-400',
                        input: 'text-amber-600 dark:text-amber-400 placeholder:text-amber-200 dark:placeholder:text-amber-900/40',
                        circleBorder: 'border-amber-400 dark:border-amber-500',
                    },
                    yellow: {
                        container: 'bg-gradient-to-r sm:bg-gradient-to-b from-teal-50/90 to-emerald-50/70 dark:from-teal-950/40 dark:to-emerald-950/30 border-2 border-teal-200 dark:border-teal-800/70 hover:border-teal-400 dark:hover:border-teal-600',
                        badge: 'bg-teal-600 text-white',
                        text: 'text-teal-950 dark:text-teal-100 group-hover:text-teal-700',
                        subtext: 'text-teal-700/80 dark:text-teal-400',
                        input: 'text-teal-600 dark:text-teal-400 placeholder:text-teal-200 dark:placeholder:text-teal-900/40',
                        circleBorder: 'border-teal-400 dark:border-teal-500',
                    },
                    purple: {
                        container: 'bg-gradient-to-r sm:bg-gradient-to-b from-purple-50/95 to-indigo-50/80 dark:from-purple-950/40 dark:to-indigo-950/30 border-2 border-purple-200 dark:border-purple-800/70 hover:border-purple-400 dark:hover:border-purple-600',
                        badge: 'bg-purple-600 text-white',
                        text: 'text-purple-950 dark:text-purple-100 group-hover:text-purple-700',
                        subtext: 'text-purple-700/80 dark:text-purple-400',
                        input: 'text-purple-600 dark:text-purple-400 placeholder:text-purple-200 dark:placeholder:text-purple-900/40',
                        circleBorder: 'border-purple-400 dark:border-purple-500',
                    },
                };
                const currentConfig = colorConfig[color as keyof typeof colorConfig] || colorConfig.red;

                return (
                <div 
                    onClick={() => onChange(value + 1)} 
                    className={`rounded-2xl shadow-xs overflow-hidden flex items-stretch group cursor-pointer transition-all active:scale-[0.98] h-14 sm:h-18 ${currentConfig.container}`}
                >
                    <div className="flex-1 flex items-center justify-between px-3 sm:px-4 select-none">
                        <div className="flex items-center gap-1.5">
                            <span className={`text-xs sm:text-sm font-black px-2 py-0.5 rounded-lg shadow-xs ${currentConfig.badge}`}>
                                {incrementText}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className={`text-sm sm:text-base font-black text-right ${currentConfig.text}`}>{label}</span>
                        </div>
                    </div>
                    <div className="px-2.5 sm:px-4 flex items-center justify-center">
                        <div className={`w-14 sm:w-16 h-11 sm:h-12 rounded-full bg-white dark:bg-gray-900 border-2 ${currentConfig.circleBorder} shadow-sm flex items-center justify-center overflow-hidden`}>
                            <input 
                                onClick={(e) => e.stopPropagation()} 
                                type="number" 
                                min="0" 
                                value={value === 0 ? '' : value} 
                                placeholder="0" 
                                onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} 
                                onFocus={(e) => e.target.select()} 
                                className={`w-full h-full text-center text-xl sm:text-2xl font-black bg-transparent ${currentConfig.input} focus:opacity-90 border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none z-10`} 
                            />
                        </div>
                    </div>
                </div>
                );
            };

            return (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                    <p className="text-lg font-black text-indigo-900 dark:text-indigo-100 mb-0.5">{activeStudent.name}</p>
                    {activeStudent.isAlAmeen && (
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                            (من طلاب الأمين)
                        </p>
                    )}
                    
                    <div className="mt-2 mb-3">
                        <StudentProgressInfo student={activeStudent} />
                    </div>

                    {/* بطاقة ضابط وتفعيل المقاطع المقترحة للاختبار */}
                    {activeStudentPassagesInfo && (
                      <div className="my-2 sm:my-3 -mx-2 sm:mx-0 rounded-xl sm:rounded-2xl border sm:border-2 border-amber-300/90 dark:border-amber-700/80 bg-gradient-to-br from-amber-500/10 via-amber-50/40 to-amber-500/5 dark:from-amber-950/40 dark:via-gray-900/80 dark:to-gray-900/60 p-2 sm:p-4.5 shadow-xs space-y-2.5 sm:space-y-3.5">
                        {/* العنوان وزر تفعيل/إلغاء المقاطع المقترحة */}
                        <div className="space-y-2 sm:space-y-3 pb-2 sm:pb-3 border-b border-amber-200/80 dark:border-amber-800/70">
                          {/* سطر معلومات المقاطع المطلوبة ومستوى الطالب */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="p-1.5 sm:p-2 bg-amber-500/20 dark:bg-amber-900/60 rounded-lg sm:rounded-xl border border-amber-300/60 dark:border-amber-700 text-amber-900 dark:text-amber-200 flex items-center justify-center shrink-0">
                                <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                  <span className="font-black text-amber-950 dark:text-amber-100 text-xs sm:text-base">
                                    مقاطع الاختبار المطلوبة: {activeStudentPassagesInfo.passagesText}
                                  </span>
                                  <span className="text-[10px] sm:text-xs font-black bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg border border-amber-300/70 dark:border-amber-700 shrink-0">
                                    {activeStudentPassagesInfo.tierLabel}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* مؤشر الإنجاز العددي في حال التفعيل */}
                            {isSuggestedPassagesEnabled && suggestedPassages.length > 0 && (
                              <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl border border-amber-200 dark:border-gray-700 shadow-2xs">
                                <span className="text-[11px] sm:text-xs font-black text-amber-950 dark:text-amber-200">
                                  المسموع: {toArabicDigits(completedPassages.length)} من {toArabicDigits(suggestedPassages.length)}
                                </span>
                                {completedPassages.length === suggestedPassages.length ? (
                                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded-md">
                                    مكتمل ✓
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>

                          {/* شريط التقدم المرئي للأجهزة الذكية */}
                          {isSuggestedPassagesEnabled && suggestedPassages.length > 0 && (
                            <div className="w-full bg-amber-200/60 dark:bg-gray-700 h-1.5 sm:h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full transition-all duration-300 ease-out"
                                style={{
                                  width: `${Math.min(100, Math.round((completedPassages.length / suggestedPassages.length) * 100))}%`
                                }}
                              />
                            </div>
                          )}

                          {/* أزرار التحكم في تفعيل المقاطع المقترحة وإعادة التوليد */}
                          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 pt-0.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setIsSuggestedPassagesEnabled(prev => !prev)}
                              className={`min-h-[36px] sm:min-h-[42px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm border-2 whitespace-nowrap ${
                                isSuggestedPassagesEnabled
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-800 dark:border-amber-400 ring-2 sm:ring-4 ring-amber-400/40 shadow-amber-500/25 shadow-md'
                                  : 'bg-white dark:bg-gray-800 text-amber-950 dark:text-amber-200 border-amber-500 dark:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 ring-2 ring-amber-300/30'
                              }`}
                              title={isSuggestedPassagesEnabled ? 'المقاطع المقترحة مفعلة - انقر للإلغاء' : 'انقر لتفعيل المقاطع المقترحة'}
                            >
                              <Sparkles className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isSuggestedPassagesEnabled ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'}`} />
                              <span>تفعيل المقاطع المقترحة</span>
                              {isSuggestedPassagesEnabled && (
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse inline-block mr-0.5" />
                              )}
                            </button>

                            {isSuggestedPassagesEnabled && (
                              <button
                                type="button"
                                onClick={handleRegeneratePassages}
                                className="px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-2xs shrink-0"
                                title="إعادة المقترحات"
                              >
                                <Shuffle className="w-3 h-3 shrink-0" />
                                <span>إعادة المقترحات</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* في حال تفعيل المقاطع المقترحة: زر فتح موحد للمقاطع المقترحة وقائمة المقاطع */}
                        {isSuggestedPassagesEnabled && suggestedPassages.length > 0 ? (
                          <div className="space-y-2">
                            {/* زر موحد لفتح المقاطع المقترحة في المصحف والتنقل بينها */}
                            <button
                              type="button"
                              onClick={() => {
                                const targetPassage = suggestedPassages.find(p => !completedPassages.includes(p.passageNumber)) || suggestedPassages[0];
                                if (targetPassage) handleOpenPassageInMushaf(targetPassage);
                              }}
                              className="w-full min-h-[44px] sm:min-h-[48px] px-3.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl sm:rounded-2xl shadow-sm hover:shadow transition-all active:scale-98 flex items-center justify-between gap-2.5 border-2 border-amber-600 dark:border-amber-500 cursor-pointer select-none"
                              title="انقر لفتح المقاطع المقترحة في المصحف"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                                  <BookOpen className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xs sm:text-base font-black">
                                  فتح المقاطع المقترحة في المصحف
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 bg-black/25 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-white/20">
                                <span className="hidden sm:inline">عرض المصحف</span>
                                <ArrowLeft className="w-4 h-4" />
                              </div>
                            </button>

                            {/* نصوص مميزة بتنسيق خفيف ومدمج للمقاطع المقترحة محسنة لشاشات الهواتف */}
                            <div className="bg-amber-50/70 dark:bg-gray-850/80 rounded-xl sm:rounded-2xl border border-amber-200/90 dark:border-gray-700/90 p-1.5 sm:p-2 space-y-1.5 shadow-2xs">
                              {suggestedPassages.map((passage) => {
                                const isDone = completedPassages.includes(passage.passageNumber);
                                const singlePassageText = passage.description && passage.description.startsWith('صفحة')
                                  ? passage.description
                                  : formatPassageDescription(
                                      passage.pages,
                                      passage.startSurahId,
                                      passage.startAyah,
                                      passage.endSurahId,
                                      passage.endAyah
                                    );

                                return (
                                  <div
                                    key={passage.id}
                                    className={`flex items-start justify-between gap-2 sm:gap-2.5 p-2 sm:py-2.5 sm:px-3 rounded-lg sm:rounded-xl transition-all border ${
                                      isDone
                                        ? 'bg-amber-100/60 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800/80 text-amber-950 dark:text-amber-100'
                                        : 'bg-white/95 dark:bg-gray-800/90 border-amber-200/80 dark:border-gray-700 hover:border-amber-300 text-gray-800 dark:text-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                      {/* مربع فحص تفاعلي بلون بني لتحديد إنجاز المقطع بحجم ثابت ومريح للمس */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePassage(passage.passageNumber);
                                        }}
                                        className={`w-7 h-7 min-w-[28px] min-h-[28px] rounded-lg shrink-0 mt-0.5 flex items-center justify-center transition-all border-2 cursor-pointer select-none active:scale-90 ${
                                          isDone
                                            ? 'bg-[#78350f] border-[#78350f] dark:bg-[#92400e] dark:border-[#92400e] text-white shadow-xs'
                                            : 'bg-white dark:bg-gray-700 border-[#78350f] dark:border-amber-600 hover:bg-amber-50 dark:hover:bg-gray-650'
                                        }`}
                                        title={isDone ? 'تم التسميع - انقر للإلغاء' : 'انقر لتحديد المقطع كمُنجز'}
                                      >
                                        {isDone && <Check className="w-4 h-4 text-white stroke-[3.5]" />}
                                      </button>

                                      {/* تفاصيل المقطع كاملاً بدون اقتطاع مع إمكانية الفتح المباشر في المصحف عند النقر */}
                                      <div 
                                        className="flex-1 min-w-0 cursor-pointer select-none"
                                        onClick={() => handleOpenPassageInMushaf(passage)}
                                        title="انقر لفتح هذا المقطع مباشرة في المصحف"
                                      >
                                        <div className="text-xs sm:text-sm leading-relaxed">
                                          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                            <span className="font-black text-amber-900 dark:text-amber-300 shrink-0">
                                              المقطع {toArabicDigits(passage.passageNumber)}.
                                            </span>
                                            <span className={`font-bold ${isDone ? 'text-amber-950 dark:text-amber-100' : 'text-gray-800 dark:text-gray-200'} break-words whitespace-normal`}>
                                              {singlePassageText}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* زر تدوير / تغيير هذا المقطع في الزاوية اليسار العلوية موازياً لمربع الإنجاز مع خصم درجتين وبدون كلمة تغيير */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleReplacePassageWithDeduction(passage.passageNumber);
                                      }}
                                      className="shrink-0 self-start mt-0.5 min-h-[28px] h-7 px-2 py-0.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-black shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1 border border-purple-500 cursor-pointer select-none"
                                      title={`تغيير هذا المقطع المقترح وخصم ${toArabicDigits(passageChangeDeduction)} درجات`}
                                    >
                                      <RotateCw className="w-3.5 h-3.5 text-white shrink-0" />
                                      <span className="text-[10px] bg-purple-900/90 text-purple-100 px-1 py-0.5 rounded-md font-black leading-none">
                                        (-{toArabicDigits(passageChangeDeduction)})
                                      </span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          /* الوضع اليدوي عند تعطيل المقاطع المقترحة */
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white dark:bg-gray-800 p-3.5 rounded-2xl border-2 border-amber-200 dark:border-gray-700 w-full shadow-2xs">
                            <span className="text-xs sm:text-sm font-black text-gray-700 dark:text-gray-200 whitespace-nowrap">
                              تتبع المقاطع المسموعة ({toArabicDigits(completedPassages.length)}/{toArabicDigits(activeStudentPassagesInfo?.requiredPassages ?? 1)}):
                            </span>
                            <div className={`grid ${(activeStudentPassagesInfo?.requiredPassages ?? 1) === 1 ? 'grid-cols-1' : 'grid-cols-2'} sm:flex sm:items-center sm:justify-end gap-2 w-full sm:w-auto`}>
                              {Array.from({ length: activeStudentPassagesInfo?.requiredPassages ?? 1 }, (_, i) => {
                                const pNum = i + 1;
                                const isDone = completedPassages.includes(pNum);
                                return (
                                  <button
                                    key={pNum}
                                    type="button"
                                    onClick={() => togglePassage(pNum)}
                                    className={`w-full sm:w-auto sm:flex-1 min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-black transition-colors cursor-pointer select-none active:scale-95 whitespace-nowrap flex items-center justify-center gap-1.5 shadow-2xs border-2 shrink-0 ${
                                      isDone
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                        : 'bg-amber-100/90 hover:bg-amber-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-amber-950 dark:text-amber-100 border-amber-300 dark:border-gray-600'
                                    }`}
                                    title={`المقطع ${toArabicDigits(pNum)} - انقر لتحديد الاكتمال`}
                                  >
                                    <span className="w-4 h-4 inline-flex items-center justify-center shrink-0 text-xs font-black">{isDone ? '✓' : '○'}</span>
                                    <span>المقطع {toArabicDigits(pNum)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-2 border-t border-indigo-200/50">
                        <button
                            type="button"
                            onClick={handleOpenGeneralMushaf}
                            className="w-full min-h-[50px] px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm sm:text-base font-black rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2.5 border border-emerald-700"
                            title="فتح صفحات المصحف"
                        >
                            <span className="text-xl">📖</span>
                            <span>فتح مصحف الاختبار (جميع الصفحات)</span>
                            <span className="bg-emerald-800/80 text-emerald-100 text-xs px-2.5 py-1 rounded-lg mr-1 font-bold border border-emerald-500/40">
                              {newPages.length + previousWeekPages.length} ص
                            </span>
                        </button>
                    </div>

                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-3">{testName || 'تقييم الاختبار'}</p>
                </div>

                {isSurahOpen && (
                    <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 p-4 sm:p-6 flex flex-col animate-in slide-in-from-bottom-5 duration-300">
                        <div className="mb-4 pb-4 border-b dark:border-gray-700 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-black text-indigo-800 dark:text-indigo-400">تعديل سور الاختبار</h3>
                            <button onClick={() => setIsSurahOpen(false)} className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all">موافق</button>
                        </div>
                        <div className="relative mb-4 shrink-0">
                            <input type="text" placeholder="بحث عن سورة..." value={surahSearchTerm} onChange={e => setSurahSearchTerm(e.target.value)} className="w-full p-4 pr-12 text-base bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl dark:bg-gray-800 dark:border-gray-700 transition-all" />
                            <svg className="absolute right-4 top-4 h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 content-start">
                            {Object.keys(SURAH_JUZ_MAPPING).filter(s => isSmartMatch(s, surahSearchTerm)).map(s => (
                                <label key={s} className={`flex items-center p-4 rounded-xl cursor-pointer transition-all border-2 ${selectedSurahs.includes(s) ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20 dark:border-indigo-500/50' : 'border-gray-100 hover:border-indigo-200 dark:border-gray-700 dark:hover:border-gray-600'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedSurahs.includes(s)} 
                                        onChange={() => {
                                            setSelectedSurahs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
                                            setIsSurahsModified(true);
                                        }} 
                                        className="ml-3 h-5 w-5 text-indigo-700 rounded-md border-gray-300 focus:ring-indigo-500" 
                                    />
                                    <span className={`text-base font-bold ${selectedSurahs.includes(s) ? 'text-indigo-900 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>{s}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ErrorCounter label="أخطاء الفتح" value={testFath} onChange={setTestFath} incrementText={`-${fathDeduction}`} color="red" />
                    <ErrorCounter label="أخطاء التشكيل" value={testTashkeel} onChange={setTestTashkeel} incrementText={`-${tashkeelDeduction}`} color="amber" />
                    <ErrorCounter label="أخطاء التجويد" value={testTajweed} onChange={setTestTajweed} incrementText={`-${tajweedDeduction}`} color="yellow" />
                </div>

                {/* زر خصم تغيير المقطع أسفل أزرار الخطأ */}
                <div className="mt-3">
                    <ErrorCounter 
                        label="خصم تغيير المقطع (طلب الطالب تغيير المقطع)" 
                        value={testPassageChanges} 
                        onChange={setTestPassageChanges} 
                        incrementText={`-${passageChangeDeduction}`} 
                        color="purple" 
                    />
                </div>

                {/* قسم الملاحظات والنتيجة وزر الحفظ - يتم التمرير إليه بسلاسة عند إغلاق مقاطع الاختبار */}
                <div ref={bottomSectionRef} className="space-y-6 mt-6">
                  <div className="space-y-3">
                      <label className="text-sm font-black text-gray-700 dark:text-gray-300 flex items-center gap-2">ملاحظات على الاختبار (اختياري)</label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="أضف أي ملاحظات حول أداء الطالب في الاختبار..." className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl min-h-[100px] text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  </div>

                  <div className={`p-5 rounded-2xl border-2 flex justify-between items-center ${currentScore < (testScore * 0.5) ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'}`}>
                      <span className="text-sm font-black text-gray-700 dark:text-gray-300">الدرجة النهائية:</span>
                      <div className="flex items-baseline gap-1">
                          <span className={`text-4xl font-black ${currentScore < (testScore * 0.5) ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{currentScore}</span>
                          <span className="text-sm font-bold text-gray-400">/ {testScore}</span>
                      </div>
                  </div>

                  <div className="flex flex-wrap justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700 gap-3">
                      <div className="flex gap-2">
                          <button onClick={() => setCurrentStep('selectStudent')} disabled={isSaving} className="px-6 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50">السابق</button>
                          
                          {existingEvaluation && (
                              <button 
                                  onClick={() => setShowDeleteConfirm(true)}
                                  disabled={isSaving}
                                  className="px-4 py-3 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-lg shadow-red-100 dark:shadow-none transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                              >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                  حذف
                              </button>
                          )}
                      </div>

                      <button 
                          onClick={handleSave} 
                          disabled={isSaving || saveSuccess}
                          className={`px-8 py-3 text-sm font-black text-white rounded-xl shadow-lg transition-all flex items-center gap-2 ${saveSuccess ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'} active:scale-95 disabled:scale-100`}
                      >
                          {isSaving ? (
                              <>
                                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  جاري الحفظ...
                              </>
                          ) : saveSuccess ? (
                              <>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                                  تم الحفظ بنجاح
                              </>
                          ) : (
                              <>
                                  {existingEvaluation ? "حفظ التعديلات" : "حفظ النتيجة"}
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                              </>
                          )}
                      </button>
                  </div>
                </div>
              </div>
            );
        })()}
    </div>

    {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">تأكيد الحذف</h3>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-6 font-sans">هل أنت متأكد من حذف هذا التقييم نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => {
                            if (existingEvaluation) {
                                deleteEvaluation(existingEvaluation.id);
                                onFormSubmit('delete');
                                setActiveStudent(null);
                                setCurrentStep('selectStudent');
                                setShowDeleteConfirm(false);
                            }
                        }}
                        className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-200 dark:shadow-none"
                    >
                        تأكيد الحذف
                    </button>
                    <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-3 bg-gray-100 text-gray-500 font-black rounded-xl hover:bg-gray-200 active:scale-95 transition-all dark:bg-gray-700 dark:text-gray-300"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    )}

    <MushafReaderModal
        isOpen={isMushafOpen}
        onClose={handleCloseMushaf}
        newPages={newPages}
        previousWeekPages={previousWeekPages}
        studentName={activeStudent?.name}
        evalFath={testFath}
        setEvalFath={setTestFath}
        evalTashkeel={testTashkeel}
        setEvalTashkeel={setTestTashkeel}
        evalTajweed={testTajweed}
        setEvalTajweed={setTestTajweed}
        evalPassageChanges={testPassageChanges}
        setEvalPassageChanges={setTestPassageChanges}
        onReplaceActivePassageWithDeduction={handleReplacePassageWithDeduction}
        isTestMode={true}
        testScore={testScore}
        testDeductions={testDeductions}
        testPassagesText={activeStudentPassagesInfo?.passagesText}
        testPassagesCount={activeStudentPassagesInfo?.requiredPassages}
        testTierLabel={activeStudentPassagesInfo?.tierLabel}
        completedPassages={completedPassages}
        onTogglePassage={togglePassage}
        activePassage={isSuggestedPassagesEnabled ? activePassageForMushaf : null}
        allPassages={isSuggestedPassagesEnabled ? suggestedPassages : []}
        onSelectPassage={(passage) => {
          openedSuggestedPassageRef.current = true;
          setActivePassageForMushaf(passage);
        }}
        onClearActivePassage={() => setActivePassageForMushaf(null)}
    />
    </>
  );
};
