
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import { MaghribAttendanceStatus, MaghribAttendance } from '../types';
import { renderCell, toArabicDigits } from '../utils/exportWord';
import { exportToExcel } from '../utils/exportExcel';
import { exportToWord } from '../utils/exportWord';
import { exportToPdf, sharePdfDirectly } from '../utils/exportPdf';
import { shareHtmlViaWhatsApp } from '../utils/exportHtml';
import { isSmartMatch } from '../utils/searchUtils';
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

  const { maghribAttendances = [], students = [], halaqas = [], deleteMaghribAttendance = async () => {}, addMaghribAttendance = async () => {}, showToast = () => {}, hijriAdjustments = {} } = context || {};

  const filteredAttendances = useMemo(() => {
    return maghribAttendances.filter(m => m.programType === programType || (!m.programType && programType === 'maghrib'));
  }, [maghribAttendances, programType]);

  const maxWeekFound = useMemo(() => {
    if (filteredAttendances.length === 0) return 'all';
    const weeks = filteredAttendances.map(e => e.weekNumber);
    return Math.max(...weeks).toString();
  }, [filteredAttendances]);

  const [filterWeeks, setFilterWeeks] = useState<string[]>(['ALL']);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAlAmeen, setFilterAlAmeen] = useState<string[]>([]);
  const [filterFromIbri, setFilterFromIbri] = useState<string[]>(['نعم']);
  const [searchTerm, setSearchTerm] = useState(''); 
  const [weekSearch, setWeekSearch] = useState('');
  const [alAmeenSearch, setAlAmeenSearch] = useState('');
  const [fromIbriSearch, setFromIbriSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  
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
        isFromIbriStr: student?.isFromIbri !== false ? 'نعم' : 'لا',
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

  const ibriOptions = [
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
    if (filterFromIbri.length > 0 && !filterFromIbri.includes('ALL') && !filterFromIbri.includes('all')) {
      items = items.filter(i => filterFromIbri.includes(i.isFromIbriStr));
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
  }, [combinedData, filterWeeks, filterStatus, filterAlAmeen, filterFromIbri, searchTerm, sortConfig]);

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
      addMaghribAttendance({
          ...editingItem,
          status: newStatus
      });
      setEditingItem(null);
      showToast('✅ تم تحديث الحالة بنجاح');
  };

  const programTitle = programType === 'maghrib' ? 'برنامج المغرب' : 'برنامج العصر';
  const exportPrefix = programType === 'maghrib' ? 'غياب_المغرب' : 'غياب_العصر';
  
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
  
  const exportTitle = `${baseExportTitle} - ${programTitle}`;

  if (!context) return null;
  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg dark:bg-gray-800 animate-fade-in">
      
      {itemToDelete && (
          <Modal title="تأكيد الحذف" onClose={() => setItemToDelete(null)} hideDefaultCloseButton={true}>
              <p className="text-lg mb-6 dark:text-gray-200 font-bold text-center">هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={confirmDelete} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xl shadow-lg active:scale-95 transition-all">نعم، حذف</button>
                  <button onClick={() => setItemToDelete(null)} className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-2xl hover:bg-gray-300 font-bold dark:bg-gray-700 dark:text-gray-200 text-xl">إلغاء</button>
              </div>
          </Modal>
      )}

      {editingItem && (
          <Modal title={`تعديل حالة ${programTitle}`} onClose={() => setEditingItem(null)} hideDefaultCloseButton>
              <div className="space-y-4 text-center">
                  <p className="font-bold text-lg">الطالب: <span className="text-green-700">{students.find(s => s.id === editingItem.studentId)?.name}</span></p>
                  <p className="text-sm text-gray-500">الأسبوع: {editingItem.weekNumber}</p>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                      {programType === 'maghrib' ? (
                          <button 
                            onClick={() => handleUpdateStatus(MaghribAttendanceStatus.ABSENT)}
                            className={`py-6 rounded-2xl font-black text-2xl border-2 transition-all ${editingItem.status === MaghribAttendanceStatus.ABSENT ? 'bg-red-50 border-red-600 text-red-700' : 'bg-gray-50 border-transparent dark:bg-slate-700'}`}
                          >🚫 غائب</button>
                      ) : (
                          <button 
                            onClick={() => handleUpdateStatus(MaghribAttendanceStatus.LATE)}
                            className={`py-6 rounded-2xl font-black text-2xl border-2 transition-all ${editingItem.status === MaghribAttendanceStatus.LATE ? 'bg-orange-50 border-orange-600 text-orange-700' : 'bg-gray-50 border-transparent dark:bg-slate-700'}`}
                          >⏰ متأخر</button>
                      )}
                      
                      <button 
                        onClick={() => handleUpdateStatus(MaghribAttendanceStatus.EXCUSED)}
                        className={`py-6 rounded-2xl font-black text-2xl border-2 transition-all ${editingItem.status === MaghribAttendanceStatus.EXCUSED ? 'bg-amber-50 border-amber-600 text-amber-700' : 'bg-gray-50 border-transparent dark:bg-slate-700'}`}
                      >📝 مستأذن</button>
                  </div>
                  <button onClick={() => setEditingItem(null)} className="w-full mt-6 py-4 bg-gray-200 rounded-2xl font-bold dark:bg-slate-700 dark:text-white">إلغاء</button>
              </div>
          </Modal>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-6 no-print">
        <div className="flex items-center gap-4">
            <h3 className="text-2xl font-bold text-green-900 dark:text-green-300">تقارير {programTitle}</h3>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-100 dark:border-green-800">
                <span className="text-xs font-bold text-green-700 dark:text-green-300">العدد:</span>
                <span className="text-sm font-black text-green-900 dark:text-white">{filteredAndSortedData.length}</span>
            </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-wrap">
            <div className="relative flex items-center w-full sm:w-64">
              <input type="text" placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-style w-full pl-8 py-2 text-sm" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-200 flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer"
                  title="مسح البحث"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="w-full sm:w-44">
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
            <div className="w-full sm:w-36">
                <FilterItem 
                    id="alAmeen" 
                    title="من الأمين؟" 
                    selectedValues={filterAlAmeen} 
                    options={alAmeenOptions} 
                    onSelect={setFilterAlAmeen} 
                    search={alAmeenSearch} 
                    setSearch={setAlAmeenSearch} 
                    openDropdown={openDropdown} 
                    setOpenDropdown={setOpenDropdown} 
                />
            </div>
            <div className="w-full sm:w-40">
                <FilterItem 
                    id="fromIbri" 
                    title="من جامع عبري؟" 
                    selectedValues={filterFromIbri} 
                    options={ibriOptions} 
                    onSelect={setFilterFromIbri} 
                    search={fromIbriSearch} 
                    setSearch={setFromIbriSearch} 
                    openDropdown={openDropdown} 
                    setOpenDropdown={setOpenDropdown} 
                />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-style w-full sm:w-40 py-2 text-sm">
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

      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-6 no-print justify-start border-t border-gray-100 dark:border-gray-700 pt-5">
        <button 
          type="button"
          onClick={() => setIsExcelModalOpen(true)} 
          className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
          title="تصدير ملف Excel"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>Excel</span>
        </button>
        <button 
          type="button"
          onClick={() => setIsWordModalOpen(true)} 
          className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
          title="تصدير ملف Word"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>Word</span>
        </button>
        <button 
          type="button"
          onClick={() => exportToPdf(headers, filteredAndSortedData, exportPrefix, exportTitle, undefined, hijriAdjustments)} 
          className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs active:scale-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          title="طباعة وتصدير ملف PDF"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
          <span>طباعة</span>
        </button>
        <button 
          type="button"
          onClick={() => sharePdfDirectly(headers, filteredAndSortedData, exportPrefix, exportTitle, undefined, hijriAdjustments, undefined, undefined, "landscape")} 
          className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs active:scale-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          title="مشاركة تقرير PDF"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
          <span>مشاركة PDF</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
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
                  className={`px-4 py-3 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:text-green-800 select-none transition-colors ${h.key === 'date' ? 'text-center' : 'text-right'} ${h.key === 'sequence' ? 'w-px !px-2 text-center' : ''}`}
                >
                  {h.label}{sortConfig?.key === h.key ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 no-print">العمليات</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
            {filteredAndSortedData.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-900/20"}>
                {headers.map(h => (
                  <td key={h.key} className={`px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-bold ${h.key === 'date' ? 'text-center' : ''} ${h.key === 'sequence' ? 'w-px !px-2 text-center text-gray-500' : ''}`}>
                    {h.key === 'date' ? (
                       <div className="flex flex-col items-center justify-center w-full mx-auto">
                           {(() => {
                               const hijri = getHijriDate(item.date, hijriAdjustments);
                               return hijri ? <span className="font-extrabold text-green-900 dark:text-green-300 text-[11px] mb-0.5">{hijri}</span> : null;
                           })()}
                           <span className="text-[10px] text-gray-700 font-bold">{item.date ? toArabicDigits(item.date) : '—'}</span>
                       </div>
                    ) : h.key === 'studentName' ? (
                       <div className="flex flex-col">
                           <span>{item.studentName}</span>
                           {item.isAlAmeen && (
                               <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold leading-tight mt-0.5">
                                   (من طلاب الأمين)
                               </span>
                           )}
                       </div>
                    ) : (
                       renderCell((item as any)[h.key], h.type)
                    )}
                  </td>
                ))}
                <td className="px-4 py-4 whitespace-nowrap text-center no-print">
                    <div className="flex justify-center gap-2">
                        <button onClick={() => setEditingItem(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border" title="تعديل">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={() => handleDeleteClick(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border" title="حذف">
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
