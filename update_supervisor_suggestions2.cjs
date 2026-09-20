const fs = require('fs');
let content = fs.readFileSync('components/SupervisorSuggestionsView.tsx', 'utf-8');

content = content.replace(
  "const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);",
  "const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);\n  const [behaviorDeleteConfirmId, setBehaviorDeleteConfirmId] = useState<number | null>(null);"
);

const oldButtonHtml = `                      <button
                        onClick={() => {
                          if(window.confirm('هل أنت متأكد من حذف هذا السلوك؟')) {
                            deleteStudentBehavior(b.id);
                          }
                        }}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-xl transition-all"
                        title="حذف"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>`;

const newButtonHtml = `                      <button
                        onClick={() => setBehaviorDeleteConfirmId(b.id)}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-xl transition-all active:scale-95 shadow-sm"
                        title="حذف"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>`;

content = content.replace(oldButtonHtml, newButtonHtml);


const newModal = `      {behaviorDeleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-gray-100 dark:border-slate-800 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/35 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2">تأكيد حذف السلوك</h4>
            <p className="text-sm text-gray-500 dark:text-slate-400 font-bold mb-6">هل أنت متأكد من رغبتك في حذف هذا السلوك نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  deleteStudentBehavior(behaviorDeleteConfirmId);
                  setBehaviorDeleteConfirmId(null);
                  showToast('🗑️ تم حذف السلوك بنجاح.', 'success');
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg text-sm active:scale-95"
              >
                تأكيد الحذف
              </button>
              <button
                type="button"
                onClick={() => setBehaviorDeleteConfirmId(null)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-black rounded-2xl transition-all text-sm active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllConfirm && (`;

content = content.replace("{showDeleteAllConfirm && (", newModal);

fs.writeFileSync('components/SupervisorSuggestionsView.tsx', content, 'utf-8');
console.log('updated SupervisorSuggestionsView2');
