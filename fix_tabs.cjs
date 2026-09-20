const fs = require('fs');
let content = fs.readFileSync('components/SupervisorSuggestionsView.tsx', 'utf-8');
content = content.replace(
  "سلوك الطلاب ({allBehaviors.length})\n        </button>\n      </div>",
  "سلوك الطلاب ({allBehaviors.length})\n        </button>\n      </div>)}"
);
fs.writeFileSync('components/SupervisorSuggestionsView.tsx', content, 'utf-8');
