import React, { useState, useRef, useEffect } from 'react';
import { ScoreFilterConfig, ScoreFilterMode } from '../types';

export interface ScoreFilterDropdownProps {
  id: string;
  title?: string;
  config: ScoreFilterConfig;
  onChange: (config: ScoreFilterConfig) => void;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  testOptions?: { id: string; name: string }[];
  showTargetSelector?: boolean;
  passThreshold?: number;
  onSortByScore?: (direction: 'ascending' | 'descending') => void;
}

export const defaultScoreFilterConfig: ScoreFilterConfig = {
  mode: 'all',
  val1: '',
  val2: '',
  targetTest: 'auto',
};

export function matchesScoreFilter(
  score: number | null | undefined,
  config: ScoreFilterConfig,
  passThreshold = 70
): boolean {
  if (!config || config.mode === 'all') return true;

  const hasScore = score !== null && score !== undefined && !isNaN(score) && typeof score === 'number';

  if (config.mode === 'no_score') {
    return !hasScore;
  }

  if (!hasScore) {
    return false;
  }

  const v1 = config.val1 !== undefined && config.val1 !== '' ? Number(config.val1) : NaN;
  const v2 = config.val2 !== undefined && config.val2 !== '' ? Number(config.val2) : NaN;

  switch (config.mode) {
    case 'gte':
      return !isNaN(v1) ? score >= v1 : true;
    case 'gt':
      return !isNaN(v1) ? score > v1 : true;
    case 'lte':
      return !isNaN(v1) ? score <= v1 : true;
    case 'lt':
      return !isNaN(v1) ? score < v1 : true;
    case 'eq':
      return !isNaN(v1) ? Math.abs(score - v1) < 0.05 : true;
    case 'between': {
      const min = !isNaN(v1) ? v1 : -Infinity;
      const max = !isNaN(v2) ? v2 : Infinity;
      return score >= min && score <= max;
    }
    case 'passed': {
      const threshold = !isNaN(v1) && v1 > 0 ? v1 : passThreshold;
      return score >= threshold;
    }
    case 'failed': {
      const threshold = !isNaN(v1) && v1 > 0 ? v1 : passThreshold;
      return score < threshold;
    }
    case 'excellent':
      return score >= 90;
    case 'very_good':
      return score >= 80 && score < 90;
    case 'good':
      return score >= 70 && score < 80;
    default:
      return true;
  }
}

export function getScoreFilterLabel(
  config: ScoreFilterConfig,
  testOptions?: { id: string; name: string }[]
): string {
  if (!config || config.mode === 'all') return 'الكل';

  let targetPrefix = '';
  if (config.targetTest && config.targetTest !== 'auto') {
    if (config.targetTest === 'total') {
      targetPrefix = '(المجموع) ';
    } else {
      const found = testOptions?.find(t => t.id === config.targetTest);
      targetPrefix = `(${found ? found.name : config.targetTest}) `;
    }
  }

  const v1 = config.val1 !== undefined && config.val1 !== '' ? String(config.val1) : '';
  const v2 = config.val2 !== undefined && config.val2 !== '' ? String(config.val2) : '';

  switch (config.mode) {
    case 'gte':
      return `${targetPrefix}≥ ${v1}`;
    case 'gt':
      return `${targetPrefix}> ${v1}`;
    case 'lte':
      return `${targetPrefix}≤ ${v1}`;
    case 'lt':
      return `${targetPrefix}< ${v1}`;
    case 'eq':
      return `${targetPrefix}= ${v1}`;
    case 'between':
      return `${targetPrefix}بين ${v1} و ${v2}`;
    case 'passed':
      return `${targetPrefix}ناجح (≥ ${v1 || 70})`;
    case 'failed':
      return `${targetPrefix}راسب (< ${v1 || 70})`;
    case 'excellent':
      return `${targetPrefix}ممتاز (≥ 90)`;
    case 'very_good':
      return `${targetPrefix}جيد جداً (80-89)`;
    case 'good':
      return `${targetPrefix}جيد (70-79)`;
    case 'no_score':
      return `${targetPrefix}بدون درجة`;
    default:
      return 'الكل';
  }
}

export const ScoreFilterDropdown: React.FC<ScoreFilterDropdownProps> = ({
  id,
  title = 'تصفية وفرز الدرجة',
  config,
  onChange,
  openDropdown,
  setOpenDropdown,
  testOptions = [],
  showTargetSelector = false,
  passThreshold = 70,
  onSortByScore,
}) => {
  const isOpen = openDropdown === id;
  const containerRef = useRef<HTMLDivElement>(null);

  // Local draft state when editing within dropdown
  const [localMode, setLocalMode] = useState<ScoreFilterMode>(config.mode || 'all');
  const [localVal1, setLocalVal1] = useState<string>(
    config.val1 !== undefined && config.val1 !== null ? String(config.val1) : ''
  );
  const [localVal2, setLocalVal2] = useState<string>(
    config.val2 !== undefined && config.val2 !== null ? String(config.val2) : ''
  );
  const [localTargetTest, setLocalTargetTest] = useState<string>(config.targetTest || 'auto');

  // Sync draft when opened or external config changes
  useEffect(() => {
    if (isOpen) {
      setLocalMode(config.mode || 'all');
      setLocalVal1(config.val1 !== undefined && config.val1 !== null ? String(config.val1) : '');
      setLocalVal2(config.val2 !== undefined && config.val2 !== null ? String(config.val2) : '');
      setLocalTargetTest(config.targetTest || 'auto');
    }
  }, [isOpen, config]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setOpenDropdown]);

  const handleApply = (
    modeToApply = localMode,
    val1ToApply = localVal1,
    val2ToApply = localVal2,
    targetToApply = localTargetTest
  ) => {
    onChange({
      mode: modeToApply,
      val1: val1ToApply !== '' ? Number(val1ToApply) : '',
      val2: val2ToApply !== '' ? Number(val2ToApply) : '',
      targetTest: targetToApply,
    });
    setOpenDropdown(null);
  };

  const handleReset = () => {
    setLocalMode('all');
    setLocalVal1('');
    setLocalVal2('');
    setLocalTargetTest('auto');
    onChange(defaultScoreFilterConfig);
    setOpenDropdown(null);
  };

  const isFilterActive = config.mode !== 'all';
  const displayLabel = getScoreFilterLabel(config, testOptions);

  const filterModes: { id: ScoreFilterMode; label: string; icon: string; desc: string }[] = [
    { id: 'all', label: 'الكل (بدون تصفية)', icon: '🔄', desc: 'عرض جميع الطلاب' },
    { id: 'gte', label: 'أكبر من أو يساوي (≥)', icon: '📈', desc: 'مثال: الدرجة 85 فما فوق' },
    { id: 'gt', label: 'أكبر تماماً من (>)', icon: '⬆️', desc: 'مثال: أعلى من 90' },
    { id: 'lte', label: 'أقل من أو يساوي (≤)', icon: '📉', desc: 'مثال: 60 فأقل' },
    { id: 'lt', label: 'أقل تماماً من (<)', icon: '⬇️', desc: 'مثال: أقل من 70' },
    { id: 'between', label: 'بين درجتين (من ... إلى ...)', icon: '↔️', desc: 'مثال: بين 80 و 95' },
    { id: 'eq', label: 'يساوي تماماً (=)', icon: '🎯', desc: 'مثال: 100 كاملة' },
    { id: 'passed', label: 'ناجح / مجتاز (≥ 70)', icon: '✅', desc: 'الطلاب المجتازين للاختبار' },
    { id: 'failed', label: 'راسب / لم يجتز (< 70)', icon: '❌', desc: 'الطلاب الراسبين في الاختبار' },
    { id: 'excellent', label: 'ممتاز (≥ 90)', icon: '🌟', desc: 'الدرجات العالية والمتفوقين' },
    { id: 'very_good', label: 'جيد جداً (80 - 89)', icon: '🥈', desc: 'المستوى الجيد جداً' },
    { id: 'good', label: 'جيد (70 - 79)', icon: '🥉', desc: 'المستوى الجيد' },
    { id: 'no_score', label: 'بدون درجة / لم يختبر', icon: '⚪', desc: 'الطلاب الذين لم ترصد درجاتهم' },
  ];

  const quickPresets = [
    { label: '≥ 90', mode: 'gte' as ScoreFilterMode, val1: 90, val2: '' },
    { label: '≥ 80', mode: 'gte' as ScoreFilterMode, val1: 80, val2: '' },
    { label: '≥ 70 (ناجح)', mode: 'passed' as ScoreFilterMode, val1: 70, val2: '' },
    { label: '< 70 (راسب)', mode: 'failed' as ScoreFilterMode, val1: 70, val2: '' },
    { label: '100 (كاملة)', mode: 'eq' as ScoreFilterMode, val1: 100, val2: '' },
    { label: '80 - 95', mode: 'between' as ScoreFilterMode, val1: 80, val2: 95 },
  ];

  const needsSingleInput = ['gte', 'gt', 'lte', 'lt', 'eq', 'passed', 'failed'].includes(localMode);
  const needsBetweenInput = localMode === 'between';

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] block font-bold text-gray-500 dark:text-gray-400">
          {title}:
        </label>
        {isFilterActive && (
          <button
            onClick={e => {
              e.stopPropagation();
              handleReset();
            }}
            className="text-[9px] font-bold text-red-500 hover:text-red-700 dark:text-red-400 hover:underline flex items-center gap-0.5"
            title="إلغاء تصفية الدرجة"
          >
            <span>إلغاء</span>
            <span>✕</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpenDropdown(isOpen ? null : id)}
        className={`dropdown-button py-2 text-xs h-10 w-full flex justify-between items-center rounded-lg border px-3 transition-all ${
          isFilterActive
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-black shadow-xs ring-1 ring-amber-400/30'
            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-xs">📊</span>
          <span className="truncate">{displayLabel}</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[65] sm:hidden"
            onClick={() => setOpenDropdown(null)}
          />

          {/* Dropdown Container */}
          <div className="fixed sm:absolute z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0 sm:top-full sm:left-auto sm:right-0 sm:mt-2 w-[94vw] max-w-md sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-fade-in ring-1 ring-black/10 text-right space-y-3.5 max-h-[85vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex justify-between items-center pb-2.5 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-sm">
                  📊
                </span>
                <div>
                  <h4 className="text-xs font-black text-gray-900 dark:text-white">
                    تصفية وفرز الطلاب حسب الدرجة
                  </h4>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    حدد شرط المقارنة واكتب الدرجة المطلوبة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenDropdown(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Target Test Selector (if applicable) */}
            {showTargetSelector && testOptions && testOptions.length > 0 && (
              <div className="bg-indigo-50/70 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-800/60 space-y-1.5">
                <label className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                  <span>🎯</span>
                  <span>تطبيق التصفية على:</span>
                </label>
                <select
                  value={localTargetTest}
                  onChange={e => setLocalTargetTest(e.target.value)}
                  className="w-full text-xs font-bold py-1.5 px-2.5 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="auto">
                    🔄 تلقائي (حسب الاختبار المختار بالتصفية، أو المجموع)
                  </option>
                  <option value="total">📊 المجموع الكلي للاختبارات (Total)</option>
                  <optgroup label="الاختبارات الفردية المتاحة:">
                    {testOptions.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Mode Selection */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 block">
                اختر نوع المقارنة / الشرط:
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto custom-scrollbar p-0.5">
                {filterModes.map(m => {
                  const isSelected = localMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setLocalMode(m.id);
                        if (['excellent', 'very_good', 'good', 'no_score', 'all'].includes(m.id)) {
                          // Automatic presets can be applied or drafted
                        } else if (m.id === 'passed' && !localVal1) {
                          setLocalVal1(String(passThreshold || 70));
                        } else if (m.id === 'failed' && !localVal1) {
                          setLocalVal1(String(passThreshold || 70));
                        }
                      }}
                      className={`text-right p-2 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-xs shrink-0">{m.icon}</span>
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input Fields */}
            {needsSingleInput && (
              <div className="bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                    {localMode === 'passed' || localMode === 'failed'
                      ? 'درجة النجاح (الحد الفاصل):'
                      : 'أدخل الدرجة المطلوبة:'}
                  </label>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold">
                    {localVal1 ? `${localVal1} درجة` : 'لم تحدد'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="1000"
                    placeholder="مثال: 85 أو 70 أو 95..."
                    value={localVal1}
                    onChange={e => setLocalVal1(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                  {localVal1 && (
                    <button
                      type="button"
                      onClick={() => setLocalVal1('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {needsBetweenInput && (
              <div className="bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 space-y-2">
                <label className="text-[11px] font-bold text-amber-900 dark:text-amber-200 block">
                  حدد نطاق الدرجة (من ... إلى ...):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block mb-1">
                      من درجة (الحد الأدنى):
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="1000"
                      placeholder="مثال: 80"
                      value={localVal1}
                      onChange={e => setLocalVal1(e.target.value)}
                      className="w-full text-xs font-bold p-2 bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 rounded-lg text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold block mb-1">
                      إلى درجة (الحد الأقصى):
                    </span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="1000"
                      placeholder="مثال: 95"
                      value={localVal2}
                      onChange={e => setLocalVal2(e.target.value)}
                      className="w-full text-xs font-bold p-2 bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 rounded-lg text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Presets Bar */}
            <div>
              <span className="text-[10px] font-bold text-gray-400 block mb-1.5">
                خيارات واختصارات سريعة:
              </span>
              <div className="flex flex-wrap gap-1">
                {quickPresets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setLocalMode(p.mode);
                      setLocalVal1(String(p.val1));
                      setLocalVal2(String(p.val2));
                      handleApply(p.mode, String(p.val1), String(p.val2), localTargetTest);
                    }}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-gray-700 dark:text-gray-300 hover:text-amber-800 dark:hover:text-amber-200 text-[10px] font-bold rounded-md border border-gray-200 dark:border-gray-600 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Sort By Score Buttons */}
            {onSortByScore && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                  ترتيب فوري بالدرجة:
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSortByScore('descending');
                      setOpenDropdown(null);
                    }}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-bold border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                  >
                    <span>⬇️</span>
                    <span>الأعلى أولاً</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSortByScore('ascending');
                      setOpenDropdown(null);
                    }}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-bold border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                  >
                    <span>⬆️</span>
                    <span>الأقل أولاً</span>
                  </button>
                </div>
              </div>
            )}

            {/* Actions / Footer Buttons */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
              <button
                type="button"
                onClick={() => handleApply()}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>✓</span>
                <span>تطبيق التصفية</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition"
              >
                إلغاء التصفية
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ScoreFilterDropdown;
