#!/bin/bash
cat << 'INNER_EOF' > new_options.txt
    const options = useMemo(() => {
        if (activeTab === 'students') {
            let result = students;
            if (selectedStage && selectedStage.length > 0) {
                result = result.filter(s => s.schoolStage && selectedStage.includes(s.schoolStage.trim()));
            }
            return result.map(s => ({ id: s.id, name: s.name, stage: s.schoolStage?.trim() }));
        } else if (activeTab === 'teachers') {
            return users.filter(u => u.role === UserRole.TEACHER).map(t => ({ id: t.id, name: t.name, stage: null }));
        } else {
            return excelData.map(e => ({...e, stage: null}));
        }
    }, [activeTab, students, users, excelData, selectedStage]);
INNER_EOF

# Replace the options useMemo
sed -i -e '/const options = useMemo(() => {/,/}, \[activeTab, students, users, excelData, selectedStage\]);/c\' -e "$(sed 's/$/\\/g' new_options.txt | sed '$s/\\//')" components/CardsManager.tsx

