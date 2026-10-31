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
      postal: {
        street: value(address, 'cbc:StreetName'), additionalStreet: value(address, 'cbc:AdditionalStreetName'),
        addressLines: values(address, 'cac:AddressLine/cbc:Line'), postalCode: value(address, 'cbc:PostalZone'),
        city: value(address, 'cbc:CityName'), region: value(address, 'cbc:CountrySubentity'),
        country: value(address, 'cac:Country/cbc:IdentificationCode'),
      },
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
      payments: nodes(root, 'cac:PaymentMeans').map(p => ({ code: value(p, 'cbc:PaymentMeansCode'), reference: value(p, 'cbc:PaymentID'), account: value(p, 'cac:PayeeFinancialAccount/cbc:ID'), accountCount: Math.max(nodes(p, 'cac:PayeeFinancialAccount').length, nodes(p, 'cac:PayeeFinancialAccount/cbc:ID').length), name: value(p, 'cac:PayeeFinancialAccount/cbc:Name'), bank: value(p, 'cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cbc:ID'), mandate: value(p, 'cac:PaymentMandate/cbc:ID'), hasMandate: !!first(p, 'cac:PaymentMandate'), hasCardAccount: !!first(p, 'cac:CardAccount') })),
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
  function modulo97(digits) {
    let remainder = 0;
    for (const digit of digits) remainder = (remainder * 10 + digit.charCodeAt(0) - 48) % 97;
    return remainder;
  }
  function checkedIban(account) {
    const iban = String(account ?? '').replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return '';
    if (iban.slice(2, 4) < '02' || iban.slice(2, 4) > '98') return '';
    // A checksum alone also accepts invented countries or wrong national lengths.
    // SWIFT IBAN Registry, release 103: https://www.swift.com/swift-resource/9606/download
    const lengths = { AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27,
      BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28, EE: 20,
      EG: 29, ES: 24, FI: 18, FK: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27,
      GT: 28, HN: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30,
      KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, LY: 25, MC: 27, MD: 24, ME: 22,
      MK: 19, MN: 20, MR: 27, MT: 31, MU: 30, NI: 28, NL: 18, NO: 15, OM: 23, PK: 24, PL: 28,
      PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, RU: 33, SA: 24, SC: 31, SD: 18, SE: 24, SI: 19,
      SK: 24, SM: 27, SO: 23, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24,
      XK: 20, YE: 30 };
    if (iban.length !== lengths[iban.slice(0, 2)]) return '';
    if (iban.startsWith('BE') && !/^BE\d{14}$/.test(iban)) return '';
    const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, letter => String(letter.charCodeAt(0) - 55));
    return modulo97(digits) === 1 ? iban : '';
  }
  function paymentReference(reference, account) {
    const text = String(reference ?? '');
    const unchanged = { text, structured: false };
    if (!checkedIban(account).startsWith('BE')) return unchanged;
    const trimmed = text.trim();
    const body = trimmed.startsWith('+++') && trimmed.endsWith('+++') ? trimmed.slice(3, -3) : trimmed;
    if (!/^[\d\s/.-]+$/.test(body)) return unchanged;
    const digits = body.replace(/[\s/.-]/g, '');
    if (!/^\d{12}$/.test(digits)) return unchanged;
    const check = String(modulo97(digits.slice(0, 10)) || 97).padStart(2, '0');
    if (digits.slice(10) !== check) return unchanged;
    return { text: `+++${digits.slice(0, 3)}/${digits.slice(3, 7)}/${digits.slice(7)}+++`, structured: true };
  }
  function assessTransfer(data) {
    const unavailable = reason => ({ transfer: null, reason });
    if (data?.credit === true) return unavailable('Une note de crédit ne donne pas lieu à un bulletin de virement.');
    if (data?.credit !== false) return unavailable('Le type de document ne permet pas d’établir un bulletin de virement.');
    if (!data.currency) return unavailable('La devise de la facture est absente.');
    if (data.currency !== 'EUR') return unavailable('Le bulletin est réservé aux factures en euros.');
    if (!data.payments?.length) return unavailable('Aucun moyen de paiement n’est renseigné dans la facture.');
    if (data.payments.length !== 1) return unavailable('Plusieurs moyens de paiement sont renseignés ; aucun n’est choisi automatiquement.');
    const payment = data.payments[0];
    if (!payment) return unavailable('Les informations du moyen de paiement sont absentes.');
    if (payment.hasMandate || payment.mandate) return unavailable('Un mandat de paiement est renseigné ; aucun bulletin de virement n’est proposé.');
    if (payment.hasCardAccount) return unavailable('Un paiement par carte est renseigné ; aucun bulletin de virement n’est proposé.');
    const code = String(payment.code ?? '').trim();
    if (code === '10') return unavailable('Le paiement est prévu en espèces.');
    if (code === '48') return unavailable('Le paiement est prévu par carte.');
    if (['49', '59'].includes(code)) return unavailable('Le paiement est prévu par prélèvement.');
    if (!['30', '58', '42', '1', ''].includes(code)) return unavailable('Le moyen de paiement indiqué ne permet pas d’établir un bulletin de virement.');
    if (payment.accountCount === 0) return unavailable('Aucun compte bénéficiaire n’est renseigné.');
    if (payment.accountCount !== undefined && payment.accountCount !== 1) return unavailable('Le compte bénéficiaire ne peut pas être choisi sans ambiguïté.');
    if (!String(payment.account ?? '').trim()) return unavailable('L’IBAN du bénéficiaire est absent.');
    const account = checkedIban(payment.account);
    if (!account) return unavailable('L’IBAN du bénéficiaire est invalide.');
    const reference = paymentReference(payment.reference, account);
    // An undefined means is useful only when both Belgian payment clues agree.
    if (['1', ''].includes(code) && !(account.startsWith('BE') && reference.structured)) return unavailable('Le moyen de paiement n’indique pas explicitement un virement ; un IBAN belge et une communication structurée belge valide sont alors nécessaires.');
    const amount = data.totals?.PayableAmount;
    if (!amount) return unavailable('Le montant à payer est absent.');
    if (amount.currency && amount.currency !== 'EUR') return unavailable('Le montant à payer n’est pas exprimé en euros.');
    const value = String(amount.value ?? '').trim();
    if (!value) return unavailable('Le montant à payer est absent.');
    if (/^-\d+(?:\.\d+)?$/.test(value)) return unavailable('Le montant à payer est négatif ou nul.');
    const match = /^\+?(\d+)(?:\.(\d+))?$/.exec(value);
    if (!match) return unavailable('Le montant à payer n’est pas un nombre décimal valide.');
    if (/[1-9]/.test((match[2] || '').slice(2))) return unavailable('Le montant à payer comporte une fraction de centime ; il n’est pas arrondi automatiquement.');
    const euros = match[1].replace(/^0+(?=\d)/, '');
    const cents = (match[2] || '').padEnd(2, '0').slice(0, 2);
    if (!/[1-9]/.test(euros + cents)) return unavailable('Le montant à payer est nul.');
    const beneficiary = data.payee?.name || payment.name || data.supplier?.name || '';
    if (!beneficiary) return unavailable('Le nom du bénéficiaire est absent.');
    // Never borrow the supplier's address for a separately named beneficiary.
    const party = data.payee?.name ? data.payee : beneficiary === data.supplier?.name ? data.supplier : null;
    const transfer = {
      beneficiary, address: [...(party?.address || [])], account: account.match(/.{1,4}/g).join(' '),
      bank: payment.bank || '', reference, euros, cents, dueDate: data.dueDate || '',
    };
    return { transfer, reason: '' };
  }
  function transferDetails(data) {
    return assessTransfer(data).transfer;
  }
  function formCharacters(text) {
    // Keep a base and its combining accents in one cell without normalizing the
    // source. Preserve orphan marks too; alphabet validation decides admissibility.
    return String(text ?? '').match(/\P{M}\p{M}*|\p{M}+/gu) || [];
  }
  function febelfinDetails(data) {
    const eligibility = assessTransfer(data);
    const { transfer } = eligibility;
    if (!transfer) return eligibility;
    const unavailable = reason => ({ transfer, reason });
    // These limits belong to the fixed form, not to the invoice parser. Never
    // truncate, repair an entity or borrow another party's address to make it fit.
    // Febelfin, European credit transfer form v1.3, pp. 4–6.
    if (transfer.euros.length > 8) return unavailable('Le montant dépasse les huit cases en euros du gabarit.');
    const party = data.payee?.name ? data.payee : transfer.beneficiary === data.supplier?.name ? data.supplier : null;
    const postal = party?.postal;
    if (!postal && transfer.address.length) return unavailable('L’adresse du bénéficiaire ne peut pas être placée dans les zones du gabarit sans être interprétée.');
    if (postal?.region) return unavailable('L’adresse du bénéficiaire contient une région sans zone prévue dans le gabarit.');
    const fields = {
      beneficiary: transfer.beneficiary.toUpperCase(),
      street: [postal?.street, postal?.additionalStreet, ...(postal?.addressLines || [])].filter(Boolean).join(' ').toUpperCase(),
      locality: [postal?.country, postal?.postalCode, postal?.city].filter(Boolean).join(' ').toUpperCase(),
      account: transfer.account, bank: transfer.bank.toUpperCase(),
      reference: transfer.reference.text.toUpperCase(), euros: transfer.euros, cents: transfer.cents,
      code: transfer.reference.structured ? '03' : '02',
    };
    // Accents stay intact. Do not transliterate, collapse whitespace or decode
    // text such as a literal &apos; left after normal XML parsing.
    const latinText = /^(?:\p{Script=Latin}\p{M}*|[0-9 .,'’&()+/:;–—-])*$/u;
    for (const [key, label] of [['beneficiary', 'Le nom du bénéficiaire'], ['street', 'La rue du bénéficiaire'], ['locality', 'La localité du bénéficiaire']]) {
      if (formCharacters(fields[key]).length > 26) return unavailable(`${label} dépasse les 26 caractères du gabarit.`);
      if (!latinText.test(fields[key]) || /&(?:#\d+|#X[\dA-F]+|[A-Z][A-Z\d]+);/.test(fields[key])) {
        return unavailable(`${label} contient des caractères qui ne peuvent pas être repris dans le gabarit.`);
      }
    }
    if (fields.bank && !/^[A-Z]{6}[A-Z\d]{2}(?:[A-Z\d]{3})?$/.test(fields.bank)) return unavailable('Le BIC ne peut pas être repris dans les huit ou onze cases prévues.');
    if (!transfer.reference.structured) {
      if (formCharacters(fields.reference).length > 34) return unavailable('La communication dépasse les 34 caractères du gabarit.');
      if (!/^[A-Z\d +/=-]*$/.test(fields.reference)) return unavailable('La communication contient des caractères non prévus dans le gabarit.');
    }
    return { transfer, fields, reason: '' };
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
  globalThis.Peppol = Object.freeze({ parseInvoice, decimal, money, date, paymentReference, transferDetails, febelfinDetails, formCharacters, decodeXml, MAX_BYTES });
})();
