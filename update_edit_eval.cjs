const fs = require('fs');
let code = fs.readFileSync('components/EvaluationEditForm.tsx', 'utf-8');

// Destructure matns
code = code.replace(
  '  const [testTajweed, setTestTajweed] = useState<number>(initialEvaluation.testTajweedErrors || 0);',
  '  const [testTajweed, setTestTajweed] = useState<number>(initialEvaluation.testTajweedErrors || 0);\n  const matns = context?.matns || [];'
);

// Update surahs rendering
const target = `                                <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 content-start pb-20 sm:pb-0">
                                    {QURAN_SURAHS.filter(s => isSmartMatch(s, surahSearchTerm)).map(s => (
                                        <label key={s} className={\`flex items-center p-4 rounded-xl cursor-pointer transition-all border-2 \${selectedSurahs.includes(s) ? 'bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-500/50' : 'border-gray-100 hover:border-green-200 dark:border-gray-700 dark:hover:border-gray-600'}\`}>
                                            <input type="checkbox" checked={selectedSurahs.includes(s)} onChange={() => setSelectedSurahs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className="ml-3 h-5 w-5 text-green-700 rounded-md border-gray-300 focus:ring-green-500" />
                                            <span className={\`text-base font-bold \${selectedSurahs.includes(s) ? 'text-green-900 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}\`}>{s}</span>
                                        </label>
                                    ))}
                                </div>`;

const replacement = `                                <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 content-start pb-20 sm:pb-0">
                                    {initialEvaluation.subject === 'mutoon' ? (
                                        (() => {
                                            const filtered = matns.filter(m => isSmartMatch(m.name, surahSearchTerm));
                                            return (
                                                <>
                                                    {filtered.map(m => (
                                                        <label key={m.id} className={\`flex justify-between items-center p-4 rounded-xl cursor-pointer transition-all border-2 \${selectedSurahs.includes(m.name) ? 'bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-500/50' : 'border-gray-100 hover:border-green-200 dark:border-gray-700 dark:hover:border-gray-600'}\`}>
                                                            <div className="flex items-center">
                                                                <input type="checkbox" checked={selectedSurahs.includes(m.name)} onChange={() => setSelectedSurahs(prev => prev.includes(m.name) ? prev.filter(x => x !== m.name) : [...prev, m.name])} className="ml-3 h-5 w-5 text-green-700 rounded-md border-gray-300 focus:ring-green-500" />
                                                                <span className={\`text-base font-bold \${selectedSurahs.includes(m.name) ? 'text-green-900 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}\`}>{m.name}</span>
                                                            </div>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">{m.linesCount} بيت</span>
                                                        </label>
                                                    ))}
                                                    {surahSearchTerm.trim() && !matns.some(m => m.name === surahSearchTerm.trim()) && (
                                                        <label key={surahSearchTerm.trim()} className={\`flex justify-between items-center p-4 rounded-xl cursor-pointer transition-all border-2 \${selectedSurahs.includes(surahSearchTerm.trim()) ? 'bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-500/50' : 'border-gray-100 hover:border-green-200 dark:border-gray-700 dark:hover:border-gray-600'}\`}>
                                                            <div className="flex items-center">
                                                                <input type="checkbox" checked={selectedSurahs.includes(surahSearchTerm.trim())} onChange={() => setSelectedSurahs(prev => prev.includes(surahSearchTerm.trim()) ? prev.filter(x => x !== surahSearchTerm.trim()) : [...prev, surahSearchTerm.trim()])} className="ml-3 h-5 w-5 text-green-700 rounded-md border-gray-300 focus:ring-green-500" />
                                                                <span className={\`text-base font-bold \${selectedSurahs.includes(surahSearchTerm.trim()) ? 'text-green-900 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}\`}>{surahSearchTerm.trim()}</span>
                                                            </div>
                                                        </label>
                                                    )}
                                                </>
                                            );
                                        })()
                                    ) : (
                                        QURAN_SURAHS.filter(s => isSmartMatch(s, surahSearchTerm)).map(s => (
                                            <label key={s} className={\`flex items-center p-4 rounded-xl cursor-pointer transition-all border-2 \${selectedSurahs.includes(s) ? 'bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-500/50' : 'border-gray-100 hover:border-green-200 dark:border-gray-700 dark:hover:border-gray-600'}\`}>
                                                <input type="checkbox" checked={selectedSurahs.includes(s)} onChange={() => setSelectedSurahs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className="ml-3 h-5 w-5 text-green-700 rounded-md border-gray-300 focus:ring-green-500" />
                                                <span className={\`text-base font-bold \${selectedSurahs.includes(s) ? 'text-green-900 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}\`}>{s}</span>
                                            </label>
                                        ))
                                    )}
                                </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('components/EvaluationEditForm.tsx', code, 'utf-8');
console.log('Fixed mutoon rendering in edit form');
