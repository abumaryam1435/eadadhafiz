const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox']
  });
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
      <p>مرحبا بك في الاختبار</p>
    </body>
    </html>
  `;
  
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  await page.pdf({ path: 'test.pdf' });
  await browser.close();
  console.log("Done");
})();
