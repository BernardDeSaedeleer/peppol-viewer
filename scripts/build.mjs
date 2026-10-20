import { mkdir, copyFile } from 'node:fs/promises';
import { syncVersion } from './version.mjs';
const root = new URL('../', import.meta.url);
const version = await syncVersion(root);
await mkdir(new URL('dist/', root), { recursive: true });
for (const name of ['index.html', 'styles.css', 'parser.js', 'app.js', 'favicon.svg', 'mascot.png']) {
  await copyFile(new URL(name, root), new URL(`dist/${name}`, root));
}
console.log(`Peppol Viewer v${version} prêt dans dist/ (6 fichiers publics, aucune dépendance runtime).`);
