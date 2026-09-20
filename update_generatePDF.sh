#!/bin/bash

# Extract before generatePDF
sed -n '1,192p' components/CardsManager.tsx > temp1.tsx

# Our new generatePDF
cat << 'INNER_EOF' >> temp1.tsx
    const generatePDF = async () => {
        if (!config.templateImage) {
            showToast('⚠️ يرجى رفع قالب البطاقة أولاً');
            return;
        }

        let targets: any[] = [];
        if (selectedIds.includes('ALL') || selectedIds.length === 0) {
            targets = options;
        } else {
            targets = options.filter(o => selectedIds.includes(String(o.id)));
        }

        if (targets.length === 0) {
            showToast('⚠️ لا يوجد أشخاص محددين لإصدار البطاقات لهم');
            return;
        }

        setIsGenerating(true);
        showToast('⏳ جاري إنشاء البطاقات، يرجى الانتظار...');

        setTimeout(async () => {
            try {
                await document.fonts.ready;
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = config.templateImage;

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                // Calculate dimensions in mm
                let cardWidthMM = config.width;
                let cardHeightMM = config.height;
                if (config.unit === 'cm') {
                    cardWidthMM = config.width * 10;
                    cardHeightMM = config.height * 10;
                } else if (config.unit === 'in') {
                    cardWidthMM = config.width * 25.4;
                    cardHeightMM = config.height * 25.4;
                }
                
                // For high quality rendering, we use scale factor of 10
                const canvas = document.createElement('canvas');
                canvas.width = cardWidthMM * 10;
                canvas.height = cardHeightMM * 10;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not create canvas context');

                // Determine document format
                let docFormat = 'a4';
                let docWidth = 210;
                let docHeight = 297;
                if (exportMode === 'a3') {
                    docFormat = 'a3';
                    docWidth = 297;
                    docHeight = 420;
                } else if (exportMode === 'single') {
                    docFormat = [cardWidthMM, cardHeightMM];
                    docWidth = cardWidthMM;
                    docHeight = cardHeightMM;
                }

                // If format is standard, we use portrait layout always
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: docFormat,
                    compress: true
                });

                let currentX = 0;
                let currentY = 0;
                const marginX = 10; // 10mm margins for a4/a3
                const marginY = 10;
                let firstPage = true;

                if (exportMode === 'a4' || exportMode === 'a3') {
                    currentX = marginX;
                    currentY = marginY;
                }

                for (let i = 0; i < targets.length; i++) {
                    const target = targets[i];
                    
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Re-calculate font size relative to height for scaling
                    // Previous formula assumed 210mm height = 2100px. 
                    // config.nameFontSize was points for A4 height.
                    // To keep it simple, we use the raw fontSize * 3.5277 relative to canvas size.
                    const fontSizePx = config.nameFontSize * 3.5277;
                    
                    ctx.font = `${config.nameItalic ? 'italic ' : ''}${config.nameBold ? 'bold ' : ''}${fontSizePx}px ${config.nameFontFamily}`;
                    ctx.fillStyle = config.nameColor;
                    ctx.textAlign = config.nameAlign;
                    ctx.textBaseline = 'middle';
                    ctx.direction = 'rtl';

                    // X,Y are in percentages or mm? Previous code assumed mm out of 297x210.
                    // Let's adapt it to percentage based on the preview
                    // nameX is 0 to 297 in UI (for A4). We map it to canvas width
                    const x = (config.nameX / 297) * canvas.width;
                    const y = (config.nameY / 210) * canvas.height;
                    
                    ctx.fillText(target.name, x, y);

                    if (config.nameUnderline) {
                        const metrics = ctx.measureText(target.name);
                        const textWidth = metrics.width;
                        const lineY = y + (fontSizePx * 0.4);
                        
                        ctx.beginPath();
                        ctx.strokeStyle = config.nameColor;
                        ctx.lineWidth = fontSizePx * 0.05;
                        
                        let lineStartX = x;
                        if (config.nameAlign === 'center') {
                            lineStartX = x + (textWidth / 2);
                        } else if (config.nameAlign === 'left') {
                            lineStartX = x + textWidth;
                        }
                        
                        ctx.moveTo(lineStartX, lineY);
                        ctx.lineTo(lineStartX - textWidth, lineY);
                        ctx.stroke();
                    }

                    const imgData = canvas.toDataURL('image/jpeg', 0.95);

                    if (exportMode === 'single') {
                        if (i > 0) doc.addPage([cardWidthMM, cardHeightMM], 'portrait');
                        doc.addImage(imgData, 'JPEG', 0, 0, cardWidthMM, cardHeightMM);
                    } else {
                        // Check if we need a new page
                        if (currentY + cardHeightMM > docHeight - marginY) {
                            // Check if we can move to next column
                            if (currentX + cardWidthMM * 2 <= docWidth - marginX) {
                                currentX += cardWidthMM;
                                currentY = marginY;
                            } else {
                                doc.addPage(docFormat, 'portrait');
                                currentX = marginX;
                                currentY = marginY;
                            }
                        }

                        // Also check column width
                        if (currentX + cardWidthMM > docWidth - marginX) {
                             currentX = marginX;
                             currentY += cardHeightMM;
                             if (currentY + cardHeightMM > docHeight - marginY) {
                                  doc.addPage(docFormat, 'portrait');
                                  currentX = marginX;
                                  currentY = marginY;
                             }
                        }
                        
                        doc.addImage(imgData, 'JPEG', currentX, currentY, cardWidthMM, cardHeightMM);
                        
                        // Advance X for next card
                        currentX += cardWidthMM;
                        // Check if we exceeded column
                        if (currentX + cardWidthMM > docWidth - marginX) {
                             currentX = marginX;
                             currentY += cardHeightMM;
                        }
                    }
                }

                doc.save(`بطاقات_${activeTab === 'students' ? 'الطلاب' : activeTab === 'teachers' ? 'المعلمين' : 'مخصصة'}.pdf`);
                showToast('✅ تم تصدير البطاقات بنجاح');
            } catch (error) {
                console.error('Error generating PDF:', error);
                showToast('❌ حدث خطأ أثناء إنشاء البطاقات');
            } finally {
                setIsGenerating(false);
            }
        }, 100);
    };
INNER_EOF

# Extract after generatePDF
sed -n '298,$p' components/CardsManager.tsx >> temp1.tsx

mv temp1.tsx components/CardsManager.tsx
