const fs = require('fs');
let content = fs.readFileSync('components/HalaqaExcelImportModal.tsx', 'utf-8');

// Update preview item interface
const targetInterface = `export interface HalaqaImportPreviewItem {
  id: string;
  halaqaName: string;
  teacherName: string;
  studentName: string;
  status: 'valid' | 'conflict' | 'warning' | 'new';
  warningMessage?: string;
  existingTeacherName?: string;
  existingHalaqaName?: string;
}`;

const newInterface = `export interface HalaqaImportPreviewItem {
  id: string;
  halaqaName: string;
  teacherName: string;
  teacherIdStr?: string;
  studentName: string;
  studentIdStr?: string;
  status: 'valid' | 'conflict' | 'warning' | 'new';
  warningMessage?: string;
  existingTeacherName?: string;
  existingHalaqaName?: string;
}`;

// Update prop interface
const targetProp = `  onConfirmImport: (payload: {
    items: { halaqaName: string; teacherName: string; studentName: string }[];
    resolveConflictMode: 'overwrite' | 'preserve';
  }) => void;`;

const newProp = `  onConfirmImport: (payload: {
    items: { halaqaName: string; teacherName: string; teacherIdStr?: string; studentName: string; studentIdStr?: string; }[];
    resolveConflictMode: 'overwrite' | 'preserve';
  }) => void;`;

content = content.replace(targetInterface, newInterface);
content = content.replace(targetProp, newProp);

// Update reading columns
const readNames = `          const rawTeacher = String(
            row['اسم المعلم'] ||
            row['المعلم'] ||
            row['معلم السرد'] ||
            row['اسم معلم السرد'] ||
            row['الشيخ'] ||
            ''
          ).trim();
          const rawStudent = String(
            row['اسم الطالب'] ||
            row['الطالب'] ||
            row['اسم طالب السرد'] ||
            row['الطلاب'] ||
            ''
          ).trim();`;

const newReadNames = `          const rawTeacher = String(
            row['اسم المعلم'] ||
            row['المعلم'] ||
            row['معلم السرد'] ||
            row['اسم معلم السرد'] ||
            row['الشيخ'] ||
            ''
          ).trim();
          const rawStudent = String(
            row['اسم الطالب'] ||
            row['الطالب'] ||
            row['اسم طالب السرد'] ||
            row['الطلاب'] ||
            ''
          ).trim();
          const rawTeacherId = String(row['رقم المعلم (ID)'] || row['رقم المعلم'] || row['id المعلم'] || '').trim();
          const rawStudentId = String(row['رقم الطالب (ID)'] || row['رقم الطالب'] || row['id الطالب'] || '').trim();`;

content = content.replace(readNames, newReadNames);

// Update push to previewItems
const targetPush = `            previewItems.push({
              id: \`\${idx}-\${Date.now()}\`,
              halaqaName: rawHalaqa,
              teacherName: rawTeacher,
              studentName: rawStudent,
              status,
              warningMessage: warnings.join('\\n') || undefined,
              existingTeacherName,
              existingHalaqaName
            });`;

const newPush = `            previewItems.push({
              id: \`\${idx}-\${Date.now()}\`,
              halaqaName: rawHalaqa,
              teacherName: rawTeacher,
              teacherIdStr: rawTeacherId,
              studentName: rawStudent,
              studentIdStr: rawStudentId,
              status,
              warningMessage: warnings.join('\\n') || undefined,
              existingTeacherName,
              existingHalaqaName
            });`;

content = content.replace(targetPush, newPush);

// Update handleApply mapping
const targetApply = `      items: parsedRows.map(r => ({
        halaqaName: r.halaqaName,
        teacherName: r.teacherName,
        studentName: r.studentName
      })),`;

const newApply = `      items: parsedRows.map(r => ({
        halaqaName: r.halaqaName,
        teacherName: r.teacherName,
        teacherIdStr: r.teacherIdStr,
        studentName: r.studentName,
        studentIdStr: r.studentIdStr
      })),`;

content = content.replace(targetApply, newApply);

fs.writeFileSync('components/HalaqaExcelImportModal.tsx', content, 'utf-8');
