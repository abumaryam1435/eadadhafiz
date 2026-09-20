const fs = require('fs');
let content = fs.readFileSync('components/TeacherDashboard.tsx', 'utf-8');

// Add import
content = content.replace(
  "import { AppContext } from '../App';",
  "import { AppContext } from '../App';\nimport { SupervisorSuggestionsView } from './SupervisorSuggestionsView';"
);

// Add the state type
content = content.replace(
  "const [activeView, setActiveView] = useState<'evaluate' | 'test'>('evaluate');",
  "const [activeView, setActiveView] = useState<'evaluate' | 'test' | 'behaviors'>('evaluate');\n  const currentUser = context?.users?.find(u => u.id === teacherId);\n  const canViewBehaviors = currentUser?.canViewBehaviors;\n  const [isBehaviorsUnlocked, setIsBehaviorsUnlocked] = useState(false);\n  const [behaviorPassword, setBehaviorPassword] = useState('');\n  const [passwordError, setPasswordError] = useState('');"
);

// Add the third button
const thirdButton = `
          {canViewBehaviors && (
            <button 
              onClick={() => setActiveView('behaviors')} 
              className={\`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 \${
                activeView === 'behaviors' 
                  ? 'bg-indigo-600 shadow-sm text-white' 
                  : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400'
              }\`}
            >
              <span>⭐</span>
              <span>سجل السلوكيات</span>
            </button>
          )}
`;
content = content.replace(
  "</span>\n          </button>\n        </div>",
  "</span>\n          </button>\n" + thirdButton + "\n        </div>"
);

// Add the behaviors view content
const behaviorsContent = `
      {activeView === 'behaviors' && canViewBehaviors && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-slate-800">
          {!isBehaviorsUnlocked ? (
            <div className="max-w-sm mx-auto text-center space-y-4 py-10">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-black text-gray-800 dark:text-gray-200">سجل السلوكيات محمي</h3>
              <p className="text-sm text-gray-500 font-bold mb-4">الرجاء إدخال كلمة المرور المخصصة لك للوصول إلى السجل</p>
              
              <div className="relative">
                <input 
                  type="password" 
                  value={behaviorPassword}
                  onChange={(e) => { setBehaviorPassword(e.target.value); setPasswordError(''); }}
                  placeholder="كلمة المرور..."
                  className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition-all font-bold text-center"
                />
              </div>
              
              {passwordError && (
                <p className="text-red-500 text-xs font-bold">{passwordError}</p>
              )}
              
              <button 
                onClick={() => {
                  if (behaviorPassword === currentUser.behaviorsPassword) {
                    setIsBehaviorsUnlocked(true);
                  } else {
                    setPasswordError('كلمة المرور غير صحيحة');
                  }
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-md active:scale-95 text-sm"
              >
                دخول
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              <SupervisorSuggestionsView isTeacher={true} />
            </div>
          )}
        </div>
      )}
`;

content = content.replace(
  "      {activeView === 'test' && isTestActive && (",
  behaviorsContent + "\n      {activeView === 'test' && isTestActive && ("
);

fs.writeFileSync('components/TeacherDashboard.tsx', content, 'utf-8');
