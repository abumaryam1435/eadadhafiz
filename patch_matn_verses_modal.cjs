const fs = require('fs');
let content = fs.readFileSync('components/MatnVersesModal.tsx', 'utf-8');

content = content.replace(
  '  toVerse?: number | string | null;\n  matns: Matn[];\n}',
  '  toVerse?: number | string | null;\n  prevFromVerse?: number;\n  prevToVerse?: number;\n  matns: Matn[];\n}'
);

content = content.replace(
  '  toVerse,\n  matns,\n}) => {',
  '  toVerse,\n  prevFromVerse,\n  prevToVerse,\n  matns,\n}) => {'
);

content = content.replace(
  '  const numTo = Number(toVerse) || (rawVersesList.length > 0 ? rawVersesList.length : Number(fromVerse) || 1);',
  `  const numTo = Number(toVerse) || (rawVersesList.length > 0 ? rawVersesList.length : Number(fromVerse) || 1);
  
  const displayFrom = prevFromVerse ? Math.min(numFrom, prevFromVerse) : numFrom;
  const displayTo = prevToVerse ? Math.max(numTo, prevToVerse) : numTo;`
);

content = content.replace(
  '      rangeFrom: numFrom,\n      rangeTo: numTo,\n    });\n  }, [rawVersesList, enableTatweel, numFrom, numTo]);',
  '      rangeFrom: numFrom,\n      rangeTo: numTo,\n      prevRangeFrom: prevFromVerse,\n      prevRangeTo: prevToVerse\n    });\n  }, [rawVersesList, enableTatweel, numFrom, numTo, prevFromVerse, prevToVerse, displayFrom, displayTo]);'
);

content = content.replace(
  '    if (viewMode === \'range\' && numFrom > 0 && numTo >= numFrom) {\n      list = list.filter(v => v.inRange);\n    }',
  `    if (viewMode === 'range' && displayFrom > 0 && displayTo >= displayFrom) {
      list = list.filter(v => v.inRange || v.isPrevRange);
    }`
);

content = content.replace(
  '                  isHighlighted={v.inRange}\n                  layoutMode={layoutMode}',
  '                  isHighlighted={v.inRange}\n                  isPrevRange={v.isPrevRange}\n                  layoutMode={layoutMode}'
);

fs.writeFileSync('components/MatnVersesModal.tsx', content, 'utf-8');
