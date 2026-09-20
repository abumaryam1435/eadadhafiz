const fs = require('fs');
let content = fs.readFileSync('components/SupervisorSuggestionsView.tsx', 'utf-8');
const buttonHtml = `<button
                  onClick={() => setShowPermissionsModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-xl font-black text-sm transition-all border border-indigo-100 dark:border-indigo-900/40 shadow-sm shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  صلاحيات الاطلاع
                </button>`;
const newButtonHtml = `{!isTeacher && (${buttonHtml})}`;
content = content.replace(buttonHtml, newButtonHtml);
fs.writeFileSync('components/SupervisorSuggestionsView.tsx', content, 'utf-8');
