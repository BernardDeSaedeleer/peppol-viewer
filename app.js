(() => {
  'use strict';
  const { parseInvoice, money, decimal, date, decodeXml, paymentReference, transferDetails, MAX_BYTES } = globalThis.Peppol;
  const $ = id => document.getElementById(id);
  const homeTitle = document.title;
  let loadSequence = 0;
  const units = { C62: 'pièce(s)', H87: 'pièce(s)', HUR: 'heure(s)', DAY: 'jour(s)', MON: 'mois', KGM: 'kg', MTR: 'm', MTK: 'm²', LTR: 'l', KWH: 'kWh', XPP: 'pièce(s)' };
  const taxNames = { S: 'Taux normal', Z: 'Taux zéro', E: 'Exonération', AE: 'Autoliquidation', K: 'Intracommunautaire', G: 'Exportation', O: 'Hors TVA', L: 'IGIC', M: 'IPSI' };
  const paymentNames = { '10': 'Espèces', '30': 'Virement', '42': 'Paiement sur compte bancaire', '48': 'Carte bancaire', '49': 'Prélèvement', '58': 'Virement SEPA', '59': 'Prélèvement SEPA' };
  function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function append(parent, ...children) { parent.append(...children.filter(Boolean)); return parent; }
  function meta(label, val) { return append(el('div'), el('span', 'meta-label', label), el('span', 'meta-value', val || '—')); }
  function transferBoxes(value, minimum = 0) {
    const box = el('span', 'transfer-boxes');
    // Screen readers get the complete value, not a sequence of isolated characters.
    box.append(el('span', 'sr-only', value));
    const cells = el('span', 'transfer-cells');
    cells.setAttribute('aria-hidden', 'true');
    if (value.length > 42) cells.append(el('span', 'transfer-long-value', value));
    else [...value.padStart(minimum, ' ')].forEach(char => cells.append(el('span', 'transfer-cell', char)));
    box.append(cells);
    return box;
  }
  function renderTransfer(data) {
    const transfer = transferDetails(data);
    if (!transfer) return null;
    const section = el('section', 'transfer-section');
    section.setAttribute('aria-label', 'Bulletin de virement');
    const header = append(el('div', 'transfer-header'), el('span', 'transfer-purpose', 'Aide au paiement'), el('h3', '', 'Bulletin de virement'));
    const slip = el('div', 'transfer-slip');
    slip.append(el('p', 'transfer-strip', 'Virement en euros'));
    const amount = append(el('div', 'transfer-amount'),
      append(el('div'), el('span', 'transfer-label', 'Montant · EUR'), transferBoxes(transfer.euros, 8)),
      append(el('div'), el('span', 'transfer-label', 'CENT'), transferBoxes(transfer.cents)));
    slip.append(append(el('div', 'transfer-top'),
      transfer.dueDate ? append(el('div', 'transfer-due'), el('span', 'transfer-label', 'Échéance de la facture'), el('span', 'transfer-date', date(transfer.dueDate))) : el('div'), amount));
    const fields = el('dl', 'transfer-fields');
    const field = (label, content, className = '') => fields.append(append(el('div', 'transfer-row ' + className), el('dt', '', label), append(el('dd'), content)));
    field('Compte bénéficiaire (IBAN)', transferBoxes(transfer.account.replace(/ /g, '')));
    if (transfer.bank) field('BIC bénéficiaire', transferBoxes(transfer.bank));
    field('Nom et adresse du bénéficiaire', append(el('div', 'transfer-beneficiary'), el('span', 'transfer-name', transfer.beneficiary), ...transfer.address.map(line => el('span', '', line))));
    field(transfer.reference.structured ? 'Communication structurée' : 'Communication',
      el('span', 'transfer-reference', transfer.reference.text || 'Non renseignée dans le XML'), 'transfer-reference-row');
    slip.append(fields);
    section.append(header, slip, el('p', 'transfer-help', 'Aide à la saisie dans votre banque · Données reprises du XML · Formulaire non homologué.'));
    return section;
  }
  function partyBlock(p, label) {
    const n = append(el('section', 'party'), el('h3', '', label), el('p', 'party-name', p.name || '—'));
    if (p.trading && p.trading !== p.name) n.append(el('p', '', p.trading));
    p.address.forEach(a => n.append(el('p', '', a)));
    if (p.vat) n.append(el('p', 'identifier', `TVA : ${p.vat}`));
    if (p.registration) n.append(el('p', 'identifier', `Identifiant légal : ${p.registration}`));
    p.contact.forEach(c => n.append(el('p', '', c)));
    return n;
  }
  function renderInvoice(data) {
    const m = a => money(a, data.currency);
    const fragment = document.createDocumentFragment();
    const label = data.credit ? 'Note de crédit' : 'Facture';
    const heading = append(el('div'), el('span', 'document-kind', `${label} · ${data.currency || 'Devise absente'}`), el('h2', '', data.id));
    const dates = append(el('div', 'document-dates'), meta('Date d’émission', date(data.issueDate)), data.dueDate ? meta('Échéance', date(data.dueDate)) : null);
    fragment.append(append(el('header', 'document-header'), heading, dates));
    fragment.append(append(el('div', 'parties'), partyBlock(data.supplier, 'Fournisseur'), partyBlock(data.customer, 'Client')));
    if (data.references.length) fragment.append(append(el('div', 'references'), ...data.references.map(([label, v]) => meta(label, v))));
    const table = el('table', 'invoice-lines');
    const caption = el('caption', 'sr-only', 'Détail des lignes de la facture');
    const tr = el('tr');
    ['Description', 'Quantité', 'Prix HT', 'TVA', 'Total HT'].forEach((t, i) => { const th = el('th', i ? 'number' : '', t); th.scope = 'col'; tr.append(th); });
    table.append(caption, append(el('thead'), tr));
    const body = el('tbody');
    data.lines.forEach(line => {
      const description = append(el('td', 'line-description'), el('span', 'line-title', line.name || '—'));
      [...line.descriptions, ...line.notes].forEach(t => description.append(el('span', 'line-detail', t)));
      line.adjustments.forEach(a => description.append(el('span', 'line-detail', `${a.charge ? 'Frais' : 'Remise'}${a.reason ? ' · ' + a.reason : ''} : ${m(a.amount)}${a.percent ? ' (' + decimal(a.percent) + ' %)' : ''}`)));
      const qty = append(el('td', 'number', decimal(line.quantity)), el('span', 'unit', units[line.unit] || line.unit));
      const price = el('td', 'number', m(line.price));
      if (line.priceBase) price.append(el('span', 'line-detail', `pour ${decimal(line.priceBase)} ${units[line.priceUnit || line.unit] || line.priceUnit || line.unit}`));
      const tax = el('td', 'number line-tax', line.taxPercent ? decimal(line.taxPercent) + '\u00a0%' : line.taxCategory || '—');
      if (line.taxCategory && line.taxCategory !== 'S') tax.append(el('span', 'line-detail tax-label', taxNames[line.taxCategory] || line.taxCategory));
      body.append(append(el('tr'), description, qty, price, tax, el('td', 'number', m(line.amount))));
    });
    table.append(body);
    fragment.append(append(el('div', 'table-scroll'), table));
    const taxSection = append(el('section', 'tax-summary'), el('h3', '', 'Détail de la TVA'));
    const taxTable = el('table', 'tax-table');
    const taxHead = el('tr');
    ['Catégorie / taux', 'Base HT', 'TVA'].forEach((t, i) => { const th = el('th', i ? 'number' : '', t); th.scope = 'col'; taxHead.append(th); });
    taxTable.append(append(el('thead'), taxHead));
    const taxBody = el('tbody');
    data.taxes.forEach(t => {
      taxBody.append(append(el('tr'), el('td', 'tax-rate', `${t.category || '—'}${t.percent ? ' · ' + decimal(t.percent) + '\u00a0%' : ''}`), el('td', 'number', m(t.base)), el('td', 'number', m(t.amount))));
    });
    taxTable.append(taxBody);
    taxSection.append(taxTable);
    if (!data.taxes.length) taxSection.append(el('p', 'tax-exemption', 'Ventilation non renseignée.'));
    data.taxes.forEach(t => { if (t.category && t.category !== 'S' || t.exemption) taxSection.append(el('p', 'tax-exemption', `${taxNames[t.category] || t.category}${t.exemption ? ' : ' + t.exemption : ''}`)); });
    const totals = el('dl', 'totals');
    const totalRow = (label, a, style = '', required = false) => { if (a?.value || required) totals.append(append(el('div', `total-row ${style}`), el('dt', '', label), el('dd', '', m(a)))); };
    totalRow('Somme des lignes HT', data.totals.LineExtensionAmount);
    totalRow('Remises globales', data.totals.AllowanceTotalAmount);
    totalRow('Frais globaux', data.totals.ChargeTotalAmount);
    totalRow('Total HT', data.totals.TaxExclusiveAmount, '', true);
    totalRow('TVA', data.taxAmount, '', true);
    totalRow('Total TTC', data.totals.TaxInclusiveAmount, 'emphasis', true);
    totalRow('Déjà payé / acomptes', data.totals.PrepaidAmount);
    totalRow('Arrondi', data.totals.PayableRoundingAmount);
    totalRow(data.credit ? 'Montant à créditer' : 'Montant à payer', data.totals.PayableAmount, 'due', true);
    fragment.append(append(el('div', 'summary'), taxSection, totals));
    if (data.adjustments.length) {
      const section = append(el('section', 'details-section'), el('h3', '', 'Remises et frais sur la facture'));
      data.adjustments.forEach(a => section.append(el('p', '', `${a.charge ? 'Frais' : 'Remise'}${a.reason ? ' — ' + a.reason : ''} : ${m(a.amount)}${a.percent ? ' · ' + decimal(a.percent) + ' %' : ''}${a.base.value ? ' sur ' + m(a.base) : ''}`)));
      fragment.append(section);
    }
    if (data.payments.length || data.terms.length || data.payee) {
      const payment = append(el('section', 'details-section'), el('h3', '', 'Paiement'));
      const grid = el('div', 'payment-grid');
      data.payments.forEach(p => {
        const block = el('div');
        const reference = paymentReference(p.reference, p.account);
        [[paymentNames[p.code] || (p.code ? `Moyen de paiement : ${p.code}` : ''), ''], [p.account, 'Compte / IBAN : '], [p.name, 'Titulaire : '], [p.bank, 'Banque / BIC : '], [reference.text, reference.structured ? 'Communication structurée : ' : 'Communication : '], [p.mandate, 'Mandat : ']].forEach(([v, prefix]) => { if (v) block.append(el('p', '', prefix + v)); });
        grid.append(block);
      });
      payment.append(grid);
      if (data.payee) payment.append(el('p', '', `Bénéficiaire : ${data.payee.name || data.payee.registration || '—'}`));
      data.terms.forEach(t => payment.append(el('p', '', t)));
      fragment.append(payment);
    }
    if (data.documents.length) {
      const section = append(el('section', 'details-section'), el('h3', '', 'Documents complémentaires'));
      data.documents.forEach(d => {
        const label = `${d.typeCode === '130' ? 'Objet facturé' : 'Référence'} : ${d.id || 'non renseignée'}`;
        section.append(append(el('p'), el('strong', '', label), d.description ? el('span', '', ' — ' + d.description) : null));
        d.attachments.forEach(filename => section.append(el('p', 'line-detail', `Pièce jointe${filename ? ' : ' + filename : ''} — contenu non affiché.`)));
        if (d.externalLinkCount) section.append(el('p', 'line-detail', d.externalLinkCount === 1 ? 'Lien externe — non ouvert.' : `${d.externalLinkCount} liens externes — non ouverts.`));
      });
      fragment.append(section);
    }
    if (data.notes.length) fragment.append(append(el('section', 'details-section'), el('h3', '', 'Notes'), ...data.notes.map(t => el('p', '', t))));
    const transfer = renderTransfer(data);
    if (transfer) fragment.append(transfer);
    return fragment;
  }
  function showXml(xml, filename) {
    const data = parseInvoice(xml);
    const rendered = renderInvoice(data);
    $('invoice').replaceChildren(rendered);
    $('invoice').setAttribute('aria-label', data.credit ? 'Note de crédit' : 'Facture');
    $('file-name').textContent = filename;
    $('warnings').replaceChildren(...data.warnings.map(w => el('p', '', w)));
    $('warnings').hidden = !data.warnings.length;
    $('error').hidden = true;
    $('drop-zone').removeAttribute('data-mood');
    $('welcome').hidden = true;
    $('preview').hidden = false;
    document.title = `${data.credit ? 'Note de crédit' : 'Facture'} ${data.id} — Peppol Viewer`;
    $('status').textContent = `${data.credit ? 'Note de crédit' : 'Facture'} ${data.id} ouverte. ${data.lines.length} ligne(s).`;
    $('invoice').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    return { type: data.credit ? 'credit_note' : 'invoice', lineCount: data.lines.length, warningCount: data.warnings.length };
  }
  function showError(message) {
    $('error').textContent = message + ($('preview').hidden ? '' : ' L’aperçu précédent est conservé.');
    $('error').hidden = false;
    $('drop-zone').setAttribute('data-mood', 'puzzled');
    $('status').textContent = '';
  }
  async function openFiles(files) {
    const request = ++loadSequence;
    if (files.length !== 1) { showError('Choisissez un seul fichier XML à la fois.'); return; }
    const file = files[0];
    if (file.size > MAX_BYTES) { showError('Le fichier dépasse la limite de 5 Mo.'); return; }
    $('status').textContent = 'Lecture du fichier…';
    try {
      const buffer = await file.arrayBuffer();
      if (request !== loadSequence) return;
      showXml(decodeXml(buffer), file.name);
    } catch (error) { if (request === loadSequence) showError(error.message || 'Impossible de lire ce fichier.'); }
  }
  function chooseFile() { $('file-input').value = ''; $('file-input').click(); }
  function closeInvoice() {
    ++loadSequence;
    $('preview').hidden = true;
    $('invoice').replaceChildren();
    $('invoice').setAttribute('aria-label', 'Facture');
    $('file-name').textContent = '';
    $('file-input').value = '';
    $('warnings').replaceChildren();
    $('warnings').hidden = true;
    $('error').textContent = '';
    $('error').hidden = true;
    dragDepth = 0;
    $('drop-zone').classList.remove('dragging');
    $('drop-zone').removeAttribute('data-mood');
    $('welcome').hidden = false;
    document.title = homeTitle;
    $('status').textContent = 'Document fermé. Déposez une facture pour l’ouvrir.';
    $('choose-file').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  $('choose-file').addEventListener('click', chooseFile);
  $('close-invoice').addEventListener('click', closeInvoice);
  $('file-input').addEventListener('change', e => { if (e.target.files.length) void openFiles(e.target.files); });
  $('print').addEventListener('click', () => window.print());
  let dragDepth = 0;
  document.addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
  document.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; $('drop-zone').classList.add('dragging'); });
  document.addEventListener('dragleave', e => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; $('drop-zone').classList.remove('dragging'); } });
  document.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; $('drop-zone').classList.remove('dragging'); void openFiles(e.dataTransfer?.files || []); });
  // Optional browser capability, using the exact same reader and visible state.
  const context = document.modelContext;
  if (context?.registerTool) {
    const lifecycle = new AbortController();
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
    try {
      Promise.resolve(context.registerTool({
        name: 'open_peppol_xml', title: 'Ouvrir une facture Peppol',
        description: 'Affiche un XML Peppol fourni par l’utilisateur. Remplace l’aperçu courant, sans enregistrer ni envoyer le fichier.',
        inputSchema: { type: 'object', properties: { xml: { type: 'string', maxLength: MAX_BYTES }, filename: { type: 'string', maxLength: 255 } }, required: ['xml'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute(input) {
          if (!input || typeof input !== 'object' || typeof input.xml !== 'string' || (input.filename !== undefined && (typeof input.filename !== 'string' || input.filename.length > 255)) || Object.keys(input).some(k => !['xml', 'filename'].includes(k))) throw new Error('Entrée invalide : fournissez xml et, éventuellement, filename.');
          const result = showXml(input.xml, input.filename || 'facture.xml');
          ++loadSequence;
          return result;
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* The local viewer remains fully usable without WebMCP. */ }
  }
})();
