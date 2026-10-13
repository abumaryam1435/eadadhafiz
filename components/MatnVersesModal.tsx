import React, { useState, useMemo } from 'react';
import { Matn } from '../types';
import { toArabicDigits, formatRtlRange } from '../utils/juzUtils';
import { formatPoemVerses, FormattedPoeticVerse } from '../utils/poetryUtils';
import { PoeticVerseRow } from './PoeticVerseRow';

interface MatnVersesModalProps {
  isOpen: boolean;
  onClose: () => void;
  matnName: string;
  fromVerse?: number | string | null;
  toVerse?: number | string | null;
  prevFromVerse?: number;
  prevToVerse?: number;
  matns: Matn[];
  studentName?: string;
  errors?: number;
  onUpdateErrors?: (newErrors: number) => void;
}

export const MatnVersesModal: React.FC<MatnVersesModalProps> = ({
  isOpen,
  onClose,
  matnName,
  fromVerse,
  toVerse,
  prevFromVerse,
  prevToVerse,
  matns,
  studentName,
  errors = 0,
  onUpdateErrors,
}) => {
  const [viewMode, setViewMode] = useState<'range' | 'all'>('range');
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [enableTatweel, setEnableTatweel] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<'columns' | 'stacked'>('columns');
  const [searchQuery, setSearchQuery] = useState('');

  const matn = useMemo(() => {
    return matns.find(m => m.name.trim() === matnName.trim());
  }, [matns, matnName]);

  const rawVersesList: string[] = useMemo(() => {
    if (!matn) return [];
    if (matn.verses && Array.isArray(matn.verses) && matn.verses.length > 0) {
      return matn.verses;
    }
    if (matn.linesText) {
      return matn.linesText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
    }
    return [];
  }, [matn]);

  const numFrom = Number(fromVerse) || 1;
  const numTo = Number(toVerse) || (rawVersesList.length > 0 ? rawVersesList.length : Number(fromVerse) || 1);
  
  const displayFrom = prevFromVerse ? Math.min(numFrom, prevFromVerse) : numFrom;
  const displayTo = prevToVerse ? Math.max(numTo, prevToVerse) : numTo;

  // تنسيق وتمديد الأبيات الشعرية بالاعتماد الدائم على أطول شطر في المتن كله بدون كشيدة
  const formattedVerses: FormattedPoeticVerse[] = useMemo(() => {
    if (rawVersesList.length === 0) return [];
    return formatPoemVerses(rawVersesList, {
      enableTatweel,
      startIndex: 1,
      rangeFrom: numFrom,
      rangeTo: numTo,
      prevRangeFrom: prevFromVerse,
      prevRangeTo: prevToVerse
    });
  }, [rawVersesList, enableTatweel, numFrom, numTo, prevFromVerse, prevToVerse, displayFrom, displayTo]);

  const displayedVerses = useMemo(() => {
    if (formattedVerses.length === 0) return [];
    
    let list = formattedVerses;

    if (viewMode === 'range' && displayFrom > 0 && displayTo >= displayFrom) {
      list = list.filter(v => v.inRange || v.isPrevRange);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(v => 
        v.original.toLowerCase().includes(q) || 
        v.sadr.toLowerCase().includes(q) || 
        v.ajuz.toLowerCase().includes(q) || 
        v.index.toString().includes(q) ||
        toArabicDigits(v.index).includes(q)
      );
    }

    return list;
  }, [formattedVerses, viewMode, numFrom, numTo, searchQuery]);

  if (!isOpen) return null;

  const fontClass = 
    fontSize === 'normal' ? 'text-sm sm:text-base leading-loose' :
    fontSize === 'large' ? 'text-base sm:text-lg md:text-xl leading-[2.4rem]' :
    'text-lg sm:text-xl md:text-2xl leading-[2.8rem]';

  return (
    <div 
      className="fixed inset-0 z-[10000] flex justify-center items-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      {/* الخلفية المعتمة */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* نافذة المحتوى العريضة لتستوعب شطري البيت بتناسق وتوازٍ تام */}
      <div 
        className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[94dvh] border border-gray-100 dark:border-slate-800 z-10 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* شريط الرأس */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 border-b border-gray-200 dark:border-slate-800 bg-emerald-50/80 dark:bg-emerald-950/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-lg font-black text-gray-900 dark:text-gray-100 truncate">
                  {matnName}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100/90 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-bold border border-emerald-300 dark:border-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  <span>الأبيات: ({toArabicDigits(numFrom)} - {toArabicDigits(numTo)})</span>
                </span>
                {prevFromVerse !== undefined && prevToVerse !== undefined && prevToVerse >= prevFromVerse && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FDF6F0] dark:bg-[#342014]/80 text-[#8B4513] dark:text-[#FBEFE3] rounded-md sm:rounded-lg text-[11px] sm:text-xs font-bold border border-[#D4A373] dark:border-[#8B4513]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B4513]"></span>
                    <span>سابق: ({formatRtlRange(`${prevFromVerse} - ${prevToVerse}`)})</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {onUpdateErrors && (
              <button
                type="button"
                onClick={() => onUpdateErrors((errors || 0) + 1)}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-700/80 rounded-xl transition-all active:scale-95 shadow-2xs"
                title="تسجيل خطأ (+1)"
              >
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                  {toArabicDigits(errors)}
                </span>
                <span className="text-[11px] sm:text-xs font-black text-rose-900 dark:text-rose-200">
                  أخطاء (+1)
                </span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
              aria-label="إغلاق"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* أدوات التحكم والتبديل والتنسيق */}
        {rawVersesList.length > 0 && (
          <div className="p-2.5 sm:p-3 bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0">
            {/* أزرار التبديل بين نطاق التقييم وكامل المتن */}
            <div className="flex bg-white dark:bg-slate-700 p-0.5 sm:p-1 rounded-xl border border-gray-200 dark:border-slate-600 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('range')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold transition-all text-xs ${
                  viewMode === 'range'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
              >
                {prevFromVerse !== undefined && prevToVerse !== undefined && prevToVerse >= prevFromVerse
                  ? `أبيات التقييم والمحفوظ السابق (${formatRtlRange(`${displayFrom} - ${displayTo}`)})`
                  : `أبيات التقييم (${formatRtlRange(`${numFrom} - ${numTo}`)})`}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold transition-all text-xs ${
                  viewMode === 'all'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                }`}
              >
                كامل المتن ({toArabicDigits(rawVersesList.length)} بيت)
              </button>
            </div>

            {/* أدوات التحكم الجمالية: نمط العرض، حجم الخط */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* زر التبديل بين عرض عمودين متقابلين ومكدس */}
              <div className="hidden sm:flex bg-white dark:bg-slate-700 p-0.5 rounded-xl border border-gray-200 dark:border-slate-600 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setLayoutMode('columns')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    layoutMode === 'columns'
                      ? 'bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100 font-black'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                  title="عرض الشطرين في عمودين متقابلين"
                >
                  عمودين
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('stacked')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    layoutMode === 'stacked'
                      ? 'bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-gray-100 font-black'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                  title="عرض الشطرين مكدسين رأسياً"
                >
                  مكدس
                </button>
              </div>

              {/* أزرار تغيير حجم الخط */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-white dark:bg-slate-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-xl border border-gray-200 dark:border-slate-600 shadow-2xs">
                <span className="text-gray-500 dark:text-gray-400 font-bold ml-1 hidden xs:inline">الخط:</span>
                <button
                  type="button"
                  onClick={() => setFontSize('normal')}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-md font-bold text-xs ${fontSize === 'normal' ? 'bg-gray-200 dark:bg-slate-600 font-black text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  عادي
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('large')}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-md font-bold text-xs ${fontSize === 'large' ? 'bg-gray-200 dark:bg-slate-600 font-black text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  كبير
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('xlarge')}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-md font-bold text-xs ${fontSize === 'xlarge' ? 'bg-gray-200 dark:bg-slate-600 font-black text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  أكبر
                </button>
              </div>
            </div>
          </div>
        )}

        {/* شريط توضيحي لطيف يعلن عن التوازي الجمالي */}
        {rawVersesList.length > 0 && (
          <div className="hidden sm:flex items-center justify-between px-6 py-1.5 bg-gray-100/70 dark:bg-slate-800/90 border-b border-gray-200/80 dark:border-slate-800 text-[11px] font-bold text-gray-500 dark:text-gray-400">
            <div className="w-10">الرقم</div>
            <div className="flex-1 text-center">الصدر (الشطر الأول)</div>
            <div className="w-8 text-center">❖</div>
            <div className="flex-1 text-center">العجز (الشطر الثاني)</div>
          </div>
        )}

        {/* جسم النافذة وقائمة الأبيات المنسقة */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5 custom-scrollbar bg-gray-50/50 dark:bg-slate-900/50">
          {rawVersesList.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-amber-300 dark:border-amber-700/60">
              <div className="w-14 h-14 mx-auto mb-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <h4 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">
                نصوص أبيات هذا المتن غير مضافة حتى الآن
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                لم يتم لصق نصوص أبيات متن <span className="font-bold text-emerald-700 dark:text-emerald-400">({matnName})</span> في صفحة المشرف بعد.
                يمكن للمشرف الدخول إلى تبويب <span className="font-bold">إدارة المتون</span> ولصق الأبيات لتظهر لك هنا مباشرة أثناء التقييم بتنسيق الصدر والعجز المتوازي.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800">
                <span>المطلوب تسميعه: من البيت ({toArabicDigits(numFrom)}) إلى ({toArabicDigits(numTo)})</span>
              </div>
            </div>
          ) : displayedVerses.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              لا توجد أبيات مطابقة للبحث.
            </div>
          ) : (
            <div className="space-y-2">
              {displayedVerses.map(v => (
                <PoeticVerseRow
                  key={v.index}
                  verse={v}
                  fontClass={fontClass}
                  isHighlighted={v.inRange}
                  isPrevRange={v.isPrevRange}
                  layoutMode={layoutMode}
                  showBadge={true}
                />
              ))}
            </div>
          )}
        </div>

        {/* تذييل النافذة مع شريط رصد وتحديد الأخطاء التفاعلي */}
        <div className="p-2.5 sm:p-3.5 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          {/* قسم رصد وتحديد الأخطاء أثناء عرض الأبيات */}
          {onUpdateErrors ? (
            <div className="flex-1 flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
              {/* زر النقر المخصص لعد الأخطاء - حجم ثابت لا يتغير */}
              <div
                onClick={() => onUpdateErrors((errors || 0) + 1)}
                className="w-full sm:w-64 flex items-center justify-between bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-950/50 dark:to-red-950/40 rounded-xl border-2 border-rose-300 dark:border-rose-700/80 shadow-2xs overflow-hidden group cursor-pointer hover:border-rose-500 dark:hover:border-rose-500 active:scale-[0.98] transition-all h-11 sm:h-12 px-3 shrink-0"
                title="انقر لتسجيل خطأ (+1)"
              >
                <div className="flex items-center gap-2 select-none min-w-0">
                  <span className="text-xs sm:text-sm font-black bg-rose-600 text-white px-2 py-0.5 rounded-lg shadow-2xs shrink-0">+1</span>
                  <span className="text-xs sm:text-sm font-black text-rose-950 dark:text-rose-100 group-hover:text-rose-700 truncate">
                    أخطاء المتن
                  </span>
                </div>

                {/* حقل الإدخال العددي أو التعديل المباشر */}
                <div className="shrink-0 flex items-center">
                  <div className="w-12 h-8 sm:h-9 rounded-lg bg-white dark:bg-gray-900 border-2 border-rose-400 dark:border-rose-500 shadow-2xs flex items-center justify-center overflow-hidden">
                    <input
                      onClick={(e) => e.stopPropagation()}
                      type="number"
                      min="0"
                      value={errors === 0 ? '' : errors}
                      placeholder="0"
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        onUpdateErrors(val);
                      }}
                      onFocus={e => e.target.select()}
                      className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-rose-600 dark:text-rose-400 focus:text-rose-700 border-0 outline-none p-0 m-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-300"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400 font-bold">
              {rawVersesList.length > 0 && (
                <span>المعروض: {toArabicDigits(displayedVerses.length)} من أصل {toArabicDigits(rawVersesList.length)} بيتاً</span>
              )}
            </div>
          )}

          {/* زر الإغلاق */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 sm:px-6 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>تم</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
