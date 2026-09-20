const fs = require('fs');
let content = fs.readFileSync('components/PoeticVerseRow.tsx', 'utf-8');

content = content.replace(
  '  isHighlighted?: boolean;\n  layoutMode?: \'columns\' | \'stacked\';',
  '  isHighlighted?: boolean;\n  isPrevRange?: boolean;\n  layoutMode?: \'columns\' | \'stacked\';'
);

content = content.replace(
  '  isHighlighted = false,\n  layoutMode = \'columns\',',
  '  isHighlighted = false,\n  isPrevRange = false,\n  layoutMode = \'columns\','
);

// We need to replace the style logic.
// There are multiple places where isHighlighted is checked.
function replaceStyle(match, highlightedClass, notHighlightedClass) {
  return `\${isHighlighted ? '${highlightedClass}' : isPrevRange ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/60 shadow-xs ring-1 ring-amber-500/20' : '${notHighlightedClass}'}`;
}

// 1. Container div 1
content = content.replace(
  /className=\{`p-3.5 sm:p-4 rounded-2xl border transition-all \$\{\n\s*isHighlighted\n\s*\? '([^']+)'\n\s*: '([^']+)'\n\s*}`}/,
  (match, hl, nohl) => `className={\`p-3.5 sm:p-4 rounded-2xl border transition-all \${isHighlighted ? '${hl}' : isPrevRange ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/60 shadow-xs ring-1 ring-amber-500/20 text-amber-900 dark:text-amber-100' : '${nohl}'}\`}`
);

// 2. Badge 1
content = content.replace(
  /className=\{`inline-flex items-center justify-center min-w-\[2.2rem\] px-2 py-1 rounded-xl text-xs font-black select-none \$\{\n\s*isHighlighted\n\s*\? '([^']+)'\n\s*: '([^']+)'\n\s*}`}/,
  (match, hl, nohl) => `className={\`inline-flex items-center justify-center min-w-[2.2rem] px-2 py-1 rounded-xl text-xs font-black select-none \${isHighlighted ? '${hl}' : isPrevRange ? 'bg-amber-600 text-white shadow-2xs' : '${nohl}'}\`}`
);

// 3. Container div 2
content = content.replace(
  /className=\{`p-3 sm:p-4 rounded-2xl border transition-all \$\{\n\s*isHighlighted\n\s*\? '([^']+)'\n\s*: '([^']+)'\n\s*}`}/,
  (match, hl, nohl) => `className={\`p-3 sm:p-4 rounded-2xl border transition-all \${isHighlighted ? '${hl}' : isPrevRange ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/60 shadow-xs ring-1 ring-amber-500/20 text-amber-900 dark:text-amber-100' : '${nohl}'}\`}`
);

// 4. Badge 2
content = content.replace(
  /className=\{`inline-flex items-center justify-center min-w-\[2.2rem\] px-2 py-1 rounded-xl text-xs font-black select-none \$\{\n\s*isHighlighted\n\s*\? '([^']+)'\n\s*: '([^']+)'\n\s*}`}/,
  (match, hl, nohl) => `className={\`inline-flex items-center justify-center min-w-[2.2rem] px-2 py-1 rounded-xl text-xs font-black select-none \${isHighlighted ? '${hl}' : isPrevRange ? 'bg-amber-600 text-white shadow-2xs' : '${nohl}'}\`}`
);

// 5. Text color (Sadr and Ajuz)
content = content.replace(
  /isHighlighted \? 'text-gray-900 dark:text-gray-50' : 'text-gray-700 dark:text-gray-300'/g,
  `isHighlighted ? 'text-gray-900 dark:text-gray-50' : isPrevRange ? 'text-amber-900 dark:text-amber-50' : 'text-gray-700 dark:text-gray-300'`
);


fs.writeFileSync('components/PoeticVerseRow.tsx', content, 'utf-8');
