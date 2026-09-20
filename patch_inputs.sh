#!/bin/bash
sed -i 's/onChange={e => setConfig(p => ({\.\.\.p, width: Number(e.target.value)}))}/onChange={e => setConfig(p => ({\.\.\.p, width: Number(e.target.value)}))}\n                                        onFocus={e => e.target.select()}/' components/CardsManager.tsx
sed -i 's/onChange={e => setConfig(p => ({\.\.\.p, height: Number(e.target.value)}))}/onChange={e => setConfig(p => ({\.\.\.p, height: Number(e.target.value)}))}\n                                        onFocus={e => e.target.select()}/' components/CardsManager.tsx
