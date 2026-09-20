const fs = require('fs');

function patchUsage(filename) {
  let content = fs.readFileSync(filename, 'utf-8');
  content = content.replace(
    'exportSardHalaqasTemplate("قالب_استيراد_حلقات_السرد")',
    'exportSardHalaqasTemplate("قالب_استيراد_حلقات_السرد", users, students)'
  );
  content = content.replace(
    "exportSardHalaqasTemplate('قالب_استيراد_حلقات_السرد')",
    "exportSardHalaqasTemplate('قالب_استيراد_حلقات_السرد', users, students)"
  );
  fs.writeFileSync(filename, content, 'utf-8');
}

patchUsage('components/Settings.tsx');
patchUsage('components/SardManagement.tsx');
