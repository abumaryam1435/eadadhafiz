#!/bin/bash
sed -i 's/nameX: 5,/nameX: 22.5,/' components/CardsManager.tsx
sed -i 's/nameY: 5,/nameY: 45,/' components/CardsManager.tsx
sed -i 's/width: 8.5,/width: 45,/' components/CardsManager.tsx
sed -i 's/height: 5.5,/height: 90,/' components/CardsManager.tsx
sed -i 's/unit: '\'cm\''/unit: '\'mm\''/' components/CardsManager.tsx
