import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { syncVersion } from '../scripts/version.mjs';

async function fixture(t) {
  const prefix = join(tmpdir(), 'peppol-version-');
  const directory = await mkdtemp(prefix);
  t.after(async () => {
    if (!resolve(directory).startsWith(resolve(prefix))) throw new Error('Unexpected temporary path');
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, root: pathToFileURL(directory + sep) };
}

test('build stamps versions and produces an offline index plus assets distribution, including after an upgrade', async t => {
  const { directory } = await fixture(t);
  await mkdir(join(directory, 'scripts'));
  for (const file of ['index.html', 'styles.css', 'parser.js', 'app.js', 'favicon.svg', 'mascot.png', 'scripts/build.mjs', 'scripts/version.mjs']) {
    await copyFile(new URL('../' + file, import.meta.url), join(directory, file));
  }
  // Simulate the old distribution to ensure its technical files leave the root.
  const assets = ['app.js', 'favicon.svg', 'mascot.png', 'parser.js', 'styles.css'];
  await mkdir(join(directory, 'dist'));
  for (const file of assets) await copyFile(join(directory, file), join(directory, 'dist', file));
  for (const version of ['0.2.0', '0.2.1']) {
    await writeFile(join(directory, 'package.json'), JSON.stringify({ version }));
    execFileSync(process.execPath, [join(directory, 'scripts/build.mjs')], { cwd: directory });
    for (const file of ['index.html', 'dist/index.html']) {
      const html = await readFile(join(directory, file), 'utf8');
      assert.ok(html.includes(`<span id="app-version">v${version}</span>`));
      assert.equal((html.match(/id="app-version"/g) || []).length, 1);
    }
    assert.deepEqual((await readdir(join(directory, 'dist'))).sort(), ['assets', 'index.html']);
    assert.deepEqual((await readdir(join(directory, 'dist/assets'))).sort(), assets);
    for (const file of assets) {
      assert.deepEqual(await readFile(join(directory, 'dist/assets', file)), await readFile(join(directory, file)));
    }
    // Resolve the actual HTML and CSS resource URLs using file://, with no server.
    const indexUrl = pathToFileURL(join(directory, 'dist/index.html'));
    const html = await readFile(indexUrl, 'utf8');
    const references = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(match => match[1]);
    assert.equal(references.length, 4);
    for (const reference of references) assert.ok((await readFile(new URL(reference, indexUrl))).length > 0);
    const cssUrl = new URL('./assets/styles.css', indexUrl);
    const css = await readFile(cssUrl, 'utf8');
    const images = [...css.matchAll(/url\("([^"#]+)"\)/g)].map(match => match[1]);
    assert.equal(images.length, 1);
    for (const image of images) assert.ok((await readFile(new URL(image, cssUrl))).length > 0);
  }
});

test('invalid release metadata leaves the displayed version intact', async t => {
  const { directory, root } = await fixture(t);
  const html = '<footer><span id="app-version">v0.1.0</span></footer>';
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'package.json'), JSON.stringify({ version: '0.02.0' }));
  await assert.rejects(syncVersion(root), /majeur.mineur.correctif/);
  assert.equal(await readFile(join(directory, 'index.html'), 'utf8'), html);
});
