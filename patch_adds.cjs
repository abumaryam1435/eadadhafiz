const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf-8');

content = content.replace("addSardHalaqa: (sardHalaqa: Omit<SardHalaqa, 'id'>) => void;", "addSardHalaqa: (sardHalaqa: Omit<SardHalaqa, 'id'>) => number;");

// Update addSardHalaqa to return id
content = content.replace(
`  const addSardHalaqa = (h: any) => {
    const id = generateId();
    writeData(\`data/sardHalaqas/\${id}\`, { ...h, id, updatedAt: id });
  };`,
`  const addSardHalaqa = (h: any) => {
    const id = generateId();
    writeData(\`data/sardHalaqas/\${id}\`, { ...h, id, updatedAt: id });
    return id;
  };`);

fs.writeFileSync('App.tsx', content, 'utf-8');
