const fs = require('fs');
let content = fs.readFileSync('components/SupervisorSuggestionsView.tsx', 'utf-8');

// Add state
content = content.replace(
  "const [showPermissionsModal, setShowPermissionsModal] = useState(false);",
  "const [showPermissionsModal, setShowPermissionsModal] = useState(false);\n  const [teacherPermissionsSearchTerm, setTeacherPermissionsSearchTerm] = useState('');"
);

// Add search bar and filter map
const searchBarHtml = `
              <div className="relative mb-4">
                <input
                  type="text"
                  value={teacherPermissionsSearchTerm}
                  onChange={(e) => setTeacherPermissionsSearchTerm(e.target.value)}
                  placeholder="ابحث عن معلم..."
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition-all font-bold"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {teachers.filter(t => t.name.toLowerCase().includes(teacherPermissionsSearchTerm.toLowerCase())).map(teacher => (`;

content = content.replace("              {teachers.map(teacher => (", searchBarHtml);

// Reset search term when closing modal
content = content.replace(
  "onClick={() => setShowPermissionsModal(false)}",
  "onClick={() => { setShowPermissionsModal(false); setTeacherPermissionsSearchTerm(''); }}"
).replace(
  "onClick={() => setShowPermissionsModal(false)}",
  "onClick={() => { setShowPermissionsModal(false); setTeacherPermissionsSearchTerm(''); }}"
);

fs.writeFileSync('components/SupervisorSuggestionsView.tsx', content, 'utf-8');
console.log('added teacher permissions search');
