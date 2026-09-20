#!/bin/bash
cat << 'INNER_EOF' > replacement_text.txt
                    const x = (config.nameX / config.width) * canvas.width;
                    const y = (config.nameY / config.height) * canvas.height;
                    
                    const maxTextWidth = canvas.width * 0.85;

                    ctx.fillText(target.name, x, y, maxTextWidth);

                    if (config.nameUnderline) {
                        const metrics = ctx.measureText(target.name);
                        const textWidth = Math.min(metrics.width, maxTextWidth);
                        const lineY = y + (fontSizePx * 0.4);
                        
                        ctx.beginPath();
                        ctx.strokeStyle = config.nameColor;
                        ctx.lineWidth = Math.max(1, fontSizePx * 0.05);
                        
                        let lineStartX = x;
                        if (config.nameAlign === 'center') {
                            lineStartX = x - (textWidth / 2);
                        } else if (config.nameAlign === 'left') {
                            lineStartX = x;
                        } else if (config.nameAlign === 'right') {
                            lineStartX = x - textWidth;
                        }
                        
                        ctx.moveTo(lineStartX, lineY);
                        ctx.lineTo(lineStartX + textWidth, lineY);
                        ctx.stroke();
                    }
INNER_EOF

sed -i -e '/const x = (config.nameX \/ config.width) \* canvas.width;/,/ctx.stroke();\n                    }/c\
                    const x = (config.nameX / config.width) * canvas.width;\
                    const y = (config.nameY / config.height) * canvas.height;\
                    \
                    const maxTextWidth = canvas.width * 0.85;\
\
                    ctx.fillText(target.name, x, y, maxTextWidth);\
\
                    if (config.nameUnderline) {\
                        const metrics = ctx.measureText(target.name);\
                        const textWidth = Math.min(metrics.width, maxTextWidth);\
                        const lineY = y + (fontSizePx * 0.4);\
                        \
                        ctx.beginPath();\
                        ctx.strokeStyle = config.nameColor;\
                        ctx.lineWidth = Math.max(1, fontSizePx * 0.05);\
                        \
                        let lineStartX = x;\
                        if (config.nameAlign === '"'"'center'"'"') {\
                            lineStartX = x - (textWidth / 2);\
                        } else if (config.nameAlign === '"'"'left'"'"') {\
                            lineStartX = x;\
                        } else if (config.nameAlign === '"'"'right'"'"') {\
                            lineStartX = x - textWidth;\
                        }\
                        \
                        ctx.moveTo(lineStartX, lineY);\
                        ctx.lineTo(lineStartX + textWidth, lineY);\
                        ctx.stroke();\
                    }' components/CardsManager.tsx

