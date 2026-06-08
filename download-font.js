const fs = require('fs');

async function downloadFont() {
  try {
    const url = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf';
    console.log('Downloading from:', url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 1000) {
      throw new Error('Downloaded file is too small, likely an error page.');
    }

    const base64 = buffer.toString('base64');
    const tsContent = `export const thSarabunNewBase64 = "${base64}";\n`;
    fs.writeFileSync('src/lib/fonts/thSarabunNewBase64.ts', tsContent);
    console.log('Font downloaded and converted successfully! Size:', buffer.length);
  } catch (err) {
    console.error(err);
  }
}

downloadFont();
