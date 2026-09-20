awk '
BEGIN { early_return = 0; }
/^[[:space:]]*if \([^)]+\)[[:space:]]*return[^;]*;/ { early_return = NR; }
/use[A-Z]/ { if (early_return > 0) print FILENAME ":" NR " Hook called after return at line " early_return ": " $0; }
/export const/ { early_return = 0; }
/export function/ { early_return = 0; }
/const [A-Z].*=> {/ { early_return = 0; }
' components/EvaluationEditForm.tsx
