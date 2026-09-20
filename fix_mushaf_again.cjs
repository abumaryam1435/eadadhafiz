const fs = require('fs');

function checkFile(file) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    let earlyReturnLine = -1;
    let hookLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // This regex looks for returns inside the component body, outside of functions/useMemo.
        // It's hard to do perfectly with regex, so let's just grep the file for `if.*return` before the first `useEffect` or `useState`.
    }
}
