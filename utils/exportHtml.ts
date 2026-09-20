import { translationMap } from '../constants';
import { getDualDate, gregorianToHijriFormatted } from './exportPdf';
import { toArabicDigits, formatRtlRange } from './juzUtils';

interface ExportHeader {
  key: string;
  label: string;
  type?: string;
}

const renderCell = (value: any, type?: string) => {
  if (value === undefined || value === null || value === '') return '—';
  if (type === 'translation') {
    const translated = translationMap[value as keyof typeof translationMap] || value;
    return toArabicDigits(translated);
  }
  if (type === 'array') return Array.isArray(value) ? value.map(formatRtlRange).join('، ') : '—';
  if (typeof value === 'number') {
    return toArabicDigits(value);
  }
  if (typeof value === 'string') {
    return formatRtlRange(value);
  }
  return value;
};

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return hex;
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const shareHtmlViaWhatsApp = async (headers: ExportHeader[], data: any[], fileName: string, reportTitle: string, subtitle?: string, adjustments: Record<string, number> = {}, colorMap: Record<string, string> = {}) => {
    // Construct HTML content
    const today = new Date();
    const dateLine = gregorianToHijriFormatted(today, adjustments);
    
    // Table Headers
    const ths = headers.map(h => {
        const isSequence =
            h.key === "sequence" ||
            h.key === "serialNumber" ||
            h.key === "index" ||
            h.key === "no" ||
            h.label === "#" ||
            h.label === "م" ||
            h.label === "الرقم" ||
            h.label === "التسلسل";
        const seqStyle = isSequence ? 'style="width: 1% !important; white-space: nowrap !important; width: fit-content !important; min-width: 18px !important; max-width: 32px !important; text-align: center !important;"' : '';
        return `<th class="sticky-header" ${seqStyle}>${h.label}</th>`;
    }).join('');
    
    // Table Rows
    const trs = data.map((item, idx) => {
        const bgClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        let rowColor = '#000';
        const isAbsentOrNotRecorded = item.attendance === 'absent' || item.attendance === 'not_recorded';
        
        if (isAbsentOrNotRecorded && item.attendance && colorMap[item.attendance]) {
            rowColor = colorMap[item.attendance];
        } else if (item.performance && colorMap[item.performance]) {
            rowColor = colorMap[item.performance];
        } else if (item.evalStatus && colorMap[item.evalStatus]) {
            rowColor = colorMap[item.evalStatus];
        }
        
        const tds = headers.map(h => {
            const value = item[h.key];
            let content = renderCell(value, h.type);
            let cellStyle = '';
            
            const isSequence =
                h.key === "sequence" ||
                h.key === "serialNumber" ||
                h.key === "index" ||
                h.key === "no" ||
                h.label === "#" ||
                h.label === "م" ||
                h.label === "الرقم" ||
                h.label === "التسلسل";

            if (isSequence) {
                cellStyle += ' width: 1% !important; white-space: nowrap !important; width: fit-content !important; min-width: 18px !important; max-width: 32px !important; text-align: center !important; font-weight: bold;';
            }

            if (h.key === 'attendance' && item.attendance && colorMap[item.attendance] && !isAbsentOrNotRecorded) {
                cellStyle += `background-color: ${hexToRgba(colorMap[item.attendance], 0.15)};`;
            } else if (h.key === 'periodicReview' && item.periodicReview && colorMap[item.periodicReview]) {
                cellStyle += `background-color: ${hexToRgba(colorMap[item.periodicReview], 0.15)};`;
            } else if (h.key === 'level' && item.level && colorMap[item.level]) {
                cellStyle += `background-color: ${hexToRgba(colorMap[item.level], 0.15)}; color: ${colorMap[item.level]}; font-weight: bold;`;
            } else if (h.key === 'evalStatus' && item.evalStatus && colorMap[item.evalStatus]) {
                cellStyle += `background-color: ${hexToRgba(colorMap[item.evalStatus], 0.15)};`;
            }
            
            if ((h.key === 'evaluationDate' || h.key === 'date') && value && value !== '—') {
                const dual = getDualDate(value, adjustments);
                if (dual) {
                    content = `
                        <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.2;">
                            <span style="font-weight: bold; font-size: 0.9em;">${dual.hijri}</span>
                            <span style="font-size: 0.8em; opacity: 0.7;">${dual.gregorian}</span>
                        </div>`;
                }
            }
            
            return `<td style="color:${rowColor}; ${cellStyle}">${content}</td>`;
        }).join('');
        
        return `<tr class="${bgClass}">${tds}</tr>`;
    }).join('');

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${reportTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:wght@400;700&family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        html, body, button, input, select, textarea, table, th, td { 
            font-family: 'Tajawal', 'Amiri', 'Inter', sans-serif !important; 
        }
        html, body { margin: 0; padding: 0; height: 100%; background-color: #f3f4f6; }
        
        /* Main scrolling container - acts as the viewport */
        .main-scroller {
            height: 100%;
            width: 100%;
            overflow-x: auto;
            overflow-y: auto;
            position: relative;
        }
        
        /* Content wrapper */
        .content-wrapper {
            width: 100%;
            max-width: 100%;
            padding: 10px;
            padding-bottom: 50px;
            margin: 0 auto;
            box-sizing: border-box;
        }

        .report-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            /* IMPORTANT: No overflow:hidden here, or sticky breaks */
            position: relative;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
        }

        .header-section {
            background: #006A4E;
            color: white;
            padding: 18px 12px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: 12px 12px 0 0;
            border-bottom: 3px double #D4AF37;
            width: 100%;
            box-sizing: border-box;
        }
        .header-section h1 { margin: 0; font-size: 1.4rem; font-weight: 800; text-align: center; width: 100%; }
        .header-section .subtitle { font-size: 0.9rem; opacity: 0.95; margin-top: 6px; text-align: center; width: 100%; }
        .header-section .date { font-size: 0.8rem; opacity: 0.85; margin-top: 4px; text-align: center; width: 100%; }
        
        .controls-section {
            padding: 12px 15px;
            background: #fff;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .search-input { width: 100%; max-width: 400px; padding: 10px 14px; border: 2px solid #e5e7eb; border-radius: 8px; font-family: inherit; font-size: 0.95rem; transition: border-color 0.2s; text-align: center; }
        .search-input:focus { border-color: #006A4E; outline: none; }
        
        table { width: 100%; max-width: 100%; border-collapse: collapse; table-layout: auto; box-sizing: border-box; }
        
        /* Sticky Header */
        th { 
            background: #006A4E !important; 
            color: white !important; 
            padding: 8px 4px; 
            text-align: center; 
            font-weight: 700; 
            font-size: 12px;
            white-space: normal !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
            position: sticky; 
            top: 0; 
            z-index: 100; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border: 1px solid #004D40;
            box-sizing: border-box;
        }
        
        td { 
            padding: 6px 4px; 
            border: 1px solid #d1d5db; 
            text-align: center; 
            vertical-align: middle; 
            font-size: 10.5px;
            line-height: 1.3;
            white-space: normal !important;
            word-wrap: break-word !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
            box-sizing: border-box;
        }
        tr:last-child td { border-bottom: 1px solid #d1d5db; }
        .bg-gray-50 { background-color: #f9fafb; }
        
        .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 0.8rem; }

        @media (max-width: 640px) {
            th { padding: 6px 3px !important; font-size: 10px !important; }
            td { padding: 4px 4px !important; font-size: 9px !important; }
            .header-section h1 { font-size: 1.2rem; }
        }
    </style>
</head>
<body>
    <div class="main-scroller">
        <div class="content-wrapper">
            <div class="report-card">
                <div class="header-section">
                    <h1>${reportTitle}</h1>
                    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
                    <div class="date">${dateLine}</div>
                </div>
                
                <div class="controls-section">
                    <input type="text" id="searchInput" class="search-input" placeholder="🔍 ابحث عن اسم الطالب..." onkeyup="filterTable()">
                </div>

                <table id="reportTable">
                    <thead>
                        <tr>${ths}</tr>
                    </thead>
                    <tbody>
                        ${trs}
                    </tbody>
                </table>
            </div>
            
            <div class="footer">
                
            </div>
        </div>
    </div>

    <script>
        function filterTable() {
            var input, filter, table, tr, td, i, txtValue;
            input = document.getElementById("searchInput");
            filter = input.value.toUpperCase();
            table = document.getElementById("reportTable");
            tr = table.getElementsByTagName("tr");
            
            for (i = 0; i < tr.length; i++) {
                if (tr[i].getElementsByTagName("th").length > 0) continue;
                
                var rowVisible = false;
                tds = tr[i].getElementsByTagName("td");
                
                for (var j = 0; j < tds.length; j++) {
                    if (tds[j]) {
                        txtValue = tds[j].textContent || tds[j].innerText;
                        if (txtValue.toUpperCase().indexOf(filter) > -1) {
                            rowVisible = true;
                            break;
                        }
                    }
                }
                
                if (rowVisible) {
                    tr[i].style.display = "";
                } else {
                    tr[i].style.display = "none";
                }
            }
        }
    </script>
</body>
</html>
    `;

    const finalFileName = fileName.toLowerCase().endsWith('.html') ? fileName : `${fileName}.html`;
    const file = new File([htmlContent], finalFileName, { type: 'text/html' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: reportTitle,
                text: `تقرير: ${reportTitle}`
            });
        } catch (err: any) {
            console.warn("Share failed or was aborted", err);
            if (err.name !== "AbortError") {
                alert("تنبيه: تعذرت المشاركة المباشرة عبر متصفحك. سيتم تنزيل الملف بدلاً من ذلك.");
                const url = URL.createObjectURL(file);
                const a = document.createElement('a');
                a.href = url;
                a.download = finalFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        }
    } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert("تم تنزيل ملف التقرير (HTML).\nيمكنك الآن إرساله عبر واتساب.");
    }
};
