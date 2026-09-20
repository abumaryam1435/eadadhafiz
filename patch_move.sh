#!/bin/bash
sed -i 's/Math.min(297, prev.nameX + dx)/Math.min(prev.width, prev.nameX + dx)/' components/CardsManager.tsx
sed -i 's/Math.min(210, prev.nameY + dy)/Math.min(prev.height, prev.nameY + dy)/' components/CardsManager.tsx
