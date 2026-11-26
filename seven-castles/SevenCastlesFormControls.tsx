import React, { useState } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Repeat,
  FileText,
} from 'lucide-react';
import { DailyAmount, PageRange } from './types';
import {
  ARABIC_WEEKDAYS,
  JUZ_PAGES,
  formatOldMemorizationSummary,
  getSevenCastlesPortionsTable,
  parsePlanDate,
} from './sevenCastlesGenerator';
import { getHijriDate } from './utils/dateHelpers';
import { SevenCastlesPdfStyle } from './sevenCastlesPdfExporter';

export function getNearestDateForWeekday(
  targetDay: number,
  baseDate: Date = new Date()
): string {
  const start = startOfDay(baseDate);
  const diff = (targetDay - start.getDay() + 7) % 7;
  return format(addDays(start, diff), 'yyyy-MM-dd');
}

function getClosestMatchingDate(targetDay: number, selectedDate: Date): string {
  const selected = startOfDay(selectedDate);
  const today = startOfDay(new Date());
  const forwardDiff = (targetDay - selected.getDay() + 7) % 7 || 7;
  const backwardDiff = (selected.getDay() - targetDay + 7) % 7 || 7;
  const forwardDate = addDays(selected, forwardDiff);
  const backwardDate = addDays(selected, -backwardDiff);
  if (backwardDiff < forwardDiff && backwardDate >= today) {
    return format(backwardDate, 'yyyy-MM-dd');
  }
  return format(forwardDate, 'yyyy-MM-dd');
}

/**
 * الإعدادات المشتركة لتبويب المشرف (تُطبَّق على جميع الطلاب عند توليد الخطط)
 */
export interface SevenCastlesSharedSettings {
  firstDayOfWeek: number; // 0 = الأحد ... 6 = السبت
  startDate: string; // 'YYYY-MM-DD'
  dailyFixationRepetitions: number; // تكرار التثبيت للحفظ الجديد (اليوم 1، 2، 4، 5)
  weeklyReviewRepetitions: number; // تكرار التثبيت والمراجعة في اليوم 3 و 6
  pdfStyle: SevenCastlesPdfStyle; // 'castle_towers' | 'standard'
}

/**
 * الإعدادات الخاصة بكل طالب (تظهر لكل طالب بدون إعادة إدخال الحفظ القديم)
 */
export interface StudentSevenCastlesConfig {
  dailyAmount: DailyAmount;
  sevenCastlesStartMode: 'juz' | 'page';
  juzNumber: number;
  startPage: number;
  isSevenCastlesDescending: boolean;
}

interface SharedSettingsBarProps {
  settings: SevenCastlesSharedSettings;
  onChange: (next: SevenCastlesSharedSettings) => void;
}

/**
 * شريط الإعدادات المشتركة أعلى تبويب "خطط القلاع السبع" في صفحة المشرف:
 * - تحديد يوم البدء وتاريخ البدء (مع عرض التاريخ الهجري تلقائياً)
 * - تحديد عدد مرات التثبيت للحفظ الجديد (اليوم 1، 2، 4، 5)
 * - تحديد عدد مرات التثبيت والمراجعة لليوم الثالث والسادس
 * - اختيار قالب الـ PDF (ملف الأبراج الأفقي / الجدول العادي العمودي)
 */
export const SevenCastlesSharedSettingsBar: React.FC<SharedSettingsBarProps> = ({
  settings,
  onChange,
}) => {
  const parsedStartDate = parsePlanDate(settings.startDate);
  const selectedDateDay = parsedStartDate.getDay();
  const isDateMismatch = selectedDateDay !== settings.firstDayOfWeek;
  const expectedDayName =
    ARABIC_WEEKDAYS.find((d) => d.value === settings.firstDayOfWeek)?.label || 'الجمعة';
  const selectedDayName =
    ARABIC_WEEKDAYS.find((d) => d.value === selectedDateDay)?.label || '';

  const handleWeekdayChange = (newDay: number) => {
    const nearestDate = getNearestDateForWeekday(newDay);
    onChange({
      ...settings,
      firstDayOfWeek: newDay,
      startDate: nearestDate,
    });
  };

  const handleStartDateChange = (newDate: string) => {
    if (!newDate) return;
    onChange({
      ...settings,
      startDate: newDate,
    });
  };

  const handleAutoFixStartDate = () => {
    const closestDate = getClosestMatchingDate(settings.firstDayOfWeek, parsedStartDate);
    onChange({
      ...settings,
      startDate: closestDate,
    });
  };

  return (
    <div
      dir="rtl"
      className="bg-white dark:bg-[#1A1A1A] border border-[#1A2E1A]/10 dark:border-white/10 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#1A2E1A] dark:text-white">
              إعدادات خطة القلاع السبع المشتركة للطلاب
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              يُحدَّد يوم وتاريخ البدء وعدد مرات التثبيت هنا وتُطبَّق تلقائياً عند تصدير أو مشاركة خطة كل طالب
            </p>
          </div>
        </div>

        {/* PDF Style Switcher */}
        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-200/70 dark:border-white/10">
          <button
            type="button"
            onClick={() => onChange({ ...settings, pdfStyle: 'castle_towers' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              settings.pdfStyle === 'castle_towers'
                ? 'bg-[#1A2E1A] dark:bg-[#D4AF37] text-white dark:text-[#1A1A1A] shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ملف الأبراج (أفقي)</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...settings, pdfStyle: 'standard' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              settings.pdfStyle === 'standard'
                ? 'bg-[#1A2E1A] dark:bg-[#D4AF37] text-white dark:text-[#1A1A1A] shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>الجدول العادي (عمودي)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Start Weekday (Before Date) */}
        <div className="p-3.5 bg-gray-50 dark:bg-white/5 rounded-2xl space-y-1.5">
          <label className="text-xs font-bold text-gray-600 dark:text-gray-300 block">
            يوم البدء في الأسبوع
          </label>
          <select
            value={settings.firstDayOfWeek}
            onChange={(e) => handleWeekdayChange(Number(e.target.value))}
            className="w-full bg-white dark:bg-[#141414] dark:text-white border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-[#D4AF37] outline-none cursor-pointer"
          >
            {ARABIC_WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <div className="text-[10px] text-gray-400">
            يضبط التاريخ تلقائياً إلى أقرب يوم {expectedDayName}
          </div>
        </div>

        {/* Start Date (After Weekday) */}
        <div
          className={`p-3.5 rounded-2xl space-y-1.5 transition-colors ${
            isDateMismatch
              ? 'bg-rose-50/80 dark:bg-rose-950/25 border border-rose-300 dark:border-rose-700/60'
              : 'bg-gray-50 dark:bg-white/5'
          }`}
        >
          <label className="text-xs font-bold text-gray-600 dark:text-gray-300 block">
            تاريخ بدء الخطة
          </label>
          <input
            type="date"
            value={settings.startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className={`w-full bg-white dark:bg-[#141414] dark:text-white border rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 outline-none ${
              isDateMismatch
                ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-400'
                : 'border-gray-200 dark:border-white/10 focus:ring-[#D4AF37]'
            }`}
          />
          <div className="text-[10.5px] font-bold text-amber-700 dark:text-[#D4AF37]">
            هجري: {getHijriDate(parsedStartDate)}
          </div>
        </div>

        {/* Daily Fixation Repetitions (Days 1, 2, 4, 5) */}
        <div className="p-3.5 bg-gray-50 dark:bg-white/5 rounded-2xl flex flex-col justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-[#1A2E1A] dark:text-white flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-emerald-600" />
              تكرار التثبيت للحفظ الجديد
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">
              لليوم الأول والثاني والرابع والخامس
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...settings,
                  dailyFixationRepetitions: Math.max(
                    1,
                    settings.dailyFixationRepetitions - 1
                  ),
                })
              }
              className="w-8 h-8 rounded-full bg-white dark:bg-[#2C2C2C] shadow flex items-center justify-center text-[#1A2E1A] dark:text-white active:scale-95 text-sm font-bold border border-gray-100 dark:border-transparent"
            >
              -
            </button>
            <input
              type="number"
              min={1}
              value={settings.dailyFixationRepetitions}
              onChange={(e) =>
                onChange({
                  ...settings,
                  dailyFixationRepetitions: Math.max(
                    1,
                    parseInt(e.target.value, 10) || 1
                  ),
                })
              }
              onFocus={(e) => e.target.select()}
              className="text-base font-extrabold dark:text-white w-12 text-center bg-transparent border-none p-0 focus:ring-0"
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...settings,
                  dailyFixationRepetitions: settings.dailyFixationRepetitions + 1,
                })
              }
              className="w-8 h-8 rounded-full bg-white dark:bg-[#2C2C2C] shadow flex items-center justify-center text-[#1A2E1A] dark:text-white active:scale-95 text-sm font-bold border border-gray-100 dark:border-transparent"
            >
              +
            </button>
          </div>
        </div>

        {/* Weekly Review/Fixation Repetitions (Days 3 & 6) */}
        <div className="p-3.5 bg-gray-50 dark:bg-white/5 rounded-2xl flex flex-col justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-[#1A2E1A] dark:text-white flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-amber-600" />
              تكرار التثبيت والمراجعة (اليوم 3 و 6)
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">
              لتثبيت وتسميع محفوظ اليومين السابقين
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...settings,
                  weeklyReviewRepetitions: Math.max(
                    1,
                    settings.weeklyReviewRepetitions - 1
                  ),
                })
              }
              className="w-8 h-8 rounded-full bg-white dark:bg-[#2C2C2C] shadow flex items-center justify-center text-[#1A2E1A] dark:text-white active:scale-95 text-sm font-bold border border-gray-100 dark:border-transparent"
            >
              -
            </button>
            <input
              type="number"
              min={1}
              value={settings.weeklyReviewRepetitions}
              onChange={(e) =>
                onChange({
                  ...settings,
                  weeklyReviewRepetitions: Math.max(
                    1,
                    parseInt(e.target.value, 10) || 1
                  ),
                })
              }
              onFocus={(e) => e.target.select()}
              className="text-base font-extrabold dark:text-white w-12 text-center bg-transparent border-none p-0 focus:ring-0"
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...settings,
                  weeklyReviewRepetitions: settings.weeklyReviewRepetitions + 1,
                })
              }
              className="w-8 h-8 rounded-full bg-white dark:bg-[#2C2C2C] shadow flex items-center justify-center text-[#1A2E1A] dark:text-white active:scale-95 text-sm font-bold border border-gray-100 dark:border-transparent"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Date/Weekday Mismatch Alert */}
      {isDateMismatch && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-right">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-extrabold text-rose-800 dark:text-rose-200">
                تنبيه: يجب أن تبدأ الخطة في أول يوم من الأسبوع ({expectedDayName})!
              </p>
              <p className="text-[11px] sm:text-xs font-bold text-rose-700/90 dark:text-rose-300/90 leading-relaxed">
                التاريخ المحدد يوافق يوم ({selectedDayName}). خطة الحفظ لا يمكن أن تبدأ من وسط الأسبوع.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAutoFixStartDate}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer text-center"
          >
            ✦ اضبط التاريخ تلقائياً إلى أقرب يوم {expectedDayName}
          </button>
        </div>
      )}
    </div>
  );
};

interface StudentConfigFormProps {
  studentName: string;
  /** نطاقات الحفظ القديم المسجلة مسبقاً في بيانات الطالب (تدعم أكثر من نطاق) */
  oldMemorizationRanges?: PageRange[];
  oldMemorizedPages?: number[];
  config: StudentSevenCastlesConfig;
  startDate: string;
  onChange: (next: StudentSevenCastlesConfig) => void;
  showSystemInfo?: boolean;
}

/**
 * استمارة إعداد خطة القلاع السبع للطالب — مطابقة تماماً لاستمارة التطبيق الأصلي،
 * مع سحب الحفظ القديم للطالب تلقائياً (دون الحاجة لإعادة إدخاله).
 */
export const StudentSevenCastlesConfigForm: React.FC<StudentConfigFormProps> = ({
  studentName,
  oldMemorizationRanges,
  oldMemorizedPages,
  config,
  startDate,
  onChange,
  showSystemInfo = true,
}) => {
  const [showInfo, setShowInfo] = useState(false);

  const oldSummary = formatOldMemorizationSummary(
    oldMemorizationRanges,
    oldMemorizedPages
  );

  const dailyAmountOptions = [
    {
      id: DailyAmount.JUZ_PER_PLAN,
      label: 'جزء لكل خطة (مقسم بالسور - للأجزاء ٢٨، ٢٩، ٣٠)',
      desc:
        config.juzNumber === 28
          ? 'يتم حفظ سورة كاملة كل أسبوع (٤ أيام حفظ) عبر ٦ قلاع خلال ٩ أسابيع'
          : config.juzNumber === 30
            ? 'يتم تقسيم سور جزء عمّ على ٤ أيام حفظ أسبوعياً عبر ٦ قلاع خلال ٩ أسابيع'
            : 'يتم حفظ سورة كاملة كل أسبوع (٤ أيام حفظ) عبر ٧ قلاع خلال ١١ أسبوعاً',
    },
    {
      id: DailyAmount.QUARTER_PAGE,
      label: 'ربع صفحة',
      desc: 'يستغرق الجزء حوالي 20 أسبوعاً',
    },
    {
      id: DailyAmount.HALF_PAGE,
      label: 'نصف صفحة',
      desc: 'يستغرق الجزء حوالي 10 أسابيع',
    },
    {
      id: DailyAmount.ONE_PAGE,
      label: 'صفحة واحدة',
      desc: 'يستغرق الجزء حوالي 5 أسابيع',
    },
    {
      id: DailyAmount.TWO_PAGES,
      label: 'صفحتان',
      desc: 'يستغرق الجزء حوالي 3 أسابيع',
    },
    {
      id: DailyAmount.QUARTER_HIZB,
      label: 'ربع حزب',
      desc: 'يستغرق الجزء حوالي أسبوعين ونصف',
    },
    {
      id: DailyAmount.THREE_PAGES,
      label: '3 صفحات',
      desc: 'يستغرق الجزء حوالي أسبوعين',
    },
    {
      id: DailyAmount.FOUR_PAGES,
      label: '4 صفحات',
      desc: 'يستغرق الجزء حوالي أسبوع وربع',
    },
    {
      id: DailyAmount.FIVE_PAGES,
      label: '5 صفحات',
      desc: 'يستغرق الجزء أسبوعاً واحداً',
    },
  ];

  const selectedOption = dailyAmountOptions.find(
    (o) => o.id === config.dailyAmount
  );

  const handleJuzSelect = (juzNum: number) => {
    const range = JUZ_PAGES[juzNum];
    const nextStartPage = range
      ? config.isSevenCastlesDescending
        ? range.end
        : range.start
      : config.startPage;
    onChange({
      ...config,
      juzNumber: juzNum,
      startPage: nextStartPage,
    });
  };

  const handleDirectionChange = (isDescending: boolean) => {
    let nextStartPage = config.startPage;
    if (
      config.sevenCastlesStartMode === 'juz' ||
      config.dailyAmount === DailyAmount.JUZ_PER_PLAN
    ) {
      const range = JUZ_PAGES[config.juzNumber];
      if (range) {
        nextStartPage = isDescending ? range.end : range.start;
      }
    }
    onChange({
      ...config,
      isSevenCastlesDescending: isDescending,
      startPage: nextStartPage,
    });
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* Student's Automatic Old Memorization Summary (Read-Only) */}
      <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/30 flex items-start gap-2.5">
        <BookOpen className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <div className="font-extrabold text-amber-900 dark:text-amber-200">
            الحفظ القديم المسجل للطالب ({studentName}):
          </div>
          <div className="text-amber-800 dark:text-amber-300 font-bold mt-0.5">
            {oldSummary}
          </div>
          <div className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
            تُستثنى صفحات الحفظ القديم تلقائياً من الحفظ الجديد وتُوزَّع على ورد المراجعة اليومي
          </div>
        </div>
      </div>

      {/* Daily Amount */}
      <div className="space-y-2">
        <label className="text-sm font-bold block dark:text-white">
          مقدار الحفظ اليومي
        </label>
        <select
          value={config.dailyAmount}
          onChange={(e) => {
            const val = e.target.value as DailyAmount;
            const nextJuz =
              val === DailyAmount.JUZ_PER_PLAN &&
              (config.juzNumber < 28 || config.juzNumber > 30)
                ? 29
                : config.juzNumber;
            const range = JUZ_PAGES[nextJuz];
            onChange({
              ...config,
              dailyAmount: val,
              sevenCastlesStartMode:
                val === DailyAmount.JUZ_PER_PLAN
                  ? 'juz'
                  : config.sevenCastlesStartMode,
              juzNumber: nextJuz,
              startPage:
                val === DailyAmount.JUZ_PER_PLAN && range
                  ? config.isSevenCastlesDescending
                    ? range.end
                    : range.start
                  : config.startPage,
            });
          }}
          className="w-full py-2.5 px-3.5 bg-gray-50 dark:bg-[#1A1A1A] border border-amber-500/25 dark:border-white/10 rounded-xl text-xs font-extrabold text-[#1A2E1A] dark:text-[#D4AF37] cursor-pointer focus:ring-2 focus:ring-[#D4AF37]/50 hover:border-amber-500/40 outline-none transition-all shadow-sm"
        >
          {dailyAmountOptions.map((option) => (
            <option
              key={option.id}
              value={option.id}
              className="dark:bg-[#1C1C1E] font-medium text-xs sm:text-sm"
            >
              {option.label}
            </option>
          ))}
        </select>
        {selectedOption && (
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium px-1">
            {selectedOption.desc}
          </div>
        )}
      </div>

      {/* Start Mode (Juz vs Page) - Hidden for JUZ_PER_PLAN */}
      {config.dailyAmount !== DailyAmount.JUZ_PER_PLAN && (
        <div className="space-y-2.5 p-3.5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
          <label className="text-xs font-bold block dark:text-white">
            طريقة تحديد بداية الخطة
          </label>
          <div className="flex bg-white dark:bg-[#1A1A1A] p-1 rounded-xl border border-gray-100 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                const range = JUZ_PAGES[config.juzNumber];
                onChange({
                  ...config,
                  sevenCastlesStartMode: 'juz',
                  startPage: range
                    ? config.isSevenCastlesDescending
                      ? range.end
                      : range.start
                    : config.startPage,
                });
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                config.sevenCastlesStartMode === 'juz'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-500'
              }`}
            >
              بالأجزاء (جزء البدء)
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({ ...config, sevenCastlesStartMode: 'page' })
              }
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                config.sevenCastlesStartMode === 'page'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-500'
              }`}
            >
              بالصفحات (صفحة البدء)
            </button>
          </div>
        </div>
      )}

      {/* Juz Selection */}
      {(config.sevenCastlesStartMode === 'juz' ||
        config.dailyAmount === DailyAmount.JUZ_PER_PLAN) && (
        <div className="space-y-2.5">
          <label className="text-xs font-bold block dark:text-white">
            {config.dailyAmount === DailyAmount.JUZ_PER_PLAN
              ? 'اختر الجزء المراد حفظه (متاح للأجزاء الثلاثة الأخيرة فقط)'
              : 'اختر جزء البدء'}
          </label>

          {config.dailyAmount === DailyAmount.JUZ_PER_PLAN ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    num: 28,
                    title: 'الجزء ٢٨ (قد سمع)',
                    sub: '٩ سور • ٩ أسابيع (٦ قلاع)',
                  },
                  {
                    num: 29,
                    title: 'الجزء ٢٩ (تبارك)',
                    sub: '١١ سورة • ١١ أسبوعاً (٧ قلاع)',
                  },
                  {
                    num: 30,
                    title: 'الجزء ٣٠ (عمّ)',
                    sub: '٣٧ سورة • ٩ أسابيع (٦ قلاع)',
                  },
                ].map((item) => {
                  const isSelected = config.juzNumber === item.num;
                  return (
                    <button
                      type="button"
                      key={item.num}
                      onClick={() => handleJuzSelect(item.num)}
                      className={`p-3 rounded-2xl text-right transition-all border flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-[#1A2E1A] dark:bg-[#D4AF37] border-transparent text-white dark:text-[#1A1A1A] shadow-md'
                          : 'bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-extrabold">
                          {item.title}
                        </span>
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                      </div>
                      <span
                        className={`text-[10px] font-medium ${
                          isSelected
                            ? 'text-emerald-200 dark:text-[#1A1A1A]/80'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {item.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Live Castle Distribution Preview */}
              {(() => {
                const activeJuz =
                  config.juzNumber >= 28 && config.juzNumber <= 30
                    ? config.juzNumber
                    : 29;
                const previewCastles = getSevenCastlesPortionsTable({
                  studentName,
                  planType: 'memorization',
                  juzNumber: activeJuz,
                  startPage: config.isSevenCastlesDescending
                    ? JUZ_PAGES[activeJuz].end
                    : JUZ_PAGES[activeJuz].start,
                  endPage: config.isSevenCastlesDescending
                    ? JUZ_PAGES[activeJuz].start
                    : JUZ_PAGES[activeJuz].end,
                  dailyAmount: DailyAmount.JUZ_PER_PLAN,
                  isSevenCastles: true,
                  isSevenCastlesDescending: config.isSevenCastlesDescending,
                  sevenCastlesStartMode: 'juz',
                  startDate,
                  firstDayOfWeek: 0,
                  dailyFixationRepetitions: 5,
                  weeklyReviewRepetitions: 3,
                  hasOldMemorization: false,
                  status: 'active',
                });
                return (
                  <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-extrabold text-emerald-900 dark:text-emerald-300">
                      <span>
                        توزيع السور على القلاع (
                        {config.isSevenCastlesDescending ? 'تنازلياً' : 'تصاعدياً'}
                        ):
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
                        4 أيام حفظ أسبوعياً • 6 أيام لكل قلعة
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {previewCastles.map((c) => (
                        <div
                          key={c.castleIndex}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-xl bg-white/80 dark:bg-black/25 border border-emerald-100 dark:border-white/5 text-[11px]"
                        >
                          <span className="font-extrabold text-[#1A2E1A] dark:text-[#D4AF37] shrink-0">
                            • {c.castleName}:
                          </span>
                          <span className="text-gray-600 dark:text-gray-300 font-medium sm:text-left">
                            {c.castleSummary}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => {
                const isSelected = config.juzNumber === n;
                return (
                  <button
                    type="button"
                    key={n}
                    onClick={() => handleJuzSelect(n)}
                    className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#1A2E1A] dark:bg-[#D4AF37] text-white dark:text-[#1A1A1A] shadow-sm'
                        : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Start Page Input */}
      {config.dailyAmount !== DailyAmount.JUZ_PER_PLAN && (
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block">
            {config.sevenCastlesStartMode === 'juz'
              ? 'من صفحة (تلقائي من الجزء)'
              : 'من صفحة'}
          </label>
          <input
            type="number"
            onFocus={(e) => e.target.select()}
            value={config.startPage}
            min={1}
            max={604}
            disabled={config.sevenCastlesStartMode === 'juz'}
            onChange={(e) => {
              const val = Math.min(
                604,
                Math.max(1, parseInt(e.target.value, 10) || 1)
              );
              onChange({ ...config, startPage: val });
            }}
            className={`w-full bg-gray-50 dark:bg-white/5 dark:text-white border border-gray-200/70 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-[#D4AF37] outline-none transition-all ${
              config.sevenCastlesStartMode === 'juz'
                ? 'opacity-65 cursor-not-allowed'
                : ''
            }`}
          />
        </div>
      )}

      {/* Direction Toggle */}
      <div className="p-3.5 bg-gray-50 dark:bg-white/5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <span className="text-xs font-bold block dark:text-white">
            اتجاه كتابة الخطة
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 block">
            تنازلي للحفظ من نهاية المصحف إلى البداية
          </span>
        </div>
        <div className="flex bg-white dark:bg-[#1A1A1A] p-1 rounded-xl border border-gray-100 dark:border-white/5">
          <button
            type="button"
            onClick={() => handleDirectionChange(false)}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !config.isSevenCastlesDescending
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-500'
            }`}
          >
            تصاعدي (من البداية للنهاية)
          </button>
          <button
            type="button"
            onClick={() => handleDirectionChange(true)}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              config.isSevenCastlesDescending
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-500'
            }`}
          >
            تنازلي (من نهاية المصحف)
          </button>
        </div>
      </div>

      {/* Collapsible Seven Castles Explanation */}
      {showSystemInfo && (
        <div className="bg-blue-50/40 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            className="w-full p-3 flex items-center justify-between hover:bg-blue-50/60 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold text-xs"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500 shrink-0" />
              <span>توضيح تفاصيل نظام خطة الحفظ (القلاع السبع)</span>
            </div>
            {showInfo ? (
              <ChevronUp className="w-4 h-4 text-blue-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-blue-500" />
            )}
          </button>
          {showInfo && (
            <div className="p-3.5 border-t border-blue-100 dark:border-blue-900/20 text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed space-y-1">
              <p className="font-bold text-blue-800 dark:text-blue-300">
                نظام خطة القلاع السبع المتواصلة:
              </p>
              <p>
                • تتكون الخطة من ٧ قلاع (كل قلعة تتكون من ٦ أيام حفظ موزعة بشكل
                متسلسل ومستمر على أيام الحفظ).
              </p>
              <p>
                • أيام الحفظ الأسبوعية هي: الأول والثاني والرابع والخامس. تكتمل
                كل قلعة في ٦ أيام حفظ ممتدة عبر الأسابيع وتبدأ القلعة التي تليها
                مباشرة.
              </p>
              <p>
                • اليوم الأول والثاني: استماع + حفظ جديد + تثبيت للمقدار
                المتسلسل.
              </p>
              <p>• اليوم الثالث: تثبيت وتسميع لمحفوظ اليومين الأول والثاني.</p>
              <p>• اليوم الرابع والخامس: متابعة الحفظ المتسلسل لإكمال القلعة.</p>
              <p>• اليوم السادس: تثبيت وتسميع لمحفوظ اليومين الرابع والخامس.</p>
              <p>
                • مع نهاية كل قلعة، تضاف في الأسابيع التالية مهمة مراجعة القلعة
                المنتهية موزعة على أيام الأسبوع، مع ورد مراجعة المحفوظ القديم
                يومياً.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
