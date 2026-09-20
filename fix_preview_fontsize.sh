#!/bin/bash
sed -i 's/fontSize: `\${(config.nameFontSize \* 0.35277 \/ config.width) \* 100}cqw`/fontSize: `\${(config.nameFontSize \* 0.35277 \/ (config.unit === '\''cm'\'' ? config.width \* 10 : config.unit === '\''in'\'' ? config.width \* 25.4 : config.width)) \* 100}cqw`/' components/CardsManager.tsx
