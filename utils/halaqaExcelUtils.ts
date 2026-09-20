import * as XLSX from 'xlsx';

/**
 * دالة توليد وتنزيل قالب أكسل للحلقات الرئيسة
 * يحتوي على الأعمدة: اسم الحلقة، اسم المعلم، الطالب
 */
export const exportMainHalaqasTemplate = (
  fileName: string = 'قالب_استيراد_الحلقات_الرئيسة',
  users: any[] = [],
  students: any[] = []
) => {
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
    { wch: 20 }, // رقم المعلم (ID)
    { wch: 25 }, // اسم الطالب
    { wch: 20 }, // رقم الطالب (ID)
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الحلقات الرئيسة');

  if (users && users.length > 0) {
    const teacherHeaders = ['اسم المعلم', 'رقم المعلم (ID)'];
    const teachers = users.filter(u => u.role === 'teacher' || u.role === 'TEACHER');
    const teacherRows = teachers.map(t => [t.name, t.id]);
    const wsTeachers = XLSX.utils.aoa_to_sheet([teacherHeaders, ...teacherRows]);
    wsTeachers['!rightToLeft'] = true;
    wsTeachers['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'المعلمون');
  }

  if (students && students.length > 0) {
    const studentHeaders = ['اسم الطالب', 'رقم الطالب (ID)'];
    const studentRows = students.map(s => [s.name, s.id]);
    const wsStudents = XLSX.utils.aoa_to_sheet([studentHeaders, ...studentRows]);
    wsStudents['!rightToLeft'] = true;
    wsStudents['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsStudents, 'الطلاب');
  }

  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

/**
 * دالة توليد وتنزيل قالب أكسل لحلقات السرد
 * يحتوي على الأعمدة: اسم حلقة السرد، اسم المعلم، الطالب
 */
export const exportSardHalaqasTemplate = (
  fileName: string = 'قالب_استيراد_حلقات_السرد',
  users: any[] = [],
  students: any[] = []
) => {
  const headers = [
    'اسم حلقة السرد',
    'اسم المعلم',
    'رقم المعلم (ID)',
    'اسم الطالب',
    'رقم الطالب (ID)'
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
    { wch: 20 }, // رقم المعلم (ID)
    { wch: 25 }, // اسم الطالب
    { wch: 20 }, // رقم الطالب (ID)
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'حلقات السرد');

  if (users && users.length > 0) {
    const teacherHeaders = ['اسم المعلم', 'رقم المعلم (ID)'];
    const teachers = users.filter(u => u.role === 'teacher' || u.role === 'TEACHER');
    const teacherRows = teachers.map(t => [t.name, t.id]);
    const wsTeachers = XLSX.utils.aoa_to_sheet([teacherHeaders, ...teacherRows]);
    wsTeachers['!rightToLeft'] = true;
    wsTeachers['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'المعلمون');
  }

  if (students && students.length > 0) {
    const studentHeaders = ['اسم الطالب', 'رقم الطالب (ID)'];
    const studentRows = students.map(s => [s.name, s.id]);
    const wsStudents = XLSX.utils.aoa_to_sheet([studentHeaders, ...studentRows]);
    wsStudents['!rightToLeft'] = true;
    wsStudents['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsStudents, 'الطلاب');
  }

  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
