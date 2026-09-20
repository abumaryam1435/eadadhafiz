import { getMemorizedPagesData, calculateStudentLevel } from "./pageUtils";
import {
  User,
  Halaqa,
  Student,
  Evaluation,
  UserRole,
  AttendanceStatus,
  AbsenceReason,
  EvaluationType,
  PerformanceLevel,
  PeriodicReviewStatus,
  FullBackupData,
  DeletedItem,
  MaghribAttendance,
  MaghribAttendanceStatus,
  Suggestion,
  StudentBehavior,
  Matn,
} from "../types";

declare const XLSX: any;

// وظائف مساعدة لضمان استخراج البيانات بأمان - تم تعديلها لتعيد null بدلاً من undefined
const getIdx = (headers: any[], key: string) => {
  if (!headers || !Array.isArray(headers)) return -1;
  return headers.findIndex(
    (h) => h && String(h).trim().toLowerCase() === key.toLowerCase(),
  );
};

const getValue = (row: any[], headers: any[], key: string) => {
  const idx = getIdx(headers, key);
  return idx !== -1 ? row[idx] : undefined;
};

const safeNum = (val: any) => {
  if (val === undefined || val === null || val === "") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
};

const safeStr = (val: any) =>
  val !== undefined && val !== null && val !== "" ? String(val).trim() : null;

const getDynamicSheetData = (baseHeaders: string[], dataArray: any[], baseMapper: (item: any) => any[]) => {
  if (!dataArray || dataArray.length === 0) return { headers: baseHeaders, data: [] };
  
  // Find extra keys not in baseHeaders
  const extraKeys = new Set<string>();
  dataArray.forEach(item => {
    Object.keys(item).forEach(k => {
      if (!baseHeaders.includes(k)) extraKeys.add(k);
    });
  });
  
  const extraHeaders = Array.from(extraKeys);
  const finalHeaders = [...baseHeaders, ...extraHeaders];
  
  const finalData = dataArray.map(item => {
    const baseRow = baseMapper(item);
    const extraRow = extraHeaders.map(k => {
      const val = item[k];
      if (Array.isArray(val) || (val !== null && typeof val === 'object')) {
        return JSON.stringify(val);
      }
      return val;
    });
    return [...baseRow, ...extraRow];
  });
  
  return { headers: finalHeaders, data: finalData };
};

const applyCommonStyles = (ws: any, headers: string[]) => {
  ws["!rightToLeft"] = true;
  if (!ws["!ref"]) return;
  const endColumnLetter = XLSX.utils.encode_col(headers.length - 1);
  ws["!autofilter"] = { ref: `A1:${endColumnLetter}1` };
  const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const colWidths = headers.map((header, colIndex) => {
    let maxLength = header.length || 0;
    for (let rowIndex = 0; rowIndex < sheetData.length; rowIndex++) {
      const cellValue = (sheetData[rowIndex] as any)[colIndex];
      if (cellValue !== null && cellValue !== undefined) {
        maxLength = Math.max(maxLength, String(cellValue).length);
      }
    }
    return { wch: Math.min(maxLength + 2, 50) };
  });
  ws["!cols"] = colWidths;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_address = { c: C, r: R };
      const cell_ref = XLSX.utils.encode_cell(cell_address);
      if (!ws[cell_ref]) ws[cell_ref] = { t: "s", v: "" };
      if (!ws[cell_ref].s) ws[cell_ref].s = {};
      ws[cell_ref].s.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
      if (R === 0) {
        ws[cell_ref].s.font = { bold: true, color: { rgb: "FFFFFFFF" } };
        ws[cell_ref].s.fill = { fgColor: { rgb: "FF006A4E" } };
        ws[cell_ref].s.alignment = { horizontal: "center", vertical: "center" };
      } else if (R % 2 === 1) {
        ws[cell_ref].s.fill = { fgColor: { rgb: "FFE6F4EA" } };
      }
    }
  }
};

export const exportFullBackup = (data: FullBackupData, fileName: string) => {
  const wb = XLSX.utils.book_new();

  const usersHeaders = ["id", "name", "role", "updatedAt"];
  const { headers: finalUsersHeaders, data: finalUsersData } = getDynamicSheetData(
    usersHeaders,
    data.users || [],
    (u) => [u.id, u.name, u.role, u.updatedAt]
  );
  const wsUsers = XLSX.utils.aoa_to_sheet([finalUsersHeaders, ...finalUsersData]);
  applyCommonStyles(wsUsers, finalUsersHeaders);
  XLSX.utils.book_append_sheet(wb, wsUsers, "Users");

  const halaqasHeaders = [
    "id",
    "name",
    "teacherId",
    "testTeacherId",
    "updatedAt",
  ];
  const { headers: finalHalaqasHeaders, data: finalHalaqasData } = getDynamicSheetData(
    halaqasHeaders,
    data.halaqas || [],
    (h) => [
      h.id,
      h.name,
      h.teacherId,
      h.testTeacherId,
      h.updatedAt,
    ]
  );
  const wsHalaqas = XLSX.utils.aoa_to_sheet([finalHalaqasHeaders, ...finalHalaqasData]);
  applyCommonStyles(wsHalaqas, finalHalaqasHeaders);
  XLSX.utils.book_append_sheet(wb, wsHalaqas, "Halaqas");

  if (data.sardHalaqas && data.sardHalaqas.length > 0) {
    const sardHalaqasHeaders = [
      "id",
      "name",
      "teacherId",
      "testTeacherId",
      "updatedAt",
    ];
    const { headers: finalSardHalaqasHeaders, data: finalSardHalaqasData } = getDynamicSheetData(
      sardHalaqasHeaders,
      data.sardHalaqas,
      (h) => [
        h.id,
        h.name,
        h.teacherId,
        h.testTeacherId,
        h.updatedAt,
      ]
    );
    const wsSardHalaqas = XLSX.utils.aoa_to_sheet([finalSardHalaqasHeaders, ...finalSardHalaqasData]);
    applyCommonStyles(wsSardHalaqas, finalSardHalaqasHeaders);
    XLSX.utils.book_append_sheet(wb, wsSardHalaqas, "SardHalaqas");
  }

  const studentsHeaders = [
    "id",
    "name",
    "halaqaId",
    "sardHalaqaId",
    "schoolStage",
    "parentPhone",
    "oldMemorizedPages",
    "manualStudentLevel",
    "isAlAmeen",
    "isFromIbri",
    "updatedAt",
    "studentLevel",
  ];
  const { headers: finalStudentsHeaders, data: finalStudentsData } = getDynamicSheetData(
    studentsHeaders,
    data.students || [],
    (s) => [
      s.id,
      s.name,
      s.halaqaId,
      s.sardHalaqaId || "",
      s.schoolStage || "",
      s.parentPhone || "",
      s.oldMemorizedPages || "",
      s.manualStudentLevel || "",
      s.isAlAmeen ? "TRUE" : "FALSE",
      s.isFromIbri !== false ? "TRUE" : "FALSE",
      s.updatedAt,
      calculateStudentLevel(getMemorizedPagesData(s, data.evaluations || []).totalCount)
    ]
  );
  
  const wsStudents = XLSX.utils.aoa_to_sheet([
    finalStudentsHeaders,
    ...finalStudentsData,
  ]);
  applyCommonStyles(wsStudents, finalStudentsHeaders);
  XLSX.utils.book_append_sheet(wb, wsStudents, "Students");

  const evaluationsHeaders = [
    "id",
    "studentId",
    "halaqaId",
    "teacherId",
    "weekNumber",
    "attendance",
    "absenceReason",
    "evaluationType",
    "pages",
    "fromAyah",
    "toAyah",
    "surahs",
    "performance",
    "periodicReview",
    "notes",
    "evaluationDate",
    "isTest",
    "updatedAt",
  ];
  const regularEvaluations = (data.evaluations || []).filter((e) => !e.isTest);
  const { headers: finalEvalsHeaders, data: finalEvalsData } = getDynamicSheetData(
    evaluationsHeaders,
    regularEvaluations,
    (e) => [
      e.id,
      e.studentId,
      e.halaqaId,
      e.teacherId,
      e.weekNumber,
      e.attendance,
      e.absenceReason,
      e.evaluationType,
      e.pages,
      e.fromAyah,
      e.toAyah,
      e.surahs ? e.surahs.join(",") : "",
      e.performance,
      e.periodicReview,
      e.notes,
      e.evaluationDate,
      e.isTest ? "TRUE" : "FALSE",
      e.updatedAt,
    ]
  );
  
  const wsEvaluations = XLSX.utils.aoa_to_sheet([
    finalEvalsHeaders,
    ...finalEvalsData,
  ]);
  applyCommonStyles(wsEvaluations, finalEvalsHeaders);
  XLSX.utils.book_append_sheet(wb, wsEvaluations, "Evaluations");

  const testEvaluations = data.evaluations.filter((e) => e.isTest);
  if (testEvaluations.length > 0) {
    const testHeaders = [
      "id",
      "studentId",
      "halaqaId",
      "teacherId",
      "weekNumber",
      "testName",
      "testFathErrors",
      "testTashkeelErrors",
      "testTajweedErrors",
      "testPassageChanges",
      "testTotalScore",
      "testMaxScore",
      "evaluationDate",
      "notes",
      "updatedAt",
    ];
    const { headers: finalTestEvalsHeaders, data: finalTestEvalsData } = getDynamicSheetData(
      testHeaders,
      testEvaluations,
      (e) => [
        e.id,
        e.studentId,
        e.halaqaId,
        e.teacherId,
        e.weekNumber,
        e.testName,
        e.testFathErrors,
        e.testTashkeelErrors,
        e.testTajweedErrors,
        e.testPassageChanges,
        e.testTotalScore,
        e.testMaxScore,
        e.evaluationDate,
        e.notes,
        e.updatedAt,
      ]
    );
    
    const wsTests = XLSX.utils.aoa_to_sheet([
      finalTestEvalsHeaders,
      ...finalTestEvalsData,
    ]);
    applyCommonStyles(wsTests, finalTestEvalsHeaders);
    XLSX.utils.book_append_sheet(wb, wsTests, "TestEvaluations");
  }

  if (data.sardEvaluations && data.sardEvaluations.length > 0) {
    const sardEvalsHeaders = [
      "id",
      "studentId",
      "sardHalaqaId",
      "teacherId",
      "date",
      "juzList",
      "pagesCount",
      "pageRanges",
      "hesitationErrors",
      "fathErrors",
      "tajweedErrors",
      "totalErrors",
      "grade",
      "performance",
      "notes",
      "updatedAt",
    ];
    const { headers: finalSardEvalsHeaders, data: finalSardEvalsData } = getDynamicSheetData(
      sardEvalsHeaders,
      data.sardEvaluations,
      (e) => [
        e.id,
        e.studentId,
        e.sardHalaqaId || "",
        e.teacherId || "",
        e.date || "",
        e.juzList ? e.juzList.join(",") : "",
        e.pagesCount || 0,
        e.pageRanges ? JSON.stringify(e.pageRanges) : "",
        e.hesitationErrors || 0,
        e.fathErrors || 0,
        e.tajweedErrors || 0,
        e.totalErrors || 0,
        e.grade || "",
        e.performance || "",
        e.notes || "",
        e.updatedAt || 0,
      ]
    );
    const wsSardEvals = XLSX.utils.aoa_to_sheet([
      finalSardEvalsHeaders,
      ...finalSardEvalsData,
    ]);
    applyCommonStyles(wsSardEvals, finalSardEvalsHeaders);
    XLSX.utils.book_append_sheet(wb, wsSardEvals, "SardEvaluations");
  }

  if (data.maghribAttendances && data.maghribAttendances.length > 0) {
    const maghribHeaders = [
      "id",
      "studentId",
      "weekNumber",
      "status",
      "date",
      "time",
      "programType",
      "updatedAt",
    ];
    const maghribData = data.maghribAttendances.map((m) => [
      m.id,
      m.studentId,
      m.weekNumber,
      m.status,
      m.date || "",
      m.time || "",
      m.programType || "maghrib",
      m.updatedAt,
    ]);
    const wsMaghrib = XLSX.utils.aoa_to_sheet([maghribHeaders, ...maghribData]);
    applyCommonStyles(wsMaghrib, maghribHeaders);
    XLSX.utils.book_append_sheet(wb, wsMaghrib, "MaghribAttendances");
  }

  const settingsHeaders = ["Key", "Value"];
  const settingsData: any[][] = [];
  const addSetting = (key: string, value: any) => {
    const strValue =
      typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    const MAX = 32000;
    if (strValue.length <= MAX) settingsData.push([key, strValue]);
    else {
      const chunks = strValue.match(new RegExp(`.{1,${MAX}}`, "g"));
      if (chunks) {
        settingsData.push([key, chunks[0]]);
        for (let i = 1; i < chunks.length; i++)
          settingsData.push([`${key}_CHUNK_${i}`, chunks[i]]);
      }
    }
  };
  addSetting("customLogo", data.customLogo);
  addSetting("supervisorPassword", data.supervisorPassword);
  addSetting("maghribPassword", data.maghribPassword);
  addSetting("appName", data.appName);
  addSetting("firebaseConfig", data.firebaseConfig);
  addSetting("configUpdatedAt", data.configUpdatedAt);
  addSetting("isDistributable", data.isDistributable);
  addSetting("isPublishedConnected", data.isPublishedConnected);
  addSetting("isTestActive", data.isTestActive);
  addSetting("testScore", data.testScore);
  addSetting("testName", data.testName);
  addSetting("lastUsedWeek", data.lastUsedWeek);
  addSetting("hijriAdjustments", data.hijriAdjustments);

  // بيانات إضافية من التخزين المحلي (Comprehensive)
  addSetting("reportColorMap", localStorage.getItem("halaqaReportColorMap"));
  addSetting(
    "reportSaveColors",
    localStorage.getItem("halaqaReportSaveColors"),
  );
  addSetting(
    "reportVisibleColumns",
    localStorage.getItem("halaqaReportSelectedColumns"),
  );
  addSetting("testReportColorMap", localStorage.getItem("testReportColorMap"));
  addSetting(
    "testReportSaveColors",
    localStorage.getItem("testReportSaveColors"),
  );
  addSetting(
    "testReportVisibleColumns",
    localStorage.getItem("testReportSelectedColumns"),
  );
  addSetting("rankColors", localStorage.getItem("testReportRankColors"));
  addSetting(
    "certificateConfig",
    localStorage.getItem("simpleCertificateConfig"),
  );

  const wsSettings = XLSX.utils.aoa_to_sheet([
    settingsHeaders,
    ...settingsData,
  ]);
  applyCommonStyles(wsSettings, settingsHeaders);
  XLSX.utils.book_append_sheet(wb, wsSettings, "Settings");

  if (data.deletedItems && data.deletedItems.length > 0) {
    const deletedHeaders = ["id", "type", "timestamp"];
    const deletedData = data.deletedItems.map((d) => [d.id, d.type, d.timestamp]);
    const wsDeleted = XLSX.utils.aoa_to_sheet([deletedHeaders, ...deletedData]);
    applyCommonStyles(wsDeleted, deletedHeaders);
    XLSX.utils.book_append_sheet(wb, wsDeleted, "DeletedItems");
  }

  if (data.suggestions && data.suggestions.length > 0) {
    const suggHeaders = ["id", "teacherId", "teacherName", "type", "content", "createdAt", "updatedAt"];
    const suggData = data.suggestions.map((s) => [s.id, s.teacherId, s.teacherName, s.type, s.content, s.createdAt, s.updatedAt]);
    const wsSugg = XLSX.utils.aoa_to_sheet([suggHeaders, ...suggData]);
    applyCommonStyles(wsSugg, suggHeaders);
    XLSX.utils.book_append_sheet(wb, wsSugg, "Suggestions");
  }

  if (data.studentBehaviors && data.studentBehaviors.length > 0) {
    const behHeaders = ["id", "studentId", "studentName", "teacherId", "teacherName", "content", "createdAt", "updatedAt"];
    const behData = data.studentBehaviors.map((b) => [b.id, b.studentId, b.studentName, b.teacherId, b.teacherName, b.content, b.createdAt, b.updatedAt]);
    const wsBeh = XLSX.utils.aoa_to_sheet([behHeaders, ...behData]);
    applyCommonStyles(wsBeh, behHeaders);
    XLSX.utils.book_append_sheet(wb, wsBeh, "StudentBehaviors");
  }

  if (data.matns && data.matns.length > 0) {
    const matnHeaders = ["id", "name", "linesCount", "linesText", "updatedAt"];
    const matnData = data.matns.map((m) => [m.id, m.name, m.linesCount, m.linesText || (m.verses ? m.verses.join("\n") : ""), m.updatedAt]);
    const wsMatn = XLSX.utils.aoa_to_sheet([matnHeaders, ...matnData]);
    applyCommonStyles(wsMatn, matnHeaders);
    XLSX.utils.book_append_sheet(wb, wsMatn, "Matns");
  }

  if (data.newStudentTests && data.newStudentTests.length > 0) {
    const testHeaders = ["id", "studentName", "grade", "parentPhone", "teacherId", "teacherName", "testDate", "surahs", "pages", "fathErrors", "tashkeelErrors", "tajweedErrors", "score", "maxScore", "percentage", "passingRate", "isPassed", "status", "createdStudentId", "notes", "updatedAt"];
    const testData = data.newStudentTests.map((t) => [
      t.id,
      t.studentName,
      t.grade,
      t.parentPhone,
      t.teacherId,
      t.teacherName || "",
      t.testDate,
      t.surahs ? t.surahs.join(",") : "",
      t.pages ? t.pages.join(",") : "",
      t.fathErrors,
      t.tashkeelErrors,
      t.tajweedErrors,
      t.score,
      t.maxScore,
      t.percentage,
      t.passingRate,
      t.isPassed ? "true" : "false",
      t.status,
      t.createdStudentId || "",
      t.notes || "",
      t.updatedAt || 0,
    ]);
    const wsTests = XLSX.utils.aoa_to_sheet([testHeaders, ...testData]);
    applyCommonStyles(wsTests, testHeaders);
    XLSX.utils.book_append_sheet(wb, wsTests, "NewStudentTests");
  }

  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const importFullBackup = (file: File): Promise<FullBackupData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, {
          type: "binary",
          cellFormula: true,
          cellNF: true,
          cellText: true,
        });
        const importedData: Partial<FullBackupData> = {};

        const processSheet = (
          name: string,
          mapping: (row: any, headers: any[]) => any,
        ) => {
          const sheetName = workbook.SheetNames.find(
            (n: string) => n.trim().toLowerCase() === name.toLowerCase(),
          );
          if (sheetName) {
            const ws = workbook.Sheets[sheetName];
            // we use raw: true to get the calculated value of formulas
            const sheetData = XLSX.utils.sheet_to_json(ws, {
              header: 1,
              raw: true,
              defval: null,
            }) as any[][];
            if (sheetData.length > 0) {
              const originalHeaders = sheetData[0];
              const headersLower = originalHeaders.map((h) =>
                h ? String(h).trim().toLowerCase() : "",
              );
              
              return sheetData
                .slice(1)
                .filter((row) => row && row.length > 0)
                .map((row) => {
                  const baseObj = mapping(row, headersLower);
                  // Dynamically pick up any extra fields not in the hardcoded mapping
                  originalHeaders.forEach((h, idx) => {
                    if (h !== undefined && h !== null) {
                      const key = String(h).trim();
                      if (!(key in baseObj)) {
                        let val = row[idx];
                        if (val !== undefined && val !== null && val !== "") {
                           if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
                              try { val = JSON.parse(val); } catch(e) {}
                           }
                           baseObj[key] = val;
                        }
                      }
                    }
                  });
                  return baseObj;
                });
            }
          }
          return [];
        };

        importedData.users = processSheet("Users", (r, h) => ({
          id: Number(getValue(r, h, "id") || 0),
          name: String(getValue(r, h, "name") || ""),
          role: String(getValue(r, h, "role")) as UserRole,
          updatedAt: safeNum(getValue(r, h, "updatedAt")) || Date.now(),
        }));

        importedData.halaqas = processSheet("Halaqas", (r, h) => ({
          id: Number(getValue(r, h, "id") || 0),
          name: String(getValue(r, h, "name") || ""),
          teacherId: Number(getValue(r, h, "teacherId") || 0),
          testTeacherId: safeNum(getValue(r, h, "testTeacherId")),
          updatedAt: safeNum(getValue(r, h, "updatedAt")) || Date.now(),
        }));

        importedData.sardHalaqas = processSheet("SardHalaqas", (r, h) => ({
          id: Number(getValue(r, h, "id") || 0),
          name: String(getValue(r, h, "name") || ""),
          teacherId: Number(getValue(r, h, "teacherId") || 0),
          testTeacherId: safeNum(getValue(r, h, "testTeacherId")),
          updatedAt: safeNum(getValue(r, h, "updatedAt")) || Date.now(),
        }));

        importedData.students = processSheet("Students", (r, h) => ({
          id: Number(getValue(r, h, "id") || 0),
          name: String(getValue(r, h, "name") || ""),
          halaqaId: Number(getValue(r, h, "halaqaId") || 0),
          sardHalaqaId: safeNum(getValue(r, h, "sardHalaqaId")),
          schoolStage: safeStr(getValue(r, h, "schoolStage")),
          parentPhone: safeStr(getValue(r, h, "parentPhone")),
          oldMemorizedPages: safeStr(getValue(r, h, "oldMemorizedPages")),
          manualSurahs: getValue(r, h, "manualSurahs")
            ? String(getValue(r, h, "manualSurahs"))
                .split(",")
                .map((s: string) => s.trim())
            : null,
          manualParts: getValue(r, h, "manualParts")
            ? String(getValue(r, h, "manualParts"))
                .split(",")
                .map((s: string) => s.trim())
            : null,
          manualSavedParts: getValue(r, h, "manualSavedParts")
            ? String(getValue(r, h, "manualSavedParts"))
                .split(",")
                .map((s: string) => s.trim())
            : null,
          manualStudentLevel: safeStr(getValue(r, h, "manualStudentLevel")),
          isAlAmeen:
            String(getValue(r, h, "isAlAmeen")).toUpperCase() === "TRUE",
          isFromIbri:
            getValue(r, h, "isFromIbri") !== undefined
              ? (String(getValue(r, h, "isFromIbri")).toUpperCase() === "TRUE" || String(getValue(r, h, "isFromIbri")) === "نعم" || String(getValue(r, h, "isFromIbri")) === "1")
              : true,
          updatedAt: safeNum(getValue(r, h, "updatedAt")) || Date.now(),
        }));

        const regularEvaluations = processSheet("Evaluations", (r, h) => ({
          id: Number(getValue(r, h, "id") || 0),
          studentId: Number(getValue(r, h, "studentId") || 0),
          halaqaId: Number(getValue(r, h, "halaqaId") || 0),
          teacherId: safeNum(getValue(r, h, "teacherId")),
          weekNumber: Number(getValue(r, h, "weekNumber") || 0),
          attendance:
            (String(getValue(r, h, "attendance")) as AttendanceStatus) ||
            AttendanceStatus.PRESENT,
          absenceReason: safeStr(
            getValue(r, h, "absenceReason"),
          ) as AbsenceReason,
          evaluationType: safeStr(
            getValue(r, h, "evaluationType"),
          ) as EvaluationType,
          pages: safeNum(getValue(r, h, "pages")),
          fromAyah: safeNum(getValue(r, h, "fromAyah")),
          toAyah: safeNum(getValue(r, h, "toAyah")),
          surahs: getValue(r, h, "surahs")
            ? String(getValue(r, h, "surahs"))
                .split(",")
                .map((s: string) => s.trim())
            : null,
          performance: safeStr(
            getValue(r, h, "performance"),
          ) as PerformanceLevel,
          periodicReview: safeStr(
            getValue(r, h, "periodicReview"),
          ) as PeriodicReviewStatus,
          notes: safeStr(getValue(r, h, "notes")),
          evaluationDate: safeStr(getValue(r, h, "evaluationDate")),
          isTest: String(getValue(r, h, "isTest")).toUpperCase() === "TRUE",
          testName: safeStr(getValue(r, h, "testName")),
          testFathErrors: safeNum(getValue(r, h, "testFathErrors")),
          testTashkeelErrors: safeNum(getValue(r, h, "testTashkeelErrors")),
          testTajweedErrors: safeNum(getValue(r, h, "testTajweedErrors")),
          testPassageChanges: safeNum(getValue(r, h, "testPassageChanges")),
          testTotalScore: safeNum(getValue(r, h, "testTotalScore")),
          testMaxScore: safeNum(getValue(r, h, "testMaxScore")),
          updatedAt: safeNum(getValue(r, h, "updatedAt")) || 0,
        }));

        const testEvaluationsData = processSheet("TestEvaluations", (r, h) => ({
          id: Number(getValue(r, h, "id") || 0),
          studentId: Number(getValue(r, h, "studentId") || 0),
          halaqaId: Number(getValue(r, h, "halaqaId") || 0),
          teacherId: safeNum(getValue(r, h, "teacherId")),
          weekNumber: Number(getValue(r, h, "weekNumber") || 0),
          testName: safeStr(getValue(r, h, "testName")),
          testFathErrors: safeNum(getValue(r, h, "testFathErrors")),
          testTashkeelErrors: safeNum(getValue(r, h, "testTashkeelErrors")),
          testTajweedErrors: safeNum(getValue(r, h, "testTajweedErrors")),
          testPassageChanges: safeNum(getValue(r, h, "testPassageChanges")),
          testTotalScore: safeNum(getValue(r, h, "testTotalScore")),
          testMaxScore: safeNum(getValue(r, h, "testMaxScore")),
          evaluationDate: safeStr(getValue(r, h, "evaluationDate")),
          notes: safeStr(getValue(r, h, "notes")),
          isTest: true,
          attendance: AttendanceStatus.PRESENT,
          updatedAt: safeNum(getValue(r, h, "updatedAt")) || 0,
        }));

        importedData.evaluations = [
          ...regularEvaluations,
          ...testEvaluationsData,
        ];

        importedData.sardEvaluations = processSheet("SardEvaluations", (r, h) => {
          const pageRangesRaw = getValue(r, h, "pageRanges");
          let pageRanges = [];
          if (pageRangesRaw) {
            try {
              pageRanges = typeof pageRangesRaw === 'string' ? JSON.parse(pageRangesRaw) : pageRangesRaw;
            } catch(e) {}
          }
          const rawJuz = getValue(r, h, "juzList") || getValue(r, h, "parts");
          const juzList = rawJuz
            ? String(rawJuz).split(",").map((p: string) => Number(p.trim())).filter((n: number) => !isNaN(n))
            : [];
          return {
            id: Number(getValue(r, h, "id") || 0),
            studentId: Number(getValue(r, h, "studentId") || 0),
            sardHalaqaId: safeNum(getValue(r, h, "sardHalaqaId")),
            teacherId: safeNum(getValue(r, h, "teacherId")),
            date: safeStr(getValue(r, h, "date")) || safeStr(getValue(r, h, "evaluationDate")) || new Date().toISOString().split('T')[0],
            juzList,
            pagesCount: safeNum(getValue(r, h, "pagesCount")) || safeNum(getValue(r, h, "pages")) || 0,
            pageRanges,
            hesitationErrors: safeNum(getValue(r, h, "hesitationErrors")) || 0,
            fathErrors: safeNum(getValue(r, h, "fathErrors")) || 0,
            tajweedErrors: safeNum(getValue(r, h, "tajweedErrors")) || 0,
            totalErrors: safeNum(getValue(r, h, "totalErrors")) || 0,
            grade: safeStr(getValue(r, h, "grade")) || "",
            performance: safeStr(getValue(r, h, "performance")),
            notes: safeStr(getValue(r, h, "notes")),
            updatedAt: safeNum(getValue(r, h, "updatedAt")) || 0,
          };
        });

        importedData.maghribAttendances = processSheet(
          "MaghribAttendances",
          (r, h) => ({
            id: Number(getValue(r, h, "id") || 0),
            studentId: Number(getValue(r, h, "studentId") || 0),
            weekNumber: Number(getValue(r, h, "weekNumber") || 0),
            status: String(getValue(r, h, "status")) as MaghribAttendanceStatus,
            date: safeStr(getValue(r, h, "date")),
            time: safeStr(getValue(r, h, "time")),
            programType:
              (safeStr(getValue(r, h, "programType")) as "maghrib" | "asr") ||
              "maghrib",
            updatedAt: safeNum(getValue(r, h, "updatedAt")) || 0,
          }),
        );

        
        importedData.suggestions = processSheet("Suggestions", (r, h) => ({
          id: safeNum(getValue(r, h, "id")) || Date.now() + Math.floor(Math.random() * 1000),
          teacherId: safeNum(getValue(r, h, "teacherId")) || 0,
          teacherName: getValue(r, h, "teacherName") || "",
          type: getValue(r, h, "type") || "text",
          content: getValue(r, h, "content") || "",
          createdAt: safeNum(getValue(r, h, "createdAt")) || Date.now(),
          updatedAt: safeNum(getValue(r, h, "updatedAt")),
        }));

        importedData.studentBehaviors = processSheet("StudentBehaviors", (r, h) => ({
          id: safeNum(getValue(r, h, "id")) || Date.now() + Math.floor(Math.random() * 1000),
          studentId: safeNum(getValue(r, h, "studentId")) || 0,
          studentName: getValue(r, h, "studentName") || "",
          teacherId: safeNum(getValue(r, h, "teacherId")) || 0,
          teacherName: getValue(r, h, "teacherName") || "",
          content: getValue(r, h, "content") || "",
          createdAt: safeNum(getValue(r, h, "createdAt")) || Date.now(),
          updatedAt: safeNum(getValue(r, h, "updatedAt")),
        }));

        importedData.matns = processSheet("Matns", (r, h) => {
          const rawText = getValue(r, h, "linesText") || "";
          const verses = rawText ? rawText.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0) : undefined;
          return {
            id: safeNum(getValue(r, h, "id")) || Date.now() + Math.floor(Math.random() * 1000),
            name: getValue(r, h, "name") || "",
            linesCount: safeNum(getValue(r, h, "linesCount")) || (verses ? verses.length : 0),
            linesText: rawText || undefined,
            verses,
            updatedAt: safeNum(getValue(r, h, "updatedAt")),
          };
        });

        importedData.newStudentTests = processSheet("NewStudentTests", (r, h) => {
          return {
            id: safeNum(getValue(r, h, "id")) || Date.now() + Math.floor(Math.random() * 1000),
            studentName: getValue(r, h, "studentName") || "",
            grade: getValue(r, h, "grade") || "",
            parentPhone: getValue(r, h, "parentPhone") || "",
            teacherId: safeNum(getValue(r, h, "teacherId")) || 0,
            teacherName: getValue(r, h, "teacherName") || undefined,
            testDate: getValue(r, h, "testDate") || "",
            surahs: getValue(r, h, "surahs") ? String(getValue(r, h, "surahs")).split(",").filter(Boolean) : undefined,
            pages: getValue(r, h, "pages") ? String(getValue(r, h, "pages")).split(",").map(Number).filter(n => !isNaN(n)) : undefined,
            fathErrors: safeNum(getValue(r, h, "fathErrors")) || 0,
            tashkeelErrors: safeNum(getValue(r, h, "tashkeelErrors")) || 0,
            tajweedErrors: safeNum(getValue(r, h, "tajweedErrors")) || 0,
            score: safeNum(getValue(r, h, "score")) || 0,
            maxScore: safeNum(getValue(r, h, "maxScore")) || 100,
            percentage: safeNum(getValue(r, h, "percentage")) || 0,
            passingRate: safeNum(getValue(r, h, "passingRate")) || 70,
            isPassed: String(getValue(r, h, "isPassed")).toLowerCase() === "true",
            status: (getValue(r, h, "status") as any) || "pending",
            createdStudentId: safeNum(getValue(r, h, "createdStudentId")) || undefined,
            notes: getValue(r, h, "notes") || undefined,
            updatedAt: safeNum(getValue(r, h, "updatedAt")) || Date.now(),
          };
        });

        const settingsSheetName = workbook.SheetNames.find(
          (n: string) => n.trim().toLowerCase() === "settings",
        );
        if (settingsSheetName) {
          const ws = workbook.Sheets[settingsSheetName];
          const sheetData = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            raw: true,
          }) as any[][];
          const settingsMap = new Map<string, string>();
          const chunkMap = new Map<string, { [index: number]: string }>();
          if (sheetData.length > 0) {
            const h = sheetData[0];
            const kIdx = getIdx(h, "Key");
            const vIdx = getIdx(h, "Value");
            sheetData.slice(1).forEach((row) => {
              if (!row || row.length === 0) return;
              const key = String(row[kIdx] || "");
              const val = row[vIdx] !== undefined ? String(row[vIdx]) : "";
              if (key.includes("_CHUNK_")) {
                const parts = key.split("_CHUNK_");
                const base = parts[0];
                const cIdx = parseInt(parts[1], 10);
                if (!chunkMap.has(base)) chunkMap.set(base, {});
                chunkMap.get(base)![cIdx] = val;
              } else settingsMap.set(key, val);
            });
            chunkMap.forEach((chunks, base) => {
              if (settingsMap.has(base)) {
                let full = settingsMap.get(base) || "";
                Object.keys(chunks)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .forEach((i) => (full += chunks[i]));
                settingsMap.set(base, full);
              }
            });
            const getS = (k: string) => settingsMap.get(k);
            if (settingsMap.has("customLogo")) {
              const logo = getS("customLogo");
              importedData.customLogo =
                logo === "null" || logo === "" ? null : logo;
            }
            if (settingsMap.has("supervisorPassword"))
              importedData.supervisorPassword = getS("supervisorPassword");
            if (settingsMap.has("maghribPassword"))
              importedData.maghribPassword = getS("maghribPassword");
            if (settingsMap.has("appName"))
              importedData.appName = getS("appName");
            if (settingsMap.has("firebaseConfig")) {
              const conf = getS("firebaseConfig");
              try {
                importedData.firebaseConfig = conf ? JSON.parse(conf) : null;
              } catch (e) {
                importedData.firebaseConfig = null;
              }
            }
            if (settingsMap.has("configUpdatedAt"))
              importedData.configUpdatedAt = Number(getS("configUpdatedAt"));
            if (settingsMap.has("isDistributable"))
              importedData.isDistributable =
                getS("isDistributable")?.toLowerCase() === "true";
            if (settingsMap.has("isPublishedConnected"))
              importedData.isPublishedConnected =
                getS("isPublishedConnected")?.toLowerCase() === "true";
            if (settingsMap.has("isTestActive"))
              importedData.isTestActive =
                getS("isTestActive")?.toLowerCase() === "true";
            if (settingsMap.has("testScore"))
              importedData.testScore = Number(getS("testScore"));
            if (settingsMap.has("testName"))
              importedData.testName = getS("testName");
            if (settingsMap.has("lastUsedWeek"))
              importedData.lastUsedWeek = Number(getS("lastUsedWeek"));
            if (settingsMap.has("hijriAdjustments")) {
              const adj = getS("hijriAdjustments");
              try {
                importedData.hijriAdjustments = adj ? JSON.parse(adj) : {};
              } catch (e) {
                importedData.hijriAdjustments = {};
              }
            }

            // استعادة البيانات الإضافية للتخزين المحلي
            const setLS = (key: string, valKey: string) => {
              if (settingsMap.has(valKey)) {
                const val = getS(valKey);
                if (val) localStorage.setItem(key, val);
              }
            };
            setLS("halaqaReportColorMap", "reportColorMap");
            setLS("halaqaReportSaveColors", "reportSaveColors");
            setLS("halaqaReportSelectedColumns", "reportVisibleColumns");
            setLS("testReportColorMap", "testReportColorMap");
            setLS("testReportSaveColors", "testReportSaveColors");
            setLS("testReportSelectedColumns", "testReportVisibleColumns");
            setLS("testReportRankColors", "rankColors");
            setLS("simpleCertificateConfig", "certificateConfig");

            XLSX.utils.book_append_sheet(
              XLSX.utils.book_new(),
              XLSX.utils.aoa_to_sheet([[]]),
              "dummy",
            ); // Just to avoid empty book errors if any
          }
        }

        resolve({
          users: importedData.users || [],
          halaqas: importedData.halaqas || [],
          sardHalaqas: importedData.sardHalaqas || [],
          students: importedData.students || [],
          evaluations: importedData.evaluations || [],
          sardEvaluations: importedData.sardEvaluations || [],
          maghribAttendances: importedData.maghribAttendances || [],
          suggestions: importedData.suggestions || [],
          studentBehaviors: importedData.studentBehaviors || [],
          matns: importedData.matns || [],
          newStudentTests: importedData.newStudentTests || [],
          deletedItems: [],
          customLogo:
            importedData.customLogo !== undefined
              ? importedData.customLogo
              : null,
          supervisorPassword: importedData.supervisorPassword || "1234",
          maghribPassword: importedData.maghribPassword || "1234",
          appName: importedData.appName || "إعداد حافظ",
          firebaseConfig: importedData.firebaseConfig || null,
          configUpdatedAt: importedData.configUpdatedAt || 0,
          isDistributable: importedData.isDistributable || false,
          isPublishedConnected: importedData.isPublishedConnected || false,
          isTestActive: importedData.isTestActive || false,
          testScore: importedData.testScore || 10,
          testName: importedData.testName || "اختبار 1",
          lastUsedWeek: importedData.lastUsedWeek || null,
          hijriAdjustments: importedData.hijriAdjustments || {},
        });
      } catch (error) {
        console.error("Backup parse error:", error);
        reject(
          new Error(
            "فشل في قراءة الملف. تأكد من أنه ملف Excel صالح وبصيغة النسخة الاحتياطية.",
          ),
        );
      }
    };
    reader.onerror = () => reject(new Error("حدث خطأ أثناء قراءة الملف."));
    reader.readAsBinaryString(file);
  });
};

export const exportFullBackupJson = (data: FullBackupData, fileName: string) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const importFullBackupJson = (file: File): Promise<FullBackupData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as FullBackupData;
        resolve(data);
      } catch (error) {
        console.error("Backup JSON parse error:", error);
        reject(
          new Error(
            "فشل في قراءة الملف. تأكد من أنه ملف JSON صالح.",
          ),
        );
      }
    };
    reader.onerror = () => reject(new Error("حدث خطأ أثناء قراءة الملف."));
    reader.readAsText(file);
  });
};

