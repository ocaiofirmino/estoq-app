// A instalação usa as mesmas páginas e estilos do site, sem recarregar uma visita aberta.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(error => console.warn('Estoq: não foi possível preparar a instalação.', error));
  }, { once: true });
}
