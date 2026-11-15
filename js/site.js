/* ==========================================================================
   AVAL. — comportamento geral (fora da abertura)
   1. Revelações contidas ao rolar   2. Cabeçalho fixo após a abertura
   ========================================================================== */
(function () {
  // 1 — Cada elemento com [data-revelar] ganha .is-visivel quando entra na
  //     tela. O movimento em si (opacidade + 18px) está no CSS.
  const alvos = document.querySelectorAll('[data-revelar]');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-visivel'); obs.unobserve(en.target); }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    alvos.forEach((el) => obs.observe(el));
  } else {
    alvos.forEach((el) => el.classList.add('is-visivel'));
  }

  // 2 — O cabeçalho só aparece quando a abertura saiu da tela, e troca de cor
  //     conforme a seção que está por baixo dele (data-tema).
  const topo = document.getElementById('topo');
  const abertura = document.getElementById('abertura');
  const temas = [...document.querySelectorAll('main [data-tema], footer[data-tema]')];
  let pedido = 0;

  function atualizar() {
    pedido = 0;
    const fim = abertura.getBoundingClientRect().bottom;
    topo.classList.toggle('is-visivel', fim < 70);
    for (const s of temas) {
      const r = s.getBoundingClientRect();
      if (r.top <= 36 && r.bottom > 36) { topo.dataset.tema = s.dataset.tema; break; }
    }
  }
  window.addEventListener('scroll', () => { if (!pedido) pedido = requestAnimationFrame(atualizar); }, { passive: true });
  window.addEventListener('resize', atualizar);
  atualizar();
})();
