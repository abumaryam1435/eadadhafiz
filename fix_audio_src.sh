#!/bin/bash
sed -i 's/src={s.audioUrl}/src={s.audioUrl || undefined}/g' components/SupervisorSuggestionsView.tsx
sed -i 's/src={s.audioUrl}/src={s.audioUrl || undefined}/g' components/SuggestionsModal.tsx
