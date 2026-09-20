const fs = require('fs');
let code = fs.readFileSync('utils/fullBackup.ts', 'utf-8');

const appendExport = `  XLSX.utils.book_append_sheet(wb, wsSettings, "Settings");

  if (data.deletedItems && data.deletedItems.length > 0) {
    const deletedHeaders = ["id", "type", "deletedAt"];
    const deletedData = data.deletedItems.map((d) => [d.id, d.type, d.deletedAt]);
    const wsDeleted = XLSX.utils.aoa_to_sheet([deletedHeaders, ...deletedData]);
    applyCommonStyles(wsDeleted, deletedHeaders);
    XLSX.utils.book_append_sheet(wb, wsDeleted, "DeletedItems");
  }

  if (data.suggestions && data.suggestions.length > 0) {
    const suggHeaders = ["id", "title", "description", "createdAt", "authorName", "status", "updatedAt"];
    const suggData = data.suggestions.map((s) => [s.id, s.title, s.description, s.createdAt, s.authorName, s.status, s.updatedAt]);
    const wsSugg = XLSX.utils.aoa_to_sheet([suggHeaders, ...suggData]);
    applyCommonStyles(wsSugg, suggHeaders);
    XLSX.utils.book_append_sheet(wb, wsSugg, "Suggestions");
  }

  if (data.studentBehaviors && data.studentBehaviors.length > 0) {
    const behHeaders = ["id", "studentId", "date", "type", "description", "reporterName", "createdAt", "updatedAt"];
    const behData = data.studentBehaviors.map((b) => [b.id, b.studentId, b.date, b.type, b.description, b.reporterName, b.createdAt, b.updatedAt]);
    const wsBeh = XLSX.utils.aoa_to_sheet([behHeaders, ...behData]);
    applyCommonStyles(wsBeh, behHeaders);
    XLSX.utils.book_append_sheet(wb, wsBeh, "StudentBehaviors");
  }

  if (data.matns && data.matns.length > 0) {
    const matnHeaders = ["id", "name", "linesCount", "updatedAt"];
    const matnData = data.matns.map((m) => [m.id, m.name, m.linesCount, m.updatedAt]);
    const wsMatn = XLSX.utils.aoa_to_sheet([matnHeaders, ...matnData]);
    applyCommonStyles(wsMatn, matnHeaders);
    XLSX.utils.book_append_sheet(wb, wsMatn, "Matns");
  }
`;

code = code.replace(
  `  XLSX.utils.book_append_sheet(wb, wsSettings, "Settings");`,
  appendExport
);

fs.writeFileSync('utils/fullBackup.ts', code, 'utf-8');
console.log('Updated exportFullBackup 2');
