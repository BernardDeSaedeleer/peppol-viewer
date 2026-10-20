import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
// Match the browser's fail-closed behavior for malformed XML.
globalThis.DOMParser = class extends DOMParser {
  constructor() { super({ onError: level => { if (level !== 'warning') throw new Error('XML invalid'); } }); }
};
await import('../parser.js');
const { parseInvoice, decimal, money, decodeXml, MAX_BYTES } = globalThis.Peppol;
const fixture = name => fs.readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8');
const base = fixture('base-example.xml');

test('official invoice: independent reference amounts and parties', () => {
  const i = parseInvoice(base);
  assert.equal(i.credit, false);
  assert.equal(i.supplier.name, 'SupplierOfficialName Ltd');
  assert.equal(i.lines.length, 2);
  assert.equal(i.lines[0].quantity, '7');
  assert.equal(i.totals.TaxExclusiveAmount.value, '1325');
  assert.equal(i.taxAmount.value, '331.25');
  assert.equal(i.totals.PayableAmount.value, '1656.25');
});
test('credit notes use credited quantity and preserve their original signs', () => {
  const i = parseInvoice(fixture('base-creditnote-correction.xml'));
  assert.equal(i.credit, true);
  assert.equal(i.lines[0].quantity, '7');
  assert.equal(i.totals.PayableAmount.value, '1656.25');
});
test('official discounts, charges, prepayment and multiple tax categories', () => {
  const i = parseInvoice(fixture('Allowance-example.xml'));
  assert.equal(i.totals.AllowanceTotalAmount.value, '200');
  assert.equal(i.totals.ChargeTotalAmount.value, '200');
  assert.equal(i.totals.PrepaidAmount.value, '1000');
  assert.equal(i.totals.PayableAmount.value, '6125.00');
  assert.deepEqual(i.taxes.map(t => t.category), ['S', 'E']);
  assert.ok(i.lines.some(l => l.adjustments.length));
  assert.ok(i.warnings.some(w => w.startsWith('1 lien renvoie')));
  assert.ok(!i.warnings.some(w => w.includes('pièce jointe')));
});
test('plain document references and empty attachment fields do not raise attachment warnings', () => {
  const demo = parseInvoice(decodeXml(fs.readFileSync(new URL('../exemples/06-devise-usd-utf16.xml', import.meta.url))));
  assert.equal(demo.warnings.length, 0);
  assert.equal(demo.documents[0].id, 'ANNEXE-DEMO');
  assert.deepEqual(demo.documents[0].attachments, []);
  assert.equal(demo.documents[0].externalLinkCount, 0);
  const reference = `<cac:AdditionalDocumentReference><cbc:ID>REF-SEULE</cbc:ID><cbc:DocumentDescription>Bon de livraison connu du client</cbc:DocumentDescription><cac:Attachment><cbc:EmbeddedDocumentBinaryObject filename="vide.pdf"> </cbc:EmbeddedDocumentBinaryObject><cac:ExternalReference><cbc:URI> </cbc:URI></cac:ExternalReference></cac:Attachment><other:Attachment xmlns:other="urn:foreign"><cbc:EmbeddedDocumentBinaryObject>QQ==</cbc:EmbeddedDocumentBinaryObject></other:Attachment></cac:AdditionalDocumentReference>`;
  const i = parseInvoice(base.replace('<cac:AccountingSupplierParty>', reference + '<cac:AccountingSupplierParty>'));
  assert.equal(i.warnings.length, 0);
  assert.equal(i.documents[0].description, 'Bon de livraison connu du client');
  assert.deepEqual(i.documents[0].attachments, []);
  assert.equal(i.documents[0].externalLinkCount, 0);
});
test('embedded files and external links are counted separately without retaining their content', () => {
  for (const count of [1, 2]) {
    const references = Array.from({ length: count }, (_, n) => `<cac:AdditionalDocumentReference><cbc:ID>PIECE-${n}</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject filename="annexe-${n}.pdf" mimeCode="application/pdf">JVBERi0xLjQ=</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference><cac:AdditionalDocumentReference><cbc:ID>LIEN-${n}</cbc:ID><cac:Attachment><cac:ExternalReference><cbc:URI>https://example.invalid/justificatif-${n}</cbc:URI></cac:ExternalReference></cac:Attachment></cac:AdditionalDocumentReference>`).join('');
    const i = parseInvoice(base.replace('<cac:AccountingSupplierParty>', references + '<cac:AccountingSupplierParty>'));
    assert.equal(i.warnings.length, 2);
    assert.match(i.warnings[0], new RegExp(`^${count} pièce${count === 1 ? '' : 's'} jointe`));
    assert.match(i.warnings[1], new RegExp(`^${count} lien${count === 1 ? '' : 's'} renvoi`));
    assert.equal(i.documents.flatMap(d => d.attachments).length, count);
    assert.equal(i.documents.reduce((total, d) => total + d.externalLinkCount, 0), count);
    assert.ok(i.documents.some(d => d.attachments.includes('annexe-0.pdf')));
    assert.doesNotMatch(JSON.stringify(i.documents), /JVBERi0xLjQ=|https:\/\/example/);
  }
});
test('VAT exemption and non-euro currency', () => {
  const i = parseInvoice(fixture('vat-category-E.xml'));
  assert.equal(i.currency, 'GBP');
  assert.equal(i.taxes[0].exemption, 'VATEX-EU-F');
  assert.equal(i.taxAmount.value, '0.00');
});
test('XML namespace prefixes can vary', () => {
  const changed = base.replaceAll('cbc:', 'basic:').replaceAll('xmlns:cbc=', 'xmlns:basic=').replaceAll('cac:', 'aggregate:').replaceAll('xmlns:cac=', 'xmlns:aggregate=');
  assert.deepEqual(parseInvoice(changed), parseInvoice(base));
});
test('an accounting-currency tax total never replaces invoice-currency VAT', () => {
  const changed = base.replace('<cac:TaxTotal>', '<cac:TaxTotal><cbc:TaxAmount currencyID="USD">999.99</cbc:TaxAmount></cac:TaxTotal><cac:TaxTotal>');
  assert.equal(parseInvoice(changed).taxAmount.value, '331.25');
});
test('money formatting preserves precision and negative amounts without recalculation', () => {
  assert.equal(decimal('9007199254740993.123456', 2), '9\u202f007\u202f199\u202f254\u202f740\u202f993,123456');
  assert.equal(money({ value: '-12.10', currency: 'EUR' }), '-12,10\u00a0EUR');
  assert.equal(money({ value: '0', currency: 'EUR' }), '0,00\u00a0EUR');
  assert.equal(money({ value: '' }), '—');
});
test('untrusted values remain text in the parsed model', () => {
  const xml = base.replace('SupplierOfficialName Ltd', '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(parseInvoice(xml).supplier.name, '<img src=x onerror=alert(1)>');
});
test('empty, malformed, unsupported, oversized and DTD inputs are rejected', () => {
  for (const xml of ['', '<Invoice>', '<html/>', base.replace('billing:3.0', 'billing:2.0'), '<!DOCTYPE Invoice [<!ENTITY x SYSTEM "file:///secret">]>' + base, ' '.repeat(MAX_BYTES) + base]) {
    assert.throws(() => parseInvoice(xml));
  }
});
test('invoice names in the wrong namespace are rejected', () => {
  assert.throws(() => parseInvoice(base.replace('schema:xsd:Invoice-2', 'schema:xsd:Unknown-2')), /Format/);
});
test('incomplete documents do not display a misleading zero total', () => {
  const xml = base.replace(/<cbc:PayableAmount[^>]*>[^<]*<\/cbc:PayableAmount>/, '');
  const i = parseInvoice(xml);
  assert.equal(money(i.totals.PayableAmount), '—');
  assert.ok(i.warnings.some(w => w.includes('PayableAmount')));
  assert.throws(() => parseInvoice(base.replace(/<cac:LegalMonetaryTotal>[\s\S]*?<\/cac:LegalMonetaryTotal>/, '')), /incomplet/);
});
test('UTF-8, UTF-16 and declared legacy encodings are decoded explicitly', () => {
  assert.equal(decodeXml(new TextEncoder().encode('été')), 'été');
  const utf16 = Buffer.from('\ufeff<?xml version="1.0" encoding="UTF-16"?><x>été</x>', 'utf16le');
  assert.match(decodeXml(utf16), /été/);
  const latin = Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><x>été</x>', 'latin1');
  assert.match(decodeXml(latin), /été/);
  assert.throws(() => decodeXml(new Uint8Array([0xff])), /encodage/);
});
