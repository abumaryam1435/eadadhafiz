import jsPDF from 'jspdf';
import { differenceInCalendarDays, format } from 'date-fns';
import { DailyAmount, SevenCastlesPlan, Task } from './types';
import {
  DAILY_AMOUNT_LABELS,
  JUZ_PAGES,
  formatOldMemorizationSummary,
  generateFullSevenCastlesSchedule,
  getJuzForPage,
  getSevenCastlesPortionsTable,
  parsePlanDate,
} from './sevenCastlesGenerator';
import { getHijriDate } from './utils/dateHelpers';
import {
  capturePageElementToJpeg,
  createPdfCaptureContainer,
} from './utils/html2canvasUtils';
import { cleanTaskGroupLabel, parsePdfCustomTask } from './utils/taskLabelHelpers';

export type SevenCastlesPdfStyle = 'castle_towers' | 'standard';

export interface SevenCastlesPdfOptions {
  /** 'castle_towers' = ملف الأبراج الأفقي (A4 Landscape), 'standard' = الجدول العادي العمودي (A4 Portrait) */
  style?: SevenCastlesPdfStyle;
  /** رابط شعار التطبيق (يظهر في أول صفحة من ملف الـ PDF) */
  logoUrl?: string;
  /** اسم التطبيق أو المركز/الحلقة (يظهر في تذييل صفحات الـ PDF وفي رسالة الواتساب) */
  appName?: string;
  /** دالة اختيارية لتحديث شريط تقدم التصدير في الواجهة */
  onProgress?: (message: string, currentStep: number, totalSteps: number) => void;
}

export interface GeneratedSevenCastlesPdf {
  pdf: jsPDF;
  blob: Blob;
  file: File;
  fileName: string;
}

export const CASTLES_THEMES = [
  {
    name: 'القلعة الأولى',
    color: '#059669',
    bgColor: '#edfdf6',
    textColor: '#064e3b',
    borderColor: '#059669',
    bannerBg: '#dbfdec',
  },
  {
    name: 'القلعة الثانية',
    color: '#0284c7',
    bgColor: '#f0f9ff',
    textColor: '#0c4a6e',
    borderColor: '#0284c7',
    bannerBg: '#e0f2fe',
  },
  {
    name: 'القلعة الثالثة',
    color: '#d97706',
    bgColor: '#fffbeb',
    textColor: '#78350f',
    borderColor: '#d97706',
    bannerBg: '#fef3c7',
  },
  {
    name: 'القلعة الرابعة',
    color: '#7c3aed',
    bgColor: '#faf5ff',
    textColor: '#4c1d95',
    borderColor: '#7c3aed',
    bannerBg: '#f3e8ff',
  },
  {
    name: 'القلعة الخامسة',
    color: '#e11d48',
    bgColor: '#fff1f2',
    textColor: '#881337',
    borderColor: '#e11d48',
    bannerBg: '#ffe4e6',
  },
  {
    name: 'القلعة السادسة',
    color: '#0d9488',
    bgColor: '#f0fdfa',
    textColor: '#115e59',
    borderColor: '#0d9488',
    bannerBg: '#ccfbf1',
  },
  {
    name: 'القلعة السابعة',
    color: '#4f46e5',
    bgColor: '#f5f3ff',
    textColor: '#1e1b4b',
    borderColor: '#4f46e5',
    bannerBg: '#e0e7ff',
  },
];

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFilePart(text: string): string {
  return String(text || 'طالب')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_');
}

function getArabicDayName(date: Date): string {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[date.getDay()];
}

function getCastleIndexFromTaskTitle(title: string): number | null {
  if (title.includes('القلعة الأولى') || title.includes('القلعة 1')) return 0;
  if (title.includes('القلعة الثانية') || title.includes('القلعة 2')) return 1;
  if (title.includes('القلعة الثالثة') || title.includes('القلعة 3')) return 2;
  if (title.includes('القلعة الرابعة') || title.includes('القلعة 4')) return 3;
  if (title.includes('القلعة الخامسة') || title.includes('القلعة 5')) return 4;
  if (title.includes('القلعة السادسة') || title.includes('القلعة 6')) return 5;
  if (title.includes('القلعة السابعة') || title.includes('القلعة 7')) return 6;
  return null;
}

function getTaskColor(type: string): string {
  switch (type) {
    case 'memorization':
      return '#059669';
    case 'listening':
      return '#0284c7';
    case 'fixation':
      return '#b45309';
    case 'review':
      return '#be123c';
    case 'cumulative_review':
      return '#0f766e';
    case 'recitation':
      return '#4338ca';
    default:
      return '#333333';
  }
}

function getCastleIdxForDate(date: Date, plan: SevenCastlesPlan): number {
  const planStart = parsePlanDate(plan.startDate);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const daysDiff = differenceInCalendarDays(targetDate, planStart);
  if (daysDiff < 0) return 0;

  const weekIdx = Math.floor(daysDiff / 7);
  const d_week = (targetDate.getDay() - (plan.firstDayOfWeek || 0) + 7) % 7;

  let memDay = 1;
  if (d_week === 0) memDay = weekIdx * 4 + 1;
  else if (d_week === 1) memDay = weekIdx * 4 + 2;
  else if (d_week === 2) memDay = weekIdx * 4 + 1;
  else if (d_week === 3) memDay = weekIdx * 4 + 3;
  else if (d_week === 4) memDay = weekIdx * 4 + 4;
  else if (d_week === 5) memDay = weekIdx * 4 + 3;
  else if (d_week === 6) memDay = weekIdx * 4 + 4;

  const castleIdx = Math.floor((memDay - 1) / 6);
  return Math.min(Math.max(castleIdx, 0), 6);
}

function chunkScheduleIntoWeeks(
  fullData: { date: Date; tasks: Task[] }[],
  firstDayOfWeek: number
): { date: Date; tasks: Task[] }[][] {
  const chunks: { date: Date; tasks: Task[] }[][] = [];
  let currentWeek: { date: Date; tasks: Task[] }[] = [];
  const endOfWeekDay = ((firstDayOfWeek || 0) + 6) % 7;

  fullData.forEach((day) => {
    currentWeek.push(day);
    if (day.date.getDay() === endOfWeekDay) {
      chunks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) {
    chunks.push(currentWeek);
  }
  return chunks;
}

function formatPlanWeeksText(planWeeks: number): string {
  if (planWeeks === 1) return 'أسبوع واحد';
  if (planWeeks === 2) return 'أسبوعان';
  if (planWeeks >= 3 && planWeeks <= 10) return `${planWeeks} أسابيع`;
  return `${planWeeks} أسبوعاً`;
}

function renderCoverLogoHtml(logoUrl?: string, appName?: string): string {
  if (logoUrl && logoUrl.trim()) {
    return `
      <div style="display: flex; justify-content: center; align-items: center; width: 100px; height: 100px; background: #ffffff; border-radius: 20px; border: 2px solid #1A2E1A20; overflow: hidden; padding: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <img src="${escapeHtml(logoUrl)}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;" alt="${escapeHtml(appName || 'شعار التطبيق')}" />
      </div>
    `;
  }
  return `
    <div style="display: flex; justify-content: center; align-items: center; width: 94px; height: 94px; background: #edfdf6; border-radius: 22px; border: 2px solid #059669; box-shadow: 0 4px 12px rgba(5,150,105,0.12);">
      <svg style="width: 52px; height: 52px; fill: #059669;" viewBox="0 0 24 24">
        <path d="M2,22V10l3-3v3h2V6l3-3v3h4V3l3 3v3h2V7l3 3v12H2 M20,20v-8h-2v3h-2v-3h-4v4h-2v-4H6v3H4v-3H2v8H20z" />
      </svg>
    </div>
  `;
}

function createSevenCastlesTablePageElement(
  plan: SevenCastlesPlan,
  isCastleTowerStyle: boolean,
  appName: string
): HTMLDivElement {
  const tableData = getSevenCastlesPortionsTable(plan);
  const tableEl = document.createElement('div');
  tableEl.style.width = isCastleTowerStyle ? '1123px' : '794px';
  tableEl.style.boxSizing = 'border-box';
  tableEl.style.marginBottom = '30px';

  const dailyAmountLabel =
    DAILY_AMOUNT_LABELS[plan.dailyAmount] || 'صفحة واحدة';
  const totalPortions = tableData.reduce((acc, c) => acc + c.portions.length, 0);
  const castlesCount = tableData.length;
  const studentSafe = escapeHtml(plan.studentName || 'الطالب');
  const appSafe = escapeHtml(appName);

  if (isCastleTowerStyle) {
    tableEl.innerHTML = `
      <div style="padding: 24px 35px; background: #FFFDF9; width: 1123px; min-height: 794px; box-sizing: border-box; font-family: 'Cairo', sans-serif; display: flex; flex-direction: column; justify-content: space-between; direction: rtl; position: relative; border: 8px double #059669;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 10px; height: 68px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; background: #edfdf6; border: 1.5px solid #059669; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
              <svg style="width: 26px; height: 26px; fill: #059669;" viewBox="0 0 24 24">
                <path d="M2,22V10l3-3v3h2V6l3-3v3h4V3l3 3v3h2V7l3 3v12H2 M20,20v-8h-2v3h-2v-3h-4v4h-2v-4H6v3H4v-3H2v8H20z" />
              </svg>
            </div>
            <div style="text-align: right;">
              <h1 style="font-size: 20px; font-weight: 900; color: #064e3b; margin: 0; line-height: 1.2;">منظومة القلاع السبع — جدول بيان وتوزيع مقادير الحفظ</h1>
              <div style="font-size: 11.5px; font-weight: 700; color: #059669; margin-top: 2px;">الطالب: ${studentSafe} — بيان تفصيلي للمقادير الستة المخصصة لكل قلعة (إجمالي ${totalPortions} مقدار حفظ جديد)</div>
            </div>
          </div>
          <div style="text-align: left; display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
            <div style="background: #dbfdec; border: 1.5px solid #059669; color: #064e3b; font-weight: 800; font-size: 12px; padding: 4px 14px; border-radius: 30px;">
              المقدار اليومي: ${escapeHtml(dailyAmountLabel)} | ${castlesCount} قلاع × ٦ مقادير
            </div>
            <div style="font-size: 10.5px; color: #666; font-weight: 700;">
              الصفحة رقم 2 (جدول المقادير التفصيلي)
            </div>
          </div>
        </div>

        <!-- Table -->
        <div style="flex-grow: 1; margin-top: 10px; display: flex; flex-direction: column; justify-content: center;">
          <table style="width: 100%; border-collapse: collapse; text-align: center; border: 2px solid #1A2E1A;">
            <thead>
              <tr style="background: #1A2E1A; color: #F7E7A9;">
                <th style="padding: 9px 6px; font-size: 13px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 13%;">القلعة</th>
                <th style="padding: 9px 4px; font-size: 12.5px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 1</th>
                <th style="padding: 9px 4px; font-size: 12.5px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 2</th>
                <th style="padding: 9px 4px; font-size: 12.5px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 3</th>
                <th style="padding: 9px 4px; font-size: 12.5px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 4</th>
                <th style="padding: 9px 4px; font-size: 12.5px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 5</th>
                <th style="padding: 9px 4px; font-size: 12.5px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 6</th>
              </tr>
            </thead>
            <tbody>
              ${tableData
                .map((castle, cIdx) => {
                  const theme = CASTLES_THEMES[cIdx] || CASTLES_THEMES[0];
                  return `
                  <tr style="border-bottom: 1.5px solid #E5E7EB;">
                    <td style="background: ${theme.bgColor}; border: 1.5px solid ${theme.color}; padding: 7px 5px; text-align: center; vertical-align: middle;">
                      <div style="font-weight: 900; font-size: 12.5px; color: ${theme.textColor}; line-height: 1.2;">
                        ${castle.castleName}
                      </div>
                      <div style="font-size: 9.5px; font-weight: 800; color: ${theme.color}; margin-top: 2px;">
                        (الأيام ${cIdx * 6 + 1} - ${cIdx * 6 + 6})
                      </div>
                    </td>
                    ${castle.portions
                      .map((p) => {
                        const descText = p.desc || `المقدار ${p.portionIndex + 1}`;
                        const showPageBadge = p.pages.length > 0 && !descText.startsWith('ص ');
                        return `
                        <td style="background: ${cIdx % 2 === 0 ? '#FFFFFF' : '#FAF9F5'}; border: 1px solid #D1D5DB; padding: 5px 4px; vertical-align: middle; text-align: center; min-height: 64px; box-sizing: border-box;">
                          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                            <span style="font-size: 9.5px; font-weight: 800; color: #1A2E1A; line-height: 1.28; text-align: center; overflow-wrap: break-word; word-break: break-word;">
                              ${escapeHtml(descText)}
                            </span>
                            ${
                              showPageBadge
                                ? `<span style="font-size: 8.5px; font-weight: 800; color: ${theme.color}; margin-top: 2px; font-family: 'Cairo', sans-serif;">ص ${p.pages[0]}${p.pages.length > 1 ? ` - ${p.pages[p.pages.length - 1]}` : ''}</span>`
                                : ''
                            }
                          </div>
                        </td>
                      `;
                      })
                      .join('')}
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #D4AF37; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #777;">
          <span>❖ الطالب: ${studentSafe} — جدول مقادير منظومة القلاع السبع</span>
          <span>صفحة 2 | ${appSafe} — ${new Date().toLocaleDateString('ar-EG')}</span>
        </div>
      </div>
    `;
  } else {
    tableEl.innerHTML = `
      <div style="padding: 40px 30px; background: #FDFBF7; width: 794px; min-height: 1123px; box-sizing: border-box; font-family: 'Cairo', sans-serif; display: flex; flex-direction: column; justify-content: space-between; direction: rtl; position: relative; border: 4px solid #1A2E1A;">
        <div style="position: absolute; top: 12px; bottom: 12px; left: 12px; right: 12px; border: 1px solid #D4AF37; pointer-events: none;"></div>
        <div style="text-align: center; margin-top: 5px; margin-bottom: 10px;">
          <div style="font-size: 18px; color: #D4AF37; margin-bottom: 5px;">❖ ══════════ ❖ ══════════ ❖</div>
          <h1 style="font-size: 22px; font-weight: 900; color: #1A2E1A; margin: 0; line-height: 1.3;">منظومة القلاع السبع — جدول بيان وتوزيع مقادير الحفظ</h1>
          <p style="font-size: 13px; color: #059669; font-weight: 800; margin: 5px 0 0 0;">الطالب: ${studentSafe}</p>
          <div style="display: inline-block; margin-top: 8px; background: #ffffff; border: 1.5px solid #1A2E1A20; padding: 4px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; color: #1A2E1A;">
            المقدار اليومي المقرر: ${escapeHtml(dailyAmountLabel)} | إجمالي ${totalPortions} مقدار حفظ
          </div>
        </div>

        <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; margin: 5px 0;">
          <table style="width: 100%; border-collapse: collapse; text-align: center; border: 2px solid #1A2E1A;">
            <thead>
              <tr style="background: #1A2E1A; color: #F7E7A9;">
                <th style="padding: 10px 4px; font-size: 12px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 13%;">القلعة</th>
                <th style="padding: 10px 3px; font-size: 11px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 1</th>
                <th style="padding: 10px 3px; font-size: 11px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 2</th>
                <th style="padding: 10px 3px; font-size: 11px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 3</th>
                <th style="padding: 10px 3px; font-size: 11px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 4</th>
                <th style="padding: 10px 3px; font-size: 11px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 5</th>
                <th style="padding: 10px 3px; font-size: 11px; font-weight: 900; border: 1.5px solid #1A2E1A; width: 14.5%;">المقدار 6</th>
              </tr>
            </thead>
            <tbody>
              ${tableData
                .map((castle, cIdx) => {
                  const theme = CASTLES_THEMES[cIdx] || CASTLES_THEMES[0];
                  return `
                  <tr style="border-bottom: 1.5px solid #E5E7EB;">
                    <td style="background: ${theme.bgColor}; border: 1.5px solid ${theme.color}; padding: 8px 3px; text-align: center; vertical-align: middle;">
                      <div style="font-weight: 900; font-size: 12px; color: ${theme.textColor}; line-height: 1.2;">
                        ${castle.castleName}
                      </div>
                      <div style="font-size: 9px; font-weight: 800; color: ${theme.color}; margin-top: 3px;">
                        (${cIdx * 6 + 1} - ${cIdx * 6 + 6})
                      </div>
                    </td>
                    ${castle.portions
                      .map((p) => {
                        const descText = p.desc || `المقدار ${p.portionIndex + 1}`;
                        const showPageBadge = p.pages.length > 0 && !descText.startsWith('ص ');
                        return `
                        <td style="background: ${cIdx % 2 === 0 ? '#FFFFFF' : '#FBFBFA'}; border: 1px solid #D1D5DB; padding: 6px 3px; vertical-align: middle; text-align: center; min-height: 92px; box-sizing: border-box;">
                          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                            <span style="font-size: 9px; font-weight: 800; color: #1A2E1A; line-height: 1.3; text-align: center; overflow-wrap: break-word; word-break: break-word;">
                              ${escapeHtml(descText)}
                            </span>
                            ${
                              showPageBadge
                                ? `<span style="font-size: 8px; font-weight: 800; color: ${theme.color}; margin-top: 3px; font-family: 'Cairo', sans-serif;">ص ${p.pages[0]}${p.pages.length > 1 ? ` - ${p.pages[p.pages.length - 1]}` : ''}</span>`
                                : ''
                            }
                          </div>
                        </td>
                      `;
                      })
                      .join('')}
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 5px; text-align: center;">
          <div style="font-size: 16px; color: #D4AF37; margin-bottom: 5px;">❖ ══════════ ❖ ══════════ ❖</div>
          <p style="font-size: 11px; color: #777; margin: 0; font-weight: 600;">
            الصفحة 2 | الطالب: ${studentSafe} | ${appSafe} — ${new Date().toLocaleDateString('ar-EG')}
          </p>
        </div>
      </div>
    `;
  }

  return tableEl;
}

/**
 * Generates a fast, high-resolution, blank-page-free PDF for a student's Seven Castles plan.
 * Page 1 prominently displays the host app's logo (`logoUrl`) and the student's name (`plan.studentName`).
 */
export async function generateSevenCastlesPdf(
  plan: SevenCastlesPlan,
  options: SevenCastlesPdfOptions = {}
): Promise<GeneratedSevenCastlesPdf> {
  const isCastleTowerStyle = (options.style || 'castle_towers') === 'castle_towers';
  const appName = options.appName?.trim() || 'برنامج متابعة الحفظ';
  const appSafe = escapeHtml(appName);
  const studentName = plan.studentName?.trim() || 'الطالب';
  const studentSafe = escapeHtml(studentName);

  const fullData = generateFullSevenCastlesSchedule(plan);
  const chunks = chunkScheduleIntoWeeks(fullData, plan.firstDayOfWeek || 0).filter(
    (c) => c && c.length > 0
  );

  const targetWidth = isCastleTowerStyle ? 1123 : 794;
  const targetHeight = isCastleTowerStyle ? 794 : 1123;
  const pageBgColor = isCastleTowerStyle ? '#FFFDF9' : '#FDFBF7';

  const pdf = isCastleTowerStyle
    ? new jsPDF('l', 'mm', 'a4')
    : new jsPDF('p', 'mm', 'a4');

  const tempContainer = createPdfCaptureContainer(
    targetWidth,
    targetHeight,
    pageBgColor
  );

  try {
    try {
      if ('fonts' in document) {
        await document.fonts.ready;
      }
    } catch {
      // ignore font wait errors
    }

    const pageElements: HTMLDivElement[] = [];

    const startJuzNum =
      plan.juzNumber || getJuzForPage(plan.startPage || 1);
    const dailyAmountLabel =
      DAILY_AMOUNT_LABELS[plan.dailyAmount] || 'صفحة واحدة';
    const newMemText =
      plan.dailyAmount === DailyAmount.JUZ_PER_PLAN
        ? `جزء ${startJuzNum} كاملاً (مقسم بالسور)`
        : plan.sevenCastlesStartMode === 'page'
          ? `من صفحة ${plan.startPage} — ${dailyAmountLabel} يومياً`
          : `يبدأ من جزء ${startJuzNum} — ${dailyAmountLabel} يومياً`;

    const oldMemText = plan.hasOldMemorization
      ? formatOldMemorizationSummary(
          plan.oldMemorizationRanges,
          plan.oldMemorizedPages
        )
      : 'لا يوجد';

    const durationText = formatPlanWeeksText(chunks.length);
    const startDateStr = format(fullData[0].date, 'yyyy/MM/dd');
    const endDateStr = format(fullData[fullData.length - 1].date, 'yyyy/MM/dd');
    const startHijriStr = getHijriDate(fullData[0].date);
    const endHijriStr = getHijriDate(fullData[fullData.length - 1].date);

    // --- PAGE 1: COVER PAGE WITH APP LOGO & STUDENT NAME ---
    const coverEl = document.createElement('div');
    coverEl.style.width = `${targetWidth}px`;
    coverEl.style.boxSizing = 'border-box';
    coverEl.style.marginBottom = '30px';

    const logoBlock = renderCoverLogoHtml(options.logoUrl, appName);

    if (isCastleTowerStyle) {
      coverEl.innerHTML = `
        <div style="padding: 46px 70px; background: #FFFDF9; width: 1123px; min-height: 794px; box-sizing: border-box; font-family: 'Cairo', sans-serif; display: flex; flex-direction: column; justify-content: space-between; direction: rtl; position: relative; border: 12px double #1A2E1A; text-align: center;">
          <div style="font-size: 22px; color: #D4AF37; margin-bottom: 6px;">❖ ═══════════ ❖ ═══════════ ❖</div>

          <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 20px;">
            ${logoBlock}

            <div>
              <h1 style="font-size: 36px; font-weight: 900; color: #1A2E1A; margin: 0; line-height: 1.28;">خطة القلاع السبع للتمكين</h1>
              <p style="font-size: 16px; color: #D4AF37; font-weight: bold; margin-top: 6px; margin-bottom: 0;">برنامج التمكين المتكامل لحفظ القرآن الكريم وتثبيته</p>
            </div>

            <!-- Prominent Student Name Banner on Page 1 -->
            <div style="display: inline-flex; align-items: center; gap: 12px; background: #edfdf6; border: 2px solid #059669; padding: 10px 32px; border-radius: 50px; box-shadow: 0 4px 12px rgba(5,150,105,0.08);">
              <span style="font-size: 15px; font-weight: 800; color: #059669;">اسم الطالب:</span>
              <span style="font-size: 24px; font-weight: 900; color: #064e3b;">${studentSafe}</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; width: 84%; max-width: 860px; margin-top: 4px; background: #ffffff; border: 2px solid #1A2E1A15; padding: 24px 28px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
              <div style="display: flex; align-items: center; gap: 12px; text-align: right; border-bottom: 1px dashed #1A2E1A20; padding-bottom: 12px;">
                <span style="font-size: 22px;">🌱</span>
                <div>
                  <div style="font-size: 12.5px; color: #666; font-weight: bold;">الحفظ الجديد</div>
                  <div style="font-size: 15px; color: #1A2E1A; font-weight: 800; margin-top: 2px;">${escapeHtml(newMemText)}</div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 12px; text-align: right; border-bottom: 1px dashed #1A2E1A20; padding-bottom: 12px;">
                <span style="font-size: 22px;">📖</span>
                <div>
                  <div style="font-size: 12.5px; color: #666; font-weight: bold;">الحفظ القديم / المراجعة</div>
                  <div style="font-size: 14px; color: #1A2E1A; font-weight: 800; margin-top: 2px; line-height: 1.35;">${escapeHtml(oldMemText)}</div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 12px; text-align: right; padding-top: 4px;">
                <span style="font-size: 22px;">⏳</span>
                <div>
                  <div style="font-size: 12.5px; color: #666; font-weight: bold;">مدة الخطة والتكرار</div>
                  <div style="font-size: 14.5px; color: #1A2E1A; font-weight: 800; margin-top: 2px;">${durationText} • تثبيت الجديد (${plan.dailyFixationRepetitions}x) | يوم 3 و 6 (${plan.weeklyReviewRepetitions}x)</div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 12px; text-align: right; padding-top: 4px;">
                <span style="font-size: 22px;">📅</span>
                <div>
                  <div style="font-size: 12.5px; color: #666; font-weight: bold;">الفترة الزمنية</div>
                  <div style="font-size: 13.5px; color: #1A2E1A; font-weight: 800; margin-top: 2px; line-height: 1.4;">
                    البداية: ${startHijriStr} (${startDateStr} م)<br/>
                    النهاية: ${endHijriStr} (${endDateStr} م)
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top: 12px;">
            <div style="font-size: 22px; color: #D4AF37; margin-bottom: 6px;">❖ ═══════════ ❖ ═══════════ ❖</div>
            <p style="font-size: 12px; color: #888; margin: 0;">تم إصدار هذه الخطة عبر "${appSafe}" — ${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
        </div>
      `;
    } else {
      coverEl.innerHTML = `
        <div style="padding: 65px 55px; background: #FDFBF7; width: 794px; min-height: 1123px; box-sizing: border-box; font-family: 'Cairo', sans-serif; display: flex; flex-direction: column; justify-content: space-between; direction: rtl; position: relative; border: 4px solid #1A2E1A; text-align: center;">
          <div style="position: absolute; top: 15px; bottom: 15px; left: 15px; right: 15px; border: 1px solid #D4AF37; pointer-events: none;"></div>
          <div style="font-size: 22px; color: #D4AF37; margin-top: 10px;">❖ ══════════ ❖ ══════════ ❖</div>

          <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 28px; margin: 16px 0;">
            ${logoBlock}

            <div>
              <h1 style="font-size: 34px; font-weight: 900; color: #1A2E1A; margin: 0; line-height: 1.35;">خطة القلاع السبع للتمكين</h1>
              <p style="font-size: 16px; color: #D4AF37; font-weight: bold; margin-top: 10px; margin-bottom: 0;">البرنامج المنهجي المنظم لحفظ القرآن الكريم وتثبيته</p>
            </div>

            <!-- Prominent Student Name Banner on Page 1 -->
            <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 4px; background: #edfdf6; border: 2px solid #059669; padding: 12px 38px; border-radius: 20px; width: 75%; box-sizing: border-box;">
              <span style="font-size: 13px; font-weight: 800; color: #059669;">خطة الحفظ الخاصة بالطالب</span>
              <span style="font-size: 26px; font-weight: 900; color: #064e3b;">${studentSafe}</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 16px; width: 88%; background: #ffffff; border: 1.5px solid #1A2E1A15; padding: 28px 24px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.01);">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px dashed #E5E7EB; padding-bottom: 12px;">
                <span style="font-size: 14.5px; color: #555; font-weight: bold;">🌱 مقرر الحفظ الجديد:</span>
                <span style="font-size: 15px; color: #1A2E1A; font-weight: 800;">${escapeHtml(newMemText)}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px dashed #E5E7EB; padding-bottom: 12px;">
                <span style="font-size: 14.5px; color: #555; font-weight: bold; white-space: nowrap; margin-left: 15px;">📖 الحفظ القديم / المراجعة:</span>
                <span style="font-size: 14px; color: #1A2E1A; font-weight: 800; text-align: left; max-width: 310px; line-height: 1.4;">${escapeHtml(oldMemText)}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px dashed #E5E7EB; padding-bottom: 12px;">
                <span style="font-size: 14.5px; color: #555; font-weight: bold;">⏳ مدة البرنامج المنهجي:</span>
                <span style="font-size: 15px; color: #1A2E1A; font-weight: 800;">${durationText}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px dashed #E5E7EB; padding-bottom: 12px;">
                <span style="font-size: 14.5px; color: #555; font-weight: bold;">🔁 عدد مرات التثبيت:</span>
                <span style="font-size: 14.5px; color: #1A2E1A; font-weight: 800;">الجديد (${plan.dailyFixationRepetitions}x) | اليوم 3 و 6 (${plan.weeklyReviewRepetitions}x)</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start; padding-top: 4px; text-align: right;">
                <span style="font-size: 14.5px; color: #555; font-weight: bold; margin-bottom: 2px;">📅 الفترة الزمنية المخصصة:</span>
                <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: #1A2E1A; font-weight: 800; padding-right: 12px;">
                  <span>• تاريخ البدء: ${startHijriStr}</span>
                  <span style="font-size: 12px; color: #b45309;">(${startDateStr} م)</span>
                </div>
                <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: #1A2E1A; font-weight: 800; padding-right: 12px;">
                  <span>• تاريخ الانتهاء: ${endHijriStr}</span>
                  <span style="font-size: 12px; color: #b45309;">(${endDateStr} م)</span>
                </div>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 10px;">
            <div style="font-size: 22px; color: #D4AF37; margin-bottom: 8px;">❖ ══════════ ❖ ══════════ ❖</div>
            <p style="font-size: 12.5px; color: #777; margin: 0; font-weight: 500;">تم إصدار هذه الخطة عبر "${appSafe}" — ${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
        </div>
      `;
    }

    pageElements.push(coverEl);

    // --- PAGE 2: SEVEN CASTLES PORTIONS TABLE ---
    pageElements.push(
      createSevenCastlesTablePageElement(plan, isCastleTowerStyle, appName)
    );

    // --- PAGES 3+: WEEKLY PAGES ---
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const pageEl = document.createElement('div');
      pageEl.style.width = `${targetWidth}px`;
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.marginBottom = '30px';

      if (isCastleTowerStyle) {
        const overallCastleIdx = getCastleIdxForDate(chunk[0].date, plan);
        const castleTheme = CASTLES_THEMES[overallCastleIdx];
        const weekStartCastleIdx = getCastleIdxForDate(chunk[0].date, plan);
        const weekEndCastleIdx = getCastleIdxForDate(
          chunk[chunk.length - 1].date,
          plan
        );
        const castleBannerLabel =
          weekStartCastleIdx !== weekEndCastleIdx
            ? `${CASTLES_THEMES[weekStartCastleIdx].name} و ${CASTLES_THEMES[weekEndCastleIdx].name}`
            : CASTLES_THEMES[weekStartCastleIdx].name;

        pageEl.innerHTML = `
          <div style="padding: 25px 35px; background: #FFFDF9; width: 1123px; min-height: 794px; box-sizing: border-box; font-family: 'Cairo', sans-serif; display: flex; flex-direction: column; justify-content: space-between; direction: rtl; position: relative; border: 8px double ${castleTheme.color};">
            <div style="display: flex; justify-content: space-between; align-items: center; height: 75px; border-bottom: 2px solid ${castleTheme.color}; padding-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 15px;">
                <svg style="width: 45px; height: 45px; fill: ${castleTheme.color};" viewBox="0 0 24 24">
                  <path d="M2,22V10l3-3v3h2V6l3-3v3h4V3l3 3v3h2V7l3 3v12H2 M20,20v-8h-2v3h-2v-3h-4v4h-2v-4H6v3H4v-3H2v8H20z" />
                </svg>
                <div style="text-align: right;">
                  <h1 style="font-size: 22px; font-weight: 900; color: ${castleTheme.textColor}; margin: 0; line-height: 1.2;">منظومة القلاع السبع — ${studentSafe}</h1>
                  <div style="font-size: 12px; font-weight: bold; color: ${castleTheme.color}; margin-top: 2px;">أسلوب التمكين بالبناء التراكمي المتقن</div>
                </div>
              </div>
              <div style="text-align: left; display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
                <div style="background: ${castleTheme.bannerBg}; border: 1px solid ${castleTheme.color}; color: ${castleTheme.textColor}; font-weight: 800; font-size: 13px; padding: 5px 14px; border-radius: 30px;">
                  ${castleBannerLabel} | الأسبوع رقم ${i + 1}
                </div>
                <div style="font-size: 11px; color: #777; font-weight: 700; margin-left: 5px;">
                  ${appSafe}
                </div>
              </div>
            </div>

            <!-- 7 Day Towers -->
            <div style="display: flex; gap: 12px; justify-content: space-between; align-items: stretch; width: 100%; margin-top: 15px; flex-grow: 1; min-height: 580px; box-sizing: border-box;">
              ${chunk
                .map((day) => {
                  const dayName = getArabicDayName(day.date);
                  const dayDateStr = format(day.date, 'yyyy/MM/dd');
                  const hijriDateStr = getHijriDate(day.date);
                  const dayCastleIdx = getCastleIdxForDate(day.date, plan);
                  const dayCastleTheme = CASTLES_THEMES[dayCastleIdx];

                  return `
                  <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; position: relative; min-height: 100%; box-sizing: border-box;">
                    <div style="width: 100%; height: 32px; position: relative; display: block; overflow: visible; margin-bottom: -1px; z-index: 2;">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
                        <polygon points="50,0 0,100 100,100" fill="${dayCastleTheme.color}" />
                      </svg>
                    </div>
                    <div style="flex-grow: 1; border: 3px solid ${dayCastleTheme.color}; background: #FFFFFF; border-radius: 0 0 16px 16px; padding: 12px 7px; display: flex; flex-direction: column; justify-content: space-between; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.03); z-index: 1; min-height: 480px; box-sizing: border-box;">
                      <div style="display: flex; flex-direction: column; gap: 6px; flex-grow: 1; justify-content: flex-start; overflow: visible;">
                        ${(() => {
                          const d_week =
                            (day.date.getDay() - (plan.firstDayOfWeek || 0) + 7) % 7;
                          const slots: (Task | null)[] = [null, null, null, null, null];

                          if (day.tasks && day.tasks.length > 0) {
                            day.tasks.forEach((t) => {
                              const title = t.title || '';
                              const type = t.type || '';
                              const tid = t.id ? String(t.id) : '';
                              const isListening = title.includes('استماع');
                              const isMemorization = title.includes('حفظ');
                              const isFixation = title.includes('تثبيت');
                              const isOldReview =
                                tid.startsWith('old-rev-') ||
                                title.includes('المحفوظ القديم') ||
                                title.includes('القديم');
                              const isCastleRev =
                                tid.startsWith('sc-castle-rev-') ||
                                getCastleIndexFromTaskTitle(title) !== null ||
                                title.includes('القلعة');
                              const isRecitation = title.includes('تسميع');
                              const isReviewWeek =
                                title.includes('مراجعة محفوظ الأسبوع') ||
                                (type === 'review' && !isCastleRev && !isOldReview);

                              if (d_week === 0 || d_week === 1 || d_week === 3 || d_week === 4) {
                                if (isListening) slots[0] = t;
                                else if (isMemorization) slots[1] = t;
                                else if (isFixation) slots[2] = t;
                                else if (isOldReview) slots[3] = t;
                                else if (isCastleRev) slots[4] = t;
                              } else if (d_week === 2 || d_week === 5) {
                                if (isFixation) slots[0] = t;
                                else if (isRecitation) slots[1] = t;
                                else if (isOldReview) slots[3] = t;
                                else if (isCastleRev) slots[4] = t;
                              } else if (d_week === 6) {
                                if (isReviewWeek) slots[0] = t;
                                else if (isRecitation) slots[1] = t;
                                else if (isOldReview) slots[3] = t;
                                else if (isCastleRev) slots[4] = t;
                              }
                            });

                            day.tasks.forEach((t) => {
                              if (!slots.some((s) => s && s.id === t.id)) {
                                const emptyIdx = slots.indexOf(null);
                                if (emptyIdx !== -1) slots[emptyIdx] = t;
                              }
                            });
                          }

                          if (!day.tasks || day.tasks.length === 0) {
                            return `
                              <div style="flex: 1; border: 1px dashed rgba(0,0,0,0.02); border-radius: 8px; box-sizing: border-box;"></div>
                              <div style="flex: 1; padding: 4px 6px; border-radius: 8px; font-size: 9px; font-weight: bold; background: #94a3b812; border: 1px dashed #94a3b830; text-align: center; color: #64748b; line-height: 1.4; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box; min-height: 90px;">
                                <div style="font-size: 13px; margin-bottom: 2px;">🌸</div>
                                <div>يوم مراجعة حرة</div>
                              </div>
                              <div style="flex: 1; border: 1px dashed rgba(0,0,0,0.02); border-radius: 8px; min-height: 90px;"></div>
                              <div style="flex: 1; border: 1px dashed rgba(0,0,0,0.02); border-radius: 8px; min-height: 90px;"></div>
                              <div style="flex: 1; border: 1px dashed rgba(0,0,0,0.02); border-radius: 8px; min-height: 90px;"></div>
                            `;
                          }

                          const renderSingleSlot = (t: Task | null) => {
                            if (!t) {
                              return `<div style="flex: 1; border: 1px dashed rgba(0,0,0,0.02); border-radius: 8px; box-sizing: border-box;"></div>`;
                            }
                            const isCastleRev = getCastleIndexFromTaskTitle(t.title);
                            const taskColor =
                              isCastleRev !== null
                                ? CASTLES_THEMES[isCastleRev].color
                                : getTaskColor(t.type);

                            const customParsed = parsePdfCustomTask(t.title, t.id);
                            if (customParsed) {
                              return `
                                <div style="flex: 1; padding: 4px 6px; border-radius: 8px; font-size: 9px; font-weight: bold; background: ${taskColor}12; border: 1px solid ${taskColor}25; text-align: right; color: ${taskColor}; line-height: 1.35; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
                                  <div style="font-size: 7.8px; font-weight: 800; color: #1e293b; background: #ffffff; border: 1.2px solid ${taskColor}20; padding: 2px 4px; border-radius: 4px; margin-bottom: 2px; white-space: normal; line-height: 1.22; text-align: center; overflow-wrap: break-word; word-break: break-word;">
                                    ${escapeHtml(customParsed.portion)}
                                  </div>
                                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 3px; margin-top: auto; border-top: 1px dashed ${taskColor}20; padding-top: 1.5px;">
                                    <span style="font-size: 8.4px; font-weight: 850; color: ${taskColor}; white-space: nowrap;">${escapeHtml(customParsed.action)}</span>
                                    ${t.targetCount > 1 ? `<span style="opacity: 0.85; font-size: 7px;">تكرار: ${t.targetCount}x</span>` : ''}
                                  </div>
                                </div>
                              `;
                            }
                            return `
                              <div style="flex: 1; padding: 4px 6px; border-radius: 8px; font-size: 9px; font-weight: bold; background: ${taskColor}12; border: 1px solid ${taskColor}25; text-align: right; color: ${taskColor}; line-height: 1.3; display: flex; flex-direction: column; justify-content: flex-start; box-sizing: border-box;">
                                <div style="display: flex; align-items: flex-start; gap: 3px;">
                                  <span style="font-weight: normal; font-size: 10px; margin-top: -1.5px; flex-shrink: 0;">☐</span>
                                  <span style="width: 100%; white-space: normal; line-height: 1.22; overflow-wrap: break-word; word-break: break-word; font-size: 8px;">${escapeHtml(t.title)}</span>
                                </div>
                                ${t.targetCount > 1 ? `<div style="opacity: 0.85; font-size: 7px; margin-top: auto; padding-top: 1px; text-align: left;">تكرار: ${t.targetCount}x</div>` : ''}
                              </div>
                            `;
                          };

                          const isThreeGroup =
                            d_week === 0 || d_week === 1 || d_week === 3 || d_week === 4;
                          const groupedSlots = isThreeGroup
                            ? [slots[0], slots[1], slots[2]]
                            : [slots[0], slots[1]];
                          const activeGroupedTasks = groupedSlots.filter(
                            (t): t is Task => t !== null
                          );

                          let groupedHTML = '';
                          if (activeGroupedTasks.length > 0) {
                            const portionSet = new Set(
                              activeGroupedTasks.map((t) => {
                                const parsed = parsePdfCustomTask(t.title, t.id);
                                return parsed ? parsed.portion : cleanTaskGroupLabel(t.title);
                              })
                            );

                            if (portionSet.size === 1) {
                              const sharedPortion = Array.from(portionSet)[0];
                              const actionBars = groupedSlots
                                .map((t) => {
                                  if (!t) return '';
                                  const isCastleRev = getCastleIndexFromTaskTitle(t.title);
                                  const taskColor =
                                    isCastleRev !== null
                                      ? CASTLES_THEMES[isCastleRev].color
                                      : getTaskColor(t.type);
                                  const parsed = parsePdfCustomTask(t.title, t.id);
                                  const actionText = parsed ? parsed.action : t.title;
                                  return `
                                    <div style="padding: 3px 6px; border-radius: 5px; font-size: 8.8px; font-weight: bold; background: ${taskColor}12; border: 1.2px solid ${taskColor}25; color: ${taskColor}; text-align: right; line-height: 1.25; display: flex; align-items: center; justify-content: space-between; flex: 1; min-height: 20px; box-sizing: border-box;">
                                      <span style="font-size: 8.6px; font-weight: 850; white-space: nowrap;">${escapeHtml(actionText)}</span>
                                      ${t.targetCount > 1 ? `<span style="font-size: 7px; opacity: 0.85;">تكرار: ${t.targetCount}x</span>` : ''}
                                    </div>
                                  `;
                                })
                                .filter(Boolean)
                                .join('');

                              const flexCount = isThreeGroup ? 3 : 2;
                              groupedHTML = `
                                <div style="flex: ${flexCount}; padding: 5px; border-radius: 8px; border: 1.5px dashed ${dayCastleTheme.color}35; background: ${dayCastleTheme.color}04; display: flex; flex-direction: column; justify-content: flex-start; gap: 4px; box-sizing: border-box;">
                                  <div style="font-size: 7.8px; font-weight: 800; color: #1e293b; background: #ffffff; border: 1.2px solid ${dayCastleTheme.color}25; padding: 3px 4px; border-radius: 4px; text-align: center; overflow-wrap: break-word; word-break: break-word; line-height: 1.22; display: flex; align-items: center; justify-content: center; min-height: 24px;">
                                    ${escapeHtml(sharedPortion || 'المقرر اليومي')}
                                  </div>
                                  <div style="display: flex; flex-direction: column; gap: 3.5px; flex-grow: 1; justify-content: flex-start;">
                                    ${actionBars}
                                  </div>
                                </div>
                              `;
                            } else {
                              groupedHTML = groupedSlots.map((t) => renderSingleSlot(t)).join('');
                            }
                          } else {
                            const flexCount = isThreeGroup ? 3 : 2;
                            groupedHTML = `<div style="flex: ${flexCount}; border: 1px dashed rgba(0,0,0,0.02); border-radius: 8px;"></div>`;
                          }

                          const slot2HTML = !isThreeGroup ? renderSingleSlot(slots[2]) : '';
                          return (
                            groupedHTML +
                            slot2HTML +
                            renderSingleSlot(slots[3]) +
                            renderSingleSlot(slots[4])
                          );
                        })()}
                      </div>

                      <div style="margin-top: auto; padding-top: 8px; border-top: 2px dashed ${dayCastleTheme.color}25; text-align: center;">
                        <div style="font-size: 14px; font-weight: 900; color: ${dayCastleTheme.textColor};">${dayName}</div>
                        <div style="font-size: 9px; color: #D4AF37; font-weight: bold; margin-top: 2px;">${hijriDateStr}</div>
                        <div style="font-size: 9px; color: #888; font-weight: bold; margin-top: 1px;">${dayDateStr}</div>
                      </div>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>

            <div style="margin-top: 15px; padding-top: 8px; border-top: 1px dashed #E5E7EB; display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 11px; color: #9CA3AF; font-weight: bold; height: 20px;">
              <div>الطالب: ${studentSafe} | الأسبوع ${i + 1} من ${chunks.length}</div>
              <div>${appSafe} — ${new Date().toLocaleDateString('ar-EG')}</div>
            </div>
          </div>
        `;
      } else {
        pageEl.innerHTML = `
          <div style="padding: 24px; background: #FDFBF7; min-height: 1123px; width: 794px; box-sizing: border-box; font-family: 'Cairo', sans-serif; display: flex; flex-direction: column; direction: rtl; overflow: visible;">
            <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #1A2E1A; padding-bottom: 8px;">
              <h1 style="font-size: 22px; color: #1A2E1A; margin: 0;">خطة القلاع السبع لحفظ القرآن الكريم</h1>
              <p style="font-size: 14px; color: #D4AF37; font-weight: 800; margin: 4px 0;">الطالب: ${studentSafe} — الأسبوع ${i + 1}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 13px; flex-grow: 1; border: 2px solid #1A2E1A;">
              <thead>
                <tr style="background: #1A2E1A; color: white;">
                  <th style="padding: 8px 12px; border: 2px solid #1A2E1A; text-align: right; width: 25%;">اليوم والتاريخ</th>
                  <th style="padding: 8px 12px; border: 2px solid #1A2E1A; text-align: right;">المهام المطلوبة</th>
                </tr>
              </thead>
              <tbody>
                ${chunk
                  .map((day, idx) => {
                    const dayName = getArabicDayName(day.date);
                    const dayDateStr = format(day.date, 'yyyy/MM/dd');
                    const hijriDateStr = getHijriDate(day.date);
                    return `
                    <tr style="background: ${idx % 2 === 0 ? 'white' : '#f9f9f9'}">
                      <td style="padding: 8px 12px; border: 2px solid #1A2E1A;">
                        <div style="font-weight: bold; font-size: 13.5px;">${dayName}</div>
                        <div style="font-size: 10.5px; color: #b45309; font-weight: bold; margin-top: 2px;">${hijriDateStr}</div>
                        <div style="font-size: 11px; color: #666;">${dayDateStr}</div>
                      </td>
                      <td style="padding: 8px 12px; border: 2px solid #1A2E1A;">
                        <ul style="padding-right: 0; margin: 0; list-style: none;">
                          ${(() => {
                            if (!day.tasks || day.tasks.length === 0) {
                              return `<li style="color: #666; font-weight: bold; font-size: 13px;">يوم مراجعة حرة</li>`;
                            }
                            const dayGroups: { key: string; label: string; tasks: Task[] }[] = [];
                            day.tasks.forEach((t) => {
                              const cleanLabel = cleanTaskGroupLabel(t.title);
                              const partMatch = t.id ? t.id.toString().match(/-part\d+/) : null;
                              const partSuffix = partMatch ? partMatch[0] : '';
                              const key =
                                t.pages && t.pages.length > 0
                                  ? 'group-' + t.pages.join(',') + '-' + cleanLabel + partSuffix
                                  : `task-${t.id || cleanLabel}`;
                              let group = dayGroups.find((g) => g.key === key);
                              if (!group) {
                                group = { key, label: cleanLabel, tasks: [] };
                                dayGroups.push(group);
                              }
                              group.tasks.push(t);
                            });

                            return dayGroups
                              .map((group, groupIdx) => {
                                if (group.tasks.length === 1) {
                                  const t = group.tasks[0];
                                  const isCastleRev = getCastleIndexFromTaskTitle(t.title);
                                  const color =
                                    isCastleRev !== null
                                      ? CASTLES_THEMES[isCastleRev].color
                                      : getTaskColor(t.type);
                                  const repeatText =
                                    t.targetCount > 1 ? ` (تكرار: ${t.targetCount}x)` : '';
                                  return `
                                    <li style="padding-bottom: 4px; margin-bottom: 4px; font-weight: bold; font-size: 13.5px; line-height: 1.35; display: block; color: ${color}; ${groupIdx !== dayGroups.length - 1 ? 'border-bottom: 1px dashed #ccc;' : ''}">
                                      <span style="font-size: 16px; margin-left: 6px; font-weight: normal; vertical-align: middle;">☐</span>
                                      <span style="vertical-align: middle;">${escapeHtml(t.title)}${repeatText}</span>
                                    </li>
                                  `;
                                }
                                const firstTask = group.tasks[0];
                                const isCastleRev = getCastleIndexFromTaskTitle(firstTask.title);
                                const groupColor =
                                  isCastleRev !== null
                                    ? CASTLES_THEMES[isCastleRev].color
                                    : '#1A2E1A';
                                return `
                                  <li style="padding-bottom: 6px; margin-bottom: 6px; display: block; ${groupIdx !== dayGroups.length - 1 ? 'border-bottom: 1px dashed #ccc;' : ''}">
                                    <div style="font-weight: 800; font-size: 14px; color: ${groupColor}; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                                      <span>📖</span>
                                      <span>المقرر: ${escapeHtml(group.label)}</span>
                                    </div>
                                    <div style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 12px; margin-right: 10px; align-items: center;">
                                      ${group.tasks
                                        .map((t) => {
                                          const itemCastleRev = getCastleIndexFromTaskTitle(t.title);
                                          const tColor =
                                            itemCastleRev !== null
                                              ? CASTLES_THEMES[itemCastleRev].color
                                              : getTaskColor(t.type);
                                          const taskName =
                                            t.type === 'memorization'
                                              ? 'حفظ'
                                              : t.type === 'fixation'
                                                ? 'تثبيت'
                                                : t.type === 'review'
                                                  ? 'مراجعة'
                                                  : t.type === 'cumulative_review'
                                                    ? 'تراكمي'
                                                    : t.type === 'listening'
                                                      ? 'استماع'
                                                      : 'تسميع';
                                          const repeatText =
                                            t.targetCount > 1 ? ` (${t.targetCount}x)` : '';
                                          return `
                                            <span style="font-size: 12.5px; font-weight: bold; color: ${tColor}; display: flex; align-items: center; gap: 4px;">
                                              <span style="font-size: 16px; font-weight: normal; color: #777; vertical-align: middle;">☐</span>
                                              <span style="vertical-align: middle;">${taskName}${repeatText}</span>
                                            </span>
                                          `;
                                        })
                                        .join('')}
                                    </div>
                                  </li>
                                `;
                              })
                              .join('');
                          })()}
                        </ul>
                      </td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>

            <div style="margin-top: auto; padding-top: 15px; text-align: center; font-size: 11px; color: #999;">
              صفحة ${i + 3} من ${chunks.length + 2} | الطالب: ${studentSafe} | ${appSafe} — ${new Date().toLocaleDateString('ar-EG')}
            </div>
          </div>
        `;
      }

      pageElements.push(pageEl);
    }

    // Fast single-page-at-a-time capture (scale 2 + JPEG 0.92, zero blank pages)
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    let addedPages = 0;

    for (let i = 0; i < pageElements.length; i++) {
      const msg =
        i === 0
          ? `جاري معالجة صفحة الغلاف للطالب ${studentName}...`
          : i === 1
            ? `جاري معالجة جدول مقادير القلاع السبع...`
            : `جاري معالجة الأسبوع ${i - 1} من ${chunks.length}...`;
      options.onProgress?.(msg, i + 1, pageElements.length);

      const pageEl = pageElements[i];
      if (!pageEl || !pageEl.innerHTML.trim()) continue;

      const imgData = await capturePageElementToJpeg(pageEl, {
        tempContainer,
        targetWidth,
        targetHeight,
        backgroundColor: pageBgColor,
        scale: 2,
        jpegQuality: 0.92,
      });

      if (addedPages > 0) {
        pdf.addPage('a4', isCastleTowerStyle ? 'l' : 'p');
      }

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      addedPages++;
    }

    const prefix = isCastleTowerStyle ? 'أبراج_القلاع_السبع' : 'خطة_القلاع_السبع';
    const fileName = `${prefix}_${sanitizeFilePart(studentName)}.pdf`;
    const blob = pdf.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });

    return { pdf, blob, file, fileName };
  } finally {
    if (document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
    }
  }
}

/**
 * Generates and directly downloads the student's Seven Castles PDF.
 */
export async function downloadSevenCastlesPdf(
  plan: SevenCastlesPlan,
  options: SevenCastlesPdfOptions = {}
): Promise<GeneratedSevenCastlesPdf> {
  const result = await generateSevenCastlesPdf(plan, options);
  result.pdf.save(result.fileName);
  return result;
}

/**
 * Builds the Arabic WhatsApp message containing the student's name, plan details,
 * and direct clickable link to the student's Daily Tasks page.
 */
export function buildWhatsAppShareMessage(
  plan: SevenCastlesPlan,
  tasksUrl: string,
  appName?: string
): string {
  const dailyAmountLabel = DAILY_AMOUNT_LABELS[plan.dailyAmount] || 'صفحة واحدة';
  const startDateObj = parsePlanDate(plan.startDate);
  const startDateGreg = format(startDateObj, 'yyyy/MM/dd');
  const startDateHijri = getHijriDate(startDateObj);
  const oldMemSummary = plan.hasOldMemorization
    ? formatOldMemorizationSummary(plan.oldMemorizationRanges, plan.oldMemorizedPages)
    : 'لا يوجد';

  const lines = [
    `السلام عليكم ورحمة الله وبركاته 🌿`,
    `الطالب المبارك: *${plan.studentName}*`,
    ``,
    `نرسل لك *خطة القلاع السبع لحفظ القرآن الكريم وتثبيته* الخاصة بك:`,
    `• مقدار الحفظ اليومي: ${dailyAmountLabel}`,
    `• تاريخ البدء: ${startDateHijri} (${startDateGreg} م)`,
    `• الحفظ القديم (للمراجعة اليومية): ${oldMemSummary}`,
    ``,
    `📌 *رابط متابعة مهامك اليومية (الاستماع، الحفظ، التثبيت، المراجعة، التسميع):*`,
    tasksUrl,
    ``,
    `📎 مرفق ملف الـ PDF الكامل للخطة.`,
    appName ? `— ${appName}` : `بارك الله فيك وفتح عليك فتوح العارفين 🤲`,
  ];

  return lines.join('\n');
}

/**
 * Exports the student's Seven Castles PDF and shares it alongside the WhatsApp text message + Daily Tasks link.
 * - On mobile / browsers supporting Web Share Level 2 with files: opens the native share sheet with BOTH the PDF file and the message+link (so the supervisor picks WhatsApp directly).
 * - On desktop / browsers without file sharing: downloads the PDF automatically AND opens WhatsApp Web/App prefilled with the message+link (targeted to `studentPhone` if provided) so the supervisor attaches the downloaded PDF in one click.
 */
export async function shareSevenCastlesPdfAndWhatsApp(
  plan: SevenCastlesPlan,
  params: SevenCastlesPdfOptions & {
    tasksUrl: string;
    studentPhone?: string;
  }
): Promise<{
  sharedNatively: boolean;
  fileName: string;
  message: string;
  whatsappUrl: string;
}> {
  const generated = await generateSevenCastlesPdf(plan, params);
  const message = buildWhatsAppShareMessage(plan, params.tasksUrl, params.appName);

  const cleanPhone = (params.studentPhone || '').replace(/[^\d]/g, '');
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const canShareFiles =
    !!nav &&
    typeof nav.share === 'function' &&
    typeof nav.canShare === 'function' &&
    nav.canShare({ files: [generated.file] });

  if (canShareFiles) {
    try {
      await nav.share({
        files: [generated.file],
        title: `خطة القلاع السبع — ${plan.studentName}`,
        text: message,
      });
      return {
        sharedNatively: true,
        fileName: generated.fileName,
        message,
        whatsappUrl,
      };
    } catch (err: any) {
      if (err && err.name === 'AbortError') {
        return {
          sharedNatively: false,
          fileName: generated.fileName,
          message,
          whatsappUrl,
        };
      }
    }
  }

  // Fallback for desktop / browsers where navigator.share(files) is unavailable:
  // 1) Download the PDF automatically
  generated.pdf.save(generated.fileName);

  // 2) Open WhatsApp via a temporary anchor click (avoids window.open blockers)
  const link = document.createElement('a');
  link.href = whatsappUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return {
    sharedNatively: false,
    fileName: generated.fileName,
    message,
    whatsappUrl,
  };
}
