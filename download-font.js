const fs = require('fs');
const https = require('https');

const url = 'https://raw.githubusercontent.com/wutipong/thai-fonts/master/fonts/THSarabunNew.ttf';
const dest = 'src/lib/fonts/THSarabunNew.ttf';
const tsDest = 'src/lib/fonts/thSarabunNewBase64.ts';

https.get(url, (res) => {
  const file = fs.createWriteStream(dest);
  res.pipe(file);
  file.on('finish', () => {
    file.close(() => {
      const data = fs.readFileSync(dest);
      const base64 = data.toString('base64');
      const tsContent = `export const thSarabunNewBase64 = "${base64}";\n`;
      fs.writeFileSync(tsDest, tsContent);
      console.log('Font downloaded and converted successfully!');
    });
  });
}).on('error', (err) => {
  console.error('Error downloading font:', err.message);
});
