import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { syncVersion } from './version.mjs';

const root = new URL('../', import.meta.url);
const version = await syncVersion(root);

// Fail early if the source template changes instead of distributing a broken page.
function replaceOnce(text, marker, replacement) {
  const index = text.indexOf(marker);
  if (index < 0 || text.indexOf(marker, index + marker.length) !== -1) {
    throw new Error(`Repère manquant ou répété : ${marker}`);
  }
  return text.replace(marker, () => replacement);
}

async function readText(name) {
  const source = await readFile(new URL(name, root), 'utf8');
  // HTML parsers convert CRLF and CR to LF before applying CSP hashes.
  return source.replace(/\r\n?/g, '\n');
}

async function imageData(name, mimeType) {
  const data = await readFile(new URL(name, root));
  return `data:${mimeType};base64,${data.toString('base64')}`;
}

function hashSource(source) {
  return `'sha256-${createHash('sha256').update(source).digest('base64')}'`;
}

const [template, styles, parser, app, icon, mascot] = await Promise.all([
  readText('index.html'), readText('styles.css'), readText('parser.js'), readText('app.js'),
  imageData('favicon.svg', 'image/svg+xml'), imageData('mascot.png', 'image/png'),
]);

// An end tag inside a JS or CSS string could end the surrounding HTML element.
if (/<\/script/i.test(parser) || /<\/script/i.test(app) || /<\/style/i.test(styles)) {
  throw new Error('Une source contient une balise de fermeture incompatible avec son intégration HTML.');
}
const css = replaceOnce(styles, 'url("./mascot.png")', `url("${mascot}")`);
let html = replaceOnce(template, "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:",
  `default-src 'none'; script-src ${hashSource(parser)} ${hashSource(app)}; style-src ${hashSource(css)}; img-src data:`);
html = replaceOnce(html, 'href="./favicon.svg"', `href="${icon}"`);
html = replaceOnce(html, '<link rel="stylesheet" href="./styles.css">', `<style>${css}</style>`);
html = replaceOnce(html, '<script defer src="./parser.js"></script>', '');
html = replaceOnce(html, '<script defer src="./app.js"></script>', '');
// Inline scripts execute immediately. Place them after the UI, in dependency order.
html = replaceOnce(html, '</body>', `<script>${parser}</script>\n<script>${app}</script>\n</body>`);

const dist = new URL('dist/', root);
await mkdir(dist, { recursive: true });
await writeFile(new URL('index.html', dist), html, 'utf8');

// Previous builds put these files in dist/ or dist/assets/. Leave unrelated files alone.
const oldAssets = ['styles.css', 'parser.js', 'app.js', 'favicon.svg', 'mascot.png'];
async function removeOldAssets(directory) {
  for (const name of oldAssets) {
    await unlink(new URL(name, directory)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

await removeOldAssets(dist);
const oldDirectory = new URL('assets', dist);
const oldEntry = await lstat(oldDirectory).catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
if (oldEntry?.isDirectory() && !oldEntry.isSymbolicLink()) {
  await removeOldAssets(new URL('assets/', dist));
  await rmdir(oldDirectory).catch(error => {
    if (error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST') throw error;
  });
}
console.log(`Peppol Viewer v${version} prêt dans dist/index.html (fichier HTML autonome).`);
