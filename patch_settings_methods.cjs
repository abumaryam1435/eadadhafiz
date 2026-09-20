const fs = require('fs');
let content = fs.readFileSync('components/Settings.tsx', 'utf-8');

const targetMethod = `  const updateStudent = context?.updateStudent || (async () => {});`;
const replacementMethod = `  const updateStudent = context?.updateStudent || (async () => {});
  const deleteHalaqa = context?.deleteHalaqa || (async () => {});
  const deleteStudent = context?.deleteStudent || (async () => {});`;

content = content.replace(targetMethod, replacementMethod);
fs.writeFileSync('components/Settings.tsx', content, 'utf-8');
