import { translationMap } from '../constants';
import { getDualDate, gregorianToHijriFormatted } from './exportPdf';
import { toArabicDigits, formatRtlRange } from './juzUtils';

export interface ExportHeader {
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

export const shareHtmlViaWhatsApp = async (
  headers: ExportHeader[], 
  data: any[], 
  fileName: string, 
  reportTitle: string, 
  subtitle?: string, 
  adjustments: Record<string, number> = {}, 
  colorMap: Record<string, string> = {},
  rankColors?: Record<string, { bg: string; text: string; border: string }>
) => {
  // Construct HTML content
  const today = new Date();
  const dateLine = gregorianToHijriFormatted(today, adjustments);

  // Extract unique student names for quick-filter dropdown
  const uniqueStudents = Array.from(
    new Set(data.map(item => item.studentName || item.name).filter(Boolean))
  ).sort((a: any, b: any) => String(a).localeCompare(String(b), 'ar'));

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
    const seqStyle = isSequence ? 'style="width: 1% !important; white-space: nowrap !important; min-width: 32px; max-width: 45px; text-align: center;"' : '';
    return `<th class="sticky-header" ${seqStyle}>${h.label}</th>`;
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
        h.key === "sequence" ||
        h.key === "serialNumber" ||
        h.key === "index" ||
        h.key === "no" ||
        h.label === "#" ||
        h.label === "م" ||
        h.label === "الرقم" ||
        h.label === "التسلسل";

      if (isSequence) {
        cellStyle += ' width: 1% !important; white-space: nowrap !important; min-width: 32px; max-width: 45px; text-align: center; font-weight: 800; font-family: monospace;';
      }

      if (h.key === 'studentName' || h.key === 'name') {
        cellStyle += ' font-weight: 800; text-align: right; color: #064e3b;';
      }

      if (h.key === 'attendance' && item.attendance && colorMap[item.attendance] && !isAbsentOrNotRecorded) {
        cellStyle += `background-color: ${hexToRgba(colorMap[item.attendance], 0.15)};`;
      } else if (h.key === 'periodicReview' && item.periodicReview && colorMap[item.periodicReview]) {
        cellStyle += `background-color: ${hexToRgba(colorMap[item.periodicReview], 0.15)};`;
      } else if (h.key === 'level' && item.level && colorMap[item.level]) {
        cellStyle += `background-color: ${hexToRgba(colorMap[item.level], 0.15)}; color: ${colorMap[item.level]}; font-weight: bold;`;
      } else if (h.key === 'evalStatus' && item.evalStatus && colorMap[item.evalStatus]) {
        cellStyle += `background-color: ${hexToRgba(colorMap[item.evalStatus], 0.15)};`;
      } else if (h.key === 'performance' && item.performance && colorMap[item.performance]) {
        cellStyle += `background-color: ${hexToRgba(colorMap[item.performance], 0.15)};`;
      }

      // Rank styling if available
      if (h.key === 'rank' && item.rank && rankColors && rankColors[item.rank]) {
        const rc = rankColors[item.rank];
        content = `<span style="background:${rc.bg}; color:${rc.text}; border:1px solid ${rc.border}; padding:2px 8px; border-radius:6px; font-weight:800; font-size:11px;">${content}</span>`;
      }
      
      if ((h.key === 'evaluationDate' || h.key === 'date') && value && value !== '—') {
        const dual = getDualDate(value, adjustments);
        if (dual) {
          content = `
            <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.25;">
              <span style="font-weight: 800; font-size: 0.9em; color:#065f46;">${dual.hijri}</span>
              <span style="font-size: 0.78em; opacity: 0.75; font-family: monospace;">${dual.gregorian}</span>
            </div>`;
        }
      }
      
      return `<td class="${isSequence ? 'seq-cell' : ''}" style="color:${rowColor}; ${cellStyle}">${content}</td>`;
    }).join('');
    
    const searchTokens = [
      studentNameVal,
      item.studentOriginalHalaqaName || '',
      item.halaqaName || '',
      item.evaluatorName || '',
      item.surahs?.map((s: any) => typeof s === 'string' ? s : s.name).join(' ') || '',
      item.ayahsDetails || item.notes || '',
      item.performance || item.attendance || ''
    ].filter(Boolean).join(' ');

    return `<tr class="data-row ${bgClass}" data-student="${studentNameVal}" data-search="${searchTokens}">${tds}</tr>`;
  }).join('');

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>${reportTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html, body, button, input, select, textarea, table, th, td { 
      font-family: 'Tajawal', 'Amiri', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif !important; 
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
      overflow: hidden;
    }

    .header-section {
      background: linear-gradient(135deg, #006A4E 0%, #064e3b 100%);
      color: white;
      padding: 20px 16px;
      text-align: center;
      position: relative;
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
      min-width: 220px;
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
      font-size: 10px;
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
      max-width: 92vw;
      background: white;
      border: 2px solid #006A4E;
      border-radius: 16px;
      box-shadow: 0 10px 30px -5px rgba(0,0,0,0.18);
      z-index: 100;
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .dropdown-panel.show {
      display: flex;
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
      padding: 10px 6px;
      text-align: center;
      font-weight: 800;
      font-size: 12px;
      position: sticky;
      top: 0;
      z-index: 20;
      border-bottom: 2px solid #D4AF37;
      border-right: 1px solid rgba(255, 255, 255, 0.15);
      white-space: nowrap;
    }
    th:first-child { border-right: none; }

    td {
      padding: 9px 6px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #f1f5f9;
      text-align: center;
      vertical-align: middle;
      font-size: 12px;
      line-height: 1.35;
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
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 600;
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
      .student-select { min-width: 100%; max-width: 100%; }
      .badge-count { font-size: 0.78rem; padding: 6px 10px; }
      th { font-size: 10.5px; padding: 7px 3px; }
      td { font-size: 10.5px; padding: 7px 3px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="report-card">
      <div class="header-section">
        <h1>${reportTitle}</h1>
        ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
        <div class="date">${dateLine}</div>
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
              placeholder="ابحث بأي جزء من اسم الطالب دون اشتراط الترتيب..." 
              oninput="handleSearchInput()" 
              autocomplete="off"
            />
            <button id="clearBtn" class="clear-btn" onclick="clearSearch()" title="مسح">✕</button>
          </div>

          ${uniqueStudents.length > 1 ? `
          <div class="dropdown-container" id="studentDropdownContainer">
            <button type="button" id="studentDropdownBtn" class="dropdown-btn" onclick="toggleStudentDropdown(event)">
              <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
                <span>👤</span>
                <span id="studentDropdownLabel" class="dropdown-btn-label">كل الطلاب (${uniqueStudents.length})</span>
              </div>
              <span class="dropdown-btn-arrow">▼</span>
            </button>
            <div id="studentDropdownPanel" class="dropdown-panel" onclick="event.stopPropagation()">
              <div class="dropdown-search-box">
                <span class="dropdown-search-icon">🔍</span>
                <input 
                  type="text" 
                  id="studentSearchInput" 
                  class="dropdown-search-input" 
                  placeholder="بحث في أسماء الطلاب..." 
                  oninput="filterStudentOptions()" 
                  autocomplete="off"
                />
              </div>
              <div class="dropdown-actions">
                <button type="button" class="btn-action btn-select-all" onclick="selectAllStudents(event)">تحديد الكل</button>
                <button type="button" class="btn-action btn-deselect-all" onclick="deselectAllStudents(event)">إلغاء التحديد</button>
              </div>
              <div id="studentOptionsList" class="dropdown-options-list">
                ${uniqueStudents.map((name, i) => `
                  <label class="dropdown-option" data-student-name="${name}">
                    <input type="checkbox" class="dropdown-checkbox student-cb" value="${name}" checked onchange="handleStudentCheckboxChange()" />
                    <span>${name}</span>
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
        <span>${dateLine}</span>
      </div>
    </div>
  </div>

  <script>
    var searchInput = document.getElementById("searchInput");
    var clearBtn = document.getElementById("clearBtn");
    var matchCount = document.getElementById("matchCount");
    var totalCount = document.getElementById("totalCount");
    var noResults = document.getElementById("noResults");
    var rows = Array.from(document.querySelectorAll("#tableBody tr.data-row"));

    var studentDropdownBtn = document.getElementById("studentDropdownBtn");
    var studentDropdownPanel = document.getElementById("studentDropdownPanel");
    var studentDropdownLabel = document.getElementById("studentDropdownLabel");
    var studentSearchInput = document.getElementById("studentSearchInput");
    var studentCheckboxes = Array.from(document.querySelectorAll(".student-cb"));
    var studentOptions = Array.from(document.querySelectorAll(".dropdown-option"));
    var totalStudentsCount = studentCheckboxes.length;

    // دالة تطبيع النصوص العربية
    function normalizeArabic(text) {
      if (!text) return "";
      return String(text)
        .toLowerCase()
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/[\u064B-\u065F\u0670]/g, "") // إزالة التشكيل
        .replace(/ـ+/g, "") // إزالة الكشيدة
        .replace(/[٠-٩]/g, function(d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString(); })
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // خوارزمية البحث الذكي: تجزئة الكلمات والتأكد من مطابقة جميع الأجزاء بأي ترتيب
    function isSmartMatch(targetText, query) {
      var normalizedQuery = normalizeArabic(query);
      if (!normalizedQuery) return true;

      var tokens = normalizedQuery.split(/\s+/).filter(function(t) { return t.length > 0; });
      var normalizedTarget = normalizeArabic(targetText);

      return tokens.every(function(token) {
        return normalizedTarget.indexOf(token) > -1;
      });
    }

    function toggleStudentDropdown(e) {
      if (e) e.stopPropagation();
      if (!studentDropdownPanel) return;
      var isShown = studentDropdownPanel.classList.contains("show");
      if (isShown) {
        closeStudentDropdown();
      } else {
        openStudentDropdown();
      }
    }

    function openStudentDropdown() {
      if (!studentDropdownPanel) return;
      studentDropdownPanel.classList.add("show");
      if (studentDropdownBtn) studentDropdownBtn.classList.add("active");
      if (studentSearchInput) {
        studentSearchInput.value = "";
        filterStudentOptions();
        setTimeout(function() { studentSearchInput.focus(); }, 100);
      }
    }

    function closeStudentDropdown() {
      if (!studentDropdownPanel) return;
      studentDropdownPanel.classList.remove("show");
      if (studentDropdownBtn) studentDropdownBtn.classList.remove("active");
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

    function filterStudentOptions() {
      var q = (studentSearchInput ? studentSearchInput.value : "") || "";
      studentOptions.forEach(function(opt) {
        var name = opt.getAttribute("data-student-name") || opt.textContent;
        if (!q.trim() || isSmartMatch(name, q)) {
          opt.style.display = "flex";
        } else {
          opt.style.display = "none";
        }
      });
    }

    function selectAllStudents(e) {
      if (e) e.stopPropagation();
      studentCheckboxes.forEach(function(cb) { cb.checked = true; });
      updateStudentLabel();
      filterTable();
    }

    function deselectAllStudents(e) {
      if (e) e.stopPropagation();
      studentCheckboxes.forEach(function(cb) { cb.checked = false; });
      updateStudentLabel();
      filterTable();
    }

    function handleStudentCheckboxChange() {
      updateStudentLabel();
      filterTable();
    }

    function updateStudentLabel() {
      if (!studentDropdownLabel) return;
      var checkedCount = studentCheckboxes.filter(function(cb) { return cb.checked; }).length;
      if (checkedCount === totalStudentsCount || totalStudentsCount === 0) {
        studentDropdownLabel.textContent = "كل الطلاب (" + totalStudentsCount + ")";
      } else if (checkedCount === 0) {
        studentDropdownLabel.textContent = "لم يتم اختيار أي طالب (0)";
      } else if (checkedCount === 1) {
        var firstChecked = studentCheckboxes.find(function(cb) { return cb.checked; });
        studentDropdownLabel.textContent = firstChecked ? firstChecked.value : "طالب محدد";
      } else {
        studentDropdownLabel.textContent = checkedCount + " طلاب محددين";
      }
    }

    function renumberVisibleRows() {
      var seq = 1;
      rows.forEach(function(row) {
        if (row.style.display !== "none") {
          var seqCell = row.querySelector(".seq-cell");
          if (seqCell) {
            seqCell.textContent = seq;
            seq++;
          }
        }
      });
    }

    function filterTable() {
      var rawQuery = searchInput ? (searchInput.value || "") : "";
      clearBtn.style.display = rawQuery.trim() ? "flex" : "none";

      var checkedStudents = new Set();
      var hasStudentFilter = false;
      if (studentCheckboxes.length > 0) {
        var checkedCount = 0;
        studentCheckboxes.forEach(function(cb) {
          if (cb.checked) {
            checkedStudents.add(cb.value.trim());
            checkedCount++;
          }
        });
        if (checkedCount < totalStudentsCount) {
          hasStudentFilter = true;
        }
      }

      var count = 0;
      rows.forEach(function(row) {
        var rowSearchText = row.getAttribute("data-search") || row.textContent;
        var studentAttr = (row.getAttribute("data-student") || "").trim();

        // 1. مطابقة البحث الذكي بالنص المدخل
        var matchesQuery = !rawQuery.trim() || isSmartMatch(rowSearchText, rawQuery);

        // 2. مطابقة الطلاب المحددين في القائمة متعددة الاختيار
        var matchesStudent = !hasStudentFilter || checkedStudents.has(studentAttr);

        if (matchesQuery && matchesStudent) {
          row.style.display = "";
          count++;
        } else {
          row.style.display = "none";
        }
      });

      matchCount.textContent = count;
      noResults.style.display = count === 0 ? "block" : "none";
      renumberVisibleRows();
    }

    function handleSearchInput() {
      filterTable();
    }

    function clearSearch() {
      if (searchInput) searchInput.value = "";
      filterTable();
      if (searchInput) searchInput.focus();
    }
  </script>
</body>
</html>`;

  const finalFileName = fileName.toLowerCase().endsWith('.html') ? fileName : `${fileName}.html`;
  const file = new File([htmlContent], finalFileName, { type: 'text/html;charset=utf-8' });

  // Create elegant modal overlay for WhatsApp / Web sharing and downloading
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

  overlay.innerHTML = `
    <div style="background: white; border-radius: 20px; padding: 28px 24px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 360px; max-width: 92%; direction: rtl;">
      <div style="display: flex; justify-content: center; margin-bottom: 16px;">
        <div style="width: 60px; height: 60px; background-color: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #a7f3d0;">
          <span style="font-size: 30px;">🌐</span>
        </div>
      </div>
      <h3 style="color: #006A4E; font-size: 19px; font-weight: 900; margin: 0 0 6px 0;">تم تجهيز التقرير التفاعلي!</h3>
      <p style="color: #64748b; font-size: 12.5px; margin: 0 0 20px 0; font-weight: 600; line-height: 1.45;">
        ملف تفاعلي ذكي يفتح بنقرة على أي هاتف ويتيح البحث الفوري وتصفية الطلاب بسهولة:
      </p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${hasNativeShare ? `
        <button id="btn-share-html" style="background: #006A4E; color: white; border: none; padding: 13px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,106,78,0.25);">
          <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
          مشاركة عبر الواتساب والتطبيقات
        </button>` : ''}
        <button id="btn-preview-html" style="background: #0284c7; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 13.5px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(2,132,199,0.25);">
          <span>معاينة وتجربة التقرير الآن 👁️</span>
        </button>
        <button id="btn-download-html" style="background: #f1f5f9; color: #334155; border: 1.5px solid #cbd5e1; padding: 11px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 13.5px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>تنزيل وحفظ ملف HTML 📥</span>
        </button>
        <button id="btn-close-html" style="background: transparent; color: #94a3b8; border: none; padding: 8px; font-weight: 700; cursor: pointer; font-size: 13px; margin-top: 2px;">إغلاق النافذة</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const downloadFile = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const previewFile = () => {
    const blobUrl = URL.createObjectURL(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }));
    window.open(blobUrl, '_blank');
  };

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
            text: `تقرير تفاعلي: ${reportTitle || fileName}`
          });
        } else {
          downloadFile();
          if (navigator.share) {
            await navigator.share({
              title: reportTitle || fileName,
              text: `تقرير تفاعلي: ${reportTitle || fileName}`
            });
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          downloadFile();
        }
      }
    };
  }

  if (btnPreview) {
    btnPreview.onclick = () => {
      previewFile();
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
