#!/bin/bash
cat << 'INNER_EOF' > new_filter.txt
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
INNER_EOF

# Replace the old stage filter UI
sed -i -e '/<div className="mb-4">/,/<\/div>/c\' -e "$(sed 's/$/\\/g' new_filter.txt | sed '$s/\\//')" components/CardsManager.tsx

