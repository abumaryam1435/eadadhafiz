#!/bin/bash
cat << 'INNER_EOF' > replacement_logo.txt
                        if (appLogo) {
                            const logoSize = Math.min(canvas.width, canvas.height) * 0.35;
                            const logoX = (canvas.width - logoSize) / 2;
                            const logoY = canvas.height * 0.08;
                            
                            ctx.save();
                            ctx.beginPath();
                            ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
                            ctx.closePath();
                            ctx.clip();
                            ctx.drawImage(appLogo, logoX, logoY, logoSize, logoSize);
                            ctx.restore();
                            
                            ctx.font = \`bold \${canvas.height * 0.08}px Amiri, Cairo, sans-serif\`;
                            ctx.fillStyle = '#D4AF37';
                            ctx.textAlign = 'center';
                            ctx.fillText('مشروع إعداد حافظ', canvas.width / 2, logoY + logoSize + canvas.height * 0.1);
                        }
INNER_EOF

# Replace the first occurrence (in useEffect)
sed -i -e '/if (appLogo) {/,/ctx.fillText('\''مشروع إعداد حافظ'\''/c\
                        if (appLogo) {\
                            const logoSize = Math.min(canvas.width, canvas.height) * 0.35;\
                            const logoX = (canvas.width - logoSize) / 2;\
                            const logoY = canvas.height * 0.08;\
                            \
                            ctx.save();\
                            ctx.beginPath();\
                            ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);\
                            ctx.closePath();\
                            ctx.clip();\
                            ctx.drawImage(appLogo, logoX, logoY, logoSize, logoSize);\
                            ctx.restore();\
                            \
                            ctx.font = `bold ${canvas.height * 0.08}px Amiri, Cairo, sans-serif`;\
                            ctx.fillStyle = '"'"'#D4AF37'"'"';\
                            ctx.textAlign = '"'"'center'"'"';\
                            ctx.fillText('"'"'مشروع إعداد حافظ'"'"', canvas.width / 2, logoY + logoSize + canvas.height * 0.12);\
                        }' components/CardsManager.tsx

