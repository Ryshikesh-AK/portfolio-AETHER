const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'assets', 'images');
const thumbsDir = path.join(__dirname, 'assets', 'images', 'thumbs');

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.jpeg'));

console.log(`Found ${files.length} jpeg files in assets/images/`);

files.forEach((f, idx) => {
  const src = path.join(srcDir, f);
  const destThumb = path.join(thumbsDir, `thumb-${idx + 1}.jpeg`);
  const destNamed = path.join(thumbsDir, f);
  fs.copyFileSync(src, destThumb);
  fs.copyFileSync(src, destNamed);
  console.log(`[${idx + 1}] Copied ${f} -> thumb-${idx + 1}.jpeg`);
});

console.log('All thumbs copied successfully.');
