#!/bin/bash
cat << 'INNER_EOF' > new_functions.txt
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    setConfig(p => ({...p, templateImage: event.target?.result as string}));
                }
                if (event.target?.result) {
                    img.src = event.target.result as string;
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const XLSX = await import('xlsx');
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
                    
                    const names: {id: string, name: string}[] = [];
                    for (let i = 0; i < json.length; i++) {
                        const row = json[i];
                        if (row && row.length > 0 && typeof row[0] === 'string') {
                            const name = row[0].trim();
                            if (name && name !== 'الاسم' && name !== 'Name') {
                                names.push({ id: `excel_${i}`, name });
                            }
                        }
                    }
                    
                    if (names.length > 0) {
                        setExcelData(names);
                        showToast(`✅ تم استيراد ${names.length} اسم بنجاح`);
                    } else {
                        showToast('⚠️ لم يتم العثور على أسماء في العمود الأول');
                    }
                } catch (error) {
                    console.error('Error parsing Excel:', error);
                    showToast('❌ حدث خطأ أثناء قراءة ملف الإكسل');
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };
INNER_EOF

# Replace from `const handleImageUpload = ` to `reader.readAsArrayBuffer(file);    };`
sed -i -e '/const handleImageUpload = /,/reader.readAsArrayBuffer(file);    };/c\' -e "$(sed 's/$/\\/g' new_functions.txt | sed '$s/\\//')" components/CardsManager.tsx

