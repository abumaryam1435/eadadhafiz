import fs from 'fs';
let content = fs.readFileSync('components/MushafReaderModal.tsx', 'utf8');

const regex = /{ \/\* Group Mode Error Controls \*\/ }\s*\{hasErrorControls && sardGroupMode && \([\s\S]*?\}\)\s*<\/div>\s*\)\}/;

content = content.replace(regex, '');

fs.writeFileSync('components/MushafReaderModal.tsx', content);
