const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf-8');

const targetContent = "let _idCounter = 0;\nconst generateId = () => Date.now() * 1000 + (++_idCounter % 1000) + Math.floor(Math.random() * 1000);";
const replacementContent = "let _lastId = 0;\nconst generateId = () => {\n  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);\n  _lastId = _lastId >= id ? _lastId + 1 : id;\n  return _lastId;\n};";

content = content.replace(targetContent, replacementContent);
fs.writeFileSync('App.tsx', content, 'utf-8');
