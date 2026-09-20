sed -i 's/<button onClick={() => setShowPermissionsModal(true)}/<button onClick={() => setShowPermissionsModal(true)}/g' components/SupervisorSuggestionsView.tsx

# Replace the button markup
sed -i 's/<button/\{!isTeacher \&\& (<button/g' components/SupervisorSuggestionsView.tsx
