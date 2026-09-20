#!/bin/bash
cat << 'INNER_EOF' > replacement.txt
                    <div>
                        {activeTab === 'students' && stages.length > 0 && (
                            <div className="mb-4">
                                <FilterItem 
                                    id="stages" 
                                    title="تصفية وتمييز بالألوان حسب المرحلة الدراسية"
                                    options={stages.map(s => ({ id: s, name: s }))}
                                    selectedValues={selectedStage}
                                    onSelect={setSelectedStage}
                                    search={search}
                                    setSearch={setSearch}
                                    openDropdown={openDropdown}
                                    setOpenDropdown={setOpenDropdown}
                                    showColorPicker={true}
                                    colorMap={stageColors}
                                    onColorChange={handleStageColorChange}
                                />
                            </div>
                        )}
                        <FilterItem 
                            id="targets" 
INNER_EOF

# Remove from '<div>' under 'lg:col-span-1' down to 'id="targets"'
sed -i -e '/<div className="lg:col-span-1 space-y-6/,/id="targets"/c\                <div className="lg:col-span-1 space-y-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">\n'"$(sed 's/$/\\/g' replacement.txt | sed '$s/\\//')" components/CardsManager.tsx

