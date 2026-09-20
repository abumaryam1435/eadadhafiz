const fs = require('fs');

let content = fs.readFileSync('components/EvaluationForm.tsx', 'utf-8');

// Replace the <div className="grid grid-cols-3 gap-2 w-full"> block with the new layout
const blockToReplace = `<div className="grid grid-cols-3 gap-2 w-full">
                        {/* Fath */}
                        <div 
                          onClick={() => setErrs('fath', errs.fath + 1)}
                          className="flex items-stretch bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 rounded-xl border border-rose-200 dark:border-rose-800/70 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-11 sm:h-12"
                        >
                          <div className="flex-1 flex flex-col items-center justify-center pt-0.5">
                            <span className="text-[11px] sm:text-xs font-black text-rose-700 dark:text-rose-300 group-hover:text-rose-900 dark:group-hover:text-rose-100 transition-colors select-none leading-tight">الفتح</span>
                            <span className="text-[9px] text-rose-500/80 font-bold">(+1)</span>
                          </div>
                          <div className="px-1.5 flex items-center justify-center bg-white/60 dark:bg-black/20 border-r border-rose-100 dark:border-rose-900/50">
                            <div className="w-10 sm:w-11 h-7 sm:h-8 rounded-full bg-white dark:bg-gray-900 border border-rose-300 dark:border-rose-600 flex items-center justify-center overflow-hidden shadow-xs">
                              <input 
                                onClick={(e) => e.stopPropagation()} 
                                type="number" 
                                min="0" 
                                value={errs.fath === 0 ? '' : errs.fath} 
                                placeholder="0" 
                                onChange={e => setErrs('fath', Math.max(0, Number(e.target.value)))} 
                                onFocus={e => e.target.select()} 
                                className="w-full h-full text-center text-sm font-black bg-transparent text-rose-600 dark:text-rose-400 focus:text-rose-800 border-0 outline-none p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-300/50 z-10" 
                              />
                            </div>
                          </div>
                        </div>
                        {/* Tashkeel */}
                        <div 
                          onClick={() => setErrs('tashkeel', errs.tashkeel + 1)}
                          className="flex items-stretch bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 rounded-xl border border-amber-200 dark:border-amber-800/70 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-11 sm:h-12"
                        >
                          <div className="flex-1 flex flex-col items-center justify-center pt-0.5">
                            <span className="text-[11px] sm:text-xs font-black text-amber-700 dark:text-amber-300 group-hover:text-amber-900 dark:group-hover:text-amber-100 transition-colors select-none leading-tight">التشكيل</span>
                            <span className="text-[9px] text-amber-500/80 font-bold">(+1)</span>
                          </div>
                          <div className="px-1.5 flex items-center justify-center bg-white/60 dark:bg-black/20 border-r border-amber-100 dark:border-amber-900/50">
                            <div className="w-10 sm:w-11 h-7 sm:h-8 rounded-full bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-600 flex items-center justify-center overflow-hidden shadow-xs">
                              <input 
                                onClick={(e) => e.stopPropagation()} 
                                type="number" 
                                min="0" 
                                value={errs.tashkeel === 0 ? '' : errs.tashkeel} 
                                placeholder="0" 
                                onChange={e => setErrs('tashkeel', Math.max(0, Number(e.target.value)))} 
                                onFocus={e => e.target.select()} 
                                className="w-full h-full text-center text-sm font-black bg-transparent text-amber-600 dark:text-amber-400 focus:text-amber-800 border-0 outline-none p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-amber-300/50 z-10" 
                              />
                            </div>
                          </div>
                        </div>
                        {/* Tajweed */}
                        <div 
                          onClick={() => setErrs('tajweed', errs.tajweed + 1)}
                          className="flex items-stretch bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 rounded-xl border border-blue-200 dark:border-blue-800/70 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-11 sm:h-12"
                        >
                          <div className="flex-1 flex flex-col items-center justify-center pt-0.5">
                            <span className="text-[11px] sm:text-xs font-black text-blue-700 dark:text-blue-300 group-hover:text-blue-900 dark:group-hover:text-blue-100 transition-colors select-none leading-tight">التجويد</span>
                            <span className="text-[9px] text-blue-500/80 font-bold">(0.5)</span>
                          </div>
                          <div className="px-1.5 flex items-center justify-center bg-white/60 dark:bg-black/20 border-r border-blue-100 dark:border-blue-900/50">
                            <div className="w-10 sm:w-11 h-7 sm:h-8 rounded-full bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-600 flex items-center justify-center overflow-hidden shadow-xs">
                              <input 
                                onClick={(e) => e.stopPropagation()} 
                                type="number" 
                                min="0" 
                                value={errs.tajweed === 0 ? '' : errs.tajweed} 
                                placeholder="0" 
                                onChange={e => setErrs('tajweed', Math.max(0, Number(e.target.value)))} 
                                onFocus={e => e.target.select()} 
                                className="w-full h-full text-center text-sm font-black bg-transparent text-blue-600 dark:text-blue-400 focus:text-blue-800 border-0 outline-none p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-blue-300/50 z-10" 
                              />
                            </div>
                          </div>
                        </div>
                      </div>`;

const newBlock = `<div className="grid grid-cols-3 gap-2 w-full">
                        {/* Fath */}
                        <div 
                          className="flex items-stretch bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 rounded-xl border border-rose-200 dark:border-rose-800/70 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                          onClick={() => setErrs('fath', errs.fath + 1)}
                        >
                          <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                            <span className="text-[10px] sm:text-xs font-black text-rose-700 dark:text-rose-300 group-hover:text-rose-900 dark:group-hover:text-rose-100 transition-colors select-none text-right flex flex-col leading-tight">
                              <span>الفتح</span>
                              <span className="text-[9px] text-rose-500/80">(+1)</span>
                            </span>
                          </div>
                          <div className="px-1.5 sm:px-2 flex items-center justify-center bg-white/60 dark:bg-black/20 border-r border-rose-100 dark:border-rose-900/50">
                            <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-white dark:bg-gray-900 border border-rose-300 dark:border-rose-600 flex items-center justify-center overflow-hidden shadow-xs">
                              <input 
                                onClick={(e) => e.stopPropagation()} 
                                type="number" 
                                min="0" 
                                value={errs.fath === 0 ? '' : errs.fath} 
                                placeholder="0" 
                                onChange={e => setErrs('fath', Math.max(0, Number(e.target.value)))} 
                                onFocus={e => e.target.select()} 
                                className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-rose-600 dark:text-rose-400 focus:text-rose-800 dark:focus:text-rose-200 border-0 outline-none p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-300/50 z-10" 
                              />
                            </div>
                          </div>
                        </div>

                        {/* Tashkeel */}
                        <div 
                          className="flex items-stretch bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 rounded-xl border border-amber-200 dark:border-amber-800/70 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                          onClick={() => setErrs('tashkeel', errs.tashkeel + 1)}
                        >
                          <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                            <span className="text-[10px] sm:text-xs font-black text-amber-700 dark:text-amber-300 group-hover:text-amber-900 dark:group-hover:text-amber-100 transition-colors select-none text-right flex flex-col leading-tight">
                              <span>التشكيل</span>
                              <span className="text-[9px] text-amber-500/80">(+1)</span>
                            </span>
                          </div>
                          <div className="px-1.5 sm:px-2 flex items-center justify-center bg-white/60 dark:bg-black/20 border-r border-amber-100 dark:border-amber-900/50">
                            <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-600 flex items-center justify-center overflow-hidden shadow-xs">
                              <input 
                                onClick={(e) => e.stopPropagation()} 
                                type="number" 
                                min="0" 
                                value={errs.tashkeel === 0 ? '' : errs.tashkeel} 
                                placeholder="0" 
                                onChange={e => setErrs('tashkeel', Math.max(0, Number(e.target.value)))} 
                                onFocus={e => e.target.select()} 
                                className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-amber-600 dark:text-amber-400 focus:text-amber-800 dark:focus:text-amber-200 border-0 outline-none p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-amber-300/50 z-10" 
                              />
                            </div>
                          </div>
                        </div>

                        {/* Tajweed */}
                        <div 
                          className="flex items-stretch bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 rounded-xl border border-teal-200 dark:border-teal-800/70 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                          onClick={() => setErrs('tajweed', errs.tajweed + 1)}
                        >
                          <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                            <span className="text-[10px] sm:text-xs font-black text-teal-700 dark:text-teal-300 group-hover:text-teal-900 dark:group-hover:text-teal-100 transition-colors select-none text-right flex flex-col leading-tight">
                              <span>التجويد</span>
                              <span className="text-[9px] text-teal-500/80">(0.5)</span>
                            </span>
                          </div>
                          <div className="px-1.5 sm:px-2 flex items-center justify-center bg-white/60 dark:bg-black/20 border-r border-teal-100 dark:border-teal-900/50">
                            <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-white dark:bg-gray-900 border border-teal-300 dark:border-teal-600 flex items-center justify-center overflow-hidden shadow-xs">
                              <input 
                                onClick={(e) => e.stopPropagation()} 
                                type="number" 
                                min="0" 
                                value={errs.tajweed === 0 ? '' : errs.tajweed} 
                                placeholder="0" 
                                onChange={e => setErrs('tajweed', Math.max(0, Number(e.target.value)))} 
                                onFocus={e => e.target.select()} 
                                className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-teal-600 dark:text-teal-400 focus:text-teal-800 dark:focus:text-teal-200 border-0 outline-none p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-teal-300/50 z-10" 
                              />
                            </div>
                          </div>
                        </div>
                      </div>`;

if (content.includes(blockToReplace.split('\n')[2].trim())) {
  // It's safer to just replace using string replace since exact match might fail due to indentation
  const indexStart = content.indexOf('<div className="grid grid-cols-3 gap-2 w-full">');
  const perfBarIndex = content.indexOf('{/* Performance Bar */}');
  
  if (indexStart !== -1 && perfBarIndex !== -1) {
    const pre = content.substring(0, indexStart);
    const post = content.substring(perfBarIndex);
    content = pre + newBlock + '\n\n                      ' + post;
    fs.writeFileSync('components/EvaluationForm.tsx', content);
    console.log("Successfully replaced block!");
  } else {
    console.log("Could not find bounds");
  }
} else {
  console.log("Block not found");
}

