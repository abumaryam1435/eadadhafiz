#!/bin/bash
cat << 'INNER_EOF' > temp.tsx
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    
                    // Max dimension to prevent huge files
                    const MAX_DIM = 3000;
                    let w = img.width;
                    let h = img.height;
                    if (w > MAX_DIM || h > MAX_DIM) {
                        if (w > h) {
                            h = Math.round((h * MAX_DIM) / w);
                            w = MAX_DIM;
                        } else {
                            w = Math.round((w * MAX_DIM) / h);
                            h = MAX_DIM;
                        }
                    }

                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                        setConfig(prev => ({ ...prev, templateImage: dataUrl }));
                    }
                };
INNER_EOF

# Replace lines 113 to 127 in components/CardsManager.tsx
sed -i -e '/img.onload = () => {/,/};/c\' -e "$(sed 's/$/\\/g' temp.tsx | sed '$s/\\//')" components/CardsManager.tsx
