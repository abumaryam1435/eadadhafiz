#!/bin/bash
cat << 'INNER_EOF' > new_options.txt
    const options = useMemo(() => {
        if (activeTab === 'students') {
            let result = students;
            if (selectedStage !== 'all') {
                result = result.filter(s => s.schoolStage?.trim() === selectedStage);
            }
            return result.map(s => ({ id: s.id, name: s.name }));
        } else if (activeTab === 'teachers') {
            return users.filter(u => u.role === UserRole.TEACHER).map(t => ({ id: t.id, name: t.name }));
        } else {
            return excelData;
        }
    }, [activeTab, students, users, excelData, selectedStage]);
INNER_EOF

# Replace the options useMemo
sed -i -e '/const options = useMemo(() => {/,/}, \[activeTab, students, users, excelData, testsSummaryFilteredData, selectedStage\]);/c\' -e "$(sed 's/$/\\/g' new_options.txt | sed '$s/\\//')" components/CardsManager.tsx

