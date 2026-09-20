const fs = require('fs');
let code = fs.readFileSync('components/EvaluationForm.tsx', 'utf-8');

const target = `                            const presetMutoons = ['غاية المراد', 'بهجة الأنوار', 'جوهر النظام', 'الدعائم', 'النونية', 'متن تحفة الأطفال', 'متن الجزرية', 'متن الشاطبية'];
                            const filtered = presetMutoons.filter(m => isSmartMatch(m, surahSearch));
                            const toShow = [...filtered];
                            if (surahSearch.trim() && !toShow.includes(surahSearch.trim())) {
                                toShow.push(surahSearch.trim());
                            }
                            return toShow.map(m => (
                              <label key={m} className={\`flex items-center p-4 rounded-xl cursor-pointer transition-all border-2 \${surahs.includes(m) ? 'bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-500/50' : 'border-gray-100 hover:border-green-200 dark:border-gray-700 dark:hover:border-gray-600'}\`}>
                                <input type="checkbox" checked={surahs.includes(m)} onChange={() => { setSurahs(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]); setHighlightSurahInput(false); }} className="ml-3 h-5 w-5 text-green-700 rounded-md border-gray-300 focus:ring-green-500" />
                                <span className={\`text-base font-bold \${surahs.includes(m) ? 'text-green-900 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}\`}>{m}</span>
                              </label>
                            ));`;

const replacement = `                            const filtered = matns.filter(m => isSmartMatch(m.name, surahSearch));
                            
                            return (
                                <>
                                    {filtered.map(m => (
                                      <label key={m.id} className={\`flex justify-between items-center p-4 rounded-xl cursor-pointer transition-all border-2 \${surahs.includes(m.name) ? 'bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-500/50' : 'border-gray-100 hover:border-green-200 dark:border-gray-700 dark:hover:border-gray-600'}\`}>
                                        <div className="flex items-center">
                                            <input type="checkbox" checked={surahs.includes(m.name)} onChange={() => { setSurahs(prev => prev.includes(m.name) ? prev.filter(x => x !== m.name) : [...prev, m.name]); setHighlightSurahInput(false); }} className="ml-3 h-5 w-5 text-green-700 rounded-md border-gray-300 focus:ring-green-500" />
                                            <span className={\`text-base font-bold \${surahs.includes(m.name) ? 'text-green-900 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}\`}>{m.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">{m.linesCount} بيت</span>
                                      </label>
                                    ))}
                                    {surahSearch.trim() && !matns.some(m => m.name === surahSearch.trim()) && (
                                      <label key={surahSearch.trim()} className={\`flex justify-between items-center p-4 rounded-xl cursor-pointer transition-all border-2 \${surahs.includes(surahSearch.trim()) ? 'bg-green-50 border-green-500 dark:bg-green-900/20 dark:border-green-500/50' : 'border-gray-100 hover:border-green-200 dark:border-gray-700 dark:hover:border-gray-600'}\`}>
                                        <div className="flex items-center">
                                            <input type="checkbox" checked={surahs.includes(surahSearch.trim())} onChange={() => { setSurahs(prev => prev.includes(surahSearch.trim()) ? prev.filter(x => x !== surahSearch.trim()) : [...prev, surahSearch.trim()]); setHighlightSurahInput(false); }} className="ml-3 h-5 w-5 text-green-700 rounded-md border-gray-300 focus:ring-green-500" />
                                            <span className={\`text-base font-bold \${surahs.includes(surahSearch.trim()) ? 'text-green-900 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}\`}>{surahSearch.trim()}</span>
                                        </div>
                                      </label>
                                    )}
                                </>
                            );`;

code = code.replace(target, replacement);
fs.writeFileSync('components/EvaluationForm.tsx', code, 'utf-8');
console.log('Fixed mutoon rendering in evaluation form');
