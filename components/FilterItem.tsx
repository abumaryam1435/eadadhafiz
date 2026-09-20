import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from "react-colorful";
import { isSmartMatch } from '../utils/searchUtils';

export interface FilterItemProps {
  id: string;
  title: string;
  options: any[];
  onSelect: (val: string[]) => void;
  search: string;
  setSearch: (val: string) => void;
  selectedValues: string[]; 
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  showColorPicker?: boolean;
  colorMap?: Record<string, string>;
  onColorChange?: (id: string, color: string | null) => void;
  saveColors?: boolean;
  onToggleSaveColors?: (checked: boolean) => void;
  onSaveColorsClick?: () => void;
  hasSavedColors?: boolean;
  onResetColorsClick?: () => void;
  defaultColorPickerValue?: string;
}

export const FilterItem: React.FC<FilterItemProps> = ({ 
  id, title, options, onSelect, search, setSearch, 
  selectedValues, openDropdown, setOpenDropdown,
  showColorPicker = false, colorMap = {}, onColorChange,
  saveColors = false, onToggleSaveColors, onSaveColorsClick, defaultColorPickerValue = "#059669", hasSavedColors = false, onResetColorsClick
}) => {
  const isOpen = openDropdown === id;
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

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

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (window.innerWidth < 768) {
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250); 
    }
  };

  const isAllSelected = (selectedValues || []).includes('all') || (selectedValues || []).includes('ALL');
  const isEmpty = (selectedValues || []).length === 0;

  let displayLabel = '';
  if (isAllSelected || isEmpty) {
      displayLabel = 'الكل';
  } else if (selectedValues.length === options.length && options.length > 0) {
      displayLabel = 'الكل';
  } else if (selectedValues.length === 1) {
      displayLabel = options.find((o: any) => String(o.id) === String(selectedValues[0]))?.name || selectedValues[0];
  } else {
      displayLabel = `${selectedValues.length} مختار`;
  }

  const handleSelectAll = () => onSelect(options.map((o: any) => String(o.id)));
  const handleDeselectAll = () => onSelect([]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="text-[10px] mb-1 block font-bold text-gray-500 dark:text-gray-400">{title}:</label>
      <button onClick={() => setOpenDropdown(isOpen ? null : id)} className="dropdown-button py-2 text-xs h-10 w-full flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-lg border-gray-200 dark:border-gray-600 dark:text-gray-200 px-3">
        <div className="flex items-center gap-2 truncate">
          {selectedValues.length === 1 && colorMap && colorMap[String(selectedValues[0])] ? (
            <span className="w-3 h-3 rounded-full inline-block shrink-0 shadow-xs ring-1 ring-black/10" style={{ backgroundColor: colorMap[String(selectedValues[0])] }} />
          ) : (showColorPicker && colorMap && Object.keys(colorMap).length > 0 ? (
            <div className="flex items-center -space-x-1 space-x-reverse shrink-0">
              {options.slice(0, 6).map((opt: any) => {
                const col = colorMap[String(opt.id)];
                if (!col) return null;
                const isOptChecked = isAllSelected || isEmpty || (selectedValues || []).includes(String(opt.id));
                return (
                  <span
                    key={opt.id}
                    className={`w-2.5 h-2.5 rounded-full border border-white dark:border-gray-800 shadow-xs inline-block transition-all ${isOptChecked ? 'opacity-100 ring-1 ring-black/10 scale-100' : 'opacity-30 scale-75'}`}
                    style={{ backgroundColor: col }}
                    title={`${opt.name}: ${col}`}
                  />
                );
              })}
            </div>
          ) : null)}
          <span 
            className="truncate font-bold" 
            style={selectedValues.length === 1 && colorMap && colorMap[String(selectedValues[0])] ? { color: colorMap[String(selectedValues[0])] } : {}}
          >
            {displayLabel}
          </span>
        </div>
        <svg className={`h-3 w-3 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-2xl border rounded-xl dark:bg-gray-800 p-2 animate-fade-in ring-1 ring-black/5 dark:ring-white/10 dark:border-gray-700">
          <div className="relative mb-2">
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="بحث..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="w-full p-2 pr-8 text-[10px] rounded-lg border-gray-200 dark:bg-gray-700 dark:border-gray-600 focus:ring-green-500 dark:text-gray-200" 
              onFocus={handleInputFocus}
            />
            <svg className="absolute left-2 top-2.5 h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <div className="flex gap-2 mb-2 px-1">
              <button onClick={handleSelectAll} className="text-[10px] text-blue-600 font-bold hover:underline">تحديد الكل</button>
              <button onClick={handleDeselectAll} className="text-[10px] text-red-600 font-bold hover:underline">إلغاء الكل</button>
          </div>
          <ul className="max-h-48 overflow-y-auto scrollbar-hidden">
            {options.filter((o: any) => isSmartMatch(o.name, search) || (o.stage && isSmartMatch(o.stage, search))).map((o: any) => {
              const strId = String(o.id);
              const isChecked = isAllSelected || (selectedValues || []).includes(strId);
              return (
                <li key={o.id} 
                  className={`dropdown-list-item text-[10px] rounded mb-0.5 flex items-center justify-between gap-2 ${isChecked ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-bold' : 'dark:text-gray-300'}`}
                >
                  <div 
                    onClick={() => { 
                        if (isAllSelected) {
                            const allIds = options.map(opt => String(opt.id));
                            onSelect(allIds.filter(id => id !== strId));
                        } else {
                            if ((selectedValues || []).includes(strId)) {
                                onSelect((selectedValues || []).filter(v => v !== strId));
                            } else {
                                const newVals = [...(selectedValues || []), strId];
                                onSelect(newVals);
                            }
                        }
                    }}
                    className="flex items-center gap-2 flex-grow cursor-pointer p-1 min-w-0"
                  >
                    <input type="checkbox" checked={isChecked} readOnly className="h-3.5 w-3.5 rounded text-green-600 border-gray-300 dark:border-gray-500 dark:bg-gray-700 pointer-events-none shrink-0" />
                    <span className="truncate" style={colorMap && colorMap[String(o.id)] ? { color: colorMap[String(o.id)], fontWeight: 'bold' } : {}}>{o.name}</span>
                    {o.stage && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400 font-normal shrink-0 mr-auto">
                        {o.stage}
                      </span>
                    )}
                  </div>
                  
                  {showColorPicker && onColorChange && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="w-5 h-5 rounded-full border border-gray-200 shadow-sm"
                        style={{ backgroundColor: colorMap[String(o.id)] || defaultColorPickerValue }}
                        onClick={() => setActiveColorPicker(String(o.id))}
                        title="اختر لون لتمييز السجل"
                      />
                      {colorMap[String(o.id)] && (
                        <button 
                          onClick={() => onColorChange(String(o.id), null)}
                          className="text-[9px] text-gray-400 hover:text-red-500 px-1"
                          title="إلغاء التمييز"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {showColorPicker && onToggleSaveColors && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={saveColors} 
                  onChange={(e) => onToggleSaveColors(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-green-600 border-gray-300 dark:border-gray-600 focus:ring-green-500"
                />
                <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">حفظ تنسيق الألوان</span>
              </label>
            </div>
          )}
          {showColorPicker && onSaveColorsClick && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              {hasSavedColors ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdown(null);
                    onResetColorsClick?.();
                  }}
                  className="w-full py-2 bg-red-50 text-red-600 rounded-lg font-bold text-[10px] shadow-sm hover:bg-red-100 transition-colors border border-red-200"
                >
                  إلغاء حفظ التنسيق
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdown(null);
                    onSaveColorsClick();
                  }}
                  className="w-full py-2 bg-green-600 text-white rounded-lg font-bold text-[10px] shadow-sm hover:bg-green-700 transition-colors"
                >
                  حفظ تنسيق الألوان
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {activeColorPicker && showColorPicker && onColorChange && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setActiveColorPicker(null)}>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3 animate-fade-in max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
                <div className="w-full flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">تخصيص لون المرحلة</h3>
                    <button onClick={() => setActiveColorPicker(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>
                
                <HexColorPicker color={colorMap[activeColorPicker] || defaultColorPickerValue} onChange={(color) => onColorChange(activeColorPicker, color)} />

                <div className="w-full">
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 block">ألوان مقترحة:</span>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {[
                      { name: 'أخضر', color: '#059669' },
                      { name: 'أزرق', color: '#2563eb' },
                      { name: 'برتقالي', color: '#ea580c' },
                      { name: 'بنفسجي', color: '#7c3aed' },
                      { name: 'كهرماني', color: '#d97706' },
                      { name: 'سماوي', color: '#0891b2' },
                      { name: 'وردي', color: '#db2777' },
                      { name: 'نيلي', color: '#4f46e5' },
                      { name: 'أحمر', color: '#dc2626' },
                    ].map(swatch => (
                      <button
                        key={swatch.color}
                        type="button"
                        onClick={() => onColorChange(activeColorPicker, swatch.color)}
                        className={`w-6 h-6 rounded-full border-2 shadow-xs transition-transform hover:scale-110 active:scale-95 ${
                          (colorMap[activeColorPicker] || defaultColorPickerValue).toLowerCase() === swatch.color.toLowerCase()
                            ? 'border-black dark:border-white scale-110'
                            : 'border-white dark:border-gray-700'
                        }`}
                        style={{ backgroundColor: swatch.color }}
                        title={swatch.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="w-full flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">HEX:</span>
                    <input 
                        type="text" 
                        value={colorMap[activeColorPicker] || defaultColorPickerValue} 
                        onChange={(e) => onColorChange(activeColorPicker, e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-full bg-transparent text-sm font-mono text-center text-gray-800 dark:text-gray-200 focus:outline-none uppercase"
                    />
                </div>
                <div className="flex gap-2 w-full pt-1">
                    <button onClick={() => setActiveColorPicker(null)} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors">تم واعتماد</button>
                    <button onClick={() => { onColorChange(activeColorPicker, null); setActiveColorPicker(null); }} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs transition-colors">استعادة الافتراضي</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
