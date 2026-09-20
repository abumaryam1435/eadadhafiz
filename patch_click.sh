#!/bin/bash
sed -i 's/const a4Width = 297;/const a4Width = config.width;/' components/CardsManager.tsx
sed -i 's/const a4Height = 210;/const a4Height = config.height;/' components/CardsManager.tsx
