import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// package.json is authoritative. The HTML is stamped before serving or building,
// so distributed copies also show their version offline, without JavaScript or fetch.
export async function syncVersion(root = new URL('../', import.meta.url)) {
  const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('La version dans package.json doit suivre le format majeur.mineur.correctif (ex. 0.1.0).');
  }
  const path = new URL('index.html', root);
  const html = await readFile(path, 'utf8');
  const marker = /<span id="app-version">[^<]*<\/span>/g;
  if ([...html.matchAll(marker)].length !== 1) {
    throw new Error('Le pied de page doit contenir un seul élément app-version.');
  }
  const updated = html.replace(marker, `<span id="app-version">v${version}</span>`);
  if (updated !== html) await writeFile(path, updated, 'utf8');
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Version affichée : v${await syncVersion()}`);
}
