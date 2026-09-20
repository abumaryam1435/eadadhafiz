function countOldPages(str) {
  if (!str) return 0;
  let count = 0;
  const parts = str.split(/[,،]/); 
  for (const part of parts) {
    const range = part.trim().split('-');
    if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        count += (Math.abs(end - start) + 1);
      }
    } else if (range.length === 1) {
      const num = parseInt(range[0], 10);
      if (!isNaN(num)) count += 1;
    }
  }
  return count;
}
