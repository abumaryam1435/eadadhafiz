#!/bin/bash
sed -i 's/aspectRatio: '\''297\/210'\''/aspectRatio: `${config.width}\/${config.height}`/' components/CardsManager.tsx
sed -i 's/top: `${(config.nameY \/ 210) \* 100}%`/top: `${(config.nameY \/ config.height) \* 100}%`/' components/CardsManager.tsx
sed -i 's/((297 - config.nameX) \/ 297)/((config.width - config.nameX) \/ config.width)/' components/CardsManager.tsx
sed -i 's/(config.nameX \/ 297)/(config.nameX \/ config.width)/g' components/CardsManager.tsx
sed -i 's/config.nameFontSize \* 0.35277 \/ 297/config.nameFontSize \* 0.35277 \/ config.width/' components/CardsManager.tsx
