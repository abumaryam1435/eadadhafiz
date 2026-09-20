import fs from 'fs';
let content = fs.readFileSync('components/MushafReaderModal.tsx', 'utf8');

const targetState = `  const [pageSearchTerm, setPageSearchTerm] = useState('');`;
const replaceState = `  const [pageSearchTerm, setPageSearchTerm] = useState('');
  const [selectedGroupStudentId, setSelectedGroupStudentId] = useState<number | null>(null);
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sardGroupMode && sardGroupStudents.length > 0 && selectedGroupStudentId === null) {
      setSelectedGroupStudentId(sardGroupStudents[0].id);
    }
  }, [sardGroupMode, sardGroupStudents, selectedGroupStudentId]);

  useEffect(() => {
    const handleClickOutsideStudent = (event: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target as Node)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideStudent);
    return () => document.removeEventListener('mousedown', handleClickOutsideStudent);
  }, []);`;

content = content.replace(targetState, replaceState);

// Replace the error buttons handlers and values to use group errors if in group mode
const targetErrors = `          {/* Top Row: Larger Horizontal Error Buttons for (الفتح، التشكيل، التجويد) */}
          {hasErrorControls && !sardGroupMode && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full max-w-3xl mx-auto">
              {/* الفتح */}
              <div 
                className="flex items-stretch bg-rose-950/60 hover:bg-rose-900/60 rounded-xl border border-rose-500/50 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                onClick={() => setEvalFath && setEvalFath(prev => (typeof prev === 'number' ? prev + 1 : evalFath + 1))}
              >
                <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                  <span className="text-[10px] sm:text-xs font-black text-rose-200 group-hover:text-white transition-colors select-none text-right flex flex-col leading-tight">
                    <span>الفتح</span>
                    {isTestMode ? <span className="text-[9px] text-rose-400">({testDeductions.fath}-)</span> : <span className="text-[9px] text-rose-300/80">(+1)</span>}
                  </span>
                </div>
                <div className="px-1.5 sm:px-2 flex items-center justify-center">
                  <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-gray-900 border-2 border-rose-400 flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()}
                      type="number" 
                      min="0" 
                      value={evalFath === 0 ? '' : evalFath} 
                      placeholder="0"
                      onChange={e => setEvalFath && setEvalFath(Math.max(0, Number(e.target.value)))} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-rose-200 focus:text-white border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-700 z-10" 
                    />
                  </div>
                </div>
              </div>

              {/* التشكيل */}
              <div 
                className="flex items-stretch bg-amber-950/60 hover:bg-amber-900/60 rounded-xl border border-amber-500/50 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                onClick={() => setEvalTashkeel && setEvalTashkeel(prev => (typeof prev === 'number' ? prev + 1 : evalTashkeel + 1))}
              >
                <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                  <span className="text-[10px] sm:text-xs font-black text-amber-200 group-hover:text-white transition-colors select-none text-right flex flex-col leading-tight">
                    <span>التشكيل</span>
                    {isTestMode ? <span className="text-[9px] text-amber-400">({testDeductions.tashkeel}-)</span> : <span className="text-[9px] text-amber-300/80">(+1)</span>}
                  </span>
                </div>
                <div className="px-1.5 sm:px-2 flex items-center justify-center">
                  <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-gray-900 border-2 border-amber-400 flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()}
                      type="number" 
                      min="0" 
                      value={evalTashkeel === 0 ? '' : evalTashkeel} 
                      placeholder="0"
                      onChange={e => setEvalTashkeel && setEvalTashkeel(Math.max(0, Number(e.target.value)))} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-amber-200 focus:text-white border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-amber-700 z-10" 
                    />
                  </div>
                </div>
              </div>

              {/* التجويد */}
              <div 
                className="flex items-stretch bg-teal-950/60 hover:bg-teal-900/60 rounded-xl border border-teal-500/50 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                onClick={() => setEvalTajweed && setEvalTajweed(prev => (typeof prev === 'number' ? prev + 1 : evalTajweed + 1))}
              >
                <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                  <span className="text-[10px] sm:text-xs font-black text-teal-200 group-hover:text-white transition-colors select-none text-right flex flex-col leading-tight">
                    <span>التجويد</span>
                    {isTestMode ? <span className="text-[9px] text-teal-400">({testDeductions.tajweed}-)</span> : <span className="text-[9px] text-teal-300/80">(0.5)</span>}
                  </span>
                </div>
                <div className="px-1.5 sm:px-2 flex items-center justify-center">
                  <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-gray-900 border-2 border-teal-400 flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()}
                      type="number" 
                      min="0" 
                      value={evalTajweed === 0 ? '' : evalTajweed} 
                      placeholder="0"
                      onChange={e => setEvalTajweed && setEvalTajweed(Math.max(0, Number(e.target.value)))} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-teal-200 focus:text-white border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-teal-700 z-10" 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}`;

const replaceErrors = `          {/* Top Row: Larger Horizontal Error Buttons for (الفتح، التشكيل، التجويد) */}
          {hasErrorControls && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full max-w-3xl mx-auto">
              {/* الفتح */}
              <div 
                className="flex items-stretch bg-rose-950/60 hover:bg-rose-900/60 rounded-xl border border-rose-500/50 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                onClick={() => {
                  if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                    setSardGroupErrors(prev => ({
                      ...prev,
                      [selectedGroupStudentId]: {
                        ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                        fath: (prev[selectedGroupStudentId]?.fath || 0) + 1
                      }
                    }));
                  } else if (setEvalFath) {
                    setEvalFath(prev => (typeof prev === 'number' ? prev + 1 : evalFath + 1));
                  }
                }}
              >
                <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                  <span className="text-[10px] sm:text-xs font-black text-rose-200 group-hover:text-white transition-colors select-none text-right flex flex-col leading-tight">
                    <span>الفتح</span>
                    {isTestMode ? <span className="text-[9px] text-rose-400">({testDeductions.fath}-)</span> : <span className="text-[9px] text-rose-300/80">(+1)</span>}
                  </span>
                </div>
                <div className="px-1.5 sm:px-2 flex items-center justify-center">
                  <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-gray-900 border-2 border-rose-400 flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()}
                      type="number" 
                      min="0" 
                      value={sardGroupMode && selectedGroupStudentId ? (sardGroupErrors[selectedGroupStudentId]?.fath === 0 || !sardGroupErrors[selectedGroupStudentId] ? '' : sardGroupErrors[selectedGroupStudentId].fath) : (evalFath === 0 ? '' : evalFath)} 
                      placeholder="0"
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value));
                        if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                          setSardGroupErrors(prev => ({
                            ...prev,
                            [selectedGroupStudentId]: {
                              ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                              fath: val
                            }
                          }));
                        } else if (setEvalFath) {
                          setEvalFath(val);
                        }
                      }} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-rose-200 focus:text-white border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-rose-700 z-10" 
                    />
                  </div>
                </div>
              </div>

              {/* التشكيل */}
              <div 
                className="flex items-stretch bg-amber-950/60 hover:bg-amber-900/60 rounded-xl border border-amber-500/50 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                onClick={() => {
                  if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                    setSardGroupErrors(prev => ({
                      ...prev,
                      [selectedGroupStudentId]: {
                        ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                        tashkeel: (prev[selectedGroupStudentId]?.tashkeel || 0) + 1
                      }
                    }));
                  } else if (setEvalTashkeel) {
                    setEvalTashkeel(prev => (typeof prev === 'number' ? prev + 1 : evalTashkeel + 1));
                  }
                }}
              >
                <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                  <span className="text-[10px] sm:text-xs font-black text-amber-200 group-hover:text-white transition-colors select-none text-right flex flex-col leading-tight">
                    <span>التشكيل</span>
                    {isTestMode ? <span className="text-[9px] text-amber-400">({testDeductions.tashkeel}-)</span> : <span className="text-[9px] text-amber-300/80">(+1)</span>}
                  </span>
                </div>
                <div className="px-1.5 sm:px-2 flex items-center justify-center">
                  <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-gray-900 border-2 border-amber-400 flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()}
                      type="number" 
                      min="0" 
                      value={sardGroupMode && selectedGroupStudentId ? (sardGroupErrors[selectedGroupStudentId]?.tashkeel === 0 || !sardGroupErrors[selectedGroupStudentId] ? '' : sardGroupErrors[selectedGroupStudentId].tashkeel) : (evalTashkeel === 0 ? '' : evalTashkeel)} 
                      placeholder="0"
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value));
                        if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                          setSardGroupErrors(prev => ({
                            ...prev,
                            [selectedGroupStudentId]: {
                              ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                              tashkeel: val
                            }
                          }));
                        } else if (setEvalTashkeel) {
                          setEvalTashkeel(val);
                        }
                      }} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-amber-200 focus:text-white border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-amber-700 z-10" 
                    />
                  </div>
                </div>
              </div>

              {/* التجويد */}
              <div 
                className="flex items-stretch bg-teal-950/60 hover:bg-teal-900/60 rounded-xl border border-teal-500/50 overflow-hidden shadow-sm group cursor-pointer active:scale-95 transition-all h-10 sm:h-12"
                onClick={() => {
                  if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                    setSardGroupErrors(prev => ({
                      ...prev,
                      [selectedGroupStudentId]: {
                        ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                        tajweed: (prev[selectedGroupStudentId]?.tajweed || 0) + 1
                      }
                    }));
                  } else if (setEvalTajweed) {
                    setEvalTajweed(prev => (typeof prev === 'number' ? prev + 1 : evalTajweed + 1));
                  }
                }}
              >
                <div className="flex-1 flex items-center justify-end px-2 sm:px-3">
                  <span className="text-[10px] sm:text-xs font-black text-teal-200 group-hover:text-white transition-colors select-none text-right flex flex-col leading-tight">
                    <span>التجويد</span>
                    {isTestMode ? <span className="text-[9px] text-teal-400">({testDeductions.tajweed}-)</span> : <span className="text-[9px] text-teal-300/80">(0.5)</span>}
                  </span>
                </div>
                <div className="px-1.5 sm:px-2 flex items-center justify-center">
                  <div className="w-10 sm:w-12 h-7 sm:h-8 rounded-full bg-gray-900 border-2 border-teal-400 flex items-center justify-center overflow-hidden">
                    <input 
                      onClick={(e) => e.stopPropagation()}
                      type="number" 
                      min="0" 
                      value={sardGroupMode && selectedGroupStudentId ? (sardGroupErrors[selectedGroupStudentId]?.tajweed === 0 || !sardGroupErrors[selectedGroupStudentId] ? '' : sardGroupErrors[selectedGroupStudentId].tajweed) : (evalTajweed === 0 ? '' : evalTajweed)} 
                      placeholder="0"
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value));
                        if (sardGroupMode && selectedGroupStudentId && setSardGroupErrors) {
                          setSardGroupErrors(prev => ({
                            ...prev,
                            [selectedGroupStudentId]: {
                              ...(prev[selectedGroupStudentId] || { fath: 0, tashkeel: 0, tajweed: 0 }),
                              tajweed: val
                            }
                          }));
                        } else if (setEvalTajweed) {
                          setEvalTajweed(val);
                        }
                      }} 
                      onFocus={e => e.target.select()} 
                      className="w-full h-full text-center text-sm sm:text-base font-black bg-transparent text-teal-200 focus:text-white border-0 border-none outline-none focus:outline-none focus:ring-0 focus:border-0 shadow-none ring-0 p-0 m-0 rounded-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-teal-700 z-10" 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}`;
content = content.replace(targetErrors, replaceErrors);

fs.writeFileSync('components/MushafReaderModal.tsx', content);
