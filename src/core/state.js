// ═══════════════════════════════════════════════════════════════
// src/core/state.js
// Máquina de estados do jogo.
//
// Estados possíveis (definidos em constants.js):
//   STATE_RUNNING  → jogo em execução normal
//   STATE_PAUSED   → jogo congelado
//   STATE_GAMEOVER → jogador morreu
//   STATE_WIN      → todos inimigos eliminados
//   STATE_CONFIRM  → aguardando confirmação de reinício
//
// prevState é salvo antes de entrar em STATE_CONFIRM para que,
// ao cancelar, o jogo volte ao estado correto (running ou paused).
//
// Dependências: STATE_RUNNING (constants.js)
// Exporta (global): GameState
// ═══════════════════════════════════════════════════════════════
"use strict";

const GameState = (() => {
  let current   = STATE_RUNNING;
  let prevState = STATE_RUNNING; // estado antes de abrir o diálogo de confirmação

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