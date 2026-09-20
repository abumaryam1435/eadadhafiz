const fs = require('fs');
let content = fs.readFileSync('components/HalaqaExcelImportModal.tsx', 'utf-8');

const t1 = `export interface HalaqaImportPreviewItem {
  id: string;
  halaqaName: string;
  teacherName: string;
  studentName: string;`;

const r1 = `export interface HalaqaImportPreviewItem {
  id: string;
  halaqaName: string;
  teacherName: string;
  teacherIdStr?: string;
  studentName: string;
  studentIdStr?: string;`;

content = content.replace(t1, r1);

const t2 = `  onConfirmImport: (payload: {
    items: { halaqaName: string; teacherName: string; studentName: string }[];
    resolveConflictMode: 'overwrite' | 'preserve';
  }) => void;`;

const r2 = `  onConfirmImport: (payload: {
    items: { halaqaName: string; teacherName: string; teacherIdStr?: string; studentName: string; studentIdStr?: string; }[];
    resolveConflictMode: 'overwrite' | 'preserve';
  }) => void;`;

content = content.replace(t2, r2);

const t3 = `          const rawStudent = String(
            row['اسم الطالب'] ||
            row['الطالب'] ||
            row['اسم طالب السرد'] ||
            row['الطلاب'] ||
            ''
          ).trim();

          if (!rawHalaqa && !rawStudent) {`;

const r3 = `          const rawStudent = String(
            row['اسم الطالب'] ||
            row['الطالب'] ||
            row['اسم طالب السرد'] ||
            row['الطلاب'] ||
            ''
          ).trim();
          const rawTeacherId = String(row['رقم المعلم (ID)'] || row['رقم المعلم'] || row['id المعلم'] || '').trim();
          const rawStudentId = String(row['رقم الطالب (ID)'] || row['رقم الطالب'] || row['id الطالب'] || '').trim();

          if (!rawHalaqa && !rawStudent) {`;

content = content.replace(t3, r3);

const t4 = `            previewItems.push({
              id: \`\${idx}-\${Date.now()}\`,
              halaqaName: rawHalaqa,
              teacherName: rawTeacher,
              studentName: rawStudent,
              status,
              warningMessage: warnings.join('\\n') || undefined,
              existingTeacherName,
              existingHalaqaName
            });`;
            
const r4 = `            previewItems.push({
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
            
content = content.replace(t4, r4);

const t5 = `      items: parsedRows.map(r => ({
        halaqaName: r.halaqaName,
        teacherName: r.teacherName,
        studentName: r.studentName
      })),`;

const r5 = `      items: parsedRows.map(r => ({
        halaqaName: r.halaqaName,
        teacherName: r.teacherName,
        teacherIdStr: r.teacherIdStr,
        studentName: r.studentName,
        studentIdStr: r.studentIdStr
      })),`;
      
content = content.replace(t5, r5);

fs.writeFileSync('components/HalaqaExcelImportModal.tsx', content, 'utf-8');
