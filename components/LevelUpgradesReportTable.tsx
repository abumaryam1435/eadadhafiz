import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { UserRole } from '../types';
import { renderCell, exportToWord, toArabicDigits } from '../utils/exportWord';
import { exportToExcel } from '../utils/exportExcel';
import { exportToPdf, getDualDate, sharePdfDirectly } from '../utils/exportPdf';
import { shareHtmlViaWhatsApp } from '../utils/exportHtml';
import { FilterItem } from './FilterItem';
import { WordExportModal } from './WordExportModal';
import { ExcelExportModal } from './ExcelExportModal';
import { getStudentLevelUpgrades } from '../utils/levelUpgradeUtils';
import { getLevelNumericRank } from '../utils/pageUtils';
import {
  compareReportRows,
  compareStudentsByNumber,
  ensureStudentNumberColumn,
  matchesStudentNumberQuery,
} from '../utils/reportSortUtils';

const LOCAL_STORAGE_UPGRADE_COLUMNS_KEY = 'levelUpgradesReportSelectedColumns_v1';

export const LevelUpgradesReportTable: React.FC = () => {
  const context = useContext(AppContext);
  const evaluations = context?.evaluations || [];
  const students = context?.students || [];
  const halaqas = context?.halaqas || [];
  const users = context?.users || [];
  const hijriAdjustments = context?.hijriAdjustments;
  const supervisorReadNotifications = context?.supervisorReadNotifications || [];
  const markNotificationsRead = context?.markNotificationsRead;

  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(['ALL']);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedHalaqaIds, setSelectedHalaqaIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedNewLevels, setSelectedNewLevels] = useState<string[]>([]);
  const [selectedAlAmeen, setSelectedAlAmeen] = useState<string[]>([]);
  const [selectedFromIbri, setSelectedFromIbri] = useState<string[]>(['نعم']);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>({
    key: 'studentNumber',
    direction: 'ascending',
  });

  const [studentNumberFilter, setStudentNumberFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [halaqaSearch, setHalaqaSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [weekSearch, setWeekSearch] = useState('');
  const [levelSearch, setLevelSearch] = useState('');
  const [alAmeenSearch, setAlAmeenSearch] = useState('');
  const [fromIbriSearch, setFromIbriSearch] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [isDefaultSaved, setIsDefaultSaved] = useState(false);
  const [isWordModalOpen, setIsWordModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollTable = (direction: 'right' | 'left') => {
    if (tableScrollRef.current) {
      const delta = direction === 'right' ? 300 : -300;
      tableScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  const allHeaders = useMemo(
    () => [
      { key: 'sequence', label: '#' },
      { key: 'studentNumber', label: 'رقم الطالب', type: 'number' },
      { key: 'studentName', label: 'الطالب' },
      { key: 'studentOriginalHalaqaName', label: 'حلقة الطالب' },
      { key: 'weekNumber', label: 'رقم أسبوع الانتقال' },
      { key: 'previousLevel', label: 'المستوى السابق' },
      { key: 'newLevel', label: 'المستوى المنتقل إليه' },
      { key: 'totalMemorizedPagesAtUpgrade', label: 'إجمالي الحفظ عند الانتقال' },
      { key: 'levelsJumped', label: 'عدد المستويات المجتازة' },
      { key: 'previousPagesCount', label: 'الحفظ قبل الانتقال' },
      { key: 'oldPagesCount', label: 'عدد صفحات الحفظ القديم' },
      { key: 'oldMemorizedPagesStr', label: 'الحفظ القديم' },
      { key: 'newMemorizedPagesAtUpgradeStr', label: 'الحفظ الجديد حتى الانتقال' },
      { key: 'evalMemorizedPages', label: 'صفحات أسبوع الانتقال' },
      { key: 'pagesInEval', label: 'عدد صفحات التقييم' },
      { key: 'surahs', label: 'السور', type: 'array' },
      { key: 'ayahRangeDisplay', label: 'الآيات' },
      { key: 'performance', label: 'الأداء', type: 'translation' },
      { key: 'totalMemorizedPagesCurrent', label: 'إجمالي الحفظ الحالي' },
      { key: 'currentStudentLevel', label: 'المستوى الحالي الكلي' },
      { key: 'halaqaName', label: 'حلقة المقيم' },
      { key: 'evaluatorName', label: 'المقيم' },
      { key: 'evaluationDate', label: 'تاريخ التقييم' },
      { key: 'schoolStage', label: 'المرحلة الدراسية' },
      { key: 'parentPhone', label: 'هاتف ولي الأمر' },
      { key: 'isAlAmeenStr', label: 'من الأمين؟' },
      { key: 'isFromIbriStr', label: 'من جامع عبري؟' },
      { key: 'notes', label: 'ملاحظات' },
    ],
    []
  );

  const defaultExcludedKeys = useMemo(
    () => [
      'levelsJumped',
      'previousPagesCount',
      'oldPagesCount',
      'oldMemorizedPagesStr',
      'newMemorizedPagesAtUpgradeStr',
      'evalMemorizedPages',
      'pagesInEval',
      'surahs',
      'ayahRangeDisplay',
      'performance',
      'totalMemorizedPagesCurrent',
      'currentStudentLevel',
      'halaqaName',
      'evaluatorName',
      'evaluationDate',
      'schoolStage',
      'parentPhone',
      'isAlAmeenStr',
      'isFromIbriStr',
      'notes',
    ],
    []
  );

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_UPGRADE_COLUMNS_KEY);
    const defaultKeys = allHeaders.map(h => h.key).filter(k => !defaultExcludedKeys.includes(k));
    const baseOrder = allHeaders.map(h => h.key);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.selected)) {
          setSelectedColumnKeys(ensureStudentNumberColumn(parsed.selected));
          if (Array.isArray(parsed.order)) {
            const orderedWithNum = ensureStudentNumberColumn(parsed.order);
            const middle = orderedWithNum.filter((k: string) => k !== 'sequence' && k !== 'notes');
            const missing = baseOrder.filter(k => !middle.includes(k) && k !== 'sequence' && k !== 'notes');
            setColumnOrder(['sequence', ...middle, ...missing, 'notes']);
          } else {
            setColumnOrder(baseOrder);
          }
          return;
        }
      } catch (_) {}
    }
    setSelectedColumnKeys(defaultKeys);
    setColumnOrder(baseOrder);
  }, [allHeaders, defaultExcludedKeys]);

  const moveColumn = (key: string, direction: 'up' | 'down') => {
    if (key === 'sequence' || key === 'notes') return;
    setColumnOrder(prev => {
      const baseOrder = allHeaders.map(h => h.key);
      const currentFull = prev.length > 0 ? prev : baseOrder;
      const middle = currentFull.filter(k => k !== 'sequence' && k !== 'notes');
      const idx = middle.indexOf(key);
      if (idx === -1) return currentFull;

      if (direction === 'up' && idx > 0) {
        const updated = [...middle];
        [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
        return ['sequence', ...updated, 'notes'];
      }
      if (direction === 'down' && idx < middle.length - 1) {
        const updated = [...middle];
        [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
        return ['sequence', ...updated, 'notes'];
      }
      return currentFull;
    });
  };

  const handleSaveAsDefault = () => {
    localStorage.setItem(
      LOCAL_STORAGE_UPGRADE_COLUMNS_KEY,
      JSON.stringify({
        selected: selectedColumnKeys,
        order: columnOrder.length > 0 ? columnOrder : allHeaders.map(h => h.key),
      })
    );
    setIsDefaultSaved(true);
    setTimeout(() => setIsDefaultSaved(false), 2500);
  };

  const handleResetToDefault = () => {
    const defaultKeys = allHeaders.map(h => h.key).filter(k => !defaultExcludedKeys.includes(k));
    const baseOrder = allHeaders.map(h => h.key);
    setSelectedColumnKeys(defaultKeys);
    setColumnOrder(baseOrder);
  };

  const allUpgrades = useMemo(
    () => getStudentLevelUpgrades(students, evaluations, halaqas, users),
    [students, evaluations, halaqas, users]
  );

  const readSet = useMemo(() => new Set(supervisorReadNotifications), [supervisorReadNotifications]);

  const allWeeks = useMemo(() => {
    const weeks = Array.from(new Set(allUpgrades.map(u => u.weekNumber))).sort((a, b) => a - b);
    return ['all', ...weeks.map(String)];
  }, [allUpgrades]);

  const latestUpgradeWeek = useMemo(() => {
    if (allUpgrades.length === 0) return null;
    return Math.max(...allUpgrades.map(u => u.weekNumber));
  }, [allUpgrades]);

  const latestWeekUpgradesCount = useMemo(() => {
    if (!latestUpgradeWeek) return 0;
    return allUpgrades.filter(u => u.weekNumber === latestUpgradeWeek && (selectedFromIbri.length === 0 || selectedFromIbri.includes('ALL') || selectedFromIbri.includes(u.isFromIbriStr))).length;
  }, [allUpgrades, latestUpgradeWeek, selectedFromIbri]);

  const newLevelOptions = useMemo(() => {
    const uniqueLevels = Array.from(new Set(allUpgrades.map(u => u.newLevel))).sort(
      (a, b) => getLevelNumericRank(a) - getLevelNumericRank(b)
    );
    return uniqueLevels.map(lvl => ({ id: lvl, name: lvl }));
  }, [allUpgrades]);

  const alAmeenOptions = [
    { id: 'نعم', name: 'نعم' },
    { id: 'لا', name: 'لا' },
  ];

  const ibriOptions = [
    { id: 'نعم', name: 'نعم' },
    { id: 'لا', name: 'لا' },
  ];

  const sortedAndFilteredData = useMemo(() => {
    let items = [...allUpgrades];

    const isAllWeeks = selectedWeeks.includes('ALL') || selectedWeeks.length === 0;
    if (!isAllWeeks) {
      items = items.filter(i => selectedWeeks.includes(String(i.weekNumber)));
    }
    if (studentNumberFilter.trim()) {
      items = items.filter(i => matchesStudentNumberQuery(i.studentNumber, studentNumberFilter));
    }
    if (selectedStudentIds.length > 0 && !selectedStudentIds.includes('ALL')) {
      items = items.filter(i => selectedStudentIds.includes(String(i.studentId)));
    }
    if (selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes('ALL')) {
      items = items.filter(i => selectedHalaqaIds.includes(String(i.studentOriginalHalaqaId)));
    }
    if (selectedTeacherIds.length > 0 && !selectedTeacherIds.includes('ALL')) {
      items = items.filter(i => selectedTeacherIds.includes(String(i.teacherId)));
    }
    if (selectedNewLevels.length > 0 && !selectedNewLevels.includes('ALL')) {
      items = items.filter(i => selectedNewLevels.includes(i.newLevel));
    }
    if (selectedAlAmeen.length > 0 && !selectedAlAmeen.includes('ALL')) {
      items = items.filter(i => selectedAlAmeen.includes(i.isAlAmeenStr));
    }
    if (selectedFromIbri.length > 0 && !selectedFromIbri.includes('ALL')) {
      items = items.filter(i => selectedFromIbri.includes(i.isFromIbriStr));
    }

    if (sortConfig) {
      items.sort((a, b) => compareReportRows(a, b, sortConfig.key, sortConfig.direction));
    }

    return items.map((item, idx) => ({ ...item, sequence: idx + 1 }));
  }, [
    allUpgrades,
    selectedWeeks,
    studentNumberFilter,
    selectedStudentIds,
    selectedHalaqaIds,
    selectedTeacherIds,
    selectedNewLevels,
    selectedAlAmeen,
    selectedFromIbri,
    sortConfig,
  ]);

  const dynamicHeaders = useMemo(() => {
    const orderToUse = columnOrder.length > 0 ? columnOrder : allHeaders.map(h => h.key);
    return orderToUse
      .map(key => allHeaders.find(h => h.key === key))
      .filter((h): h is (typeof allHeaders)[0] => Boolean(h && selectedColumnKeys.includes(h.key)));
  }, [allHeaders, selectedColumnKeys, columnOrder]);

  const exportHeaderInfo = useMemo(() => {
    const isAllWeeks = selectedWeeks.includes('ALL') || selectedWeeks.length === 0;
    const title = isAllWeeks
      ? 'تقرير ترقيات المستويات (المنتقلون إلى مستوى أعلى)'
      : `تقرير ترقيات المستويات - الأسبوع (${selectedWeeks.join('، ')})`;
    const fileName = isAllWeeks
      ? 'تقرير_ترقيات_المستويات'
      : `تقرير_ترقيات_المستويات_الأسبوع_${selectedWeeks.join('_')}`;
    const subtitle = `إجمالي الترقيات: ${toArabicDigits(sortedAndFilteredData.length)}`;
    return { title, fileName, subtitle };
  }, [selectedWeeks, sortedAndFilteredData.length]);

  const unreadVisibleKeys = useMemo(
    () => sortedAndFilteredData.filter(item => !readSet.has(item.upgradeKey)).map(item => item.upgradeKey),
    [sortedAndFilteredData, readSet]
  );

  return (
    <div
      className="bg-white p-4 sm:p-6 rounded-2xl shadow-xl dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
      ref={containerRef}
    >
      {/* Top Info & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between no-print mb-6 gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-bold text-green-900 dark:text-green-300 flex items-center gap-2">
            ترقيات المستويات (كل ٢٠ صفحة)
          </h3>

          {latestUpgradeWeek !== null && (
            <button
              type="button"
              onClick={() => {
                const isLatestSelected = selectedWeeks.length === 1 && selectedWeeks[0] === String(latestUpgradeWeek);
                setSelectedWeeks(isLatestSelected ? ['ALL'] : [String(latestUpgradeWeek)]);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                selectedWeeks.length === 1 && selectedWeeks[0] === String(latestUpgradeWeek)
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60'
              }`}
              title="اضغط لعرض ترقيات آخر أسبوع فقط أو استعادة عرض جميع الأسابيع"
            >
              ترقيات الأسبوع {toArabicDigits(latestUpgradeWeek)}: {toArabicDigits(latestWeekUpgradesCount)}
            </button>
          )}

          {unreadVisibleKeys.length > 0 && markNotificationsRead && (
            <button
              type="button"
              onClick={() => markNotificationsRead(unreadVisibleKeys)}
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60 transition-all cursor-pointer"
            >
              تحديد المعروض كمقروء ({toArabicDigits(unreadVisibleKeys.length)})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-100 dark:border-green-800 shadow-sm">
          <span className="text-[10px] font-bold text-green-700 dark:text-green-300">إجمالي السجلات:</span>
          <span className="text-lg font-black text-green-900 dark:text-white">{sortedAndFilteredData.length}</span>
        </div>
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8 no-print">
        <div className="relative w-full">
          <label className="text-[10px] mb-1 block font-bold text-gray-500 dark:text-gray-400">رقم الطالب:</label>
          <div className="relative flex items-center">
            <input
              type="text"
              inputMode="text"
              value={studentNumberFilter}
              onChange={e => setStudentNumberFilter(e.target.value)}
              placeholder="مثال: 5 أو 1-10"
              className="py-2 text-xs h-10 w-full bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 dark:text-gray-200 px-3 pl-7 font-bold outline-none focus:border-green-600"
            />
            {studentNumberFilter && (
              <button
                type="button"
                onClick={() => setStudentNumberFilter('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-200 flex items-center justify-center text-[10px] font-bold cursor-pointer"
                title="مسح رقم الطالب"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <FilterItem
          id="upgrade-student"
          title="الطالب"
          selectedValues={selectedStudentIds}
          options={[...students].sort(compareStudentsByNumber).map(s => ({ id: s.id, name: s.name, studentNumber: s.studentNumber }))}
          onSelect={setSelectedStudentIds}
          search={studentSearch}
          setSearch={setStudentSearch}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
        />
        <FilterItem
          id="upgrade-halaqa"
          title="حلقة الطالب"
          selectedValues={selectedHalaqaIds}
          options={[...halaqas].sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true })).map(h => ({ id: h.id, name: h.name }))}
          onSelect={setSelectedHalaqaIds}
          search={halaqaSearch}
          setSearch={setHalaqaSearch}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
        />
        <FilterItem
          id="upgrade-teacher"
          title="المقيم"
          selectedValues={selectedTeacherIds}
          options={users.filter(u => u.role === UserRole.TEACHER).map(t => ({ id: t.id, name: t.name }))}
          onSelect={setSelectedTeacherIds}
          search={teacherSearch}
          setSearch={setTeacherSearch}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
        />
        <FilterItem
          id="upgrade-week"
          title="أسبوع الانتقال"
          selectedValues={selectedWeeks}
          options={allWeeks.filter(w => w !== 'all').map(w => ({ id: w, name: `أسبوع ${w}` }))}
          onSelect={setSelectedWeeks}
          search={weekSearch}
          setSearch={setWeekSearch}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
        />
        <FilterItem
          id="upgrade-level"
          title="المستوى المنتقل إليه"
          selectedValues={selectedNewLevels}
          options={newLevelOptions}
          onSelect={setSelectedNewLevels}
          search={levelSearch}
          setSearch={setLevelSearch}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
        />
        <FilterItem
          id="upgrade-alAmeen"
          title="من الأمين؟"
          selectedValues={selectedAlAmeen}
          options={alAmeenOptions}
          onSelect={setSelectedAlAmeen}
          search={alAmeenSearch}
          setSearch={setAlAmeenSearch}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
        />
        <FilterItem
          id="upgrade-fromIbri"
          title="من جامع عبري؟"
          selectedValues={selectedFromIbri}
          options={ibriOptions}
          onSelect={setSelectedFromIbri}
          search={fromIbriSearch}
          setSearch={setFromIbriSearch}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
        />
      </div>

      {/* Export & Column Customization Bar */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-6 no-print border-t border-gray-100 dark:border-gray-700 pt-5">
        <button
          type="button"
          onClick={() => setIsExcelModalOpen(true)}
          className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
          title="تصدير ملف Excel"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Excel</span>
        </button>

        <button
          type="button"
          onClick={() => setIsWordModalOpen(true)}
          className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
          title="تصدير ملف Word"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Word</span>
        </button>

        <button
          type="button"
          onClick={() =>
            exportToPdf(
              dynamicHeaders,
              sortedAndFilteredData,
              exportHeaderInfo.fileName,
              exportHeaderInfo.title,
              exportHeaderInfo.subtitle,
              hijriAdjustments
            )
          }
          className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs active:scale-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          title="طباعة وتصدير ملف PDF"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          <span>طباعة</span>
        </button>

        <button
          type="button"
          onClick={() =>
            sharePdfDirectly(
              dynamicHeaders,
              sortedAndFilteredData,
              exportHeaderInfo.fileName,
              exportHeaderInfo.title,
              exportHeaderInfo.subtitle,
              hijriAdjustments,
              undefined,
              undefined,
              'landscape'
            )
          }
          className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs active:scale-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          title="مشاركة تقرير PDF"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>مشاركة PDF</span>
        </button>

        <button
          type="button"
          onClick={() =>
            shareHtmlViaWhatsApp(
              dynamicHeaders,
              sortedAndFilteredData,
              exportHeaderInfo.fileName,
              exportHeaderInfo.title,
              exportHeaderInfo.subtitle,
              hijriAdjustments
            )
          }
          className="px-2.5 sm:px-3 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs active:scale-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap"
          title="مشاركة تقرير تفاعلي (HTML) يتيح البحث وتصفية الطلاب في الهاتف"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span>تفاعلي HTML</span>
        </button>

        {/* Column Picker */}
        <div ref={columnPickerRef} className="relative inline-block text-right shrink-0">
          <button
            type="button"
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="px-2.5 sm:px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-xl shadow-xs flex items-center justify-center gap-1.5 hover:bg-gray-200 dark:hover:bg-gray-650 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            <span>الأعمدة ({selectedColumnKeys.length}/{allHeaders.length})</span>
          </button>

          {showColumnPicker && (
            <>
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[65] sm:hidden"
                onClick={() => setShowColumnPicker(false)}
              />
              <div className="fixed sm:absolute z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0 sm:top-full sm:left-auto sm:right-0 sm:mt-2 w-[92vw] max-w-sm sm:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-fade-in ring-1 ring-black/10 text-right">
                <div className="flex justify-between items-center mb-3 pb-2 border-b dark:border-gray-700">
                  <span className="text-xs font-black text-green-800 dark:text-green-400">تخصيص وترتيب الأعمدة</span>
                  <button
                    onClick={() => setShowColumnPicker(false)}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex gap-2 mb-2 pb-2 border-b dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setSelectedColumnKeys(allHeaders.map(h => h.key))}
                    className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex-1 text-center bg-blue-50 dark:bg-blue-900/30 py-1.5 rounded-lg"
                  >
                    إظهار الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedColumnKeys([])}
                    className="text-[11px] text-red-600 dark:text-red-400 font-bold hover:underline flex-1 text-center bg-red-50 dark:bg-red-900/30 py-1.5 rounded-lg"
                  >
                    إخفاء الكل
                  </button>
                </div>
                <div className="max-h-[50vh] sm:max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-1 divide-y divide-gray-100 dark:divide-gray-700/40">
                  {(columnOrder.length > 0 ? columnOrder : allHeaders.map(h => h.key)).map(key => {
                    const h = allHeaders.find(item => item.key === key);
                    if (!h) return null;
                    const isChecked = selectedColumnKeys.includes(h.key);
                    const currentOrder = columnOrder.length > 0 ? columnOrder : allHeaders.map(item => item.key);
                    const middleKeys = currentOrder.filter(k => k !== 'sequence' && k !== 'notes');
                    const middleIdx = middleKeys.indexOf(h.key);
                    const isFirstMiddle = middleIdx === 0;
                    const isLastMiddle = middleIdx === middleKeys.length - 1;

                    return (
                      <div
                        key={h.key}
                        className="flex items-center justify-between gap-3 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl group transition-colors"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              setSelectedColumnKeys(prev =>
                                isChecked ? prev.filter(k => k !== h.key) : [...prev, h.key]
                              )
                            }
                            className="w-4 h-4 rounded text-green-600 border-gray-300 focus:ring-green-500 cursor-pointer flex-shrink-0"
                          />
                          <span
                            className={`text-xs font-bold truncate ${
                              isChecked ? 'text-green-950 dark:text-green-200' : 'text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            {h.label}
                          </span>
                        </label>

                        {h.key === 'sequence' ? (
                          <span className="text-[10px] sm:text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-bold px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800 whitespace-nowrap flex-shrink-0">
                            الأول دائماً
                          </span>
                        ) : h.key === 'notes' ? (
                          <span className="text-[10px] sm:text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 font-bold px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800 whitespace-nowrap flex-shrink-0">
                            الأخير دائماً
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              disabled={isFirstMiddle}
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                moveColumn(h.key, 'up');
                              }}
                              className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
                              title="تقديم للأعلى"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              disabled={isLastMiddle}
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                moveColumn(h.key, 'down');
                              }}
                              className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
                              title="تأخير للأسفل"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2.5 mt-2.5 border-t dark:border-gray-700 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={handleSaveAsDefault}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                      isDefaultSaved
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-500/30 active:scale-95'
                    }`}
                  >
                    {isDefaultSaved ? (
                      <span>✓ تم حفظ الترتيب والتنسيق الافتراضي</span>
                    ) : (
                      <span>حفظ الترتيب كعرض افتراضي</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="w-full py-1 text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-bold text-center transition-colors cursor-pointer"
                  >
                    استعادة الترتيب الافتراضي
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Scroll Helper */}
      <div className="flex justify-between items-center mb-2 no-print sm:hidden">
        <span className="text-xs text-gray-500 font-bold">مرر يميناً ويساراً لعرض الأعمدة</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollTable('right')}
            className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="تمرير يمين"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollTable('left')}
            className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="تمرير يسار"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="relative group">
        <div
          ref={tableScrollRef}
          className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-gray-100 dark:border-gray-700 custom-scrollbar"
        >
          {sortedAndFilteredData.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400 font-bold">
              لا توجد ترقيات مستوى تطابق خيارات التصفية الحالية.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/90 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                <tr>
                  {dynamicHeaders.map(h => (
                    <th
                      key={h.key}
                      onClick={() =>
                        setSortConfig({
                          key: h.key,
                          direction:
                            sortConfig?.key === h.key && sortConfig.direction === 'ascending'
                              ? 'descending'
                              : 'ascending',
                        })
                      }
                      className={`px-3.5 py-3.5 text-xs sm:text-sm font-extrabold text-gray-700 dark:text-gray-200 uppercase cursor-pointer whitespace-nowrap text-right ${
                        h.key === 'sequence' ? 'w-px !px-2.5 text-center' : ''
                      }`}
                    >
                      {h.label}
                      {sortConfig?.key === h.key ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
                {sortedAndFilteredData.map((item, idx) => {
                  const isUnread = !readSet.has(item.upgradeKey);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (isUnread && markNotificationsRead) {
                          markNotificationsRead(item.upgradeKey);
                        }
                      }}
                      className={`${
                        idx % 2 === 0 ? '' : 'bg-gray-50/20 dark:bg-gray-900/5'
                      } hover:bg-green-50/30 dark:hover:bg-emerald-950/20 transition-colors ${
                        isUnread ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      {dynamicHeaders.map(h => {
                        let cellContent: React.ReactNode;
                        if (h.key === 'evaluationDate') {
                          const dual = getDualDate(item.evaluationDate, hijriAdjustments);
                          cellContent = dual ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-extrabold text-green-700 dark:text-green-400 text-xs sm:text-sm leading-tight">
                                {dual.hijri}
                              </span>
                              <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-bold leading-tight">
                                {dual.gregorian}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-bold">
                              {item.evaluationDate}
                            </span>
                          );
                        } else if (h.key === 'studentName') {
                          cellContent = (
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col">
                                <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                                  {item.studentName}
                                </span>
                                {item.isAlAmeen && (
                                  <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-bold leading-tight mt-0.5">
                                    (من طلاب الأمين)
                                  </span>
                                )}
                              </div>
                              {isUnread && (
                                <span className="inline-flex items-center bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                                  جديد
                                </span>
                              )}
                            </div>
                          );
                        } else if (h.key === 'newLevel') {
                          cellContent = (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-black text-xs sm:text-sm border border-emerald-200 dark:border-emerald-800">
                              <span>{item.newLevel}</span>
                              {item.levelsJumped > 1 && (
                                <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-md">
                                  +{toArabicDigits(item.levelsJumped)}
                                </span>
                              )}
                            </span>
                          );
                        } else if (h.key === 'previousLevel') {
                          cellContent = (
                            <span className="text-gray-600 dark:text-gray-300 font-bold text-xs sm:text-sm">
                              {item.previousLevel}
                            </span>
                          );
                        } else if (h.key === 'weekNumber') {
                          cellContent = (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-black text-xs sm:text-sm">
                              الأسبوع {toArabicDigits(item.weekNumber)}
                            </span>
                          );
                        } else {
                          cellContent = renderCell((item as any)[h.key], h.type);
                        }

                        return (
                          <td
                            key={h.key}
                            className={`px-3.5 py-3 whitespace-nowrap text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 ${
                              h.key === 'sequence' ? 'w-px !px-2.5 text-center font-bold text-gray-500' : ''
                            }`}
                          >
                            {cellContent}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <WordExportModal
        isOpen={isWordModalOpen}
        onClose={() => setIsWordModalOpen(false)}
        onExport={(orientation, action) => {
          if (action === 'share-pdf') {
            sharePdfDirectly(
              dynamicHeaders,
              sortedAndFilteredData,
              exportHeaderInfo.fileName,
              exportHeaderInfo.title,
              exportHeaderInfo.subtitle,
              hijriAdjustments,
              undefined,
              undefined,
              orientation
            );
          } else if (action === 'pdf') {
            exportToPdf(
              dynamicHeaders,
              sortedAndFilteredData,
              exportHeaderInfo.fileName,
              exportHeaderInfo.title,
              exportHeaderInfo.subtitle,
              hijriAdjustments
            );
          } else {
            exportToWord(
              dynamicHeaders,
              sortedAndFilteredData,
              exportHeaderInfo.fileName,
              exportHeaderInfo.title,
              hijriAdjustments,
              undefined,
              undefined,
              orientation,
              action
            );
          }
        }}
      />

      <ExcelExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onExport={(orientation, action) =>
          exportToExcel(
            dynamicHeaders,
            sortedAndFilteredData,
            exportHeaderInfo.fileName,
            exportHeaderInfo.title,
            hijriAdjustments,
            undefined,
            undefined,
            orientation,
            action
          )
        }
      />
    </div>
  );
};
