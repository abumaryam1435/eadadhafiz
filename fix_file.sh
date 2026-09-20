#!/bin/bash
# First, remove everything from line 526 to the end.
sed -i '526,$d' components/CardsManager.tsx

cat << 'INNER_EOF' >> components/CardsManager.tsx
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-800 dark:text-gray-200">معاينة البطاقة</h4>
                            <p className="text-sm text-gray-500">انقر على الصورة لتحديد مكان طباعة الاسم</p>
                        </div>
                        <div className="flex gap-2">
                            <label className="cursor-pointer bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-100 transition-colors text-sm border border-blue-200 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                رفع قالب
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>

                    {config.templateImage ? (
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="mb-4 flex flex-wrap gap-4 items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                <span className="text-sm font-bold text-blue-700 dark:text-blue-300 ml-2">مقاس البطاقة:</span>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">العرض:</label>
                                    <input
                                        type="number"
                                        value={config.width}
                                        onChange={e => setConfig(p => ({...p, width: Number(e.target.value)}))}
                                        onFocus={e => e.target.select()}
                                        className="w-16 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">الطول:</label>
                                    <input
                                        type="number"
                                        value={config.height}
                                        onChange={e => setConfig(p => ({...p, height: Number(e.target.value)}))}
                                        onFocus={e => e.target.select()}
                                        className="w-16 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">الوحدة:</label>
                                    <select
                                        value={config.unit}
                                        onChange={e => setConfig(p => ({...p, unit: e.target.value as any}))}
                                        className="p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        <option value="cm">سم</option>
                                        <option value="mm">مم</option>
                                        <option value="in">بوصة</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mb-4 flex flex-wrap gap-4 items-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                <span className="text-sm font-bold text-gray-600 dark:text-gray-400 ml-2">تنسيق الاسم:</span>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">حجم الخط:</label>
                                    <input
                                         type="number"
                                         value={config.nameFontSize}
                                         onChange={e => setConfig(p => ({...p, nameFontSize: Number(e.target.value)}))}
                                        onFocus={e => e.target.select()}
                                        className="w-16 p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div className="flex items-center gap-2 relative">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">اللون:</label>
                                    <button 
                                        onClick={() => setShowColorPicker(!showColorPicker)}
                                        className="w-8 h-8 rounded border border-gray-300 shadow-sm"
                                        style={{ backgroundColor: config.nameColor }}
                                    />
                                    {showColorPicker && (
                                        <div className="absolute z-50 top-full mt-2 right-0">
                                            <div className="fixed inset-0" onClick={() => setShowColorPicker(false)} />
                                            <div className="relative z-50 shadow-xl rounded-xl overflow-hidden border border-gray-200">
                                                <HexColorPicker color={config.nameColor} onChange={(c) => setConfig(p => ({...p, nameColor: c}))} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">نوع الخط:</label>
                                    <select 
                                        value={config.nameFontFamily} 
                                        onChange={e => setConfig(p => ({...p, nameFontFamily: e.target.value}))}
                                        className="p-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        <option value="'Amiri', serif">أميري</option>
                                        <option value="'Cairo', sans-serif">كايرو</option>
                                        <option value="'Tajawal', sans-serif">تجوال</option>
                                        <option value="'Almarai', sans-serif">المراعي</option>
                                        <option value="'Changa', sans-serif">شانجا</option>
                                        <option value="'Reem Kufi', sans-serif">ريم كوفي</option>
                                        <option value="Arial, sans-serif">Arial</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-3">
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameBold: !p.nameBold}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameBold ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="عريض"
                                    >
                                        <span className="font-bold">B</span>
                                    </button>
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameItalic: !p.nameItalic}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameItalic ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="مائل"
                                    >
                                        <span className="italic font-serif">I</span>
                                    </button>
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameUnderline: !p.nameUnderline}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameUnderline ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="تسطير"
                                    >
                                        <span className="underline">U</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-3">
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameAlign: 'right'}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameAlign === 'right' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="محاذاة لليمين"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameAlign: 'center'}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameAlign === 'center' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="توسيط"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => setConfig(p => ({...p, nameAlign: 'left'}))}
                                        className={`w-8 h-8 flex items-center justify-center rounded ${config.nameAlign === 'left' ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                        title="محاذاة لليسار"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M10 18h10" /></svg>
                                    </button>
                                </div>
                                <div className="flex items-center gap-1 border-r border-gray-300 dark:border-gray-600 pr-3">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400 ml-1">الموضع:</label>
                                    <div className="grid grid-cols-3 gap-0.5">
                                        <div />
                                        <button onClick={() => movePosition(0, -0.5)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200" title="أعلى">↑</button>
                                        <div />
                                        <button onClick={() => movePosition(0.5, 0)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200" title="يمين">→</button>
                                        <button onClick={() => movePosition(0, 0.5)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200" title="أسفل">↓</button>
                                        <button onClick={() => movePosition(-0.5, 0)} className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200" title="يسار">←</button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mb-4 flex flex-wrap gap-2">
                                <span className="text-sm font-bold text-gray-600 dark:text-gray-400 ml-2">انقر على الصورة لتحديد مكان طباعة الاسم</span>
                            </div>

                            <div className="relative w-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-crosshair" style={{ aspectRatio: `${config.width}/${config.height}`, containerType: 'inline-size' }} onClick={handleImageClick}>
                                <img ref={imageRef} src={config.templateImage} alt="Template" className="w-full h-full object-fill pointer-events-none" />
                                
                                <div 
                                    className="absolute pointer-events-none z-10 ring-1 ring-red-500/50"
                                    style={{
                                        top: `${(config.nameY / config.height) * 100}%`,
                                        ...(config.nameAlign === 'right' ? { right: `${((config.width - config.nameX) / config.width) * 100}%`, transform: 'translateY(-50%)' } : 
                                            config.nameAlign === 'left' ? { left: `${(config.nameX / config.width) * 100}%`, transform: 'translateY(-50%)' } : 
                                            { left: `${(config.nameX / config.width) * 100}%`, transform: 'translate(-50%, -50%)' }),
                                        color: config.nameColor,
                                        fontSize: `${(config.nameFontSize * 0.35277 / (config.unit === 'cm' ? config.width * 10 : config.unit === 'in' ? config.width * 25.4 : config.width)) * 100}cqw`,
                                        lineHeight: 1,
                                        whiteSpace: 'nowrap',
                                        fontFamily: config.nameFontFamily,
                                        fontWeight: config.nameBold ? 'bold' : 'normal',
                                        fontStyle: config.nameItalic ? 'italic' : 'normal',
                                        textDecoration: config.nameUnderline ? 'underline' : 'none',
                                        direction: 'rtl'
                                    }}
                                >
                                    {options.length > 0 ? options[previewIndex]?.name : 'الاسم للتجربة'}
                                    
                                    {config.nameUnderline && (
                                        <div 
                                            className="absolute bottom-[-20%] h-[10%] bg-current" 
                                            style={{ 
                                                width: '100%',
                                                ...(config.nameAlign === 'right' ? { right: 0 } : 
                                                    config.nameAlign === 'left' ? { left: 0 } : 
                                                    { left: '50%', transform: 'translateX(-50%)' })
                                            }} 
                                        />
                                    )}
                                </div>
                                <div className="absolute w-2 h-2 bg-red-500 rounded-full" style={{
                                        top: `${(config.nameY / config.height) * 100}%`,
                                        ...(config.nameAlign === 'right' ? { right: `${((config.width - config.nameX) / config.width) * 100}%`, transform: 'translate(50%, -50%)' } : 
                                            config.nameAlign === 'left' ? { left: `${(config.nameX / config.width) * 100}%`, transform: 'translate(-50%, -50%)' } : 
                                            { left: `${(config.nameX / config.width) * 100}%`, transform: 'translate(-50%, -50%)' })
                                }}></div>
                            </div>
                            
                            <div className="mt-4 flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded-lg border border-gray-100 dark:border-gray-600">
                                <button 
                                    onClick={() => setPreviewIndex(p => Math.max(0, p - 1))}
                                    disabled={previewIndex === 0}
                                    className="p-2 text-gray-500 hover:text-green-600 disabled:opacity-50"
                                >
                                    السابق
                                </button>
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                    معاينة: {previewIndex + 1} / {Math.max(1, options.length)}
                                </span>
                                <button 
                                    onClick={() => setPreviewIndex(p => Math.min(options.length - 1, p + 1))}
                                    disabled={previewIndex >= options.length - 1}
                                    className="p-2 text-gray-500 hover:text-green-600 disabled:opacity-50"
                                >
                                    التالي
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <h4 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">لا يوجد قالب حالياً</h4>
                            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">قم برفع صورة فارغة لقالب البطاقة للبدء بتخصيصها</p>
                            <label className="cursor-pointer inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm">
                                اختيار صورة
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
INNER_EOF
