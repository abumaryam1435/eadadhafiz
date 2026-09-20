#!/bin/bash
sed -i '/<div className="pt-4 border-t border-gray-100 dark:border-gray-700">/a \
                        <div className="mb-4">\
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">طريقة التصدير:<\/label>\
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">\
                                <button \
                                    onClick={() => setExportMode('\''a4'\'')}\
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${exportMode === '\''a4'\'' ? '\''bg-white dark:bg-gray-700 shadow text-green-700 dark:text-green-300'\'' : '\''text-gray-500 hover:text-gray-700 dark:text-gray-400'\''}`}\
                                >\
                                    ورق A4\
                                <\/button>\
                                <button \
                                    onClick={() => setExportMode('\''a3'\'')}\
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${exportMode === '\''a3'\'' ? '\''bg-white dark:bg-gray-700 shadow text-green-700 dark:text-green-300'\'' : '\''text-gray-500 hover:text-gray-700 dark:text-gray-400'\''}`}\
                                >\
                                    ورق A3\
                                <\/button>\
                                <button \
                                    onClick={() => setExportMode('\''single'\'')}\
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${exportMode === '\''single'\'' ? '\''bg-white dark:bg-gray-700 shadow text-green-700 dark:text-green-300'\'' : '\''text-gray-500 hover:text-gray-700 dark:text-gray-400'\''}`}\
                                >\
                                    كل بطاقة بصفحة\
                                <\/button>\
                            <\/div>\
                        <\/div>' components/CardsManager.tsx
