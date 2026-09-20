const fs = require('fs');
let code = fs.readFileSync('components/Settings.tsx', 'utf-8');

code = code.replace(
  '<button\n          className={`px-6 py-3 font-bold transition-all border-b-4 ${activeSettingsView === "customization" ? "text-green-700 border-green-700 dark:text-green-300" : "text-gray-400 border-transparent"}`}\n          onClick={() => setActiveSettingsView("customization")}\n        >\n          تخصيص المظهر\n        </button>',
  '<button\n          className={`px-6 py-3 font-bold transition-all border-b-4 ${activeSettingsView === "customization" ? "text-green-700 border-green-700 dark:text-green-300" : "text-gray-400 border-transparent"}`}\n          onClick={() => setActiveSettingsView("customization")}\n        >\n          تخصيص المظهر\n        </button>\n        <button\n          className={`px-6 py-3 font-bold transition-all border-b-4 ${activeSettingsView === "mutoon" ? "text-green-700 border-green-700 dark:text-green-300" : "text-gray-400 border-transparent"}`}\n          onClick={() => setActiveSettingsView("mutoon")}\n        >\n          إدارة المتون\n        </button>'
);

code = code.replace(
  'const [activeSettingsView, setActiveSettingsView] = useState<\n    "main" | "customization"\n  >("main");',
  'const [activeSettingsView, setActiveSettingsView] = useState<"main" | "customization" | "mutoon">("main");'
);
// fallback
code = code.replace(
  'const [activeSettingsView, setActiveSettingsView] = useState<"main" | "customization">("main");',
  'const [activeSettingsView, setActiveSettingsView] = useState<"main" | "customization" | "mutoon">("main");'
);


fs.writeFileSync('components/Settings.tsx', code, 'utf-8');
console.log('Added mutoon tab');
