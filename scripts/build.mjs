import { mkdir, copyFile, readFile, writeFile, unlink } from 'node:fs/promises';
import { syncVersion } from './version.mjs';
const root = new URL('../', import.meta.url);
const version = await syncVersion(root);
const assets = ['styles.css', 'parser.js', 'app.js', 'favicon.svg', 'mascot.png'];
await mkdir(new URL('dist/assets/', root), { recursive: true });
for (const name of assets) {
  await copyFile(new URL(name, root), new URL(`dist/assets/${name}`, root));
}
// Relative paths also work when index.html is opened directly from the file system.
// The stylesheet and its mascot image stay together in assets/.
const html = (await readFile(new URL('index.html', root), 'utf8')).replace(
  /((?:href|src)=")\.\/(styles\.css|parser\.js|app\.js|favicon\.svg)"/g,
  '$1./assets/$2"'
);
await writeFile(new URL('dist/index.html', root), html, 'utf8');
// Remove only the five obsolete build outputs from the previous flat layout.
// Never recursively delete dist/ or touch unrelated user files.
for (const name of assets) {
  await unlink(new URL(`dist/${name}`, root)).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
}
console.log(`Peppol Viewer v${version} prêt dans dist/ (index.html + dossier assets, aucune dépendance runtime).`);
