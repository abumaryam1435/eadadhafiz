const fs = require('fs');

function patchUsage(filename) {
  let content = fs.readFileSync(filename, 'utf-8');
  content = content.replace(
    'exportMainHalaqasTemplate("قالب_استيراد_الحلقات_الرئيسة")',
    'exportMainHalaqasTemplate("قالب_استيراد_الحلقات_الرئيسة", users, students)'
  );
  content = content.replace(
    "exportMainHalaqasTemplate('قالب_استيراد_الحلقات_الرئيسة')",
    "exportMainHalaqasTemplate('قالب_استيراد_الحلقات_الرئيسة', users, students)"
  );
  fs.writeFileSync(filename, content, 'utf-8');
}

patchUsage('components/Settings.tsx');
patchUsage('components/StudentManagement.tsx');
