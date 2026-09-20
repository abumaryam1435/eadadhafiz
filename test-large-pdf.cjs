const http = require('http');

let html = '<html><body><table border="1">';
for (let i = 0; i < 5000; i++) {
  html += '<tr><td>Row ' + i + ' Col 1</td><td>Row ' + i + ' Col 2</td><td>Row ' + i + ' Col 3</td></tr>';
}
html += '</table></body></html>';

const data = JSON.stringify({ html, orientation: 'portrait' });

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/pdf',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', () => {});
  res.on('end', () => console.log('Done'));
});
req.on('error', (e) => console.error(e));
req.write(data);
req.end();
