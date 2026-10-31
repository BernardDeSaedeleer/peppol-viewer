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
  const createNS = doc.createElementNS.bind(doc);
  doc.createElementNS = (namespace, tag) => patch(createNS(namespace, tag));
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
const transferXml = fs.readFileSync(new URL('../exemples/07-bulletin-virement.xml', import.meta.url), 'utf8');

test('Belgian payment information and the final slip show the same structured reference', () => {
  const h = harness();
  h.registered[0].execute({ xml: transferXml });
  const invoice = h.doc.getElementById('invoice');
  const slip = invoice.lastChild;
  assert.equal(slip.getAttribute('aria-label'), 'Bulletin de virement');
  assert.match(slip.textContent, /\+\+\+202\/6000\/10195\+\+\+/);
  assert.match(slip.textContent, /ATELIER PIXEL DÉMO/);
  assert.match(slip.textContent, /RUE DES EXEMPLES/);
  assert.match(slip.textContent, /19\/11\/2026/);
  assert.match(invoice.textContent, /Communication structurée : \+\+\+202\/6000\/10195\+\+\+/);
  assert.match(slip.previousSibling.textContent, /DOCUMENT FICTIF/);
});

test('a replaced document cannot retain the preceding payment slip', () => {
  const h = harness();
  for (const next of [transferXml.replace('>292.82</cbc:PayableAmount>', '>0</cbc:PayableAmount>'),
    fs.readFileSync(new URL('../exemples/04-note-de-credit.xml', import.meta.url), 'utf8'),
    transferXml.replace('202600010195', '202600010196')]) {
    h.registered[0].execute({ xml: transferXml });
    assert.match(h.serialized(), /Bulletin de virement/);
    h.registered[0].execute({ xml: next });
    assert.doesNotMatch(h.serialized(), /Bulletin de virement/);
  }
});

test('free payment references and beneficiary names are never interpreted as markup', () => {
  const h = harness();
  const unsafe = transferXml.replace('PaymentMeansCode>1<', 'PaymentMeansCode>58<')
    .replaceAll('Atelier Pixel Démo', '&lt;img src=x onerror=alert(1)&gt;')
    .replace('202600010195', '&lt;script&gt;alert(1)&lt;/script&gt;');
  h.registered[0].execute({ xml: unsafe });
  const invoice = h.doc.getElementById('invoice');
  assert.equal(invoice.getElementsByTagName('svg').length, 0);
  assert.match(invoice.textContent, /Bulletin de virement indisponible/);
  for (const tag of ['img', 'script', 'iframe']) assert.equal(invoice.getElementsByTagName(tag).length, 0);
  assert.match(invoice.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(invoice.textContent, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(invoice.textContent, /Communication structurée/);
});

test('the form keeps complete financial fields at Febelfin physical dimensions and baselines', () => {
  const h = harness();
  const withBank = transferXml.replace('</cac:PayeeFinancialAccount>', '<cac:FinancialInstitutionBranch><cbc:ID>DEMOBEBB</cbc:ID></cac:FinancialInstitutionBranch></cac:PayeeFinancialAccount>');
  h.registered[0].execute({ xml: withBank });
  const svg = h.doc.getElementById('invoice').getElementsByTagName('svg')[0];
  assert.ok(svg);
  assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(svg.getAttribute('width'), '210mm');
  assert.equal(svg.getAttribute('height'), '101.6mm');
  assert.equal(svg.getAttribute('viewBox'), '0 0 210 101.6');
  const fields = Array.from(svg.getElementsByTagName('text')).filter(node => node.hasAttribute('data-field'));
  const values = name => fields.filter(node => node.getAttribute('data-field') === name);
  const text = name => values(name).map(node => node.textContent).join('');
  assert.equal(text('euros'), '292');
  assert.equal(text('cents'), '82');
  assert.equal(text('account'), 'BE68 5390 0754 7034');
  assert.equal(text('bank'), 'DEMOBEBB');
  assert.equal(text('beneficiary'), 'ATELIER PIXEL DÉMO');
  assert.equal(text('street'), 'RUE DES EXEMPLES 12');
  assert.equal(text('locality'), 'BE 0000 VILLE-DÉMO');
  assert.equal(text('reference'), '+++202/6000/10195+++');
  assert.equal(text('code'), '03');
  // Values are placed against the guide's independently specified millimetre
  // baselines, rather than against the screen's responsive CSS box dimensions.
  assert.equal(Number(values('account')[0].getAttribute('x')), 35.56);
  assert.equal(Number(values('account')[0].getAttribute('y')), 63.5);
  assert.ok(Math.abs(Number(values('bank')[0].getAttribute('y')) - 17 * 25.4 / 6) < 0.000001);
  assert.equal(Number(values('beneficiary')[0].getAttribute('y')), 80);
  assert.equal(Number(values('street')[0].getAttribute('y')), 84);
  assert.equal(Number(values('locality')[0].getAttribute('y')), 88);
  assert.equal(Number(values('reference')[0].getAttribute('x')), 68.58);
  assert.ok(Math.abs(Number(values('reference')[0].getAttribute('y')) - 23 * 25.4 / 6) < 0.000001);
  assert.ok(Math.abs(Number(values('euros')[0].getAttribute('y')) - 7 * 25.4 / 6) < 0.000001);
  assert.equal(Number(values('code')[0].getAttribute('x')), 198.12);
  assert.equal(Number(values('code')[0].getAttribute('y')), 12.7);
  assert.match(svg.getElementsByTagName('desc')[0].textContent, /292,82 EUR.*BE68 5390 0754 7034.*\+\+\+202\/6000\/10195\+\+\+/);
});

test('payer, signature and execution date stay blank while invoice due date remains outside the form', () => {
  const h = harness();
  h.registered[0].execute({ xml: transferXml });
  const slip = h.doc.getElementById('invoice').lastChild;
  const svg = slip.getElementsByTagName('svg')[0];
  const printedFields = Array.from(svg.getElementsByTagName('text')).filter(node => node.hasAttribute('data-field'));
  assert.deepEqual([...new Set(printedFields.map(node => node.getAttribute('data-field')))].sort(),
    ['account', 'bank', 'beneficiary', 'cents', 'code', 'euros', 'locality', 'reference', 'street']);
  assert.doesNotMatch(svg.textContent, /Bureau Horizon|BUREAU HORIZON|19\/11\/2026|2026-11-19/);
  assert.match(slip.firstChild.textContent, /Échéance : 19\/11\/2026/);
  assert.match(svg.textContent, /Signature\(s\).*Date d’exécution souhaitée dans le futur.*Compte donneur d’ordre/s);
});

test('unsupported field lengths show a reason, preserve full invoice values and reset on replacement', () => {
  const h = harness();
  const reference = 'REFERENCE DE FACTURE TROP LONGUE POUR LE BULLETIN 123456789';
  const long = transferXml.replace('PaymentMeansCode>1<', 'PaymentMeansCode>58<').replace('202600010195', reference);
  h.registered[0].execute({ xml: long });
  let invoice = h.doc.getElementById('invoice');
  assert.equal(invoice.getElementsByTagName('svg').length, 0);
  assert.match(invoice.textContent, /Bulletin de virement indisponible/);
  assert.match(invoice.textContent, /34 caractères/);
  assert.ok(invoice.textContent.includes('Communication : ' + reference));
  assert.match(invoice.textContent, /Compte \/ IBAN : BE68539007547034/);
  assert.match(invoice.textContent, /292,82/);
  h.registered[0].execute({ xml: transferXml });
  invoice = h.doc.getElementById('invoice');
  assert.equal(invoice.getElementsByTagName('svg').length, 1);
  assert.doesNotMatch(invoice.textContent, /indisponible|34 caractères|TROP LONGUE/);
});

test('double-escaped customer text remains literal without preventing a valid beneficiary form', () => {
  const h = harness();
  const escaped = transferXml.replace('Avenue de la Démonstration 34', 'Avenue d&amp;apos;Été 34');
  h.registered[0].execute({ xml: escaped });
  const invoice = h.doc.getElementById('invoice');
  assert.ok(invoice.firstChild.textContent.includes('Avenue d&apos;Été 34'));
  assert.ok(!invoice.firstChild.textContent.includes("Avenue d'Été 34"));
  assert.equal(invoice.getElementsByTagName('svg').length, 1);
});

test('a separate payee retains its complete address in the invoice as well as in a suitable form', () => {
  const h = harness();
  const payee = '<cac:PayeeParty><cac:PartyName><cbc:Name>Payee fictif</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>Rue du Payee 12</cbc:StreetName><cbc:PostalZone>0000</cbc:PostalZone><cbc:CityName>Autreville</cbc:CityName><cac:Country><cbc:IdentificationCode>BE</cbc:IdentificationCode></cac:Country></cac:PostalAddress></cac:PayeeParty>';
  const withPayee = transferXml.replace('<cac:PaymentMeans>', payee + '<cac:PaymentMeans>');
  h.registered[0].execute({ xml: withPayee });
  let invoice = h.doc.getElementById('invoice');
  assert.match(invoice.firstChild.textContent, /Bénéficiaire : Payee fictifRue du Payee 120000 AutrevilleBE/);
  assert.match(invoice.lastChild.textContent, /PAYEE FICTIF.*RUE DU PAYEE 12.*BE 0000 AUTREVILLE/);
  h.registered[0].execute({ xml: withPayee.replace('<cbc:PostalZone>0000</cbc:PostalZone><cbc:CityName>Autreville', '<cbc:CountrySubentity>Région fictive</cbc:CountrySubentity><cbc:PostalZone>0000</cbc:PostalZone><cbc:CityName>Autreville') });
  invoice = h.doc.getElementById('invoice');
  assert.equal(invoice.getElementsByTagName('svg').length, 0);
  assert.match(invoice.textContent, /Bénéficiaire : Payee fictifRue du Payee 120000 AutrevilleRégion fictiveBE/);
  assert.match(invoice.textContent, /sans zone prévue/);
});

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
