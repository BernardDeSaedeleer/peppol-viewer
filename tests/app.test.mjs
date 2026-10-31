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

function formFields(svg, name) {
  return Array.from(svg.getElementsByTagName('text')).filter(node => node.getAttribute('data-field') === name);
}
function assertCentredInCell(svg, node) {
  const x = Number(node.getAttribute('x')), y = Number(node.getAttribute('y'));
  const width = node.getAttribute('data-field') === 'code' ? 2.54 : 4.04;
  const cells = Array.from(svg.getElementsByTagName('rect')).filter(rect =>
    Math.abs(Number(rect.getAttribute('width')) - width) < 0.000001 &&
    Math.abs(Number(rect.getAttribute('x')) + width / 2 - x) < 0.000001 &&
    Math.abs(Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')) / 2 - y) < 0.000001);
  assert.equal(cells.length, 1, `${node.getAttribute('data-field')} ${JSON.stringify(node.textContent)} must occupy exactly one drawn cell`);
  assert.equal(node.getAttribute('text-anchor'), 'middle');
  assert.equal(node.getAttribute('dominant-baseline'), 'central');
  return cells[0];
}

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

test('the form keeps complete financial fields centred in its actual cells at physical dimensions', () => {
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
  assert.equal(text('account'), 'BE68539007547034');
  assert.equal(text('bank'), 'DEMOBEBB');
  assert.equal(text('beneficiary'), 'ATELIER PIXEL DÉMO');
  assert.equal(text('street'), 'RUE DES EXEMPLES 12');
  assert.equal(text('locality'), 'BE 0000 VILLE-DÉMO');
  assert.equal(text('reference'), '+++202/6000/10195+++');
  assert.equal(text('code'), '03');
  // Read the independently drawn rectangles: a shared wrong offset would not
  // be caught by checking text positions against another copy of the renderer.
  for (const node of fields) assertCentredInCell(svg, node);
  for (const [name, top] of [['account', 58.02], ['bank', 66.39], ['beneficiary', 75.62], ['street', 79.95], ['locality', 84.14], ['reference', 91.79]]) {
    const first = assertCentredInCell(svg, values(name)[0]);
    assert.equal(Number(first.getAttribute('x')), 34.52, `${name} begins in the first cell`);
    assert.equal(Number(first.getAttribute('y')), top);
  }
  const cells = Array.from(svg.getElementsByTagName('rect'));
  const amountCells = cells.filter(cell => Number(cell.getAttribute('y')) === 24.10 && Number(cell.getAttribute('width')) === 4.04);
  const euroCells = amountCells.filter(cell => Number(cell.getAttribute('x')) >= 151.36 && Number(cell.getAttribute('x')) < 197);
  const centCells = amountCells.filter(cell => Number(cell.getAttribute('x')) >= 197);
  assert.equal(euroCells.length, 8);
  assert.equal(centCells.length, 2);
  assert.deepEqual(values('euros').map(node => assertCentredInCell(svg, node)), euroCells.slice(-3));
  assert.deepEqual(values('cents').map(node => assertCentredInCell(svg, node)), centCells);
  assert.equal(values('code').length, 2);
  assert.equal(values('account').length, 16);
  assert.match(svg.getElementsByTagName('desc')[0].textContent, /292,82 EUR.*BE68 5390 0754 7034.*\+\+\+202\/6000\/10195\+\+\+/);
  const slip = svg.parentNode;
  assert.doesNotMatch(slip.textContent, /Impression :|Gabarit adapté|Directives Febelfin|Vérifiez les données/);
  assert.equal(slip.getElementsByTagName('a').length, 0);
});

test('full rows preserve spaces and every character of free references and foreign IBANs', () => {
  const h = harness();
  const beneficiary = 'ABCDEFGHIJKLMNOPQRSTUV XYZ';
  const reference = 'ABCDEFGHIJKLMN OPQRSTUVWXYZ 123456';
  const iban = 'DE36000000000000000000'; // Same synthetic valid account as payment tests.
  assert.equal(beneficiary.length, 26);
  assert.equal(reference.length, 34);
  h.registered[0].execute({ xml: transferXml.replaceAll('Atelier Pixel Démo', beneficiary)
    .replace('PaymentMeansCode>1<', 'PaymentMeansCode>58<')
    .replace('202600010195', reference).replace('BE68539007547034', iban) });
  const invoice = h.doc.getElementById('invoice');
  const svg = invoice.getElementsByTagName('svg')[0];
  assert.ok(svg);
  for (const [name, expected, top] of [['beneficiary', beneficiary, 75.62], ['reference', reference, 91.79], ['account', iban, 58.02]]) {
    const nodes = formFields(svg, name);
    assert.equal(nodes.map(node => node.textContent).join(''), expected);
    assert.equal(nodes.length, expected.length);
    const drawn = Array.from(svg.getElementsByTagName('rect')).filter(cell => Number(cell.getAttribute('y')) === top && Number(cell.getAttribute('width')) === 4.04);
    assert.deepEqual(nodes.map(node => assertCentredInCell(svg, node)), drawn.slice(0, expected.length));
    for (let i = 0; i < expected.length; i++) if (expected[i] === ' ') assert.equal(nodes[i].textContent, ' ');
  }
  assert.equal(formFields(svg, 'code').map(node => node.textContent).join(''), '02');
  assert.match(invoice.firstChild.textContent, new RegExp('Compte / IBAN : ' + iban));
  assert.ok(invoice.firstChild.textContent.includes('Communication : ' + reference));
  assert.match(svg.getElementsByTagName('desc')[0].textContent, /IBAN DE36 0000 0000 0000 0000 00/);
});

test('a decomposed accent stays with its letter in one cell without normalising the source', () => {
  const h = harness();
  const name = 'E\u0301TOILE DE\u0301MO';
  h.registered[0].execute({ xml: transferXml.replaceAll('Atelier Pixel Démo', name) });
  const invoice = h.doc.getElementById('invoice');
  const svg = invoice.getElementsByTagName('svg')[0];
  const nodes = formFields(svg, 'beneficiary');
  assert.equal(nodes.map(node => node.textContent).join(''), name);
  assert.equal(nodes.length, 11);
  assert.equal(nodes[0].textContent, 'E\u0301');
  assert.equal(nodes[8].textContent, 'E\u0301');
  const drawn = Array.from(svg.getElementsByTagName('rect')).filter(cell => Number(cell.getAttribute('y')) === 75.62 && Number(cell.getAttribute('width')) === 4.04);
  assert.deepEqual(nodes.map(node => assertCentredInCell(svg, node)), drawn.slice(0, 11));
  assert.ok(invoice.firstChild.textContent.includes(name));
  assert.ok(!invoice.firstChild.textContent.includes(name.normalize('NFC')));
});

test('payer, signature and execution date stay blank while invoice due date remains outside the form', () => {
  const h = harness();
  h.registered[0].execute({ xml: transferXml });
  const slip = h.doc.getElementById('invoice').lastChild;
  const svg = slip.getElementsByTagName('svg')[0];
  const printedFields = Array.from(svg.getElementsByTagName('text')).filter(node => node.hasAttribute('data-field'));
  assert.deepEqual([...new Set(printedFields.map(node => node.getAttribute('data-field')))].sort(),
    ['account', 'beneficiary', 'cents', 'code', 'euros', 'locality', 'reference', 'street']);
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
