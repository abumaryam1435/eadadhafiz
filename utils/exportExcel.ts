
declare const XLSX: any;

interface ExportHeader {
  key: string;
  label: string;
  type?: string;
}

import { renderCell } from './exportWord';
import { getDualDate } from './exportPdf'; // استيراد الدالة المساعدة

const blendWithWhite = (hex: string, alpha: number) => {
  if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return hex;
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  
  const newR = Math.round((1 - alpha) * 255 + alpha * r);
  const newG = Math.round((1 - alpha) * 255 + alpha * g);
  const newB = Math.round((1 - alpha) * 255 + alpha * b);
  
  return `${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

export const exportToExcel = async (
    headers: ExportHeader[],
    data: any[], 
    fileName: string,
    reportTitle?: string,
    adjustments: Record<string, number> = {},
    colorMap: Record<string, string> = {},
    rankColors?: Record<string, string>,
    orientation: "landscape" | "portrait" = "landscape",
    action: "download" | "share" = "download"
) => {
    const headerRow = headers.map(h => h.label);
    
    const dataWithGuestFlag = data.map(item => {
        const rowContent = headers.map(header => {
            const value = item[header.key as keyof typeof item];
            // منطق التاريخ المزدوج لـ Excel
            if ((header.key === 'evaluationDate' || header.key === 'date') && value && value !== '—') {
                const dual = getDualDate(value, adjustments);
                if (dual) {
                    // استخدام سطر جديد للفصل (يتطلب تفعيل wrapText في التنسيق)
                    return `${dual.hijri}\n${dual.gregorian}`;
                }
            }
            return renderCell(value, header.type);
        });
        
        const isAbsentOrNotRecorded = item.attendance === 'absent' || item.attendance === 'not_recorded';
        let rowColor = null;
        let backgroundHighlight = null;
        
        if (isAbsentOrNotRecorded && item.attendance && colorMap[item.attendance]) {
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
        } else if (item.rank && item.rank > 0 && rankColors && rankColors.highlightColor) {
            backgroundHighlight = rankColors.highlightColor;
        }

        return {
            rowContent: rowContent,
            isGuestEvaluation: item.isGuestEvaluation || false,
            rowColor: rowColor,
            backgroundHighlight: backgroundHighlight,
            level: item.level,
            levelColor: item.level && colorMap[item.level] ? colorMap[item.level] : null,
            evalStatus: item.evalStatus,
            evalStatusColor: item.evalStatus && colorMap[item.evalStatus] ? colorMap[item.evalStatus] : null,
            attendance: item.attendance,
            attendanceColor: item.attendance && colorMap[item.attendance] ? colorMap[item.attendance] : null,
            periodicReview: item.periodicReview,
            periodicReviewColor: item.periodicReview && colorMap[item.periodicReview] ? colorMap[item.periodicReview] : null,
            isAbsentOrNotRecorded: isAbsentOrNotRecorded
        };
    });

    const dataForExport = [];
    let actualHeaderRowIndex = 0; 
    
    if (reportTitle) {
        const titleRow = [reportTitle, ...Array(headerRow.length - 1).fill(null)];
        dataForExport.push(titleRow);
        dataForExport.push([]); 
        actualHeaderRowIndex = 2; 
    } else {
        actualHeaderRowIndex = 0;
    }

    dataForExport.push(headerRow);
    dataForExport.push(...dataWithGuestFlag.map(d => d.rowContent));

    const ws = XLSX.utils.aoa_to_sheet(dataForExport);
    ws['!rightToLeft'] = true;
    ws['!views'] = [{ RTL: true }];

    if (!ws['!ref']) return;

    const endColumnLetter = XLSX.utils.encode_col(headerRow.length - 1);
    ws['!autofilter'] = { ref: `A${actualHeaderRowIndex + 1}:${endColumnLetter}${actualHeaderRowIndex + 1}` };

    const colWidths = headerRow.map((headerText, i) => {
        if (headerText === 'م' || headerText === '#' || headerText === 'الرقم') {
            return { wch: 6 }; // Make serial number column fixed and narrow
        }
        let maxLength = 0;
        dataForExport.forEach(row => {
            if (row[i]) {
                // تقييم الطول بناءً على أطول سطر
                const str = String(row[i]);
                const lines = str.split('\n');
                const maxLine = Math.max(...lines.map(l => l.length));
                maxLength = Math.max(maxLength, maxLine);
            }
        });
        return { wch: Math.max(maxLength + 4, headerText.length + 4) }; // Fit to text
    });
    ws['!cols'] = colWidths;

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        
        const dataIndex = R - (actualHeaderRowIndex + 1);
        let rowColorStyle = {};
        let currentItemData = null;

        if (R > actualHeaderRowIndex) {
            if (dataWithGuestFlag[dataIndex]) {
                currentItemData = dataWithGuestFlag[dataIndex];
                if (currentItemData.rowColor) {
                    // Convert HEX #RRGGBB to FFRRGGBB for Excel
                    const hex = currentItemData.rowColor.replace('#', '');
                    rowColorStyle = { font: { color: { rgb: "FF" + hex } } };
                }
            }
        }

        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (!ws[cell_ref]) ws[cell_ref] = { t: 's', v: '' }; 
            if (!ws[cell_ref].s) ws[cell_ref].s = {};

            if (reportTitle && R === 1) continue;

            ws[cell_ref].s.border = {
                top: { style: "thin" }, bottom: { style: "thin" },
                left: { style: "thin" }, right: { style: "thin" }
            };
            
            // تفعيل التفاف النص لجميع الخلايا لدعم الأسطر المتعددة (التواريخ)
            ws[cell_ref].s.alignment = { horizontal: "center", vertical: "center", wrapText: true };

            if (reportTitle && R === 0) { 
                ws[cell_ref].s.font = { sz: 16, bold: true, color: { rgb: "FF004D40" } };
            } else if (R === actualHeaderRowIndex) { 
                ws[cell_ref].s.font = { bold: true, color: { rgb: "FF004D40" } }; 
                ws[cell_ref].s.fill = { fgColor: { rgb: "FFE6F4EA" } }; 
            } else if (R > actualHeaderRowIndex) { 
                const originalDataIndex = R - (actualHeaderRowIndex + 1); 
                
                if (currentItemData && currentItemData.isAlAmeenStr === 'نعم') {
                    ws[cell_ref].s.fill = { fgColor: { rgb: "FFFEE1E1" } };
                } else if (currentItemData && currentItemData.backgroundHighlight) {
                    const bgHex = blendWithWhite(currentItemData.backgroundHighlight, 0.3);
                    ws[cell_ref].s.fill = { fgColor: { rgb: "FF" + bgHex } };
                } else if (originalDataIndex % 2 === 1) { 
                    ws[cell_ref].s.fill = { fgColor: { rgb: "FFF9F9F9" } }; 
                }
                
                // Apply Row Text Color
                if (Object.keys(rowColorStyle).length > 0) {
                    ws[cell_ref].s = { ...ws[cell_ref].s, ...rowColorStyle };
                }

                // Apply Cell Background Color for Attendance, Periodic Review, Level, EvalStatus
                if (currentItemData) {
                    if (headers[C].key === 'attendance' && currentItemData.attendanceColor && !currentItemData.isAbsentOrNotRecorded) {
                        const hex = blendWithWhite(currentItemData.attendanceColor, 0.15);
                        ws[cell_ref].s.fill = { fgColor: { rgb: "FF" + hex } };
                    } else if (headers[C].key === 'periodicReview' && currentItemData.periodicReviewColor) {
                        const hex = blendWithWhite(currentItemData.periodicReviewColor, 0.15);
                        ws[cell_ref].s.fill = { fgColor: { rgb: "FF" + hex } };
                    } else if (headers[C].key === 'level' && currentItemData.levelColor) {
                        const hex = blendWithWhite(currentItemData.levelColor, 0.15);
                        ws[cell_ref].s.fill = { fgColor: { rgb: "FF" + hex } };
                    } else if (headers[C].key === 'evalStatus' && currentItemData.evalStatusColor) {
                        const hex = blendWithWhite(currentItemData.evalStatusColor, 0.15);
                        ws[cell_ref].s.fill = { fgColor: { rgb: "FF" + hex } };
                    }
                }
            }
        }
    }

    const wb = XLSX.utils.book_new();
    wb.Workbook = {
        Views: [
            { RTL: true }
        ]
    };
    // Add sheet-level and page setup properties
    ws['!views'] = [{ RTL: true }];
    ws['!pageSetup'] = { orientation: orientation };
    
    XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
    
    if (action === "share") {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const file = new File([blob], `${fileName}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        
        const canShare = navigator.share && navigator.canShare && navigator.canShare({ files: [file] });
        if (canShare) {
            try {
                await navigator.share({
                    files: [file],
                    title: reportTitle || fileName,
                    text: reportTitle || fileName
                });
            } catch (e: any) {
                console.warn("Share failed or was aborted", e);
                if (e.name !== "AbortError") {
                    alert("تنبيه: متصفحك أو جهازك الحالي لا يتيح مشاركة ملفات Excel مباشرة. سيتم تنزيل الملف لحفظه على جهازك بدلاً من ذلك.");
                    XLSX.writeFile(wb, `${fileName}.xlsx`);
                }
            }
        } else {
            XLSX.writeFile(wb, `${fileName}.xlsx`);
        }
    } else {
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    }
};
