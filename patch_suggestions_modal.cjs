const fs = require('fs');
let content = fs.readFileSync('components/SuggestionsModal.tsx', 'utf-8');

// The early return might be `if (!isOpen) return null;`
content = content.replace(
  '  if (!isOpen) return null;\n\n  const [name, setName] = useState(\'\');',
  '  const [name, setName] = useState(\'\');\n\n  if (!isOpen) return null;'
);

fs.writeFileSync('components/SuggestionsModal.tsx', content, 'utf-8');
