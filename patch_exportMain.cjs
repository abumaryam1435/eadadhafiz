const fs = require('fs');
let content = fs.readFileSync('utils/halaqaExcelUtils.ts', 'utf-8');

const targetFunc = `export const exportMainHalaqasTemplate = (fileName: string = 'قالب_استيراد_الحلقات_الرئيسة') => {
  const headers = [
    'اسم الحلقة',
    'اسم المعلم',
    'اسم الطالب'
  ];
  const exampleRows = [
    ['حلقة أبي بكر الصديق', 'الشيخ أحمد محمد', 'عبدالرحمن خالد'],
    ['حلقة أبي بكر الصديق', 'الشيخ أحمد محمد', 'عمر فاروق'],
    ['حلقة عثمان بن عفان', 'الشيخ سعد إبراهيم', 'سالم علي'],
    ['حلقة علي بن أبي طالب', 'الشيخ يوسف عبدالله', 'حمزة طارق']
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  ws['!rightToLeft'] = true;
  ws['!cols'] = [
    { wch: 25 }, // اسم الحلقة
    { wch: 25 }, // اسم المعلم
    { wch: 25 }, // اسم الطالب
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الحلقات الرئيسة');
  XLSX.writeFile(wb, \`\${fileName}.xlsx\`);
};`;

const newFunc = `export const exportMainHalaqasTemplate = (fileName: string = 'قالب_استيراد_الحلقات_الرئيسة', users: any[] = [], students: any[] = []) => {
  const headers = [
    'اسم الحلقة',
    'اسم المعلم',
    'رقم المعلم (ID)',
    'اسم الطالب',
    'رقم الطالب (ID)'
  ];
  const exampleRows = [
    ['حلقة أبي بكر الصديق', 'الشيخ أحمد محمد', '', 'عبدالرحمن خالد', ''],
    ['حلقة أبي بكر الصديق', 'الشيخ أحمد محمد', '', 'عمر فاروق', ''],
    ['حلقة عثمان بن عفان', 'الشيخ سعد إبراهيم', '', 'سالم علي', ''],
    ['حلقة علي بن أبي طالب', 'الشيخ يوسف عبدالله', '', 'حمزة طارق', '']
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  ws['!rightToLeft'] = true;
  ws['!cols'] = [
    { wch: 25 }, // اسم الحلقة
    { wch: 25 }, // اسم المعلم
    { wch: 20 }, // رقم المعلم
    { wch: 25 }, // اسم الطالب
    { wch: 20 }, // رقم الطالب
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الحلقات الرئيسة');

  // Sheet 2: Teachers
  const teacherHeaders = ['اسم المعلم', 'رقم المعلم (ID)'];
  const teachers = users.filter(u => u.role === 'teacher' || u.role === 'TEACHER'); 
  const teacherRows = teachers.map(t => [t.name, t.id]);
  const wsTeachers = XLSX.utils.aoa_to_sheet([teacherHeaders, ...teacherRows]);
  wsTeachers['!rightToLeft'] = true;
  wsTeachers['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsTeachers, 'المعلمون');

  // Sheet 3: Students
  const studentHeaders = ['اسم الطالب', 'رقم الطالب (ID)'];
  const studentRows = students.map(s => [s.name, s.id]);
  const wsStudents = XLSX.utils.aoa_to_sheet([studentHeaders, ...studentRows]);
  wsStudents['!rightToLeft'] = true;
  wsStudents['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsStudents, 'الطلاب');

  XLSX.writeFile(wb, \`\${fileName}.xlsx\`);
};`;

content = content.replace(targetFunc, newFunc);
fs.writeFileSync('utils/halaqaExcelUtils.ts', content, 'utf-8');
