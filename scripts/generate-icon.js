// Generates a simple Minecraft-themed icon (256x256 PNG)
const fs = require('fs');
const path = require('path');

// Minimal PNG generator - creates a 256x256 RGBA image
function createPNG(width, height, pixels) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ (-1)) >>> 0;
  }
  
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeData));
    return Buffer.concat([len, typeData, crc]);
  }
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  
  // Raw image data with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];
      rawData[dstIdx + 1] = pixels[srcIdx + 1];
      rawData[dstIdx + 2] = pixels[srcIdx + 2];
      rawData[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }
  
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const size = 256;
const pixels = Buffer.alloc(size * size * 4);

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const idx = (y * size + x) * 4;
    
    // Minecraft-style grass block icon
    const inBlock = x >= 32 && x < 224 && y >= 32 && y < 224;
    
    if (inBlock) {
      // Create pixelated texture
      const bx = Math.floor((x - 32) / 12);
      const by = Math.floor((y - 32) / 12);
      
      // Seeded pseudo-random for consistent texture
      const seed = (bx * 7 + by * 13 + bx * by * 3) % 100;
      
      if (by < 4) {
        // Grass top - greens
        const g = seed % 2;
        if (g === 0) { pixels[idx] = 95; pixels[idx+1] = 159; pixels[idx+2] = 53; }
        else { pixels[idx] = 116; pixels[idx+1] = 177; pixels[idx+2] = 63; }
      } else if (by < 10) {
        // Dirt - browns
        const d = seed % 3;
        if (d === 0) { pixels[idx] = 134; pixels[idx+1] = 96; pixels[idx+2] = 67; }
        else if (d === 1) { pixels[idx] = 121; pixels[idx+1] = 85; pixels[idx+2] = 58; }
        else { pixels[idx] = 146; pixels[idx+1] = 104; pixels[idx+2] = 72; }
      } else {
        // Bottom edge - darker
        pixels[idx] = 80; pixels[idx+1] = 56; pixels[idx+2] = 40;
      }
      pixels[idx + 3] = 255;
      
      // Border
      if (x === 32 || x === 223 || y === 32 || y === 223) {
        pixels[idx] = 40; pixels[idx+1] = 40; pixels[idx+2] = 40; pixels[idx+3] = 255;
      }
    } else {
      // Rounded corners / transparency
      const cx = x - 127.5, cy = y - 127.5;
      const dist = Math.sqrt(cx*cx + cy*cy);
      if (dist < 120) {
        // Shadow area
        pixels[idx] = 30; pixels[idx+1] = 30; pixels[idx+2] = 35;
        pixels[idx + 3] = 200;
      } else {
        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
      }
    }
  }
}

const png = createPNG(size, size, pixels);
const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png);

// Create ICO file from PNG (simple: embed PNG in ICO format)
function createICO(pngData) {
  const ico = Buffer.alloc(6 + 16 + pngData.length);
  ico.writeUInt16LE(0, 0);        // reserved
  ico.writeUInt16LE(1, 2);        // type: icon
  ico.writeUInt16LE(1, 4);        // count: 1 image
  
  // Image entry
  ico[6] = 0;                     // width (0 = 256)
  ico[7] = 0;                     // height (0 = 256)
  ico[8] = 0;                     // color palette
  ico[9] = 0;                     // reserved
  ico.writeUInt16LE(1, 10);       // color planes
  ico.writeUInt16LE(32, 12);      // bits per pixel
  ico.writeUInt32LE(pngData.length, 14); // size of image data
  ico.writeUInt32LE(22, 18);      // offset to image data
  
  pngData.copy(ico, 22);
  return ico;
}

fs.writeFileSync(path.join(assetsDir, 'icon.ico'), createICO(png));
console.log('✅ Icons created: assets/icon.png, assets/icon.ico');
