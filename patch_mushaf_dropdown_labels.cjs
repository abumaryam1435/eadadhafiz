const fs = require('fs');
let code = fs.readFileSync('components/MushafReaderModal.tsx', 'utf8');

const targetStr = `                        {targetPages.map(page => (
                          <button
                            key={page}
                            onClick={() => {
                              const newIdx = targetPages.indexOf(page);
                              if (newIdx !== -1) {
                                setCurrentIndex(newIdx);
                                setIsLoading(true);
                                setImageError(false);
                                setCurrentSrcIndex(0);
                                setIsPageDropdownOpen(false);
                              }
                            }}
                            className={\`w-full text-right px-3 py-1.5 text-xs font-bold hover:bg-amber-500/20 transition-colors \${page === currentPage ? 'bg-amber-500/30 text-amber-300' : 'text-gray-300'}\`}
                          >
                            صفحة {page}
                          </button>
                        ))}`;

const replaceStr = `                        {targetPages.map(page => {
                          const isNew = newPagesSet.has(page);
                          const isPrev = prevWeekSet.has(page) && !isNew;
                          return (
                          <button
                            key={page}
                            onClick={() => {
                              const newIdx = targetPages.indexOf(page);
                              if (newIdx !== -1) {
                                setCurrentIndex(newIdx);
                                setIsLoading(true);
                                setImageError(false);
                                setCurrentSrcIndex(0);
                                setIsPageDropdownOpen(false);
                              }
                            }}
                            className={\`w-full flex justify-between items-center px-3 py-1.5 text-xs font-bold hover:bg-amber-500/20 transition-colors \${page === currentPage ? 'bg-amber-500/30 text-amber-300' : 'text-gray-300'}\`}
                          >
                            <span>صفحة {page}</span>
                            {isNew && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 rounded-sm">جديد</span>}
                            {isPrev && <span className="text-[9px] bg-amber-900/50 text-amber-500 px-1.5 rounded-sm">قديم</span>}
                          </button>
                        ) })}`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('components/MushafReaderModal.tsx', code);
console.log("Patched dropdown labels.");
