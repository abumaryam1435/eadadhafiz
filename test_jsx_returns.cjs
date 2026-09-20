const fs = require('fs');

function checkFile(file) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('{MushafReaderModal({') || content.includes('{ReportsTable({')) {
        console.log("Found in", file);
    }
}
