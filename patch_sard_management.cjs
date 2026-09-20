const fs = require('fs');
let content = fs.readFileSync('components/SardManagement.tsx', 'utf-8');

const targetSardHalaqa = `                    const newHalaqaId = Date.now() + Math.floor(Math.random() * 1000);
                    addSardHalaqa({ name: hName, teacherId: teacherId || 0 });
                    sardHalaqaNameToId.set(hKey, newHalaqaId);
                    targetSardHalaqaId = newHalaqaId;`;

const replaceSardHalaqa = `                    const newHalaqaId = addSardHalaqa({ name: hName, teacherId: teacherId || 0 }) as number;
                    sardHalaqaNameToId.set(hKey, newHalaqaId);
                    targetSardHalaqaId = newHalaqaId;`;

content = content.replace(targetSardHalaqa, replaceSardHalaqa);

fs.writeFileSync('components/SardManagement.tsx', content, 'utf-8');
