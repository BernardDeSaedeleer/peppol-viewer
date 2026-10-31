import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';

globalThis.DOMParser = DOMParser;
await import('../parser.js');
const { paymentReference, transferDetails, febelfinDetails, parseInvoice } = globalThis.Peppol;

// Synthetic accounts with valid IBAN check digits; no real beneficiary or customer.
const BE = 'BE54000000000097';
const DE = 'DE36000000000000000000';
const REFERENCE = '123456789002';
const FORMATTED = '+++123/4567/89002+++';
const invoice = () => ({
  credit: false, currency: 'EUR', dueDate: '2030-02-03',
  supplier: { name: 'Entreprise fictive', address: ['Rue de démonstration 1', '0000 Ville fictive'] },
  payee: null,
  totals: { PayableAmount: { value: '1986.25', currency: 'EUR' } },
  payments: [{ code: '58', reference: REFERENCE, account: BE, name: '', bank: 'DEMOXXXX', mandate: '' }],
});

test('Belgian references accept ordinary separators and preserve all twelve digits', () => {
  for (const reference of [REFERENCE, FORMATTED, '123/4567/89002', '123 4567 89002', '123-4567-89002', '123.4567.89002', '  +++123 / 4567 / 89002+++  ']) {
    assert.deepEqual(paymentReference(reference, BE), { text: FORMATTED, structured: true });
  }
  assert.deepEqual(paymentReference('000000000101', BE), { text: '+++000/0000/00101+++', structured: true });
  assert.deepEqual(paymentReference('000000009797', BE), { text: '+++000/0000/09797+++', structured: true });
  assert.deepEqual(paymentReference(REFERENCE, 'be54 0000 0000 0097'), { text: FORMATTED, structured: true });
});

test('free, RF, malformed and invalid Belgian references remain exactly as supplied', () => {
  for (const reference of [' RF18 5390 0754 7034 ', ' Facture DEMO-42 ', '123456789003', '000000009700', '+++123/4567/89003+++', '+123456789002+', '1234567890029', '', '  ']) {
    assert.deepEqual(paymentReference(reference, BE), { text: reference, structured: false });
  }
  for (const account of ['', DE, 'BE55000000000097', 'BE0000']) {
    assert.deepEqual(paymentReference(REFERENCE, account), { text: REFERENCE, structured: false });
  }
});

test('explicit transfer codes yield the same complete details without mutating the invoice', () => {
  for (const code of ['30', '58', '42']) {
    const data = invoice();
    data.payments[0].code = code;
    const before = structuredClone(data);
    const details = transferDetails(data);
    assert.deepEqual(details, {
      beneficiary: 'Entreprise fictive', address: data.supplier.address,
      account: 'BE54 0000 0000 0097', bank: 'DEMOXXXX',
      reference: { text: FORMATTED, structured: true }, euros: '1986', cents: '25', dueDate: '2030-02-03',
    });
    assert.deepEqual(data, before);
    details.address.push('Changed only in the returned details');
    assert.deepEqual(data, before);
  }
});

test('explicit transfers support non-Belgian IBANs and preserve free or absent references', () => {
  for (const reference of ['RF18 5390 0754 7034', 'DEMO-FREE', '']) {
    const data = invoice();
    Object.assign(data.payments[0], { account: DE, reference });
    const details = transferDetails(data);
    assert.equal(details.account, 'DE36 0000 0000 0000 0000 00');
    assert.deepEqual(details.reference, { text: reference, structured: false });
  }
});

test('undefined payment means require both a valid Belgian IBAN and Belgian communication', () => {
  for (const code of ['1', '']) {
    const data = invoice();
    data.payments[0].code = code;
    assert.ok(transferDetails(data));
    data.payments[0].reference = 'Facture fictive';
    assert.equal(transferDetails(data), null);
    data.payments[0].reference = '123456789003';
    assert.equal(transferDetails(data), null);
    data.payments[0].reference = REFERENCE;
    data.payments[0].account = DE;
    assert.equal(transferDetails(data), null);
  }
});

test('unsupported means, mandates, multiple means and multiple accounts cannot produce a slip', () => {
  for (const code of ['10', '48', '49', '59', '97', '999']) {
    const data = invoice();
    data.payments[0].code = code;
    assert.equal(transferDetails(data), null, code);
  }
  for (const change of [
    data => { data.payments = []; },
    data => { data.payments.push({ ...data.payments[0] }); },
    data => { data.payments[0].accountCount = 2; },
    data => { data.payments[0].accountCount = 0; },
    data => { data.payments[0].hasMandate = true; },
    data => { data.payments[0].hasCardAccount = true; },
    data => { data.payments[0].mandate = 'DEMO-MANDATE'; },
  ]) {
    const data = invoice();
    change(data);
    assert.equal(transferDetails(data), null);
  }
});

test('IBAN syntax and checksum failures cannot produce a slip', () => {
  for (const account of ['', 'COMPTE-FICTIF', 'BE55000000000097', 'BE5400000000009', 'BE54A00000000097', 'BE54-0000-0000-0097', 'BE99000000000063', 'BE01000000000081', 'DE3600000000000000000000', 'ZZ66000000000000', BE + ';' + DE]) {
    const data = invoice();
    data.payments[0].account = account;
    assert.equal(transferDetails(data), null, account);
  }
});

test('credit notes, currencies, missing amounts and non-positive or imprecise amounts are excluded', () => {
  for (const change of [
    data => { data.credit = true; },
    data => { delete data.credit; },
    data => { data.currency = 'USD'; },
    data => { data.currency = ''; },
    data => { data.totals.PayableAmount.currency = 'USD'; },
    data => { delete data.totals.PayableAmount; },
  ]) {
    const data = invoice();
    change(data);
    assert.equal(transferDetails(data), null);
  }
  for (const value of ['', '0', '+0.000', '-1', '-0.01', '0.001', '1.239', '1.230001', '1,25', '1e3', 'Infinity']) {
    const data = invoice();
    data.totals.PayableAmount.value = value;
    assert.equal(transferDetails(data), null, value);
  }
});

test('payable amounts retain exact cents, huge integers and additional zero precision', () => {
  for (const [value, euros, cents] of [
    ['1986', '1986', '00'], ['0.01', '0', '01'], ['00012.3', '12', '30'],
    ['+42.5000', '42', '50'], ['90071992547409931234567890.01000', '90071992547409931234567890', '01'],
  ]) {
    const data = invoice();
    data.totals.PayableAmount = { value, currency: '' };
    data.totals.TaxInclusiveAmount = { value: '9999', currency: 'EUR' };
    data.totals.PrepaidAmount = { value: '9998', currency: 'EUR' };
    const details = transferDetails(data);
    assert.equal(details.euros, euros);
    assert.equal(details.cents, cents);
  }
});

test('beneficiary priority keeps each address attached to its actual named party', () => {
  const data = invoice();
  data.payments[0].name = 'Titulaire fictif distinct';
  assert.equal(transferDetails(data).beneficiary, 'Titulaire fictif distinct');
  assert.deepEqual(transferDetails(data).address, []);
  data.payments[0].name = data.supplier.name;
  assert.deepEqual(transferDetails(data).address, data.supplier.address);
  data.payee = { name: 'Bénéficiaire fictif prioritaire', address: ['Adresse du bénéficiaire'] };
  assert.equal(transferDetails(data).beneficiary, data.payee.name);
  assert.deepEqual(transferDetails(data).address, data.payee.address);
  data.payee.address = [];
  assert.deepEqual(transferDetails(data).address, []);
  data.payee = null;
  data.payments[0].name = '';
  data.supplier.name = '';
  assert.equal(transferDetails(data), null);
});

test('XML parsing preserves ambiguous accounts, cards and empty mandates for exclusion', () => {
  const account = `<cac:PayeeFinancialAccount><cbc:ID>${BE}</cbc:ID></cac:PayeeFinancialAccount>`;
  const xml = payment => `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
    <cbc:ID>DEMO-ONLY</cbc:ID><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
    <cac:AccountingSupplierParty><cac:Party><cac:PartyName><cbc:Name>Entreprise fictive</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
    <cac:PaymentMeans><cbc:PaymentMeansCode>1</cbc:PaymentMeansCode><cbc:PaymentID>${REFERENCE}</cbc:PaymentID>${payment}</cac:PaymentMeans>
    <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="EUR">42.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
    <cac:InvoiceLine><cbc:ID>1</cbc:ID></cac:InvoiceLine>
  </Invoice>`;
  const valid = parseInvoice(xml(account));
  assert.equal(valid.payments[0].accountCount, 1);
  assert.equal(valid.payments[0].hasMandate, false);
  assert.ok(transferDetails(valid));
  const multiple = parseInvoice(xml(account + account));
  assert.equal(multiple.payments[0].accountCount, 2);
  assert.equal(transferDetails(multiple), null);
  const multipleIds = parseInvoice(xml(`<cac:PayeeFinancialAccount><cbc:ID>${BE}</cbc:ID><cbc:ID>${DE}</cbc:ID></cac:PayeeFinancialAccount>`));
  assert.equal(multipleIds.payments[0].accountCount, 2);
  assert.equal(transferDetails(multipleIds), null);
  const card = parseInvoice(xml(account + '<cac:CardAccount/>').replace('<cbc:PaymentMeansCode>1</cbc:PaymentMeansCode>', '<cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>'));
  assert.equal(card.payments[0].hasCardAccount, true);
  assert.equal(transferDetails(card), null);
  const mandate = parseInvoice(xml(account + '<cac:PaymentMandate/>'));
  assert.equal(mandate.payments[0].mandate, '');
  assert.equal(mandate.payments[0].hasMandate, true);
  assert.equal(transferDetails(mandate), null);
});

const formInvoice = () => {
  const data = invoice();
  data.supplier.postal = {
    street: 'Rue de démonstration 1', additionalStreet: '', addressLines: [],
    postalCode: '0000', city: 'Ville fictive', region: '', country: 'BE',
  };
  return data;
};

test('the fixed form keeps exact payment data and uses separate uppercase display fields', () => {
  const data = formInvoice();
  data.payments[0].bank = 'demobebbxxx';
  const before = structuredClone(data);
  const result = febelfinDetails(data);
  assert.equal(result.reason, '');
  assert.deepEqual(result.fields, {
    beneficiary: 'ENTREPRISE FICTIVE', street: 'RUE DE DÉMONSTRATION 1', locality: 'BE 0000 VILLE FICTIVE',
    account: 'BE54 0000 0000 0097', bank: 'DEMOBEBBXXX', reference: FORMATTED,
    euros: '1986', cents: '25', code: '03',
  });
  assert.deepEqual(result.transfer, transferDetails(data));
  assert.deepEqual(data, before);
  assert.equal('dueDate' in result.fields, false);
  assert.equal('executionDate' in result.fields, false);
  data.payments[0].reference = 'Facture Demo-42 + 7/2=X';
  assert.equal(febelfinDetails(data).fields.reference, 'FACTURE DEMO-42 + 7/2=X');
  assert.equal(febelfinDetails(data).fields.code, '02');
  assert.equal(data.payments[0].reference, 'Facture Demo-42 + 7/2=X');
  data.payments[0].reference = '';
  assert.equal(febelfinDetails(data).fields.reference, '');
});

test('fixed form boundary capacities reject overflow without cutting values', () => {
  for (const [field, change] of [
    ['beneficiary', (data, value) => { data.supplier.name = value; }],
    ['street', (data, value) => { data.supplier.postal.street = value; }],
    ['locality', (data, value) => { Object.assign(data.supplier.postal, { country: '', postalCode: '', city: value }); }],
  ]) {
    const data = formInvoice();
    change(data, 'A'.repeat(26));
    assert.equal(febelfinDetails(data).fields[field], 'A'.repeat(26), field);
    change(data, 'A'.repeat(27));
    const before = structuredClone(data);
    const result = febelfinDetails(data);
    assert.match(result.reason, /26 caractères/);
    assert.equal('fields' in result, false);
    assert.deepEqual(data, before);
  }
  const data = formInvoice();
  data.payments[0].reference = 'A'.repeat(34);
  assert.equal(febelfinDetails(data).fields.reference, 'A'.repeat(34));
  data.payments[0].reference += 'A';
  assert.match(febelfinDetails(data).reason, /34 caractères/);
  assert.equal(febelfinDetails(data).transfer.reference.text, 'A'.repeat(35));
  data.payments[0].reference = '';
  data.totals.PayableAmount.value = '99999999.9900';
  assert.equal(febelfinDetails(data).fields.euros, '99999999');
  assert.equal(febelfinDetails(data).fields.cents, '99');
  data.totals.PayableAmount.value = '100000000.00';
  assert.match(febelfinDetails(data).reason, /huit cases/);
  assert.equal(febelfinDetails(data).transfer.euros, '100000000');
  data.totals.PayableAmount.value = '90071992547409931234567890.01';
  assert.equal(febelfinDetails(data).transfer.euros, '90071992547409931234567890');
});

test('form limits apply after uppercase, with no transliteration, entity repair or space collapsing', () => {
  const data = formInvoice();
  data.supplier.name = 'École Œuvre d’Été';
  assert.equal(febelfinDetails(data).fields.beneficiary, 'ÉCOLE ŒUVRE D’ÉTÉ');
  data.supplier.name = 'A'.repeat(25) + 'ß';
  assert.match(febelfinDetails(data).reason, /26 caractères/);
  for (const name of ['Test &apos; nom', 'Test &#39; nom', 'Test &#x27; nom', 'Test\nnom', 'Test\tnom', 'Test \u202enom', 'Entreprise 测试']) {
    data.supplier.name = name;
    const result = febelfinDetails(data);
    assert.ok(result.reason, name);
    assert.equal(result.transfer.beneficiary, name);
    assert.equal(data.supplier.name, name);
  }
  data.supplier.name = 'Entreprise fictive';
  for (const reference of ['Facture &apos; test', 'FA\tCTURE', 'Facture 42.', 'Réf 42', '<script>bad</script>']) {
    data.payments[0].reference = reference;
    const result = febelfinDetails(data);
    assert.ok(result.reason, reference);
    assert.equal(result.transfer.reference.text, reference);
    assert.equal(data.payments[0].reference, reference);
  }
  data.payments[0].reference = ' REF  42 ';
  assert.equal(febelfinDetails(data).fields.reference, ' REF  42 ');
});

test('form BIC accepts eight or eleven characters and never removes unexpected characters', () => {
  const data = formInvoice();
  for (const bank of ['', 'DEMOBEBB', 'demobebb123']) {
    data.payments[0].bank = bank;
    assert.equal(febelfinDetails(data).fields.bank, bank.toUpperCase());
  }
  for (const bank of ['DEMO', 'DEMO BE BB', 'DEMOBEBB1234', '1234BEBB', 'DEMOBEBB\n']) {
    data.payments[0].bank = bank;
    const result = febelfinDetails(data);
    assert.match(result.reason, /BIC/);
    assert.equal(result.transfer.bank, bank);
  }
});

test('form address placement preserves all components and keeps the actual beneficiary association', () => {
  const data = formInvoice();
  Object.assign(data.supplier.postal, { street: 'Rue 1', additionalStreet: 'Bât. B', addressLines: ['Boîte 2'] });
  assert.equal(febelfinDetails(data).fields.street, 'RUE 1 BÂT. B BOÎTE 2');
  data.supplier.postal.addressLines.push('Complément trop long');
  assert.match(febelfinDetails(data).reason, /26 caractères/);
  data.supplier.postal.addressLines = [];
  data.supplier.postal.region = 'Région fictive';
  assert.match(febelfinDetails(data).reason, /région/);
  data.payments[0].name = 'Titulaire distinct';
  assert.equal(febelfinDetails(data).fields.beneficiary, 'TITULAIRE DISTINCT');
  assert.equal(febelfinDetails(data).fields.street, '');
  assert.equal(febelfinDetails(data).fields.locality, '');
  data.payee = { name: 'Autre bénéficiaire', address: ['Rue 2', '0000 Autreville', 'BE'], postal: {
    street: 'Rue 2', additionalStreet: '', addressLines: [], postalCode: '0000', city: 'Autreville', region: '', country: 'BE',
  } };
  assert.equal(febelfinDetails(data).fields.beneficiary, 'AUTRE BÉNÉFICIAIRE');
  assert.equal(febelfinDetails(data).fields.street, 'RUE 2');
  assert.equal(febelfinDetails(data).fields.locality, 'BE 0000 AUTREVILLE');
  delete data.payee.postal;
  assert.match(febelfinDetails(data).reason, /sans être interprétée/);
  data.payee.address = [];
  assert.equal(febelfinDetails(data).fields.street, '');
});

test('form preparation preserves deeply frozen parsed XML, including normally decoded and double-escaped entities', () => {
  const xml = `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
    <cbc:ID>DEMO-ONLY</cbc:ID><cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
    <cac:AccountingSupplierParty><cac:Party><cac:PartyName><cbc:Name>L&apos;École fictive</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:StreetName>Rue d&apos;Été 2</cbc:StreetName><cbc:PostalZone>0000</cbc:PostalZone><cbc:CityName>Ville</cbc:CityName><cac:Country><cbc:IdentificationCode>BE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    </cac:Party></cac:AccountingSupplierParty>
    <cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cbc:PaymentID>${REFERENCE}</cbc:PaymentID><cac:PayeeFinancialAccount><cbc:ID>${BE}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>
    <cac:LegalMonetaryTotal><cbc:PayableAmount currencyID="EUR">42.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
    <cac:InvoiceLine><cbc:ID>1</cbc:ID></cac:InvoiceLine>
  </Invoice>`;
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const data = freeze(parseInvoice(xml));
  const before = structuredClone(data);
  const result = febelfinDetails(data);
  assert.equal(result.fields.beneficiary, "L'ÉCOLE FICTIVE");
  assert.equal(result.fields.street, "RUE D'ÉTÉ 2");
  assert.equal(result.fields.locality, 'BE 0000 VILLE');
  assert.deepEqual(data, before);
  assert.deepEqual(data.supplier.address, ["Rue d'Été 2", '0000 Ville', 'BE']);
  assert.equal(data.supplier.postal.street, "Rue d'Été 2");
  const escaped = freeze(parseInvoice(xml.replaceAll('&apos;', '&amp;apos;')));
  const escapedBefore = structuredClone(escaped);
  assert.ok(febelfinDetails(escaped).reason);
  assert.equal(escaped.supplier.name, 'L&apos;École fictive');
  assert.equal(escaped.supplier.postal.street, 'Rue d&apos;Été 2');
  assert.deepEqual(escaped, escapedBefore);
});

test('the fixed form retains all existing transfer eligibility exclusions', () => {
  for (const change of [
    data => { data.credit = true; }, data => { data.currency = 'USD'; },
    data => { data.payments[0].account = 'BE0000'; }, data => { data.payments[0].hasMandate = true; },
    data => { data.payments.push({ ...data.payments[0] }); }, data => { data.totals.PayableAmount.value = '0'; },
  ]) {
    const data = formInvoice();
    change(data);
    assert.equal(febelfinDetails(data), null);
  }
});
