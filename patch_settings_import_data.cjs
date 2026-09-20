const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf-8');

const targetStr = `        confirmAction(
          "استيراد بيانات الطلاب والحلقات",
          "سيتم إضافة الطلاب والحلقات والمعلمين من الملف إلى القائمة الحالية. هل أنت متأكد؟",
          async () => {
            let addedCount = 0;
            const localUsers = [...users];
            const localHalaqas = [...halaqas];`;

const replacementStr = `        confirmAction(
          "استيراد بيانات الطلاب والحلقات",
          "سيتم حذف الحلقات والطلاب الحاليين واستبدالهم بالبيانات من الملف. هل أنت متأكد؟",
          async () => {
            // حذف جميع الحلقات السابقة (والتي بدورها ستحذف الطلاب المرتبطين بها)
            for (const h of halaqas) {
              deleteHalaqa(h.id);
            }
            // حذف أي طلاب متبقين
            for (const s of students) {
              deleteStudent(s.id);
            }

            let addedCount = 0;
            const localUsers = [...users];
            const localHalaqas = []; // نبدأ بقائمة حلقات فارغة لأننا حذفنا السابق`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('components/Settings.tsx', content, 'utf-8');
