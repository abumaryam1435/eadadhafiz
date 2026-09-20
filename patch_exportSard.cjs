const fs = require('fs');
let content = fs.readFileSync('utils/halaqaExcelUtils.ts', 'utf-8');

const targetFunc = `export const exportSardHalaqasTemplate = (fileName: string = 'قالب_استيراد_حلقات_السرد') => {
  const headers = [
    'اسم حلقة السرد',
    'اسم المعلم',
    'اسم الطالب'
  ];
  const exampleRows = [
    ['سرد الأجزاء الخمسة الأولى', 'الشيخ محمد عبدالعزيز', 'عبدالرحمن خالد'],
    ['سرد الأجزاء الخمسة الأولى', 'الشيخ محمد عبدالعزيز', 'عمر فاروق'],
    ['سرد العشرة أجزاء', 'الشيخ عبدالسلام القحطاني', 'سالم علي'],
    ['سرد القرآن كاملاً', 'الشيخ فهد التميمي', 'حمزة طارق']
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  ws['!rightToLeft'] = true;
  ws['!cols'] = [
    { wch: 28 }, // اسم حلقة السرد
    { wch: 25 }, // اسم المعلم
    { wch: 25 }, // اسم الطالب
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'حلقات السرد');
  XLSX.writeFile(wb, \`\${fileName}.xlsx\`);
};`;

const newFunc = `export const exportSardHalaqasTemplate = (fileName: string = 'قالب_استيراد_حلقات_السرد', users: any[] = [], students: any[] = []) => {
  const headers = [
    'اسم حلقة السرد',
    'اسم المعلم',
    'رقم المعلم',
    'اسم الطالب',
    'رقم الطالب'
  ];
  const exampleRows = [
    ['سرد الأجزاء الخمسة الأولى', 'الشيخ محمد عبدالعزيز', '', 'عبدالرحمن خالد', ''],
    ['سرد الأجزاء الخمسة الأولى', 'الشيخ محمد عبدالعزيز', '', 'عمر فاروق', ''],
    ['سرد العشرة أجزاء', 'الشيخ عبدالسلام القحطاني', '', 'سالم علي', ''],
    ['سرد القرآن كاملاً', 'الشيخ فهد التميمي', '', 'حمزة طارق', '']
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  ws['!rightToLeft'] = true;
  ws['!cols'] = [
    { wch: 28 }, // اسم حلقة السرد
    { wch: 25 }, // اسم المعلم
    { wch: 20 }, // رقم المعلم
    { wch: 25 }, // اسم الطالب
    { wch: 20 }, // رقم الطالب
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'حلقات السرد');

  // Sheet 2: Teachers
  const teacherHeaders = ['اسم المعلم', 'رقم المعلم'];
  const teachers = users.filter(u => u.role === 'teacher' || u.role === 'TEACHER'); 
  const teacherRows = teachers.map(t => [t.name, t.id]);
  const wsTeachers = XLSX.utils.aoa_to_sheet([teacherHeaders, ...teacherRows]);
  wsTeachers['!rightToLeft'] = true;
  wsTeachers['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsTeachers, 'المعلمون');

  // Sheet 3: Students
  const studentHeaders = ['اسم الطالب', 'رقم الطالب'];
  const studentRows = students.map(s => [s.name, s.id]);
  const wsStudents = XLSX.utils.aoa_to_sheet([studentHeaders, ...studentRows]);
  wsStudents['!rightToLeft'] = true;
  wsStudents['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsStudents, 'الطلاب');

  XLSX.writeFile(wb, \`\${fileName}.xlsx\`);
};`;

content = content.replace(targetFunc, newFunc);
fs.writeFileSync('utils/halaqaExcelUtils.ts', content, 'utf-8');
