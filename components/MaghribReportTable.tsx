import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import { MaghribAttendanceStatus, MaghribAttendance } from '../types';
import { renderCell, toArabicDigits } from '../utils/exportWord';
import { exportToExcel } from '../utils/exportExcel';
import { exportToWord } from '../utils/exportWord';
import { exportToPdf, sharePdfDirectly } from '../utils/exportPdf';
import { shareHtmlViaWhatsApp } from '../utils/exportHtml';
import { isSmartMatch } from '../utils/searchUtils';
import { isStudentFromOutside } from '../utils/categoryUtils';
import Modal from './Modal';
import { FilterItem } from './FilterItem';
import { WordExportModal } from './WordExportModal';
import { ExcelExportModal } from './ExcelExportModal';
import { compareReportRows } from '../utils/reportSortUtils';

const getHijriDate = (dateInput: string, adjustments: Record<string, number> = {}) => {
  if (!dateInput || dateInput === '—') return null;
  try {
    const normalizedInput = String(dateInput).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()).trim();
    let date: Date | null = null;
    if (normalizedInput.includes("/")) {
      const parts = normalizedInput.split("/");
      if (parts.length === 3) {
          if (parts[0].length === 4) date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          else date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    } else if (normalizedInput.includes("-")) {
       const parts = normalizedInput.split("-");
       if (parts.length === 3) date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    if (!date || isNaN(date.getTime())) date = new Date(normalizedInput);
    if (isNaN(date.getTime())) return null;

    const standardFmt = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", { month: "numeric", year: "numeric" });
    const partsStandard = standardFmt.formatToParts(date);
    const mStandard = partsStandard.find(p => p.type === "month")?.value;
    const yStandard = partsStandard.find(p => p.type === "year")?.value;
    
    const offsetKey = `${mStandard}-${yStandard}`;
    const offset = adjustments[offsetKey] || 0;

    const adjustedDate = new Date(date);
    adjustedDate.setDate(date.getDate() + offset);

    const finalFmt = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" });
    const parts = finalFmt.formatToParts(adjustedDate);
    const d = parts.find(p => p.type === "day")?.value;
    const m = parts.find(p => p.type === "month")?.value;
    const y = parts.find(p => p.type === "year")?.value;
    return toArabicDigits(`${d}/${m}/${y}هـ`);
  } catch (e) { return null; }
};

const isValueEffectivelyEmpty = (value: any, type?: string): boolean => {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  let stringValue = String(value).trim();
  if (stringValue === '' || stringValue === '—' || stringValue === '-') return true; 
  if (stringValue === 'غير معروف' || stringValue === 'غير معين') return true;
  return false;
};

interface MaghribReportTableProps {
  programType?: 'maghrib' | 'asr';
}

export const MaghribReportTable: React.FC<MaghribReportTableProps> = ({ programType = 'maghrib' }) => {
  const context = useContext(AppContext);

  const { 
    maghribAttendances = [], 
    students = [], 
    halaqas = [], 
    sardHalaqas = [], 
    ilmiyyaHalaqas = [], 
    deleteMaghribAttendance = async () => {}, 
    addMaghribAttendance = async () => {}, 
    showToast = () => {}, 
    hijriAdjustments = {} 
  } = context || {};

  // تصفية سجلات الحضور لطلاب جامع عبري فقط (خاص بطلاب جامع عبري)
  const filteredAttendances = useMemo(() => {
    return maghribAttendances.filter(m => {
      if (m.programType !== programType && (m.programType || programType !== 'maghrib')) return false;
      const student = students.find(s => s.id === m.studentId);
      if (!student) return false;
      // خاص بطلاب جامع عبري
      return student.isFromIbri !== false && !isStudentFromOutside(student, halaqas, sardHalaqas, ilmiyyaHalaqas);
    });
  }, [maghribAttendances, programType, students, halaqas, sardHalaqas, ilmiyyaHalaqas]);

  const maxWeekFound = useMemo(() => {
    if (filteredAttendances.length === 0) return 'all';
    const weeks = filteredAttendances.map(e => e.weekNumber);
    return Math.max(...weeks).toString();
  }, [filteredAttendances]);

  const [filterWeeks, setFilterWeeks] = useState<string[]>(['ALL']);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAlAmeen, setFilterAlAmeen] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(''); 
  const [weekSearch, setWeekSearch] = useState('');
  const [alAmeenSearch, setAlAmeenSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const [mobileDisplayMode, setMobileDisplayMode] = useState<'cards' | 'table'>('cards');
  
  const [editingItem, setEditingItem] = useState<MaghribAttendance | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [hasSetDefaultWeek, setHasSetDefaultWeek] = useState(false);
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  useEffect(() => {
    if (!hasSetDefaultWeek && maxWeekFound !== 'all') {
      setFilterWeeks([maxWeekFound]);
      setHasSetDefaultWeek(true);
    }
  }, [maxWeekFound, hasSetDefaultWeek]);

  const combinedData = useMemo(() => {
    return filteredAttendances.map(attendance => {
      const student = students.find(s => s.id === attendance.studentId);
      const halaqa = student ? halaqas.find(h => h.id === student.halaqaId) : undefined;
      return {
        ...attendance,
        studentName: student?.name || 'طالب محذوف',
        isAlAmeen: student?.isAlAmeen,
        isFromIbri: student?.isFromIbri !== false,
        isAlAmeenStr: student?.isAlAmeen ? 'نعم' : 'لا',
        isFromIbriStr: 'نعم',
        halaqaName: halaqa?.name || 'حلقة غير معروفة',
      };
    });
  }, [filteredAttendances, students, halaqas]);

  const allWeeksOptions = useMemo(() => {
    const weeks = Array.from(new Set(combinedData.map(e => e.weekNumber))).sort((a: number, b: number) => a - b);
    return weeks.map(w => ({ id: String(w), name: `الأسبوع ${w}` }));
  }, [combinedData]);

  const alAmeenOptions = [
    { id: 'نعم', name: 'نعم' },
    { id: 'لا', name: 'لا' },
  ];

  const filteredAndSortedData = useMemo(() => {
    let items = [...combinedData];
    if (!filterWeeks.includes('ALL') && filterWeeks.length > 0) {
        items = items.filter(i => filterWeeks.includes(String(i.weekNumber)));
    }
    if (filterStatus !== 'all') items = items.filter(i => i.status === filterStatus);
    if (filterAlAmeen.length > 0 && !filterAlAmeen.includes('ALL') && !filterAlAmeen.includes('all')) {
      items = items.filter(i => filterAlAmeen.includes(i.isAlAmeenStr));
    }
    if (searchTerm.trim()) items = items.filter(i => isSmartMatch(i.studentName, searchTerm) || isSmartMatch(i.halaqaName, searchTerm));

    if (sortConfig) {
      items.sort((a, b) => {
        return compareReportRows(a, b, sortConfig.key, sortConfig.direction);
      });
    } else {
        items.sort((a,b) => b.weekNumber !== a.weekNumber ? b.weekNumber - a.weekNumber : a.studentName.localeCompare(b.studentName, 'ar', { sensitivity: 'base' }));
    }
    return items.map((item, index) => ({ ...item, sequence: index + 1 }));
  }, [combinedData, filterWeeks, filterStatus, filterAlAmeen, searchTerm, sortConfig]);

  const headers = useMemo(() => {
    const allHeaders = [
      { key: 'sequence', label: '#' },
      { key: 'studentName', label: 'الطالب' },
      { key: 'halaqaName', label: 'الحلقة' },
      { key: 'weekNumber', label: 'الأسبوع' },
      { key: 'date', label: 'التاريخ' },
      { key: 'time', label: 'الوقت' },
      { key: 'status', label: 'الحالة', type: 'translation' },
    ];
    if (filteredAndSortedData.length === 0) return allHeaders;
    return allHeaders.filter(h => filteredAndSortedData.some((row: any) => !isValueEffectivelyEmpty(row[h.key], h.type)));
  }, [filteredAndSortedData]);

  const confirmDelete = () => {
      if (itemToDelete) {
          deleteMaghribAttendance(itemToDelete);
          setItemToDelete(null);
          showToast('🗑️ تم حذف سجل الغياب بنجاح');
      }
  };

  const handleDeleteClick = (id: number) => {
    setItemToDelete(id);
  };

  const handleUpdateStatus = (newStatus: MaghribAttendanceStatus) => {
      if (!editingItem) return;
      (addMaghribAttendance as any)({
          ...editingItem,
          status: newStatus
      });
      setEditingItem(null);
      showToast('✅ تم تحديث الحالة بنجاح');
  };

  const programTitle = programType === 'maghrib' ? 'برنامج المغرب' : 'برنامج العصر';
  const exportPrefix = programType === 'maghrib' ? 'غياب_المغرب_جامع_عبري' : 'غياب_العصر_جامع_عبري';
  
  const isAllWeeks = filterWeeks.includes('ALL') || filterWeeks.length === 0;
  
  let baseExportTitle = "";
  if (isAllWeeks) {
      baseExportTitle = "تقرير جميع الأسابيع";
  } else if (filterWeeks.length === 1) {
      baseExportTitle = `تقرير الأسبوع (${filterWeeks[0]})`;
  } else if (filterWeeks.length === 2) {
      baseExportTitle = `تقرير الأسبوعين (${filterWeeks[0]}، ${filterWeeks[1]})`;
  } else {
      baseExportTitle = `تقرير الأسابيع (${filterWeeks.join('، ')})`;
  }
  
  const exportTitle = `${baseExportTitle} - ${programTitle} (جامع عبري)`;

  if (!context) return null;
  return (
    <div className="bg-white p-3 sm:p-6 lg:p-8 rounded-2xl shadow-lg dark:bg-gray-800 animate-fade-in border border-gray-100 dark:border-gray-700">
      
      {itemToDelete && (
          <Modal title="تأكيد الحذف" onClose={() => setItemToDelete(null)} hideDefaultCloseButton={true}>
              <div className="text-center space-y-4" dir="rtl">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 flex items-center justify-center text-2xl mx-auto shadow-inner">
                  🗑️
                </div>
                <p className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200">
                  هل أنت متأكد من حذف سجل الغياب لهذا الطالب؟ سيتم إلغاء الغياب وإعادة الطالب للحضور الطبيعي.
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                    <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm shadow-md active:scale-95 transition-all">نعم، تأكيد الحذف</button>
                    <button onClick={() => setItemToDelete(null)} className="flex-1 py-3 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 font-bold dark:bg-gray-700 dark:text-gray-200 text-sm">إلغاء</button>
                </div>
              </div>
          </Modal>
      )}

      {editingItem && (
          <Modal title={`تعديل أو حذف غياب الطالب`} onClose={() => setEditingItem(null)} hideDefaultCloseButton>
              <div className="space-y-4 text-center" dir="rtl">
                  <div className="bg-rose-50 dark:bg-rose-950/40 p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 text-right">
                    <p className="font-black text-base sm:text-lg text-rose-950 dark:text-rose-100 truncate">{students.find(s => s.id === editingItem.studentId)?.name}</p>
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                      الأسبوع {toArabicDigits(editingItem.weekNumber)} · الحالة: <span className="underline font-black">{renderCell(editingItem.status, 'translation')}</span>
                    </p>
                  </div>

                  <p className="text-xs font-black text-gray-700 dark:text-gray-300 text-right">اختر الحالة الجديدة:</p>
                  <div className="grid grid-cols-2 gap-2">
                      {programType === 'maghrib' ? (
                          <button 
                            type="button"
                            onClick={() => handleUpdateStatus(MaghribAttendanceStatus.ABSENT)}
                            className={`py-3.5 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation ${editingItem.status === MaghribAttendanceStatus.ABSENT ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-400' : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'}`}
                          >
                            <span>🚫</span>
                            <span>غائب</span>
                          </button>
                      ) : (
                          <button 
                            type="button"
                            onClick={() => handleUpdateStatus(MaghribAttendanceStatus.LATE)}
                            className={`py-3.5 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation ${editingItem.status === MaghribAttendanceStatus.LATE ? 'bg-orange-500 text-white border-orange-600 shadow-md ring-2 ring-orange-400' : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800'}`}
                          >
                            <span>⏰</span>
                            <span>متأخر</span>
                          </button>
                      )}
                      
                      <button 
                        type="button"
                        onClick={() => handleUpdateStatus(MaghribAttendanceStatus.EXCUSED)}
                        className={`py-3.5 rounded-xl font-black text-sm border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation ${editingItem.status === MaghribAttendanceStatus.EXCUSED ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'}`}
                      >
                        <span>📝</span>
                        <span>مستأذن</span>
                      </button>
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                      <button 
                        type="button"
                        onClick={() => {
                          const id = editingItem.id;
                          setEditingItem(null);
                          setItemToDelete(id);
                        }} 
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                      >
                        <span>🗑️</span>
                        <span>حذف الغياب نهائياً وإلغاؤه</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setEditingItem(null)} 
                        className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold dark:bg-slate-700 dark:text-white transition-colors cursor-pointer text-xs min-h-[38px]"
                      >
                        إلغاء
                      </button>
                  </div>
              </div>
          </Modal>
      )}

      {/* Header and Filter Controls متناسقة مع شاشة الهاتف */}
      <div className="space-y-3 mb-4 no-print">
        <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-xl font-black text-green-900 dark:text-green-300">
                  سجل غياب {programTitle}
                </h3>
                <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300 rounded-md text-[10px] font-black">
                  جامع عبري 🕌
                </span>
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-black">
                  {toArabicDigits(filteredAndSortedData.length)}
                </span>
            </div>

            {/* زر التبديل بين عرض البطاقات وعرض الجدول في الهاتف */}
            <div className="sm:hidden flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg text-xs">
              <button 
                type="button"
                onClick={() => setMobileDisplayMode('cards')}
                className={`px-2 py-1 rounded-md font-bold transition-all ${mobileDisplayMode === 'cards' ? 'bg-white dark:bg-gray-800 text-green-800 dark:text-green-300 shadow-2xs' : 'text-gray-500'}`}
              >
                🗂️ بطاقات
              </button>
              <button 
                type="button"
                onClick={() => setMobileDisplayMode('table')}
                className={`px-2 py-1 rounded-md font-bold transition-all ${mobileDisplayMode === 'table' ? 'bg-white dark:bg-gray-800 text-green-800 dark:text-green-300 shadow-2xs' : 'text-gray-500'}`}
              >
                📋 جدول
              </button>
            </div>
        </div>

        {/* فلاتر البحث والأسابيع متناسقة في شبكة متجاوبة */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            <div className="relative flex items-center w-full">
              <input 
                type="text" 
                placeholder="بحث عن طالب في جامع عبري..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="input-style w-full pl-8 py-2 text-xs" 
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 flex items-center justify-center text-[10px] font-bold cursor-pointer"
                  title="مسح البحث"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="w-full">
                <FilterItem 
                    id="weeks" 
                    title="الأسابيع" 
                    selectedValues={filterWeeks} 
                    options={allWeeksOptions} 
                    onSelect={setFilterWeeks} 
                    search={weekSearch} 
                    setSearch={setWeekSearch} 
                    openDropdown={openDropdown} 
                    setOpenDropdown={setOpenDropdown} 
                />
            </div>

            <div className="w-full">
                <FilterItem 
                    id="alAmeen" 
                    title="من طلاب الأمين؟" 
                    selectedValues={filterAlAmeen} 
                    options={alAmeenOptions} 
                    onSelect={setFilterAlAmeen} 
                    search={alAmeenSearch} 
                    setSearch={setAlAmeenSearch} 
                    openDropdown={openDropdown} 
                    setOpenDropdown={setOpenDropdown} 
                />
            </div>

            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)} 
              className="input-style w-full py-2 text-xs font-bold"
            >
                <option value="all">كل الحالات</option>
                {programType === 'maghrib' ? (
                    <option value={MaghribAttendanceStatus.ABSENT}>غائب</option>
                ) : (
                    <option value={MaghribAttendanceStatus.LATE}>متأخر</option>
                )}
                <option value={MaghribAttendanceStatus.EXCUSED}>مستأذن</option>
            </select>
        </div>
      </div>

      {/* شريط أزرار التصدير قابل للتمرير الأفقي بسلاسة في شاشة الهاتف */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 no-print border-t border-gray-100 dark:border-gray-700 pt-3 touch-pan-x">
        <button 
          type="button"
          onClick={() => setIsExcelModalOpen(true)} 
          className="px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-2xs active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0 whitespace-nowrap min-h-[36px]"
          title="تصدير ملف Excel"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>Excel</span>
        </button>
        <button 
          type="button"
          onClick={() => setIsWordModalOpen(true)} 
          className="px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0 whitespace-nowrap min-h-[36px]"
          title="تصدير ملف Word"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>Word</span>
        </button>
        <button 
          type="button"
          onClick={() => exportToPdf(headers, filteredAndSortedData, exportPrefix, exportTitle, undefined, hijriAdjustments)} 
          className="px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-2xs active:scale-95 flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 whitespace-nowrap min-h-[36px]"
          title="طباعة وتصدير ملف PDF"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          <span>طباعة PDF</span>
        </button>
        <button 
          type="button"
          onClick={() => sharePdfDirectly(headers, filteredAndSortedData, exportPrefix, exportTitle, undefined, hijriAdjustments, undefined, undefined, "landscape")} 
          className="px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-2xs active:scale-95 flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 whitespace-nowrap min-h-[36px]"
          title="مشاركة تقرير PDF"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
          <span>واتساب PDF</span>
        </button>
        <button 
          type="button"
          onClick={() => shareHtmlViaWhatsApp(headers, filteredAndSortedData, exportPrefix, exportTitle, undefined, hijriAdjustments)} 
          className="px-2.5 py-1.5 text-[11px] sm:text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-2xs active:scale-95 flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0 whitespace-nowrap min-h-[36px]"
          title="مشاركة تقرير تفاعلي (HTML) يتيح البحث وتصفية الطلاب في الهاتف"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          <span>تفاعلي HTML</span>
        </button>
      </div>

      {/* 1. عرض بطاقات الهاتف (Mobile Cards View) - متناسق 100% مع شاشة الهاتف */}
      <div className={`space-y-2.5 ${mobileDisplayMode === 'cards' ? 'block sm:hidden' : 'hidden'}`}>
        {filteredAndSortedData.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-gray-400 font-bold text-xs">لا توجد سجلات غياب مسجلة لهؤلاء الطلاب.</p>
          </div>
        ) : (
          filteredAndSortedData.map((item, idx) => {
            const isAbsent = item.status === MaghribAttendanceStatus.ABSENT;
            const isExcused = item.status === MaghribAttendanceStatus.EXCUSED;
            const hijri = getHijriDate(item.date, hijriAdjustments);

            return (
              <div 
                key={item.id}
                className={`p-3 rounded-xl border-2 transition-all shadow-2xs ${
                  isAbsent 
                    ? 'bg-rose-50/70 border-rose-300 dark:bg-rose-950/30 dark:border-rose-800' 
                    : isExcused
                    ? 'bg-amber-50/70 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800'
                    : 'bg-orange-50/70 border-orange-300 dark:bg-orange-950/30 dark:border-orange-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-black/5 dark:border-white/5">
                  <div className="min-w-0" onClick={() => setEditingItem(item)}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-gray-500">#{idx + 1}</span>
                      <span className={`font-black text-sm truncate ${isAbsent ? 'text-rose-950 dark:text-rose-100' : 'text-gray-900 dark:text-white'}`}>
                        {item.studentName}
                      </span>
                      {item.isAlAmeen && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                          أمين
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block mt-0.5">
                      {item.halaqaName}
                    </span>
                  </div>

                  {/* شارة الحالة */}
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black shadow-2xs shrink-0 flex items-center gap-1 ${
                    isAbsent 
                      ? 'bg-red-600 text-white' 
                      : isExcused 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-orange-500 text-white'
                  }`}>
                    <span>{isAbsent ? '🚫' : isExcused ? '📝' : '⏰'}</span>
                    <span>{renderCell(item.status, 'translation')}</span>
                  </span>
                </div>

                {/* تفاصيل السجل */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-gray-600 dark:text-gray-300 font-bold">
                  <div>
                    <span className="text-gray-400 text-[10px] block">الأسبوع:</span>
                    <span>الأسبوع {toArabicDigits(item.weekNumber)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] block">الوقت:</span>
                    <span>{item.time || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 text-[10px] block">التاريخ:</span>
                    <span>{hijri ? `${hijri} · ` : ''}{item.date ? toArabicDigits(item.date) : '—'}</span>
                  </div>
                </div>

                {/* أزرار العمليات المباشرة في البطاقة */}
                <div className="flex items-center gap-2 pt-2.5 mt-2 border-t border-black/5 dark:border-white/5">
                  <button 
                    type="button"
                    onClick={() => setEditingItem(item)}
                    className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-lg text-xs font-black border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-1 cursor-pointer min-h-[34px]"
                  >
                    <span>✏️</span>
                    <span>تعديل</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => handleDeleteClick(item.id)}
                    className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 rounded-lg text-xs font-black border border-red-200 dark:border-red-800 flex items-center justify-center gap-1 cursor-pointer min-h-[34px]"
                  >
                    <span>🗑️</span>
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 2. عرض الجدول الكامل للشاشات الأكبر (أو عند اختياره) */}
      <div className={`overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700 ${mobileDisplayMode === 'table' ? 'block' : 'hidden sm:block'}`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              {headers.map(h => (
                <th 
                  key={h.key} 
                  onClick={() => setSortConfig(prev => ({
                    key: h.key,
                    direction: prev?.key === h.key && prev.direction === 'ascending' ? 'descending' : 'ascending'
                  }))}
                  className={`px-3 py-3 text-xs font-extrabold text-gray-700 dark:text-gray-200 uppercase cursor-pointer hover:text-green-800 select-none transition-colors ${h.key === 'date' ? 'text-center' : 'text-right'} ${h.key === 'sequence' ? 'w-px !px-2.5 text-center' : ''}`}
                >
                  {h.label}{sortConfig?.key === h.key ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-extrabold text-gray-700 dark:text-gray-200 no-print">العمليات</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
            {filteredAndSortedData.map((item, idx) => (
              <tr key={item.id} className={`transition-colors ${item.status === MaghribAttendanceStatus.ABSENT ? 'bg-red-50/40 hover:bg-red-50/70 dark:bg-red-950/20' : idx % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-900/20"}`}>
                {headers.map(h => (
                  <td key={h.key} className={`px-3 py-3 whitespace-nowrap text-xs text-gray-900 dark:text-gray-100 font-semibold ${h.key === 'date' ? 'text-center' : ''} ${h.key === 'sequence' ? 'w-px !px-2.5 text-center font-bold text-gray-500' : ''}`}>
                    {h.key === 'date' ? (
                       <div className="flex flex-col items-center justify-center w-full mx-auto">
                           {(() => {
                               const hijri = getHijriDate(item.date, hijriAdjustments);
                               return hijri ? <span className="font-extrabold text-green-900 dark:text-green-300 text-[11px] sm:text-xs mb-0.5">{hijri}</span> : null;
                           })()}
                           <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 font-bold">{item.date ? toArabicDigits(item.date) : '—'}</span>
                       </div>
                    ) : h.key === 'studentName' ? (
                       <div 
                         onClick={() => setEditingItem(item)}
                         className="flex flex-col cursor-pointer group select-none text-right"
                         title="اضغط لتعديل أو حذف الغياب"
                       >
                           <div className="flex items-center gap-1.5 flex-wrap">
                             <span className={`font-black text-xs sm:text-sm group-hover:underline ${
                               item.status === MaghribAttendanceStatus.ABSENT 
                                 ? 'text-red-700 dark:text-red-400' 
                                 : item.status === MaghribAttendanceStatus.EXCUSED 
                                 ? 'text-amber-700 dark:text-amber-400'
                                 : 'text-orange-700 dark:text-orange-400'
                             }`}>
                               {item.studentName}
                             </span>
                             {item.status === MaghribAttendanceStatus.ABSENT ? (
                               <span className="px-1.5 py-0.2 rounded-md bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 text-[9px] font-black shadow-2xs">
                                 غائب 🚫
                               </span>
                             ) : item.status === MaghribAttendanceStatus.EXCUSED ? (
                               <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[9px] font-black shadow-2xs">
                                 مستأذن 📝
                               </span>
                             ) : (
                               <span className="px-1.5 py-0.2 rounded-md bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 text-[9px] font-black shadow-2xs">
                                 متأخر ⏰
                               </span>
                             )}
                           </div>
                           {item.isAlAmeen && (
                               <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold leading-tight mt-0.5">
                                   (من طلاب الأمين)
                               </span>
                           )}
                           <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium group-hover:text-blue-600 mt-0.5 flex items-center gap-0.5">
                             <span>اضغط للتعديل أو الحذف</span>
                             <span>⚙️</span>
                           </span>
                       </div>
                    ) : (
                       renderCell((item as any)[h.key], h.type)
                    )}
                  </td>
                ))}
                <td className="px-3 py-3 whitespace-nowrap text-center no-print">
                    <div className="flex justify-center gap-1.5">
                        <button onClick={() => setEditingItem(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-blue-100 dark:border-gray-600" title="تعديل">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => handleDeleteClick(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-red-100 dark:border-gray-600" title="حذف">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <WordExportModal 
        isOpen={isWordModalOpen} 
        onClose={() => setIsWordModalOpen(false)} 
        onExport={(orientation, action) => {
          if (action === 'share-pdf') {
            sharePdfDirectly(headers, filteredAndSortedData, exportPrefix, exportTitle, undefined, hijriAdjustments, undefined, undefined, orientation);
          } else if (action === 'pdf') {
            exportToPdf(headers, filteredAndSortedData, exportPrefix, exportTitle, undefined, hijriAdjustments);
          } else {
            exportToWord(headers, filteredAndSortedData, exportPrefix, exportTitle, hijriAdjustments, undefined, undefined, orientation, action);
          }
        }} 
      />
      <ExcelExportModal 
        isOpen={isExcelModalOpen} 
        onClose={() => setIsExcelModalOpen(false)} 
        onExport={(orientation, action) => exportToExcel(headers, filteredAndSortedData, exportPrefix, exportTitle, hijriAdjustments, undefined, undefined, orientation, action)} 
      />
    </div>
  );
};
