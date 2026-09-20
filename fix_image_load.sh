#!/bin/bash
cat << 'INNER_EOF' > replacement.txt
                const img = new Image();
                img.crossOrigin = "anonymous";
                if (config.templateImage) {
                    img.src = config.templateImage;
                    await new Promise((resolve) => {
                        img.onload = resolve;
                        img.onerror = resolve; // don't reject, just fallback
                    });
                }
INNER_EOF

sed -i -e '/const img = new Image();/,/});/c\' -e "$(sed 's/$/\\/g' replacement.txt | sed '$s/\\//')" components/CardsManager.tsx

