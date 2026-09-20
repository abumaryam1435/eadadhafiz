const fs = require('fs');
let code = fs.readFileSync('components/Settings.tsx', 'utf-8');

if (!code.includes("import { MutoonManager }")) {
    code = code.replace(
        "import Logo from \"./Logo\";",
        "import Logo from \"./Logo\";\nimport { MutoonManager } from \"./MutoonManager\";"
    );
}

const mutoonView = `      {activeSettingsView === "mutoon" && (
        <MutoonManager />
      )}`;

code = code.replace(
  '{activeSettingsView === "customization" && (',
  mutoonView + '\n\n      {activeSettingsView === "customization" && ('
);

fs.writeFileSync('components/Settings.tsx', code, 'utf-8');
console.log('Added MutoonManager to Settings');
