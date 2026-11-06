(() => {
  const key = 'estoq-theme';
  const root = document.documentElement;
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  const valid = value => value === 'dark' || value === 'light';
  let preference = null;
  try {
    const saved = globalThis.estoqStorageMigration?.theme(localStorage) ?? localStorage.getItem(key);
    if (valid(saved)) preference = saved;
  } catch { /* O tema também funciona quando o armazenamento está indisponível. */ }

  const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.4 13.3A8.6 8.6 0 0 1 10.7 3.6a8.7 8.7 0 1 0 9.7 9.7Z"/></svg>';

  function updateButtons() {
    const dark = root.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.innerHTML = dark ? sun : moon;
      button.setAttribute('aria-label', 'Modo escuro');
      button.setAttribute('aria-pressed', String(dark));
      button.title = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
    });
  }
  let transitionTimer;
  function apply(theme, animate = false) {
    if(animate){root.classList.add('theme-changing');clearTimeout(transitionTimer);transitionTimer=setTimeout(()=>root.classList.remove('theme-changing'),260);}
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#151917' : '#F4F0E9');
    updateButtons();
  }
  const automatic = () => system?.matches ? 'dark' : 'light';

  // Executado no head, antes do CSS, para evitar um clarão ao abrir o modo escuro.
  apply(preference || automatic());
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-theme-toggle]')) return;
    preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(key, preference); } catch { /* Mantém a escolha nesta página. */ }
    apply(preference, true);
  });
  const systemChanged = () => { if (!preference) apply(automatic(), true); };
  if (system?.addEventListener) system.addEventListener('change', systemChanged);
  else system?.addListener?.(systemChanged);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : null;
    apply(preference || automatic(), true);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateButtons, { once:true });
  else updateButtons();
})();
