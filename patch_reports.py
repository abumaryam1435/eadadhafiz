import re

with open("components/ReportsTable.tsx", "r") as f:
    content = f.read()

content = content.replace(
    "{ key: 'oldMemorizedPagesStr', label: 'الحفظ القديم' },",
    "{ key: 'oldMemorizedPagesStr', label: subjectFilter === 'mutoon' ? 'الأبيات السابقة' : 'الحفظ القديم' },"
)

content = content.replace(
    "{ key: 'newMemorizedPagesStr', label: 'الحفظ الجديد' },",
    "{ key: 'newMemorizedPagesStr', label: subjectFilter === 'mutoon' ? 'الأبيات المضافة' : 'الحفظ الجديد' },"
)

with open("components/ReportsTable.tsx", "w") as f:
    f.write(content)
