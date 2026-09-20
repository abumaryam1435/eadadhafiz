const fs = require('fs');
let content = fs.readFileSync('components/TeacherDashboard.tsx', 'utf-8');

content = content.replace(
  "{isTestActive && (",
  "{(isTestActive || canViewBehaviors) && ("
);

// We should only show the test button if isTestActive is true
content = content.replace(
  "          <button \n            onClick={() => setActiveView('test')}",
  "          {isTestActive && (<button \n            onClick={() => setActiveView('test')}"
);
content = content.replace(
  "            </span>\n          </button>",
  "            </span>\n          </button>)}"
);

fs.writeFileSync('components/TeacherDashboard.tsx', content, 'utf-8');
