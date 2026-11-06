import { validateState } from '../public/domain.js';

const counts = visit => JSON.stringify(visit.items.filter(i => i.stock != null)
  .map(i => [i.productId, i.stock]).sort(([a], [b]) => a.localeCompare(b)));

// A identidade de uma visita é loja + data. Uma nova data nunca substitui o histórico.
export function planSpreadsheetImport(current, imported, at = new Date().toISOString()) {
  validateState(current);
  validateState(imported);
  if (!imported.source?.file || !/^[a-f0-9]{64}$/.test(imported.source.sha256 || ''))
    throw new Error('A planilha precisa ter nome e SHA-256 de origem.');
  const next = structuredClone(current);
  const summary = { newStores: [], newProducts: [], newVisits: [], unchangedVisits: [], catalogDifferences: [] };
  const productIds = new Map();
  for (const product of imported.products) {
    const matches = next.products.filter(p => p.code === product.code);
    if (matches.length > 1) throw new Error(`Código de produto ambíguo: ${product.code}.`);
    let existing = matches[0];
    if (!existing) {
      if (next.products.some(p => p.id === product.id)) throw new Error(`Identificador de produto em uso: ${product.id}.`);
      existing = structuredClone(product);
      next.products.push(existing);
      summary.newProducts.push(existing.id);
    } else if (existing.name !== product.name || existing.laboratory !== product.laboratory) {
      summary.catalogDifferences.push({ code: product.code, current: existing.name, spreadsheet: product.name });
    }
    productIds.set(product.id, existing.id);
  }
  for (const store of imported.stores) {
    if (next.stores.some(s => s.id === store.id)) continue;
    next.stores.push(structuredClone(store));
    summary.newStores.push(store.id);
  }
  for (const original of imported.visits) {
    const visit = { ...structuredClone(original), items: original.items.filter(i => i.stock != null)
      .map(i => ({ productId: productIds.get(i.productId), stock: i.stock })) };
    const existing = next.visits.find(v => v.storeId === visit.storeId && v.date === visit.date);
    if (existing) {
      if (counts(existing) !== counts(visit))
        throw new Error(`${visit.storeId} em ${visit.date}: contagens diferentes na mesma data. O histórico foi preservado; confira a data da nova visita.`);
      summary.unchangedVisits.push({ id: existing.id, storeId: visit.storeId, date: visit.date });
      continue;
    }
    if (!visit.items.length) throw new Error(`${visit.storeId}: visita sem contagens físicas.`);
    if (next.visits.some(v => v.id === visit.id)) throw new Error(`Identificador de visita em uso: ${visit.id}.`);
    visit.countingMode = 'automatic';
    visit.provenance = { ...visit.spreadsheet, file: imported.source.file, sha256: imported.source.sha256 };
    delete visit.spreadsheet;
    visit.notes = `Importada de ${imported.source.file} (aba ${visit.provenance.sheet || visit.storeId}, coluna ${visit.provenance.column || 'não informada'}).`;
    visit.createdBy = visit.updatedBy = 'caio';
    visit.createdAt = visit.updatedAt = at;
    next.visits.push(visit);
    summary.newVisits.push({ id: visit.id, storeId: visit.storeId, date: visit.date,
      counted: visit.items.length, totalStock: visit.items.reduce((n, i) => n + i.stock, 0),
      previousVisits: current.visits.filter(v => v.storeId === visit.storeId).length });
  }
  const changed = Boolean(summary.newVisits.length || summary.newStores.length || summary.newProducts.length);
  if (changed) {
    const entries = [
      ...summary.newStores.map(entityId => ({ type: 'saveStore', entityId })),
      ...summary.newProducts.map(entityId => ({ type: 'saveProduct', entityId })),
      ...summary.newVisits.map(v => ({ type: 'saveVisit', entityId: v.id })),
    ].map(entry => ({ ...entry, username: 'caio', name: 'Caio', at, source: imported.source.file }));
    next.audit = [...(current.audit || []), ...entries].slice(-200);
    next.imports = [...(current.imports || []), { ...imported.source, importedAt: at,
      visitIds: summary.newVisits.map(v => v.id) }];
  }
  validateState(next);
  return { next, summary, changed };
}
