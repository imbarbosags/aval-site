/* ==========================================================================
   AVAL. — abertura "O selo se abre"

   Ideia central: a rolagem vira um número t entre 0 e 1 (quanto da "pista"
   já passou). Cada cena ocupa um trecho desse intervalo. Como tudo é função
   de t, a sequência é naturalmente reversível: rolou para cima, t diminui,
   a animação volta. Não existe linha do tempo nem vídeo — só matemática
   sobre a posição da página.

   Trechos de t (ajuste aqui o ritmo):
   ========================================================================== */
const RITMO = {
  abrir:    [0.04, 0.40],  // cena 3 — "A." se abre em "AVAL."
  papel:    [0.42, 0.66],  // cena 4 — a página marfim sobe
  assentar: [0.64, 0.86],  // cena 5 — a marca diminui e vai para o alto
  manchete: [0.74, 0.90],  // cena 5 — linhas da frase (cada linha atrasa um pouco)
  apoio:    [0.86, 0.97],  // cena 5 — "Entrevistas · Perfis…" e "Edição 01…"
};
const ATRASO_LINHA = 0.045;   // atraso entre as linhas da manchete
const SUAVIZACAO   = 0.14;    // 1 = cola na rolagem; menor = mais "seda"

(function () {
  const raiz    = document.documentElement;
  const secao   = document.getElementById('abertura');
  const palco   = secao && secao.querySelector('.abertura__palco');
  const papel   = secao && secao.querySelector('.camada--papel');
  if (!secao || !palco || !papel) return;

  // Movimento reduzido: fica a composição estática completa (o CSS padrão).
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ---- utilitários -------------------------------------------------------
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const trecho  = (t, [a, b]) => limitar((t - a) / (b - a), 0, 1);
  const entraSai = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // easeInOutCubic
  const sai      = x => 1 - Math.pow(1 - x, 3);                                       // easeOutCubic

  // ---- 1. medir o logotipo -----------------------------------------------
  // Para mover "A", "VAL" e "." separadamente sem perder o desenho do
  // logotipo, medimos a largura de cada letra E o kerning de cada par
  // (o ajuste fino que a fonte faz entre "A" e "V", por exemplo).
  // Tudo é guardado em "em" — proporcional ao corpo — então vale para
  // qualquer tamanho de tela sem medir de novo.
  function medir() {
    const BASE = 200;
    const m = document.createElement('span');
    m.style.cssText =
      'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;' +
      'font-family:"Bodoni Moda",serif;font-weight:700;font-kerning:normal;' +
      'font-variation-settings:"opsz" 96;line-height:1;font-size:' + BASE + 'px';
    document.body.appendChild(m);
    const w = s => { m.textContent = s; return m.getBoundingClientRect().width / BASE; };
    const kern = (a, b) => w(a + b) - w(a) - w(b);

    const L = { A: w('A'), V: w('V'), L: w('L'), p: w('.') };
    const k = { AV: kern('A', 'V'), VA: kern('V', 'A'), AL: kern('A', 'L'), Lp: kern('L', '.'), Ap: kern('A', '.') };
    document.body.removeChild(m);

    // posição (borda esquerda) de cada letra na palavra completa
    const xV  = L.A + k.AV;
    const xA2 = xV + L.V + k.VA;
    const xL  = xA2 + L.A + k.AL;
    const xP  = xL + L.L + k.Lp;
    const W   = xP + L.p;

    // estado fechado: "A." centralizado no mesmo eixo da palavra completa
    const par      = L.A + k.Ap + L.p;
    const aFechado = (W - par) / 2;
    const pFechado = aFechado + L.A + k.Ap;
    const encontro = aFechado + L.A + k.Ap / 2;       // onde o "A" encosta no ponto

    return {
      L, k, W, xV, xA2, xL, xP,
      dA: aFechado,                 // quanto o "A" está deslocado à direita quando fechado
      dP: pFechado - xP,            // quanto o ponto está deslocado (negativo = à esquerda)
      encontro,
      centros: [xV + L.V / 2, xA2 + L.A / 2, xL + L.L / 2],
    };
  }

  // ---- 2. montar a marca letra a letra -----------------------------------
  const FOLGA = 0.14; // mesma folga lateral do .marca__miolo no CSS (em)

  function montarMarca(el, M) {
    el.textContent = '';
    el.classList.add('marca--montada');
    const letra = (ch, margem, extra) => {
      const s = document.createElement('span');
      s.className = 'marca__l' + (extra ? ' ' + extra : '');
      s.textContent = ch;
      s.setAttribute('aria-hidden', 'true');
      if (margem) s.style.marginLeft = margem + 'em';
      return s;
    };
    const a = letra('A');
    const miolo = document.createElement('span');
    miolo.className = 'marca__miolo';
    miolo.setAttribute('aria-hidden', 'true');
    const v  = letra('V', M.k.AV);
    const a2 = letra('A', M.k.VA);
    const l  = letra('L', M.k.AL);
    miolo.append(v, a2, l);
    const p = letra('.', M.k.Lp, 'ponto');
    el.append(a, miolo, p);
    return { el, a, miolo, meio: [v, a2, l], p };
  }

  // ---- 3. preparar o palco -----------------------------------------------
  function iniciar() {
    const M = medir();

    // A camada vermelha é uma cópia da cena, por baixo do papel. Quando o
    // papel sobe (recortado de baixo para cima), cada pedaço da marca troca
    // de marfim para nanquim exatamente onde a borda da página passa.
    const lacre = document.createElement('div');
    lacre.className = 'camada camada--lacre';
    lacre.setAttribute('aria-hidden', 'true');
    const cenaLacre = papel.querySelector('.cena').cloneNode(true);
    cenaLacre.querySelectorAll('.manchete, [data-surge]').forEach(n => { n.style.visibility = 'hidden'; });
    lacre.appendChild(cenaLacre);
    palco.insertBefore(lacre, papel);

    const marcas = [
      montarMarca(papel.querySelector('[data-marca]'), M),
      montarMarca(lacre.querySelector('[data-marca]'), M),
    ];
    const slot    = papel.querySelector('.marca-slot');
    const linhas  = [...papel.querySelectorAll('.manchete .linha > span')];
    const apoios  = [...papel.querySelectorAll('[data-surge]')];
    const pular   = document.getElementById('pular');
    const role    = document.getElementById('role');

    raiz.classList.add('abertura-animada');
    pular.hidden = false;
    role.hidden = false;

    // ---- geometria (refeita a cada redimensionamento) ----
    let G = {};
    function medirPalco() {
      const r  = palco.getBoundingClientRect();
      const rs = slot.getBoundingClientRect();
      // corpo final = o que o CSS define (limpamos o inline para ler)
      marcas.forEach(m => { m.el.style.fontSize = ''; });
      const final = parseFloat(getComputedStyle(marcas[0].el).fontSize);
      // corpo grande: a palavra ocupa ~60% da largura (80% no celular),
      // sem passar de 42% da altura
      const fracao = r.width < 720 ? 0.80 : 0.60;
      const grande = Math.max(final, Math.min((r.width * fracao) / M.W, r.height * 0.42));
      G = {
        h: r.height,
        final, grande,
        subir: r.height / 2 - (rs.top - r.top + rs.height / 2),  // do lugar final até o centro da tela
        pularY: pular.getBoundingClientRect().top - r.top + pular.offsetHeight / 2,
      };
    }

    // ---- desenhar um quadro para um dado t ----
    function desenhar(t) {
      const e = entraSai(trecho(t, RITMO.abrir));      // abertura da marca
      const q = entraSai(trecho(t, RITMO.papel));      // subida do papel
      const k = entraSai(trecho(t, RITMO.assentar));   // marca indo para o alto

      // cena 5 — tamanho (interpolação geométrica: encolhe em ritmo constante ao olho)
      const corpo = G.grande * Math.pow(G.final / G.grande, k);
      const y     = G.subir * (1 - k);

      // cena 3 — janela que revela "VAL": acompanha a borda do "A" e a do ponto
      const aDir  = M.dA * (1 - e) + M.L.A;            // borda direita do "A"
      const pEsq  = M.xP + M.dP * (1 - e);             // borda esquerda do ponto
      const orig  = M.xV - FOLGA;                      // origem do miolo
      const pena  = 0.14;                               // largura do esfumado da janela (em)
      const jE = aDir - orig - pena * 0.55;
      const jD = pEsq - orig + pena * 0.55;
      const mascara = e >= 0.999 ? 'none'
        : `linear-gradient(90deg, transparent ${jE.toFixed(4)}em, #000 ${(jE + pena).toFixed(4)}em, #000 ${(jD - pena).toFixed(4)}em, transparent ${jD.toFixed(4)}em)`;

      for (const m of marcas) {
        m.el.style.fontSize  = corpo.toFixed(2) + 'px';
        m.el.style.transform = `translate(-50%, -50%) translateY(${y.toFixed(2)}px)`;
        m.a.style.transform  = `translateX(${(M.dA * (1 - e)).toFixed(4)}em)`;
        m.p.style.transform  = `translateX(${(M.dP * (1 - e)).toFixed(4)}em)`;
        m.miolo.style.opacity = e <= 0.001 ? 0 : 1;
        m.miolo.style.webkitMaskImage = mascara;
        m.miolo.style.maskImage = mascara;
        // as letras do meio nascem levemente recolhidas para o ponto de encontro
        m.meio.forEach((s, i) => {
          s.style.transform = `translateX(${((M.encontro - M.centros[i]) * 0.16 * (1 - e)).toFixed(4)}em)`;
        });
      }

      // cena 4 — o papel é recortado de cima: 100% = escondido, 0% = página cheia
      papel.style.clipPath = `inset(${((1 - q) * 100).toFixed(3)}% 0 0 0)`;
      papel.style.visibility = q <= 0 ? 'hidden' : 'visible';

      // cena 5 — manchete linha a linha, depois os textos de apoio
      linhas.forEach((s, i) => {
        const a = sai(trecho(t, [RITMO.manchete[0] + i * ATRASO_LINHA, RITMO.manchete[1] + i * ATRASO_LINHA]));
        s.style.transform = `translateY(${((1 - a) * 108).toFixed(2)}%)`;
      });
      const ap = sai(trecho(t, RITMO.apoio));
      apoios.forEach(n => {
        n.style.opacity = ap.toFixed(3);
        n.style.transform = `translateY(${((1 - ap) * 10).toFixed(2)}px)`;
      });

      // controles
      pular.classList.toggle('is-sobre-papel', (1 - q) * G.h < G.pularY);
      pular.classList.toggle('is-oculto', t > 0.9);
      if (t > 0.015) role.classList.remove('is-visivel');
    }

    // ---- ler a rolagem e suavizar ----
    function alvo() {
      const r = secao.getBoundingClientRect();
      const pista = r.height - palco.offsetHeight;
      return pista > 0 ? limitar(-r.top / pista, 0, 1) : 1;
    }

    let atual = alvo(), quadro = 0;
    function passo() {
      const a = alvo();
      atual += (a - atual) * SUAVIZACAO;
      if (Math.abs(a - atual) < 0.0004) atual = a;
      desenhar(atual);
      quadro = atual === a ? 0 : requestAnimationFrame(passo);
    }
    const pedir = () => { if (!quadro) quadro = requestAnimationFrame(passo); };

    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', () => { medirPalco(); atual = alvo(); desenhar(atual); });

    medirPalco();
    desenhar(atual);
    raiz.classList.add('abertura-pronta');      // dispara o fade-in do selo
    if (atual < 0.015) setTimeout(() => { if (alvo() < 0.015) role.classList.add('is-visivel'); }, 2200);

    // "Pular abertura": leva ao fim da sequência (a composição completa).
    pular.addEventListener('click', () => {
      const fim = secao.getBoundingClientRect().top + window.scrollY + secao.offsetHeight - palco.offsetHeight;
      window.scrollTo({ top: fim, behavior: 'smooth' });
    });
  }

  // Só começa quando a Bodoni estiver carregada (as medidas dependem dela);
  // se a fonte demorar demais, segue com o que houver.
  const fonte = document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load('700 100px "Bodoni Moda"'), new Promise(r => setTimeout(r, 2500))])
    : Promise.resolve();
  fonte.then(iniciar, iniciar);
})();
