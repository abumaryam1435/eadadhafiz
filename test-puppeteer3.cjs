const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const start = Date.now();
  await page.evaluateHandle('new Promise(resolve => setTimeout(resolve, 2000))');
  console.log("evaluateHandle string took:", Date.now() - start);

  const start3 = Date.now();
  await page.evaluateHandle(() => new Promise(resolve => setTimeout(resolve, 2000)));
  console.log("evaluateHandle fn took:", Date.now() - start3);

  const start4 = Date.now();
  await page.evaluate('new Promise(resolve => setTimeout(resolve, 2000))');
  console.log("evaluate string took:", Date.now() - start4);

  await browser.close();
})();
