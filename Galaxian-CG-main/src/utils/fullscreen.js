// ═══════════════════════════════════════════════════════════════
// src/utils/fullscreen.js
// Escala responsiva + Fullscreen API
//
// Estratégia de escala:
//   O buffer WebGL (480×640) é imutável.
//   Apenas o CSS display size do #gameWrapper é alterado.
//   game.js já usa getBoundingClientRect() + scaleX/scaleY,
//   portanto coordenadas de mouse continuam corretas em qualquer
//   escala, sem nenhuma alteração em outros arquivos.
//
// Dependências: CANVAS_W, CANVAS_H (constants.js)
// Carregado DEPOIS de main.js (último script do index.html).
// ═══════════════════════════════════════════════════════════════
"use strict";

const FullscreenSystem = (() => {
  // Razão de aspecto lógica do jogo (nunca muda)
  const ASPECT = CANVAS_W / CANVAS_H; // 480 / 640 = 0.75

  const wrapper = document.getElementById('gameWrapper');
  const keysBar = document.getElementById('keys');
  const fsBtn   = document.getElementById('fsBtn');
  const fsIcon  = document.getElementById('fsIcon');

  // ── Ícones SVG (polylines) ──────────────────────────────────
  // Cada ícone é o innerHTML do <svg id="fsIcon">.
  const ICON_ENTER =
    '<polyline points="1,5 1,1 5,1"/>'   +  // canto sup-esq
    '<polyline points="11,1 15,1 15,5"/>' +  // canto sup-dir
    '<polyline points="15,11 15,15 11,15"/>'+  // canto inf-dir
    '<polyline points="5,15 1,15 1,11"/>'; // canto inf-esq

  const ICON_EXIT =
    '<polyline points="5,1 1,1 1,5"/>'   +   // seta sup-esq (para dentro)
    '<polyline points="11,5 15,5 15,1"/>' +   // seta sup-dir
    '<polyline points="15,11 15,15 11,15"/>'+  // seta inf-dir (reusado)
    '<polyline points="1,11 1,15 5,15"/>'; // seta inf-esq

  // ── Helpers ──────────────────────────────────────────────────

  function isFullscreen() {
    return !!(
      document.fullscreenElement       ||
      document.webkitFullscreenElement ||  // Safari
      document.mozFullScreenElement    ||  // Firefox antigo
      document.msFullscreenElement         // IE/Edge antigo
    );
  }

  function requestFs() {
    const el = document.documentElement; // fullscreen na página inteira
    const fn = el.requestFullscreen       ||
               el.webkitRequestFullscreen ||
               el.mozRequestFullScreen    ||
               el.msRequestFullscreen;
    if (fn) fn.call(el).catch(err => {
      // Alguns browsers bloqueiam sem gesto do usuário; apenas avisa.
      console.warn('[Fullscreen] requestFullscreen falhou:', err.message);
    });
  }

  function exitFs() {
    const fn = document.exitFullscreen       ||
               document.webkitExitFullscreen ||
               document.mozCancelFullScreen  ||
               document.msExitFullscreen;
    if (fn) fn.call(document).catch(() => {});
  }

  // ── Escala do wrapper ─────────────────────────────────────────
  //
  // Calcula o maior retângulo com proporção ASPECT que caiba
  // na janela disponível, e aplica como CSS width/height do wrapper.
  //
  // Edge cases tratados:
  //   - Janela menor que 1px (minimizada): guarda mínimo de 1px
  //   - Fullscreen: usa 100vw × 100vh sem subtrair a barra de teclas
  //   - Resize durante fullscreen: evento 'resize' dispara novamente
  //   - Orientação móvel (portrait/landscape flip): ResizeObserver + resize
  // ──────────────────────────────────────────────────────────────
  function scaleGame() {
    const fs = isFullscreen();

    // Altura disponível: exclui a barra #keys quando não está em fullscreen
    const keysH = (!fs && keysBar)
      ? keysBar.offsetHeight + parseInt(getComputedStyle(document.body).gap || '10')
      : 0;

    const availW = window.innerWidth;
    const availH = Math.max(1, window.innerHeight - keysH);

    let displayW, displayH;

    if (availW / availH < ASPECT) {
      // Janela mais estreita que o jogo → limitado pela largura
      displayW = availW;
      displayH = availW / ASPECT;
    } else {
      // Janela mais larga (ou igual) → limitado pela altura
      displayH = availH;
      displayW = availH * ASPECT;
    }

    // Inteiros para renderização mais nítida (sem subpixel)
    displayW = Math.floor(displayW);
    displayH = Math.floor(displayH);

    // Garantia de mínimo (janela minimizada ou erro de cálculo)
    displayW = Math.max(1, displayW);
    displayH = Math.max(1, displayH);

    wrapper.style.width  = displayW + 'px';
    wrapper.style.height = displayH + 'px';
  }

  // ── Atualizar UI do botão e body ──────────────────────────────
  function updateUI() {
    const fs = isFullscreen();

    // Classe no body controla visibilidade de #keys via CSS
    document.body.classList.toggle('fullscreen', fs);

    // Troca ícone e tooltip do botão
    if (fsIcon) {
      fsIcon.innerHTML = fs ? ICON_EXIT : ICON_ENTER;
    }
    if (fsBtn) {
      fsBtn.title       = fs ? 'Sair da tela cheia (F)' : 'Tela cheia (F)';
      fsBtn.setAttribute('aria-label', fs ? 'Sair da tela cheia' : 'Entrar em tela cheia');
    }

    // Recalcular escala com o novo estado
    scaleGame();
  }

  // ── Toggle principal ─────────────────────────────────────────
  function toggleFullscreen() {
    if (isFullscreen()) {
      exitFs();
    } else {
      requestFs();
    }
  }

  // ── Eventos ──────────────────────────────────────────────────

  // Resize da janela (inclui rotação de tela em mobile)
  window.addEventListener('resize', scaleGame);

  // Mudança de estado fullscreen (entrou ou saiu)
  // Cobre todos os vendors
  ['fullscreenchange', 'webkitfullscreenchange',
   'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
    document.addEventListener(evt, updateUI);
  });

  // Botão de tela cheia dentro do wrapper
  if (fsBtn) {
    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // não propaga para o canvas (evita disparo/UI)
      toggleFullscreen();
    });
  }

  // Tecla F — atalho de teclado
  // Ignora se estiver digitando em inputs ou durante remapeamento de tecla.
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF')  return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    // Verificar se o HUD está em modo remapeamento (se o sistema existir)
    if (typeof HUD !== 'undefined' && HUD.isRemapping && HUD.isRemapping()) return;
    e.preventDefault();
    toggleFullscreen();
  });

  // ResizeObserver como fallback para casos onde 'resize' não dispara
  // (ex: mudança de zoom do browser, painéis de DevTools)
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => scaleGame());
    ro.observe(document.body);
  }

  // ── Escala inicial ────────────────────────────────────────────
  // Roda após o DOM estar completamente carregado (este script é o último).
  scaleGame();

  // ── API pública ───────────────────────────────────────────────
  return {
    toggle:      toggleFullscreen,
    scale:       scaleGame,
    isFullscreen
  };
})();