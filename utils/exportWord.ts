import { translationMap } from "../constants";
import { getDualDate, getReportStyles, getReportContent, exportToPdf, sharePdfDirectly } from "./exportPdf"; // استيراد الدوال المساعدة
import { toArabicDigits, formatRtlRange } from "./juzUtils";

import { getStorage } from "./firebase";

export { translationMap, toArabicDigits, formatRtlRange };

export const renderCell = (value: any, type?: string) => {
  if (value === undefined || value === null || value === "") return "—";
  if (type === "translation") {
    const translated = translationMap[value as keyof typeof translationMap] || value;
    return toArabicDigits(translated);
  }
  if (type === "array") return Array.isArray(value) ? value.map(formatRtlRange).join("، ") : "—";
  if (typeof value === "number") {
    return toArabicDigits(value);
  }
  if (typeof value === "string") {
    return formatRtlRange(value);
  }
  return value;
};

interface ExportHeader {
  key: string;
  label: string;
  type?: string;
}

const blendWithWhite = (hex: string, alpha: number) => {
  if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return hex;
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  
  const newR = Math.round((1 - alpha) * 255 + alpha * r);
  const newG = Math.round((1 - alpha) * 255 + alpha * g);
  const newB = Math.round((1 - alpha) * 255 + alpha * b);
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

async function generateClientPdfBlob(
  htmlContent: string,
  orientation: "landscape" | "portrait" = "landscape"
): Promise<Blob> {
  const html2pdf = (window as any).html2pdf;
  if (!html2pdf) {
    throw new Error("مكتبة html2pdf غير متوفرة على المتصفح");
  }

  // Use an iframe to parse full HTML, Google Fonts, and CSS body classes safely
  // Use an iframe to parse full HTML, Google Fonts, and CSS body classes safely
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = orientation === "landscape" ? "1122px" : "794px";
  iframe.style.height = orientation === "landscape" ? "794px" : "1122px";
  iframe.style.border = "none";
  iframe.style.zIndex = "-99999";
  iframe.style.opacity = "0.01";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error("تعذر إنشاء إطار PDF");
    }

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Give browser time to layout DOM and load web fonts in iframe
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      if (iframeDoc.fonts) {
        await Promise.race([
          iframeDoc.fonts.ready,
          new Promise((r) => setTimeout(r, 2000)),
        ]);
      }
    } catch (e) {}

    const targetElement = iframeDoc.body;

    const opt = {
      margin: [8, 5, 8, 5],
      filename: "report.pdf",
      image: { type: "jpeg", quality: 0.98 },
      pagebreak: { mode: ['css', 'legacy'] },
      html2canvas: {
        scale: 1.5,
        useCORS: true,
        letterRendering: false,
        backgroundColor: "#ffffff",
        windowWidth: orientation === "landscape" ? 1122 : 794,
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: orientation },
    };

    const worker = html2pdf().set(opt).from(targetElement);
    const pdfBlob: Blob = await worker.output("blob");
    return pdfBlob;
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}

export const exportToWord = async (
  headers: ExportHeader[],
  data: any[],
  fileName: string,
  reportTitle?: string,
  adjustments: Record<string, number> = {},
  colorMap: Record<string, string> = {},
  rankColors?: Record<string, string>,
  orientation: "landscape" | "portrait" = "landscape",
  action: "download" | "share" | "pdf" | "share-pdf" = "download"
) => {
  // If sharing PDF, delegate directly to the robust sharePdfDirectly flow
  if (action === "share-pdf") {
    return sharePdfDirectly(
      headers,
      data,
      fileName,
      reportTitle || fileName,
      "",
      adjustments,
      colorMap,
      rankColors,
      orientation
    );
  }
  const tableHeadersHtml = headers
    .map((h) => {
      const isSequence =
        h.key === "sequence" ||
        h.key === "serialNumber" ||
        h.key === "index" ||
        h.key === "no" ||
        h.label === "#" ||
        h.label === "م" ||
        h.label === "الرقم" ||
        h.label === "التسلسل";
      let style = "background-color: #006A4E !important; color: #ffffff !important; font-weight: bold; text-align: center; border: 1px solid #000; padding: 4px 2px;";
      if (isSequence) {
        style += " width: 1% !important; white-space: nowrap !important; width: fit-content !important; min-width: 18px !important; max-width: 32px !important;";
      }
      return `<th style="${style}">${h.label}</th>`;
    })
    .join("");

  const tableRowsHtml = data
    .map((item, index) => {
      // Determine color
      let rowColor = "#000";
      let backgroundHighlight = null;
      const isAbsentOrNotRecorded =
        item.attendance === "absent" || item.attendance === "not_recorded";

      if (
        isAbsentOrNotRecorded &&
        item.attendance &&
        colorMap[item.attendance]
      ) {
        rowColor = colorMap[item.attendance];
      } else if (item.performance && colorMap[item.performance]) {
        rowColor = colorMap[item.performance];
      } else if (item.evalStatus && colorMap[item.evalStatus]) {
        rowColor = colorMap[item.evalStatus];
      }

      if (item.rank === 1 && rankColors?.rank1Color) {
        backgroundHighlight = rankColors.rank1Color;
      } else if (item.rank === 2 && rankColors?.rank2Color) {
        backgroundHighlight = rankColors.rank2Color;
      } else if (item.rank === 3 && rankColors?.rank3Color) {
        backgroundHighlight = rankColors.rank3Color;
      } else if (
        item.rank &&
        item.rank > 0 &&
        rankColors &&
        rankColors.highlightColor
      ) {
        backgroundHighlight = rankColors.highlightColor;
      }

      const rowCellsHtml = headers
        .map((header) => {
          const value = item[header.key as keyof typeof item];
          let cellContent = renderCell(value, header.type);

          // منطق التاريخ المزدوج لـ Word
          if (
            (header.key === "evaluationDate" || header.key === "date") &&
            value &&
            value !== "—"
          ) {
            const dual = getDualDate(value, adjustments);
            if (dual) {
              // استخدام <br> للفصل بين التاريخين
              cellContent = `<span style="color:#AA771C;font-weight:bold;">${dual.hijri}</span><br/><span style="color:#666;font-size:0.9em;">${dual.gregorian}</span>`;
            }
          }

          const isSequence =
            header.key === "sequence" ||
            header.key === "serialNumber" ||
            header.key === "index" ||
            header.key === "no" ||
            header.label === "#" ||
            header.label === "م" ||
            header.label === "الرقم" ||
            header.label === "التسلسل";

          let cellStyle = `border: 1px solid #000; padding: 4px; text-align: ${isSequence ? 'center' : 'right'}; vertical-align: middle; color: ${rowColor}; word-wrap: break-word; white-space: normal;`;

          if (isSequence) {
            cellStyle += " width: 1% !important; white-space: nowrap !important; width: fit-content !important; min-width: 18px !important; max-width: 32px !important; text-align: center !important; font-weight: bold;";
          }

          if (
            header.key === "attendance" &&
            item.attendance &&
            colorMap[item.attendance] &&
            !isAbsentOrNotRecorded
          ) {
            cellStyle += `background-color: ${blendWithWhite(colorMap[item.attendance], 0.15)};`;
          } else if (
            header.key === "periodicReview" &&
            item.periodicReview &&
            colorMap[item.periodicReview]
          ) {
            cellStyle += `background-color: ${blendWithWhite(colorMap[item.periodicReview], 0.15)};`;
          } else if (
            header.key === "level" &&
            item.level &&
            colorMap[item.level]
          ) {
            cellStyle += `background-color: ${blendWithWhite(colorMap[item.level], 0.15)}; color: ${colorMap[item.level]}; font-weight: bold;`;
          } else if (
            header.key === "evalStatus" &&
            item.evalStatus &&
            colorMap[item.evalStatus]
          ) {
            cellStyle += `background-color: ${blendWithWhite(colorMap[item.evalStatus], 0.15)};`;
          }

          return `<td style="${cellStyle}">${cellContent}</td>`;
        })
        .join("");
      let trStyle = backgroundHighlight
        ? ` style="background-color: ${blendWithWhite(backgroundHighlight, 0.3)};"`
        : "";
      return `<tr${trStyle}>${rowCellsHtml}</tr>`;
    })
    .join("");

  const orientationCSS =
    orientation === "landscape"
      ? `@page WordSection1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 1cm; mso-header-margin: 0.5cm; mso-footer-margin: 0.5cm; }`
      : `@page WordSection1 { size: 595.3pt 841.9pt; mso-page-orientation: portrait; margin: 1cm; mso-header-margin: 0.5cm; mso-footer-margin: 0.5cm; }`;

  let htmlContent = `
    <html dir="rtl" lang="ar" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <title>${reportTitle || fileName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
        <style>
            ${orientationCSS}
            div.WordSection1 { page: WordSection1; }
            *, html, body, table, th, td, h1, h2, h3, div, span, p { 
              font-family: 'Tajawal', 'Amiri', 'Traditional Arabic', 'Simplified Arabic', 'Segoe UI', Tahoma, sans-serif !important; 
            }
            body { font-size: 9pt; line-height: 1.3; color: #000; direction: rtl; }
            table { width: 100%; margin: 10px 0 20px 0; border-collapse: collapse; direction: rtl; text-align: right; font-size: 8pt; table-layout: auto; }
            th, td { border: 1px solid #000; padding: 6px 4px; vertical-align: middle; word-wrap: break-word; white-space: normal; }
            th { background-color: #006A4E !important; color: #ffffff !important; font-weight: bold; text-align: center; }
        </style>
    </head>
    <body>
    <div class="WordSection1">
  `;

  if (reportTitle) {
    htmlContent += `<h1 style="text-align: center; color: #006A4E; font-family: 'Tajawal', sans-serif; font-size: 16pt; font-weight: 800; margin-bottom: 12px;">${reportTitle}</h1>`;
  }

  htmlContent += `
    <table>
        <thead>
            <tr>
                ${tableHeadersHtml}
            </tr>
        </thead>
        <tbody>
            ${tableRowsHtml}
        </tbody>
    </table>
    </div>
    </body>
    </html>
  `;

  if (action === "pdf") {
    // Generate high-quality HTML matching the print PDF
    const pdfHtmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle || fileName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
        <style>
          ${getReportStyles()}
          
          *, *::before, *::after {
            box-sizing: border-box !important;
          }

          *, html, body, table, th, td, h1, h2, h3, div, span, p {
            font-family: 'Tajawal', 'Amiri', 'Traditional Arabic', 'Segoe UI', Tahoma, sans-serif !important;
          }

          html, body { 
            background: #ffffff !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            direction: rtl !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .report-container { 
            display: block !important;
            width: 100% !important; 
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 0 !important; 
            margin: 0 !important;
            box-shadow: none !important; 
            border-radius: 0 !important;
            overflow: visible !important;
            direction: rtl !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
          }

          table {
            width: 100% !important;
            max-width: 100% !important;
            margin: 8px 0 !important;
            border-collapse: collapse !important;
            direction: rtl !important;
            table-layout: auto !important;
            box-sizing: border-box !important;
          }

          thead {
            display: table-header-group !important;
          }

          tbody {
            display: table-row-group !important;
          }

          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          th, td {
            page-break-inside: avoid !important;
          }

          th {
            background-color: #006A4E !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            text-align: center !important;
            padding: 6px 3px !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            box-sizing: border-box !important;
          }

          td {
            border: 1px solid #d1d5db !important;
            padding: 4px 3px !important;
            text-align: center !important;
            vertical-align: middle !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            box-sizing: border-box !important;
          }

          /* Responsive column scaling based on orientation */
          body.orientation-landscape table {
            font-size: 8.5pt !important;
          }
          body.orientation-landscape th {
            font-size: 9pt !important;
            padding: 5px 3px !important;
          }
          body.orientation-landscape td {
            font-size: 8pt !important;
            padding: 4px 3px !important;
          }

          body.orientation-portrait table {
            font-size: 7.5pt !important;
          }
          body.orientation-portrait th {
            font-size: 8pt !important;
            padding: 3px 2px !important;
          }
          body.orientation-portrait td {
            font-size: 7.5pt !important;
            padding: 2.5px 2px !important;
          }

          @page {
            size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'} !important;
            margin: 8mm 8mm 8mm 8mm !important;
          }
        </style>
      </head>
      <body class="orientation-${orientation} fs-medium">
        <div class="report-container">
          ${getReportContent(headers, data, reportTitle || fileName, "", adjustments, colorMap, rankColors)}
        </div>
      </body>
      </html>
    `;

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.backdropFilter = "blur(4px)";
    overlay.style.zIndex = "999999";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.fontFamily = "'Tajawal', sans-serif";
    overlay.style.direction = "rtl";

    overlay.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 32px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.2); width: 320px; max-width: 90%;">
        <div style="display: flex; justify-content: center; margin-bottom: 24px;">
          <svg style="animation: spin 1.5s linear infinite; width: 48px; height: 48px; color: #006A4E;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" style="opacity: 0.2;"></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h3 style="color: #006A4E; font-size: 18px; font-weight: 800; margin: 0 0 8px 0;">جارٍ تحضير ملف PDF...</h3>
        <p style="color: #4b5563; font-size: 13px; font-weight: 500; margin: 0;">يرجى الانتظار لحظات، يتم تجهيز الملف...</p>
      </div>
      <style>
        @keyframes spin { 100% { transform: rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(overlay);

    let pdfBlob: Blob | null = null;

    try {
      // 1. Try server endpoint first
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: pdfHtmlContent, orientation })
      });

      if (response.ok) {
        pdfBlob = await response.blob();
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (e: any) {
      console.warn("Server PDF endpoint unavailable or failed, switching to client-side PDF generation:", e);
      try {
        pdfBlob = await generateClientPdfBlob(pdfHtmlContent, orientation);
      } catch (clientErr: any) {
        console.error("Client PDF generation failed:", clientErr);
        // Fallback: if client-side html2pdf fails completely, fallback to exportToPdf window
        exportToPdf(headers, data, fileName, reportTitle || fileName, "", adjustments, colorMap, rankColors);
        return;
      }
    } finally {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }

    if (!pdfBlob) return;
    downloadPdfBlob(pdfBlob, `${fileName}.pdf`);

    function downloadPdfBlob(blob: Blob, name: string) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return;
  }

  const blob = new Blob([htmlContent], {
    type: "application/msword;charset=utf-8",
  });
  
  if (action === "share") {
    const file = new File([blob], `${fileName}.doc`, { type: "application/msword;charset=utf-8" });
    const canNativeShare =
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] });

    if (canNativeShare) {
      try {
        await navigator.share({
          files: [file],
          title: reportTitle || fileName,
          text: reportTitle || fileName
        });
        return;
      } catch (e: any) {
        console.warn("Direct Word share failed or was aborted:", e);
        if (e.name === "AbortError") {
          return;
        }
      }
    }

    // Interactive Share Modal for Word file
    const modalOverlay = document.createElement("div");
    modalOverlay.id = "word-share-overlay";
    modalOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      direction: rtl; font-family: 'Tajawal', sans-serif; padding: 16px;
    `;

    modalOverlay.innerHTML = `
      <div style="background: white; border-radius: 20px; max-width: 440px; width: 100%; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); text-align: center;">
        <div style="width: 56px; height: 56px; background: #e0f2fe; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
          <svg style="width: 32px; height: 32px; color: #0284c7;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
          </svg>
        </div>
        <h3 style="font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 8px;">مشاركة مستند Word</h3>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 20px; line-height: 1.5;">تم تجهيز الملف بنجاح. انقر على الزر أدناه لمشاركته عبر واتساب أو التطبيقات الأخرى.</p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-native-share-word" style="background: #006A4E; color: white; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>مشاركة الملف الآن</span>
          </button>
          <button id="btn-download-word" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer;">
            تنزيل وحفظ في الجهاز
          </button>
          <button id="btn-close-word-share" style="background: transparent; color: #94a3b8; border: none; padding: 6px; font-size: 12px; cursor: pointer;">
            إلغاء
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const btnNative = document.getElementById("btn-native-share-word");
    const btnDown = document.getElementById("btn-download-word");
    const btnClose = document.getElementById("btn-close-word-share");

    const cleanup = () => {
      if (document.body.contains(modalOverlay)) {
        document.body.removeChild(modalOverlay);
      }
    };

    if (btnNative) {
      btnNative.onclick = async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              files: [file],
              title: reportTitle || fileName,
              text: reportTitle || fileName
            });
            cleanup();
          } catch (err: any) {
            if (err.name !== "AbortError") {
              downloadBlob();
              cleanup();
            }
          }
        } else {
          downloadBlob();
          cleanup();
        }
      };
    }

    if (btnDown) {
      btnDown.onclick = () => {
        downloadBlob();
        cleanup();
      };
    }

    if (btnClose) {
      btnClose.onclick = cleanup;
    }
  } else {
    downloadBlob();
  }

  function downloadBlob() {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
