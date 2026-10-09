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

  const openAppsShareModal = () => {
    const appsModal = document.createElement('div');
    appsModal.id = 'html-apps-share-modal';
    appsModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(5px);
      z-index: 100001;
      display: flex;
      align-items: center;
      justify-content: center;
      direction: rtl;
      font-family: 'Tajawal', sans-serif;
      animation: fadeIn 0.2s ease-out;
    `;

    appsModal.innerHTML = `
      <div style="background: white; border-radius: 20px; padding: 26px 22px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.3); width: 360px; max-width: 92%; direction: rtl;">
        <div style="display: flex; justify-content: center; margin-bottom: 14px;">
          <div style="width: 56px; height: 56px; background-color: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #a7f3d0;">
            <span style="font-size: 26px;">📲</span>
          </div>
        </div>
        <h3 style="color: #006A4E; font-size: 18px; font-weight: 800; margin: 0 0 6px 0;">مشاركة ملف HTML عبر التطبيقات</h3>
        <p style="color: #64748b; font-size: 12.5px; margin: 0 0 16px 0; font-weight: 600; line-height: 1.5;">
          اختر التطبيق لمشاركة ملف البطاقات التفاعلية معه:
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-app-whatsapp" style="background: #25D366; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(37,211,102,0.3);">
            <svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            <span>مشاركة عبر واتساب (WhatsApp)</span>
          </button>

          <button id="btn-app-telegram" style="background: #229ED9; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(34,158,217,0.3);">
            <svg style="width: 20px; height: 20px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.942z"/></svg>
            <span>مشاركة عبر تيليجرام (Telegram)</span>
          </button>

          <button id="btn-app-download" style="background: #f1f5f9; color: #1e293b; border: 1.5px solid #cbd5e1; padding: 11px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 13.5px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            <span>تنزيل الملف وإرفاقه يدوياً كمستند</span>
          </button>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 9px 12px; margin-top: 14px; text-align: right;">
          <p style="color: #166534; font-size: 11.5px; line-height: 1.55; margin: 0;">
            💡 <strong>ملاحظة:</strong> يتم حفظ ملف HTML بجهازك لتقوم بإرساله كمستند في المحادثة مباشرة.
          </p>
        </div>

        <button id="btn-app-close" style="background: transparent; color: #64748b; border: none; padding: 8px; font-weight: bold; cursor: pointer; font-size: 13px; margin-top: 8px;">رجوع للنافذة السابقة</button>
      </div>
    `;

    document.body.appendChild(appsModal);

    const btnWa = appsModal.querySelector('#btn-app-whatsapp') as HTMLButtonElement;
    const btnTg = appsModal.querySelector('#btn-app-telegram') as HTMLButtonElement;
    const btnDl = appsModal.querySelector('#btn-app-download') as HTMLButtonElement;
    const btnCl = appsModal.querySelector('#btn-app-close') as HTMLButtonElement;

    if (btnWa) {
      btnWa.onclick = () => {
        downloadFile();
        const textMsg = `مرفق ملف تفاعلي: ${reportTitle || fileName}`;
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
        window.open(waUrl, '_blank');
      };
    }

    if (btnTg) {
      btnTg.onclick = () => {
        downloadFile();
        const textMsg = `مرفق ملف تفاعلي: ${reportTitle || fileName}`;
        const tgUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(textMsg)}`;
        window.open(tgUrl, '_blank');
      };
    }

    if (btnDl) {
      btnDl.onclick = () => {
        downloadFile();
      };
    }

    if (btnCl) {
      btnCl.onclick = () => {
        if (document.body.contains(appsModal)) {
          document.body.removeChild(appsModal);
        }
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

  const isCards = dialogType === 'cards';

  overlay.innerHTML = `
    <div style="background: white; border-radius: 16px; padding: 28px 24px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.25); width: 340px; max-width: 92%; direction: rtl;">
      <div style="display: flex; justify-content: center; margin-bottom: 16px;">
        <div style="width: 56px; height: 56px; background-color: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <svg style="width: 32px; height: 32px; color: #006A4E;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <h3 style="color: #006A4E; font-size: 18px; font-weight: 800; margin: 0 0 8px 0;">تم تجهيز ${isCards ? 'البطاقات التفاعلية' : 'التقرير'} بنجاح!</h3>
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 20px 0; font-weight: 600;">يمكنك مشاركة الملف مباشرة أو تنزيله لجهازك:</p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="btn-share-native" style="background: #006A4E; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(0,106,78,0.3);">
          <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
          مشاركة عبر التطبيقات (واتساب / بريد)
        </button>

        <button id="btn-download-native" style="background: #2563eb; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(37,99,235,0.25);">
          <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          تنزيل وحفظ ملف HTML
        </button>

        <button id="btn-preview-native" style="background: #0284c7; color: white; border: none; padding: 11px; border-radius: 10px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 13.5px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(2,132,199,0.25);">
          <span>👁️ معاينة وتجربة الملف الآن</span>
        </button>

        <button id="btn-close-native" style="background: transparent; color: #6b7280; border: none; padding: 8px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 13px; margin-top: 4px;">إغلاق النافذة</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const btnShare = overlay.querySelector('#btn-share-native') as HTMLButtonElement | null;
  const btnDownload = overlay.querySelector('#btn-download-native') as HTMLButtonElement | null;
  const btnPreview = overlay.querySelector('#btn-preview-native') as HTMLButtonElement | null;
  const btnClose = overlay.querySelector('#btn-close-native') as HTMLButtonElement | null;

  if (btnShare) {
    btnShare.onclick = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.share) {
          let shareFile = new File([blobWithBom], finalFileName, { type: 'text/html' });
          if (navigator.canShare) {
            if (!navigator.canShare({ files: [shareFile] })) {
              const fallbackFile = new File([blobWithBom], finalFileName, { type: 'text/plain' });
              if (navigator.canShare({ files: [fallbackFile] })) {
                shareFile = fallbackFile;
              }
            }
          }

          try {
            await navigator.share({
              files: [shareFile],
              title: reportTitle || fileName,
              text: isCards ? `بطاقات تفاعلية: ${reportTitle || fileName}` : `تقرير: ${reportTitle || fileName}`
            });
            return;
          } catch (shareErr: any) {
            if (shareErr.name === 'AbortError') {
              // User dismissed native share sheet
              return;
            }
            console.warn('Native share failed, showing apps options:', shareErr);
          }
        }
      } catch (err: any) {
        console.warn('Share error:', err);
      }

      // If native sharing is unsupported or threw an error:
      // Show the dedicated Apps Sheet (WhatsApp / Telegram / Download)
      // DO NOT silently download the file!
      openAppsShareModal();
    };
  }

  if (btnDownload) {
    btnDownload.onclick = () => {
      downloadFile();
    };
  }

  if (btnPreview) {
    btnPreview.onclick = () => {
      openInteractivePreviewModal();
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

export interface InteractiveCardItem {
  id: string | number;
  title: string;
  name: string;
  role?: string;
  studentNames?: string[];
  teacherName?: string;
  halaqaName?: string;
  stage?: string;
  number?: string | number;
  imageDataUrl: string;
  aspectRatio?: number;
  badgeColor?: string;
}

/**
 * Generates and shares an interactive standalone HTML file for cards
 * featuring a search bar by student, teacher, or halaqa with instant filtering and printing.
 */
export const shareInteractiveCardsHtml = async (
  cards: InteractiveCardItem[],
  fileName: string = 'بطاقات_تفاعلية_HTML',
  reportTitle: string = 'بطاقات الحلقات والطلاب التفاعلية',
  subtitle?: string,
  adjustments: Record<string, number> = {}
) => {
  const today = new Date();
  const dateLine = gregorianToHijriFormatted(today, adjustments);

  // Extract all unique students across all cards for the student filter dropdown
  const uniqueStudents = Array.from(
    new Set(
      cards.flatMap(c => {
        if (c.studentNames && c.studentNames.length > 0) {
          return c.studentNames.map(s => String(s || '').trim());
        }
        return [String(c.name || '').trim()];
      }).filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'ar'));

  // Build Cards HTML
  const cardsHtml = cards.map((card, idx) => {
    const studentNamesList = (card.studentNames || []).map(s => String(s || '').trim()).filter(Boolean);
    const studentNamesJoined = studentNamesList.join(' ');
    const teacherName = String(card.teacherName || '').trim();
    const halaqaName = String(card.halaqaName || '').trim();
    const stageName = String(card.stage || '').trim();
    const numberStr = card.number !== undefined && card.number !== null ? String(card.number).trim() : '';
    const roleName = String(card.role || '').trim();
    const nameVal = String(card.name || card.title || '').trim();

    const searchTokens = [
      nameVal,
      teacherName,
      halaqaName,
      studentNamesJoined,
      stageName,
      numberStr,
      roleName,
      String(idx + 1)
    ].filter(Boolean).join(' ');

    return `
      <div class="card-item-wrapper"
           id="card-wrapper-${idx}"
           data-idx="${idx}"
           data-name="${escapeAttr(nameVal)}"
           data-students="${escapeAttr(studentNamesJoined)}"
           data-students-json="${escapeAttr(JSON.stringify(studentNamesList))}"
           data-teacher="${escapeAttr(teacherName)}"
           data-halaqa="${escapeAttr(halaqaName)}"
           data-stage="${escapeAttr(stageName)}"
           data-number="${escapeAttr(numberStr)}"
           data-role="${escapeAttr(roleName)}"
           data-search="${escapeAttr(searchTokens)}">
        <div class="card-box">
          <div class="card-image-container" onclick="openZoomModal(${idx})">
            <img src="${card.imageDataUrl}" alt="${escapeAttr(card.title || nameVal)}" loading="lazy" class="card-img" />
            <div class="card-zoom-overlay">
              <span class="zoom-icon">🔍 تكبير البطاقة</span>
            </div>
          </div>
          
          <div class="card-meta-panel">
            <div class="card-meta-header">
              <span class="card-number-badge">#${toArabicDigits(numberStr || idx + 1)}</span>
              <span class="card-title-text" title="${escapeAttr(nameVal)}">${escapeHtmlText(nameVal)}</span>
              ${roleName ? `<span class="card-role-badge">${escapeHtmlText(roleName)}</span>` : ''}
            </div>

            <div class="card-meta-details">
              ${halaqaName ? `
                <div class="meta-row">
                  <span class="meta-label">🕌 الحلقة:</span>
                  <span class="meta-val meta-halaqa-val" onclick="quickSearchHalaqa('${escapeAttr(halaqaName)}')">${escapeHtmlText(halaqaName)}</span>
                </div>` : ''}
              ${teacherName ? `
                <div class="meta-row">
                  <span class="meta-label">👨‍🏫 المعلم:</span>
                  <span class="meta-val meta-teacher-val" onclick="quickSearchTeacher('${escapeAttr(teacherName)}')">${escapeHtmlText(teacherName)}</span>
                </div>` : ''}
              ${stageName ? `
                <div class="meta-row">
                  <span class="meta-label">🏷️ المرحلة:</span>
                  <span class="meta-val">${escapeHtmlText(stageName)}</span>
                </div>` : ''}
              ${studentNamesList.length > 0 ? `
                <div class="meta-row meta-students-summary">
                  <span class="meta-label">👥 الطلاب:</span>
                  <button type="button" class="btn-toggle-students" onclick="toggleStudentsList(${idx})" title="عرض أو إخفاء أسماء طلاب الحلقة">
                    <span>${toArabicDigits(studentNamesList.length)} طالب</span>
                    <span class="toggle-arrow" id="toggle-arrow-${idx}">▾</span>
                  </button>
                </div>
                <div class="students-collapsible-list" id="students-list-${idx}">
                  <div class="students-chips-grid">
                    ${studentNamesList.map((st, sIdx) => `
                      <span class="student-chip" data-name="${escapeAttr(st)}">
                        <span class="student-seq">${toArabicDigits(sIdx + 1)}.</span>
                        <span class="student-name-text">${escapeHtmlText(st)}</span>
                      </span>
                    `).join('')}
                  </div>
                </div>` : ''}
              <div class="card-search-matches" id="card-matches-${idx}" style="display: none;"></div>
            </div>

            <div class="card-actions-row">
              <button type="button" class="btn-card-action btn-print-single" onclick="printSingleCard(${idx})">
                <span>🖨️ طباعة البطاقة</span>
              </button>
              <button type="button" class="btn-card-action btn-zoom-single" onclick="openZoomModal(${idx})">
                <span>🔍 تكبير</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlText(reportTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #006A4E;
      --primary-dark: #004D38;
      --primary-light: #ecfdf5;
      --gold: #D4AF37;
      --gold-dark: #b89726;
      --bg-page: #f8fafc;
      --card-bg: #ffffff;
      --border-color: #e2e8f0;
      --text-main: #0f172a;
      --text-muted: #64748b;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      font-family: 'Tajawal', 'Cairo', system-ui, -apple-system, sans-serif;
      background-color: var(--bg-page);
      color: var(--text-main);
      direction: rtl;
      text-align: right;
      line-height: 1.5;
      padding-bottom: 60px;
    }

    /* Sticky Header Banner */
    .header-banner {
      background: linear-gradient(135deg, #00563F 0%, #006A4E 50%, #004D38 100%);
      color: white;
      padding: 16px 20px;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      border-bottom: 3px solid var(--gold);
    }

    .header-container {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .header-title-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon {
      font-size: 28px;
      background: rgba(255, 255, 255, 0.12);
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      border: 1px solid rgba(212, 175, 55, 0.4);
    }

    .header-title-main {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -0.3px;
    }

    .header-subtitle {
      font-size: 12.5px;
      color: #a7f3d0;
      font-weight: 600;
    }

    .header-stats-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0, 0, 0, 0.2);
      padding: 6px 14px;
      border-radius: 30px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      font-size: 13px;
      font-weight: 700;
    }

    .stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .stat-num {
      color: var(--gold);
      font-family: monospace;
      font-size: 14px;
      font-weight: 900;
    }

    /* Main Container */
    .main-wrapper {
      max-width: 1400px;
      margin: 20px auto;
      padding: 0 16px;
    }

    /* Controls Panel & Search */
    .controls-panel {
      padding: 14px 18px;
      background: #f8fafc;
      border: 1px solid var(--border-color);
      border-radius: 16px;
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
    }

    .filter-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 280px;
    }

    .search-wrapper {
      position: relative;
      flex: 1;
      min-width: 240px;
    }

    .search-icon {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 15px;
      color: #94a3b8;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 11px 40px 11px 38px;
      border: 2px solid #cbd5e1;
      border-radius: 12px;
      font-size: 14.5px;
      font-weight: 700;
      background: white;
      color: #0f172a;
      transition: all 0.2s;
      outline: none;
      font-family: inherit;
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
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 900;
      transition: all 0.15s;
    }

    .clear-btn:hover {
      background: #cbd5e1;
      color: #0f172a;
    }

    /* Student Filter Dropdown */
    .dropdown-container {
      position: relative;
      min-width: 220px;
      max-width: 320px;
      flex: 1;
    }

    .dropdown-btn {
      width: 100%;
      padding: 10.5px 14px;
      border: 2px solid #cbd5e1;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 800;
      background: white;
      color: #006A4E;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      transition: all 0.2s;
      outline: none;
      font-family: inherit;
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
      width: 330px;
      max-width: 90vw;
      background: white;
      border: 2px solid #006A4E;
      border-radius: 16px;
      box-shadow: 0 15px 35px -5px rgba(0,0,0,0.25);
      z-index: 9999;
      display: none;
      flex-direction: column;
      overflow: hidden;
      animation: fadeIn 0.15s ease-out;
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
      padding: 8px 34px 8px 10px;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 700;
      outline: none;
      background: white;
      color: #0f172a;
      font-family: inherit;
    }

    .dropdown-search-input:focus {
      border-color: #006A4E;
      box-shadow: 0 0 0 2px rgba(0, 106, 78, 0.15);
    }

    .dropdown-search-icon {
      position: absolute;
      right: 22px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 13px;
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
      font-size: 12.5px;
      font-weight: 800;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-family: inherit;
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
      max-height: 260px;
      overflow-y: auto;
      padding: 6px 0;
    }

    .dropdown-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      cursor: pointer;
      font-size: 13px;
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

    .stats-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: #ecfdf5;
      color: #065f46;
      border: 1.5px solid #a7f3d0;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 800;
      white-space: nowrap;
    }

    .btn-print-action {
      background: #ffffff;
      color: #006A4E;
      border: 2px solid #006A4E;
      padding: 9px 18px;
      border-radius: 12px;
      font-size: 13.5px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      transition: all 0.15s;
    }

    .btn-print-action:hover {
      background: rgba(0, 106, 78, 0.08);
    }

    .btn-clear-search-action {
      background: linear-gradient(135deg, #006A4E, #004D38);
      color: white;
      border: none;
      padding: 10px 22px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      margin: 12px auto 0;
      display: block;
      transition: all 0.15s;
    }

    .btn-clear-search-action:hover {
      box-shadow: 0 4px 12px rgba(0, 106, 78, 0.25);
    }

    /* Cards Grid */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 22px;
    }

    .card-item-wrapper {
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .card-item-wrapper.hidden-by-filter {
      display: none !important;
    }

    .card-item-wrapper.highlight-match .card-box {
      border-color: var(--gold);
      box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.45), 0 10px 25px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .card-box {
      background: white;
      border-radius: 16px;
      border: 1.5px solid var(--border-color);
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      height: 100%;
      transition: all 0.2s;
    }

    .card-box:hover {
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
      border-color: #cbd5e1;
      transform: translateY(-2px);
    }

    .card-image-container {
      position: relative;
      background: #f1f5f9;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      border-bottom: 1px solid #f1f5f9;
    }

    .card-img {
      width: 100%;
      height: auto;
      max-height: 480px;
      object-fit: contain;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: transform 0.2s;
    }

    .card-image-container:hover .card-img {
      transform: scale(1.01);
    }

    .card-zoom-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.35);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .card-image-container:hover .card-zoom-overlay {
      opacity: 1;
    }

    .zoom-icon {
      background: white;
      color: #006A4E;
      font-weight: 800;
      font-size: 13px;
      padding: 8px 16px;
      border-radius: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .card-meta-panel {
      padding: 14px 16px 16px;
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 10px;
    }

    .card-meta-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-number-badge {
      background: #f1f5f9;
      color: #006A4E;
      font-weight: 900;
      font-family: monospace;
      font-size: 13px;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
    }

    .card-title-text {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-role-badge {
      background: rgba(212, 175, 55, 0.15);
      color: #92400e;
      border: 1px solid rgba(212, 175, 55, 0.35);
      font-size: 11px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .card-meta-details {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 13px;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid #f1f5f9;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .meta-label {
      color: #64748b;
      font-weight: 700;
      font-size: 12px;
      min-width: 58px;
    }

    .meta-val {
      color: #1e293b;
      font-weight: 700;
      font-size: 12.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta-halaqa-val, .meta-teacher-val {
      cursor: pointer;
      color: #006A4E;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .meta-halaqa-val:hover, .meta-teacher-val:hover {
      color: #004D38;
      font-weight: 800;
    }

    /* Students Collapsible List & Chips */
    .btn-toggle-students {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 11.5px;
      font-weight: 800;
      color: #006A4E;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
      font-family: inherit;
    }

    .btn-toggle-students:hover {
      background: #e2e8f0;
      border-color: #006A4E;
    }

    .toggle-arrow {
      font-size: 11px;
      color: #64748b;
      transition: transform 0.2s;
    }

    .students-collapsible-list {
      display: none;
      margin-top: 6px;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 8px 10px;
      max-height: 190px;
      overflow-y: auto;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.03);
    }

    .students-chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .student-chip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 11.5px;
      font-weight: 700;
      color: #1e293b;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
    }

    .student-chip .student-seq {
      color: #64748b;
      font-weight: 800;
      font-size: 10.5px;
    }

    .student-chip.is-matched {
      background: #fef3c7 !important;
      border-color: #d97706 !important;
      color: #92400e !important;
      font-weight: 900 !important;
      box-shadow: 0 0 0 2.5px rgba(217, 119, 6, 0.35) !important;
      transform: scale(1.02);
    }

    .student-chip.is-matched .student-seq {
      color: #d97706 !important;
    }

    /* Live Card Search Match Badges */
    .card-search-matches {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 8px;
      padding: 8px 10px;
      background: #fefce8;
      border: 1.5px solid #facc15;
      border-radius: 10px;
      animation: fadeIn 0.2s ease-in-out;
    }

    .match-badge {
      font-size: 12px;
      font-weight: 800;
      color: #854d0e;
      display: flex;
      align-items: flex-start;
      gap: 6px;
      line-height: 1.45;
    }

    .match-student-badge strong {
      color: #047857;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .match-teacher-badge strong {
      color: #0284c7;
    }

    .match-halaqa-badge strong {
      color: #7c3aed;
    }

    .card-actions-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: auto;
      padding-top: 6px;
    }

    .btn-card-action {
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 800;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.15s;
    }

    .btn-print-single {
      background: #006A4E;
      color: white;
      border: none;
    }

    .btn-print-single:hover {
      background: #004D38;
    }

    .btn-zoom-single {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }

    .btn-zoom-single:hover {
      background: #e2e8f0;
      color: #0f172a;
    }

    /* Empty state */
    .empty-state {
      display: none;
      background: white;
      border-radius: 18px;
      padding: 48px 24px;
      text-align: center;
      border: 1.5px dashed #cbd5e1;
      margin: 40px auto;
      max-width: 500px;
    }

    .empty-state.visible {
      display: block;
    }

    .empty-icon {
      font-size: 42px;
      margin-bottom: 12px;
    }

    .empty-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
    }

    .empty-desc {
      font-size: 13.5px;
      color: #64748b;
      margin-bottom: 18px;
    }

    /* Modal / Lightbox */
    .zoom-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(6px);
      z-index: 99999;
      align-items: center;
      justify-content: center;
      padding: 20px;
      direction: rtl;
    }

    .zoom-modal.visible {
      display: flex;
    }

    .zoom-content {
      background: white;
      border-radius: 20px;
      max-width: 900px;
      width: 100%;
      max-height: 94vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
      border: 2px solid var(--gold);
    }

    .zoom-header {
      background: #006A4E;
      color: white;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .zoom-title {
      font-size: 16px;
      font-weight: 800;
    }

    .zoom-close {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      font-weight: 800;
    }

    .zoom-body {
      padding: 16px;
      overflow-y: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      flex: 1;
    }

    .zoom-img {
      max-width: 100%;
      max-height: 72vh;
      object-fit: contain;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .zoom-footer {
      padding: 12px 20px;
      background: white;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    /* Print Stylesheet */
    @media print {
      body {
        background: white !important;
        padding: 0 !important;
      }

      .header-banner,
      .search-panel,
      .search-alert-bar,
      .card-actions-row,
      .card-zoom-overlay,
      .card-search-matches,
      .btn-toggle-students,
      .zoom-modal {
        display: none !important;
      }

      .main-wrapper {
        margin: 0 !important;
        padding: 0 !important;
        max-width: none !important;
      }

      .cards-grid {
        display: block !important;
      }

      .card-item-wrapper {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-bottom: 20px !important;
      }

      .card-item-wrapper.hidden-by-filter {
        display: none !important;
      }

      /* Single card print mode */
      body.printing-single-mode .card-item-wrapper:not(.print-this-card-now) {
        display: none !important;
      }

      .card-box {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }

      .card-image-container {
        background: transparent !important;
        padding: 0 !important;
        border: none !important;
      }

      .card-img {
        max-height: none !important;
        box-shadow: none !important;
        width: 100% !important;
      }

      .card-meta-panel {
        display: none !important;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>

  <!-- Sticky Header Banner -->
  <header class="header-banner">
    <div class="header-container">
      <div class="header-title-box">
        <div class="header-icon">🪪</div>
        <div>
          <div class="header-title-main">${escapeHtmlText(reportTitle)}</div>
          <div class="header-subtitle">${escapeHtmlText(subtitle || 'مشروع إعداد حافظ')} • ${escapeHtmlText(dateLine)}</div>
        </div>
      </div>
      <div class="header-stats-bar">
        <span class="stat-pill">الإجمالي: <span class="stat-num" id="statTotal">${toArabicDigits(cards.length)}</span></span>
        <span>•</span>
        <span class="stat-pill">المعروض: <span class="stat-num" id="statVisible">${toArabicDigits(cards.length)}</span></span>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="main-wrapper">

    <!-- Controls & Search -->
    <section class="controls-panel">
      <div class="filter-group">
        <div class="search-wrapper">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            id="searchInput" 
            class="search-input" 
            placeholder="ابحث بأي جزء من اسم الطالب، المعلم، الحلقة..." 
            autocomplete="off"
            oninput="filterCards()"
            onkeyup="filterCards()"
          />
          <button type="button" id="clearBtn" class="clear-btn" title="مسح" onclick="clearSearch()">✕</button>
        </div>

        ${uniqueStudents.length > 0 ? `
        <div class="dropdown-container" id="studentDropdownContainer">
          <button type="button" id="studentDropdownBtn" class="dropdown-btn" onclick="toggleStudentDropdown(event)">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
              <span>👤</span>
              <span id="studentDropdownLabel" class="dropdown-btn-label">كل الطلاب (${toArabicDigits(uniqueStudents.length)})</span>
            </div>
            <span class="dropdown-btn-arrow" id="studentDropdownArrow">▼</span>
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
                oninput="filterStudentOptions()"
                onkeyup="filterStudentOptions()"
              />
            </div>
            <div class="dropdown-actions">
              <button type="button" id="btnSelectAllStudents" class="btn-action btn-select-all" onclick="selectAllStudents(event)">تحديد الكل</button>
              <button type="button" id="btnDeselectAllStudents" class="btn-action btn-deselect-all" onclick="deselectAllStudents(event)">إلغاء التحديد</button>
            </div>
            <div id="studentOptionsList" class="dropdown-options-list">
              ${uniqueStudents.map((name) => `
                <label class="dropdown-option" data-student-name="${escapeAttr(name)}">
                  <input type="checkbox" class="dropdown-checkbox student-cb" value="${escapeAttr(name)}" checked onchange="handleStudentCbChange()" />
                  <span>${escapeHtmlText(name)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>` : ''}

        <div class="stats-badge">
          عدد البطاقات: <strong id="matchCount">${toArabicDigits(cards.length)}</strong> من أصل ${toArabicDigits(cards.length)}
        </div>

        <button type="button" class="btn-print-action" onclick="window.print()">
          <span>🖨️ طباعة البطاقات المعروضة</span>
        </button>
      </div>
    </section>

    <!-- Cards Grid -->
    <div id="cardsGrid" class="cards-grid">
      ${cardsHtml}
    </div>

    <!-- Empty State -->
    <div id="noResults" class="empty-state" style="display: none;">
      <div class="empty-icon">🔎</div>
      <div class="empty-title">لم يتم العثور على أي بطاقة مطابقة</div>
      <div class="empty-desc">تأكد من كتابة الاسم أو رقم الحلقة بشكل صحيح، أو اضغط مسح لعرض كافة البطاقات.</div>
      <button type="button" class="btn-clear-search-action" onclick="clearSearch()">
        <span>إظهار جميع البطاقات</span>
      </button>
    </div>
  </main>

  <!-- Zoom Lightbox Modal -->
  <div id="zoomModal" class="zoom-modal" onclick="closeZoomModal(event)">
    <div class="zoom-content" onclick="event.stopPropagation()">
      <div class="zoom-header">
        <span id="zoomTitle" class="zoom-title">معاينة البطاقة</span>
        <button type="button" class="zoom-close" onclick="closeZoomModal()">✕</button>
      </div>
      <div class="zoom-body">
        <img id="zoomImg" src="" alt="معاينة البطاقة" class="zoom-img" />
      </div>
      <div class="zoom-footer">
        <button type="button" id="btnZoomPrint" class="btn-card-action btn-print-single" style="padding: 10px 20px;">
          <span>🖨️ طباعة هذه البطاقة</span>
        </button>
        <button type="button" class="btn-card-action btn-zoom-single" onclick="closeZoomModal()">
          <span>إغلاق</span>
        </button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      'use strict';
      var currentZoomIdx = 0;

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
          var tok = tokens[i];
          if (normalizedTarget.indexOf(tok) !== -1) {
            continue;
          }
          // If token has "ال" prefix, check without "ال"
          if (tok.length > 3 && tok.indexOf("ال") === 0 && normalizedTarget.indexOf(tok.substring(2)) !== -1) {
            continue;
          }
          // If target has "ال" prefix before token
          if (tok.length > 2 && normalizedTarget.indexOf("ال" + tok) !== -1) {
            continue;
          }
          // Handle abu / abi / aba
          if (tok.indexOf("ابو") === 0 || tok.indexOf("ابي") === 0 || tok.indexOf("ابا") === 0) {
            var rest = tok.substring(3);
            if (normalizedTarget.indexOf("ابو" + rest) !== -1 ||
                normalizedTarget.indexOf("ابي" + rest) !== -1 ||
                normalizedTarget.indexOf("ابا" + rest) !== -1) {
              continue;
            }
          }
          return false;
        }
        return true;
      }

      function toArabicDigits(num) {
        if (num === null || num === undefined) return '';
        var id = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
        return String(num).replace(/[0-9]/g, function(w) { return id[+w]; });
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
          var input = document.getElementById("studentSearchInput");
          if (input) setTimeout(function() { input.focus(); }, 60);
        }
      }
      window.toggleStudentDropdown = toggleStudentDropdown;

      function closeStudentDropdown() {
        var panel = document.getElementById("studentDropdownPanel");
        var btn = document.getElementById("studentDropdownBtn");
        if (panel) panel.classList.remove("show");
        if (btn) btn.classList.remove("active");
      }
      window.closeStudentDropdown = closeStudentDropdown;

      function filterStudentOptions() {
        var input = document.getElementById("studentSearchInput");
        var q = input ? (input.value || "") : "";
        var options = toArray(document.querySelectorAll("#studentOptionsList .dropdown-option"));
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
      window.filterStudentOptions = filterStudentOptions;

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
        filterCards();
      }
      window.selectAllStudents = selectAllStudents;

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
        filterCards();
      }
      window.deselectAllStudents = deselectAllStudents;

      function handleStudentCbChange() {
        updateStudentLabel();
        filterCards();
      }
      window.handleStudentCbChange = handleStudentCbChange;

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
          label.textContent = "كل الطلاب (" + toArabicDigits(total) + ")";
        } else if (checked === 0) {
          label.textContent = "لم يتم اختيار أي طالب (٠)";
        } else if (checked === 1) {
          label.textContent = firstChecked;
        } else {
          label.textContent = toArabicDigits(checked) + " طلاب محددين";
        }
      }
      window.updateStudentLabel = updateStudentLabel;

      function filterCards() {
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
              var val = studentCbs[c].value.trim();
              checkedMap[val] = true;
              checkedMap[normalizeArabic(val)] = true;
              checkedCount++;
            }
          }

          var filterByStudent = totalCbs > 0 && checkedCount < totalCbs;

          var cards = toArray(document.querySelectorAll(".card-item-wrapper"));
          var matchCount = document.getElementById("matchCount");
          var statVisible = document.getElementById("statVisible");
          var noResults = document.getElementById("noResults");
          var visibleCount = 0;

          for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var cardIdx = card.getAttribute("data-idx") || String(i);
            var cardSearchText = card.getAttribute("data-search") || card.textContent || "";
            var cardName = (card.getAttribute("data-name") || "").trim();

            var matchesQuery = !rawQuery.trim() || isSmartMatch(cardSearchText, rawQuery);

            var matchesStudent = true;
            var cardStudentNames = [];
            var studentsJsonRaw = card.getAttribute("data-students-json");
            if (studentsJsonRaw) {
              try {
                cardStudentNames = JSON.parse(studentsJsonRaw);
              } catch (e) {
                cardStudentNames = [];
              }
            }
            if (!cardStudentNames || cardStudentNames.length === 0) {
              var chips = toArray(card.querySelectorAll(".student-chip"));
              for (var ch = 0; ch < chips.length; ch++) {
                var sName = chips[ch].getAttribute("data-name") || chips[ch].textContent.trim();
                if (sName) cardStudentNames.push(sName);
              }
            }

            if (filterByStudent) {
              if (checkedCount === 0) {
                matchesStudent = false;
              } else if (cardStudentNames.length > 0) {
                matchesStudent = cardStudentNames.some(function(st) {
                  return !!checkedMap[st.trim()] || !!checkedMap[normalizeArabic(st)];
                });
              } else {
                matchesStudent = !!checkedMap[cardName] || !!checkedMap[normalizeArabic(cardName)];
              }
            }

            if (matchesQuery && matchesStudent) {
              card.style.display = "";
              card.classList.remove("hidden-by-filter");
              visibleCount++;

              var chips = toArray(card.querySelectorAll(".student-chip"));
              var hasRelevantStudent = false;

              for (var sc = 0; sc < chips.length; sc++) {
                var chip = chips[sc];
                var studentName = chip.getAttribute("data-name") || chip.textContent || "";
                var normName = normalizeArabic(studentName);

                var chipMatchesQuery = rawQuery.trim() && isSmartMatch(studentName, rawQuery);
                var chipMatchesFilter = filterByStudent && (!!checkedMap[studentName.trim()] || !!checkedMap[normName]);

                if (chipMatchesQuery || chipMatchesFilter) {
                  chip.classList.add("is-matched");
                  hasRelevantStudent = true;
                } else {
                  chip.classList.remove("is-matched");
                }
              }

              var studentsList = document.getElementById("students-list-" + cardIdx);
              var arrow = document.getElementById("toggle-arrow-" + cardIdx);
              if (studentsList) {
                if (hasRelevantStudent) {
                  studentsList.style.display = "block";
                  if (arrow) arrow.textContent = "▴";
                } else if (!rawQuery.trim() && !filterByStudent) {
                  studentsList.style.display = "none";
                  if (arrow) arrow.textContent = "▾";
                }
              }
            } else {
              card.style.display = "none";
              card.classList.add("hidden-by-filter");
            }
          }

          if (matchCount) {
            matchCount.textContent = toArabicDigits(visibleCount);
          }
          if (statVisible) {
            statVisible.textContent = toArabicDigits(visibleCount);
          }
          if (noResults) {
            noResults.style.display = visibleCount === 0 ? "block" : "none";
          }
        } catch (err) {
          console.error("Filter error:", err);
        }
      }
      window.filterCards = filterCards;

      function clearSearch() {
        var searchInput = document.getElementById("searchInput");
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }
        var studentSearchInput = document.getElementById("studentSearchInput");
        if (studentSearchInput) {
          studentSearchInput.value = "";
          filterStudentOptions();
        }
        var cbs = toArray(document.querySelectorAll(".student-cb"));
        for (var i = 0; i < cbs.length; i++) {
          cbs[i].checked = true;
        }
        updateStudentLabel();
        filterCards();
      }
      window.clearSearch = clearSearch;

      window.quickSearchHalaqa = function(halaqaName) {
        var input = document.getElementById('searchInput');
        if (input) input.value = halaqaName;
        filterCards();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      window.quickSearchTeacher = function(teacherName) {
        var input = document.getElementById('searchInput');
        if (input) input.value = teacherName;
        filterCards();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      window.toggleStudentsList = function(idx) {
        var el = document.getElementById('students-list-' + idx);
        var arrow = document.getElementById('toggle-arrow-' + idx);
        if (!el) return;
        if (el.style.display === 'block') {
          el.style.display = 'none';
          if (arrow) arrow.textContent = '▾';
        } else {
          el.style.display = 'block';
          if (arrow) arrow.textContent = '▴';
        }
      };

      window.openZoomModal = function(idx) {
        currentZoomIdx = idx;
        var modal = document.getElementById('zoomModal');
        var img = document.getElementById('zoomImg');
        var title = document.getElementById('zoomTitle');
        var cardWrapper = document.getElementById('card-wrapper-' + idx);
        var cardImg = cardWrapper ? cardWrapper.querySelector('img.card-img') : null;
        var cardName = cardWrapper ? cardWrapper.getAttribute('data-name') : 'معاينة البطاقة';
        if (img && cardImg) img.src = cardImg.src;
        if (title) title.textContent = cardName || 'معاينة البطاقة';
        if (modal) modal.classList.add('visible');
      };

      window.closeZoomModal = function(e) {
        if (e && e.target && e.target.id !== 'zoomModal' && !e.target.classList.contains('zoom-close')) return;
        var modal = document.getElementById('zoomModal');
        if (modal) modal.classList.remove('visible');
      };

      window.printSingleCard = function(idx) {
        var wrapper = document.getElementById('card-wrapper-' + idx);
        if (!wrapper) return;
        wrapper.classList.add('print-this-card-now');
        document.body.classList.add('printing-single-mode');
        window.print();
        setTimeout(function() {
          wrapper.classList.remove('print-this-card-now');
          document.body.classList.remove('printing-single-mode');
        }, 1000);
      };

      function initListeners() {
        var searchInput = document.getElementById("searchInput");
        if (searchInput) {
          searchInput.addEventListener("input", function() { filterCards(); });
          searchInput.addEventListener("keyup", function() { filterCards(); });
        }
        var clearBtn = document.getElementById("clearBtn");
        if (clearBtn) {
          clearBtn.addEventListener("click", function(e) {
            e.preventDefault();
            clearSearch();
          });
        }
        var studentSearchInput = document.getElementById("studentSearchInput");
        if (studentSearchInput) {
          studentSearchInput.addEventListener("input", function() { filterStudentOptions(); });
          studentSearchInput.addEventListener("keyup", function() { filterStudentOptions(); });
        }
        var btnZoomPrint = document.getElementById('btnZoomPrint');
        if (btnZoomPrint) {
          btnZoomPrint.addEventListener('click', function() {
            window.printSingleCard(currentZoomIdx);
          });
        }
        document.addEventListener("click", function(e) {
          var container = document.getElementById("studentDropdownContainer");
          if (container && !container.contains(e.target)) {
            closeStudentDropdown();
          }
        });
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initListeners);
      } else {
        initListeners();
      }
      setTimeout(initListeners, 200);
    })();
  </script>
</body>
</html>`;

  showExportDialog(htmlContent, fileName, reportTitle, 'cards');
};
