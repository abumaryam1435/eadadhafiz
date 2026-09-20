const fs = require('fs');

function patchFile(filename) {
  let content = fs.readFileSync(filename, 'utf-8');

  // Fix types
  content = content.replace(
    /items:\s*\{\s*halaqaName:\s*string;\s*teacherName:\s*string;\s*studentName:\s*string\s*\}\[\];/g,
    "items: { halaqaName: string; teacherName: string; teacherIdStr?: string; studentName: string; studentIdStr?: string; }[];"
  );
  content = content.replace(
    /items:\s*\{\s*halaqaName:\s*string;\s*teacherName:\s*string;\s*studentName:\s*string\s*\}\[\]/g,
    "items: { halaqaName: string; teacherName: string; teacherIdStr?: string; studentName: string; studentIdStr?: string; }[]"
  );

  // Fix Teacher lookup logic
  const targetTeacherLogic = `      if (tName) {
        const tKey = tName.toLowerCase();
        if (teacherNameToId.has(tKey)) {
          teacherId = teacherNameToId.get(tKey)!;
        } else {
          const newTeacherId = addTeacher(tName) as number;
          teacherNameToId.set(tKey, newTeacherId);
          teacherId = newTeacherId;
          importedTeachersCount++;
        }
      }`;

  const replaceTeacherLogic = `      if (tName) {
        const tKey = tName.toLowerCase();
        if (row.teacherIdStr && !isNaN(parseInt(row.teacherIdStr))) {
           teacherId = parseInt(row.teacherIdStr);
        } else if (teacherNameToId.has(tKey)) {
          teacherId = teacherNameToId.get(tKey)!;
        } else {
          const newTeacherId = addTeacher(tName) as number;
          teacherNameToId.set(tKey, newTeacherId);
          teacherId = newTeacherId;
          importedTeachersCount++;
        }
      }`;
      
  const targetTeacherLogic2 = `            if (tName) {
                const tKey = tName.toLowerCase();
                if (teacherNameToId.has(tKey)) {
                    teacherId = teacherNameToId.get(tKey)!;
                } else {
                    const newTeacherId = addTeacher(tName) as number;
                    teacherNameToId.set(tKey, newTeacherId);
                    teacherId = newTeacherId;
                    importedTeachersCount++;
                }
            }`;
            
  const replaceTeacherLogic2 = `            if (tName) {
                const tKey = tName.toLowerCase();
                if (row.teacherIdStr && !isNaN(parseInt(row.teacherIdStr))) {
                   teacherId = parseInt(row.teacherIdStr);
                } else if (teacherNameToId.has(tKey)) {
                    teacherId = teacherNameToId.get(tKey)!;
                } else {
                    const newTeacherId = addTeacher(tName) as number;
                    teacherNameToId.set(tKey, newTeacherId);
                    teacherId = newTeacherId;
                    importedTeachersCount++;
                }
            }`;

  content = content.replace(targetTeacherLogic, replaceTeacherLogic);
  content = content.replace(targetTeacherLogic2, replaceTeacherLogic2);
  
  // Fix Student lookup logic (Settings)
  const targetStudentLogic = `      if (sName && sName !== 'لا يوجد طلاب') {
        const existingStudent = students.find(s => s.name.trim().toLowerCase() === sName.toLowerCase());`;
  
  const replaceStudentLogic = `      if (sName && sName !== 'لا يوجد طلاب') {
        const studentIdFromRow = row.studentIdStr && !isNaN(parseInt(row.studentIdStr)) ? parseInt(row.studentIdStr) : null;
        const existingStudent = students.find(s => studentIdFromRow ? s.id === studentIdFromRow : s.name.trim().toLowerCase() === sName.toLowerCase());`;
        
  // Fix Student lookup logic (SardManagement)
  const targetStudentLogicSard = `            if (sName && sName !== 'لا يوجد طلاب') {
                const existingStudent = students.find(s => s.name.trim().toLowerCase() === sName.toLowerCase());`;
                
  const replaceStudentLogicSard = `            if (sName && sName !== 'لا يوجد طلاب') {
                const studentIdFromRow = row.studentIdStr && !isNaN(parseInt(row.studentIdStr)) ? parseInt(row.studentIdStr) : null;
                const existingStudent = students.find(s => studentIdFromRow ? s.id === studentIdFromRow : s.name.trim().toLowerCase() === sName.toLowerCase());`;

  content = content.replace(targetStudentLogic, replaceStudentLogic);
  content = content.replace(targetStudentLogicSard, replaceStudentLogicSard);

  fs.writeFileSync(filename, content, 'utf-8');
}

patchFile('components/Settings.tsx');
patchFile('components/SardManagement.tsx');
patchFile('components/StudentManagement.tsx');

