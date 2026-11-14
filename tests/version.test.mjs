import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
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

const assets = ['app.js', 'favicon.svg', 'mascot.png', 'parser.js', 'styles.css'];

function cspHash(contents) {
  return "'sha256-" + createHash('sha256').update(contents).digest('base64') + "'";
}

async function verifyStandalone(directory, version) {
  const source = file => readFile(join(directory, file), 'utf8').then(text => text.replace(/\r\n?/g, '\n'));
  // HTML parsing normalises CR and CRLF to LF before checking CSP hashes.
  const html = await source('dist/index.html');
  const marker = '<span id="app-version">v' + version + '</span>';
  for (const page of [html, await source('index.html')]) {
    assert.ok(page.includes(marker));
    assert.equal((page.match(/id="app-version"/g) || []).length, 1);
  }

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 2);
  assert.ok(scripts[0].index > html.indexOf('id="app-version"'), 'application elements exist before scripts execute');
  for (const [index, file] of ['parser.js', 'app.js'].entries()) {
    assert.doesNotMatch(scripts[index][1], /\bsrc\s*=/i);
    assert.equal(scripts[index][2].trim(), (await source(file)).trim());
  }

  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  assert.equal(styles.length, 1);
  const css = styles[0][1];
  const image = css.match(/url\(["']?data:image\/png;base64,([A-Za-z\d+/=]+)["']?\)/);
  assert.ok(image, 'mascot is embedded in the CSS');
  assert.ok(Buffer.from(image[1], 'base64').equals(await readFile(join(directory, 'mascot.png'))));
  assert.ok(css.replace(image[0], 'url("./mascot.png")').trim() === (await source('styles.css')).trim());

  const icon = html.match(/<link\b[^>]*\bhref="data:image\/svg\+xml;base64,([A-Za-z\d+/=]+)"[^>]*>/i);
  assert.ok(icon, 'favicon is embedded in the HTML');
  assert.equal(Buffer.from(icon[1], 'base64').toString('utf8').replace(/\r\n?/g, '\n'), await source('favicon.svg'));
  assert.doesNotMatch(html, /<link\b[^>]*rel="stylesheet"|(?:src|href)="\.\//i);

  const policy = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  assert.ok(policy);
  const directives = new Map(policy[1].split(';').filter(item => item.trim()).map(item => {
    const [name, ...values] = item.trim().split(/\s+/);
    return [name, values];
  }));
  assert.deepEqual(directives.get('script-src')?.toSorted(), scripts.map(match => cspHash(match[2])).sort());
  assert.deepEqual(directives.get('style-src'), [cspHash(css)]);
  assert.deepEqual(directives.get('img-src'), ['data:']);
  for (const name of ['default-src', 'connect-src', 'object-src', 'base-uri', 'form-action']) {
    assert.deepEqual(directives.get(name), ["'none'"]);
  }
}

test('build produces one self-contained HTML file with an offline version and valid CSP hashes', async t => {
  const { directory } = await fixture(t);
  await mkdir(join(directory, 'scripts'));
  for (const file of ['index.html', ...assets, 'scripts/build.mjs', 'scripts/version.mjs']) {
    await copyFile(new URL('../' + file, import.meta.url), join(directory, file));
  }
  for (const file of ['parser.js', 'app.js', 'styles.css']) {
    const dest = join(directory, file);
    await writeFile(dest, (await readFile(dest, 'utf8')).replace(/\r?\n/g, '\r\n'));
  }
  const dist = join(directory, 'dist');
  const oldAssets = join(dist, 'assets');
  await mkdir(oldAssets, { recursive: true });
  for (const file of assets) {
    await copyFile(join(directory, file), join(dist, file));
    await copyFile(join(directory, file), join(oldAssets, file));
  }
  const build = async version => {
    await writeFile(join(directory, 'package.json'), JSON.stringify({ version }));
    execFileSync(process.execPath, [join(directory, 'scripts/build.mjs')], { cwd: directory });
    await verifyStandalone(directory, version);
  };

  await build('0.2.0');
  assert.deepEqual(await readdir(dist), ['index.html']);

  // A rebuild may clean up generated files, but must preserve unrelated content.
  await mkdir(oldAssets);
  await writeFile(join(oldAssets, 'keep.txt'), 'keep');
  await writeFile(join(dist, 'keep.txt'), 'keep');
  await build('0.2.1');
  for (const folder of [oldAssets, dist]) assert.equal(await readFile(join(folder, 'keep.txt'), 'utf8'), 'keep');
});

test('invalid release metadata leaves the displayed version intact', async t => {
  const { directory, root } = await fixture(t);
  const html = '<footer><span id="app-version">v0.1.0</span></footer>';
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'package.json'), JSON.stringify({ version: '0.02.0' }));
  await assert.rejects(syncVersion(root), /majeur.mineur.correctif/);
  assert.equal(await readFile(join(directory, 'index.html'), 'utf8'), html);
});
