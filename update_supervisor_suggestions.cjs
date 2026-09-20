const fs = require('fs');
let content = fs.readFileSync('components/SupervisorSuggestionsView.tsx', 'utf-8');

// Replace context destructuring
content = content.replace(
  "const { suggestions, deleteSuggestion, updateSuggestion, deleteAllSuggestions, showToast } = context;",
  "const { suggestions, deleteSuggestion, updateSuggestion, deleteAllSuggestions, showToast, studentBehaviors, updateStudentBehavior, deleteStudentBehavior, deleteAllStudentBehaviors } = context;\n  const [activeTab, setActiveTab] = useState<'suggestions' | 'behaviors'>('suggestions');\n  const [behaviorSearchTerm, setBehaviorSearchTerm] = useState('');\n  const [behaviorReviewedFilter, setBehaviorReviewedFilter] = useState<'all' | 'reviewed' | 'unreviewed'>('all');"
);

// Add behaviors filtering logic
content = content.replace(
  "  const formatDate = (timestamp: number) => {",
  `  const allBehaviors = studentBehaviors ? [...studentBehaviors].sort((a, b) => b.createdAt - a.createdAt) : [];
  const filteredBehaviors = allBehaviors.filter((b) => {
    const matchesSearch = (() => {
      if (!behaviorSearchTerm.trim()) return true;
      const searchWords = behaviorSearchTerm.toLowerCase().split(/\\s+/).filter(Boolean);
      const textToSearch = \`\${b.teacherName} \${b.studentName} \${b.content || ''}\`.toLowerCase();
      return searchWords.every(word => textToSearch.includes(word));
    })();
    const matchesReviewed = behaviorReviewedFilter === 'all' || (behaviorReviewedFilter === 'reviewed' ? !!b.reviewed : !b.reviewed);
    return matchesSearch && matchesReviewed;
  });

  const formatDate = (timestamp: number) => {`
);

// Add Tabs UI
const tabsHtml = `
      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl mb-2 border border-gray-200 dark:border-slate-700 shadow-sm flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('suggestions')}
          className={\`flex-1 py-3 text-center rounded-xl font-black text-sm transition-all \${
            activeTab === 'suggestions'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }\`}
        >
          المقترحات ({allSuggestions.length})
        </button>
        <button
          onClick={() => setActiveTab('behaviors')}
          className={\`flex-1 py-3 text-center rounded-xl font-black text-sm transition-all \${
            activeTab === 'behaviors'
              ? 'bg-white shadow-sm text-green-700 dark:bg-slate-700 dark:text-green-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }\`}
        >
          سلوك الطلاب ({allBehaviors.length})
        </button>
      </div>

      {activeTab === 'suggestions' ? (
        <>
`;

content = content.replace("{/* Controls / Filter Bar */}", tabsHtml + "\n      {/* Controls / Filter Bar */}");

// Wrap the end of suggestions and add behavior tab content
content = content.replace("        </div>\n      ) : (\n        <div className=", "        </div>\n      ) : (\n        <div className=");

// Wait, the end of the return statement is:
//       )}
//     </div>
//   );
// Let's use string manipulation to find the end

const parts = content.split("    </div>\n  );\n};\n");
let body = parts[0];
body += `
        </>
      ) : (
        <>
          {/* Controls / Filter Bar for Behaviors */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 relative">
                <input
                  type="text"
                  value={behaviorSearchTerm}
                  onChange={(e) => setBehaviorSearchTerm(e.target.value)}
                  placeholder="ابحث باسم المعلم، الطالب، أو محتوى السلوك..."
                  className="w-full pl-4 pr-10 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-900 dark:text-white text-sm outline-none focus:border-green-600 transition-all font-bold"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <select
                  value={behaviorReviewedFilter}
                  onChange={(e) => setBehaviorReviewedFilter(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-gray-900 dark:text-white text-sm outline-none focus:border-green-600 transition-all font-bold"
                >
                  <option value="all">كل حالات السلوك</option>
                  <option value="unreviewed">لم يتم الاطلاع عليها</option>
                  <option value="reviewed">تمت قراءتها ✔️</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Behaviors List */}
          {filteredBehaviors.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-12 text-center shadow-sm">
              <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="text-xl font-black text-gray-800 dark:text-gray-200 mb-2">لا توجد سجلات سلوك</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 font-bold max-w-md mx-auto">لا يوجد أي سلوكيات مسجلة تطابق شروط البحث الحالية.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBehaviors.map((b) => (
                <div key={b.id} className={\`bg-white dark:bg-slate-900 rounded-3xl p-5 border-2 \${!b.reviewed ? 'border-green-200 dark:border-green-900/50 shadow-md' : 'border-gray-100 dark:border-slate-800 shadow-sm opacity-80'} transition-all hover:opacity-100\`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                    <div>
                      <h4 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                        الطالب: {b.studentName}
                        {b.reviewed && <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-lg">مقروء</span>}
                      </h4>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400 font-bold mt-1">
                        <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>المعلم: {b.teacherName}</span>
                        <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{formatDate(b.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => updateStudentBehavior({ ...b, reviewed: !b.reviewed })}
                        className={\`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 \${b.reviewed ? 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700' : 'bg-green-600 text-white hover:bg-green-700 shadow-md'}\`}
                      >
                        {b.reviewed ? 'تحديد كغير مقروء' : 'تمت القراءة'}
                      </button>
                      <button
                        onClick={() => {
                          if(window.confirm('هل أنت متأكد من حذف هذا السلوك؟')) {
                            deleteStudentBehavior(b.id);
                          }
                        }}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-xl transition-all"
                        title="حذف"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{b.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
`;

fs.writeFileSync('components/SupervisorSuggestionsView.tsx', body, 'utf-8');
console.log('updated SupervisorSuggestionsView');
