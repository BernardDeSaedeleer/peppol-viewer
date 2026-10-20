import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

// A minimal DOM adapter exercises our application code without launching a browser.
// Browser-specific printing, layout and native drag events still require manual QA.
function harness() {
  const doc = new DOMParser().parseFromString('<html><body/></html>', 'text/html');
  const listeners = new WeakMap();
  let focusedElement;
  const patch = node => {
    node.append = (...items) => items.forEach(item => node.appendChild(typeof item === 'string' ? doc.createTextNode(item) : item));
    node.replaceChildren = (...items) => { while (node.firstChild) node.removeChild(node.firstChild); node.append(...items); };
    node.focus = () => { focusedElement = node; };
    node.click = () => { for (const f of (listeners.get(node)?.click || [])) f({ target: node }); };
    node.addEventListener = (type, fn) => { const map = listeners.get(node) || {}; (map[type] ||= []).push(fn); listeners.set(node, map); };
    node.classList = { add() {}, remove() {} };
    return node;
  };
  const create = doc.createElement.bind(doc);
  doc.createElement = tag => patch(create(tag));
  const fragment = doc.createDocumentFragment.bind(doc);
  doc.createDocumentFragment = () => patch(fragment());
  patch(doc);
  const ids = ['welcome', 'preview', 'invoice', 'file-name', 'warnings', 'error', 'status', 'choose-file', 'close-invoice', 'file-input', 'print', 'drop-zone'];
  for (const id of ids) { const n = doc.createElement('div'); n.setAttribute('id', id); doc.documentElement.appendChild(n); }
  doc.getElementById('preview').hidden = true;
  doc.title = 'Peppol Viewer - Vos factures, lisibles';
  const registered = [];
  doc.modelContext = { registerTool(tool) { registered.push(tool); } };
  let printCount = 0;
  const context = vm.createContext({ document: doc, window: { addEventListener() {}, scrollTo() {}, print() { printCount++; } }, DOMParser, TextEncoder, TextDecoder, AbortController });
  vm.runInContext(fs.readFileSync(new URL('../parser.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'), context);
  return { doc, registered, focusedElement: () => focusedElement, printCount: () => printCount, emit: (n, event, data) => (listeners.get(n)?.[event] || []).forEach(f => f(data)), serialized: () => new XMLSerializer().serializeToString(doc.getElementById('invoice')) };
}
const xml = fs.readFileSync(new URL('fixtures/base-example.xml', import.meta.url), 'utf8');

test('app contract: XML tool updates visible invoice and invalid input preserves it', () => {
  const h = harness();
  assert.equal(h.registered.length, 1);
  const tool = h.registered[0];
  assert.equal(tool.name, 'open_peppol_xml');
  assert.equal(tool.annotations.readOnlyHint, false);
  assert.equal(tool.annotations.untrustedContentHint, true);
  assert.deepEqual(Array.from(tool.inputSchema.required), ['xml']);
  const result = tool.execute({ xml, filename: 'invoice.xml' });
  assert.equal(result.type, 'invoice');
  assert.equal(result.lineCount, 2);
  assert.equal(h.doc.getElementById('preview').hidden, false);
  assert.equal(h.doc.getElementById('welcome').hidden, true);
  assert.equal(h.doc.getElementById('file-name').textContent, 'invoice.xml');
  assert.match(h.serialized(), /Montant à payer/);
  assert.match(h.serialized(), /1\u202f656,25/);
  const before = h.serialized();
  assert.throws(() => tool.execute({ xml: '<wrong/>' }));
  assert.throws(() => tool.execute({ xml, extra: true }));
  assert.equal(h.serialized(), before);
});
test('rendered supplier and filename cannot become HTML or execute scripts', () => {
  const h = harness();
  h.registered[0].execute({ xml: xml.replace('SupplierOfficialName Ltd', '&lt;img src=x onerror=alert(1)&gt;'), filename: '<script>bad()</script>' });
  assert.equal(h.doc.getElementById('invoice').getElementsByTagName('img').length, 0);
  assert.equal(h.doc.getElementById('invoice').getElementsByTagName('script').length, 0);
  assert.match(h.serialized(), /&lt;img/);
  assert.equal(h.doc.getElementById('file-name').getElementsByTagName('script').length, 0);
});
test('document references are visible and attachment metadata stays inert', () => {
  const h = harness();
  const demo = new TextDecoder('utf-16le').decode(fs.readFileSync(new URL('../exemples/06-devise-usd-utf16.xml', import.meta.url)));
  const opened = h.registered[0].execute({ xml: demo });
  assert.equal(opened.warningCount, 0);
  assert.equal(h.doc.getElementById('warnings').hidden, true);
  assert.match(h.serialized(), /Documents complémentaires/);
  assert.match(h.serialized(), /ANNEXE-DEMO/);
  const references = `<cac:AdditionalDocumentReference><cbc:ID>DOCUMENT-1</cbc:ID><cbc:DocumentDescription>&lt;script&gt;alert(1)&lt;/script&gt;</cbc:DocumentDescription><cac:Attachment><cbc:EmbeddedDocumentBinaryObject filename="&lt;img src=x onerror=alert(1)&gt;">JVBERi0xLjQ=</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference><cac:AdditionalDocumentReference><cbc:ID>LIEN-1</cbc:ID><cac:Attachment><cac:ExternalReference><cbc:URI>javascript:alert(1)</cbc:URI></cac:ExternalReference></cac:Attachment></cac:AdditionalDocumentReference>`;
  const result = h.registered[0].execute({ xml: xml.replace('<cac:AccountingSupplierParty>', references + '<cac:AccountingSupplierParty>') });
  assert.equal(result.warningCount, 2);
  assert.match(h.serialized(), /contenu non affiché/);
  assert.match(h.serialized(), /Lien externe — non ouvert/);
  assert.match(h.serialized(), /&lt;img/);
  assert.doesNotMatch(h.serialized(), /JVBERi0xLjQ=|javascript:/);
  const invoice = h.doc.getElementById('invoice');
  for (const tag of ['img', 'script', 'a', 'iframe', 'object']) assert.equal(invoice.getElementsByTagName(tag).length, 0);
  h.registered[0].execute({ xml: demo });
  assert.equal(h.doc.getElementById('warnings').hidden, true);
  assert.equal(h.doc.getElementById('warnings').childNodes.length, 0);
});
test('file drop opens the same preview and print delegates to the browser', async () => {
  const h = harness();
  const data = { preventDefault() {}, dataTransfer: { files: [{ name: 'drop.xml', size: xml.length, async arrayBuffer() { return new TextEncoder().encode(xml).buffer; } }] } };
  h.emit(h.doc, 'drop', data);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.doc.getElementById('file-name').textContent, 'drop.xml');
  h.doc.getElementById('print').click();
  assert.equal(h.printCount(), 1);
  h.emit(h.doc, 'drop', { preventDefault() {}, dataTransfer: { files: [{}, {}] } });
  assert.match(h.doc.getElementById('error').textContent, /un seul fichier/);
  assert.match(h.doc.getElementById('error').textContent, /précédent est conservé/);
});
test('credit note, allowances and VAT exemptions render through the same interface', () => {
  const h = harness();
  for (const name of ['base-creditnote-correction.xml', 'Allowance-example.xml', 'vat-category-E.xml']) {
    h.registered[0].execute({ xml: fs.readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8') });
    if (name.startsWith('base-credit')) assert.match(h.serialized(), /Montant à créditer/);
    if (name.startsWith('Allowance')) { assert.match(h.serialized(), /acomptes/); assert.match(h.serialized(), /6\u202f125,00/); }
    if (name.startsWith('vat')) assert.match(h.serialized(), /VATEX-EU-F/);
  }
});

test('closing clears the document, returns focus home and allows another drop', async () => {
  const h = harness();
  const get = id => h.doc.getElementById(id);
  const homeTitle = h.doc.title;
  let pickerOpened = false;
  get('file-input').addEventListener('click', () => { pickerOpened = true; });
  h.registered[0].execute({ xml, filename: 'invoice.xml' });
  get('file-input').value = 'invoice.xml';
  get('warnings').append(h.doc.createTextNode('Avertissement'));
  get('warnings').hidden = false;
  h.emit(h.doc, 'drop', { preventDefault() {}, dataTransfer: { files: [{}, {}] } });
  get('close-invoice').click();
  assert.equal(get('welcome').hidden, false);
  assert.equal(get('preview').hidden, true);
  assert.equal(get('invoice').childNodes.length, 0);
  assert.equal(get('file-name').textContent, '');
  assert.equal(get('file-input').value, '');
  assert.equal(get('warnings').childNodes.length, 0);
  assert.equal(get('warnings').hidden, true);
  assert.equal(get('error').textContent, '');
  assert.equal(get('error').hidden, true);
  assert.equal(h.doc.title, homeTitle);
  assert.equal(h.focusedElement(), get('choose-file'));
  assert.equal(pickerOpened, false);
  assert.match(get('status').textContent, /fermé/);
  h.emit(h.doc, 'drop', { preventDefault() {}, dataTransfer: { files: [{ name: 'next.xml', size: xml.length, async arrayBuffer() { return new TextEncoder().encode(xml).buffer; } }] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(get('welcome').hidden, true);
  assert.equal(get('preview').hidden, false);
  assert.equal(get('file-name').textContent, 'next.xml');
});

test('a pending file read cannot reopen the preview or show an error after closing', async () => {
  for (const fail of [false, true]) {
    const h = harness();
    const get = id => h.doc.getElementById(id);
    h.registered[0].execute({ xml });
    let finish;
    const pending = new Promise((resolve, reject) => { finish = () => fail ? reject(new Error('Lecture interrompue')) : resolve(new TextEncoder().encode(xml).buffer); });
    h.emit(h.doc, 'drop', { preventDefault() {}, dataTransfer: { files: [{ name: 'slow.xml', size: xml.length, arrayBuffer() { return pending; } }] } });
    get('close-invoice').click();
    const closedStatus = get('status').textContent;
    finish();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(get('welcome').hidden, false);
    assert.equal(get('preview').hidden, true);
    assert.equal(get('invoice').childNodes.length, 0);
    assert.equal(get('error').hidden, true);
    assert.equal(get('status').textContent, closedStatus);
  }
});
