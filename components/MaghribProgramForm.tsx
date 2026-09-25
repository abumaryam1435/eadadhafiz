
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import { Student, MaghribAttendanceStatus } from '../types';
import Logo from './Logo';
import { isSmartMatch } from '../utils/searchUtils';
import { translationMap } from '../utils/exportWord';

interface MaghribProgramFormProps {
  onBack: () => void;
  hideHeader?: boolean;
  programType?: 'maghrib' | 'asr';
}

export const MaghribProgramForm: React.FC<MaghribProgramFormProps> = ({ onBack, hideHeader = false, programType = 'maghrib' }) => {
  const context = useContext(AppContext);

  const { students = [], addMaghribAttendance = async () => {}, maghribAttendances = [] } = context || {};

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [weekNumber, setWeekNumber] = useState<number | ''>('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // حقول التاريخ والوقت
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attTime, setAttTime] = useState(new Date().toTimeString().slice(0, 5));

  const filteredStudents = useMemo(() => {
    return students
      .filter(s => isSmartMatch(s.name, searchTerm))
      .sort((a,b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
  }, [students, searchTerm]);

  const existingRecord = useMemo(() => {
    if (!selectedStudent || !weekNumber) return null;
    return maghribAttendances.find(m => m.studentId === selectedStudent.id && m.weekNumber === weekNumber && (m.programType === programType || (!m.programType && programType === 'maghrib')));
  }, [selectedStudent, weekNumber, maghribAttendances, programType]);

  const handleAttendance = (status: MaghribAttendanceStatus) => {
    if (!selectedStudent || !weekNumber) return;
    
    addMaghribAttendance({
      studentId: selectedStudent.id,
      weekNumber,
      status,
      date: attDate,
      time: attTime,
      programType,
    });

    setSuccessMessage(`✅ تم تسجيل "${selectedStudent.name}" بنجاح.`);
    setSelectedStudent(null);
    setSearchTerm('');
    setStep(2);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const programTitle = programType === 'maghrib' ? 'برنامج المغرب' : 'برنامج العصر';

  if (!context) return null;
  return (
    <div className={`${hideHeader ? '' : 'min-h-screen bg-gray-50 dark:bg-gray-900'}`}>
        {!hideHeader && (
            <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Logo className="h-10 w-10"/>
                    <h1 className="text-xl font-bold">{programTitle}</h1>
                </div>
                <button onClick={onBack} className="px-4 py-2 bg-gray-200 rounded-lg">رجوع</button>
            </header>
        )}
        <div className={`p-4 ${hideHeader ? '' : 'sm:p-8'}`}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                {successMessage && <div className="p-4 mb-6 bg-green-100 text-green-800 rounded-lg text-center font-bold animate-fade-in">{successMessage}</div>}

                {step === 1 && (
                    <div className="text-center space-y-6 animate-fade-in">
                        <h2 className="text-xl font-bold">تحديد الأسبوع الدراسي</h2>
                        <input
                            type="number"
                            value={weekNumber === '' || isNaN(Number(weekNumber)) ? '' : weekNumber}
                            onChange={e => {
                              const p = parseInt(e.target.value, 10);
                              setWeekNumber(isNaN(p) || p <= 0 ? '' : p);
                            }}
                            className="input-style text-center text-4xl font-bold h-24 w-40"
                            placeholder="0"
                        />
                        <button onClick={() => weekNumber && setStep(2)} className="w-full py-4 bg-green-700 text-white rounded-xl font-bold text-lg disabled:opacity-50" disabled={!weekNumber}>التالي</button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <h2 className="font-bold">اختر الطالب (أسبوع {weekNumber})</h2>
                            <button onClick={() => setStep(1)} className="text-blue-600 underline text-sm">تغيير الأسبوع</button>
                        </div>
                        
                        {/* خيارات التاريخ والوقت */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1">تاريخ الغياب:</label>
                                <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} className="input-style py-2 text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1">وقت التسجيل:</label>
                                <input type="time" value={attTime} onChange={e => setAttTime(e.target.value)} className="input-style py-2 text-sm" />
                            </div>
                        </div>

                        <input type="text" placeholder="بحث سريع..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-style" />
                        <div className="max-h-96 overflow-y-auto grid grid-cols-1 gap-2">
                            {filteredStudents.map(s => (
                                <button key={s.id} onClick={() => {setSelectedStudent(s); setStep(3);}} className="p-4 text-right bg-gray-50 hover:bg-green-50 rounded-xl border border-gray-100 dark:bg-gray-700 dark:border-gray-600 font-bold">{s.name}</button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 3 && selectedStudent && (
                    <div className="text-center space-y-6 animate-fade-in">
                        <h2 className="text-2xl font-bold text-green-800 dark:text-green-300">{selectedStudent.name}</h2>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-xl inline-block border dark:border-gray-600">
                             <p className="text-xs text-gray-500">سيتم التسجيل في: <span className="font-bold text-gray-800 dark:text-white">{attDate}</span> الساعة <span className="font-bold text-gray-800 dark:text-white">{attTime}</span></p>
                        </div>
                        
                        {existingRecord ? (
                            <div className="bg-blue-50 border-r-4 border-blue-500 p-3 rounded-lg text-right animate-pulse">
                                <p className="text-xs font-black text-blue-800">تنبيه: يوجد سجل سابق لهذا الأسبوع</p>
                                <p className="text-[10px] text-blue-600">الحالة المسجلة: <span className="font-bold underline">{translationMap[existingRecord.status]}</span></p>
                            </div>
                        ) : null}

                        <div className="flex gap-4">
                            {programType === 'maghrib' ? (
                                <button 
                                    onClick={() => handleAttendance(MaghribAttendanceStatus.ABSENT)} 
                                    className={`flex-1 py-12 rounded-2xl text-4xl font-black transition-all duration-300 border-4 flex flex-col items-center justify-center gap-2 ${existingRecord?.status === MaghribAttendanceStatus.ABSENT ? 'bg-red-100 border-red-600 text-red-800 shadow-inner scale-105' : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'}`}
                                >
                                    <span>🚫</span>
                                    <span>غائب</span>
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleAttendance(MaghribAttendanceStatus.LATE)} 
                                    className={`flex-1 py-12 rounded-2xl text-4xl font-black transition-all duration-300 border-4 flex flex-col items-center justify-center gap-2 ${existingRecord?.status === MaghribAttendanceStatus.LATE ? 'bg-orange-100 border-orange-600 text-orange-800 shadow-inner scale-105' : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'}`}
                                >
                                    <span>⏰</span>
                                    <span>متأخر</span>
                                </button>
                            )}
                            
                            <button 
                                onClick={() => handleAttendance(MaghribAttendanceStatus.EXCUSED)} 
                                className={`flex-1 py-12 rounded-2xl text-4xl font-black transition-all duration-300 border-4 flex flex-col items-center justify-center gap-2 ${existingRecord?.status === MaghribAttendanceStatus.EXCUSED ? 'bg-amber-100 border-amber-600 text-amber-800 shadow-inner scale-105' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'}`}
                            >
                                <span>📝</span>
                                <span>مستأذن</span>
                            </button>
                        </div>
                        <button onClick={() => setStep(2)} className="w-full py-3 bg-gray-200 rounded-xl font-bold dark:bg-gray-700 dark:text-gray-200">رجوع للقائمة</button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
