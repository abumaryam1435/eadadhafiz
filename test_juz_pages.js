for(let selectedJuzForPages = 1; selectedJuzForPages <= 30; selectedJuzForPages++) {
  let length = 0;
  let startPage = 0;
  if (selectedJuzForPages === 1) {
     startPage = 1;
     length = 21;
  } else if (selectedJuzForPages === 30) {
     startPage = 582;
     length = 604 - 582 + 1; // 23 pages
  } else {
     startPage = (selectedJuzForPages - 1) * 20 + 2;
     length = 20;
  }
  let pages = Array.from({length}, (_, i) => startPage + i);
  console.log(`Juz ${selectedJuzForPages}: start=${startPage}, length=${length}, first=${pages[0]}, last=${pages[pages.length-1]}`);
}
