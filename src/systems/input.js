// ═══════════════════════════════════════════════════════════════
// src/systems/input.js
// Sistema de captura de entrada por teclado.
//
// Estratégia: polling híbrido
//   - isDown()     → tecla mantida pressionada (movimento contínuo)
//   - wasPressed() → tecla pressionada UMA VEZ neste frame (ação única)
//
// Por que polling e não só eventos?
//   Eventos keydown com `repeat:true` dependem do rate do OS.
//   Com polling controlamos exatamente quando o input é consumido.
//
// Dependências: nenhuma
// Exporta (global): Input
// ═══════════════════════════════════════════════════════════════
"use strict";

const Input = (() => {
  const keys        = new Set(); // teclas atualmente pressionadas
  const justPressed = new Set(); // pressionadas pela primeira vez NESTE frame

  window.addEventListener('keydown', e => {
    // Só registra em justPressed na primeira vez (ignora auto-repeat do OS)
    if (!keys.has(e.code)) justPressed.add(e.code);
    keys.add(e.code);
    // Previne scroll da página com as teclas de jogo
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
        justPressed.delete(code); // consome — não retorna true de novo no mesmo frame
        return true;
      }
      return false;
    },

    /** Chamado no fim de cada frame pelo game loop para limpar justPressed. */
    clearFrame: () => justPressed.clear(),
  };
})();