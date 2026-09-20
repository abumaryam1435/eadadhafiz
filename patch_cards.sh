#!/bin/bash
sed -i 's/nameX: 27.5,/nameX: 42.5,/' components/CardsManager.tsx
sed -i 's/nameY: 45,/nameY: 35,/' components/CardsManager.tsx
sed -i 's/nameBold: false,/nameBold: true,/' components/CardsManager.tsx
sed -i 's/width: 55,/width: 85,/' components/CardsManager.tsx
sed -i 's/height: 90,/height: 54,/' components/CardsManager.tsx
