import fs from 'fs';
let content = fs.readFileSync('components/MushafReaderModal.tsx', 'utf8');

const targetDropdown = `            {/* Quick Page Info & Dropdown Trigger Button */}
            {targetPages.length > 0 && (
              <div className="relative" ref={dropdownRef}>`;

const replaceDropdown = `            {/* Student Selection Dropdown (Group Mode) */}
            {sardGroupMode && sardGroupStudents.length > 0 && (
              <div className="relative" ref={studentDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
                  className="flex items-center gap-2 bg-gray-900 hover:bg-gray-850 text-emerald-200 px-3 py-1.5 rounded-xl text-xs font-black border border-emerald-500/40 transition-all shadow-xs cursor-pointer active:scale-95"
                  title="تحديد الطالب"
                >
                  <span className="truncate max-w-[100px] sm:max-w-[150px]">
                    {sardGroupStudents.find(s => s.id === selectedGroupStudentId)?.name || 'اختر الطالب'}
                  </span>
                  <svg className={\`w-3.5 h-3.5 text-emerald-400 transition-transform duration-200 \${isStudentDropdownOpen ? 'rotate-180' : ''}\`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isStudentDropdownOpen && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 sm:w-56 flex flex-col bg-gray-900 border border-emerald-500/40 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md">
                    <div className="p-2.5 bg-gray-950 border-b border-gray-800 flex items-center justify-between">
                      <span className="text-[11px] font-black text-emerald-300">
                        طلاب السرد الجماعي
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-48 custom-scrollbar">
                      {sardGroupStudents.map(student => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => {
                            setSelectedGroupStudentId(student.id);
                            setIsStudentDropdownOpen(false);
                          }}
                          className={\`w-full text-right px-3 py-2 text-xs font-bold border-b border-gray-800 last:border-b-0 hover:bg-gray-800 transition-colors flex justify-between items-center \${
                            selectedGroupStudentId === student.id ? 'bg-emerald-900/30 text-emerald-300' : 'text-gray-300'
                          }\`}
                        >
                          <span className="truncate">{student.name}</span>
                          {selectedGroupStudentId === student.id && (
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Page Info & Dropdown Trigger Button */}
            {targetPages.length > 0 && (
              <div className="relative" ref={dropdownRef}>`;
content = content.replace(targetDropdown, replaceDropdown);

fs.writeFileSync('components/MushafReaderModal.tsx', content);
