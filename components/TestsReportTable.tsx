import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { Evaluation, AttendanceStatus, PerformanceLevel, UserRole, AbsenceReason, PeriodicReviewStatus, EvaluationType, ScoreFilterConfig } from '../types';
import { renderCell, translationMap, exportToWord } from '../utils/exportWord';
import { exportToExcel } from '../utils/exportExcel';
import { exportToPdf, getDualDate, sharePdfDirectly } from '../utils/exportPdf';
import { shareHtmlViaWhatsApp } from '../utils/exportHtml';
import { isSmartMatch } from '../utils/searchUtils';
import { HexColorPicker } from "react-colorful";
import { getMemorizedPagesData, calculateStudentLevel } from "../utils/pageUtils";
import { formatJuzsFromNumbers } from "../utils/juzUtils";
import EvaluationEditForm from './EvaluationEditForm';
import Modal from './Modal';
import { FilterItem } from './FilterItem';
import { ScoreFilterDropdown, defaultScoreFilterConfig, matchesScoreFilter, getScoreFilterLabel } from './ScoreFilterDropdown';
import { WordExportModal } from './WordExportModal';
import { ExcelExportModal } from './ExcelExportModal';
import NewStudentsTestsTable from './NewStudentsTestsTable';

const NOT_TESTED = 'لم يتم تقييمه';
const TESTED = 'تم تقييمه';
const LOCAL_STORAGE_REPORT_COLUMNS_KEY = 'testReportSelectedColumns';
const LOCAL_STORAGE_COLOR_MAP_KEY = 'testReportColorMap';
const LOCAL_STORAGE_SAVE_COLORS_KEY = 'testReportSaveColors';
const LOCAL_STORAGE_RANK_COLORS_KEY = 'testReportRankColors';

const defaultRankColors = {
    rank1Color: '#D1FAE5',
    rank2Color: '#DBEAFE',
    rank3Color: '#FEF3C7',
    highlightColor: '#FEF3C7'
};

const isValueEffectivelyEmpty = (value: any, type?: string): boolean => {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  let stringValue = String(value).trim();
  if (stringValue === '' || stringValue === '—' || stringValue === '-') return true; 
  if (stringValue === 'غير معروف' || stringValue === 'غير معين') return true;
  if (type === 'translation') {
      const translated = translationMap[value as keyof typeof translationMap];
      if (!translated || translated === '—' || translated === 'غير معروف' || translated === 'غير معين') return true;
  }
  return false;
};

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || typeof hex !== 'string') return hex;
  if (!/^#[0-9A-F]{6}$/i.test(hex)) return hex;
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getLevelNum = (val: any) => {
    if (typeof val === 'string') {
        const match = val.match(/\d+/);
        return match ? parseInt(match[0]) : 999;
    }
    return 999;
};

const numericValue = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val.split(' ')[0] || '0');
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

function getLevelRanks(data: any[], levelExtractor: (item: any) => string, scoreExtractor: (item: any) => number) {
    const levelMap = new Map<string, any[]>();
    data.forEach(item => {
        const level = levelExtractor(item);
        if (!level || level === '—' || level === 'لم يحدد') return;
        if (!levelMap.has(level)) levelMap.set(level, []);
        levelMap.get(level)!.push(item);
    });

    const studentRankMap = new Map<any, number>();

    levelMap.forEach(students => {
        const total = students.length;
        let highlightsLimit = 0;
        if (total > 5) highlightsLimit = 3;
        else if (total >= 4) highlightsLimit = 2;
        else if (total >= 1) highlightsLimit = 1;

        if (highlightsLimit === 0) return;

        students.sort((a, b) => scoreExtractor(b) - scoreExtractor(a));

        let currentRank = 1;
        for (let i = 0; i < students.length; i++) {
            if (i > 0) {
                const prevScore = scoreExtractor(students[i-1]);
                const currScore = scoreExtractor(students[i]);
                if (Math.abs(prevScore - currScore) > 0.001) {
                    currentRank++;
                }
            }
            if (currentRank <= highlightsLimit) {
                studentRankMap.set(students[i], currentRank);
            }
        }
    });

    return studentRankMap;
}

interface SummaryRow {
    id: number;
    studentName: string;
    halaqaId: number;
    halaqaName: string;
    level: string;
    studentLevel?: string;
    isAlAmeen?: boolean;
    isFromIbri?: boolean;
    totalScore: number;
    rank?: number;
    sequence?: string | number;
    [key: string]: any;
  }

  const TestsSummaryMatrix: React.FC<{ 
    data: SummaryRow[]; 
    headers: any[]; 
    rankColors: typeof defaultRankColors | Record<string, string>;
    sortConfig: { key: string; direction: 'ascending' | 'descending' } | null;
    onSortConfigChange: (c: { key: string; direction: 'ascending' | 'descending' } | null) => void;
    onOpenRankColorsModal: () => void;
    colorMap: Record<string, string>;
    onColorChange: (val: string, color: string) => void;
    saveColors: boolean;
    onToggleSaveColors: (c: boolean) => void;
    manualRanks: Record<string, number>;
    setManualRanks: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    onUpdateScore: (studentId: number, testName: string, newScore: number | null) => void;
    isCloudSynced: boolean;
    handleSync: () => void;
    students: any[];
    halaqas: any[];
    users: any[];
    hijriAdjustments?: Record<string, number>;
    onFilteredCountChange?: (count: number) => void;
  }> = ({ data, headers, rankColors, sortConfig, onSortConfigChange, onOpenRankColorsModal, colorMap, onColorChange, saveColors, onToggleSaveColors, manualRanks, setManualRanks, onUpdateScore, isCloudSynced, handleSync, students, halaqas, users, hijriAdjustments, onFilteredCountChange }) => {
    const globalContext = useContext(AppContext);
    const [summaryStudentIds, setSummaryStudentIds] = useState<string[]>([]);
    const [summaryScoreFilter, setSummaryScoreFilter] = useState<ScoreFilterConfig>(defaultScoreFilterConfig);
    const [isSummaryWordModalOpen, setIsSummaryWordModalOpen] = useState(false);
    const [isSummaryExcelModalOpen, setIsSummaryExcelModalOpen] = useState(false);
    const [summaryHalaqaIds, setSummaryHalaqaIds] = useState<string[]>([]);
    const [summaryTeacherIds, setSummaryTeacherIds] = useState<string[]>([]);
    const [summaryLevels, setSummaryLevels] = useState<string[]>([]);
    const [summaryStudentLevels, setSummaryStudentLevels] = useState<string[]>([]);
    const [summaryTestKeys, setSummaryTestKeys] = useState<string[]>([]);
    const [summaryEvalStatus, setSummaryEvalStatus] = useState<string[]>(['all']);
    const [summaryAlAmeen, setSummaryAlAmeen] = useState<string[]>([]);
    const [summaryFromIbri, setSummaryFromIbri] = useState<string[]>(['نعم']);
    const [isQuickEdit, setIsQuickEdit] = useState(false);
    const [openRankDropdownRowId, setOpenRankDropdownRowId] = useState<string | null>(null);
    
    const [summarySearch, setSummarySearch] = useState({ student: '', halaqa: '', teacher: '', level: '', studentLevel: '', test: '', evalStatus: '', alAmeen: '', fromIbri: '' });
    const [summaryOpenDropdown, setSummaryOpenDropdown] = useState<string | null>(null);
    const [selectedSummaryColumnKeys, setSelectedSummaryColumnKeys] = useState<string[]>([]);
    const [summaryColumnOrder, setSummaryColumnOrder] = useState<string[]>([]);
    const [showSummaryColumnPicker, setShowSummaryColumnPicker] = useState(false);
    const [isSummaryDefaultSaved, setIsSummaryDefaultSaved] = useState(false);
    
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const scrollTable = (direction: 'right' | 'left') => {
      if (tableScrollRef.current) {
        const delta = direction === 'right' ? 300 : -300;
        tableScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
      }
    };
    const summaryColumnPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (summaryColumnPickerRef.current && !summaryColumnPickerRef.current.contains(event.target as Node)) {
                setShowSummaryColumnPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem('testsSummaryReportSelectedColumns');
        const baseOrder = headers.map(h => h.key);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSelectedSummaryColumnKeys(parsed);
                    const customMiddle = parsed.filter(k => k !== 'sequence');
                    const remaining = baseOrder.filter(k => !customMiddle.includes(k) && k !== 'sequence');
                    setSummaryColumnOrder(['sequence', ...customMiddle, ...remaining]);
                } else if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.selected)) setSelectedSummaryColumnKeys(parsed.selected);
                    if (Array.isArray(parsed.order)) {
                        const middle = parsed.order.filter((k: string) => k !== 'sequence');
                        const missing = baseOrder.filter(k => !middle.includes(k) && k !== 'sequence');
                        setSummaryColumnOrder(['sequence', ...middle, ...missing]);
                    } else {
                        setSummaryColumnOrder(baseOrder);
                    }
                } else {
                    setSelectedSummaryColumnKeys(baseOrder);
                    setSummaryColumnOrder(baseOrder);
                }
            } catch (e) {
                setSelectedSummaryColumnKeys(baseOrder);
                setSummaryColumnOrder(baseOrder);
            }
        } else {
            setSelectedSummaryColumnKeys(baseOrder);
            setSummaryColumnOrder(baseOrder);
        }
    }, [headers]);

    const moveSummaryColumn = (key: string, direction: 'up' | 'down') => {
        if (key === 'sequence') return;
        setSummaryColumnOrder(prev => {
            const baseOrder = headers.map(h => h.key);
            const currentFull = prev.length > 0 ? prev : baseOrder;
            const middle = currentFull.filter(k => k !== 'sequence');
            const idx = middle.indexOf(key);
            if (idx === -1) return currentFull;

            if (direction === 'up' && idx > 0) {
                const updated = [...middle];
                [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                return ['sequence', ...updated];
            }
            if (direction === 'down' && idx < middle.length - 1) {
                const updated = [...middle];
                [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
                return ['sequence', ...updated];
            }
            return currentFull;
        });
    };

    const handleSaveSummaryAsDefault = () => {
        localStorage.setItem('testsSummaryReportSelectedColumns', JSON.stringify({
            selected: selectedSummaryColumnKeys,
            order: summaryColumnOrder.length > 0 ? summaryColumnOrder : headers.map(h => h.key)
        }));
        setIsSummaryDefaultSaved(true);
        setTimeout(() => setIsSummaryDefaultSaved(false), 2500);
    };

    const handleResetSummaryToDefault = () => {
        const baseOrder = headers.map(h => h.key);
        setSelectedSummaryColumnKeys(baseOrder);
        setSummaryColumnOrder(baseOrder);
    };

    const halaqaOptionsSummary = useMemo(() => [
        { id: '0', name: 'غير محدد' },
        ...[...halaqas].sort((a,b) => a.name.localeCompare(b.name, 'ar', { numeric: true })).map(h => ({id: h.id, name: h.name}))
    ], [halaqas]);

    const evaluationStatusOptions = useMemo(() => [
        { id: TESTED, name: TESTED },
        { id: NOT_TESTED, name: NOT_TESTED }
    ], []);

    const alAmeenOptionsSummary = useMemo(() => [
        { id: 'نعم', name: 'نعم' },
        { id: 'لا', name: 'لا' }
    ], []);

    const ibriOptionsSummary = useMemo(() => [
        { id: 'نعم', name: 'نعم' },
        { id: 'لا', name: 'لا' }
    ], []);

    const levelOptions = useMemo(() => {
        const levelsSet = new Set<string>();
        data.forEach(r => { if (r.level && r.level !== '—' && r.level !== 'لم يحدد') levelsSet.add(r.level); });
        return Array.from(levelsSet).sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.match(/\d+/)?.[0] || '0');
            return numA - numB;
        }).map(l => ({ id: l, name: l }));
    }, [data]);

    const studentLevelOptions = useMemo(() => {
        const levelsSet = new Set<string>();
        data.forEach(r => { if (r.studentLevel && r.studentLevel !== '—' && r.studentLevel !== 'لم يحدد') levelsSet.add(r.studentLevel); });
        return Array.from(levelsSet).sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.match(/\d+/)?.[0] || '0');
            return numA - numB;
        }).map(l => ({ id: l, name: l }));
    }, [data]);

    const testOptions = useMemo(() => {
        return headers
            .filter(h => !['studentName', 'level', 'totalScore'].includes(h.key))
            .map(h => ({ id: h.key, name: h.label }));
    }, [headers]);

    const filteredHeaders = useMemo(() => {
        const headersMap = new Map(headers.map(h => [h.key, h]));
        const currentOrder = summaryColumnOrder.length > 0 ? summaryColumnOrder : headers.map(h => h.key);

        let activeKeys = currentOrder.filter(k => selectedSummaryColumnKeys.includes(k) && headersMap.has(k));

        if (summaryTestKeys.length > 0 && !summaryTestKeys.includes('all')) {
            activeKeys = activeKeys.filter(k => 
                ['studentName', 'level', 'totalScore', 'sequence'].includes(k) || 
                summaryTestKeys.includes(k)
            );
        }

        const hasSeq = activeKeys.includes('sequence');
        const other = activeKeys.filter(k => k !== 'sequence');
        const finalKeys: string[] = [];
        if (hasSeq) finalKeys.push('sequence');
        finalKeys.push(...other);

        return finalKeys.map(k => headersMap.get(k)!).filter(Boolean);
    }, [headers, summaryColumnOrder, summaryTestKeys, selectedSummaryColumnKeys]);

    const filteredData = useMemo(() => {
        let results = [...data];

        if (summaryStudentIds.length > 0 && !summaryStudentIds.includes('all')) {
            results = results.filter(r => summaryStudentIds.includes(String(r.id)));
        }
        if (summaryHalaqaIds.length > 0 && !summaryHalaqaIds.includes('all')) {
            results = results.filter(r => 
                summaryHalaqaIds.includes(String(r.halaqaId || 0)) || 
                (summaryHalaqaIds.includes('0') && (!r.halaqaId || r.halaqaId === 0))
            );
        }
        if (summaryTeacherIds.length > 0 && !summaryTeacherIds.includes('all')) {
            results = results.filter(r => {
                const halaqa = halaqas.find(h => h.id === r.halaqaId);
                return summaryTeacherIds.includes(String(halaqa?.teacherId));
            });
        }
        if (summaryLevels.length > 0 && !summaryLevels.includes('all')) {
            results = results.filter(r => summaryLevels.includes(r.level));
        }
        if (summaryStudentLevels.length > 0 && !summaryStudentLevels.includes('all')) {
            results = results.filter(r => summaryStudentLevels.includes(r.studentLevel));
        }

        if (summaryAlAmeen.length > 0 && !summaryAlAmeen.includes('all')) {
            results = results.filter(r => {
                const val = r.isAlAmeen ? 'نعم' : 'لا';
                return summaryAlAmeen.includes(val);
            });
        }

        if (summaryFromIbri.length > 0 && !summaryFromIbri.includes('all')) {
            results = results.filter(r => {
                const val = (r.isFromIbri !== false) ? 'نعم' : 'لا';
                return summaryFromIbri.includes(val);
            });
        }

        if (summaryEvalStatus.length > 0 && !summaryEvalStatus.includes('all')) {
            results = results.filter(r => {
                let isTested = false;
                if (summaryTestKeys.length > 0 && !summaryTestKeys.includes('all')) {
                    isTested = summaryTestKeys.some(t => r[t] !== undefined && r[t] !== null && r[t] !== '—');
                } else {
                    isTested = Boolean(r.hasAnyTest);
                }
                const status = isTested ? TESTED : NOT_TESTED;
                return summaryEvalStatus.includes(status);
            });
        }

        if (summaryScoreFilter.mode !== 'all') {
            results = results.filter(r => {
                let scoreToEvaluate: number | null = null;
                if (summaryScoreFilter.targetTest && summaryScoreFilter.targetTest !== 'auto') {
                    if (summaryScoreFilter.targetTest === 'total') {
                        scoreToEvaluate = typeof r.totalScore === 'number' ? r.totalScore : null;
                    } else {
                        const val = r[summaryScoreFilter.targetTest];
                        scoreToEvaluate = typeof val === 'number' ? val : null;
                    }
                } else {
                    if (summaryTestKeys.length === 1 && summaryTestKeys[0] !== 'all') {
                        const val = r[summaryTestKeys[0]];
                        scoreToEvaluate = typeof val === 'number' ? val : null;
                    } else {
                        scoreToEvaluate = typeof r.totalScore === 'number' ? r.totalScore : null;
                    }
                }
                return matchesScoreFilter(scoreToEvaluate, summaryScoreFilter);
            });
        }

        if (sortConfig) {
            results.sort((a, b) => {
                if (sortConfig.key === 'halaqaName' || sortConfig.key === 'studentName') {
                    const hA = a.halaqaName || '';
                    const hB = b.halaqaName || '';
                    const halaqaComp = hA.localeCompare(hB, 'ar', { numeric: true });
                    if (halaqaComp !== 0) {
                        const direction = sortConfig.key === 'halaqaName' ? sortConfig.direction : 'ascending';
                        return direction === 'ascending' ? halaqaComp : -halaqaComp;
                    }
                    const sA = a.studentName || '';
                    const sB = b.studentName || '';
                    const studentComp = sA.localeCompare(sB, 'ar', { numeric: true });
                    const direction = sortConfig.key === 'studentName' ? sortConfig.direction : 'ascending';
                    return direction === 'ascending' ? studentComp : -studentComp;
                }

                let vA = a[sortConfig.key];
                let vB = b[sortConfig.key];
                if (sortConfig.key === 'level') {
                    vA = getLevelNum(vA);
                    vB = getLevelNum(vB);
                } else if (sortConfig.key !== 'studentName' && sortConfig.key !== 'halaqaName') {
                    vA = numericValue(vA);
                    vB = numericValue(vB);
                }

                let diff = 0;
                if (typeof vA === 'string' && typeof vB === 'string') {
                    diff = vA.localeCompare(vB, undefined, { numeric: true, sensitivity: 'base' });
                } else {
                    if (vA < vB) diff = -1;
                    else if (vA > vB) diff = 1;
                }

                if (diff !== 0) return sortConfig.direction === 'ascending' ? diff : -diff;

                // Fallback
                const levelA = getLevelNum(a.level);
                const levelB = getLevelNum(b.level);
                if (levelA !== levelB) return levelA - levelB;
                return b.totalScore - a.totalScore;
            });
        }

        const ranks = getLevelRanks(results, r => r.level, r => r.totalScore);
        
        let finalResults = results.map((r) => {
            const manualRank = manualRanks[String(r.id)];
            const finalRank = manualRank !== undefined ? manualRank : ranks.get(r);
            return { ...r, rank: finalRank };
        });

        if (!sortConfig) {
            finalResults.sort((a, b) => {
                const levelA = getLevelNum(a.level);
                const levelB = getLevelNum(b.level);
                if (levelA !== levelB) return levelA - levelB;
                
                const validRankA = (a.rank !== undefined && a.rank > 0) ? a.rank : Infinity;
                const validRankB = (b.rank !== undefined && b.rank > 0) ? b.rank : Infinity;
                
                if (validRankA !== validRankB) return validRankA - validRankB;
                
                return b.totalScore - a.totalScore;
            });
        }
        
        let seq = 1;
        return finalResults.map((r) => {
            if (r.rank === -1) {
                return { ...r, sequence: '-' };
            }
            return { ...r, sequence: seq++ };
        });
    }, [data, summaryStudentIds, summaryHalaqaIds, summaryTeacherIds, summaryLevels, summaryStudentLevels, summaryTestKeys, summaryEvalStatus, summaryAlAmeen, summaryFromIbri, summaryScoreFilter, halaqas, sortConfig, manualRanks]);

    useEffect(() => {
        if (onFilteredCountChange) {
            onFilteredCountChange(filteredData.length);
        }
    }, [filteredData.length, onFilteredCountChange]);

    useEffect(() => {
        if (globalContext?.setTestsSummaryFilteredData) {
            globalContext.setTestsSummaryFilteredData(filteredData);
        }
    }, [filteredData, globalContext?.setTestsSummaryFilteredData]);

    return (
        <>
            <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-3 no-print">
                <FilterItem id="sumStudent" title="الطالب" selectedValues={summaryStudentIds} options={students.map(s => ({id: s.id, name: s.name}))} onSelect={setSummaryStudentIds} search={summarySearch.student} setSearch={(v) => setSummarySearch(p => ({...p, student: v}))} openDropdown={summaryOpenDropdown} setOpenDropdown={setSummaryOpenDropdown} />
                <FilterItem id="sumHalaqa" title="حلقة الطالب" selectedValues={summaryHalaqaIds} options={halaqaOptionsSummary} onSelect={setSummaryHalaqaIds} search={summarySearch.halaqa} setSearch={(v) => setSummarySearch(p => ({...p, halaqa: v}))} openDropdown={summaryOpenDropdown} setOpenDropdown={setSummaryOpenDropdown} />
                <FilterItem id="sumTeacher" title="المعلم" selectedValues={summaryTeacherIds} options={users.filter(u => u.role === UserRole.TEACHER).map(t => ({id: t.id, name: t.name}))} onSelect={setSummaryTeacherIds} search={summarySearch.teacher} setSearch={(v) => setSummarySearch(p => ({...p, teacher: v}))} openDropdown={summaryOpenDropdown} setOpenDropdown={setSummaryOpenDropdown} />
                <FilterItem id="sumLevel" title="المستوى" selectedValues={summaryLevels} options={levelOptions} onSelect={setSummaryLevels} search={summarySearch.level} setSearch={(v) => setSummarySearch(p => ({...p, level: v}))} openDropdown={summaryOpenDropdown} setOpenDropdown={setSummaryOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={onColorChange} saveColors={saveColors} onToggleSaveColors={onToggleSaveColors} />
                <FilterItem id="sumStudentLevel" title="مستوى الطالب" selectedValues={summaryStudentLevels} options={studentLevelOptions} onSelect={setSummaryStudentLevels} search={summarySearch.studentLevel} setSearch={(v) => setSummarySearch(p => ({...p, studentLevel: v}))} openDropdown={summaryOpenDropdown} setOpenDropdown={setSummaryOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={onColorChange} saveColors={saveColors} onToggleSaveColors={onToggleSaveColors} />
                <FilterItem id="sumAlAmeen" title="من الأمين؟" selectedValues={summaryAlAmeen} options={alAmeenOptionsSummary} onSelect={setSummaryAlAmeen} search={summarySearch.alAmeen} setSearch={(v) => setSummarySearch(p => ({...p, alAmeen: v}))} openDropdown={summaryOpenDropdown} setOpenDropdown={setSummaryOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={onColorChange} saveColors={saveColors} onToggleSaveColors={onToggleSaveColors} />
                <FilterItem id="sumFromIbri" title="من جامع عبري؟" selectedValues={summaryFromIbri} options={ibriOptionsSummary} onSelect={setSummaryFromIbri} search={summarySearch.fromIbri} setSearch={(v) => setSummarySearch(p => ({...p, fromIbri: v}))} openDropdown={summaryOpenDropdown} setOpenDropdown={setSummaryOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={onColorChange} saveColors={saveColors} onToggleSaveColors={onToggleSaveColors} />
                <FilterItem id="sumTest" title="اسم الاختبار" selectedValues={summaryTestKeys} options={testOptions} onSelect={setSummaryTestKeys} search={summarySearch.test} setSearch={(v) => setSummarySearch(p => ({...p, test: v}))} openDropdown={summaryOpenDropdown} setOpenDropdown={setSummaryOpenDropdown} />
                <FilterItem id="sumEvalStatus" title="حالة التقييم" selectedValues={summaryEvalStatus} options={evaluationStatusOptions} onSelect={setSummaryEvalStatus} search={summarySearch.evalStatus} setSearch={(v) => setSummarySearch(p => ({...p, evalStatus: v}))} openDropdown={summaryOpenDropdown} setOpenDropdown={setSummaryOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={onColorChange} saveColors={saveColors} onToggleSaveColors={onToggleSaveColors} />
                <ScoreFilterDropdown 
                  id="sumScoreFilter" 
                  title="تصفية الدرجة" 
                  config={summaryScoreFilter} 
                  onChange={setSummaryScoreFilter} 
                  openDropdown={summaryOpenDropdown} 
                  setOpenDropdown={setSummaryOpenDropdown} 
                  testOptions={testOptions} 
                  showTargetSelector={true} 
                  onSortByScore={(dir) => {
                    let sortKey = 'totalScore';
                    if (summaryScoreFilter.targetTest && summaryScoreFilter.targetTest !== 'auto' && summaryScoreFilter.targetTest !== 'total') {
                      sortKey = summaryScoreFilter.targetTest;
                    } else if (summaryTestKeys.length === 1 && summaryTestKeys[0] !== 'all') {
                      sortKey = summaryTestKeys[0];
                    }
                    onSortConfigChange({ key: sortKey, direction: dir });
                  }}
                />
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4 no-print border-t pt-4 border-gray-100 dark:border-gray-700">
                <button onClick={() => setIsSummaryExcelModalOpen(true)} className="px-3 py-2 text-[10px] font-bold text-white bg-green-600 rounded-lg shadow-sm">Excel</button>
                <button onClick={() => setIsSummaryWordModalOpen(true)} className="px-3 py-2 text-[10px] font-bold text-white bg-blue-600 rounded-lg shadow-sm">Word</button>
                <div className="flex gap-1">
                    <button onClick={() => exportToPdf(filteredHeaders, filteredData.filter(r => r.rank !== -1), 'ملخص_الاختبارات', 'تقرير ملخص الاختبارات والمستويات', undefined, hijriAdjustments, colorMap, rankColors)} className="px-3 py-2 text-[10px] font-bold text-white bg-red-600 rounded-lg shadow-sm flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        طباعة
                    </button>
                    <button onClick={() => sharePdfDirectly(filteredHeaders, filteredData.filter(r => r.rank !== -1), 'ملخص_الاختبارات', 'تقرير ملخص الاختبارات والمستويات', undefined, hijriAdjustments, colorMap, rankColors, "landscape")} className="px-3 py-2 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                        مشاركة PDF
                    </button>
                </div>
                <button
                  onClick={() => setIsQuickEdit(!isQuickEdit)}
                  className={`px-3 py-2 text-[10px] font-bold rounded-lg shadow-sm flex items-center gap-2 transition ${isQuickEdit ? 'bg-indigo-600 text-white dark:bg-indigo-500' : 'text-gray-700 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-200'}`}
                >
                    {isQuickEdit ? 'تعديل سريع: مفعل' : 'تعديل سريع'}
                </button>
                
                <div className="relative inline-block text-right">
                    <button 
                      onClick={onOpenRankColorsModal} 
                      className="px-3 py-2 text-[10px] font-bold text-gray-700 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-200 rounded-lg shadow-sm flex items-center gap-2"
                    >ألوان المراتب</button>
                </div>
                
                <button 
                  onClick={handleSync} 
                  className={`px-3 py-2 text-[10px] font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all duration-300 ${isCloudSynced ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'text-white bg-indigo-600 hover:bg-indigo-700'}`}
                >
                    {isCloudSynced ? (
                        <>
                            <span>إلغاء حفظ التنسيق</span>
                            <span className="bg-white text-orange-600 rounded p-0.5 leading-none font-bold text-[8px]">🔄</span>
                        </>
                    ) : (
                        <>
                            <span>حفظ التنسيق</span>
                            <div className="w-4 h-4 border border-white/30 rounded flex items-center justify-center">
                            </div>
                        </>
                    )}
                </button>
                
                <div ref={summaryColumnPickerRef} className="relative inline-block text-right">
                    <button 
                      onClick={() => setShowSummaryColumnPicker(!showSummaryColumnPicker)} 
                      className="px-3 py-2 text-[10px] font-bold text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-lg shadow-sm flex items-center gap-2"
                    >الأعمدة</button>
                    {showSummaryColumnPicker && (
                        <>
                          <div 
                            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[65] sm:hidden" 
                            onClick={() => setShowSummaryColumnPicker(false)} 
                          />
                          <div className="fixed sm:absolute z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0 sm:top-full sm:left-auto sm:right-0 sm:mt-2 w-[92vw] max-w-sm sm:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-fade-in ring-1 ring-black/10 text-right">
                            <div className="flex justify-between items-center mb-3 pb-2 border-b dark:border-gray-700">
                                <span className="text-xs font-black text-green-800 dark:text-green-400">تخصيص وترتيب الأعمدة</span>
                                <button onClick={() => setShowSummaryColumnPicker(false)} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </div>
                            <div className="flex gap-2 mb-2 pb-2 border-b dark:border-gray-700">
                                <button onClick={() => setSelectedSummaryColumnKeys(headers.map(h => h.key))} className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex-1 text-center bg-blue-50 dark:bg-blue-900/30 py-1.5 rounded-lg">إظهار الكل</button>
                                <button onClick={() => setSelectedSummaryColumnKeys([])} className="text-[11px] text-red-600 dark:text-red-400 font-bold hover:underline flex-1 text-center bg-red-50 dark:bg-red-900/30 py-1.5 rounded-lg">إخفاء الكل</button>
                            </div>
                            <div className="max-h-[50vh] sm:max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-1 divide-y divide-gray-100 dark:divide-gray-700/40">
                                {(summaryColumnOrder.length > 0 ? summaryColumnOrder : headers.map(h => h.key)).map((key) => {
                                    const h = headers.find(item => item.key === key);
                                    if (!h) return null;
                                    const isChecked = selectedSummaryColumnKeys.includes(h.key);
                                    const currentOrder = summaryColumnOrder.length > 0 ? summaryColumnOrder : headers.map(item => item.key);
                                    const middleKeys = currentOrder.filter(k => k !== 'sequence');
                                    const middleIdx = middleKeys.indexOf(h.key);
                                    const isFirstMiddle = middleIdx === 0;
                                    const isLastMiddle = middleIdx === middleKeys.length - 1;

                                    return (
                                        <div key={h.key} className="flex items-center justify-between gap-3 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl group transition-colors">
                                            <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                                <input 
                                                  type="checkbox" 
                                                  checked={isChecked} 
                                                  onChange={() => setSelectedSummaryColumnKeys(prev => isChecked ? prev.filter(k => k !== h.key) : [...prev, h.key])}
                                                  className="w-4 h-4 rounded text-green-600 border-gray-300 focus:ring-green-500 cursor-pointer flex-shrink-0"
                                                />
                                                <span className={`text-xs font-bold truncate ${isChecked ? 'text-green-950 dark:text-green-200' : 'text-gray-400 dark:text-gray-500'}`}>
                                                  {h.label}
                                                </span>
                                            </label>

                                            {h.key === 'sequence' ? (
                                                <span className="text-[10px] sm:text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-bold px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800 whitespace-nowrap flex-shrink-0">
                                                    الأول دائماً
                                                </span>
                                            ) : (
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    <button
                                                      type="button"
                                                      disabled={isFirstMiddle}
                                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveSummaryColumn(h.key, 'up'); }}
                                                      className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
                                                      title="تقديم للأعلى"
                                                      aria-label="تقديم للأعلى"
                                                    >
                                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                                      </svg>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      disabled={isLastMiddle}
                                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveSummaryColumn(h.key, 'down'); }}
                                                      className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
                                                      title="تأخير للأسفل"
                                                      aria-label="تأخير للأسفل"
                                                    >
                                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
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
                                  onClick={handleSaveSummaryAsDefault}
                                  className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                                    isSummaryDefaultSaved 
                                      ? 'bg-emerald-600 text-white' 
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-500/30 active:scale-95'
                                  }`}
                                >
                                  {isSummaryDefaultSaved ? (
                                    <span>✓ تم حفظ الترتيب والتنسيق الافتراضي</span>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                      </svg>
                                      <span>حفظ الترتيب كعرض افتراضي</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleResetSummaryToDefault}
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

            <div className="flex justify-between items-center mb-2 no-print sm:hidden">
                <span className="text-xs text-gray-500 font-bold">مرر يميناً ويساراً لعرض الأعمدة</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => scrollTable('right')}
                        className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        title="تمرير يمين"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                    <button
                        onClick={() => scrollTable('left')}
                        className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        title="تمرير يسار"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                </div>
            </div>

            <div className="relative group">
              <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity">
                   <button
                        onClick={() => scrollTable('right')}
                        className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                        title="تمرير يمين"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                    </button>
              </div>
              
              <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity">
                   <button
                        onClick={() => scrollTable('left')}
                        className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                        title="تمرير يسار"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
              </div>

              <div ref={tableScrollRef} className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 custom-scrollbar">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/90 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                        <tr>
                            {filteredHeaders.map(h => (
                                <th 
                                    key={h.key} 
                                    onClick={() => onSortConfigChange({ 
                                        key: h.key, 
                                        direction: sortConfig?.key === h.key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' 
                                    })}
                                    className={`px-3 py-4 text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase whitespace-nowrap text-right cursor-pointer ${h.key === 'sequence' ? 'w-px !px-2 text-center' : ''}`}
                                >
                                    {h.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
                        {filteredData.map((row, idx) => {
                            let rowColorStyle: any = {};
                            if (row.rank === -1) {
                                rowColorStyle.opacity = 0.5;
                                rowColorStyle.textDecoration = 'line-through';
                            } else if (row.rank === 1 && rankColors?.rank1Color) {
                                rowColorStyle.backgroundColor = hexToRgba(rankColors.rank1Color, 0.4);
                            } else if (row.rank === 2 && rankColors?.rank2Color) {
                                rowColorStyle.backgroundColor = hexToRgba(rankColors.rank2Color, 0.4);
                            } else if (row.rank === 3 && rankColors?.rank3Color) {
                                rowColorStyle.backgroundColor = hexToRgba(rankColors.rank3Color, 0.4);
                            } else if (row.rank && row.rank > 0 && rankColors?.highlightColor) {
                                rowColorStyle.backgroundColor = hexToRgba(rankColors.highlightColor, 0.3);
                            }

                            return (
                                <tr key={row.id} style={rowColorStyle} className={`${!rowColorStyle.backgroundColor ? (idx % 2 === 0 ? "" : "bg-gray-50/10 dark:bg-gray-900/5") : ""} hover:bg-indigo-50/20 transition-colors ${row.rank === -1 ? 'opacity-50 line-through' : ''}`}>
                                    {filteredHeaders.map(h => {
                                        let cellStyle: any = {};
                                        if (h.key === 'level' && row.level && colorMap && colorMap[row.level]) {
                                            cellStyle = { backgroundColor: hexToRgba(colorMap[row.level], 0.15), color: colorMap[row.level], fontWeight: 'bold' };
                                        }
                                        if (h.key === 'studentLevel' && row.studentLevel && colorMap && colorMap[row.studentLevel]) {
                                            cellStyle = { backgroundColor: hexToRgba(colorMap[row.studentLevel], 0.15), color: colorMap[row.studentLevel], fontWeight: 'bold' };
                                        }

                                        return (
                                            <td key={h.key} style={cellStyle} className={`px-3 py-4 whitespace-nowrap text-xs font-bold ${h.key === 'studentName' ? 'text-indigo-900 dark:text-indigo-100' : h.key === 'totalScore' ? 'text-green-700 dark:text-green-400 font-black' : (cellStyle.color ? '' : 'text-gray-700 dark:text-gray-300')} ${h.key === 'sequence' ? 'w-px !px-2 text-center' : ''}`}>
                                                {h.key === 'studentName' ? (
                                                    <div className="flex items-center gap-2 justify-end">
    <div className="flex flex-col text-right min-w-0">
        <span className="truncate">{row[h.key]}</span>
        {row.isAlAmeen && (
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold leading-tight">
                (من طلاب الأمين)
            </span>
        )}
    </div>
    <div className="relative inline-block text-right text-gray-800 dark:text-gray-200">
        <select
            value={manualRanks[String(row.id)] === undefined ? '' : String(manualRanks[String(row.id)])}
            onChange={(e) => {
                const val = e.target.value;
                setManualRanks(prev => {
                    const next = {...prev};
                    if (val === '') {
                        delete next[String(row.id)];
                    } else {
                        next[String(row.id)] = parseInt(val);
                    }
                    return next;
                });
            }}
            className="text-[10px] py-1 px-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 outline-none cursor-pointer hover:border-indigo-400 no-print transition-all font-bold focus:ring-1 focus:ring-indigo-500 w-[5rem]"
            dir="rtl"
        >
            <option value="" className="text-gray-800 dark:text-gray-200 font-bold">تلقائي</option>
            <option value="1" className="text-gray-800 dark:text-gray-200 font-bold">1</option>
            <option value="2" className="text-gray-800 dark:text-gray-200 font-bold">2</option>
            <option value="3" className="text-gray-800 dark:text-gray-200 font-bold">3</option>
            <option value="0" className="text-gray-800 dark:text-gray-200 font-bold">بدون</option>
            <option value="-1" className="text-gray-800 dark:text-gray-200 font-bold">إخفاء</option>
        </select>
    </div>
</div>
                                                ) : isQuickEdit && !['sequence', 'studentName', 'level', 'totalScore'].includes(h.key) ? (
                                                    <input 
                                                        type="number"
                                                        className="w-16 px-1 py-1 text-center font-bold border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        defaultValue={row[h.key] === '—' ? '' : row[h.key]}
                                                        onFocus={(e) => e.target.select()}
                                                        onBlur={(e) => {
                                                            let val: string | null = e.target.value;
                                                            if (val === '') val = null;
                                                            const newScore = val ? Number(val) : null;
                                                            if (row[h.key] !== newScore && !(row[h.key] === '—' && newScore === null)) {
                                                                onUpdateScore(row.id, h.key, newScore);
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    row[h.key]
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {filteredData.length === 0 && (
                            <tr>
                                <td colSpan={filteredHeaders.length} className="px-6 py-10 text-center text-gray-500 font-bold">لا يوجد بيانات لعرضها</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            </div>
        </div>

        <WordExportModal
            isOpen={isSummaryWordModalOpen}
            onClose={() => setIsSummaryWordModalOpen(false)}
            onExport={(orientation, action) => {
          if (action === 'share-pdf') {
            sharePdfDirectly(filteredHeaders, filteredData.filter(r => r.rank !== -1), 'ملخص_الاختبارات', 'تقرير ملخص الاختبارات والمستويات', undefined, hijriAdjustments, colorMap, rankColors, orientation);
          } else if (action === 'pdf') {
            exportToPdf(filteredHeaders, filteredData.filter(r => r.rank !== -1), 'ملخص_الاختبارات', 'تقرير ملخص الاختبارات والمستويات', undefined, hijriAdjustments, colorMap, rankColors);
          } else {
            exportToWord(filteredHeaders, filteredData.filter(r => r.rank !== -1), 'ملخص_الاختبارات', 'تقرير ملخص الاختبارات والمستويات', hijriAdjustments, colorMap, rankColors, orientation, action);
          }
        }}
        />
        <ExcelExportModal
            isOpen={isSummaryExcelModalOpen}
            onClose={() => setIsSummaryExcelModalOpen(false)}
            onExport={(orientation, action) => exportToExcel(filteredHeaders, filteredData.filter(r => r.rank !== -1), 'ملخص_الاختبارات', 'تقرير ملخص الاختبارات والمستويات', hijriAdjustments, colorMap, rankColors, orientation, action)}
        />
      </>
    );
  };



export const TestsReportTable: React.FC = () => {
  const context = useContext(AppContext);

  const evaluations = context?.evaluations || [];
  const students = context?.students || [];
  const halaqas = context?.halaqas || [];
  const users = context?.users || [];
  const updateEvaluation = context?.updateEvaluation;
  const addEvaluation = context?.addEvaluation;
  const deleteEvaluation = context?.deleteEvaluation;
  const showToast = context?.showToast;
  const hijriAdjustments = context?.hijriAdjustments;
  const currentUser = context?.currentUser;
  const colorMap = context?.colorMap || {};
  const setColorMap = context?.setColorMap || (() => {});
  const saveColors = context?.saveColors || false;
  const setSaveColors = context?.setSaveColors || (() => {});
  const contextRankColors = context?.rankColors;
  const setContextRankColors = context?.setRankColors || (() => {});
  const manualRanks = context?.manualRanks || {};
  const setManualRanks = context?.setManualRanks || (() => {});

  const rankColors = contextRankColors && Object.keys(contextRankColors).length > 0 ? contextRankColors : defaultRankColors;
  const setRankColors = setContextRankColors;
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(['all']);
  const [hasSetDefaultWeek, setHasSetDefaultWeek] = useState(false);
  const [isCloudSynced, setIsCloudSynced] = useState(() => {
      const saved = localStorage.getItem('isCloudSynced');
      return saved ? JSON.parse(saved) : false;
  });

  const [activeTab, setActiveTab] = useState<'detailed' | 'summary' | 'newStudents'>('detailed');
  const [summaryFilteredCount, setSummaryFilteredCount] = useState<number>(0);

  const newStudentTests = context?.newStudentTests || [];
  const newStudentPendingCount = useMemo(() => {
    return newStudentTests.filter(t => !t.status || t.status === 'pending').length;
  }, [newStudentTests]);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [detailedScoreFilter, setDetailedScoreFilter] = useState<ScoreFilterConfig>(defaultScoreFilterConfig);
  const [selectedHalaqaIds, setSelectedHalaqaIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedEvalStatus, setSelectedEvalStatus] = useState<string[]>([TESTED]);
  const [selectedAlAmeen, setSelectedAlAmeen] = useState<string[]>([]);
  const [selectedFromIbri, setSelectedFromIbri] = useState<string[]>(['نعم']);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  const [showRankColorsModal, setShowRankColorsModal] = useState(false);
  const [activeRankTarget, setActiveRankTarget] = useState<string | null>(null);

  const [studentSearch, setStudentSearch] = useState('');
  const [isDetailedWordModalOpen, setIsDetailedWordModalOpen] = useState(false);
  const [isDetailedExcelModalOpen, setIsDetailedExcelModalOpen] = useState(false);
  const [halaqaSearch, setHalaqaSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [evalStatusSearch, setEvalStatusSearch] = useState('');
  const [alAmeenSearch, setAlAmeenSearch] = useState('');
  const [fromIbriSearch, setFromIbriSearch] = useState('');
  const [weekSearch, setWeekSearch] = useState('');
  const [levelSearch, setLevelSearch] = useState('');
  const [selectedStudentLevels, setSelectedStudentLevels] = useState<string[]>([]);
  const [studentLevelSearch, setStudentLevelSearch] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [isDetailedDefaultSaved, setIsDetailedDefaultSaved] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);
  
  const detailedTableScrollRef = useRef<HTMLDivElement>(null);
  const scrollDetailedTable = (direction: 'right' | 'left') => {
    if (detailedTableScrollRef.current) {
      const delta = direction === 'right' ? 300 : -300;
      detailedTableScrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  
  const containerRef = useRef<HTMLDivElement>(null);

  const testEvaluations = useMemo(() => evaluations.filter(e => e.isTest), [evaluations]);
  
  const studentProgressMap = useMemo<Map<number, { surahs: string, juzs: string, level: string, studentLevel: string }>>(() => {
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

    const map = new Map<number, { surahs: string, juzs: string, level: string, studentLevel: string }>();
    students.forEach(s => {
        const studentEvaluations = evaluations.filter(ev => ev.studentId === s.id && ev.surahs && ev.surahs.length > 0 && !ev.isTest);
        const uniqueSurahs = new Set<string>();
        const uniqueJuzs = new Set<number>();
        
        studentEvaluations.forEach(ev => {
          ev.surahs?.forEach(surah => {
            uniqueSurahs.add(surah as string);
            const juzs = SURAH_JUZ_MAPPING[surah as string] || [];
            juzs.forEach(j => uniqueJuzs.add(j));
          });
        });

        const pagesData = getMemorizedPagesData(s, evaluations);
        map.set(s.id, {
            surahs: Array.from(uniqueSurahs).join('، '),
            juzs: formatJuzsFromNumbers(Array.from(uniqueJuzs)),
            level: s.manualLevel || (uniqueJuzs.size > 0 ? `المستوى ${uniqueJuzs.size}` : 'لم يحدد'),
            studentLevel: s.manualStudentLevel || calculateStudentLevel(pagesData.totalCount)
        });
    });
    return map;
  }, [students, evaluations]);

  const uniqueTestNames = useMemo(() => {
    const tests = new Set<string>();
    testEvaluations.forEach(e => {
        tests.add(e.testName || `أسبوع ${e.weekNumber}`);
    });
    return Array.from(tests).sort();
  }, [testEvaluations]);

  const processedSummaryData = useMemo(() => {
    const results = students.map(s => {
        const row: any = {
            id: s.id,
            studentName: s.name,
            isAlAmeen: s.isAlAmeen,
            isFromIbri: s.isFromIbri !== false,
            isFromIbriStr: (s.isFromIbri !== false) ? 'نعم' : 'لا',
            halaqaId: s.halaqaId,
            halaqaName: halaqas.find(h => h.id === s.halaqaId)?.name || '—',
            level: studentProgressMap.get(s.id)?.level || 'لم يحدد',
            studentLevel: studentProgressMap.get(s.id)?.studentLevel || 'لم يحدد',
            totalScore: 0,
            hasAnyTest: false
        };

        uniqueTestNames.forEach(testName => {
            const ev = testEvaluations.find(e => 
                e.studentId === s.id && 
                (e.testName === testName || (!e.testName && `أسبوع ${e.weekNumber}` === testName))
            );
            
            if (ev) {
                row.hasAnyTest = true;
                row[testName] = ev.testTotalScore;
                if (typeof ev.testTotalScore === 'number') {
                    row.totalScore += ev.testTotalScore;
                }
            } else {
                row[testName] = '—';
            }
        });

        return row;
    });

    const getLevelValue = (levelStr: string) => {
        if (!levelStr || levelStr === 'لم يحدد') return 999;
        const match = levelStr.match(/\d+/);
        return match ? parseInt(match[0]) : 999;
    };

    return results; // Sorting happens in the matrix component now
  }, [students, halaqas, testEvaluations, uniqueTestNames, studentProgressMap]);

  const summaryHeaders = useMemo(() => [
    { key: 'sequence', label: '#' },
    { key: 'studentName', label: 'اسم الطالب' },
    { key: 'level', label: 'المستوى' },
    { key: 'studentLevel', label: 'مستوى الطالب' },
    ...uniqueTestNames.map(name => ({ key: name, label: name })),
    { key: 'totalScore', label: 'المجموع' }
  ], [uniqueTestNames]);

  
  const maxWeekFound = useMemo(() => {
    if (testEvaluations.length === 0) return 'all';
    const weeks = testEvaluations.map(e => e.weekNumber);
    return Math.max(...weeks).toString();
  }, [testEvaluations]);

  useEffect(() => {
    if (!hasSetDefaultWeek && maxWeekFound !== 'all' && testEvaluations.length > 0) {
        setSelectedWeeks([maxWeekFound]);
        setHasSetDefaultWeek(true);
    }
  }, [maxWeekFound, hasSetDefaultWeek, testEvaluations.length]);

  const allHeaders = useMemo(() => [
    { key: 'sequence', label: '#' },
    { key: 'studentName', label: 'الطالب' },
    { key: 'level', label: 'المستوى' },
    { key: 'studentOriginalHalaqaName', label: 'حلقة الطالب' },
    { key: 'halaqaName', label: 'حلقة المقيم' },
    { key: 'evaluatorName', label: 'المقيم' },
    { key: 'weekNumber', label: 'اسم الاختبار' },
    { key: 'evaluationDate', label: 'التاريخ' },
    { key: 'evalStatus', label: 'حالة التقييم', type: 'translation' },
    { key: 'surahs', label: 'السور (اختبار)', type: 'array' },
    { key: 'testFathErrors', label: 'أخطاء الفتح' },
    { key: 'testTashkeelErrors', label: 'أخطاء التشكيل' },
    { key: 'testTajweedErrors', label: 'أخطاء التجويد' },
    { key: 'testPassageChanges', label: 'تغيير المقطع' },
    { key: 'testTotalScore', label: 'درجة الاختبار' },
    { key: 'studentLevel', label: 'مستوى الطالب' },
    { key: 'isAlAmeenStr', label: 'من الأمين؟' },
    { key: 'isFromIbriStr', label: 'من جامع عبري؟' },
    { key: 'notes', label: 'ملاحظات' },
  ], []);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_REPORT_COLUMNS_KEY);
    const defaultKeys = allHeaders.map(h => h.key).filter(k => k !== 'evaluatorName' && k !== 'evaluationDate' && k !== 'studentOriginalHalaqaName' && k !== 'isAlAmeenStr' && k !== 'isFromIbriStr');
    const baseOrder = allHeaders.map(h => h.key);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedColumnKeys(parsed);
            const customMiddle = parsed.filter(k => k !== 'sequence' && k !== 'notes');
            const remaining = baseOrder.filter(k => !customMiddle.includes(k) && k !== 'sequence' && k !== 'notes');
            setColumnOrder(['sequence', ...customMiddle, ...remaining, 'notes']);
        } else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.selected)) setSelectedColumnKeys(parsed.selected);
            if (Array.isArray(parsed.order)) {
                const middle = parsed.order.filter((k: string) => k !== 'sequence' && k !== 'notes');
                const missing = baseOrder.filter(k => !middle.includes(k) && k !== 'sequence' && k !== 'notes');
                setColumnOrder(['sequence', ...middle, ...missing, 'notes']);
            } else {
                setColumnOrder(baseOrder);
            }
        } else {
            setSelectedColumnKeys(defaultKeys);
            setColumnOrder(baseOrder);
        }
      } catch (e) { 
          setSelectedColumnKeys(defaultKeys); 
          setColumnOrder(baseOrder);
      }
    } else { 
        setSelectedColumnKeys(defaultKeys); 
        setColumnOrder(baseOrder);
    }
  }, [allHeaders]);

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

  const handleSaveDetailedAsDefault = () => {
    localStorage.setItem(LOCAL_STORAGE_REPORT_COLUMNS_KEY, JSON.stringify({
      selected: selectedColumnKeys,
      order: columnOrder.length > 0 ? columnOrder : allHeaders.map(h => h.key)
    }));
    setIsDetailedDefaultSaved(true);
    setTimeout(() => setIsDetailedDefaultSaved(false), 2500);
  };

  const handleResetDetailedToDefault = () => {
    const defaultKeys = allHeaders.map(h => h.key).filter(k => k !== 'evaluatorName' && k !== 'evaluationDate' && k !== 'studentOriginalHalaqaName' && k !== 'isAlAmeenStr' && k !== 'isFromIbriStr');
    const baseOrder = allHeaders.map(h => h.key);
    setSelectedColumnKeys(defaultKeys);
    setColumnOrder(baseOrder);
  };


  const processedEvaluationData = useMemo(() => {
    return testEvaluations.map(e => {
      const student = students.find(s => Number(s.id) === Number(e.studentId));
      const evaluator = users.find(u => Number(u.id) === Number(e.teacherId));
      const studentOriginalHalaqa = student ? halaqas.find(h => Number(h.id) === Number(student.halaqaId)) : null;
      const studentOriginalHalaqaId = student ? Number(student.halaqaId) : -1;
      const isGuestEvaluation = student ? Number(e.halaqaId) !== Number(student.halaqaId) : false;
      const evaluatorOwnedHalaqa = halaqas.find(h => Number(h.teacherId) === Number(e.teacherId));
      let displayHalaqaName = "معلم متنقل";
      if (evaluatorOwnedHalaqa) {
          displayHalaqaName = evaluatorOwnedHalaqa.name;
      }

      const pagesData = student ? getMemorizedPagesData(student, evaluations) : { totalCount: 0 };
      return { 
        ...e, 
        studentName: student?.name || 'غير معروف', 
        isAlAmeen: student?.isAlAmeen,
        isAlAmeenStr: student?.isAlAmeen ? 'نعم' : 'لا',
        isFromIbri: student?.isFromIbri !== false,
        isFromIbriStr: (student?.isFromIbri !== false) ? 'نعم' : 'لا',
        studentLevel: student ? (student.manualStudentLevel || calculateStudentLevel(pagesData.totalCount)) : '',
        studentOriginalHalaqaName: studentOriginalHalaqa?.name || '-',
        studentOriginalHalaqaId, 
        halaqaName: displayHalaqaName,
        evaluatorOwnedHalaqaId: evaluatorOwnedHalaqa?.id,
        evaluatorName: evaluator?.name || '—', 
        isGuestEvaluation,
        evaluationDate: e.evaluationDate || '—',
        evalStatus: TESTED,
        testFathErrors: e.testFathErrors !== undefined && e.testFathErrors !== null ? e.testFathErrors : 0,
        testTashkeelErrors: e.testTashkeelErrors !== undefined && e.testTashkeelErrors !== null ? e.testTashkeelErrors : 0,
        testTajweedErrors: e.testTajweedErrors !== undefined && e.testTajweedErrors !== null ? e.testTajweedErrors : 0,
        testPassageChanges: e.testPassageChanges !== undefined && e.testPassageChanges !== null ? e.testPassageChanges : 0,
        testTotalScore: (e.testTotalScore ?? 0) + ' / ' + (e.testMaxScore ?? 0),
        numericScore: e.testTotalScore ?? 0,
        level: studentProgressMap.get(e.studentId)?.level || 'لم يحدد',
        studentProgress: studentProgressMap.get(e.studentId)
      };
    });
  }, [testEvaluations, students, halaqas, users, studentProgressMap]);
  
  const weekOptions = useMemo(() => {
    const map = new Map<number, string>();
    testEvaluations.forEach(e => {
        if (!map.has(e.weekNumber)) {
            map.set(e.weekNumber, e.testName || `أسبوع ${e.weekNumber}`);
        }
    });
    const weeks = Array.from(new Map([...map.entries()].sort((a, b) => a[0] - b[0])).entries());
    return weeks.map(([num, name]) => ({ id: String(num), name }));
  }, [testEvaluations]);

  const allWeeks = useMemo(() => ['all', ...weekOptions.map(w => w.id)], [weekOptions]);
  
  const evaluationStatusOptions = [
    {id: TESTED, name: TESTED},
    {id: NOT_TESTED, name: NOT_TESTED}
  ];

  const alAmeenOptions = useMemo(() => [
    { id: 'نعم', name: 'نعم' },
    { id: 'لا', name: 'لا' }
  ], []);

  const ibriOptions = useMemo(() => [
    { id: 'نعم', name: 'نعم' },
    { id: 'لا', name: 'لا' }
  ], []);

  const studentLevelOptionsDetailed = useMemo(() => {
    const levelsSet = new Set<string>();
    studentProgressMap.forEach((progress: any) => {
        if (progress.studentLevel && progress.studentLevel !== '—' && progress.studentLevel !== 'لم يحدد') {
            levelsSet.add(progress.studentLevel);
        }
    });
    return Array.from(levelsSet).map(l => ({id: l, name: l}));
  }, [studentProgressMap]);

  const levelOptionsDetailed = useMemo(() => {
    const levelsSet = new Set<string>();
    studentProgressMap.forEach(progress => {
        if (progress.level && progress.level !== '—' && progress.level !== 'لم يحدد') {
            levelsSet.add(progress.level);
        }
    });
    return Array.from(levelsSet).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
    }).map(l => ({ id: l, name: l }));
  }, [studentProgressMap]);

  const sortedAndFilteredData = useMemo(() => {
    let items: any[] = [];
    const isAllWeeks = selectedWeeks.includes('all') || selectedWeeks.length === 0;

    if (isAllWeeks) {
        items = [...processedEvaluationData];
    } else {
        items = [];
        selectedWeeks.forEach(weekStr => {
            const weekNum = parseInt(weekStr);
            const weekItems = students.map(s => {
                const ev = processedEvaluationData.find(e => Number(e.studentId) === Number(s.id) && e.weekNumber === weekNum);
                if (ev) return ev;
                const studentHalaqa = halaqas.find(h => Number(h.id) === Number(s.halaqaId));
                const studentTeacher = users.find(u => Number(u.id) === Number(studentHalaqa?.teacherId));
                return { 
                  id: `p-${s.id}-${weekNum}`, studentId: s.id, studentName: s.name, 
                  isAlAmeen: s.isAlAmeen, isAlAmeenStr: s.isAlAmeen ? 'نعم' : 'لا', 
                  isFromIbri: s.isFromIbri !== false, isFromIbriStr: (s.isFromIbri !== false) ? 'نعم' : 'لا',
                  halaqaId: s.halaqaId, teacherId: studentHalaqa?.teacherId, 
                  studentOriginalHalaqaId: Number(s.halaqaId),
                  studentOriginalHalaqaName: studentHalaqa?.name || '-',
                  halaqaName: studentHalaqa?.name || '-', evaluatorName: studentTeacher?.name || '—',
                  weekNumber: weekNum, evalStatus: NOT_TESTED, isGuestEvaluation: false, evaluationDate: '—',
                  surahs: [], testFathErrors: '-', testTashkeelErrors: '-', testTajweedErrors: '-', testPassageChanges: '-', testTotalScore: '-',
                  studentProgress: studentProgressMap.get(s.id)
                };
            });
            items.push(...weekItems);
        });
    }

    if (selectedStudentIds.length > 0 && !selectedStudentIds.includes('all')) items = items.filter(i => selectedStudentIds.includes(String(i.studentId)));
    if (selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes('all')) {
        items = items.filter(i => 
            selectedHalaqaIds.includes(String(i.studentOriginalHalaqaId || 0)) || 
            (selectedHalaqaIds.includes('0') && (!i.studentOriginalHalaqaId || i.studentOriginalHalaqaId === -1 || i.studentOriginalHalaqaId === 0))
        );
    }
    if (selectedTeacherIds.length > 0 && !selectedTeacherIds.includes('all')) items = items.filter(i => selectedTeacherIds.includes(String(i.teacherId)));

    if (selectedLevels.length > 0 && !selectedLevels.includes('all')) {
        items = items.filter(i => {
            const level = i.studentProgress?.level || 'لم يحدد';
            return selectedLevels.includes(level);
        });
    }

    if (selectedAlAmeen.length > 0 && !selectedAlAmeen.includes('all')) {
      items = items.filter(i => {
        const val = i.isAlAmeen ? 'نعم' : 'لا';
        return selectedAlAmeen.includes(val);
      });
    }

    if (selectedFromIbri.length > 0 && !selectedFromIbri.includes('all')) {
      items = items.filter(i => {
        const val = (i.isFromIbri !== false) ? 'نعم' : 'لا';
        return selectedFromIbri.includes(val);
      });
    }

    const hasEvalStatusFilter = selectedEvalStatus.length > 0 && !selectedEvalStatus.includes('all');
    if (hasEvalStatusFilter) items = items.filter(i => selectedEvalStatus.includes(i.evalStatus));
    
    if (detailedScoreFilter.mode !== 'all') {
      items = items.filter(i => {
        const scoreToEvaluate = i.evalStatus === TESTED && typeof i.numericScore === 'number' ? i.numericScore : null;
        return matchesScoreFilter(scoreToEvaluate, detailedScoreFilter);
      });
    }
    
    if (sortConfig) {
      items.sort((a, b) => {
        if (sortConfig.key === 'halaqaName' || sortConfig.key === 'studentName') {
            const isHalaqaVisible = selectedColumnKeys.includes('studentOriginalHalaqaName') || selectedColumnKeys.includes('halaqaName');
            if (isHalaqaVisible) {
                const hA = a.halaqaName || '';
                const hB = b.halaqaName || '';
                const halaqaComp = hA.localeCompare(hB, 'ar', { numeric: true });
                if (halaqaComp !== 0) {
                    const direction = sortConfig.key === 'halaqaName' ? sortConfig.direction : 'ascending';
                    return direction === 'ascending' ? halaqaComp : -halaqaComp;
                }
            }
            const sA = a.studentName || '';
            const sB = b.studentName || '';
            const studentComp = sA.localeCompare(sB, 'ar', { numeric: true });
            const direction = sortConfig.key === 'studentName' ? sortConfig.direction : 'ascending';
            return direction === 'ascending' ? studentComp : -studentComp;
        }

        let vA, vB;
        if (sortConfig.key === 'level') {
            vA = getLevelNum(a.level);
            vB = getLevelNum(b.level);
        } else if (sortConfig.key === 'testTotalScore' || sortConfig.key === 'numericScore') {
            vA = a.numericScore ?? 0;
            vB = b.numericScore ?? 0;
        } else {
             vA = a[sortConfig.key];
             vB = b[sortConfig.key];
        }

        let diff = 0;
        if (typeof vA === 'string' && typeof vB === 'string') {
            diff = vA.localeCompare(vB, undefined, { numeric: true, sensitivity: 'base' });
        } else {
            if (vA < vB) diff = -1;
            else if (vA > vB) diff = 1;
        }

        if (diff !== 0) {
            return sortConfig.direction === 'ascending' ? diff : -diff;
        }

        // fallback to level ASC then score DESC
        const levelA = getLevelNum(a.level);
        const levelB = getLevelNum(b.level);
        if (levelA !== levelB) return levelA - levelB;
        
        const scoreA = a.numericScore ?? 0;
        const scoreB = b.numericScore ?? 0;
        return scoreB - scoreA;
      });
    } else {
        items.sort((a, b) => {
            const levelA = getLevelNum(a.level);
            const levelB = getLevelNum(b.level);
            if (levelA !== levelB) return levelA - levelB;
            
            const scoreA = a.numericScore ?? 0;
            const scoreB = b.numericScore ?? 0;
            return scoreB - scoreA;
        });
    }

    const studentRankMap = getLevelRanks(items, item => item.level, item => item.numericScore ?? 0);
    
    return items.map((item, index) => ({ 
        ...item, 
        sequence: index + 1,
        rank: studentRankMap.get(item) 
    }));
  }, [processedEvaluationData, students, halaqas, users, selectedWeeks, selectedStudentIds, selectedHalaqaIds, selectedTeacherIds, selectedEvalStatus, selectedLevels, selectedAlAmeen, selectedFromIbri, detailedScoreFilter, sortConfig, selectedColumnKeys]);

  const exportHeaderInfo = useMemo(() => {
    const isAllWeeks = selectedWeeks.includes('all') || selectedWeeks.length === 0;
    
    let title = "";
    let fileName = "";

    if (isAllWeeks) {
        title = "تقرير جميع الاختبارات";
        fileName = "تقرير_الاختبارات_الشامل";
    } else if (selectedWeeks.length === 1) {
        const weekOption = weekOptions.find(w => w.id === selectedWeeks[0]);
        const testDisplayName = weekOption ? weekOption.name : `أسبوع ${selectedWeeks[0]}`;
        title = `تقرير الأسبوع (${testDisplayName})`;
        fileName = `تقرير_الأسبوع_${testDisplayName.replace(/\s+/g, '_')}`;
    } else if (selectedWeeks.length === 2) {
        title = `تقرير الأسبوعين (${selectedWeeks[0]}، ${selectedWeeks[1]})`;
        fileName = `تقرير_الأسبوعين_${selectedWeeks[0]}_${selectedWeeks[1]}`;
    } else {
        title = `تقرير اختبارات الأسابيع (${selectedWeeks.join('، ')})`;
        fileName = `تقرير_اختبارات_أسابيع_${selectedWeeks.join('_')}`;
    }

    const filters = [];
    if (selectedStudentIds.length > 0 && !selectedStudentIds.includes('all')) filters.push(`الطلاب: ${selectedStudentIds.length} مختار`);
    if (selectedHalaqaIds.length > 0 && !selectedHalaqaIds.includes('all')) filters.push(`الحلقات: ${selectedHalaqaIds.length} مختار`);
    if (selectedTeacherIds.length > 0 && !selectedTeacherIds.includes('all')) filters.push(`المعلمين: ${selectedTeacherIds.length} مختار`);
    if (selectedLevels.length > 0 && !selectedLevels.includes('all')) filters.push(`المستويات: ${selectedLevels.length} مختار`);
    if (detailedScoreFilter.mode !== 'all') filters.push(`تصفية الدرجة: ${getScoreFilterLabel(detailedScoreFilter)}`);
    
    // Hide eval status if all options are selected
    if (selectedEvalStatus.length > 0 && !selectedEvalStatus.includes('all') && selectedEvalStatus.length < evaluationStatusOptions.length) {
        filters.push(`حالة التقييم: ${selectedEvalStatus.join(', ')}`);
    }
    
    return { title, subtitle: filters.length > 0 ? filters.join(' | ') : undefined, fileName };
  }, [selectedWeeks, selectedStudentIds, selectedHalaqaIds, selectedTeacherIds, selectedEvalStatus, selectedLevels, detailedScoreFilter, weekOptions, evaluationStatusOptions]);

  const dynamicHeaders = useMemo(() => {
    const headersMap = new Map(allHeaders.map(h => [h.key, h]));
    const currentOrder = columnOrder.length > 0 ? columnOrder : allHeaders.map(h => h.key);

    const orderedSelected = currentOrder.filter(k => selectedColumnKeys.includes(k) && headersMap.has(k));
    const hasSeq = orderedSelected.includes('sequence');
    const hasNotes = orderedSelected.includes('notes');
    const middle = orderedSelected.filter(k => k !== 'sequence' && k !== 'notes');

    const finalKeys: string[] = [];
    if (hasSeq) finalKeys.push('sequence');
    finalKeys.push(...middle);
    if (hasNotes) finalKeys.push('notes');

    let headers: typeof allHeaders = finalKeys.map(k => headersMap.get(k)!).filter(Boolean) as typeof allHeaders;
    if (sortedAndFilteredData.length > 0) {
        headers = headers.filter((h: any) => sortedAndFilteredData.some(i => !isValueEffectivelyEmpty(i[h.key], h.type)));
    }
    return headers;
  }, [allHeaders, columnOrder, selectedColumnKeys, sortedAndFilteredData]);

  const handleDelete = (id: any) => {
      if (typeof id === 'string' && id.startsWith('p-')) return; 
      setItemToDelete(id);
  };

  const handleEdit = (item: any) => {
      if (typeof item.id === 'string' && item.id.startsWith('p-')) {
          setEditingEvaluation({ ...item, attendance: null });
          return;
      }
      setEditingEvaluation(item);
  };

  const handleUpdateScore = (studentId: number, testName: string, newScore: number | null) => {
    const evaluation = testEvaluations.find(e => 
        (e.studentId === studentId) && 
        (e.testName === testName || (!e.testName && `أسبوع ${e.weekNumber}` === testName))
    );
    
    if (evaluation) {
        if (newScore !== null) {
            context?.updateEvaluation({ ...evaluation, testTotalScore: newScore, evalStatus: TESTED });
        } else {
            context?.deleteEvaluation(evaluation.id);
        }
    } else if (newScore !== null) {
        let weekNum = context?.latestWeek || 1;
        let finalTestName = testName;
        if (testName.startsWith('أسبوع ')) {
            weekNum = parseInt(testName.replace('أسبوع ', '')) || context?.latestWeek || 1;
            finalTestName = '';
        }
        
        const student = students.find(s => s.id === studentId);
        const halaqa = halaqas.find(h => h.id === student?.halaqaId);
        
        context?.addEvaluation({
            studentId,
            halaqaId: student?.halaqaId || 0,
            teacherId: halaqa?.teacherId || 0,
            weekNumber: weekNum,
            isTest: true,
            testName: finalTestName || undefined,
            evalStatus: TESTED,
            testTotalScore: newScore,
            evaluationDate: new Date().toISOString().split('T')[0],
            surahs: [],
            ayahsDetails: '',
        } as any); // using standard defaults
    }
  };

  const handleColorChange = (id: string, color: string | null) => {
    const next = { ...colorMap };
    if (color) next[id] = color;
    else delete next[id];
    setColorMap(next);
  };

  const handleToggleSaveColors = (checked: boolean) => {
      setSaveColors(checked);
  };

  const handleSync = () => {
      if (isCloudSynced) {
          context?.resetCloudSettings();
          setIsCloudSynced(false);
          localStorage.setItem('isCloudSynced', 'false');
      } else {
          context?.syncSettingsToCloud();
          setIsCloudSynced(true);
          localStorage.setItem('isCloudSynced', 'true');
      }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xl dark:bg-gray-800 border border-gray-100 dark:border-gray-700" ref={containerRef}>
      {editingEvaluation && (
          <EvaluationEditForm 
            initialEvaluation={editingEvaluation}
            student={students.find(s => Number(s.id) === Number(editingEvaluation.studentId))!}
            halaqa={halaqas.find(h => Number(h.id) === Number(editingEvaluation.halaqaId))}
            onClose={() => setEditingEvaluation(null)}
            onSave={(v) => { 
                if (typeof v.id === 'string' && (v.id as string).startsWith('p-')) {
                    const newEval = { ...v };
                    delete (newEval as any).id;
                    if (currentUser) newEval.teacherId = currentUser.id;
                    addEvaluation(newEval);
                } else {
                    updateEvaluation(v); 
                }
                setEditingEvaluation(null); 
                showToast('✅ تم تحديث الاختبار بنجاح.'); 
            }}
            onDelete={() => { deleteEvaluation(editingEvaluation.id); setEditingEvaluation(null); showToast('🗑️ تم حذف الاختبار بنجاح.'); }}
          />
      )}

      {itemToDelete && (
          <Modal title="تأكيد حذف الاختبار" onClose={() => setItemToDelete(null)} hideDefaultCloseButton={true}>
              <div className="text-center py-4">
                  <p className="text-lg font-bold mb-6 dark:text-white">هل أنت متأكد من حذف هذا الاختبار؟</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={() => { deleteEvaluation(itemToDelete); setItemToDelete(null); showToast('🗑️ تم حذف الاختبار بنجاح.'); }} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg active:scale-95 text-xl">نعم، حذف</button>
                      <button onClick={() => setItemToDelete(null)} className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-2xl font-bold dark:bg-gray-700 dark:text-gray-200 text-xl">إلغاء</button>
                  </div>
              </div>
          </Modal>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between no-print mb-6 gap-4">
        <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl no-print">
            <button 
                onClick={() => setActiveTab('detailed')} 
                className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${activeTab === 'detailed' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                التقارير التفصيلية
            </button>
            <button 
                onClick={() => setActiveTab('summary')} 
                className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${activeTab === 'summary' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                ملخص الاختبارات
            </button>
            <button 
                onClick={() => setActiveTab('newStudents')} 
                className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'newStudents' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <span>🎓</span>
                <span>الطلاب الجدد</span>
                {newStudentPendingCount > 0 && (
                  <span className="w-5 h-5 bg-amber-500 text-white rounded-full text-[10px] flex items-center justify-center font-black animate-pulse">
                    {newStudentPendingCount}
                  </span>
                )}
            </button>
        </div>

        {activeTab !== 'newStudents' && (
          <>
            <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                {activeTab === 'detailed' ? 'تصفية الاختبارات التفصيلية' : 'تصفية ملخص الاختبارات'}
                </h3>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    إجمالي السجلات:
                </span>
                <span className="text-lg font-black text-indigo-900 dark:text-white">
                    {activeTab === 'detailed' ? sortedAndFilteredData.length : summaryFilteredCount}
                </span>
            </div>
          </>
        )}
      </div>
      
      <div className={activeTab === 'detailed' ? 'block' : 'hidden'}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-3 mb-8 no-print">
              <FilterItem id="student" title="الطالب" selectedValues={selectedStudentIds} options={students.map(s => ({id: s.id, name: s.name}))} onSelect={setSelectedStudentIds} search={studentSearch} setSearch={setStudentSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
              <FilterItem id="halaqa" title="حلقة الطالب" selectedValues={selectedHalaqaIds} options={[{ id: '0', name: 'غير محدد' }, ...[...halaqas].sort((a,b) => a.name.localeCompare(b.name, 'ar', { numeric: true })).map(h => ({id: h.id, name: h.name}))]} onSelect={setSelectedHalaqaIds} search={halaqaSearch} setSearch={setHalaqaSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
              <FilterItem id="teacher" title="المقيم" selectedValues={selectedTeacherIds} options={users.filter(u => u.role === UserRole.TEACHER).map(t => ({id: t.id, name: t.name}))} onSelect={setSelectedTeacherIds} search={teacherSearch} setSearch={setTeacherSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
              <FilterItem id="level" title="المستوى" selectedValues={selectedLevels} options={levelOptionsDetailed} onSelect={setSelectedLevels} search={levelSearch} setSearch={setLevelSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
              <FilterItem id="studentLevel" title="مستوى الطالب" selectedValues={selectedStudentLevels} options={studentLevelOptionsDetailed} onSelect={setSelectedStudentLevels} search={studentLevelSearch} setSearch={setStudentLevelSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
              <FilterItem id="alAmeen" title="من الأمين؟" selectedValues={selectedAlAmeen} options={alAmeenOptions} onSelect={setSelectedAlAmeen} search={alAmeenSearch} setSearch={setAlAmeenSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
              <FilterItem id="fromIbri" title="من جامع عبري؟" selectedValues={selectedFromIbri} options={ibriOptions} onSelect={setSelectedFromIbri} search={fromIbriSearch} setSearch={setFromIbriSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
              <FilterItem id="week" title="اسم الاختبار" selectedValues={selectedWeeks} options={weekOptions} onSelect={setSelectedWeeks} search={weekSearch} setSearch={setWeekSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} />
              <FilterItem id="evalStatus" title="حالة التقييم" selectedValues={selectedEvalStatus} options={evaluationStatusOptions} onSelect={setSelectedEvalStatus} search={evalStatusSearch} setSearch={setEvalStatusSearch} openDropdown={openDropdown} setOpenDropdown={setOpenDropdown} showColorPicker={true} colorMap={colorMap} onColorChange={handleColorChange} saveColors={saveColors} onToggleSaveColors={handleToggleSaveColors} />
              <ScoreFilterDropdown 
                id="detailedScore" 
                title="تصفية الدرجة" 
                config={detailedScoreFilter} 
                onChange={setDetailedScoreFilter} 
                openDropdown={openDropdown} 
                setOpenDropdown={setOpenDropdown} 
                onSortByScore={(dir) => setSortConfig({ key: 'numericScore', direction: dir })}
              />
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6 no-print border-t border-gray-100 dark:border-gray-700 pt-5">
              <button onClick={() => setIsDetailedExcelModalOpen(true)} className="px-3 py-2 text-[10px] font-bold text-white bg-green-600 rounded-lg shadow-sm">Excel</button>
              <button onClick={() => setIsDetailedWordModalOpen(true)} className="px-3 py-2 text-[10px] font-bold text-white bg-blue-600 rounded-lg shadow-sm">Word</button>
              <div className="flex gap-1">
                    <button onClick={() => exportToPdf(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, colorMap, rankColors)} className="px-3 py-2 text-[10px] font-bold text-white bg-red-600 rounded-lg shadow-sm flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        طباعة
                    </button>
                    <button onClick={() => sharePdfDirectly(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, colorMap, rankColors, "landscape")} className="px-3 py-2 text-[10px] font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                        مشاركة PDF
                    </button>
              </div>
              
              <div className="relative inline-block text-right">
                    <button 
                      onClick={() => setShowRankColorsModal(true)} 
                      className="px-3 py-2 text-[10px] font-bold text-gray-700 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-200 rounded-lg shadow-sm flex items-center gap-2"
                    >ألوان المراتب</button>
              </div>

              <div ref={columnPickerRef} className="relative inline-block text-right">
                    <button 
                      onClick={() => setShowColumnPicker(!showColumnPicker)} 
                      className="px-3 py-2 text-[10px] font-bold text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-lg shadow-sm flex items-center gap-2"
                    >الأعمدة</button>
                    {showColumnPicker && (
                        <>
                          <div 
                            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[65] sm:hidden" 
                            onClick={() => setShowColumnPicker(false)} 
                          />
                          <div className="fixed sm:absolute z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0 sm:top-full sm:left-auto sm:right-0 sm:mt-2 w-[92vw] max-w-sm sm:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-fade-in ring-1 ring-black/10 text-right">
                            <div className="flex justify-between items-center mb-3 pb-2 border-b dark:border-gray-700">
                                <span className="text-xs font-black text-green-800 dark:text-green-400">تخصيص وترتيب الأعمدة</span>
                                <button onClick={() => setShowColumnPicker(false)} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </div>
                            <div className="flex gap-2 mb-2 pb-2 border-b dark:border-gray-700">
                                <button onClick={() => setSelectedColumnKeys(allHeaders.map(h => h.key))} className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline flex-1 text-center bg-blue-50 dark:bg-blue-900/30 py-1.5 rounded-lg">إظهار الكل</button>
                                <button onClick={() => setSelectedColumnKeys([])} className="text-[11px] text-red-600 dark:text-red-400 font-bold hover:underline flex-1 text-center bg-red-50 dark:bg-red-900/30 py-1.5 rounded-lg">إخفاء الكل</button>
                            </div>
                            <div className="max-h-[50vh] sm:max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-1 divide-y divide-gray-100 dark:divide-gray-700/40">
                                {(columnOrder.length > 0 ? columnOrder : allHeaders.map(h => h.key)).map((key) => {
                                    const h = allHeaders.find(item => item.key === key);
                                    if (!h) return null;
                                    const isChecked = selectedColumnKeys.includes(h.key);
                                    const currentOrder = columnOrder.length > 0 ? columnOrder : allHeaders.map(item => item.key);
                                    const middleKeys = currentOrder.filter(k => k !== 'sequence' && k !== 'notes');
                                    const middleIdx = middleKeys.indexOf(h.key);
                                    const isFirstMiddle = middleIdx === 0;
                                    const isLastMiddle = middleIdx === middleKeys.length - 1;

                                    return (
                                        <div key={h.key} className="flex items-center justify-between gap-3 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl group transition-colors">
                                            <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                                <input 
                                                  type="checkbox" 
                                                  checked={isChecked} 
                                                  onChange={() => setSelectedColumnKeys(prev => isChecked ? prev.filter(k => k !== h.key) : [...prev, h.key])}
                                                  className="w-4 h-4 rounded text-green-600 border-gray-300 focus:ring-green-500 cursor-pointer flex-shrink-0"
                                                />
                                                <span className={`text-xs font-bold truncate ${isChecked ? 'text-green-950 dark:text-green-200' : 'text-gray-400 dark:text-gray-500'}`}>
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
                                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveColumn(h.key, 'up'); }}
                                                      className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
                                                      title="تقديم للأعلى"
                                                      aria-label="تقديم للأعلى"
                                                    >
                                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                                      </svg>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      disabled={isLastMiddle}
                                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveColumn(h.key, 'down'); }}
                                                      className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/50 dark:hover:text-green-300 disabled:opacity-20 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600 transition-all shadow-xs"
                                                      title="تأخير للأسفل"
                                                      aria-label="تأخير للأسفل"
                                                    >
                                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
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
                                  onClick={handleSaveDetailedAsDefault}
                                  className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                                    isDetailedDefaultSaved 
                                      ? 'bg-emerald-600 text-white' 
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-500/30 active:scale-95'
                                  }`}
                                >
                                  {isDetailedDefaultSaved ? (
                                    <span>✓ تم حفظ الترتيب والتنسيق الافتراضي</span>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                      </svg>
                                      <span>حفظ الترتيب كعرض افتراضي</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleResetDetailedToDefault}
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

          <div className="flex justify-between items-center mb-2 no-print sm:hidden">
              <span className="text-xs text-gray-500 font-bold">مرر يميناً ويساراً لعرض الأعمدة</span>
              <div className="flex gap-2">
                  <button
                      onClick={() => scrollDetailedTable('right')}
                      className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      title="تمرير يمين"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>
                  <button
                      onClick={() => scrollDetailedTable('left')}
                      className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      title="تمرير يسار"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
              </div>
          </div>

          <div className="relative group">
            <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity">
                 <button
                      onClick={() => scrollDetailedTable('right')}
                      className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                      title="تمرير يمين"
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                  </button>
            </div>
            
            <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-20 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity">
                 <button
                      onClick={() => scrollDetailedTable('left')}
                      className="p-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
                      title="تمرير يسار"
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
            </div>

            <div ref={detailedTableScrollRef} className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-gray-100 dark:border-gray-700 custom-scrollbar">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/90 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                  <tr>
                  {dynamicHeaders.map(h => (
                    <th key={h.key} onClick={() => setSortConfig({ key: h.key, direction: sortConfig?.key === h.key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })} className={`px-3 py-4 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase cursor-pointer whitespace-nowrap text-right ${h.key === 'sequence' ? 'w-px !px-2 text-center' : ''}`}>
                      {h.label}
                    </th>
                  ))}
                  <th className="px-3 py-4 text-center text-[10px] font-bold text-gray-500 no-print">العمليات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 dark:bg-gray-800 dark:divide-gray-700">
                {sortedAndFilteredData.map((item: any, idx: number) => {
                  const isPlaceholder = typeof item.id === 'string' && item.id.startsWith('p-');

                  let rowColorStyle: any = {};
                  const isNotTested = item.evalStatus === NOT_TESTED;
                  
                  if (isNotTested && colorMap && colorMap[NOT_TESTED]) {
                      rowColorStyle.color = colorMap[NOT_TESTED];
                  } else if (!isNotTested && colorMap && colorMap[TESTED]) {
                      rowColorStyle.color = colorMap[TESTED];
                  }

                  if (item.rank && rankColors && rankColors.highlightColor) {
                      rowColorStyle.backgroundColor = hexToRgba(rankColors.highlightColor, 0.3);
                  }

                  return (
                    <tr key={item.id} style={rowColorStyle} className={`${idx % 2 === 0 && !rowColorStyle.backgroundColor ? "" : !rowColorStyle.backgroundColor ? "bg-gray-50/20 dark:bg-gray-900/5" : ""} hover:bg-green-50/30 transition-colors group`}>
                      {dynamicHeaders.map(h => {
                        let cellContent;
                        
                        let cellStyle: any = {};
                        if (h.key === 'evalStatus' && item.evalStatus && colorMap[item.evalStatus]) {
                            cellStyle = { backgroundColor: hexToRgba(colorMap[item.evalStatus], 0.15), color: colorMap[item.evalStatus], fontWeight: 'bold' };
                        }
                        if (h.key === 'level' && item.level && colorMap[item.level]) {
                            cellStyle = { ...cellStyle, backgroundColor: hexToRgba(colorMap[item.level], 0.15), color: colorMap[item.level], fontWeight: 'bold' };
                        }

                        if (h.key === 'studentName') {
                          cellContent = (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-black text-indigo-900 dark:text-indigo-100">{item.studentName}</span>
                              {item.isAlAmeen && (
                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold leading-tight">
                                  (من طلاب الأمين)
                                </span>
                              )}
                              {item.studentProgress && (
                                <div className="flex flex-col gap-0.5 text-[9px] font-bold text-gray-500 dark:text-gray-400 leading-tight mt-0.5">
                                  <span>السور: {item.studentProgress.surahs || '—'}</span>
                                  <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded mt-0.5">
                                    <span>{item.studentProgress.juzs ? `الأجزاء: ${item.studentProgress.juzs}` : '—'}</span>
                                    <span className="text-indigo-600 dark:text-indigo-400">{item.studentProgress.level}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        } else if (h.key === 'evaluationDate') {
                          cellContent = (
                            <div className="flex flex-col items-center justify-center w-full mx-auto">
                                {(() => {
                                    const dual = getDualDate(item.evaluationDate, hijriAdjustments);
                                    return dual ? (
                                          <div className="flex flex-col items-center gap-0.5">
                                              <span className="font-extrabold text-green-700 dark:text-green-400 text-[11px] leading-tight">{dual.hijri}</span>
                                              <span className="text-[9px] text-gray-500 font-bold leading-tight">{dual.gregorian}</span>
                                          </div>
                                    ) : <span className="text-[9px] text-gray-500 font-bold">{item.evaluationDate}</span>;
                                })()}
                            </div>
                          );
                        } else if (h.key === 'weekNumber') {
                          cellContent = item.testName || `أسبوع ${item.weekNumber}`;
                        } else {
                          cellContent = renderCell(item[h.key], h.type);
                        }

                        return (
                          <td key={h.key} className={`px-3 py-3.5 whitespace-nowrap text-[10px] sm:text-xs ${isNotTested ? 'text-gray-600 italic' : 'text-gray-900 dark:text-gray-100'} ${h.key === 'sequence' ? 'w-px !px-2 text-center font-bold text-gray-500' : ''}`} style={{ ...rowColorStyle, ...cellStyle }}>
                            {cellContent}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3.5 whitespace-nowrap text-center no-print">
                          <div className="flex justify-center gap-2">
                              <button onClick={() => handleEdit(item)} disabled={isNotTested} className={`p-1.5 rounded-lg transition-colors ${isNotTested ? 'text-gray-300 opacity-50' : 'text-blue-600 hover:bg-blue-50 border border-blue-100'}`} title="تعديل"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                              <button onClick={() => handleDelete(item.id)} disabled={isNotTested} className={`p-1.5 rounded-lg transition-colors ${isNotTested ? 'text-gray-300 opacity-50' : 'text-red-600 hover:bg-red-50 border border-red-100'}`} title="حذف"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                          </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
      </div>
      <div className={activeTab === 'summary' ? 'block' : 'hidden'}>
        <TestsSummaryMatrix 
          data={processedSummaryData} 
          onFilteredCountChange={setSummaryFilteredCount}
          headers={summaryHeaders} 
          rankColors={rankColors} 
          onSortConfigChange={setSortConfig} 
          sortConfig={sortConfig} 
          onOpenRankColorsModal={() => setShowRankColorsModal(true)} 
          colorMap={colorMap} 
          onColorChange={handleColorChange} 
          saveColors={saveColors} 
          onToggleSaveColors={handleToggleSaveColors} 
          manualRanks={manualRanks} 
          setManualRanks={setManualRanks} 
          onUpdateScore={handleUpdateScore} 
          isCloudSynced={isCloudSynced}
          handleSync={handleSync}
          students={students}
          halaqas={halaqas}
          users={users}
          hijriAdjustments={hijriAdjustments}
        />
      </div>

      <div className={activeTab === 'newStudents' ? 'block' : 'hidden'}>
        <NewStudentsTestsTable />
      </div>

      <WordExportModal
        isOpen={isDetailedWordModalOpen}
        onClose={() => setIsDetailedWordModalOpen(false)}
        onExport={(orientation, action) => {
          if (action === 'share-pdf') {
            sharePdfDirectly(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, colorMap, rankColors, orientation);
          } else if (action === 'pdf') {
            exportToPdf(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, exportHeaderInfo.subtitle, hijriAdjustments, colorMap, rankColors);
          } else {
            exportToWord(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, hijriAdjustments, colorMap, rankColors, orientation, action);
          }
        }}
      />
      <ExcelExportModal
        isOpen={isDetailedExcelModalOpen}
        onClose={() => setIsDetailedExcelModalOpen(false)}
        onExport={(orientation, action) => exportToExcel(dynamicHeaders, sortedAndFilteredData, exportHeaderInfo.fileName, exportHeaderInfo.title, hijriAdjustments, colorMap, rankColors, orientation, action)}
      />

      {showRankColorsModal && (
        <Modal
          isOpen={showRankColorsModal}
          onClose={() => setShowRankColorsModal(false)}
          title="تخصيص ألوان المراتب"
        >
          <div className="space-y-4">
            <div className="text-xs text-gray-500 mb-4 dark:text-gray-400">
              اختر الألوان المميزة للمراتب الثلاث الأولى، بالإضافة إلى لون تمييز المراتب الأخرى.
            </div>
            
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">المرتبة الأولى</label>
                    <button 
                        onClick={() => setActiveRankTarget('rank1Color')}
                        className="w-8 h-8 rounded-full border border-gray-200 shadow-sm transition-transform hover:scale-105"
                        style={{ backgroundColor: rankColors.rank1Color || '#D1FAE5' }}
                        title="تغيير اللون"
                    />
                </div>
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">المرتبة الثانية</label>
                    <button 
                        onClick={() => setActiveRankTarget('rank2Color')}
                        className="w-8 h-8 rounded-full border border-gray-200 shadow-sm transition-transform hover:scale-105"
                        style={{ backgroundColor: rankColors.rank2Color || '#DBEAFE' }}
                        title="تغيير اللون"
                    />
                </div>
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">المرتبة الثالثة</label>
                    <button 
                        onClick={() => setActiveRankTarget('rank3Color')}
                        className="w-8 h-8 rounded-full border border-gray-200 shadow-sm transition-transform hover:scale-105"
                        style={{ backgroundColor: rankColors.rank3Color || '#FEF3C7' }}
                        title="تغيير اللون"
                    />
                </div>
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">تمييز المراتب الأخرى</label>
                    <button 
                        onClick={() => setActiveRankTarget('highlightColor')}
                        className="w-8 h-8 rounded-full border border-gray-200 shadow-sm transition-transform hover:scale-105"
                        style={{ backgroundColor: rankColors.highlightColor || '#FEF3C7' }}
                        title="تغيير اللون"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                    onClick={() => setRankColors(defaultRankColors)}
                    className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                    استعادة الافتراضي
                </button>
                <button
                    onClick={() => setShowRankColorsModal(false)}
                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                >
                    إغلاق
                </button>
            </div>
            
            {activeRankTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setActiveRankTarget(null)}>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">اختر لون التمييز</h3>
                        <HexColorPicker 
                            color={
                                activeRankTarget === 'rank1Color' ? (rankColors.rank1Color || '#D1FAE5') : 
                                activeRankTarget === 'rank2Color' ? (rankColors.rank2Color || '#DBEAFE') : 
                                activeRankTarget === 'rank3Color' ? (rankColors.rank3Color || '#FEF3C7') : 
                                (rankColors.highlightColor || '#FEF3C7')
                            } 
                            onChange={(color) => setRankColors({ ...rankColors, [activeRankTarget]: color })} 
                        />
                        <div className="w-full flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">HEX:</span>
                            <input 
                                type="text" 
                                value={
                                    activeRankTarget === 'rank1Color' ? (rankColors.rank1Color || '#D1FAE5') : 
                                    activeRankTarget === 'rank2Color' ? (rankColors.rank2Color || '#DBEAFE') : 
                                    activeRankTarget === 'rank3Color' ? (rankColors.rank3Color || '#FEF3C7') : 
                                    (rankColors.highlightColor || '#FEF3C7')
                                } 
                                onChange={(e) => setRankColors({ ...rankColors, [activeRankTarget]: e.target.value })}
                                onFocus={e => e.target.select()}
                                className="w-full bg-transparent text-sm font-mono text-center text-gray-800 dark:text-gray-200 focus:outline-none uppercase"
                            />
                        </div>
                        <div className="flex gap-2 w-full">
                            <button onClick={() => setActiveRankTarget(null)} className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold text-xs shadow-lg">تم</button>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
