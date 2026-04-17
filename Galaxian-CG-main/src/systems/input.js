// ═══════════════════════════════════════════════════════════════
// src/systems/input.js
// Sistema de captura de entrada por teclado E mouse.
// ═══════════════════════════════════════════════════════════════
"use strict";

const Input = (() => {
  // ── Teclado ──────────────────────────────────────────────────
  const keys        = new Set(); // teclas atualmente pressionadas
  const justPressed = new Set(); // pressionadas pela primeira vez NESTE frame

  window.addEventListener('keydown', e => {
    if (!keys.has(e.code)) justPressed.add(e.code);
    keys.add(e.code);
    if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', e => {
    keys.delete(e.code);
  });

  // ── Mouse ─────────────────────────────────────────────────────
  // Usamos as coordenadas RAW da janela aqui.
  // A conversão para coordenadas do canvas (escala) é feita no game.js,
  // pois só ele conhece o canvas e seu bounding rect.
  // Isso evita acoplamento entre Input e o DOM do canvas.
  let _mouseX = 0;
  let _mouseY = 0;

  // Set dos botões ATUALMENTE pressionados (como keys para teclado)
  const mouseButtons      = new Set();
  // Set dos botões pressionados NESTE frame (equivalente a justPressed)
  const mouseJustPressed  = new Set();

  window.addEventListener('mousemove', e => {
    // Guardamos clientX/Y — game.js faz a conversão para coords do canvas
    _mouseX = e.clientX;
    _mouseY = e.clientY;
  });

  window.addEventListener('mousedown', e => {
    // e.button: 0 = esquerdo, 1 = meio, 2 = direito
    if (!mouseButtons.has(e.button)) {
      mouseJustPressed.add(e.button);
    }
    mouseButtons.add(e.button);
  });

  window.addEventListener('mouseup', e => {
    mouseButtons.delete(e.button);
  });

  // Previne o menu de contexto do navegador no botão direito.
  // Essencial para que o clique direito funcione como tiro sem
  // abrir o menu nativo do browser.
  window.addEventListener('contextmenu', e => {
    e.preventDefault();
  });

  // ── API pública ───────────────────────────────────────────────
  return {
    // --- Teclado ---

    /** Retorna true enquanto a tecla estiver pressionada (polling). */
    isDown: code => keys.has(code),

    /** Retorna true apenas UMA VEZ por pressão; consome o evento. */
    wasPressed: code => {
      if (justPressed.has(code)) {
        justPressed.delete(code);
        return true;
      }
      return false;
    },

    /** Verifica se QUALQUER tecla do array foi pressionada neste frame. */
    wasPressedAny: (codes) => {
      if (!codes || !Array.isArray(codes)) return false;
      for (const code of codes) {
        if (justPressed.has(code)) return true;
      }
      return false;
    },

    // Remove uma tecla do buffer de justPressed E de keys.
    // Usar após remapeamento para impedir que a tecla "vaze" para
    // handleStateInputs no mesmo frame em que o remapping terminou.
    suppress: code => {
      justPressed.delete(code);
      keys.delete(code);
    },

    // --- Mouse ---

    /**
     * Retorna true enquanto o botão do mouse estiver pressionado.
     * @param {number} button - 0=esquerdo, 1=meio, 2=direito
     */
    isMouseDown: button => mouseButtons.has(button),

    /**
     * Retorna true apenas UMA VEZ por clique; consome o evento.
     * Equivalente ao wasPressed() do teclado.
     * @param {number} button - 0=esquerdo, 2=direito
     */
    wasMousePressed: button => {
      if (mouseJustPressed.has(button)) {
        mouseJustPressed.delete(button);
        return true;
      }
      return false;
    },

    /**
     * Retorna a posição X bruta do mouse (clientX).
     * game.js converte para coordenadas do canvas.
     */
    getMouseRawX: () => _mouseX,

    /**
     * Retorna a posição Y bruta do mouse (clientY).
     */
    getMouseRawY: () => _mouseY,

    /** Chamado no fim de cada frame pelo game loop para limpar buffers. */
    clearFrame: () => {
      justPressed.clear();
      // Limpa também o buffer de cliques do mouse para que wasMousePressed
      // retorne true apenas no frame em que o clique ocorreu.
      mouseJustPressed.clear();
    },
  };
})();