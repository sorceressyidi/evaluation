const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pairs = JSON.parse(fs.readFileSync(path.join(ROOT, 'videos', 'pairs.json'), 'utf-8'));

const allPaths = new Set();
for (const pair of pairs) {
  allPaths.add(pair.videoA.path);
  allPaths.add(pair.videoB.path);
}

const missing = [];
for (const p of allPaths) {
  const fullPath = path.join(ROOT, p);
  if (!fs.existsSync(fullPath)) {
    missing.push(p);
  }
}

console.log(`Total unique video paths: ${allPaths.size}`);
console.log(`Missing files: ${missing.length}`);
if (missing.length > 0) {
  console.log('\nMissing files:');
  missing.forEach(p => console.log(`  ${p}`));
} else {
  console.log('\nAll video files exist!');
}
