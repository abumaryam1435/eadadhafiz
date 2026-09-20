const fs = require('fs');
const cp = require('child_process');

// Find all React hooks being called after a conditional return in all TSX files.
const out = cp.execSync('bash check_hooks.sh', { encoding: 'utf-8' });
const lines = out.split('\n').filter(Boolean);

// we have output like "components/MushafReaderModal.tsx:120 Hook called after return at line 108"
const issues = {};
for (const line of lines) {
    const match = line.match(/^([^:]+):(\d+) Hook called after return at line (\d+):/);
    if (match) {
        const file = match[1];
        const hookLine = parseInt(match[2]);
        const returnLine = parseInt(match[3]);
        if (!issues[file]) issues[file] = [];
        issues[file].push({ hookLine, returnLine });
    }
}
console.log(issues);
