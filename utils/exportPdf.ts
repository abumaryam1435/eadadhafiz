import { translationMap } from "../constants";
import { toArabicDigits, formatRtlRange } from "./juzUtils";

export { toArabicDigits, formatRtlRange };

export interface ExportHeader {
  key: string;
  label: string;
  type?: string;
}

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

export const HIJRI_MONTHS = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

const GREGORIAN_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const normalizeDigits = (str: string): string => {
  return str
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[^\d\/\-]/g, "");
};

const getHijriDateParts = (
  date: Date,
): { day: string; month: number; year: string } => {
  const getParts = (calendar: string) => {
    try {
      const fmt = new Intl.DateTimeFormat(`en-US-u-ca-${calendar}-nu-latn`, {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      });
      return fmt.formatToParts(date);
    } catch (e) {
      return null;
    }
  };

  let parts = getParts("islamic-umalqura");
  let yearVal = parseInt(
    parts?.find((p) => p.type === "year")?.value || "9999",
  );

  if (yearVal > 1800) {
    parts = getParts("islamic");
    yearVal = parseInt(parts?.find((p) => p.type === "year")?.value || "9999");
  }

  if (yearVal > 1800 || !parts) {
    const gYear = date.getFullYear();
    const approxHYear = Math.floor(((gYear - 622) * 33) / 32);
    return {
      day: date.getDate().toString(),
      month: date.getMonth() + 1,
      year: approxHYear.toString(),
    };
  }

  return {
    day: parts!.find((p) => p.type === "day")?.value || "",
    month: parseInt(parts!.find((p) => p.type === "month")?.value || "1"),
    year: parts!.find((p) => p.type === "year")?.value || "",
  };
};

export const gregorianToHijriFormatted = (
  dateInput: string | Date,
  adjustments: Record<string, number> = {},
): string => {
  let date: Date;
  if (dateInput instanceof Date) {
    date = new Date(dateInput.getTime());
  } else {
    const inputStr = normalizeDigits(String(dateInput));
    if (inputStr.includes("-")) {
      const parts = inputStr.split("-").map(Number);
      if (parts[0] > 1000) date = new Date(parts[0], parts[1] - 1, parts[2]);
      else date = new Date(parts[2], parts[1] - 1, parts[0]);
    } else if (inputStr.includes("/")) {
      const parts = inputStr.split("/").map(Number);
      if (parts[0] > 1000) date = new Date(parts[0], parts[1] - 1, parts[2]);
      else date = new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
      date = new Date(dateInput);
    }
  }

  if (isNaN(date.getTime())) return "—";

  const hPartsStandard = getHijriDateParts(date);
  const offsetKey = `${hPartsStandard.month}-${hPartsStandard.year}`;
  const offset = adjustments[offsetKey] || 0;

  const adjustedDate = new Date(date.getTime());
  adjustedDate.setDate(adjustedDate.getDate() + offset);

  const gDay = date.getDate();
  const gMonth = GREGORIAN_MONTHS[date.getMonth()];
  const gYear = date.getFullYear();

  const hParts = getHijriDateParts(adjustedDate);
  const hMonthName = HIJRI_MONTHS[(hParts.month - 1) % 12];

  return toArabicDigits(`${hParts.day} ${hMonthName} ${hParts.year} هـ الموافق ${gDay} ${gMonth} ${gYear} م`);
};

const formatShortHijriNumeric = (
  date: Date,
  adjustments: Record<string, number>,
): string => {
  const hPartsStandard = getHijriDateParts(date);
  const offsetKey = `${hPartsStandard.month}-${hPartsStandard.year}`;
  const offset = adjustments[offsetKey] || 0;

  const adjustedDate = new Date(date.getTime());
  adjustedDate.setDate(adjustedDate.getDate() + offset);

  const hParts = getHijriDateParts(adjustedDate);
  return `${hParts.day}/${hParts.month}/${hParts.year}هـ`;
};

export const getDualDate = (
  value: any,
  adjustments: Record<string, number>,
) => {
  if (!value || value === "—") return null;
  try {
    const valStr = normalizeDigits(String(value)).trim();
    let dObj: Date | null = null;
    if (valStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
      const parts = valStr.split("-").map(Number);
      dObj = new Date(parts[0], parts[1] - 1, parts[2]);
    } else if (valStr.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/)) {
      const parts = valStr.split(/[\/-]/).map(Number);
      dObj = new Date(parts[2], parts[1] - 1, parts[0]);
    } else if (valStr.match(/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/)) {
      const parts = valStr.split(/[\/-]/).map(Number);
      dObj = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      dObj = new Date(valStr);
    }

    if (dObj && !isNaN(dObj.getTime())) {
      const hijri = toArabicDigits(formatShortHijriNumeric(dObj, adjustments));
      const gregorian = toArabicDigits(`${dObj.getDate()}/${dObj.getMonth() + 1}/${dObj.getFullYear()}م`);
      return { hijri, gregorian };
    }
  } catch (e) {
    console.error("Date parse error", e);
  }
  return null;
};

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return hex;
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getTableHtmlParts = (
  headers: ExportHeader[],
  data: any[],
  adjustments: Record<string, number>,
  colorMap: Record<string, string> = {},
  rankColors?: Record<string, string>,
) => {
  const tableHeaders = headers
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

      let style =
        "background-color: #006A4E; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #004D40; padding: 4px 2px; font-size: 11px;";
      
      if (isSequence) {
        style += " width: 1% !important; white-space: nowrap !important; width: fit-content !important; min-width: 18px !important; max-width: 32px !important; padding: 3px 2px !important;";
      }

      return `<th style="${style} direction: rtl; unicode-bidi: isolate;">${h.label}</th>`;
    })
    .join("");

  const tableRowsHtml = data
    .map((item, index) => {
      let backgroundHighlight = null;

      let rowColor = "#000000";
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

      const isAlAmeen = item.isAlAmeenStr === "نعم";
      let baseBg = index % 2 === 0 ? "#ffffff" : "#f0fdf4";
      if (isAlAmeen) {
        baseBg = "#fee1e1";
      }
      const bgClass = backgroundHighlight
        ? hexToRgba(backgroundHighlight, 0.3)
        : baseBg;

      const rowCellsHtml = headers
        .map((header) => {
          const value = item[header.key as keyof typeof item];
          let cellContent = renderCell(value, header.type);

          const isSequence =
            header.key === "sequence" ||
            header.key === "serialNumber" ||
            header.key === "index" ||
            header.key === "no" ||
            header.label === "#" ||
            header.label === "م" ||
            header.label === "الرقم" ||
            header.label === "التسلسل";

          let cellStyle = "";
          if (isSequence) {
            cellStyle += " width: 1% !important; white-space: nowrap !important; width: fit-content !important; min-width: 18px !important; max-width: 32px !important; padding: 2px 2px !important; font-weight: bold; text-align: center;";
          }

          if (
            header.key === "attendance" &&
            item.attendance &&
            colorMap[item.attendance] &&
            !isAbsentOrNotRecorded
          ) {
            cellStyle += `background-color: ${hexToRgba(colorMap[item.attendance], 0.15)};`;
          } else if (
            header.key === "periodicReview" &&
            item.periodicReview &&
            colorMap[item.periodicReview]
          ) {
            cellStyle += `background-color: ${hexToRgba(colorMap[item.periodicReview], 0.15)};`;
          } else if (
            header.key === "level" &&
            item.level &&
            colorMap[item.level]
          ) {
            cellStyle += `background-color: ${hexToRgba(colorMap[item.level], 0.15)}; color: ${colorMap[item.level]}; font-weight: bold;`;
          } else if (
            header.key === "evalStatus" &&
            item.evalStatus &&
            colorMap[item.evalStatus]
          ) {
            cellStyle += `background-color: ${hexToRgba(colorMap[item.evalStatus], 0.15)};`;
          }

          if (
            (header.key === "evaluationDate" || header.key === "date") &&
            value &&
            value !== "—"
          ) {
            const dual = getDualDate(value, adjustments);
            if (dual) {
              cellContent = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; line-height: 1; direction: rtl;">
                    <span style="font-weight: 800; font-size: 11px;">${dual.hijri}</span>
                    <span style="font-size: 10px; opacity: 0.8; font-weight: bold;">${dual.gregorian}</span>
                </div>`;
            }
          }
          return `<td style="border: 1px solid #d1d5db; padding: 3px 3px; text-align: center; vertical-align: middle; font-size: 10.5px; color: ${rowColor}; line-height: 1.2; direction: rtl; unicode-bidi: isolate; ${cellStyle}">${cellContent}</td>`;
        })
        .join("");
      return `<tr style="background-color: ${bgClass};">${rowCellsHtml}</tr>`;
    })
    .join("");
  return { tableHeaders, tableRowsHtml };
};

export const getReportStyles = () => `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap');

  @page {
    margin: 4mm 4mm 4mm 4mm !important;
    size: auto;
  }

  *, html, body, table, th, td, h1, h2, h3, h4, h5, h6, div, span, p, a, button { 
    font-family: 'Tajawal', 'Amiri', 'Traditional Arabic', 'Simplified Arabic', 'Segoe UI', Tahoma, sans-serif !important; 
    box-sizing: border-box !important;
  }

  html, body { 
    margin: 0; 
    padding: 2px 4px;
    background: white; 
    color: #1f2937; 
    -webkit-print-color-adjust: exact; 
    print-color-adjust: exact;
    display: block !important;
    height: auto !important;
    min-height: auto !important;
    overflow: visible !important;
    direction: rtl !important;
    text-align: right !important;
  }

  table {
    direction: rtl !important;
  }

  th, td {
    direction: rtl !important;
    unicode-bidi: isolate !important;
  }
  
  .header { 
    text-align: center !important; 
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    margin: 0 auto 10px auto !important; 
    border-bottom: 2px double #D4AF37 !important; 
    padding-bottom: 8px !important; 
    width: 100% !important;
  }
  .header h1 { 
    color: #006A4E !important; 
    margin: 0 0 4px 0 !important; 
    font-size: 18px !important; 
    font-weight: 800 !important; 
    text-align: center !important;
    width: 100% !important;
  }
  .header .filters { 
    color: #374151 !important; 
    font-size: 10.5px !important; 
    font-weight: bold !important; 
    margin: 2px auto 4px auto !important; 
    display: inline-flex !important; 
    align-items: center !important;
    justify-content: center !important;
    text-align: center !important;
    border: 1px dashed #006A4E !important; 
    padding: 3px 12px !important; 
    background: #f0fdf4 !important; 
    border-radius: 9999px !important; 
  }
  .header .date-line { 
    color: #4b5563 !important; 
    font-size: 10px !important; 
    margin: 2px auto 0 auto !important; 
    font-weight: 700 !important; 
    text-align: center !important;
    width: 100% !important;
  }

  table { 
    width: 100% !important; 
    max-width: 100% !important; 
    margin: 6px auto 14px auto !important; 
    border-collapse: collapse !important; 
    table-layout: auto !important; 
    box-sizing: border-box !important;
  }
  th { 
    background-color: #006A4E !important; 
    color: #ffffff !important; 
    font-weight: 700; 
    text-align: center; 
    border: 1px solid #004D40; 
    padding: 5px 3px !important; 
    font-size: 10.5px;
    white-space: normal !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
    word-break: break-word !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  td { 
    white-space: normal !important; 
    word-wrap: break-word !important; 
    overflow-wrap: break-word !important;
    word-break: break-word !important;
    border: 1px solid #d1d5db; 
    padding: 3.5px 3px !important; 
    text-align: center; 
    vertical-align: middle; 
    font-size: 9.5px; 
    line-height: 1.25;
  }
  thead { 
    display: table-header-group !important; 
  }
  tbody { 
    display: table-row-group !important; 
  }
  tr { 
    page-break-inside: avoid !important; 
    break-inside: avoid !important; 
  }

  /* Font size presets */
  body.fs-small th { font-size: 8.5px !important; padding: 3.5px 2px !important; }
  body.fs-small td { font-size: 7.8px !important; padding: 2.5px 2px !important; }
  body.fs-medium th { font-size: 10.5px !important; padding: 5px 3px !important; }
  body.fs-medium td { font-size: 9px !important; padding: 3.5px 2.5px !important; }
  body.fs-large th { font-size: 12.5px !important; padding: 7px 4px !important; }
  body.fs-large td { font-size: 11px !important; padding: 5px 4px !important; }

  /* Landscape compact styles */
  body.orientation-landscape {
    padding: 2px 4px;
  }
  body.orientation-landscape .header { 
    margin-bottom: 8px !important; 
    padding-bottom: 6px !important; 
    border-bottom: 1.5px dashed #D4AF37 !important;
  }
  body.orientation-landscape .header h1 { 
    font-size: 17px !important; 
    margin-bottom: 3px !important; 
  }
  body.orientation-landscape .header .filters { 
    font-size: 10px !important; 
    margin: 2px auto 3px auto !important; 
    padding: 2px 8px !important; 
  }
  body.orientation-landscape .header .date-line { 
    font-size: 9.5px !important; 
  }
  body.orientation-landscape table { 
    margin-top: 4px !important; 
    margin-bottom: 10px !important; 
  }
  body.orientation-landscape th {
    padding: 4.5px 2px !important;
    font-size: 9.5px !important;
  }
  body.orientation-landscape td {
    padding: 2.5px 2px !important;
    font-size: 8.5px !important;
    line-height: 1.2 !important;
  }
  body.orientation-landscape.fs-small th { font-size: 8px !important; padding: 2.5px 1.5px !important; }
  body.orientation-landscape.fs-small td { font-size: 7.2px !important; padding: 2px 1.5px !important; }
  body.orientation-landscape.fs-medium th { font-size: 9.5px !important; padding: 4px 2px !important; }
  body.orientation-landscape.fs-medium td { font-size: 8.5px !important; padding: 3px 2px !important; }
  body.orientation-landscape.fs-large th { font-size: 11.5px !important; padding: 5px 3.5px !important; }
  body.orientation-landscape.fs-large td { font-size: 10.5px !important; padding: 4.5px 3.5px !important; }

  /* Portrait compact styles */
  body.orientation-portrait.fs-small th { font-size: 7px !important; padding: 2px 1.5px !important; }
  body.orientation-portrait.fs-small td { font-size: 6.5px !important; padding: 1.5px 1.5px !important; }
  body.orientation-portrait.fs-medium th { font-size: 8px !important; padding: 2.5px 2px !important; }
  body.orientation-portrait.fs-medium td { font-size: 7.5px !important; padding: 2px 2px !important; }
  body.orientation-portrait.fs-large th { font-size: 10px !important; padding: 3.5px 3px !important; }
  body.orientation-portrait.fs-large td { font-size: 9px !important; padding: 3px 3px !important; }

  @media print { 
    .no-print { display: none !important; } 
    @page {
      margin: 4mm 4mm 4mm 4mm !important;
      size: auto;
    }
    html, body {
      background: white !important;
      padding: 0 !important;
      margin: 0 !important;
      display: block !important;
      height: auto !important;
      min-height: auto !important;
      overflow: visible !important;
    }
    .report-container { 
        display: block !important;
        width: 100% !important; 
        max-width: 100% !important; 
        min-width: 0 !important;
        min-height: unset !important;
        padding: 0 !important; 
        margin: 0 auto !important; 
        box-shadow: none !important; 
        border-radius: 0 !important;
        overflow: visible !important;
        text-align: center !important;
    }
    body table {
        margin: 0 auto !important;
        width: 100% !important;
        max-width: 100% !important;
        table-layout: auto !important;
        border-collapse: collapse !important;
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
        break-inside: avoid !important; 
    }
    body th, body td {
        white-space: normal !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        word-break: break-word !important;
    }
    
    /* Respect font size and orientation settings during native print too */
    body.orientation-landscape.fs-small th { font-size: 8px !important; padding: 2.5px 1.5px !important; }
    body.orientation-landscape.fs-small td { font-size: 7.2px !important; padding: 2px 1.5px !important; }
    body.orientation-landscape.fs-medium th { font-size: 9.5px !important; padding: 4px 2px !important; }
    body.orientation-landscape.fs-medium td { font-size: 8.5px !important; padding: 3px 2px !important; }
    body.orientation-landscape.fs-large th { font-size: 11.5px !important; padding: 5px 3.5px !important; }
    body.orientation-landscape.fs-large td { font-size: 10.5px !important; padding: 4.5px 3.5px !important; }

    body.orientation-portrait.fs-small th { font-size: 7px !important; padding: 1.8px 1.2px !important; }
    body.orientation-portrait.fs-small td { font-size: 6.5px !important; padding: 1.5px 1.5px !important; }
    body.orientation-portrait.fs-medium th { font-size: 8px !important; padding: 2.2px 2px !important; }
    body.orientation-portrait.fs-medium td { font-size: 7.5px !important; padding: 2px 2px !important; }
    body.orientation-portrait.fs-large th { font-size: 10px !important; padding: 3.5px 3px !important; }
    body.orientation-portrait.fs-large td { font-size: 9px !important; padding: 3px 3px !important; }
  }
`;

export const getReportContent = (
  headers: ExportHeader[],
  data: any[],
  reportTitle: string,
  subtitle?: string,
  adjustments: Record<string, number> = {},
  colorMap: Record<string, string> = {},
  rankColors?: Record<string, string>,
) => {
  const today = new Date();
  const fullDateLine = gregorianToHijriFormatted(today, adjustments);
  const { tableHeaders, tableRowsHtml } = getTableHtmlParts(
    headers,
    data,
    adjustments,
    colorMap,
    rankColors,
  );

  return `
      <div class="header" style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; margin: 0 auto 10px auto; padding-bottom: 8px; border-bottom: 2px double #D4AF37;">
        <h1 style="color: #006A4E; margin: 0 0 4px 0; font-size: 18px; font-weight: 800; text-align: center; width: 100%;">${reportTitle}</h1>
        ${subtitle ? `<div class="filters" style="text-align: center; display: inline-flex; align-items: center; justify-content: center; margin: 2px auto 4px auto; padding: 3px 12px; background: #f0fdf4; border: 1px dashed #006A4E; border-radius: 9999px; font-size: 10.5px; font-weight: bold; color: #374151;">${subtitle}</div>` : ""}
        <div class="date-line" style="text-align: center; width: 100%; color: #4b5563; font-size: 10px; font-weight: 700; margin: 2px auto 0 auto;">${fullDateLine}</div>
      </div>
      <table style="width: 100% !important; max-width: 100% !important; margin: 0 auto 14px auto; border-collapse: collapse; table-layout: auto;">
        <thead>
            <tr>${tableHeaders}</tr>
        </thead>
        <tbody>${tableRowsHtml}</tbody>
      </table>
  `;
};

export const exportToPdf = async (
  headers: ExportHeader[],
  data: any[],
  fileName: string,
  reportTitle: string,
  subtitle?: string,
  adjustments: Record<string, number> = {},
  colorMap: Record<string, string> = {},
  rankColors?: Record<string, string>,
) => {
  const styles = getReportStyles();
  const content = getReportContent(
    headers,
    data,
    reportTitle,
    subtitle,
    adjustments,
    colorMap,
    rankColors,
  );

  const uniqueId = "pdf_" + Math.random().toString(36).substring(2, 11);

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("يرجى السماح بالنوافذ المنبثقة لعرض معاينة الطباعة");
    return;
  }

  printWindow.addEventListener("beforeunload", () => {
  });

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>${fileName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <style>${styles}</style>
      <style id="page-orientation-style">
        @media screen {
            .report-container {
                width: max-content; 
                min-width: 297mm;
                min-height: 210mm;
            }
        }
      </style>
      <style>
        /* Screen-only styles for the Preview Mode */
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @media screen {
            body {
                background-color: #4b5563;
                margin: 0;
                padding: 0;
                display: block;
                width: 100vw;
                max-width: 100vw;
                overflow-x: hidden;
                min-height: 100vh;
                font-family: 'Tajawal', sans-serif;
                box-sizing: border-box;
            }
            .report-scroll-wrapper {
                width: 100%;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                display: block;
                text-align: right;
                box-sizing: border-box;
                padding: 24px 12px 160px 12px;
            }
            @media (min-width: 1200px) {
                .report-scroll-wrapper {
                    text-align: center;
                }
            }
            .report-container {
                display: inline-block;
                text-align: right;
                background: white;
                padding: 15mm;
                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                border-radius: 12px;
                box-sizing: border-box;
                transition: all 0.3s ease;
            }
            .preview-controls {
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                background: rgba(255, 255, 255, 0.98) !important;
                backdrop-filter: blur(12px) !important;
                border: 2px solid #006A4E !important;
                padding: 14px 18px !important;
                border-radius: 20px !important;
                box-shadow: 0 15px 40px rgba(0,0,0,0.3), 0 0 0 100vw rgba(0,0,0,0.15) !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 10px !important;
                z-index: 99999 !important;
                /* direction: rtl !important; removed for html2canvas compatibility */
                width: 440px !important;
                max-width: 90vw !important;
                max-height: 90vh !important;
                overflow-y: auto !important;
                box-sizing: border-box !important;
                font-family: 'Tajawal', sans-serif !important;
            }
            .control-group-box {
                background: #fcfbf7 !important;
                border: 1px solid #f1ece1 !important;
                border-radius: 12px !important;
                padding: 6px 10px !important;
                display: flex !important;
                flex-direction: column !important;
                width: 100% !important;
            }
            .group-title-label {
                font-size: 11px !important;
                font-weight: 800 !important;
                color: #4b5563 !important;
                text-align: right !important;
                margin-bottom: 2px !important;
            }
            .btn {
                border: none !important;
                padding: 6px 12px !important;
                border-radius: 9999px !important;
                font-family: 'Tajawal', sans-serif !important;
                font-weight: 700 !important;
                font-size: 12px !important;
                cursor: pointer !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 6px !important;
                transition: all 0.2s ease !important;
                outline: none !important;
            }
            .btn:active { transform: scale(0.95) !important; }
            .btn-primary { 
                background: #006A4E !important; 
                color: white !important; 
            }
            .btn-primary:hover {
                background: #004D40 !important;
            }
            .btn-secondary { 
                background: #f3f4f6 !important; 
                color: #374151 !important; 
            }
            .btn-secondary:hover {
                background: #e5e7eb !important;
            }
            #btn-save-pdf {
                background: #0284c7 !important;
                color: white !important;
            }
            #btn-save-pdf:hover {
                background: #0369a1 !important;
            }
            .btn-active {
                background: #006A4E !important;
                color: white !important;
            }
            .btn svg {
                width: 15px !important;
                height: 15px !important;
            }
            
            /* Responsive styling for small mobile screens */
            @media (max-width: 480px) {
                .preview-controls {
                    width: calc(100vw - 20px) !important;
                    max-width: calc(100vw - 20px) !important;
                    left: 50% !important;
                    top: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    padding: 12px !important;
                    border-radius: 12px !important;
                }
                .control-groups-grid {
                    grid-template-columns: 1fr 1fr !important; /* side by side */
                    gap: 6px !important;
                }
                .control-group-box {
                    padding: 6px 8px !important;
                }
                .group-title-label {
                    font-size: 10px !important;
                }
                .btn {
                    padding: 0 4px !important;
                }
                .control-groups-grid .btn {
                    height: 34px !important;
                    font-size: 10.5px !important;
                }
                .btn-primary, #btn-save-pdf {
                    height: 38px !important;
                    font-size: 13px !important;
                }
            }
        }
        body.is-saving-pdf {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            width: max-content !important;
        }
        body.is-saving-pdf .report-scroll-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            width: max-content !important;
            overflow: visible !important;
        }
        body.is-saving-pdf .report-container {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            display: block !important;
            box-sizing: border-box !important;
            overflow: visible !important;
        }
        body.is-saving-pdf.orientation-landscape .report-container {
            width: max-content !important;
            min-width: 297mm !important;
            padding: 10mm !important;
        }
        body.is-saving-pdf.orientation-portrait .report-container {
            width: max-content !important;
            min-width: 210mm !important;
            padding: 10mm !important;
        }
        body.is-saving-pdf table {
            margin: 10px 0 !important;
        }
        @media print {
           .preview-controls, #btn-show-controls { display: none !important; }
           html, body { 
               background: white !important; 
               padding: 0 !important; 
               margin: 0 !important; 
               display: block !important; 
               height: auto !important; 
               min-height: auto !important; 
               overflow: visible !important; 
           }
           .report-scroll-wrapper {
               display: block !important;
               padding: 0 !important;
               margin: 0 !important;
               overflow: visible !important;
               width: auto !important;
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
               /* direction: rtl !important; removed for html2canvas compatibility */
           }
        }
      </style>
    </head>
    <body class="orientation-landscape fs-medium" dir="rtl">
      <button id="btn-show-controls" onclick="toggleControls(true)" class="no-print" style="position: fixed; top: 16px; right: 16px; z-index: 99998; background: #006A4E; color: white; border: 2px solid #004D40; border-radius: 50px; padding: 10px 20px; font-family: 'Tajawal', sans-serif; font-size: 13px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.25); display: none; align-items: center; gap: 6px;">
         <span>⚙️ عرض خيارات الطباعة</span>
      </button>

      <div class="preview-controls no-print">
         <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 4px;">
            <span style="font-size: 13.5px; font-weight: 800; color: #006A4E;">⚙️ خيارات الطباعة</span>
            <div style="display: flex; gap: 6px;">
               <button onclick="toggleControls(false)" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: bold; cursor: pointer;">إخفاء</button>
               <button onclick="window.close()" style="background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: bold; cursor: pointer;">إغلاق</button>
            </div>
         </div>

         <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
               <button onclick="window.print()" class="btn btn-primary" style="height: 42px; font-size: 15px; width: 100%;">
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                  <span>طباعة</span>
               </button>
            </div>

            <div class="control-groups-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div class="control-group-box">
                    <span class="group-title-label">اتجاه الملف:</span>
                    <div style="display: flex; gap: 4px; margin-top: 4px;">
                        <button id="btn-orient-landscape" onclick="setOrientation('landscape')" class="btn btn-active" style="flex:1; height:28px; font-size:11px;">أفقي</button>
                        <button id="btn-orient-portrait" onclick="setOrientation('portrait')" class="btn btn-secondary" style="flex:1; height:28px; font-size:11px;">طولي</button>
                    </div>
                </div>
                <div class="control-group-box">
                    <span class="group-title-label">حجم جدول البيانات:</span>
                    <div style="display: flex; gap: 3px; margin-top: 4px;">
                        <button id="btn-fs-small" onclick="changeFontSize('small')" class="btn btn-secondary" style="flex:1; height:28px; font-size:10px;">صغير</button>
                        <button id="btn-fs-medium" onclick="changeFontSize('medium')" class="btn btn-active" style="flex:1; height:28px; font-size:10px;">وسط</button>
                        <button id="btn-fs-large" onclick="changeFontSize('large')" class="btn btn-secondary" style="flex:1; height:28px; font-size:10px;">كبير</button>
                    </div>
                </div>
            </div>
         </div>
      </div>

      <div class="report-scroll-wrapper">
         <div class="report-container" style="direction: rtl;">
           ${content}
         </div>
      </div>

      <script>
        const myUniquePdfId = "${uniqueId}";

        function setOrientation(mode) {
            const styleEl = document.getElementById('page-orientation-style');
            if (mode === 'landscape') {
                styleEl.innerHTML = '@media screen { .report-container { width: max-content !important; min-width: 297mm !important; min-height: 210mm !important; } } @media print { @page { size: landscape !important; margin: 6mm 8mm !important; } }';
                document.body.classList.remove('orientation-portrait');
                document.body.classList.add('orientation-landscape');
                
                document.getElementById('btn-orient-landscape').className = 'btn btn-active';
                document.getElementById('btn-orient-portrait').className = 'btn btn-secondary';
            } else {
                styleEl.innerHTML = '@media screen { .report-container { width: max-content !important; min-width: 210mm !important; min-height: 297mm !important; } } @media print { @page { size: portrait !important; margin: 6mm 6mm !important; } }';
                document.body.classList.remove('orientation-landscape');
                document.body.classList.add('orientation-portrait');
                
                document.getElementById('btn-orient-landscape').className = 'btn btn-secondary';
                document.getElementById('btn-orient-portrait').className = 'btn btn-active';
            }
        }

        function changeFontSize(size) {
            document.body.classList.remove('fs-small', 'fs-medium', 'fs-large');
            document.body.classList.add('fs-' + size);
            
            ['small', 'medium', 'large'].forEach(s => {
                const btn = document.getElementById('btn-fs-' + s);
                if (btn) btn.className = 'btn btn-secondary';
            });
            const activeBtn = document.getElementById('btn-fs-' + size);
            if (activeBtn) activeBtn.className = 'btn btn-active';
        }

        function downloadPdf() {
            const element = document.querySelector('.report-container');
            const fileName = document.title || 'report';
            const isLandscape = document.body.classList.contains('orientation-landscape');
            const targetWidth = isLandscape ? 1060 : 740;
            const opt = {
                margin: isLandscape ? [6, 6, 6, 6] : [6, 5, 6, 5],
                filename: fileName + '.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                pagebreak: { mode: ['css', 'legacy'] },
                html2canvas: { 
                  scale: 2, 
                  useCORS: true, 
                  letterRendering: false, 
                  backgroundColor: '#ffffff',
                  windowWidth: targetWidth,
                  width: targetWidth,
                  scrollX: 0,
                  scrollY: 0,
                  x: 0,
                  y: 0
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: isLandscape ? 'landscape' : 'portrait' }
            };
            
            const saveBtn = document.getElementById('btn-save-pdf');
            const originalText = saveBtn ? saveBtn.innerHTML : '';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.7';
                saveBtn.innerHTML = '<span>جاري التحميل...</span>';
            }
            
            html2pdf().set(opt).from(element).save().then(() => {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.style.opacity = '1';
                    saveBtn.innerHTML = originalText;
                }
            }).catch(err => {
                console.error("PDF generation error:", err);
                alert("حدث خطأ أثناء تحميل الملف");
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.style.opacity = '1';
                    saveBtn.innerHTML = originalText;
                }
            });
        }

        function toggleControls(show) {
            const controls = document.querySelector('.preview-controls');
            const showBtn = document.getElementById('btn-show-controls');
            if (show) {
                controls.style.display = 'flex';
                showBtn.style.display = 'none';
            } else {
                controls.style.display = 'none';
                showBtn.style.display = 'flex';
            }
        }

        window.onload = function() {
            setOrientation('landscape');
            changeFontSize('medium');
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  
  printWindow.focus();
};

export const sharePdfDirectly = async (
  headers: ExportHeader[],
  data: any[],
  fileName: string,
  reportTitle: string,
  subtitle?: string,
  adjustments: Record<string, number> = {},
  colorMap: Record<string, string> = {},
  rankColors?: Record<string, string>,
  orientation: "landscape" | "portrait" = "landscape"
) => {
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
      <h3 style="color: #006A4E; font-size: 18px; font-weight: 800; margin: 0 0 8px 0;">جارٍ تحضير ملف PDF للمشاركة...</h3>
      <p style="color: #4b5563; font-size: 13px; font-weight: 500; margin: 0;">يرجى الانتظار لحظات، يتم تجهيز الملف بدقة عالية...</p>
    </div>
    <style>
      @keyframes spin { 100% { transform: rotate(360deg); } }
    </style>
  `;
  document.body.appendChild(overlay);

  try {
    const styles = getReportStyles();
    const content = getReportContent(
      headers,
      data,
      reportTitle,
      subtitle,
      adjustments,
      colorMap,
      rankColors
    );

    const isLandscape = orientation === "landscape";
    const targetWidth = isLandscape ? 1060 : 740;

    const pdfHtmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle || fileName}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
        <style>
          ${styles}
          html, body {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            direction: rtl !important;
            text-align: right !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        </style>
      </head>
      <body class="orientation-${orientation} ${headers.length > 8 ? 'fs-small' : 'fs-medium'}" dir="rtl">
        <div class="report-container" style="display: block; width: 100%; max-width: ${targetWidth}px; padding: 4px 4px; box-sizing: border-box; overflow: visible; direction: rtl; margin: 0 auto; text-align: center;">
          ${content}
        </div>
      </body>
      </html>
    `;

    let pdfBlob: Blob;
    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: pdfHtmlContent, orientation }),
      });

      if (!response.ok) {
        throw new Error("Server PDF generation failed");
      }
      pdfBlob = await response.blob();
    } catch (serverErr) {
      console.warn("Server PDF generation failed, falling back to client-side generation...", serverErr);
      
      const html2pdf = (window as any).html2pdf;
      if (!html2pdf) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
      }
      
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.top = "0";
      iframe.style.left = "0";
      iframe.style.width = `${targetWidth + 40}px`;
      iframe.style.height = "2500px";
      iframe.style.border = "none";
      iframe.style.zIndex = "-99999";
      iframe.style.opacity = "0.01";
      iframe.style.pointerEvents = "none";
      document.body.appendChild(iframe);

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error("تعذر إنشاء إطار PDF");
        
        iframeDoc.open();
        iframeDoc.write(pdfHtmlContent);
        iframeDoc.close();

        await new Promise((resolve) => setTimeout(resolve, 800));
        try {
          if (iframeDoc.fonts) {
            await Promise.race([
              (iframeDoc.fonts as any).ready,
              new Promise((r) => setTimeout(r, 2000)),
            ]);
          }
        } catch (e) {}

        const targetElement = (iframeDoc.querySelector('.report-container') as HTMLElement) || iframeDoc.body;
        const opt = {
          margin: isLandscape ? [4, 4, 4, 4] : [4, 4, 4, 4],
          filename: fileName + ".pdf",
          image: { type: "jpeg", quality: 0.98 },
          pagebreak: { mode: ['css', 'legacy'] },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: false,
            backgroundColor: "#ffffff",
            windowWidth: targetWidth,
            width: targetWidth,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
          },
          jsPDF: { unit: "mm", format: "a4", orientation: orientation },
        };

        const worker = (window as any).html2pdf().set(opt).from(targetElement);
        pdfBlob = await worker.output("blob");
      } finally {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }
    }
    const pdfFile = new File([pdfBlob], `${fileName}.pdf`, { type: "application/pdf" });

    const hasShare = typeof navigator !== 'undefined' && !!navigator.share;

    // Update overlay to show the final buttons
    overlay.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 28px 24px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.25); width: 340px; max-width: 92%; direction: rtl;">
        <div style="display: flex; justify-content: center; margin-bottom: 16px;">
          <div style="width: 56px; height: 56px; background-color: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <svg style="width: 32px; height: 32px; color: #006A4E;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h3 style="color: #006A4E; font-size: 18px; font-weight: 800; margin: 0 0 8px 0;">تم تجهيز التقرير بنجاح!</h3>
        <p style="color: #6b7280; font-size: 12px; margin: 0 0 20px 0; font-weight: 600;">يمكنك مشاركة الملف مباشرة أو تنزيله لجهازك:</p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${hasShare ? `
          <button id="btn-share-native" style="background: #006A4E; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(0,106,78,0.3);">
            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
            مشاركة عبر التطبيقات (واتساب / بريد)
          </button>` : ''}
          <button id="btn-download-native" style="background: #2563eb; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(37,99,235,0.25);">
            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            تنزيل وحفظ ملف PDF
          </button>
          <button id="btn-close-native" style="background: transparent; color: #6b7280; border: none; padding: 8px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 13px; margin-top: 4px;">إغلاق النافذة</button>
        </div>
      </div>
    `;

    const btnShare = overlay.querySelector('#btn-share-native') as HTMLButtonElement;
    const btnDownload = overlay.querySelector('#btn-download-native') as HTMLButtonElement;
    const btnClose = overlay.querySelector('#btn-close-native') as HTMLButtonElement;

    const downloadBlob = () => {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };

    if (btnShare) {
      btnShare.onclick = async () => {
        try {
          const canShareFiles = navigator.canShare && navigator.canShare({ files: [pdfFile] });
          if (canShareFiles) {
            await navigator.share({
              files: [pdfFile],
              title: reportTitle || fileName,
              text: `تقرير: ${reportTitle || fileName}`
            });
          } else {
            downloadBlob();
            if (navigator.share) {
              await navigator.share({
                title: reportTitle || fileName,
                text: `تقرير: ${reportTitle || fileName}`
              });
            }
          }
        } catch (err: any) {
          if (err.name !== "AbortError") {
            downloadBlob();
            alert("تم حفظ ملف PDF في جهازك، يمكنك الآن مشاركته وإرفاقه عبر أي تطبيق.");
          }
        }
      };
    }

    if (btnDownload) {
      btnDownload.onclick = () => {
        downloadBlob();
      };
    }

    if (btnClose) {
      btnClose.onclick = () => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      };
    }

    return;
    
  } catch (error) {
    console.error("PDF Share Error:", error);
    alert("حدث خطأ غير متوقع أثناء معالجة ملف PDF.");
  }

  // Remove overlay only if there was an error (success leaves it open for user interaction)
  if (document.body.contains(overlay)) {
    document.body.removeChild(overlay);
  }
};



