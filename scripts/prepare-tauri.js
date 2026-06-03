const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'tauri-dist');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));

const buildSrc = path.join(root, 'build');
const buildOut = path.join(out, 'build');
if (fs.existsSync(buildSrc)) {
  fs.cpSync(buildSrc, buildOut, { recursive: true });
}

console.log('Prepared Tauri web assets in tauri-dist');
