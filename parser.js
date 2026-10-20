/* The reader uses namespace URIs and direct paths: prefixes in supplier files vary. */
(() => {
  'use strict';
  const NS = {
    cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  };
  const CUSTOMIZATION = 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
  const MAX_BYTES = 5 * 1024 * 1024;
  function nodes(parent, path) {
    return path.split('/').reduce((parents, part) => {
      const [prefix, name] = part.split(':');
      return parents.flatMap(p => Array.from(p?.childNodes || []).filter(n => n.nodeType === 1 && n.namespaceURI === NS[prefix] && n.localName === name));
    }, parent ? [parent] : []);
  }
  const first = (p, path) => nodes(p, path)[0];
  const value = (p, path) => first(p, path)?.textContent.trim() || '';
  const values = (p, path) => nodes(p, path).map(n => n.textContent.trim()).filter(Boolean);
  const attr = (p, path, name) => first(p, path)?.getAttribute(name) || '';
  const amount = (p, path) => ({ value: value(p, path), currency: attr(p, path, 'currencyID') });
  function party(p) {
    const address = first(p, 'cac:PostalAddress');
    return {
      name: value(p, 'cac:PartyLegalEntity/cbc:RegistrationName') || value(p, 'cac:PartyName/cbc:Name'),
      trading: value(p, 'cac:PartyName/cbc:Name'),
      address: [value(address, 'cbc:StreetName'), value(address, 'cbc:AdditionalStreetName'), ...values(address, 'cac:AddressLine/cbc:Line'), [value(address, 'cbc:PostalZone'), value(address, 'cbc:CityName')].filter(Boolean).join(' '), value(address, 'cbc:CountrySubentity'), value(address, 'cac:Country/cbc:IdentificationCode')].filter(Boolean),
      vat: nodes(p, 'cac:PartyTaxScheme').filter(t => value(t, 'cac:TaxScheme/cbc:ID') === 'VAT').map(t => value(t, 'cbc:CompanyID')).filter(Boolean).join(', '),
      registration: value(p, 'cac:PartyLegalEntity/cbc:CompanyID'),
      endpoint: value(p, 'cbc:EndpointID'),
      contact: [value(p, 'cac:Contact/cbc:Name'), value(p, 'cac:Contact/cbc:Telephone'), value(p, 'cac:Contact/cbc:ElectronicMail')].filter(Boolean),
    };
  }
  function adjustment(n) {
    return { charge: ['true', '1'].includes(value(n, 'cbc:ChargeIndicator')), reason: value(n, 'cbc:AllowanceChargeReason') || value(n, 'cbc:AllowanceChargeReasonCode'), amount: amount(n, 'cbc:Amount'), base: amount(n, 'cbc:BaseAmount'), percent: value(n, 'cbc:MultiplierFactorNumeric') };
  }
  function parseInvoice(xml) {
    if (typeof xml !== 'string' || !xml.trim()) throw new Error('Le fichier est vide. Choisissez une facture XML.');
    if (new TextEncoder().encode(xml).length > MAX_BYTES) throw new Error('Le fichier dépasse la limite de 5 Mo.');
    // DTDs and custom entities have no role in a Peppol invoice.
    if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) throw new Error('Les déclarations DTD et les entités personnalisées ne sont pas prises en charge.');
    let doc;
    try { doc = new DOMParser().parseFromString(xml, 'application/xml'); }
    catch { throw new Error('Le XML est illisible ou mal formé. Vérifiez le fichier d’origine.'); }
    if (!doc?.documentElement || doc.getElementsByTagName('parsererror').length || doc.getElementsByTagNameNS('http://www.mozilla.org/newlayout/xml/parsererror.xml', 'parsererror').length) throw new Error('Le XML est illisible ou mal formé. Vérifiez le fichier d’origine.');
    const root = doc.documentElement;
    const credit = root.localName === 'CreditNote';
    const type = credit ? 'CreditNote' : 'Invoice';
    if (root.localName !== type || root.namespaceURI !== `urn:oasis:names:specification:ubl:schema:xsd:${type}-2`) throw new Error('Format non pris en charge. Choisissez une facture ou une note de crédit UBL Peppol BIS Billing 3.0.');
    if (value(root, 'cbc:CustomizationID') !== CUSTOMIZATION) throw new Error('Ce XML ne déclare pas le format Peppol BIS Billing 3.0 pris en charge.');
    const currency = value(root, 'cbc:DocumentCurrencyCode');
    const lineNodes = nodes(root, credit ? 'cac:CreditNoteLine' : 'cac:InvoiceLine');
    if (!lineNodes.length || !value(root, 'cbc:ID') || !first(root, 'cac:LegalMonetaryTotal')) throw new Error('Document incomplet : numéro, lignes ou totaux de facture absents.');
    if (lineNodes.length > 2000) throw new Error('Cette facture dépasse la limite de 2 000 lignes.');
    const warnings = [];
    if (!/^[A-Z]{3}$/.test(currency)) warnings.push('La devise est absente ou inhabituelle. Les montants sont affichés tels que fournis.');
    const taxTotals = nodes(root, 'cac:TaxTotal');
    // A second TaxTotal may be in an accounting currency. Never combine the two.
    const mainTax = taxTotals.find(t => attr(t, 'cbc:TaxAmount', 'currencyID') === currency && nodes(t, 'cac:TaxSubtotal').length)
      || taxTotals.find(t => attr(t, 'cbc:TaxAmount', 'currencyID') === currency);
    if (!mainTax) warnings.push('Le total TVA dans la devise de la facture est absent.');
    const total = first(root, 'cac:LegalMonetaryTotal');
    const totalFields = ['LineExtensionAmount', 'AllowanceTotalAmount', 'ChargeTotalAmount', 'TaxExclusiveAmount', 'TaxInclusiveAmount', 'PrepaidAmount', 'PayableRoundingAmount', 'PayableAmount'];
    const totals = Object.fromEntries(totalFields.map(key => [key, amount(total, `cbc:${key}`)]));
    for (const key of ['TaxExclusiveAmount', 'TaxInclusiveAmount', 'PayableAmount']) if (!totals[key].value) warnings.push(`Montant absent dans le XML : ${key}.`);
    const supplier = party(first(root, 'cac:AccountingSupplierParty/cac:Party'));
    const customer = party(first(root, 'cac:AccountingCustomerParty/cac:Party'));
    if (!supplier.name || !customer.name) warnings.push('Le nom du fournisseur ou du client est absent.');
    // A document reference is not necessarily a file or a link. Keep only metadata;
    // embedded content is never decoded and external locations are never followed.
    const documents = nodes(root, 'cac:AdditionalDocumentReference').map(n => ({
      id: value(n, 'cbc:ID'), description: value(n, 'cbc:DocumentDescription'), typeCode: value(n, 'cbc:DocumentTypeCode'),
      attachments: nodes(n, 'cac:Attachment/cbc:EmbeddedDocumentBinaryObject').filter(file => file.textContent.trim()).map(file => file.getAttribute('filename') || ''),
      externalLinkCount: nodes(n, 'cac:Attachment/cac:ExternalReference/cbc:URI').filter(uri => uri.textContent.trim()).length,
    })).filter(d => d.id || d.description || d.attachments.length || d.externalLinkCount);
    const attachmentCount = documents.reduce((count, d) => count + d.attachments.length, 0);
    const externalLinkCount = documents.reduce((count, d) => count + d.externalLinkCount, 0);
    if (attachmentCount) warnings.push(attachmentCount === 1
      ? '1 pièce jointe accompagne ce document. Peppol Viewer n’affiche pas son contenu.'
      : `${attachmentCount} pièces jointes accompagnent ce document. Peppol Viewer n’affiche pas leur contenu.`);
    if (externalLinkCount) warnings.push(externalLinkCount === 1
      ? '1 lien renvoie vers un document complémentaire. Peppol Viewer ne l’ouvre pas.'
      : `${externalLinkCount} liens renvoient vers des documents complémentaires. Peppol Viewer ne les ouvre pas.`);
    const invoice = {
      credit, id: value(root, 'cbc:ID'), typeCode: value(root, credit ? 'cbc:CreditNoteTypeCode' : 'cbc:InvoiceTypeCode'),
      issueDate: value(root, 'cbc:IssueDate'), dueDate: value(root, 'cbc:DueDate') || value(root, 'cac:PaymentMeans/cbc:PaymentDueDate'), currency,
      supplier, customer, payee: first(root, 'cac:PayeeParty') ? party(first(root, 'cac:PayeeParty')) : null,
      references: [
        ['Commande', value(root, 'cac:OrderReference/cbc:ID')], ['Référence acheteur', value(root, 'cbc:BuyerReference')],
        ['Contrat', value(root, 'cac:ContractDocumentReference/cbc:ID')],
        ['Facture d’origine', values(root, 'cac:BillingReference/cac:InvoiceDocumentReference/cbc:ID').join(', ')],
        ['Période', [value(root, 'cac:InvoicePeriod/cbc:StartDate'), value(root, 'cac:InvoicePeriod/cbc:EndDate')].filter(Boolean).map(date).join(' → ')],
      ].filter(([, v]) => v),
      lines: lineNodes.map(line => {
        const quantityPath = credit ? 'cbc:CreditedQuantity' : 'cbc:InvoicedQuantity';
        const price = first(line, 'cac:Price');
        return {
          id: value(line, 'cbc:ID'), name: value(line, 'cac:Item/cbc:Name'), descriptions: values(line, 'cac:Item/cbc:Description'), notes: values(line, 'cbc:Note'),
          quantity: value(line, quantityPath), unit: attr(line, quantityPath, 'unitCode'),
          price: amount(price, 'cbc:PriceAmount'), priceBase: value(price, 'cbc:BaseQuantity'), priceUnit: attr(price, 'cbc:BaseQuantity', 'unitCode'),
          taxCategory: value(line, 'cac:Item/cac:ClassifiedTaxCategory/cbc:ID'), taxPercent: value(line, 'cac:Item/cac:ClassifiedTaxCategory/cbc:Percent'),
          amount: amount(line, 'cbc:LineExtensionAmount'), adjustments: nodes(line, 'cac:AllowanceCharge').map(adjustment),
        };
      }),
      adjustments: nodes(root, 'cac:AllowanceCharge').map(adjustment), totals,
      taxAmount: mainTax ? amount(mainTax, 'cbc:TaxAmount') : { value: '', currency },
      taxes: nodes(mainTax, 'cac:TaxSubtotal').map(t => ({ base: amount(t, 'cbc:TaxableAmount'), amount: amount(t, 'cbc:TaxAmount'), category: value(t, 'cac:TaxCategory/cbc:ID'), percent: value(t, 'cac:TaxCategory/cbc:Percent'), exemption: value(t, 'cac:TaxCategory/cbc:TaxExemptionReason') || value(t, 'cac:TaxCategory/cbc:TaxExemptionReasonCode') })),
      payments: nodes(root, 'cac:PaymentMeans').map(p => ({ code: value(p, 'cbc:PaymentMeansCode'), reference: value(p, 'cbc:PaymentID'), account: value(p, 'cac:PayeeFinancialAccount/cbc:ID'), name: value(p, 'cac:PayeeFinancialAccount/cbc:Name'), bank: value(p, 'cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cbc:ID'), mandate: value(p, 'cac:PaymentMandate/cbc:ID') })),
      terms: values(root, 'cac:PaymentTerms/cbc:Note'), notes: values(root, 'cbc:Note'), documents, warnings,
    };
    if (invoice.lines.some(l => !l.name || !l.quantity || !l.amount.value)) warnings.push('Certaines lignes sont incomplètes. Les données absentes sont indiquées par un tiret.');
    return invoice;
  }
  // Work on decimal strings to preserve invoice precision, including very large amounts.
  function decimal(raw, minimum = 0) {
    const s = String(raw ?? '').trim();
    if (!s) return '—';
    const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(s);
    if (!match) return s;
    const integer = match[2].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
    const fraction = (match[3] || '').padEnd(minimum, '0');
    return `${match[1]}${integer}${fraction ? ',' + fraction : ''}`;
  }
  function money(a, fallback = '') {
    if (!a?.value) return '—';
    return `${decimal(a.value, 2)}${a.currency || fallback ? '\u00a0' + (a.currency || fallback) : ''}`;
  }
  function date(raw) {
    if (!raw) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
  }
  function decodeXml(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.byteLength > MAX_BYTES) throw new Error('Le fichier dépasse la limite de 5 Mo.');
    let encoding = 'utf-8';
    if ((bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 60 && bytes[1] === 0)) encoding = 'utf-16le';
    else if ((bytes[0] === 254 && bytes[1] === 255) || (bytes[0] === 0 && bytes[1] === 60)) encoding = 'utf-16be';
    else {
      const prolog = String.fromCharCode(...bytes.slice(0, 250));
      const declared = /^\s*<\?xml\b[^?]*\bencoding\s*=\s*["']([^"']+)["']/i.exec(prolog)?.[1];
      if (declared) encoding = declared;
    }
    try { return new TextDecoder(encoding, { fatal: true }).decode(bytes); }
    catch { throw new Error('L’encodage du XML est inconnu ou invalide. Essayez un export UTF-8.'); }
  }
  globalThis.Peppol = Object.freeze({ parseInvoice, decimal, money, date, decodeXml, MAX_BYTES });
})();
