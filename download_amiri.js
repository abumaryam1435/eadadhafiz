import https from 'https';
import fs from 'fs';

const file = fs.createWriteStream("public/fonts/Amiri-Regular.ttf");
https.get("https://raw.githubusercontent.com/alif-type/amiri/master/sources/Amiri-Regular.ttf", function(response) {
  if (response.statusCode !== 200) {
    console.error(`Failed: ${response.statusCode}`);
    return;
  }
  response.pipe(file);
  file.on("finish", () => {
    file.close();
    console.log("Downloaded Amiri-Regular.ttf");
  });
}).on("error", (err) => {
  console.error(err);
});
