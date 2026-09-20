const fs = require('fs');
let code = fs.readFileSync('utils/fullBackup.ts', 'utf-8');

const importLogic = `
        importedData.suggestions = processSheet("Suggestions", (r, h) => ({
          id: safeNum(getValue(r, h, "id")) || generateId(),
          title: getValue(r, h, "title") || "",
          description: getValue(r, h, "description") || "",
          createdAt: safeNum(getValue(r, h, "createdAt")) || Date.now(),
          authorName: getValue(r, h, "authorName") || "",
          status: getValue(r, h, "status") || "pending",
          updatedAt: safeNum(getValue(r, h, "updatedAt")),
        }));

        importedData.studentBehaviors = processSheet("StudentBehaviors", (r, h) => ({
          id: safeNum(getValue(r, h, "id")) || generateId(),
          studentId: safeNum(getValue(r, h, "studentId")) || 0,
          date: getValue(r, h, "date") || "",
          type: getValue(r, h, "type") || "other",
          description: getValue(r, h, "description") || "",
          reporterName: getValue(r, h, "reporterName") || "",
          createdAt: safeNum(getValue(r, h, "createdAt")) || Date.now(),
          updatedAt: safeNum(getValue(r, h, "updatedAt")),
        }));

        importedData.matns = processSheet("Matns", (r, h) => ({
          id: safeNum(getValue(r, h, "id")) || generateId(),
          name: getValue(r, h, "name") || "",
          linesCount: safeNum(getValue(r, h, "linesCount")) || 0,
          updatedAt: safeNum(getValue(r, h, "updatedAt")),
        }));
`;

const anchor = `const settingsSheetName = workbook.SheetNames.find(`;

code = code.replace(anchor, importLogic + '\n        ' + anchor);

const returnObjAnchor = `          maghribAttendances: importedData.maghribAttendances || [],`;
const returnObjAdd = `          maghribAttendances: importedData.maghribAttendances || [],
          suggestions: importedData.suggestions || [],
          studentBehaviors: importedData.studentBehaviors || [],
          matns: importedData.matns || [],`;

code = code.replace(returnObjAnchor, returnObjAdd);

fs.writeFileSync('utils/fullBackup.ts', code, 'utf-8');
console.log('Updated importFullBackup');
