import React from 'react';
import { FormattedPoeticVerse } from '../utils/poetryUtils';
import { toArabicDigits } from '../utils/juzUtils';

interface PoeticVerseRowProps {
  verse: FormattedPoeticVerse;
  fontClass: string;
  isHighlighted?: boolean;
  isPrevRange?: boolean;
  layoutMode?: 'columns' | 'stacked';
  showBadge?: boolean;
}

export const PoeticVerseRow: React.FC<PoeticVerseRowProps> = ({
  verse,
  fontClass,
  isHighlighted = false,
  isPrevRange = false,
  layoutMode = 'columns',
  showBadge = true,
}) => {
  const { index, formattedSadr, formattedAjuz, hasAjuz, sadr, ajuz } = verse;

  // في حال تعذر التجزئة لشطرين
  if (!hasAjuz) {
    return (
      <div
        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
          isHighlighted
            ? 'bg-white dark:bg-slate-800 border-emerald-400 dark:border-emerald-600/80 shadow-xs ring-1 ring-emerald-500/20'
            : isPrevRange
            ? 'bg-[#FDF6F0] dark:bg-[#342014]/50 border-[#D4A373] dark:border-[#8B4513]/70 shadow-xs ring-1 ring-[#8B4513]/25 text-[#6B3410] dark:text-[#F3DFD1]'
            : 'bg-white/70 dark:bg-slate-800/40 border-gray-200/80 dark:border-slate-800 text-gray-700 dark:text-gray-300'
        }`}
      >
        <div className="flex items-center gap-3">
          {showBadge && (
            <div className="shrink-0">
              <span
                className={`inline-flex items-center justify-center min-w-[2.2rem] px-2 py-1 rounded-xl text-xs font-black select-none ${
                  isHighlighted
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : isPrevRange
                    ? 'bg-[#8B4513] text-white shadow-2xs'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {toArabicDigits(index)}
              </span>
            </div>
          )}
          <div className="flex-1 text-center font-serif font-bold tracking-wide select-text">
            <p className={fontClass} style={{ wordBreak: 'break-word' }}>
              {formattedSadr || sadr}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3 sm:p-4 rounded-2xl border transition-all ${
        isHighlighted
          ? 'bg-white dark:bg-slate-800 border-emerald-400 dark:border-emerald-600/80 shadow-xs ring-1 ring-emerald-500/20'
          : isPrevRange
          ? 'bg-[#FDF6F0] dark:bg-[#342014]/50 border-[#D4A373] dark:border-[#8B4513]/70 shadow-xs ring-1 ring-[#8B4513]/25 text-[#6B3410] dark:text-[#F3DFD1]'
          : 'bg-white/70 dark:bg-slate-800/40 border-gray-200/80 dark:border-slate-800 text-gray-700 dark:text-gray-300'
      }`}
    >
      <div className="flex items-start sm:items-center gap-2.5 sm:gap-3.5">
        {/* رقم البيت */}
        {showBadge && (
          <div className="shrink-0 pt-0.5 sm:pt-0">
            <span
              className={`inline-flex items-center justify-center min-w-[2.2rem] px-2 py-1 rounded-xl text-xs font-black select-none ${
                isHighlighted
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : isPrevRange
                  ? 'bg-[#8B4513] text-white shadow-2xs'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              {toArabicDigits(index)}
            </span>
          </div>
        )}

        {/* عرض الشطرين: في شاشة الهاتف يظهر شطر في سطر وبدون ❖ بحيث يظهر مكتملاً، وعلى الشاشات الكبيرة يظهر البيت كاملاً في سطر واحد وبينهما ❖ */}
        <div className="flex-1 min-w-0">
          {layoutMode === 'columns' ? (
            /* نمط البيت: على الهاتف يظهر شطر في سطر بدون ❖، وعلى الشاشات الأكبر يظهر البيت كاملاً في سطر واحد مع ❖ في المنتصف */
            <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-3 md:gap-4 w-full">
              {/* الصدر (الشطر الأول) */}
              <div className="w-full sm:flex-1 min-w-0">
                <div
                  className={`font-serif font-bold text-center select-text tracking-normal ${fontClass} ${
                    isHighlighted
                      ? 'text-gray-900 dark:text-gray-50'
                      : isPrevRange
                      ? 'text-[#5C2E0B] dark:text-[#FBEFE3]'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                  style={{
                    wordBreak: 'keep-all',
                    overflowWrap: 'normal',
                    whiteSpace: 'normal',
                  }}
                  title="الصدر"
                >
                  {formattedSadr}
                </div>
              </div>

              {/* فاصل الشطرين الزخرفي المركزي ❖: يظهر فقط عندما يكون البيت كله في سطر واحد على الشاشات الكبيرة، ويختفي تماماً على شاشات الهاتف */}
              <div
                className={`hidden sm:flex shrink-0 select-none px-2 sm:px-3 font-bold text-xs sm:text-sm items-center justify-center ${
                  isPrevRange ? 'text-[#8B4513] dark:text-[#D4A373]' : 'text-emerald-600 dark:text-emerald-400'
                }`}
                aria-hidden="true"
              >
                ❖
              </div>

              {/* العجز (الشطر الثاني) */}
              <div className="w-full sm:flex-1 min-w-0">
                <div
                  className={`font-serif font-bold text-center select-text tracking-normal ${fontClass} ${
                    isHighlighted
                      ? 'text-gray-900 dark:text-gray-50'
                      : isPrevRange
                      ? 'text-[#5C2E0B] dark:text-[#FBEFE3]'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                  style={{
                    wordBreak: 'keep-all',
                    overflowWrap: 'normal',
                    whiteSpace: 'normal',
                  }}
                  title="العجز"
                >
                  {formattedAjuz}
                </div>
              </div>
            </div>
          ) : (
            /* نمط الشطر تحت شطر (Stacked) بدون ❖ */
            <div className="space-y-1.5 sm:space-y-2 w-full">
              {/* الصدر */}
              <div className="w-full text-center font-serif font-bold select-text tracking-normal">
                <div
                  className={`${fontClass} ${
                    isHighlighted
                      ? 'text-gray-900 dark:text-gray-50'
                      : isPrevRange
                      ? 'text-[#5C2E0B] dark:text-[#FBEFE3]'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                  style={{ wordBreak: 'keep-all', whiteSpace: 'normal' }}
                  title="الصدر"
                >
                  {formattedSadr}
                </div>
              </div>

              {/* العجز */}
              <div className="w-full text-center font-serif font-bold select-text tracking-normal">
                <div
                  className={`${fontClass} ${
                    isHighlighted
                      ? 'text-gray-900 dark:text-gray-50'
                      : isPrevRange
                      ? 'text-[#5C2E0B] dark:text-[#FBEFE3]'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                  style={{ wordBreak: 'keep-all', whiteSpace: 'normal' }}
                  title="العجز"
                >
                  {formattedAjuz}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
