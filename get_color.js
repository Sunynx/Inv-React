const fs = require('fs');

async function getColor() {
  const data = fs.readFileSync('c:/Users/Sun/Desktop/RPM-IT-Inventory/Inv React/public/rpm-logo.jpg');
  // It's a JPEG, so we need a library to parse it. 
  // Let's see if we can use a basic JS library, but wait, maybe jimp is installed?
  try {
    const Jimp = require('jimp');
    const image = await Jimp.read(data);
    const hex = image.getPixelColor(10, 10);
    console.log(hex.toString(16));
  } catch (e) {
    console.log("Jimp not found. Trying another way or returning error.");
  }
}
getColor();
