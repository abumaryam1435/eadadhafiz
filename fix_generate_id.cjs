const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf-8');

const targetContent = "const generateId = () => Date.now() + Math.floor(Math.random() * 1000);";
const replacementContent = "let _idCounter = 0;\nconst generateId = () => Date.now() * 1000 + (++_idCounter % 1000) + Math.floor(Math.random() * 1000);";

content = content.replace(targetContent, replacementContent);
fs.writeFileSync('App.tsx', content, 'utf-8');
