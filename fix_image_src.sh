#!/bin/bash
cat << 'INNER_EOF' > replacement.txt
                        <div className="relative w-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-crosshair" style={{ aspectRatio: \`\${config.width}/\${config.height}\`, containerType: 'inline-size' }} onClick={handleImageClick}>
                            {(config.templateImage || dynamicPreviewUrl) && (
                                <img ref={imageRef} src={config.templateImage || dynamicPreviewUrl} alt="Template" className="w-full h-full object-fill pointer-events-none" />
                            )}
INNER_EOF
sed -i -e '/<div className="relative w-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-crosshair"/,/<\/div>/!b' -e '/<img ref={imageRef}/c\                            {(config.templateImage || dynamicPreviewUrl) && (\n                                <img ref={imageRef} src={config.templateImage || dynamicPreviewUrl} alt="Template" className="w-full h-full object-fill pointer-events-none" />\n                            )}' components/CardsManager.tsx
