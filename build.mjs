import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DIST = 'dist';

mkdirSync(DIST, { recursive: true });

// 1. Bundle & minify main JS
execSync(
  `npx esbuild app.js --bundle --minify --format=esm --outfile=${DIST}/bundle.js`,
  { stdio: 'inherit' }
);

// 2. Minify CSS
execSync(
  `npx esbuild style.css --minify --outfile=${DIST}/style.min.css`,
  { stdio: 'inherit' }
);

// 3. Minify legal.js
execSync(
  `npx esbuild legal.js --minify --outfile=${DIST}/legal.min.js`,
  { stdio: 'inherit' }
);

const css  = readFileSync(`${DIST}/style.min.css`, 'utf-8');
const js   = readFileSync(`${DIST}/bundle.js`, 'utf-8');
const ljs  = readFileSync(`${DIST}/legal.min.js`, 'utf-8');

// 4. Inline into index.html
let html = readFileSync('index.html', 'utf-8');
html = html.replace(
  '<link rel="stylesheet" href="style.css" />',
  `<style>${css}</style>`
);
html = html.replace(
  '<script type="module" src="app.js"></script>',
  `<script type="module">${js}</script>`
);
writeFileSync(`${DIST}/index.html`, html);
console.log(`✓ ${DIST}/index.html  (${(html.length / 1024).toFixed(0)} KB)`);

// 5. Inline CSS + legal.js into legal pages
for (const page of ['impressum.html', 'datenschutz.html']) {
  let content = readFileSync(page, 'utf-8');
  content = content.replace(
    '<link rel="stylesheet" href="style.css" />',
    `<style>${css}</style>`
  );
  content = content.replace(
    '<script src="legal.js"></script>',
    `<script>${ljs}</script>`
  );
  writeFileSync(`${DIST}/${page}`, content);
  console.log(`✓ ${DIST}/${page}  (${(content.length / 1024).toFixed(0)} KB)`);
}
