for file in $(find components -name "*.tsx" -o -name "*.ts"); do
    awk '
    BEGIN { early_return = 0; }
    /^[[:space:]]*if \([^)]+\) return/ { early_return = NR; }
    /use[A-Z]/ { if (early_return > 0) print FILENAME ":" NR " Hook called after return at line " early_return ": " $0; }
    /export const/ { early_return = 0; }
    /export function/ { early_return = 0; }
    /const [A-Z].*=> {/ { early_return = 0; }
    ' "$file"
done
