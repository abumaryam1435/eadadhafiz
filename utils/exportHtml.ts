import { translationMap } from '../constants';
import { getDualDate, gregorianToHijriFormatted } from './exportPdf';
import { toArabicDigits, formatRtlRange } from './juzUtils';

export interface ExportHeader {
  key: string;
  label: string;
  type?: string;
}

export interface CardExportTargetItem {
  id: number | string;
  name: string;
  stage: string | null;
  stageIndex?: number | string;
  color?: string;
}

const escapeHtmlText = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const escapeAttr = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\r\n]+/g, ' ');
};

const renderCell = (value: any, type?: string) => {
  if (value === undefined || value === null || value === '') return '—';
  if (type === 'translation') {
    const translated = translationMap[value as keyof typeof translationMap] || value;
    return escapeHtmlText(toArabicDigits(translated));
  }
  if (type === 'array') return Array.isArray(value) ? escapeHtmlText(value.map(formatRtlRange).join('، ')) : '—';
  if (typeof value === 'number') {
    return escapeHtmlText(toArabicDigits(value));
  }
  if (typeof value === 'string') {
    return escapeHtmlText(formatRtlRange(value));
  }
  return escapeHtmlText(String(value));
};

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return hex;
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Creates and shows a full interactive modal dialog with options for:
 * 1. Sharing via WhatsApp / Apps
 * 2. Instant In-App Interactive Preview (Works 100% in Chrome, Edge, Safari without popup blockers)
 * 3. Downloading HTML File (with UTF-8 BOM so Chrome & Edge open it directly on desktop/mobile)
 */
const showExportDialog = (
  htmlContent: string,
  fileName: string,
  reportTitle: string,
  dialogType: 'report' | 'cards' = 'report'
) => {
  const finalFileName = fileName.toLowerCase().endsWith('.html') ? fileName : `${fileName}.html`;
  
  // Prepend UTF-8 BOM (\uFEFF) to guarantee Chrome & Edge parse Arabic characters flawlessly
  const blobWithBom = new Blob(['\uFEFF', htmlContent], { type: 'text/html;charset=utf-8' });
  const file = new File([blobWithBom], finalFileName, { type: 'text/html;charset=utf-8' });

  const downloadFile = () => {
    const url = URL.createObjectURL(blobWithBom);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const openInteractivePreviewModal = () => {
    const previewModal = document.createElement('div');
    previewModal.id = 'html-interactive-preview-modal';
    previewModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(6px);
      z-index: 100000;
      display: flex;
      flex-direction: column;
      direction: rtl;
      font-family: 'Tajawal', sans-serif;
      animation: fadeIn 0.2s ease-out;
    `;

    previewModal.innerHTML = `
      <div style="background: #006A4E; color: white; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #D4AF37; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
          <span style="font-size: 20px;">🌐</span>
          <span style="font-weight: 800; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">معاينة تفاعلية: ${escapeHtmlText(reportTitle)}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btn-preview-download" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
            <span>تنزيل الملف 📥</span>
          </button>
          <button id="btn-preview-close" style="background: rgba(239, 68, 68, 0.9); color: white; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;">
            ✕ إغلاق المعاينة
          </button>
        </div>
      </div>
      <div style="flex: 1; width: 100%; height: calc(100% - 60px); position: relative; background: #f1f5f9;">
        <iframe id="interactive-preview-frame" style="width: 100%; height: 100%; border: none;" title="معاينة التقرير التفاعلي"></iframe>
      </div>
    `;

    document.body.appendChild(previewModal);

    const frame = previewModal.querySelector('#interactive-preview-frame') as HTMLIFrameElement;
    if (frame) {
      setTimeout(() => {
        try {
          const doc = frame.contentWindow?.document || frame.contentDocument;
          if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();
          }
        } catch (e) {
          console.warn('Fallback iframe src setting:', e);
          const blobUrl = URL.createObjectURL(blobWithBom);
          frame.src = blobUrl;
        }
      }, 50);
    }

    const btnClosePreview = previewModal.querySelector('#btn-preview-close') as HTMLButtonElement;
    const btnDownloadPreview = previewModal.querySelector('#btn-preview-download') as HTMLButtonElement;

    if (btnClosePreview) {
      btnClosePreview.onclick = () => {
        if (document.body.contains(previewModal)) {
          document.body.removeChild(previewModal);
        }
      };
    }

    if (btnDownloadPreview) {
      btnDownloadPreview.onclick = () => {
        downloadFile();
      };
    }
  };

  // Main Options Modal
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    direction: rtl;
    font-family: 'Tajawal', sans-serif;
    animation: fadeIn 0.2s ease-out;
  `;

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  const isCards = dialogType === 'cards';
  const headingText = isCards ? 'تم تجهيز قائمة البطاقات التفاعلية!' : 'تم تجهيز التقرير التفاعلي!';
  const descText = isCards
    ? 'ملف HTML تفاعلي ذكي يفتح بنقرة على Google Chrome و Edge وجميع الأجهزة ويدعم البحث الفوري وتصفية المراحل والطباعة:'
    : 'ملف HTML تفاعلي ذكي يفتح بنقرة على Google Chrome و Edge وجميع الأجهزة ويدعم البحث الفوري وتصفية الطلاب والطباعة:';

  overlay.innerHTML = `
    <div style="background: white; border-radius: 20px; padding: 28px 24px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 370px; max-width: 92%; direction: rtl;">
      <div style="display: flex; justify-content: center; margin-bottom: 16px;">
        <div style="width: 60px; height: 60px; background-color: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #a7f3d0;">
          <span style="font-size: 30px;">🌐</span>
        </div>
      </div>
      <h3 style="color: #006A4E; font-size: 19px; font-weight: 900; margin: 0 0 6px 0;">${headingText}</h3>
      <p style="color: #64748b; font-size: 12.5px; margin: 0 0 20px 0; font-weight: 600; line-height: 1.45;">
        ${descText}
      </p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${hasNativeShare ? `
        <button id="btn-share-html" style="background: #006A4E; color: white; border: none; padding: 13px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,106,78,0.25);">
          <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
          مشاركة عبر الواتساب والتطبيقات
        </button>` : ''}
        <button id="btn-preview-html" style="background: #0284c7; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 13.5px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(2,132,199,0.25);">
          <span>معاينة وتجربة الملف الآن 👁️</span>
        </button>
        <button id="btn-download-html" style="background: #f1f5f9; color: #1e293b; border: 1.5px solid #cbd5e1; padding: 11px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 13.5px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>تنزيل وحفظ ملف HTML 📥</span>
        </button>
        <button id="btn-close-html" style="background: transparent; color: #94a3b8; border: none; padding: 8px; font-weight: 700; cursor: pointer; font-size: 13px; margin-top: 2px;">إغلاق النافذة</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const btnShare = overlay.querySelector('#btn-share-html') as HTMLButtonElement | null;
  const btnPreview = overlay.querySelector('#btn-preview-html') as HTMLButtonElement;
  const btnDownload = overlay.querySelector('#btn-download-html') as HTMLButtonElement;
  const btnClose = overlay.querySelector('#btn-close-html') as HTMLButtonElement;

  if (btnShare) {
    btnShare.onclick = async () => {
      try {
        const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share({
            files: [file],
            title: reportTitle || fileName,
            text: `${reportTitle || fileName}`
          });
        } else {
          downloadFile();
          if (navigator.share) {
            await navigator.share({
              title: reportTitle || fileName,
              text: `${reportTitle || fileName}`
            });
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          downloadFile();
        }
      }
    };
  }

  if (btnPreview) {
    btnPreview.onclick = () => {
      openInteractivePreviewModal();
    };
  }

  if (btnDownload) {
    btnDownload.onclick = () => {
      downloadFile();
    };
  }

  if (btnClose) {
    btnClose.onclick = () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    };
  }
};

/**
 * Generates and shares an interactive HTML report with smart search and quick-filter dropdown.
 */
export const shareHtmlViaWhatsApp = async (
  headers: ExportHeader[], 
  data: any[], 
  fileName: string, 
  reportTitle: string, 
  subtitle?: string, 
  adjustments: Record<string, number> = {}, 
  colorMap: Record<string, string> = {},
  rankColors?: any
) => {
  const today = new Date();
  const dateLine = gregorianToHijriFormatted(today, adjustments);

  // Extract unique student names for quick-filter dropdown
  const uniqueStudents = Array.from(
    new Set(data.map(item => String(item.studentName || item.name || '').trim()).filter(Boolean))
  ).sort((a: string, b: string) => a.localeCompare(b, 'ar'));

  // Table Headers
  const ths = headers.map(h => {
    const isSequence =
      h.key === 'sequence' ||
      h.key === 'serialNumber' ||
      h.key === 'index' ||
      h.key === 'no' ||
      h.label === '#' ||
      h.label === 'م' ||
      h.label === 'الرقم' ||
      h.label === 'التسلسل';
    const seqStyle = isSequence ? 'style="width: 1% !important; white-space: nowrap !important; min-width: 32px; max-width: 45px; text-align: center;"' : '';
    return `<th ${seqStyle}>${escapeHtmlText(h.label)}</th>`;
  }).join('');

  // Table Rows
  const trs = data.map((item, idx) => {
    const bgClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    let rowColor = '#1f2937';
    const isAbsentOrNotRecorded = item.attendance === 'absent' || item.attendance === 'not_recorded';
    
    if (isAbsentOrNotRecorded && item.attendance && colorMap[item.attendance]) {
      rowColor = colorMap[item.attendance];
    } else if (item.performance && colorMap[item.performance]) {
      rowColor = colorMap[item.performance];
    } else if (item.evalStatus && colorMap[item.evalStatus]) {
      rowColor = colorMap[item.evalStatus];
    }

    const studentNameVal = String(item.studentName || item.name || '').trim();

    const tds = headers.map(h => {
      const value = item[h.key];
      let content = renderCell(value, h.type);
      let cellStyle = '';
      
      const isSequence =
        h.key === 'sequence' ||
        h.key === 'serialNumber' ||
        h.key === 'index' ||
        h.key === 'no' ||
        h.label === '#' ||
        h.label === 'م' ||
        h.label === 'الرقم' ||
        h.label === 'التسلسل';

      if (isSequence) {
        cellStyle += ' width: 1% !important; white-space: nowrap !important; min-width: 32px; max-width: 45px; text-align: center; font-weight: 800; font-family: monospace;';
      }

      if (h.key === 'studentName' || h.key === 'name') {
        cellStyle += ' font-weight: 900; text-align: right; color: #044e3b; font-size: 14px;';
      }

      if (h.key === 'attendance' && item.attendance && colorMap[item.attendance] && !isAbsentOrNotRecorded) {
        cellStyle += `background-color: ${hexToRgba(colorMap[item.attendance], 0.15)}; font-weight: 800;`;
      } else if (h.key === 'periodicReview' && item.periodicReview && colorMap[item.periodicReview]) {
        cellStyle += `background-color: ${hexToRgba(colorMap[item.periodicReview], 0.15)}; font-weight: 800;`;
      } else if (h.key === 'level' && item.level && colorMap[item.level]) {
        cellStyle += `background-color: ${hexToRgba(colorMap[item.level], 0.15)}; color: ${colorMap[item.level]}; font-weight: 900;`;
      } else if (h.key === 'evalStatus' && item.evalStatus && colorMap[item.evalStatus]) {
        cellStyle += `background-color: ${hexToRgba(colorMap[item.evalStatus], 0.15)}; font-weight: 800;`;
      } else if (h.key === 'performance' && item.performance && colorMap[item.performance]) {
        cellStyle += `background-color: ${hexToRgba(colorMap[item.performance], 0.15)}; font-weight: 800;`;
      }

      // Rank styling if available
      if (h.key === 'rank' && item.rank && rankColors && rankColors[item.rank]) {
        const rc = rankColors[item.rank];
        content = `<span style="background:${rc.bg}; color:${rc.text}; border:1.5px solid ${rc.border}; padding:3px 10px; border-radius:8px; font-weight:900; font-size:12.5px;">${content}</span>`;
      }
      
      if ((h.key === 'evaluationDate' || h.key === 'date') && value && value !== '—') {
        const dual = getDualDate(value, adjustments);
        if (dual) {
          content = `
            <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.3;">
              <span style="font-weight: 800; font-size: 0.95em; color:#064e3b;">${escapeHtmlText(dual.hijri)}</span>
              <span style="font-size: 0.82em; opacity: 0.85; font-family: monospace; font-weight: 600;">${escapeHtmlText(dual.gregorian)}</span>
            </div>`;
        }
      }
      
      if (h.key === 'isAlAmeenStr' || h.key === 'isFromIbriStr') {
        if (value === 'نعم') {
          content = `<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:2px 8px; border-radius:6px; font-weight:800; font-size:12px;">نعم</span>`;
        }
      }
      
      if (h.key === 'studentLevel' && value && value !== '—') {
        content = `<span style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; padding:2px 8px; border-radius:6px; font-weight:800; font-size:12px;">${content}</span>`;
      }

      if (h.key === 'schoolStage' && value && value !== '—') {
        content = `<span style="background:#f8fafc; color:#334155; border:1px solid #cbd5e1; padding:2px 8px; border-radius:6px; font-weight:800; font-size:12px;">${content}</span>`;
      }
      
      return `<td class="${isSequence ? 'seq-cell' : ''}" style="color:${rowColor}; ${cellStyle}">${content}</td>`;
    }).join('');
    
    const searchTokens = [
      studentNameVal,
      item.studentOriginalHalaqaName || '',
      item.halaqaName || '',
      item.evaluatorName || '',
      item.teacherName || '',
      item.schoolStage || '',
      item.studentLevel || '',
      item.stage || '',
      item.parentPhone || '',
      item.autoCompletedJuzsStr || '',
      item.combinedMemorizedPagesStr || '',
      item.surahs?.map((s: any) => typeof s === 'string' ? s : s.name).join(' ') || '',
      item.ayahsDetails || item.notes || '',
      item.performance || item.attendance || '',
      item.weekNumber ? `أسبوع ${item.weekNumber}` : ''
    ].filter(Boolean).join(' ');

    return `<tr class="data-row ${bgClass}" data-student="${escapeAttr(studentNameVal)}" data-search="${escapeAttr(searchTokens)}">${tds}</tr>`;
  }).join('');

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>${escapeHtmlText(reportTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:wght@400;700&display=swap" rel="stylesheet" media="all">
  <style>
    * { box-sizing: border-box; }
    html, body, button, input, select, textarea, table, th, td { 
      font-family: 'Tajawal', 'Amiri', 'Segoe UI', Tahoma, Arial, sans-serif !important; 
    }
    html, body { margin: 0; padding: 0; min-height: 100%; background-color: #f1f5f9; color: #1e293b; }
    
    .container {
      width: 100%;
      max-width: 1300px;
      margin: 0 auto;
      padding: 12px 10px 40px;
    }

    .report-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
      position: relative;
    }

    .header-section {
      background: linear-gradient(135deg, #006A4E 0%, #064e3b 100%);
      color: white;
      padding: 20px 16px;
      text-align: center;
      position: relative;
      border-radius: 15px 15px 0 0;
      border-bottom: 3px solid #D4AF37;
    }
    .header-section h1 { margin: 0; font-size: 1.35rem; font-weight: 900; letter-spacing: -0.02em; }
    .header-section .subtitle { font-size: 0.92rem; opacity: 0.95; margin-top: 6px; font-weight: 700; }
    .header-section .date { font-size: 0.82rem; opacity: 0.88; margin-top: 6px; font-weight: 500; }

    /* Interactive Controls Panel */
    .controls-panel {
      padding: 14px 16px;
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      position: relative;
      z-index: 50;
    }

    .filter-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 280px;
    }

    .search-wrapper {
      position: relative;
      flex: 1;
      min-width: 200px;
    }
    .search-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 14px;
      color: #94a3b8;
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      padding: 10px 36px 10px 12px;
      border: 2px solid #cbd5e1;
      border-radius: 12px;
      font-size: 0.92rem;
      font-weight: 700;
      background: white;
      color: #0f172a;
      transition: all 0.2s;
      outline: none;
    }
    .search-input:focus {
      border-color: #006A4E;
      box-shadow: 0 0 0 3px rgba(0, 106, 78, 0.15);
    }
    .clear-btn {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: #e2e8f0;
      color: #475569;
      border: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 900;
    }

    /* Multi-select dropdown styles */
    .dropdown-container {
      position: relative;
      min-width: 210px;
      max-width: 320px;
      flex: 1;
    }
    .dropdown-btn {
      width: 100%;
      padding: 10px 14px;
      border: 2px solid #cbd5e1;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 800;
      background: white;
      color: #065f46;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      transition: all 0.2s;
      outline: none;
      text-align: right;
    }
    .dropdown-btn:hover {
      border-color: #006A4E;
    }
    .dropdown-btn.active {
      border-color: #006A4E;
      box-shadow: 0 0 0 3px rgba(0, 106, 78, 0.15);
    }
    .dropdown-btn-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }
    .dropdown-btn-arrow {
      font-size: 11px;
      color: #64748b;
      transition: transform 0.2s;
    }
    .dropdown-btn.active .dropdown-btn-arrow {
      transform: rotate(180deg);
    }
    .dropdown-panel {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 320px;
      max-width: 90vw;
      background: white;
      border: 2px solid #006A4E;
      border-radius: 16px;
      box-shadow: 0 15px 35px -5px rgba(0,0,0,0.25);
      z-index: 9999;
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .dropdown-panel.show {
      display: flex !important;
    }
    .dropdown-search-box {
      padding: 10px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      position: relative;
    }
    .dropdown-search-input {
      width: 100%;
      padding: 8px 32px 8px 10px;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 700;
      outline: none;
      background: white;
      color: #0f172a;
    }
    .dropdown-search-input:focus {
      border-color: #006A4E;
    }
    .dropdown-search-icon {
      position: absolute;
      right: 22px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 12px;
      color: #94a3b8;
      pointer-events: none;
    }
    .dropdown-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
    }
    .btn-action {
      flex: 1;
      padding: 6px 10px;
      font-size: 0.78rem;
      font-weight: 800;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-select-all {
      background: #006A4E;
      color: white;
    }
    .btn-select-all:hover {
      background: #064e3b;
    }
    .btn-deselect-all {
      background: #e2e8f0;
      color: #475569;
    }
    .btn-deselect-all:hover {
      background: #cbd5e1;
    }
    .dropdown-options-list {
      max-height: 250px;
      overflow-y: auto;
      padding: 6px 0;
    }
    .dropdown-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 700;
      color: #1e293b;
      transition: background-color 0.15s;
      user-select: none;
    }
    .dropdown-option:hover {
      background-color: #f0fdf4;
    }
    .dropdown-checkbox {
      width: 17px;
      height: 17px;
      accent-color: #006A4E;
      cursor: pointer;
    }

    .action-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .badge-count {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .btn-print {
      background: #006A4E;
      color: white;
      border: none;
      padding: 9px 16px;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn-print:hover { background: #064e3b; }

    /* Table styling with sticky header */
    .table-container {
      width: 100%;
      overflow-x: auto;
      max-height: 78vh;
      position: relative;
    }
    
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: auto;
    }

    th {
      background: #006A4E !important;
      color: white !important;
      padding: 12px 8px;
      text-align: center;
      font-weight: 800;
      font-size: 13.5px;
      position: sticky;
      top: 0;
      z-index: 20;
      border-bottom: 2px solid #D4AF37;
      border-right: 1px solid rgba(255, 255, 255, 0.2);
      white-space: nowrap;
      letter-spacing: -0.01em;
    }
    th:first-child { border-right: none; }

    td {
      padding: 11px 8px;
      border-bottom: 1px solid #cbd5e1;
      border-right: 1px solid #e2e8f0;
      text-align: center;
      vertical-align: middle;
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.45;
    }
    td:first-child { border-right: none; }

    tr.bg-white { background-color: #ffffff; }
    tr.bg-gray-50 { background-color: #f8fafc; }
    tr.data-row:hover { background-color: #f0fdf4 !important; }

    .no-results {
      padding: 40px 20px;
      text-align: center;
      color: #64748b;
      font-weight: 800;
      font-size: 1rem;
      display: none;
    }

    .footer-bar {
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: #64748b;
      font-weight: 700;
      border-radius: 0 0 15px 15px;
    }

    @media print {
      body { background: white; }
      .container { padding: 0; max-width: 100%; }
      .controls-panel, .clear-btn, .btn-print { display: none !important; }
      .table-container { max-height: none !important; overflow: visible !important; }
      th { position: static !important; }
      .report-card { box-shadow: none !important; border: none !important; }
    }

    @media (max-width: 640px) {
      .container { padding: 4px; }
      .header-section { padding: 14px 10px; }
      .header-section h1 { font-size: 1.15rem; }
      .controls-panel { padding: 10px; gap: 8px; }
      .filter-group { min-width: 100%; }
      .dropdown-container { min-width: 100%; max-width: 100%; }
      .dropdown-panel { width: 100%; max-width: 100%; right: 0; left: 0; }
      .badge-count { font-size: 0.82rem; padding: 6px 10px; }
      th { font-size: 12px; padding: 9px 5px; }
      td { font-size: 12px; padding: 9px 5px; font-weight: 700; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="report-card">
      <div class="header-section">
        <h1>${escapeHtmlText(reportTitle)}</h1>
        ${subtitle ? `<div class="subtitle">${escapeHtmlText(subtitle)}</div>` : ''}
        <div class="date">${escapeHtmlText(dateLine)}</div>
      </div>

      <!-- Controls & Search -->
      <div class="controls-panel">
        <div class="filter-group">
          <div class="search-wrapper">
            <span class="search-icon">🔍</span>
            <input 
              type="text" 
              id="searchInput" 
              class="search-input" 
              placeholder="ابحث بأي جزء من اسم الطالب، الأسبوع، الحلقة..." 
              autocomplete="off"
            />
            <button type="button" id="clearBtn" class="clear-btn" title="مسح">✕</button>
          </div>

          ${uniqueStudents.length > 1 ? `
          <div class="dropdown-container" id="studentDropdownContainer">
            <button type="button" id="studentDropdownBtn" class="dropdown-btn">
              <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
                <span>👤</span>
                <span id="studentDropdownLabel" class="dropdown-btn-label">كل الطلاب (${uniqueStudents.length})</span>
              </div>
              <span class="dropdown-btn-arrow">▼</span>
            </button>
            <div id="studentDropdownPanel" class="dropdown-panel">
              <div class="dropdown-search-box">
                <span class="dropdown-search-icon">🔍</span>
                <input 
                  type="text" 
                  id="studentSearchInput" 
                  class="dropdown-search-input" 
                  placeholder="بحث سريع في أسماء الطلاب..." 
                  autocomplete="off"
                />
              </div>
              <div class="dropdown-actions">
                <button type="button" id="btnSelectAllStudents" class="btn-action btn-select-all">تحديد الكل</button>
                <button type="button" id="btnDeselectAllStudents" class="btn-action btn-deselect-all">إلغاء التحديد</button>
              </div>
              <div id="studentOptionsList" class="dropdown-options-list">
                ${uniqueStudents.map((name) => `
                  <label class="dropdown-option" data-student-name="${escapeAttr(name)}">
                    <input type="checkbox" class="dropdown-checkbox student-cb" value="${escapeAttr(name)}" checked />
                    <span>${escapeHtmlText(name)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>` : ''}
        </div>

        <div class="action-group">
          <div class="badge-count">
            المطابق: <span id="matchCount">${data.length}</span> من أصل <span id="totalCount">${data.length}</span>
          </div>
          <button class="btn-print" onclick="window.print()">
            <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            <span>طباعة</span>
          </button>
        </div>
      </div>

      <!-- Table Container -->
      <div class="table-container">
        <table id="reportTable">
          <thead>
            <tr>${ths}</tr>
          </thead>
          <tbody id="tableBody">
            ${trs}
          </tbody>
        </table>
        <div id="noResults" class="no-results">
          لا توجد سجلات مطابقة للبحث المحدد 🔍
        </div>
      </div>

      <div class="footer-bar">
        <span>تقرير إلكتروني تفاعلي</span>
        <span>${escapeHtmlText(dateLine)}</span>
      </div>
    </div>
  </div>

  <script>
    (function() {
      'use strict';
      function toArray(list) {
        if (!list) return [];
        var arr = [];
        for (var i = 0; i < list.length; i++) { arr.push(list[i]); }
        return arr;
      }

      function normalizeArabic(text) {
        if (!text) return "";
        var str = String(text).toLowerCase();
        str = str.replace(/[أإآ]/g, "ا")
                 .replace(/ة/g, "ه")
                 .replace(/ى/g, "ي")
                 .replace(/[\\u064B-\\u065F\\u0670]/g, "")
                 .replace(/ـ+/g, "");
        var arDigits = "٠١٢٣٤٥٦٧٨٩";
        for (var d = 0; d < 10; d++) {
          str = str.split(arDigits[d]).join(String(d));
        }
        return str.replace(/[\\r\\n\\t]+/g, " ").replace(/\\s+/g, " ").trim();
      }

      function isSmartMatch(targetText, query) {
        var normalizedQuery = normalizeArabic(query);
        if (!normalizedQuery) return true;

        var tokens = normalizedQuery.split(" ").filter(function(t) { return t.length > 0; });
        var normalizedTarget = normalizeArabic(targetText);

        for (var i = 0; i < tokens.length; i++) {
          if (normalizedTarget.indexOf(tokens[i]) === -1) {
            return false;
          }
        }
        return true;
      }

      function renumberVisibleRows() {
        var seq = 1;
        var rows = toArray(document.querySelectorAll("#tableBody tr.data-row"));
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (row.style.display !== "none") {
            var seqCell = row.querySelector(".seq-cell");
            if (seqCell) {
              seqCell.textContent = seq;
              seq++;
            }
          }
        }
      }

      function updateStudentLabel() {
        var label = document.getElementById("studentDropdownLabel");
        if (!label) return;
        var cbs = toArray(document.querySelectorAll(".student-cb"));
        var total = cbs.length;
        var checked = 0;
        var firstChecked = "";
        for (var i = 0; i < total; i++) {
          if (cbs[i].checked) {
            checked++;
            if (!firstChecked) firstChecked = cbs[i].value;
          }
        }

        if (total === 0 || checked === total) {
          label.textContent = "كل الطلاب (" + total + ")";
        } else if (checked === 0) {
          label.textContent = "لم يتم اختيار أي طالب (0)";
        } else if (checked === 1) {
          label.textContent = firstChecked;
        } else {
          label.textContent = checked + " طلاب محددين";
        }
      }

      function filterTable() {
        try {
          var searchInput = document.getElementById("searchInput");
          var rawQuery = searchInput ? (searchInput.value || "") : "";
          var clearBtn = document.getElementById("clearBtn");
          if (clearBtn) {
            clearBtn.style.display = rawQuery.trim() ? "flex" : "none";
          }

          var studentCbs = toArray(document.querySelectorAll(".student-cb"));
          var totalCbs = studentCbs.length;
          var checkedMap = {};
          var checkedCount = 0;
          for (var c = 0; c < totalCbs; c++) {
            if (studentCbs[c].checked) {
              checkedMap[studentCbs[c].value.trim()] = true;
              checkedCount++;
            }
          }

          var filterByStudent = totalCbs > 0 && checkedCount < totalCbs;
          var rows = toArray(document.querySelectorAll("#tableBody tr.data-row"));
          var matchCount = document.getElementById("matchCount");
          var noResults = document.getElementById("noResults");
          var visibleCount = 0;

          for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            var rowSearchText = row.getAttribute("data-search") || row.textContent || "";
            var studentAttr = (row.getAttribute("data-student") || "").trim();

            var matchesQuery = !rawQuery.trim() || isSmartMatch(rowSearchText, rawQuery);
            var matchesStudent = !filterByStudent || !!checkedMap[studentAttr];

            if (matchesQuery && matchesStudent) {
              row.style.display = "";
              visibleCount++;
            } else {
              row.style.display = "none";
            }
          }

          if (matchCount) {
            matchCount.textContent = visibleCount;
          }
          if (noResults) {
            noResults.style.display = visibleCount === 0 ? "block" : "none";
          }

          renumberVisibleRows();
        } catch (err) {
          console.error("Filter error:", err);
        }
      }

      function filterStudentOptions() {
        var input = document.getElementById("studentSearchInput");
        var q = input ? (input.value || "") : "";
        var options = toArray(document.querySelectorAll(".dropdown-option"));
        for (var i = 0; i < options.length; i++) {
          var opt = options[i];
          var name = opt.getAttribute("data-student-name") || opt.textContent || "";
          if (!q.trim() || isSmartMatch(name, q)) {
            opt.style.display = "flex";
          } else {
            opt.style.display = "none";
          }
        }
      }

      function toggleStudentDropdown(e) {
        if (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
        }
        var panel = document.getElementById("studentDropdownPanel");
        var btn = document.getElementById("studentDropdownBtn");
        if (!panel) return;
        var isOpen = panel.classList.contains("show");
        if (isOpen) {
          panel.classList.remove("show");
          if (btn) btn.classList.remove("active");
        } else {
          panel.classList.add("show");
          if (btn) btn.classList.add("active");
          var searchIn = document.getElementById("studentSearchInput");
          if (searchIn) {
            searchIn.value = "";
            filterStudentOptions();
          }
        }
      }

      function closeStudentDropdown() {
        var panel = document.getElementById("studentDropdownPanel");
        var btn = document.getElementById("studentDropdownBtn");
        if (panel) panel.classList.remove("show");
        if (btn) btn.classList.remove("active");
      }

      function selectAllStudents(e) {
        if (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
        }
        var cbs = toArray(document.querySelectorAll(".student-cb"));
        for (var i = 0; i < cbs.length; i++) {
          cbs[i].checked = true;
        }
        updateStudentLabel();
        filterTable();
      }

      function deselectAllStudents(e) {
        if (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
        }
        var cbs = toArray(document.querySelectorAll(".student-cb"));
        for (var i = 0; i < cbs.length; i++) {
          cbs[i].checked = false;
        }
        updateStudentLabel();
        filterTable();
      }

      function clearSearch() {
        var searchInput = document.getElementById("searchInput");
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }
        filterTable();
      }

      function initListeners() {
        try {
          var searchInput = document.getElementById("searchInput");
          if (searchInput) {
            searchInput.addEventListener("input", function() { filterTable(); });
            searchInput.addEventListener("keyup", function() { filterTable(); });
          }

          var clearBtn = document.getElementById("clearBtn");
          if (clearBtn) {
            clearBtn.addEventListener("click", function(e) {
              e.preventDefault();
              clearSearch();
            });
          }

          var studentDropdownBtn = document.getElementById("studentDropdownBtn");
          if (studentDropdownBtn) {
            studentDropdownBtn.addEventListener("click", function(e) {
              toggleStudentDropdown(e);
            });
          }

          var studentSearchInput = document.getElementById("studentSearchInput");
          if (studentSearchInput) {
            studentSearchInput.addEventListener("input", function() { filterStudentOptions(); });
          }

          var btnSelectAll = document.getElementById("btnSelectAllStudents");
          if (btnSelectAll) {
            btnSelectAll.addEventListener("click", function(e) { selectAllStudents(e); });
          }

          var btnDeselectAll = document.getElementById("btnDeselectAllStudents");
          if (btnDeselectAll) {
            btnDeselectAll.addEventListener("click", function(e) { deselectAllStudents(e); });
          }

          var cbs = toArray(document.querySelectorAll(".student-cb"));
          for (var i = 0; i < cbs.length; i++) {
            cbs[i].addEventListener("change", function() {
              updateStudentLabel();
              filterTable();
            });
          }

          document.addEventListener("click", function(e) {
            var container = document.getElementById("studentDropdownContainer");
            if (container && !container.contains(e.target)) {
              closeStudentDropdown();
            }
          });

          document.addEventListener("keydown", function(e) {
            if (e.key === "Escape") {
              closeStudentDropdown();
            }
          });

          updateStudentLabel();
          filterTable();
        } catch (err) {
          console.warn("Init listeners error:", err);
        }
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initListeners);
      } else {
        initListeners();
      }
    })();
  </script>
</body>
</html>`;

  showExportDialog(htmlContent, fileName, reportTitle, 'report');
};

/**
 * Generates and shares an interactive HTML cards name list with smart search, stage filtering, and printing.
 */
export const shareCardsListHtml = async (
  targets: CardExportTargetItem[],
  fileName: string = 'قائمة_الأسماء_للبطاقات',
  reportTitle: string = 'قائمة الأسماء لإصدار البطاقات التعريفية',
  subtitle?: string,
  stageColors: Record<string, string> = {},
  adjustments: Record<string, number> = {}
) => {
  const today = new Date();
  const dateLine = gregorianToHijriFormatted(today, adjustments);

  // Extract unique stages
  const uniqueStages = Array.from(
    new Set(targets.map(t => String(t.stage || '').trim()).filter(Boolean))
  ).sort((a: string, b: string) => a.localeCompare(b, 'ar'));

  // Table Rows for Cards List
  const trs = targets.map((item, idx) => {
    const bgClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    const targetStage = item.stage ? String(item.stage).trim() : 'عام';
    const stageColor = (item.stage && stageColors[item.stage]) || item.color || '#059669';
    const stageIndexVal = item.stageIndex !== undefined && item.stageIndex !== null ? toArabicDigits(item.stageIndex) : toArabicDigits(idx + 1);
    const nameVal = String(item.name || '').trim();

    const searchTokens = [
      nameVal,
      targetStage,
      String(item.stageIndex || ''),
      String(idx + 1)
    ].filter(Boolean).join(' ');

    return `
      <tr class="data-row ${bgClass}" data-stage="${escapeAttr(targetStage)}" data-name="${escapeAttr(nameVal)}" data-search="${escapeAttr(searchTokens)}">
        <td class="seq-cell" style="width: 1% !important; white-space: nowrap !important; min-width: 32px; max-width: 48px; text-align: center; font-weight: 800; font-family: monospace; color: #475569;">${toArabicDigits(idx + 1)}</td>
        <td style="font-weight: 900; text-align: right; color: #044e3b; font-size: 14.5px; padding-right: 14px;">${escapeHtmlText(nameVal)}</td>
        <td style="text-align: center;">
          <span style="display: inline-flex; align-items: center; gap: 6px; color: ${stageColor}; font-weight: 800; font-size: 12.5px; background-color: ${hexToRgba(stageColor, 0.12)}; border: 1.5px solid ${hexToRgba(stageColor, 0.3)}; padding: 3px 12px; border-radius: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${stageColor};"></span>
            ${escapeHtmlText(targetStage)}
          </span>
        </td>
        <td style="text-align: center; font-weight: 800; font-family: monospace; font-size: 13.5px; color: #334155;">${escapeHtmlText(stageIndexVal)}</td>
      </tr>
    `;
  }).join('');

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>${escapeHtmlText(reportTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:wght@400;700&display=swap" rel="stylesheet" media="all">
  <style>
    * { box-sizing: border-box; }
    html, body, button, input, select, textarea, table, th, td { 
      font-family: 'Tajawal', 'Amiri', 'Segoe UI', Tahoma, Arial, sans-serif !important; 
    }
    html, body { margin: 0; padding: 0; min-height: 100%; background-color: #f1f5f9; color: #1e293b; }
    
    .container {
      width: 100%;
      max-width: 1100px;
      margin: 0 auto;
      padding: 14px 10px 40px;
    }

    .report-card {
      background: white;
      border-radius: 18px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04);
      border: 1px solid #e2e8f0;
      position: relative;
    }

    .header-section {
      background: linear-gradient(135deg, #006A4E 0%, #064e3b 100%);
      color: white;
      padding: 22px 18px;
      text-align: center;
      position: relative;
      border-radius: 17px 17px 0 0;
      border-bottom: 3px solid #D4AF37;
    }
    .header-section h1 { margin: 0; font-size: 1.4rem; font-weight: 900; letter-spacing: -0.02em; }
    .header-section .subtitle { font-size: 0.95rem; opacity: 0.95; margin-top: 6px; font-weight: 700; }
    .header-section .date { font-size: 0.84rem; opacity: 0.88; margin-top: 6px; font-weight: 500; }

    /* Interactive Controls Panel */
    .controls-panel {
      padding: 14px 16px;
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      position: relative;
      z-index: 50;
    }

    .filter-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 280px;
    }

    .search-wrapper {
      position: relative;
      flex: 1;
      min-width: 220px;
    }
    .search-icon {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 15px;
      color: #94a3b8;
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      padding: 10px 38px 10px 14px;
      border: 2px solid #cbd5e1;
      border-radius: 12px;
      font-size: 0.92rem;
      font-weight: 700;
      background: white;
      color: #0f172a;
      transition: all 0.2s;
      outline: none;
    }
    .search-input:focus {
      border-color: #006A4E;
      box-shadow: 0 0 0 3px rgba(0, 106, 78, 0.15);
    }
    .clear-btn {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: #e2e8f0;
      color: #475569;
      border: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 900;
    }

    /* Multi-select dropdown styles */
    .dropdown-container {
      position: relative;
      min-width: 210px;
      max-width: 320px;
      flex: 1;
    }
    .dropdown-btn {
      width: 100%;
      padding: 10px 14px;
      border: 2px solid #cbd5e1;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 800;
      background: white;
      color: #065f46;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      transition: all 0.2s;
      outline: none;
      text-align: right;
    }
    .dropdown-btn:hover { border-color: #006A4E; }
    .dropdown-btn.active {
      border-color: #006A4E;
      box-shadow: 0 0 0 3px rgba(0, 106, 78, 0.15);
    }
    .dropdown-btn-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }
    .dropdown-btn-arrow {
      font-size: 11px;
      color: #64748b;
      transition: transform 0.2s;
    }
    .dropdown-btn.active .dropdown-btn-arrow {
      transform: rotate(180deg);
    }
    .dropdown-panel {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 320px;
      max-width: 90vw;
      background: white;
      border: 2px solid #006A4E;
      border-radius: 16px;
      box-shadow: 0 15px 35px -5px rgba(0,0,0,0.25);
      z-index: 9999;
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .dropdown-panel.show { display: flex !important; }
    .dropdown-search-box {
      padding: 10px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      position: relative;
    }
    .dropdown-search-input {
      width: 100%;
      padding: 8px 32px 8px 10px;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 700;
      outline: none;
      background: white;
      color: #0f172a;
    }
    .dropdown-search-input:focus { border-color: #006A4E; }
    .dropdown-search-icon {
      position: absolute;
      right: 22px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 12px;
      color: #94a3b8;
      pointer-events: none;
    }
    .dropdown-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
    }
    .btn-action {
      flex: 1;
      padding: 6px 10px;
      font-size: 0.78rem;
      font-weight: 800;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-select-all { background: #006A4E; color: white; }
    .btn-select-all:hover { background: #064e3b; }
    .btn-deselect-all { background: #e2e8f0; color: #475569; }
    .btn-deselect-all:hover { background: #cbd5e1; }
    .dropdown-options-list {
      max-height: 250px;
      overflow-y: auto;
      padding: 6px 0;
    }
    .dropdown-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 700;
      color: #1e293b;
      transition: background-color 0.15s;
      user-select: none;
    }
    .dropdown-option:hover { background-color: #f0fdf4; }
    .dropdown-checkbox {
      width: 17px;
      height: 17px;
      accent-color: #006A4E;
      cursor: pointer;
    }

    .action-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .badge-count {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .btn-print {
      background: #006A4E;
      color: white;
      border: none;
      padding: 9px 16px;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn-print:hover { background: #064e3b; }

    /* Table styling with sticky header */
    .table-container {
      width: 100%;
      overflow-x: auto;
      max-height: 75vh;
      position: relative;
    }
    
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: auto;
    }

    th {
      background: #006A4E !important;
      color: white !important;
      padding: 12px 10px;
      text-align: center;
      font-weight: 800;
      font-size: 13.5px;
      position: sticky;
      top: 0;
      z-index: 20;
      border-bottom: 2px solid #D4AF37;
      border-right: 1px solid rgba(255, 255, 255, 0.2);
      white-space: nowrap;
    }
    th:first-child { border-right: none; }

    td {
      padding: 10px 10px;
      border-bottom: 1px solid #cbd5e1;
      border-right: 1px solid #e2e8f0;
      text-align: center;
      vertical-align: middle;
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.45;
    }
    td:first-child { border-right: none; }

    tr.bg-white { background-color: #ffffff; }
    tr.bg-gray-50 { background-color: #f8fafc; }
    tr.data-row:hover { background-color: #f0fdf4 !important; }

    .no-results {
      padding: 40px 20px;
      text-align: center;
      color: #64748b;
      font-weight: 800;
      font-size: 1rem;
      display: none;
    }

    .footer-bar {
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: #64748b;
      font-weight: 700;
      border-radius: 0 0 17px 17px;
    }

    @media print {
      body { background: white; }
      .container { padding: 0; max-width: 100%; }
      .controls-panel, .clear-btn, .btn-print { display: none !important; }
      .table-container { max-height: none !important; overflow: visible !important; }
      th { position: static !important; }
      .report-card { box-shadow: none !important; border: none !important; }
    }

    @media (max-width: 640px) {
      .container { padding: 4px; }
      .header-section { padding: 14px 10px; }
      .header-section h1 { font-size: 1.15rem; }
      .controls-panel { padding: 10px; gap: 8px; }
      .filter-group { min-width: 100%; }
      .dropdown-container { min-width: 100%; max-width: 100%; }
      .dropdown-panel { width: 100%; max-width: 100%; right: 0; left: 0; }
      .badge-count { font-size: 0.82rem; padding: 6px 10px; }
      th { font-size: 12px; padding: 9px 6px; }
      td { font-size: 12px; padding: 9px 6px; font-weight: 700; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="report-card">
      <div class="header-section">
        <h1>${escapeHtmlText(reportTitle)}</h1>
        ${subtitle ? `<div class="subtitle">${escapeHtmlText(subtitle)}</div>` : ''}
        <div class="date">${escapeHtmlText(dateLine)}</div>
      </div>

      <!-- Controls & Search -->
      <div class="controls-panel">
        <div class="filter-group">
          <div class="search-wrapper">
            <span class="search-icon">🔍</span>
            <input 
              type="text" 
              id="searchInput" 
              class="search-input" 
              placeholder="ابحث بالاسم أو المرحلة أو الرقم..." 
              autocomplete="off"
            />
            <button type="button" id="clearBtn" class="clear-btn" title="مسح">✕</button>
          </div>

          ${uniqueStages.length > 1 ? `
          <div class="dropdown-container" id="stageDropdownContainer">
            <button type="button" id="stageDropdownBtn" class="dropdown-btn">
              <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
                <span>🏷️</span>
                <span id="stageDropdownLabel" class="dropdown-btn-label">كل المستويات / المراحل (${uniqueStages.length})</span>
              </div>
              <span class="dropdown-btn-arrow">▼</span>
            </button>
            <div id="stageDropdownPanel" class="dropdown-panel">
              <div class="dropdown-search-box">
                <span class="dropdown-search-icon">🔍</span>
                <input 
                  type="text" 
                  id="stageSearchInput" 
                  class="dropdown-search-input" 
                  placeholder="بحث سريع في المراحل..." 
                  autocomplete="off"
                />
              </div>
              <div class="dropdown-actions">
                <button type="button" id="btnSelectAllStages" class="btn-action btn-select-all">تحديد الكل</button>
                <button type="button" id="btnDeselectAllStages" class="btn-action btn-deselect-all">إلغاء التحديد</button>
              </div>
              <div id="stageOptionsList" class="dropdown-options-list">
                ${uniqueStages.map((stg) => {
                  const color = stageColors[stg] || '#059669';
                  return `
                  <label class="dropdown-option" data-stage-name="${escapeAttr(stg)}">
                    <input type="checkbox" class="dropdown-checkbox stage-cb" value="${escapeAttr(stg)}" checked />
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${color};flex-shrink:0;"></span>
                    <span>${escapeHtmlText(stg)}</span>
                  </label>
                `;}).join('')}
              </div>
            </div>
          </div>` : ''}
        </div>

        <div class="action-group">
          <div class="badge-count">
            المطابق: <span id="matchCount">${targets.length}</span> من أصل <span id="totalCount">${targets.length}</span>
          </div>
          <button class="btn-print" onclick="window.print()">
            <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            <span>طباعة</span>
          </button>
        </div>
      </div>

      <!-- Table Container -->
      <div class="table-container">
        <table id="cardsTable">
          <thead>
            <tr>
              <th style="width: 1% !important; white-space: nowrap !important; min-width: 32px; max-width: 48px; text-align: center;">#</th>
              <th style="text-align: right; padding-right: 14px;">الاسم</th>
              <th style="width: 25%; text-align: center;">المرحلة / المستوى</th>
              <th style="width: 15%; text-align: center;">رقم البطاقة</th>
            </tr>
          </thead>
          <tbody id="tableBody">
            ${trs}
          </tbody>
        </table>
        <div id="noResults" class="no-results">
          لا توجد بطاقات مطابقة للبحث المحدد 🔍
        </div>
      </div>

      <div class="footer-bar">
        <span>قائمة البطاقات التعريفية التفاعلية</span>
        <span>${escapeHtmlText(dateLine)}</span>
      </div>
    </div>
  </div>

  <script>
    (function() {
      'use strict';
      function toArray(list) {
        if (!list) return [];
        var arr = [];
        for (var i = 0; i < list.length; i++) { arr.push(list[i]); }
        return arr;
      }

      function normalizeArabic(text) {
        if (!text) return "";
        var str = String(text).toLowerCase();
        str = str.replace(/[أإآ]/g, "ا")
                 .replace(/ة/g, "ه")
                 .replace(/ى/g, "ي")
                 .replace(/[\\u064B-\\u065F\\u0670]/g, "")
                 .replace(/ـ+/g, "");
        var arDigits = "٠١٢٣٤٥٦٧٨٩";
        for (var d = 0; d < 10; d++) {
          str = str.split(arDigits[d]).join(String(d));
        }
        return str.replace(/[\\r\\n\\t]+/g, " ").replace(/\\s+/g, " ").trim();
      }

      function isSmartMatch(targetText, query) {
        var normalizedQuery = normalizeArabic(query);
        if (!normalizedQuery) return true;

        var tokens = normalizedQuery.split(" ").filter(function(t) { return t.length > 0; });
        var normalizedTarget = normalizeArabic(targetText);

        for (var i = 0; i < tokens.length; i++) {
          if (normalizedTarget.indexOf(tokens[i]) === -1) {
            return false;
          }
        }
        return true;
      }

      function renumberVisibleRows() {
        var seq = 1;
        var rows = toArray(document.querySelectorAll("#tableBody tr.data-row"));
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (row.style.display !== "none") {
            var seqCell = row.querySelector(".seq-cell");
            if (seqCell) {
              seqCell.textContent = String(seq).replace(/[0-9]/g, function(d) { return '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]; });
              seq++;
            }
          }
        }
      }

      function updateStageLabel() {
        var label = document.getElementById("stageDropdownLabel");
        if (!label) return;
        var cbs = toArray(document.querySelectorAll(".stage-cb"));
        var total = cbs.length;
        var checked = 0;
        var firstChecked = "";
        for (var i = 0; i < total; i++) {
          if (cbs[i].checked) {
            checked++;
            if (!firstChecked) firstChecked = cbs[i].value;
          }
        }

        if (total === 0 || checked === total) {
          label.textContent = "كل المستويات / المراحل (" + total + ")";
        } else if (checked === 0) {
          label.textContent = "لم يتم اختيار أي مرحلة (0)";
        } else if (checked === 1) {
          label.textContent = firstChecked;
        } else {
          label.textContent = checked + " مراحل محددة";
        }
      }

      function filterTable() {
        try {
          var searchInput = document.getElementById("searchInput");
          var rawQuery = searchInput ? (searchInput.value || "") : "";
          var clearBtn = document.getElementById("clearBtn");
          if (clearBtn) {
            clearBtn.style.display = rawQuery.trim() ? "flex" : "none";
          }

          var stageCbs = toArray(document.querySelectorAll(".stage-cb"));
          var totalCbs = stageCbs.length;
          var checkedMap = {};
          var checkedCount = 0;
          for (var c = 0; c < totalCbs; c++) {
            if (stageCbs[c].checked) {
              checkedMap[stageCbs[c].value.trim()] = true;
              checkedCount++;
            }
          }

          var filterByStage = totalCbs > 0 && checkedCount < totalCbs;
          var rows = toArray(document.querySelectorAll("#tableBody tr.data-row"));
          var matchCount = document.getElementById("matchCount");
          var noResults = document.getElementById("noResults");
          var visibleCount = 0;

          for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            var rowSearchText = row.getAttribute("data-search") || row.textContent || "";
            var stageAttr = (row.getAttribute("data-stage") || "").trim();

            var matchesQuery = !rawQuery.trim() || isSmartMatch(rowSearchText, rawQuery);
            var matchesStage = !filterByStage || !!checkedMap[stageAttr];

            if (matchesQuery && matchesStage) {
              row.style.display = "";
              visibleCount++;
            } else {
              row.style.display = "none";
            }
          }

          if (matchCount) {
            matchCount.textContent = visibleCount;
          }
          if (noResults) {
            noResults.style.display = visibleCount === 0 ? "block" : "none";
          }

          renumberVisibleRows();
        } catch (err) {
          console.error("Filter error:", err);
        }
      }

      function filterStageOptions() {
        var input = document.getElementById("stageSearchInput");
        var q = input ? (input.value || "") : "";
        var options = toArray(document.querySelectorAll(".dropdown-option"));
        for (var i = 0; i < options.length; i++) {
          var opt = options[i];
          var name = opt.getAttribute("data-stage-name") || opt.textContent || "";
          if (!q.trim() || isSmartMatch(name, q)) {
            opt.style.display = "flex";
          } else {
            opt.style.display = "none";
          }
        }
      }

      function toggleStageDropdown(e) {
        if (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
        }
        var panel = document.getElementById("stageDropdownPanel");
        var btn = document.getElementById("stageDropdownBtn");
        if (!panel) return;
        var isOpen = panel.classList.contains("show");
        if (isOpen) {
          panel.classList.remove("show");
          if (btn) btn.classList.remove("active");
        } else {
          panel.classList.add("show");
          if (btn) btn.classList.add("active");
          var searchIn = document.getElementById("stageSearchInput");
          if (searchIn) {
            searchIn.value = "";
            filterStageOptions();
          }
        }
      }

      function closeStageDropdown() {
        var panel = document.getElementById("stageDropdownPanel");
        var btn = document.getElementById("stageDropdownBtn");
        if (panel) panel.classList.remove("show");
        if (btn) btn.classList.remove("active");
      }

      function selectAllStages(e) {
        if (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
        }
        var cbs = toArray(document.querySelectorAll(".stage-cb"));
        for (var i = 0; i < cbs.length; i++) {
          cbs[i].checked = true;
        }
        updateStageLabel();
        filterTable();
      }

      function deselectAllStages(e) {
        if (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
        }
        var cbs = toArray(document.querySelectorAll(".stage-cb"));
        for (var i = 0; i < cbs.length; i++) {
          cbs[i].checked = false;
        }
        updateStageLabel();
        filterTable();
      }

      function clearSearch() {
        var searchInput = document.getElementById("searchInput");
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }
        filterTable();
      }

      function initListeners() {
        try {
          var searchInput = document.getElementById("searchInput");
          if (searchInput) {
            searchInput.addEventListener("input", function() { filterTable(); });
            searchInput.addEventListener("keyup", function() { filterTable(); });
          }

          var clearBtn = document.getElementById("clearBtn");
          if (clearBtn) {
            clearBtn.addEventListener("click", function(e) {
              e.preventDefault();
              clearSearch();
            });
          }

          var stageDropdownBtn = document.getElementById("stageDropdownBtn");
          if (stageDropdownBtn) {
            stageDropdownBtn.addEventListener("click", function(e) {
              toggleStageDropdown(e);
            });
          }

          var stageSearchInput = document.getElementById("stageSearchInput");
          if (stageSearchInput) {
            stageSearchInput.addEventListener("input", function() { filterStageOptions(); });
          }

          var btnSelectAll = document.getElementById("btnSelectAllStages");
          if (btnSelectAll) {
            btnSelectAll.addEventListener("click", function(e) { selectAllStages(e); });
          }

          var btnDeselectAll = document.getElementById("btnDeselectAllStages");
          if (btnDeselectAll) {
            btnDeselectAll.addEventListener("click", function(e) { deselectAllStages(e); });
          }

          var cbs = toArray(document.querySelectorAll(".stage-cb"));
          for (var i = 0; i < cbs.length; i++) {
            cbs[i].addEventListener("change", function() {
              updateStageLabel();
              filterTable();
            });
          }

          document.addEventListener("click", function(e) {
            var container = document.getElementById("stageDropdownContainer");
            if (container && !container.contains(e.target)) {
              closeStageDropdown();
            }
          });

          document.addEventListener("keydown", function(e) {
            if (e.key === "Escape") {
              closeStageDropdown();
            }
          });

          updateStageLabel();
          filterTable();
        } catch (err) {
          console.warn("Init listeners error:", err);
        }
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initListeners);
      } else {
        initListeners();
      }
    })();
  </script>
</body>
</html>`;

  showExportDialog(htmlContent, fileName, reportTitle, 'cards');
};
