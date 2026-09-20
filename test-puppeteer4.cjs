const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Tajawal', sans-serif; font-size: 40px; }
      </style>
    </head>
    <body>
      <p>مرحبا بك</p>
    </body>
    </html>
  `;
  
  await page.setContent(html);
  
  // Wait for font to actually be loaded
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Check if Tajawal is loaded
    while (!document.fonts.check('12px Tajawal')) {
      await new Promise(r => setTimeout(r, 100));
    }
  });

  await page.pdf({ path: 'test4.pdf' });
  await browser.close();
  console.log("Done");
})();
