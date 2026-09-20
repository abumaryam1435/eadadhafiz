const fs = require('fs');
let content = fs.readFileSync('utils/poetryUtils.ts', 'utf-8');

content = content.replace(
  '  inRange?: boolean;\n}',
  '  inRange?: boolean;\n  isPrevRange?: boolean;\n}'
);

content = content.replace(
  '    rangeTo?: number;',
  '    rangeTo?: number;\n    prevRangeFrom?: number;\n    prevRangeTo?: number;'
);

content = content.replace(
  '  } = options || {};',
  '    prevRangeFrom,\n    prevRangeTo,\n  } = options || {};'
);

content = content.replace(
  '        : true;',
  '        : true;\n    const isPrevRange = prevRangeFrom !== undefined && prevRangeTo !== undefined\n      ? verseIndex >= prevRangeFrom && verseIndex <= prevRangeTo\n      : false;'
);

content = content.replace(
  '      inRange,\n      cleanSadrLen:',
  '      inRange,\n      isPrevRange,\n      cleanSadrLen:'
);

content = content.replace(
  '      inRange: p.inRange,\n    }));',
  '      inRange: p.inRange,\n      isPrevRange: p.isPrevRange,\n    }));'
);

content = content.replace(
  '      inRange: p.inRange,\n    };\n  });',
  '      inRange: p.inRange,\n      isPrevRange: p.isPrevRange,\n    };\n  });'
);

fs.writeFileSync('utils/poetryUtils.ts', content, 'utf-8');
