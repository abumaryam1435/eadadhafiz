#!/bin/bash

# Remove the {config.templateImage ? ( ... and its closing parts.
sed -i 's/{config.templateImage ? (//g' components/CardsManager.tsx

cat << 'INNER_EOF' > new_img.txt
                            <div className="relative w-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-crosshair" style={{ aspectRatio: `${config.width}/${config.height}`, containerType: 'inline-size' }} onClick={handleImageClick}>
                                <img ref={imageRef} src={config.templateImage || dynamicPreviewUrl} alt="Template" className="w-full h-full object-fill pointer-events-none" />
INNER_EOF

# Replace the img tag line and its wrapper div
sed -i -e '/<div className="relative w-full bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-crosshair"/,/<\/div>/!b' -e '/<img ref={imageRef}/c\                                <img ref={imageRef} src={config.templateImage || dynamicPreviewUrl} alt="Template" className="w-full h-full object-fill pointer-events-none" />' components/CardsManager.tsx

