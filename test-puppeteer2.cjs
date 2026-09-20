const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const html = `<html><body>hi</body></html>`;
  await page.setContent(html);
  
  const start = Date.now();
  await page.evaluateHandle('new Promise(resolve => setTimeout(resolve, 2000))');
  console.log("evaluateHandle took:", Date.now() - start);

  const start2 = Date.now();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
  console.log("evaluate took:", Date.now() - start2);

  await browser.close();
})();
