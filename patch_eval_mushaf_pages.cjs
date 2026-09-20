const fs = require('fs');
let code = fs.readFileSync('components/EvaluationForm.tsx', 'utf8');

const targetStr = `      <MushafReaderModal
        isOpen={isMushafModalOpen}
        onClose={() => setIsMushafModalOpen(false)}
        newPages={selectionState.allActivePages}
        previousWeekPages={previousWeekPages}`;

const replaceStr = `      <MushafReaderModal
        isOpen={isMushafModalOpen}
        onClose={() => setIsMushafModalOpen(false)}
        newPages={selectionState.allActivePages}
        previousWeekPages={previouslyMemorizedPages}`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync('components/EvaluationForm.tsx', code);
    console.log("Patched EvaluationForm Mushaf pages.");
} else {
    console.log("Could not find target string in EvaluationForm.tsx");
}
