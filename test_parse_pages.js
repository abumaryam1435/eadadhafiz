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

function numbersToRanges(nums) {
  if (!nums || nums.length === 0) return "";
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  let ranges = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

console.log(countOldPages("1-21, 582-604"));
console.log(numbersToRanges([1,2,3,4,8,9,11]));
