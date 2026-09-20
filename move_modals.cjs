const fs = require('fs');
const content = fs.readFileSync('components/SupervisorSuggestionsView.tsx', 'utf-8');

const lines = content.split('\n');
const deleteConfirmStart = lines.findIndex(l => l.includes('{deleteConfirmId !== null && ('));
const showDeleteAllEnd = lines.findIndex(l => l.includes('</>')) - 1; // before </>

if (deleteConfirmStart === -1 || showDeleteAllEnd === -1 || showDeleteAllEnd < deleteConfirmStart) {
  console.log('Could not find modals block correctly');
  process.exit(1);
}

const modalsBlock = lines.slice(deleteConfirmStart, showDeleteAllEnd + 1).join('\n');

const newLines = [
  ...lines.slice(0, deleteConfirmStart),
  ...lines.slice(showDeleteAllEnd + 1, lines.length - 2), // everything up to the final </div>
  modalsBlock,
  lines[lines.length - 2],
  lines[lines.length - 1]
];

fs.writeFileSync('components/SupervisorSuggestionsView.tsx', newLines.join('\n'), 'utf-8');
console.log('moved modals');
