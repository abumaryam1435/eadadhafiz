#!/bin/bash
sed -i 's/}, \[activeTab\]);/}, \[activeTab, selectedStage\]);/' components/CardsManager.tsx
