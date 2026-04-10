// ═══════════════════════════════════════════════════════════════
// src/systems/input.js
// Sistema de captura de entrada por teclado.
// ═══════════════════════════════════════════════════════════════
"use strict";

const Input = (() => {
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

  return {
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

    /** NOVO: Verifica se QUALQUER tecla do array foi pressionada neste frame */
    wasPressedAny: (codes) => {
      if (!codes || !Array.isArray(codes)) return false;
      for (const code of codes) {
        if (justPressed.has(code)) {
          // Não consumimos aqui para permitir que outras partes também verifiquem
          return true;
        }
      }
      return false;
    },
    // ← NOVO: remove uma tecla do buffer de justPressed E de keys.
    // Usar após remapeamento para impedir que a tecla "vaze" para o
    // handleStateInputs no mesmo frame em que o remapping terminou.
    suppress: code => {                  
      justPressed.delete(code);
      keys.delete(code);
    },

    /** Chamado no fim de cada frame pelo game loop para limpar justPressed. */
    clearFrame: () => justPressed.clear(),
  };
})();