// Migração pontual: nenhum componente novo grava com os identificadores antigos.
(() => {
  const previousTheme = 'estoquevet-theme';
  const previousDraft = 'estoquevet-draft-v1:';
  const themeKey = 'estoq-theme';
  const draftKey = user => `estoq-draft-v1:${user}`;
  const validTheme = value => value === 'dark' || value === 'light';
  const validDraft = value => value?.version === 1 && typeof value.visit?.id === 'string' && Array.isArray(value.visit.items)
    && Number.isInteger(value.cursor) && value.cursor >= 0 && ['setup', 'count', 'review'].includes(value.step);
  const parseDrafts = raw => {
    try {
      const value = JSON.parse(raw);
      return (Array.isArray(value) ? value : value ? [value] : []).filter(validDraft);
    } catch { return []; }
  };

  function theme(storage) {
    const current = storage.getItem(themeKey);
    const previous = storage.getItem(previousTheme);
    const value = validTheme(current) ? current : validTheme(previous) ? previous : null;
    if (value && previous !== null) {
      try { storage.setItem(themeKey, value); storage.removeItem(previousTheme); } catch { /* A escolha continua disponível nesta página. */ }
    }
    return value;
  }

  function drafts(storage, user) {
    const current = parseDrafts(storage.getItem(draftKey(user)));
    const previous = parseDrafts(storage.getItem(previousDraft + user));
    if (!previous.length) return current;
    const byVisit = new Map();
    // Em empates, a cópia que já usa o nome novo prevalece.
    for (const state of [...current, ...previous]) {
      const saved = byVisit.get(state.visit.id);
      if (!saved || (state.savedAt || '') > (saved.savedAt || '')) byVisit.set(state.visit.id, state);
    }
    const merged = [...byVisit.values()].sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    try {
      storage.setItem(draftKey(user), JSON.stringify(merged));
      storage.removeItem(previousDraft + user);
    } catch { /* A leitura retorna o rascunho original mesmo se a migração não puder ser gravada. */ }
    return merged;
  }

  globalThis.estoqStorageMigration = { theme, drafts };
  try {
    if (typeof window === 'undefined') return;
    const storage = globalThis.localStorage;
    if (!storage) return;
    theme(storage);
    const users = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(previousDraft)) users.push(key.slice(previousDraft.length));
    }
    for (const user of users) drafts(storage, user);
  } catch { /* O aplicativo mantém os avisos próprios de armazenamento indisponível. */ }
})();
