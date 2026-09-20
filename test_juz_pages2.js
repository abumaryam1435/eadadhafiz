for(let selectedJuzForPages = 1; selectedJuzForPages <= 30; selectedJuzForPages++) {
  let length = (selectedJuzForPages === 30 ? 604 : (selectedJuzForPages - 1) * 20 + 21) - ((selectedJuzForPages - 1) * 20 + 1) + (selectedJuzForPages===1?21:1);
  let startPage = 0;
  if (selectedJuzForPages === 1) startPage = 1;
  else startPage = (selectedJuzForPages - 1) * 20 + 2;
  
  let pages = Array.from({length}, (_, i) => startPage + i);
  console.log(`Juz ${selectedJuzForPages}: start=${startPage}, length=${length}, first=${pages[0]}, last=${pages[pages.length-1]}`);
}
