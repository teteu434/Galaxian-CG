// ═══════════════════════════════════════════════════════════════
// src/core/state.js
// Máquina de estados do jogo.
//
// Estados possíveis:
//   STATE_MENU      → tela inicial com menu
//   STATE_TUTORIAL  → tela de tutorial
//   STATE_RUNNING   → jogo em execução normal
//   STATE_PAUSED    → jogo congelado
//   STATE_GAMEOVER  → jogador morreu
//   STATE_WIN       → todos inimigos eliminados
//   STATE_CONFIRM   → aguardando confirmação de reinício
//
// Dependências: STATE_* (constants.js)
// Exporta (global): GameState
// ═══════════════════════════════════════════════════════════════
"use strict";

const GameState = (() => {
  let current   = STATE_MENU; // Alterado: inicia no MENU
  let prevState = STATE_MENU; // estado antes de abrir o diálogo de confirmação

  return {
    /** Retorna o estado atual. */
    get: ()      => current,

    /** Define o novo estado. */
    set: s       => { current = s; },

    /** Salva o estado atual antes de transitar para STATE_CONFIRM. */
    savePrev: () => { prevState = current; },

    /** Retorna o estado salvo (para restaurar ao cancelar reinício). */
    getPrev: ()  => prevState,

    /** Atalho de comparação. */
    is: s        => current === s,
  };
})();