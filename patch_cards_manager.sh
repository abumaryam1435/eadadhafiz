#!/bin/bash

# 1. Add stageColors, appLogo, dynamicPreviewUrl
sed -i '/const \[excelData, setExcelData\] = useState/a \    const [stageColors, setStageColors] = useState<Record<string, string>>({});\n    const [appLogo, setAppLogo] = useState<HTMLImageElement | null>(null);\n    const [dynamicPreviewUrl, setDynamicPreviewUrl] = useState<string>('"''"');' components/CardsManager.tsx

# 2. Add effect to load logo and stageColors
sed -i '/const \[showColorPicker, setShowColorPicker\] = useState/a \    useEffect(() => {\n        const saved = localStorage.getItem('\''stageColors'\'');\n        if (saved) {\n            try { setStageColors(JSON.parse(saved)); } catch(e) {}\n        }\n        const i = new Image();\n        i.src = '\''/logo.png'\'';\n        i.onload = () => setAppLogo(i);\n    }, []);\n\n    const handleStageColorChange = (stage: string, color: string | null) => {\n        setStageColors(prev => {\n            const newColors = { ...prev };\n            if (color) newColors[stage] = color;\n            else delete newColors[stage];\n            localStorage.setItem('\''stageColors'\'', JSON.stringify(newColors));\n            return newColors;\n        });\n    };' components/CardsManager.tsx

