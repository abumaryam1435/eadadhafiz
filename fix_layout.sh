#!/bin/bash
cat << 'INNER_EOF' > replacement.txt
                    if (exportMode === 'single') {
                        if (i > 0) doc.addPage([cardWidthMM, cardHeightMM], 'portrait');
                        doc.addImage(imgData, 'JPEG', 0, 0, cardWidthMM, cardHeightMM);
                    } else {
                        // If current X + card width exceeds the page width, move to next row
                        if (currentX + cardWidthMM > docWidth - marginX + 0.1) {
                             currentX = marginX;
                             currentY += cardHeightMM;
                        }
                        
                        // If current Y + card height exceeds the page height, move to next page
                        if (currentY + cardHeightMM > docHeight - marginY + 0.1) {
                             doc.addPage(docFormat, 'portrait');
                             currentX = marginX;
                             currentY = marginY;
                        }
                        
                        doc.addImage(imgData, 'JPEG', currentX, currentY, cardWidthMM, cardHeightMM);
                        
                        // Advance X for next card
                        currentX += cardWidthMM;
                    }
INNER_EOF

# Extract before the replacement
sed -n '1,343p' components/CardsManager.tsx > temp.tsx

# Append the replacement
cat replacement.txt >> temp.tsx

# Extract after the replacement
sed -n '376,$p' components/CardsManager.tsx >> temp.tsx

mv temp.tsx components/CardsManager.tsx
