(() => {
  'use strict';
  const { parseInvoice, money, decimal, date, decodeXml, paymentReference, febelfinDetails, formCharacters, MAX_BYTES } = globalThis.Peppol;
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
  function svgNode(tag, attributes = {}, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function transferForm(fields) {
    // All coordinates are millimetres. Box filling: Febelfin v1.3, pp. 4 and 7.
    // The decoration reconstructs the public specimen; it is not the print master.
    const svg = svgNode('svg', { class: 'transfer-slip', viewBox: '0 0 210 101.6', width: '210mm', height: '101.6mm', role: 'img', 'aria-labelledby': 'transfer-title transfer-description' });
    svg.append(svgNode('title', { id: 'transfer-title' }, 'Bulletin de virement'),
      svgNode('desc', { id: 'transfer-description' }, `${fields.euros},${fields.cents} EUR — ${fields.beneficiary} — ${fields.street} — ${fields.locality} — IBAN ${fields.account}${fields.bank ? ' — BIC ' + fields.bank : ''} — Communication ${fields.reference || 'non renseignée'}`));
    const red = '#ff3617', tint = '#ffd7d1', light = '#ffebe8';
    // Decoration and text share the same grid, including vertical centring.
    const row = (x, y, count, height = 5.63, options = {}) => ({ x, y, count, height, width: 4.04, pitch: 5.08, white: count, separators: [], ...options });
    const groups = [4, 8, 12, 16, 20, 24, 28, 32];
    const grids = {
      executionDate: row(4.04, 24.10, 6, 5.63, { separators: [2, 4] }),
      euros: row(151.36, 24.10, 8, 5.63, { separators: [2, 5] }),
      cents: row(197.00, 24.10, 2),
      payerAccount: row(34.52, 32.47, 34, 5.92, { white: 16, separators: groups }),
      account: row(34.52, 58.02, 34, 5.63, { white: 16, separators: groups }),
      bank: row(34.52, 66.39, 11, 5.77, { white: 8 }),
      reference: row(34.52, 91.79, 34),
      beneficiary: row(34.52, 75.62, 26, 4.04, { outline: false }),
      street: row(34.52, 79.95, 26, 4.04, { outline: false }),
      locality: row(34.52, 84.14, 26, 4.04, { outline: false }),
      code: row(197.72, 7.22, 2, 5.77, { width: 2.54, pitch: 2.54 }),
    };
    const artwork = svgNode('g', { 'aria-hidden': 'true' });
    const rect = (x, y, width, height, fill = '#fff') => artwork.append(svgNode('rect', { x, y, width, height, fill }));
    const path = d => artwork.append(svgNode('path', { d, fill: 'none', stroke: red, 'stroke-width': .14 }));
    const label = (x, y, text, size = 2.16, extra = {}) => artwork.append(svgNode('text', { x, y, fill: red, 'font-family': 'Arial, Helvetica, sans-serif', 'font-size': size, ...extra }, text));
    rect(0, 0, 210, 101.6);
    rect(2.17, 15.59, 206.10, 83.85, tint);
    rect(2.17, 15.59, 206.10, 5.48, red);
    path('M111.21 2.16H140.24V15.59');
    label(92.87, 3.32, 'Signature(s)');
    label(206.2, 5.05, 'ORDRE DE VIREMENT', 3.46, { 'font-weight': 'bold', 'text-anchor': 'end' });
    label(4.04, 19.05, 'Si complété à la main, n’indiquer qu’une seule MAJUSCULE ou un seul chiffre noir (ou bleu) par case', 2.88, { fill: '#fff', 'font-weight': 'bold', 'font-style': 'italic' });
    const boxes = ({ x, y, count, height, width, pitch, white, separators, outline = true }) => {
      for (let i = 0; i < count; i++) {
        const left = x + i * pitch, right = left + width, bottom = y + height;
        rect(left, y, width, height, i < white ? '#fff' : light);
        if (outline) path(`M${left} ${y + height / 3}V${y}H${right}V${y + height / 3}M${left} ${bottom - height / 3}V${bottom}H${right}V${bottom - height / 3}`);
        if (separators.includes(i + 1)) rect(right, bottom - 1.2, pitch - width, 1.2, red);
      }
    };
    Object.values(grids).forEach(boxes);
    for (const y of [41.71, 46.04, 50.37]) boxes(row(34.52, y, 26, 4.04, { outline: false }));
    label(4.04, 23.09, 'Date d’exécution souhaitée dans le futur');
    label(151.36, 23.09, 'Montant');
    label(185.01, 23.52, 'EUR', 2.88, { 'font-weight': 'bold' });
    label(198.45, 23.52, 'CENT', 2.88, { 'font-weight': 'bold' });
    label(193.54, 29.73, ',', 5.2, { 'font-weight': 'bold' });
    label(4.19, 36.08, 'Compte donneur d’ordre (IBAN)');
    label(4.19, 44.59, 'Nom et adresse donneur d’ordre');
    label(4.19, 61.34, 'Compte bénéficiaire (IBAN)');
    label(4.19, 69.42, 'BIC bénéficiaire');
    label(4.19, 78.36, 'Nom et adresse bénéficiaire');
    label(4.19, 94.96, 'Communication');
    // Exact OCR-B 10 pt T outline, Schwarz / Wagner (CTAN), freely redistributable.
    // Source and license: docs/technical-design.md, section 6.5.
    artwork.append(svgNode('path', { fill: '#000', transform: 'translate(205.8 45.2) scale(0.003527777778 -0.003527777778)', d: 'M151 698C159 699 560 700 570 698C583 696 595 687 602 676C621 646 604 606 570 600C566 599 537 599 487 599L411 599L411 317C411 9 411 30 405 17C402 10 391 -1 384 -4C369 -12 353 -12 338 -4C331 -1 320 10 317 17C311 30 311 9 311 317L311 599L235 599C152 599 151 599 140 604C113 618 104 652 121 677C128 687 139 695 151 698Z' }));
    const ink = svgNode('g', { 'aria-hidden': 'true', fill: '#000', 'font-family': '"Courier New", Courier, monospace', 'font-size': 4.6, 'font-weight': 'normal', 'font-style': 'normal', 'letter-spacing': 0 });
    const dataText = (field, value) => {
      const grid = grids[field];
      // Keep a letter and its combining accents in one cell without normalising
      // the value. Spaces in names/references reserve an empty cell.
      const characters = formCharacters(value);
      const offset = field === 'euros' ? grid.count - characters.length : 0;
      characters.forEach((character, i) => ink.append(svgNode('text', {
        x: grid.x + grid.width / 2 + (offset + i) * grid.pitch,
        y: grid.y + grid.height / 2,
        'data-field': field, 'xml:space': 'preserve', 'text-anchor': 'middle', 'dominant-baseline': 'central',
        ...(field === 'code' ? { 'font-size': 4.4 } : {}),
      }, character)));
    };
    for (const field of ['euros', 'cents', 'account', 'bank', 'beneficiary', 'street', 'locality', 'reference', 'code']) {
      // In box-filling mode the IBAN has one character per cell, without the
      // presentation-only grouping spaces. The accessible description keeps them.
      dataText(field, field === 'account' ? fields.account.replace(/ /g, '') : fields[field]);
    }
    svg.append(artwork, ink);
    return svg;
  }
  function renderTransfer(data) {
    const result = febelfinDetails(data);
    if (result.reason) return append(el('section', 'details-section transfer-unavailable'), el('h3', '', 'Bulletin de virement indisponible'), el('p', '', result.reason + ' Les données de la facture restent affichées intégralement.'));
    const { transfer, fields } = result;
    const section = el('section', 'transfer-section');
    section.setAttribute('aria-label', 'Bulletin de virement');
    const header = append(el('div', 'transfer-header'), el('h3', '', 'Bulletin de virement'),
      el('p', '', `Facture ${data.id}${transfer.dueDate ? ' · Échéance : ' + date(transfer.dueDate) : ''}`));
    section.append(header, transferForm(fields));
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
    const fragment = el('div', 'invoice-body');
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
      if (data.payee) payment.append(el('p', '', `Bénéficiaire : ${data.payee.name || data.payee.registration || '—'}`), ...data.payee.address.map(line => el('p', '', line)));
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
    // Full-width sibling: the invoice keeps its own 12 mm print inset while the
    // form uses the entire 210 mm page width, without negative margins or scaling.
    const result = append(document.createDocumentFragment(), fragment);
    if (transfer) {
      if (transfer.className === 'transfer-section') result.append(transfer);
      else fragment.append(transfer);
    }
    return result;
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
